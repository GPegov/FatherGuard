import FSSPParser from '../backend/services/parsing/fsspParser.js';

async function testYakutiaParsing() {
  try {
    // Создаем парсер для Якутии
    const parser = new FSSPParser("Республика Саха (Якутия)");
    
    // Запускаем парсинг
    console.log("Запуск парсинга для Республики Саха (Якутия)...");
    const result = await parser.parseAllData();
    
    console.log("Результат парсинга:", result);
    
    // Проверяем данные
    const data = await parser.getData();
    if (data && data.regions && data.regions[0]) {
      const cities = data.regions[0].cities;
      
      // Ищем города с названием "Город не определен"
      const undefinedCities = cities.filter(city => city.name === "Город не определен");
      
      console.log(`\nКоличество городов с неопределенным названием: ${undefinedCities.length}`);
      
      if (undefinedCities.length > 0) {
        console.log("Отделения с неопределенным городом:");
        undefinedCities.forEach(city => {
          console.log(`  - ${city.departments.length} отделений`);
          city.departments.forEach(dept => {
            console.log(`    * ${dept.name}: ${dept.address}`);
          });
        });
      } else {
        console.log("Все отделения успешно классифицированы по городам!");
      }
      
      // Выводим общую статистику
      console.log(`\nОбщая статистика:`);
      console.log(`  Всего городов: ${cities.length}`);
      const totalDepartments = cities.reduce((sum, city) => sum + city.departments.length, 0);
      console.log(`  Всего отделений: ${totalDepartments}`);
    }
  } catch (error) {
    console.error("Ошибка при тестировании парсинга Якутии:", error);
  }
}

// Запускаем тест
testYakutiaParsing();