// check-redirect.js
import axios from 'axios';

async function checkRedirect() {
  try {
    console.log('Проверка перенаправлений...');
    const response = await axios.get('https://fssp.gov.ru/contacts', {
      maxRedirects: 0,
      validateStatus: function (status) {
        return status < 400; // Разрешаем перенаправления
      }
    });
    
    console.log('Final URL:', response.request.res.responseUrl || response.config.url);
    console.log('Status:', response.status);
    
  } catch (error) {
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Headers:', error.response.headers);
    } else {
      console.error('Ошибка:', error.message);
    }
  }
}

checkRedirect();