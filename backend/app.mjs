import express from "express";
import cors from "cors";
import path from "path";
import "dotenv/config";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import AIService from "./services/aiService.js";

// Создаем экземпляр AIService
console.log("Инициализация AIService...");
const aiService = new AIService();
console.log("AIService инициализирован с параметрами:", {
  apiUrl: aiService.apiUrl,
  activeModel: aiService.activeModel
});
const app = express();

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
        origin: "http://localhost:5173",
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], 
        allowedHeaders: ["Content-Type", "Authorization"],
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
            keySentences: [],
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

    // Делаем aiService доступным в приложении
    app.locals.aiService = aiService;

    // Эндпоинт для проверки статуса AI-сервера
    app.get("/api/status", async (req, res) => {
      try {
        console.log("Проверка статуса AI-сервера...");
        const response = await fetch("http://localhost:11434/api/tags", {
          timeout: 3000,
        });
        if (response.status === 200) {
          const data = await response.json();
          console.log("AI-сервер доступен, доступные модели:", data.models?.length || 0);
          res.json({ status: "ready", models: data.models || [] });
        } else {
          console.log("AI-сервер вернул статус:", response.status);
          res.json({ status: "error", code: response.status });
        }
      } catch (error) {
        console.error("Ошибка проверки статуса AI-сервера:", error.message);
        res.json({ status: "offline", error: error.message });
      }
    });

    // Эндпоинт для проверки функциональности AIService
    app.get("/api/ai-health", async (req, res) => {
      try {
        console.log("Проверка функциональности AIService...");
        // Проверим, что AIService доступен в app.locals
        if (!app.locals.aiService) {
          console.error("AIService не найден в app.locals");
          return res.status(500).json({ status: "error", message: "AIService not initialized" });
        }
        
        // Простой тестовый запрос
        const testPrompt = "Ответь кратко: Что такое юридический документ?";
        console.log("Отправка тестового запроса к AIService...");
        const result = await app.locals.aiService.queryLocalModel(testPrompt, {
          temperature: 0.1,
          format: "json"
        });
        
        console.log("Тестовый запрос успешен, результат:", typeof result);
        res.json({ 
          status: "ready", 
          testResult: typeof result === 'string' ? result.substring(0, 100) : JSON.stringify(result).substring(0, 100)
        });
      } catch (error) {
        console.error("Ошибка проверки функциональности AIService:", error);
        res.json({ 
          status: "error", 
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      }
    });

    

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
