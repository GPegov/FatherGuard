// test_api_endpoint.mjs
import axios from 'axios';

async function testAPIEndpoint() {
  console.log('=== Тест API endpoint для Республики Башкортостан ===');
  
  try {
    // Тестируем endpoint получения данных
    console.log('\n1. Получение данных через API:');
    const response = await axios.get('http://localhost:3000/api/fssp/data?regionCode=02');
    
    console.log(`   Статус: ${response.status}`);
    console.log(`   Успешно: ${response.data.success}`);
    
    if (response.data.success && response.data.data) {
      console.log(`   Данные получены:`);
      console.log(`     Временная метка: ${response.data.data.timestamp}`);
      console.log(`     Количество регионов: ${response.data.data.regions.length}`);
      
      if (response.data.data.regions.length > 0) {
        console.log(`     Регион: ${response.data.data.regions[0].region}`);
        console.log(`     Количество городов: ${response.data.data.regions[0].cities.length}`);
        
        // Показываем первые несколько городов
        response.data.data.regions[0].cities.slice(0, 3).forEach((city, index) => {
          console.log(`       ${index + 1}. ${city.name}: ${city.departments.length} отделений`);
        });
      }
    }
    
  } catch (error) {
    if (error.response) {
      console.error(`\nОшибка API:`);
      console.error(`  Статус: ${error.response.status}`);
      console.error(`  Данные:`, error.response.data);
    } else {
      console.error(`\nОшибка соединения:`, error.message);
    }
  }
}

testAPIEndpoint();