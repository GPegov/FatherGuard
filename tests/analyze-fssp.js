import axios from 'axios';
import * as cheerio from 'cheerio';

async function analyzePageStructure() {
  try {
    console.log('Анализ структуры страницы ФССП по Свердловской области...');
    
    const url = 'https://r66.fssp.gov.ru/contacts';
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 15000
    });
    
    const $ = cheerio.load(response.data);
    
    console.log('Статус ответа:', response.status);
    console.log('Длина содержимого:', response.data.length);
    
    // Проверим кодировку
    const contentType = response.headers['content-type'];
    console.log('Content-Type:', contentType);
    
    // Найдем все таблицы
    const tables = $('table');
    console.log('Найдено таблиц:', tables.length);
    
    tables.each((index, table) => {
      console.log(`\n--- Таблица ${index + 1} ---`);
      const rows = $(table).find('tr');
      console.log('Строк в таблице:', rows.length);
      
      if (rows.length > 0) {
        // Покажем заголовок таблицы
        const headerRow = $(rows[0]);
        const headerCells = headerRow.find('th, td');
        console.log('Заголовки:');
        headerCells.each((cellIndex, cell) => {
          console.log(`  ${cellIndex + 1}: ${$(cell).text().trim()}`);
        });
        
        // Покажем несколько строк данных
        console.log('Примеры строк данных:');
        const sampleRows = Math.min(3, rows.length);
        for (let i = 1; i <= sampleRows; i++) {
          if (rows[i]) {
            const cells = $(rows[i]).find('td');
            console.log(`  Строка ${i}:`);
            cells.each((cellIndex, cell) => {
              console.log(`    Ячейка ${cellIndex + 1}: ${$(cell).text().trim()}`);
            });
          }
        }
      }
    });
    
    // Попробуем найти другие элементы с контактной информацией
    console.log('\n--- Поиск других элементов ---');
    const contactElements = $('.contacts, .contact, .department, .office');
    console.log('Найдено элементов с классами contacts/contact/department/office:', contactElements.length);
    
    // Попробуем найти элементы с текстом, содержащим "отделение"
    const departmentElements = $('*:contains("отделение")');
    console.log('Найдено элементов с текстом "отделение":', departmentElements.length);
    
  } catch (error) {
    console.error('Ошибка при анализе страницы:', error.message);
    if (error.response) {
      console.error('Статус ошибки:', error.response.status);
      console.error('Заголовки ответа:', error.response.headers);
    }
  }
}

analyzePageStructure();