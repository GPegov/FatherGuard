import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fsspRegions from "./services/fsspRegions.js";
import transliterate from "./services/transliterate.js";

// Получаем __dirname в ES модуле
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Путь к папке с базами данных регионов
const dbPath = path.join(__dirname, "dataBase", "fsspDepartmentsDB");

// Создаем карту соответствия названий регионов их кодам
const regionCodeMap = {};
Object.keys(fsspRegions).forEach(region => {
  const code = fsspRegions[region];
  const transliteratedName = transliterate(region);
  regionCodeMap[transliteratedName] = code;
});

console.log("Переименование файлов в папке fsspDepartmentsDB...");

// Получаем список файлов в папке
const files = fs.readdirSync(dbPath);

let renamedFiles = 0;

files.forEach(file => {
  // Проверяем, что это .json файл
  if (path.extname(file) === ".json") {
    // Получаем имя файла без расширения
    const fileNameWithoutExt = path.basename(file, ".json");
    
    // Проверяем, есть ли такой регион в нашем списке
    if (regionCodeMap[fileNameWithoutExt]) {
      const regionCode = regionCodeMap[fileNameWithoutExt];
      const newFileName = `${regionCode}_${fileNameWithoutExt}.json`;
      const oldFilePath = path.join(dbPath, file);
      const newFilePath = path.join(dbPath, newFileName);
      
      // Переименовываем файл
      fs.renameSync(oldFilePath, newFilePath);
      console.log(`Файл "${file}" переименован в "${newFileName}"`);
      renamedFiles++;
    } else {
      console.log(`Не найден код для региона с названием файла: ${fileNameWithoutExt}`);
    }
  }
});

console.log(`Переименование файлов завершено. Переименовано файлов: ${renamedFiles}`);