// test_parser_detailed.js
import FSSPParser from './backend/services/fsspParser.js';

async function runDetailedTest() {
  console.log('=== Детальный тест парсера для Республики Башкортостан ===');
  
  try {
    // Создаем парсер для Башкортостана
    const parser = new FSSPParser('Республика Башкортостан');
    
    console.log(`
1. Базовая информация:`);
    console.log(`   Название региона: ${parser.regionName}`);
    console.log(`   Код региона: ${parser.regionCode}`);
    console.log(`   Базовый URL: ${parser.baseUrl}`);
    console.log(`   Имя файла данных: ${parser.fileName}`);
    console.log(`   Путь к файлу данных: ${parser.dataFilePath}`);
    
    // Проверяем загрузку известных городов
    console.log(`
2. Загрузка известных городов:`);
    const knownCitiesData = parser.loadKnownCitiesForRegion();
    console.log(`   Загружено городов: ${knownCitiesData.cities.length}`);
    console.log(`   Первые 5 городов: ${knownCitiesData.cities.slice(0, 5).join(', ')}`);
    
    // Проверяем загрузку нестандартных URL
    console.log(`
3. Нестандартные URL:`);
    console.log(`   Данные:`, parser.customUrls);
    console.log(`   Найден URL для региона 02:`, parser.customUrls['02']);
    
    // Пробуем получить данные
    console.log(`
4. Получение данных через парсер:`);
    console.log(`   Запуск getRegionData()...`);
    
    const rawData = await parser.getRegionData();
    console.log(`   Результат:`, JSON.stringify(rawData, null, 2));
    
  } catch (error) {
    console.error(`
Ошибка при выполнении теста:`);
    console.error('Сообщение:', error.message);
    console.error('Стек:', error.stack);
  }
}

runDetailedTest();