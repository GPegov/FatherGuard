// debug-html.js
import axios from 'axios';
import * as cheerio from 'cheerio';

async function debugHTML() {
  try {
    console.log('Получение HTML страницы контактов ФССП...');
    const response = await axios.get('https://fssp.gov.ru/contacts');
    const $ = cheerio.load(response.data);
    
    console.log('Длина полученных данных:', response.data.length);
    console.log('Первые 500 символов ответа:');
    console.log(response.data.substring(0, 500));
    
  } catch (error) {
    console.error('Ошибка:', error.message);
  }
}

debugHTML();