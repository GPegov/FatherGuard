// Тестовый скрипт для проверки API endpoint получения данных ФССП
import axios from 'axios';

async function testDataEndpoint() {
  try {
    console.log('Тестирование API endpoint для получения данных ФССП для Республики Калмыкия');
    
    // Тестируем получение данных для Республики Калмыкия
    const response = await axios.get('http://localhost:3001/api/fssp/data?region=Республика Калмыкия');
    console.log('Статус ответа:', response.status);
    console.log('Успешный запрос:', response.data.success);
    console.log('Сообщение:', response.data.message);
    
    if (response.data.success && response.data.data) {
      const data = response.data.data;
      console.log('Время сохранения:', data.timestamp);
      console.log('Количество регионов:', data.regions.length);
      
      if (data.regions.length > 0) {
        const region = data.regions[0];
        console.log('Название региона:', region.region);
        console.log('Количество городов:', region.cities.length);
        
        // Показываем первые несколько городов
        region.cities.slice(0, 3).forEach((city, index) => {
          console.log(`\nГород ${index + 1}: ${city.name}`);
          console.log("Количество отделений:", city.departments.length);
          if (city.departments.length > 0) {
            console.log(`  Первое отделение:`);
            console.log(`    Название: ${city.departments[0].name}`);
            console.log(`    Адрес: ${city.departments[0].address}`);
            console.log(`    Телефон: ${city.departments[0].phone}`);
          }
        });
      }
    } else {
      console.log('Данные не найдены или ошибка:', response.data.message);
    }
    
  } catch (error) {
    console.error('Ошибка при тестировании:', error.message);
    if (error.response) {
      console.error('Статус ответа:', error.response.status);
      console.error('Данные ответа:', error.response.data);
    }
  }
}

// Запускаем тест
testDataEndpoint();