import FSSPParser from './backend/services/parsing/fsspParser.js';

async function testRegionLoading() {
  console.log('=== Тест загрузки файлов известных городов ===');
  
  try {
    // Тестируем регион с кодом 1 (Адыгея)
    console.log('\n1. Тест региона с кодом 1 (Адыгея):');
    const parser1 = new FSSPParser('Республика Адыгея');
    console.log(`   Код региона: ${parser1.regionCode}`);
    const knownCities1 = parser1.loadKnownCitiesForRegion();
    console.log(`   Загружено городов: ${knownCities1.cities.length}`);
    console.log(`   Первые 3 города: ${knownCities1.cities.slice(0, 3).join(', ')}`);
    
    // Тестируем регион с кодом 2 (Башкортостан)
    console.log('\n2. Тест региона с кодом 2 (Башкортостан):');
    const parser2 = new FSSPParser('Республика Башкортостан');
    console.log(`   Код региона: ${parser2.regionCode}`);
    const knownCities2 = parser2.loadKnownCitiesForRegion();
    console.log(`   Загружено городов: ${knownCities2.cities.length}`);
    console.log(`   Первые 3 города: ${knownCities2.cities.slice(0, 3).join(', ')}`);
    
    // Тестируем регион с кодом 10 (Карелия)
    console.log('\n3. Тест региона с кодом 10 (Карелия):');
    const parser10 = new FSSPParser('Республика Карелия');
    console.log(`   Код региона: ${parser10.regionCode}`);
    const knownCities10 = parser10.loadKnownCitiesForRegion();
    console.log(`   Загружено городов: ${knownCities10.cities.length}`);
    console.log(`   Первые 3 города: ${knownCities10.cities.slice(0, 3).join(', ')}`);
    
  } catch (error) {
    console.error('\nОшибка при тестировании:');
    console.error('Сообщение:', error.message);
    console.error('Стек:', error.stack);
  }
}

testRegionLoading();