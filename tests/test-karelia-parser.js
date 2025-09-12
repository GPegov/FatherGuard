import FSSPParser from '../backend/services/fsspParser.js';

async function testKareliaParser() {
  try {
    // Создаем парсер для Республики Карелия
    const parser = new FSSPParser("Республика Карелия");
    
    console.log(`Парсер создан для региона: ${parser.regionName}`);
    console.log(`Код региона: ${parser.regionCode}`);
    console.log(`Базовый URL: ${parser.baseUrl}`);
    
    // Запускаем парсинг
    console.log('Запуск парсинга данных...');
    const result = await parser.parseAllData();
    
    console.log('Результат парсинга:', JSON.stringify(result, null, 2));
    
    // Проверяем сохраненные данные
    const savedData = await parser.getData();
    if (savedData) {
      console.log('Сохраненные данные:');
      console.log(JSON.stringify(savedData, null, 2));
    } else {
      console.log('Данные не были сохранены');
    }
  } catch (error) {
    console.error('Ошибка при тестировании парсера:', error.message);
    console.error('Стек ошибки:', error.stack);
  }
}

testKareliaParser();