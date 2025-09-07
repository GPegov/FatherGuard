import FSSPParser from "./services/fsspParser.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Получаем __dirname в ES модуле
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testParser() {
  try {
    console.log("Тестирование FSSPParser с новым форматом имен файлов...");
    
    // Создаем экземпляр парсера для тестового региона
    const parser = new FSSPParser("Свердловская область");
    
    console.log(`Регион: ${parser.regionName}`);
    console.log(`Код региона: ${parser.regionCode}`);
    console.log(`URL: ${parser.baseUrl}`);
    console.log(`Имя файла: ${parser.fileName}`);
    console.log(`Путь к файлу: ${parser.dataFilePath}`);
    
    // Проверяем существование файла
    console.log("Проверка существования файла...");
    console.log(`Файл существует: ${fs.existsSync(parser.dataFilePath)}`);
    
    // Создаем тестовые данные
    const testData = [{
      region: "Свердловская область",
      cities: [
        {
          name: "Екатеринбург",
          departments: [
            {
              name: "Управление ФССП по г. Екатеринбургу",
              address: "г. Екатеринбург, ул. Ленина, д. 25",
              phone: "+7 (343) 123-45-67"
            }
          ]
        }
      ]
    }];
    
    // Сохраняем тестовые данные
    console.log("Сохранение тестовых данных...");
    await parser.saveToFile(testData);
    console.log("Тестовые данные успешно сохранены.");
    
    // Проверяем, что файл был создан
    console.log(`Файл существует после сохранения: ${fs.existsSync(parser.dataFilePath)}`);
    
    // Проверяем содержимое файла
    if (fs.existsSync(parser.dataFilePath)) {
      const fileContent = fs.readFileSync(parser.dataFilePath, "utf8");
      const parsedContent = JSON.parse(fileContent);
      console.log("Содержимое файла:");
      console.log(`  Временная метка: ${parsedContent.timestamp}`);
      console.log(`  Количество регионов: ${parsedContent.regions.length}`);
    }
    
    // Проверяем существование резервной копии
    const backupPath = path.join(__dirname, "dataBase", "backup", parser.fileName);
    console.log(`Резервная копия существует: ${fs.existsSync(backupPath)}`);
    
  } catch (error) {
    console.error("Ошибка при тестировании FSSPParser:", error);
  }
}

testParser();