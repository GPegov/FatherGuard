import fetch from 'node-fetch';

async function testRegionsAPI() {
  try {
    console.log('Тестирование API endpoint /api/fssp/regions...');
    
    const response = await fetch('http://localhost:3001/api/fssp/regions');
    const data = await response.json();
    
    if (data.success) {
      console.log('✓ API endpoint работает корректно');
      console.log(`Найдено регионов: ${data.regions.length}`);
      
      // Проверим наличие Республики Коми
      const komiRegion = data.regions.find(r => r.name === 'Республика Коми');
      if (komiRegion) {
        console.log('✓ Республика Коми найдена в списке регионов');
        console.log(`  Код региона: ${komiRegion.code}`);
      } else {
        console.log('✗ Республика Коми НЕ найдена в списке регионов');
        console.log('Все регионы:', data.regions.map(r => r.name));
      }
      
      // Выведем первые 5 регионов
      console.log('\nПервые 5 регионов:');
      data.regions.slice(0, 5).forEach(region => {
        console.log(`  ${region.name} (${region.code})`);
      });
    } else {
      console.log('✗ Ошибка API endpoint:', data.message);
    }
  } catch (error) {
    console.error('Ошибка при тестировании API:', error.message);
  }
}

testRegionsAPI();