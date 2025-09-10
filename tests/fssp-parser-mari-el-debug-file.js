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
    const result = await page.evaluate(() => {
      // Создаем массив для отладочных сообщений
      const debugMessages = [];
      
      // Ищем таблицу с контактами
      const tables = Array.from(document.querySelectorAll('table'));
      
      if (tables.length === 0) {
        debugMessages.push('Не удалось найти таблицы на странице');
        return { error: 'Не удалось найти таблицы на странице', departments: [], debug: debugMessages };
      }
      
      debugMessages.push(`Найдено таблиц: ${tables.length}`);
      
      // Работаем с первой таблицей
      const targetTable = tables[0];
      const rows = Array.from(targetTable.querySelectorAll('tr'));
      
      debugMessages.push(`Таблица содержит ${rows.length} строк`);
      
      // Выводим информацию о всех строках для отладки
      for (let i = 0; i < Math.min(15, rows.length); i++) {
        const row = rows[i];
        const cells = Array.from(row.querySelectorAll('td, th'));
        const cellTexts = cells.map((cell, index) => {
          const text = cell.textContent.trim();
          return `[${index}]: "${text}"`;
        });
        debugMessages.push(`Строка ${i}: ${cellTexts.join(', ')}`);
      }
      
      // Находим строку, содержащую подстроку "отдел"
      let startIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const cells = Array.from(row.querySelectorAll('td, th'));
        // Проверяем каждую ячейку в строке
        for (let j = 0; j < cells.length; j++) {
          const cellText = cells[j].textContent.trim().toLowerCase();
          if (cellText.includes('отдел')) {
            startIndex = i;
            debugMessages.push(`Найдена строка с "отдел" на позиции ${startIndex}: ${cells[0].textContent.trim()}`);
            break;
          }
        }
        if (startIndex !== -1) break;
      }
      
      if (startIndex === -1) {
        debugMessages.push('Не удалось найти строку с подстрокой "отдел"');
        return { error: 'Не удалось найти строку с подстрокой "отдел"', departments: [], debug: debugMessages };
      }
      
      const departments = [];
      
      // Обрабатываем строки данных начиная с найденной строки
      for (let i = startIndex; i < rows.length; i++) {
        const row = rows[i];
        const cells = Array.from(row.querySelectorAll('td'));
        
        debugMessages.push(`Обработка строки ${i}, ячеек: ${cells.length}`);
        
        if (cells.length < 4) {
          debugMessages.push(`Пропускаем строку ${i} - недостаточно ячеек`);
          continue;
        }
        
        // Используем стандартные индексы колонок
        const name = cells[0].textContent.trim();
        const address = cells[1].textContent.trim();
        const phone = cells[2].textContent.trim();
        const schedule = cells[3].textContent.trim();
        
        debugMessages.push(`Название: ${name}`);
        
        // Добавляем только если есть название отделения
        if (name && name.length > 5 && name.toLowerCase().includes('отдел')) {
          departments.push({
            name: name,
            address: address,
            phone: phone,
            schedule: schedule
          });
          debugMessages.push(`Добавлено отделение: ${name}`);
        }
      }
      
      return { departments: departments, error: null, debug: debugMessages };
    });
    
    // Записываем отладочную информацию в файл
    const debugPath = path.join('tests', 'debug-mari-el.txt');
    fs.writeFileSync(debugPath, result.debug.join('\n'));
    console.log(`Отладочная информация записана в ${debugPath}`);
    
    if (result.error) {
      console.log(`Ошибка: ${result.error}`);
      await browser.close();
      return;
    }
    
    const departments = result.departments;
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