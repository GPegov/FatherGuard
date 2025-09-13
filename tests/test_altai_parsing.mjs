import FSSPParser from './backend/services/parsing/fsspParser.js';

async function testAltaiParsing() {
  console.log('=== Тест запрета парсинга Республики Алтай (регион 04) ===');
  
  try {
    // Создаем парсер для Республики Алтай
    const parser = new FSSPParser('Республика Алтай');
    
    console.log(`\nРегион: ${parser.regionName}`);
    console.log(`Код региона: ${parser.regionCode}`);
    console.log(`Файл данных: ${parser.fileName}`);
    
    // Пробуем запустить парсинг
    console.log(`\nЗапуск парсинга...`);
    const result = await parser.parseAllData();
    
    console.log(`\nРезультат:`);
    console.log(`  Успешно: ${result.success}`);
    console.log(`  Сообщение: ${result.message}`);
    
    if (result.statistics) {
      console.log(`  Статистика:`);
      console.log(`    Регионов: ${result.statistics.regions}`);
      console.log(`    Городов: ${result.statistics.cities}`);
      console.log(`    Отделений: ${result.statistics.departments}`);
    }
    
  } catch (error) {
    console.error('\nОшибка при тестировании:');
    console.error('Сообщение:', error.message);
  }
}

testAltaiParsing();