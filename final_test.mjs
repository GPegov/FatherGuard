import FSSPParser from './backend/services/fsspParser.js';

async function finalTest() {
  console.log('=== Финальное тестирование системы загрузки известных городов ===');
  
  try {
    // Тестируем несколько регионов с разными кодами
    const testRegions = [
      { name: 'Республика Адыгея', code: 1 },
      { name: 'Республика Башкортостан', code: 2 },
      { name: 'Республика Карелия', code: 10 },
      { name: 'Свердловская область', code: 66 },
      { name: 'Челябинская область', code: 74 }
    ];
    
    for (const region of testRegions) {
      console.log(`\n--- Тест региона: ${region.name} (код ${region.code}) ---`);
      const parser = new FSSPParser(region.name);
      
      // Проверяем, что код региона правильный
      console.log(`Код региона: ${parser.regionCode}`);
      
      // Загружаем известные города
      const knownCities = parser.loadKnownCitiesForRegion();
      console.log(`Загружено городов: ${knownCities.cities.length}`);
      
      // Показываем первые несколько городов
      if (knownCities.cities.length > 0) {
        console.log(`Примеры городов: ${knownCities.cities.slice(0, 3).join(', ')}`);
      }
      
      // Проверяем, что это правильный регион
      if (knownCities.regionCode === region.code) {
        console.log('✅ Код региона в файле совпадает');
      } else {
        console.log(`❌ Код региона в файле не совпадает: ожидается ${region.code}, получено ${knownCities.regionCode}`);
      }
    }
    
    console.log('\n=== Тестирование завершено ===');
    
  } catch (error) {
    console.error('\nОшибка при тестировании:');
    console.error('Сообщение:', error.message);
    console.error('Стек:', error.stack);
  }
}

finalTest();