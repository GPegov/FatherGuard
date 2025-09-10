import FSSPParser from "./backend/services/fsspParser.js";

// Тестовый скрипт для проверки парсинга Республики Калмыкия
async function testKalmykiaParsing() {
  console.log("Запуск теста парсинга для Республики Калмыкия...");
  
  try {
    // Создаем парсер для Республики Калмыкия
    const parser = new FSSPParser("Республика Калмыкия");
    
    console.log("Базовый URL:", parser.baseUrl);
    console.log("Код региона:", parser.regionCode);
    
    // Запускаем парсинг
    console.log("\nНачинаем парсинг...");
    const result = await parser.parseAllData();
    
    console.log("\nРезультат парсинга:");
    console.log(JSON.stringify(result, null, 2));
    
    // Проверяем сохраненные данные
    if (result.success) {
      const savedData = await parser.getData();
      if (savedData) {
        console.log("\nСохраненные данные:");
        console.log("Время сохранения:", savedData.timestamp);
        console.log("Количество регионов:", savedData.regions.length);
        
        if (savedData.regions.length > 0) {
          const region = savedData.regions[0];
          console.log("Название региона:", region.region);
          console.log("Количество городов:", region.cities.length);
          
          // Показываем первые несколько отделений
          region.cities.slice(0, 3).forEach((city, index) => {
            console.log(`\nГород ${index + 1}: ${city.name}`);
            console.log("Количество отделений:", city.departments.length);
            city.departments.slice(0, 2).forEach((dept, deptIndex) => {
              console.log(`  Отделение ${deptIndex + 1}:`);
              console.log(`    Название: ${dept.name}`);
              console.log(`    Адрес: ${dept.address}`);
              console.log(`    Телефон: ${dept.phone}`);
            });
          });
        }
      }
    }
  } catch (error) {
    console.error("Ошибка при тестировании парсинга:", error.message);
    console.error("Стек ошибки:", error.stack);
  }
}

// Запускаем тест
testKalmykiaParsing();