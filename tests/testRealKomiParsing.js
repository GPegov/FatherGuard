import { FSSPParser } from './services/parsing/fsspParser.js';

async function testKomiParsing() {
  console.log('Тестирование парсинга Республики Коми...');
  
  // Создаем экземпляр парсера для Республики Коми
  const parser = new FSSPParser("Республика Коми");
  
  console.log(`Регион: ${parser.regionName}`);
  console.log(`Код региона: ${parser.regionCode}`);
  console.log(`URL для парсинга: ${parser.baseUrl}`);
  
  try {
    // Запускаем парсинг
    const result = await parser.parseAllData();
    
    console.log('\nРезультаты парсинга:');
    console.log(`Успешно: ${result.success}`);
    console.log(`Сообщение: ${result.message}`);
    
    if (result.statistics) {
      console.log('\nСтатистика:');
      console.log(`Регионов: ${result.statistics.regions}`);
      console.log(`Городов: ${result.statistics.cities}`);
      console.log(`Отделений: ${result.statistics.departments}`);
    }
    
    // Проверяем сохраненные данные
    const savedData = await parser.getData();
    if (savedData && savedData.regions && savedData.regions.length > 0) {
      console.log('\nСохраненные данные:');
      console.log(`Всего регионов в данных: ${savedData.regions.length}`);
      
      // Выводим информацию о первом регионе
      const firstRegion = savedData.regions[0];
      console.log(`\nРегион: ${firstRegion.region}`);
      console.log(`Городов: ${firstRegion.cities.length}`);
      
      // Выводим первые несколько городов
      firstRegion.cities.slice(0, 3).forEach((city, index) => {
        console.log(`  ${index + 1}. ${city.name} (${city.departments.length} отделений)`);
      });
    }
  } catch (error) {
    console.error('Ошибка при тестировании парсинга:', error.message);
  }
}

// Запускаем тест
testKomiParsing();