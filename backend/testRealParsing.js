import FSSPParser from "./services/fsspParser.js";

async function testRealParsing() {
  try {
    console.log("Тестирование реального парсинга FSSPParser...");
    
    // Создаем экземпляр парсера для Свердловской области
    const parser = new FSSPParser("Свердловская область");
    
    console.log(`Регион: ${parser.regionName}`);
    console.log(`Код региона: ${parser.regionCode}`);
    console.log(`URL: ${parser.baseUrl}`);
    
    // Запускаем реальный парсинг
    console.log("Запуск реального парсинга...");
    const result = await parser.getRegionData();
    console.log("Результат парсинга:");
    console.log(`  Найдено отделений: ${result.cities.reduce((total, city) => total + city.departments.length, 0)}`);
    console.log(`  Найдено городов: ${result.cities.length}`);
    
    // Показываем первые несколько отделений
    console.log("Примеры отделений:");
    let count = 0;
    for (const city of result.cities) {
      for (const dept of city.departments) {
        if (count < 5) {
          console.log(`  - ${dept.name}: ${dept.address}, ${dept.phone}`);
          count++;
        }
      }
    }
    
  } catch (error) {
    console.error("Ошибка при тестировании реального парсинга FSSPParser:", error);
    console.error("Стек ошибки:", error.stack);
  }
}

testRealParsing();