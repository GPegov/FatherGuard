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
    
    // Получаем данные из страницы
    const departments = await page.evaluate(() => {
      // Ищем все элементы с контактной информацией
      const contactElements = Array.from(document.querySelectorAll('div, p, span'));
      
      const departments = [];
      
      // Ищем элементы, содержащие информацию об отделениях
      contactElements.forEach(element => {
        const text = element.textContent.trim();
        
        // Проверяем, содержит ли элемент информацию об отделении
        if (text.toLowerCase().includes('отдел') && text.length > 10) {
          // Пытаемся извлечь информацию
          const lines = text.split('\n').map(line => line.trim()).filter(line => line);
          
          // Если у нас есть несколько строк, пытаемся определить структуру
          if (lines.length >= 2) {
            const name = lines[0];
            
            // Проверяем, что это действительно отделение
            if (name.toLowerCase().includes('отдел')) {
              // Ищем адрес, телефон и режим работы в остальных строках
              let address = '';
              let phone = '';
              let schedule = '';
              
              for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                // Если строка содержит телефон
                if (line.includes('(') && line.includes(')') && line.includes('-')) {
                  phone = line;
                }
                // Если строка содержит адресные данные
                else if (line.includes('г.') || line.includes('ул.') || line.includes('д.') || line.includes('республика')) {
                  address = line;
                }
                // Если строка содержит режим работы
                else if (line.includes('Пн') || line.includes('Вт') || line.includes('Ср') || line.includes('Чт') || 
                         line.includes('Пт') || line.includes('Сб') || line.includes('Вс') || line.includes('выход')) {
                  schedule = line;
                }
              }
              
              departments.push({
                name: name,
                address: address,
                phone: phone,
                schedule: schedule
              });
            }
          }
        }
      });
      
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