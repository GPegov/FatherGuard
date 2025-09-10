import FSSPParser from './backend/services/fsspParser.js';

async function testPageAccess() {
  console.log('=== Тест доступности страницы ФССП для Республики Башкортостан ===');
  
  try {
    // Создаем парсер для Башкортостана
    const parser = new FSSPParser('Республика Башкортостан');
    
    console.log(`\nURL для теста: ${parser.baseUrl}`);
    
    // Пробуем получить данные
    console.log(`\nЗапуск getRegionData()...`);
    const data = await parser.getRegionData();
    
    console.log(`\nРезультат:`);
    console.log(`  Количество городов: ${data.cities.length}`);
    
    // Подсчитываем общее количество отделений
    let totalDepartments = 0;
    data.cities.forEach(city => {
      totalDepartments += city.departments.length;
    });
    
    console.log(`  Всего отделений: ${totalDepartments}`);
    
    // Показываем первые несколько городов
    if (data.cities.length > 0) {
      console.log(`\nПример данных:`);
      data.cities.slice(0, 3).forEach((city, index) => {
        console.log(`  ${index + 1}. ${city.name}: ${city.departments.length} отделений`);
        if (city.departments.length > 0) {
          console.log(`     Пример: ${city.departments[0].name}`);
        }
      });
    } else {
      console.log(`\nДанные не получены. Проверим тестовые данные:`);
      console.log(`  Тестовые данные:`, JSON.stringify(data, null, 2));
    }
    
  } catch (error) {
    console.error('\nОшибка при выполнении теста:');
    console.error('Сообщение:', error.message);
    console.error('Стек:', error.stack);
  }
}

testPageAccess();