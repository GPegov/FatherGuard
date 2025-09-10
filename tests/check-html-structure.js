// check-html-structure.js
import axios from 'axios';
import * as cheerio from 'cheerio';

async function checkHTMLStructure() {
  try {
    console.log('Получение страницы https://r66.fssp.gov.ru/contacts');
    const response = await axios.get('https://r66.fssp.gov.ru/contacts');
    const $ = cheerio.load(response.data);
    
    console.log('Проверка наличия ключевых элементов:');
    console.log('- .contacts-item:', $('.contacts-item').length);
    console.log('- .contacts-department:', $('.contacts-department').length);
    console.log('- .contacts-department-title:', $('.contacts-department-title').length);
    console.log('- .contacts-department-address:', $('.contacts-department-address').length);
    console.log('- .contacts-department-phone:', $('.contacts-department-phone').length);
    
    // Попробуем найти таблицу
    console.log('\nПоиск таблиц:');
    console.log('- table:', $('table').length);
    console.log('- tr:', $('tr').length);
    console.log('- td:', $('td').length);
    
    // Покажем структуру первых нескольких строк таблицы
    if ($('table').length > 0) {
      console.log('\nСтруктура таблицы:');
      $('table').first().find('tr').slice(0, 5).each((index, element) => {
        console.log(`Строка ${index + 1}:`);
        $(element).find('td').each((tdIndex, tdElement) => {
          const text = $(tdElement).text().trim();
          console.log(`  Колонка ${tdIndex + 1}: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
        });
      });
    }
    
  } catch (error) {
    console.error('Ошибка:', error.message);
  }
}

checkHTMLStructure();