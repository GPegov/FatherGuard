import fsspRegions from "./fsspRegions.js";
import transliterate from "./transliterate.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Создаем пустые файлы для всех регионов
const createRegionFiles = () => {
  const dbPath = path.join(__dirname, "..", "dataBase", "fsspDepartmentsDB");
  
  // Проверяем, существует ли папка, если нет - создаем
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
  }
  
  // Создаем пустой файл для каждого региона
  Object.keys(fsspRegions).forEach(regionName => {
    const fileName = `${transliterate(regionName)}.json`;
    const filePath = path.join(dbPath, fileName);
    
    // Если файл не существует, создаем его с пустой структурой
    if (!fs.existsSync(filePath)) {
      const emptyData = {
        timestamp: new Date().toISOString(),
        regions: [{
          region: regionName,
          cities: []
        }]
      };
      
      fs.writeFileSync(filePath, JSON.stringify(emptyData, null, 2), "utf8");
      console.log(`Создан файл для региона ${regionName}: ${fileName}`);
    }
  });
  
  console.log("Все файлы регионов созданы успешно!");
};

// Запускаем создание файлов
createRegionFiles();