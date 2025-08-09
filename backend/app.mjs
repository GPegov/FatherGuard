import "dotenv/config";
import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import aiRoutes from "./routes/aiRoutes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 1. Инициализация файла базы данных
const dbPath = join(__dirname, "db.json");

// 2. Функция для гарантированной инициализации DB
async function initDB() {
  try {
    // Проверяем существует ли файл
    try {
      await fs.access(dbPath);
      console.log("DB file exists");
    } catch {
      // Если файла нет - создаем с начальной структурой
      await fs.writeFile(
        dbPath,
        JSON.stringify({ documents: [], complaints: [] }, null, 2)
      );
      console.log("Created new DB file");
    }

    // Читаем данные
    const data = await fs.readFile(dbPath, "utf-8");
    const parsedData = JSON.parse(data);

    // Проверяем структуру
    if (!parsedData.documents || !parsedData.complaints) {
      throw new Error("Invalid DB structure");
    }

    return parsedData;
  } catch (err) {
    console.error("DB init failed:", err);
    throw err;
  }
}

// 3. Инициализация приложения
async function startServer() {
  try {
    // Загружаем данные
    const initialData = await initDB();

    // Создаем экземпляр lowdb с гарантированными данными
    const adapter = new JSONFile(dbPath);
    const db = new Low(adapter, initialData);
    await db.read();

    // Инициализация multer
    const uploadDir = join(__dirname, "uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    const upload = multer({ dest: uploadDir });

    // Создаем Express приложение
    const app = express();
    app.use(
      cors({
        origin: "http://localhost:5173", // или ваш фронтенд URL
        methods: ["GET", "POST", "PUT", "DELETE"], // добавьте PUT
      })
    );
    app.use(express.json());
    app.use("/uploads", express.static(uploadDir));

    // Middleware для обработки новых записей
    app.use((req, res, next) => {
      if (req.method === "POST") {
        if (req.path.includes("/documents")) {
          req.body = {
            id: uuidv4(),
            date: new Date().toISOString().split("T")[0],
            agency: "",
            originalText: "",
            summary: "",
            keyParagraphs: [],
            attachments: [],
            createdAt: new Date().toISOString(),
            ...req.body,
          };
        } else if (req.path.includes("/complaints")) {
          req.body = {
            id: uuidv4(),
            documentId: "",
            agency: "",
            content: "",
            status: "draft",
            createdAt: new Date().toISOString(),
            ...req.body,
          };
        }
      }
      next();
    });

    app.locals.db = db; // Делаем db доступной в роутах

    // Подключение роутов (убедитесь, что они экспортируют router)
    import("./routes/documentRoutes.js").then(({ default: documentRoutes }) => {
      app.use("/api/documents", documentRoutes({ db, upload }));
    });

    import("./routes/complaintRoutes.js").then(
      ({ default: complaintRoutes }) => {
        app.use("/api/complaints", complaintRoutes({ db }));
      }
    );
    app.use("/api/ai", aiRoutes);

    // Запуск сервера
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Server startup failed:", err);
    process.exit(1);
  }
}

startServer();
