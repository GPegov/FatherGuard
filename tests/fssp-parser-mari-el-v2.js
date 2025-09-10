import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function parseFSSPMariEl() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Переходим на страницу контактов ФССП для Республики Марий Эл
    await page.goto('https://r12.fssp.gov.ru/contacts', { waitUntil: 'networkidle2' });
    
    // Ждем загрузки контента
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Получаем данные из таблицы
    const departments = await page.evaluate(() => {
      // Ищем таблицу с контактами
      const tables = Array.from(document.querySelectorAll('table'));
      
      // Находим таблицу с наибольшим количеством строк, предположительно это таблица с отделениями
      let targetTable = null;
      let maxRows = 0;
      
      tables.forEach(table => {
        const rowCount = table.querySelectorAll('tr').length;
        if (rowCount > maxRows) {
          maxRows = rowCount;
          targetTable = table;
        }
      });
      
      if (!targetTable) {
        console.log('Не удалось найти таблицу с отделениями');
        return [];
      }
      
      console.log(`Найдена таблица с ${maxRows} строками`);
      
      // Получаем все строки таблицы
      const rows = Array.from(targetTable.querySelectorAll('tr'));
      
      // Определяем заголовки
      let headers = [];
      const headerRow = rows[0];
      if (headerRow) {
        headers = Array.from(headerRow.querySelectorAll('th, td')).map(cell => cell.textContent.trim());
        console.log('Заголовки таблицы:', headers);
      }
      
      // Определяем индексы колонок
      let nameIndex = -1;
      let addressIndex = -1;
      let phoneIndex = -1;
      let scheduleIndex = -1;
      
      headers.forEach((header, index) => {
        const headerLower = header.toLowerCase();
        if (headerLower.includes('наименование') || headerLower.includes('отделение') || headerLower.includes('название')) {
          nameIndex = index;
        } else if (headerLower.includes('адрес')) {
          addressIndex = index;
        } else if (headerLower.includes('телефон')) {
          phoneIndex = index;
        } else if (headerLower.includes('режим') || headerLower.includes('график')) {
          scheduleIndex = index;
        }
      });
      
      console.log(`Индексы колонок: name=${nameIndex}, address=${addressIndex}, phone=${phoneIndex}, schedule=${scheduleIndex}`);
      
      // Если не можем определить заголовки, используем стандартные индексы
      if (nameIndex === -1 && addressIndex === -1 && phoneIndex === -1 && scheduleIndex === -1) {
        // Предполагаем стандартную структуру: [номер, название, адрес, телефон, режим работы]
        nameIndex = 1;
        addressIndex = 2;
        phoneIndex = 3;
        scheduleIndex = 4;
        console.log('Используем стандартные индексы колонок');
      }
      
      const departments = [];
      
      // Обрабатываем строки данных (пропускаем заголовок)
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const cells = Array.from(row.querySelectorAll('td'));
        
        if (cells.length === 0) continue;
        
        // Получаем данные из ячеек
        const name = nameIndex >= 0 && nameIndex < cells.length ? cells[nameIndex].textContent.trim() : '';
        const address = addressIndex >= 0 && addressIndex < cells.length ? cells[addressIndex].textContent.trim() : '';
        const phone = phoneIndex >= 0 && phoneIndex < cells.length ? cells[phoneIndex].textContent.trim() : '';
        const schedule = scheduleIndex >= 0 && scheduleIndex < cells.length ? cells[scheduleIndex].textContent.trim() : '';
        
        // Добавляем только если есть название отделения
        if (name && name.length > 5) {
          departments.push({
            name: name,
            address: address,
            phone: phone,
            schedule: schedule
          });
        }
      }
      
      return departments;
    });
    
    console.log(`Найдено отделений: ${departments.length}`);
    
    // Выводим несколько примеров для проверки
    console.log('\nПримеры отделений:');
    departments.slice(0, 5).forEach((dept, index) => {
      console.log(`${index + 1}. ${dept.name}`);
      console.log(`   Адрес: ${dept.address}`);
      console.log(`   Телефон: ${dept.phone}`);
      console.log(`   Режим работы: ${dept.schedule}`);
      console.log('');
    });
    
    // Сохраняем данные в файл
    const outputPath = path.join('backend', 'dataBase', 'fsspDepartmentsDB', '12_Respublika_Mariy_El.json');
    const data = {
      region: "Республика Марий Эл",
      code: "12",
      departments: departments,
      lastUpdated: new Date().toISOString()
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`\nДанные успешно сохранены в ${outputPath}`);
    
    await browser.close();
    return data;
  } catch (error) {
    console.error('Ошибка при парсинге:', error);
    await browser.close();
    throw error;
  }
}

// Запускаем парсинг
parseFSSPMariEl().catch(console.error);