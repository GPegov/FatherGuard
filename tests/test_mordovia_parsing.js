import FSSPParser from '../backend/services/parsing/fsspParser.js';

async function testMordoviaParsing() {
  console.log("Запуск теста парсинга для Республики Мордовия...");
  
  try {
    // Создаем экземпляр парсера для Республики Мордовия
    const parser = new FSSPParser("Республика Мордовия");
    
    console.log(`Код региона: ${parser.regionCode}`);
    console.log(`URL для парсинга: ${parser.baseUrl}`);
    
    // Проверяем загрузку известных городов
    const knownCities = parser.loadKnownCitiesForRegion();
    console.log(`Загружено ${knownCities.cities.length} известных городов`);
    
    // Запускаем парсинг
    console.log("\\nЗапуск парсинга...");
    const result = await parser.parseAllData();
    
    console.log("\\nРезультаты парсинга:");
    console.log(`Успешно: ${result.success}`);
    console.log(`Сообщение: ${result.message}`);
    
    if (result.statistics) {
      console.log(`Статистика:`);
      console.log(`  Регионов: ${result.statistics.regions}`);
      console.log(`  Городов: ${result.statistics.cities}`);
      console.log(`  Отделений: ${result.statistics.departments}`);
    }
    
    // Если парсинг успешен, получаем данные из файла
    if (result.success) {
      const data = await parser.getData();
      if (data && data.regions && data.regions.length > 0) {
        const regionData = data.regions[0];
        console.log(`\\nДанные по региону: ${regionData.region}`);
        console.log(`Количество городов: ${regionData.cities.length}`);
        
        // Показываем первые несколько городов
        console.log("\\nПримеры данных:");
        regionData.cities.slice(0, 5).forEach((city, index) => {
          console.log(`  ${index + 1}. ${city.name} (${city.departments.length} отделений)`);
          if (city.departments.length > 0) {
            console.log(`     Первое отделение: ${city.departments[0].name}`);
            console.log(`     Адрес: ${city.departments[0].address}`);
            console.log(`     Телефон: ${city.departments[0].phone}`);
          }
        });
      }
    }
  } catch (error) {
    console.error("Ошибка при тестировании:", error.message);
    console.error("Стек ошибки:", error.stack);
  }
}

testMordoviaParsing();