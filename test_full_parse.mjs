import FSSPParser from './backend/services/fsspParser.js';

async function runFullParse() {
  console.log('=== Полный парсинг данных для Республики Башкортостан ===');
  
  try {
    // Создаем парсер для Башкортостана
    const parser = new FSSPParser('Республика Башкортостан');
    
    console.log(`\nЗапуск полного парсинга...`);
    const result = await parser.parseAllData();
    
    console.log(`\nРезультат парсинга:`);
    console.log(`  Успешно: ${result.success}`);
    console.log(`  Сообщение: ${result.message}`);
    
    if (result.statistics) {
      console.log(`  Статистика:`);
      console.log(`    Регионов: ${result.statistics.regions}`);
      console.log(`    Городов: ${result.statistics.cities}`);
      console.log(`    Отделений: ${result.statistics.departments}`);
    }
    
    // Проверяем сохраненные данные
    console.log(`\nПроверка сохраненных данных:`);
    const savedData = await parser.getData();
    if (savedData) {
      console.log(`  Данные сохранены:`);
      console.log(`    Временная метка: ${savedData.timestamp}`);
      console.log(`    Количество регионов: ${savedData.regions.length}`);
      if (savedData.regions.length > 0) {
        console.log(`    Количество городов в первом регионе: ${savedData.regions[0].cities.length}`);
        
        // Показываем первые несколько городов
        savedData.regions[0].cities.slice(0, 3).forEach((city, index) => {
          console.log(`      ${index + 1}. ${city.name}: ${city.departments.length} отделений`);
        });
      }
    } else {
      console.log(`  Данные не найдены`);
    }
    
  } catch (error) {
    console.error('\nОшибка при выполнении полного парсинга:');
    console.error('Сообщение:', error.message);
    console.error('Стек:', error.stack);
  }
}

runFullParse();