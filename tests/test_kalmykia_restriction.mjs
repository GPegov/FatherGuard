import FSSPParser from "./backend/services/fsspParser.js";

// Тестовый скрипт для проверки запрета парсинга Республики Калмыкия
async function testKalmykiaParsingRestriction() {
  console.log("Запуск теста запрета парсинга для Республики Калмыкия...");
  
  try {
    // Создаем парсер для Республики Калмыкия
    const parser = new FSSPParser("Республика Калмыкия");
    
    console.log("Базовый URL:", parser.baseUrl);
    console.log("Код региона:", parser.regionCode);
    console.log("Имя файла:", parser.fileName);
    
    // Пытаемся запустить парсинг (должен быть запрещен)
    console.log("\nПопытка запуска парсинга (должен быть запрещен)...");
    const result = await parser.parseAllData();
    
    console.log("\nРезультат попытки парсинга:");
    console.log(JSON.stringify(result, null, 2));
    
    // Проверяем чтение данных из файла
    console.log("\nПопытка чтения данных из файла...");
    const savedData = await parser.getData();
    if (savedData) {
      console.log("Данные успешно прочитаны из файла:");
      console.log("Время сохранения:", savedData.timestamp);
      console.log("Количество регионов:", savedData.regions.length);
      
      if (savedData.regions.length > 0) {
        const region = savedData.regions[0];
        console.log("Название региона:", region.region);
        console.log("Количество городов:", region.cities.length);
        
        // Показываем первые несколько городов
        region.cities.slice(0, 3).forEach((city, index) => {
          console.log(`\nГород ${index + 1}: ${city.name}`);
          console.log("Количество отделений:", city.departments.length);
          city.departments.slice(0, 1).forEach((dept, deptIndex) => {
            console.log(`  Отделение ${deptIndex + 1}:`);
            console.log(`    Название: ${dept.name}`);
            console.log(`    Адрес: ${dept.address}`);
            console.log(`    Телефон: ${dept.phone}`);
          });
        });
      }
    } else {
      console.log("Данные не найдены в файле");
    }
    
  } catch (error) {
    console.error("Ошибка при тестировании:", error.message);
    console.error("Стек ошибки:", error.stack);
  }
}

// Запускаем тест
testKalmykiaParsingRestriction();