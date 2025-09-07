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

// Получаем список файлов в папке
const files = fs.readdirSync(dbPath);

console.log("Проверка файлов с неправильной кодировкой...");

// Получаем список всех регионов и их транслитерированных названий
const regions = Object.keys(fsspRegions);
const expectedFileNames = regions.map(region => `${transliterate(region)}.json`);

// Находим файлы с неправильной кодировкой (они не соответствуют ожидаемым названиям)
const filesWithWrongEncoding = files.filter(file => {
  // Пропускаем файлы с правильными названиями
  if (expectedFileNames.includes(file)) {
    return false;
  }
  
  // Проверяем, что это .json файл
  return path.extname(file) === ".json";
});

console.log(`Найдено ${filesWithWrongEncoding.length} файлов с неправильной кодировкой:`);
filesWithWrongEncoding.forEach(file => console.log(`  - ${file}`));

// Пытаемся определить регионы для файлов с неправильной кодировкой
if (filesWithWrongEncoding.length > 0) {
  console.log("\nПопытка определить регионы для файлов с неправильной кодировкой...");
  
  // Для каждого региона проверяем, может ли он соответствовать одному из файлов с неправильной кодировкой
  regions.forEach(region => {
    const expectedFileName = `${transliterate(region)}.json`;
    
    // Если файл с ожидаемым названием уже существует, пропускаем
    if (files.includes(expectedFileName)) {
      return;
    }
    
    // Проверяем, может ли какой-то файл с неправильной кодировкой соответствовать этому региону
    filesWithWrongEncoding.forEach(wrongFile => {
      // Сравниваем длину названий
      if (wrongFile.length === expectedFileName.length) {
        console.log(`Возможно, файл "${wrongFile}" соответствует региону "${region}" (ожидаемое имя: "${expectedFileName}")`);
        
        // Переименовываем файл
        const oldPath = path.join(dbPath, wrongFile);
        const newPath = path.join(dbPath, expectedFileName);
        
        try {
          fs.renameSync(oldPath, newPath);
          console.log(`  Файл переименован: "${wrongFile}" -> "${expectedFileName}"`);
        } catch (error) {
          console.error(`  Ошибка при переименовании файла: ${error.message}`);
        }
      }
    });
  });
}

console.log("Проверка файлов завершена.");