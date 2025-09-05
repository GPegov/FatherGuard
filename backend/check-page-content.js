import axios from 'axios';

async function checkPageContent() {
  try {
    console.log('Проверка содержимого страницы ФССП по Свердловской области...');
    
    const url = 'https://r66.fssp.gov.ru/contacts';
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 15000
    });
    
    console.log('Статус ответа:', response.status);
    console.log('Длина содержимого:', response.data.length);
    
    // Покажем начало и конец содержимого для анализа
    console.log('\nНачало содержимого (первые 500 символов):');
    console.log(response.data.substring(0, 500));
    
    console.log('\nКонец содержимого (последние 500 символов):');
    console.log(response.data.substring(response.data.length - 500));
    
    // Проверим, содержит ли страница ссылки на другие ресурсы
    if (response.data.includes('ajax') || response.data.includes('json') || response.data.includes('api')) {
      console.log('\nСтраница может загружать данные через AJAX/API');
    }
    
    // Проверим, есть ли в содержимом таблицы в виде текста
    if (response.data.includes('<table') || response.data.includes('tbody') || response.data.includes('tr>')) {
      console.log('\nВ содержимом найдены элементы таблиц');
    }
    
  } catch (error) {
    console.error('Ошибка при проверке страницы:', error.message);
    if (error.response) {
      console.error('Статус ошибки:', error.response.status);
    }
  }
}

checkPageContent();