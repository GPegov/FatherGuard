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
      
      if (tables.length === 0) {
        console.log('Не удалось найти таблицы на странице');
        return [];
      }
      
      // Работаем с первой таблицей
      const targetTable = tables[0];
      console.log(`Работаем с таблицей, содержащей ${targetTable.querySelectorAll('tr').length} строк`);
      
      // Получаем все строки таблицы
      const rows = Array.from(targetTable.querySelectorAll('tr'));
      
      // Находим строку, с которой начинается список отделений (ищем строку с подстрокой "отдел")
      let startIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length > 0) {
          const firstCellText = cells[0].textContent.trim().toLowerCase();
          // Ищем строку, начинающуюся с названия отделения (содержащую "отдел")
          if (firstCellText.includes('отдел')) {
            startIndex = i;
            break;
          }
        }
      }
      
      if (startIndex === -1) {
        console.log('Не удалось найти начало списка отделений');
        return [];
      }
      
      console.log(`Начало списка отделений найдено на строке ${startIndex + 1}`);
      
      // Определяем заголовки из предыдущей строки
      let headers = [];
      if (startIndex > 0) {
        const headerRow = rows[startIndex - 1];
        headers = Array.from(headerRow.querySelectorAll('th, td')).map(cell => cell.textContent.trim());
        console.log('Заголовки таблицы:', headers);
      }
      
      // Определяем индексы колонок (предполагаем стандартную структуру)
      let nameIndex = 0;
      let addressIndex = 1;
      let phoneIndex = 2;
      let scheduleIndex = 3;
      
      // Пытаемся определить индексы по заголовкам
      headers.forEach((header, index) => {
        const headerLower = header.toLowerCase();
        if (headerLower.includes('наименование') || headerLower.includes('название')) {
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
      
      const departments = [];
      
      // Обрабатываем строки данных начиная с найденной строки
      for (let i = startIndex; i < rows.length; i++) {
        const row = rows[i];
        const cells = Array.from(row.querySelectorAll('td'));
        
        if (cells.length === 0) continue;
        
        // Получаем данные из ячеек
        const rowData = cells.map(cell => cell.textContent.trim());
        
        // Если в строке недостаточно ячеек, пропускаем
        if (rowData.length < Math.max(nameIndex, addressIndex, phoneIndex, scheduleIndex) + 1) {
          continue;
        }
        
        const name = rowData[nameIndex] || '';
        const address = rowData[addressIndex] || '';
        const phone = rowData[phoneIndex] || '';
        const schedule = rowData[scheduleIndex] || '';
        
        // Добавляем только если есть название отделения и оно не является email
        if (name && name.length > 5 && !name.includes('@') && !name.toLowerCase().includes('mail')) {
          // Проверяем, что это действительно отделение
          if (name.toLowerCase().includes('отдел')) {
            departments.push({
              name: name,
              address: address,
              phone: phone,
              schedule: schedule
            });
          }
        }
      }
      
      return departments;
    });
    
    console.log(`Найдено отделений: ${departments.length}`);
    
    // Выводим несколько примеров для проверки
    console.log('\nПримеры отделений:');
    departments.slice(0, 10).forEach((dept, index) => {
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