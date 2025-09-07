import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import transliterate from "./services/transliterate.js";

// Получаем __dirname в ES модуле
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Путь к папке с базами данных регионов
const dbPath = path.join(__dirname, "dataBase", "fsspDepartmentsDB");

// Получаем список файлов в папке
const files = fs.readdirSync(dbPath);

console.log("Начинаем переименование файлов...");

files.forEach(file => {
  // Проверяем, что это .json файл
  if (path.extname(file) === ".json") {
    // Получаем имя файла без расширения
    const fileNameWithoutExt = path.basename(file, ".json");
    
    // Проверяем, содержит ли имя файла символ "ь"
    if (fileNameWithoutExt.includes("ь") || fileNameWithoutExt.includes("Ь")) {
      // Создаем новое имя файла без символа "ь"
      const newFileNameWithoutExt = fileNameWithoutExt.replace(/[ьЬ]/g, "");
      const newFileName = `${newFileNameWithoutExt}.json`;
      
      // Полные пути к старому и новому файлам
      const oldFilePath = path.join(dbPath, file);
      const newFilePath = path.join(dbPath, newFileName);
      
      // Переименовываем файл
      fs.renameSync(oldFilePath, newFilePath);
      console.log(`Файл "${file}" переименован в "${newFileName}"`);
    }
  }
});

console.log("Переименование файлов завершено.");