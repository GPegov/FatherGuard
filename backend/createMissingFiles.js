import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import transliterate from "./services/transliterate.js";

// Получаем __dirname в ES модуле
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Список отсутствующих регионов
const missingRegions = [
  "Республика Адыгея",
  "Республика Алтай",
  "Кабардино-Балкарская Республика",
  "Республика Коми",
  "Республика Тыва",
  "Приморский край",
  "Хабаровский край",
  "Брянская область",
  "Иркутская область",
  "Кировская область"
];

// Путь к папке с базами данных регионов
const dbPath = path.join(__dirname, "dataBase", "fsspDepartmentsDB");

console.log("Создание недостающих файлов баз данных для регионов...");

missingRegions.forEach(region => {
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
  } else {
    console.log(`Файл для региона "${region}" уже существует: ${fileName}`);
  }
});

console.log("Создание недостающих файлов завершено.");