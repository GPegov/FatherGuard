// diagnose.js
import axios from 'axios';

async function diagnose() {
  try {
    console.log('Проверка доступности сайта ФССП...');
    const response = await axios.get('https://fssp.gov.ru/contacts', {
      timeout: 10000 // 10 секунд таймаут
    });
    
    console.log('Статус:', response.status);
    console.log('Длина ответа:', response.data.length);
    console.log('Первые 200 символов:');
    console.log(response.data.substring(0, 200));
    
    // Проверим, содержит ли ответ ключевые элементы
    if (response.data.includes('контакт') || response.data.includes('отделение')) {
      console.log('Найдены ключевые слова');
    } else {
      console.log('Ключевые слова не найдены');
    }
    
  } catch (error) {
    console.error('Ошибка:', error.message);
    if (error.code) {
      console.error('Код ошибки:', error.code);
    }
  }
}

diagnose();