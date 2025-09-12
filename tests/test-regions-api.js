import axios from 'axios';

async function testRegionsAPI() {
  try {
    const response = await axios.get('http://localhost:3001/api/fssp/regions');
    console.log('Список регионов:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Проверим, есть ли Карачаево-Черкесская Республика в списке
    const kchr = response.data.regions.find(region => region.name === "Карачаево-Черкесская Республика");
    if (kchr) {
      console.log('\nКарачаево-Черкесская Республика найдена:');
      console.log(JSON.stringify(kchr, null, 2));
    } else {
      console.log('\nКарачаево-Черкесская Республика НЕ найдена в списке регионов!');
    }
  } catch (error) {
    console.error('Ошибка при получении списка регионов:', error.message);
  }
}

testRegionsAPI();