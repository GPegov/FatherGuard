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

console.log("Создание недостающих файлов баз данных для регионов...");

// Получаем список всех регионов
const regions = Object.keys(fsspRegions);

let createdFiles = 0;

regions.forEach(region => {
  const fileName = `${transliterate(region)}.json`;
  const filePath = path.join(dbPath, fileName);
  
  // Проверяем, существует ли файл
  if (!fs.existsSync(filePath)) {
    // Создаем файл с начальной структурой
    const initialData = {
      timestamp: new Date().toISOString(),
      regions: []
    };
    
    fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2), "utf8");
    console.log(`Создан файл базы данных для региона "${region}": ${fileName}`);
    createdFiles++;
  }
});

console.log(`Создание недостающих файлов завершено. Создано файлов: ${createdFiles}`);