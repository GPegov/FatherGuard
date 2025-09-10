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
      // Ищем все таблицы на странице
      const tables = document.querySelectorAll('table');
      console.log(`Найдено таблиц: ${tables.length}`);
      
      const allDepartments = [];
      
      tables.forEach((table, tableIndex) => {
        console.log(`Обрабатываем таблицу ${tableIndex + 1}`);
        
        // Ищем строки в tbody
        const rows = table.querySelectorAll('tbody tr');
        console.log(`Найдено строк в таблице ${tableIndex + 1}: ${rows.length}`);
        
        // Проверяем структуру заголовков
        const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
        let headers = [];
        if (headerRow) {
          headers = Array.from(headerRow.querySelectorAll('th, td')).map(h => h.textContent.trim());
          console.log(`Заголовки: ${JSON.stringify(headers)}`);
        }
        
        // Определяем индексы колонок
        let nameColIndex = -1;
        let addressColIndex = -1;
        let phoneColIndex = -1;
        let scheduleColIndex = -1;
        
        headers.forEach((header, index) => {
          if (header.includes('Наименование') || header.includes('Отделение') || header.includes('Название')) {
            nameColIndex = index;
          } else if (header.includes('Адрес')) {
            addressColIndex = index;
          } else if (header.includes('Телефон')) {
            phoneColIndex = index;
          } else if (header.includes('Режим') || header.includes('График') || header.includes('Время')) {
            scheduleColIndex = index;
          }
        });
        
        // Если не нашли заголовки, используем стандартные индексы
        if (nameColIndex === -1) nameColIndex = 1;
        if (addressColIndex === -1) addressColIndex = 2;
        if (phoneColIndex === -1) phoneColIndex = 3;
        if (scheduleColIndex === -1) scheduleColIndex = 4;
        
        console.log(`Индексы колонок: название=${nameColIndex}, адрес=${addressColIndex}, телефон=${phoneColIndex}, график=${scheduleColIndex}`);
        
        rows.forEach((row, rowIndex) => {
          const cells = row.querySelectorAll('td');
          console.log(`Строка ${rowIndex + 1}: найдено ячеек ${cells.length}`);
          
          if (cells.length >= Math.max(nameColIndex, addressColIndex, phoneColIndex, scheduleColIndex) + 1) {
            const department = {
              name: cells[nameColIndex]?.textContent?.trim() || '',
              address: cells[addressColIndex]?.textContent?.trim() || '',
              phone: cells[phoneColIndex]?.textContent?.trim() || '',
              schedule: cells[scheduleColIndex]?.textContent?.trim() || ''
            };
            
            // Добавляем только если есть название отделения
            if (department.name && department.name.length > 5) {
              console.log(`Добавлено отделение: ${department.name}`);
              allDepartments.push(department);
            }
          }
        });
      });
      
      return allDepartments;
    });
    
    console.log(`Всего найдено отделений: ${departments.length}`);
    
    // Если не нашли через таблицы, попробуем найти все элементы с контактной информацией
    if (departments.length === 0) {
      console.log('Не найдены отделения через таблицы, пробуем альтернативный метод');
      
      const altDepartments = await page.evaluate(() => {
        // Ищем все блоки с контактной информацией
        const contactBlocks = document.querySelectorAll('div, p, span');
        const departments = [];
        
        contactBlocks.forEach(block => {
          const text = block.textContent.trim();
          // Проверяем, содержит ли блок информацию об отделении
          if (text.includes('Отдел') && text.includes('г.') && text.includes('ул.')) {
            // Пытаемся извлечь информацию
            const lines = text.split('\n').map(line => line.trim()).filter(line => line);
            
            if (lines.length >= 3) {
              departments.push({
                name: lines[0] || '',
                address: lines.find(line => line.includes('г.') && line.includes('ул.')) || '',
                phone: lines.find(line => line.includes('(') && line.includes(')')) || '',
                schedule: lines.find(line => line.includes('Пн') || line.includes('Понедельник') || line.includes('Вт') || line.includes('Вторник')) || ''
              });
            }
          }
        });
        
        return departments;
      });
      
      console.log(`Найдено отделений альтернативным методом: ${altDepartments.length}`);
      departments.push(...altDepartments);
    }
    
    // Сохраняем данные в файл
    const outputPath = path.join('backend', 'dataBase', 'fsspDepartmentsDB', '12_Respublika_Mariy_El.json');
    const data = {
      region: "Республика Марий Эл",
      code: "12",
      departments: departments,
      lastUpdated: new Date().toISOString()
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`Данные успешно сохранены в ${outputPath}`);
    console.log(`Найдено отделений: ${departments.length}`);
    
    // Выводим пример данных для проверки
    if (departments.length > 0) {
      console.log('\nПример данных:');
      console.log(JSON.stringify(departments.slice(0, 3), null, 2));
    }
    
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