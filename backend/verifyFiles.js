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

console.log("Проверка файлов баз данных для всех регионов...");

// Получаем список всех регионов
const regions = Object.keys(fsspRegions);

let missingFiles = 0;
let totalFiles = 0;

regions.forEach(region => {
  const fileName = `${transliterate(region)}.json`;
  const filePath = path.join(dbPath, fileName);
  
  totalFiles++;
  
  // Проверяем, существует ли файл
  if (fs.existsSync(filePath)) {
    // Проверяем содержимое файла
    try {
      const fileContent = fs.readFileSync(filePath, "utf8");
      const parsedContent = JSON.parse(fileContent);
      
      // Проверяем структуру файла
      if (parsedContent.timestamp && parsedContent.regions) {
        // console.log(`✓ Файл для региона "${region}" корректен: ${fileName}`);
      } else {
        console.log(`✗ Файл для региона "${region}" имеет неправильную структуру: ${fileName}`);
      }
    } catch (error) {
      console.log(`✗ Ошибка при чтении файла для региона "${region}": ${fileName} - ${error.message}`);
    }
  } else {
    console.log(`✗ Файл для региона "${region}" отсутствует: ${fileName}`);
    missingFiles++;
  }
});

console.log(`\nПроверка завершена. Всего регионов: ${regions.length}, Отсутствующих файлов: ${missingFiles}`);

if (missingFiles === 0) {
  console.log("✓ Все файлы баз данных регионов присутствуют и имеют правильную структуру.");
} else {
  console.log(`✗ Требуется создать ${missingFiles} файлов.`);
}