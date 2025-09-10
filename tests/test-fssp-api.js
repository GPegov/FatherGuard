import axios from 'axios';

// Тестирование API endpoint для парсинга Республики Марий Эл
async function testFSSPParserAPI() {
  try {
    console.log('Тестирование API endpoint для парсинга Республики Марий Эл');
    
    // Отправляем запрос на парсинг
    const response = await axios.post('http://localhost:3000/api/fssp/parse', {
      region: 'Республика Марий Эл',
      regionCode: 12
    });
    
    console.log('Ответ от API:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Ошибка при тестировании API:', error.message);
    if (error.response) {
      console.log('Данные ответа с ошибкой:');
      console.log(JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Запускаем тест
testFSSPParserAPI();