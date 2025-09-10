// simple-debug.js
import axios from 'axios';

async function simpleDebug() {
  try {
    console.log('Получение данных со страницы контактов ФССП...');
    const response = await axios.get('https://fssp.gov.ru/contacts');
    
    // Выведем информацию о response
    console.log('Status:', response.status);
    console.log('Status text:', response.statusText);
    console.log('Content type:', response.headers['content-type']);
    console.log('Data length:', response.data.length);
    
    // Проверим, содержит ли данные определенные ключевые слова
    if (response.data.includes('контакт')) {
      console.log('Найдено упоминание "контакт"');
    }
    if (response.data.includes('отделение')) {
      console.log('Найдено упоминание "отделение"');
    }
    
  } catch (error) {
    console.error('Ошибка:', error.message);
  }
}

simpleDebug();