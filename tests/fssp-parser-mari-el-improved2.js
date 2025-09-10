import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function parseFSSPMariEl() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Переходим на страницу контактов ФССП для Республики Марий Эл
    await page.goto('https://r12.fssp.gov.ru/contacts', { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Ждем загрузки контента
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Получаем данные из страницы
    const departments = await page.evaluate(() => {
      // Ищем все элементы с контактной информацией
      const contactElements = Array.from(document.querySelectorAll('*'));
      
      const departments = [];
      
      // Ищем элементы, содержащие информацию об отделениях ФССП
      contactElements.forEach(element => {
        const text = element.textContent.trim();
        
        // Проверяем, содержит ли элемент информацию об отделении ФССП
        if (text.toLowerCase().includes('отдел') && 
            (text.toLowerCase().includes('фссп') || text.toLowerCase().includes('судебн') || text.toLowerCase().includes('пристав')) &&
            text.length > 20) {
          
          // Пытаемся извлечь информацию
          const lines = text.split('\n').map(line => line.trim()).filter(line => line);
          
          // Проверяем, что это действительно отделение, а не банковские реквизиты
          if (!text.includes('банковских реквизитах') && !text.includes('с 01 сентября 2025')) {
            // Ищем название отделения
            let name = '';
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].toLowerCase().includes('отдел') && 
                  (lines[i].toLowerCase().includes('фссп') || lines[i].toLowerCase().includes('судебн') || lines[i].toLowerCase().includes('пристав'))) {
                name = lines[i];
                break;
              }
            }
            
            // Если не нашли по ключевым словам, берем первую строку, содержащую "отдел"
            if (!name) {
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].toLowerCase().includes('отдел')) {
                  name = lines[i];
                  break;
                }
              }
            }
            
            if (name) {
              // Ищем адрес, телефон и режим работы в остальных строках
              let address = '';
              let phone = '';
              let schedule = '';
              
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                // Пропускаем строку с названием
                if (line === name) continue;
                
                // Если строка содержит телефон
                if ((line.includes('(') && line.includes(')') && line.includes('-')) || 
                    (line.toLowerCase().includes('tel') && line.includes(':'))) {
                  phone = line.replace(/Тел\\.?/gi, '').replace(/Телефон:?/gi, '').trim();
                }
                // Если строка содержит адресные данные
                else if ((line.includes('г.') || line.includes('ул.') || line.includes('д.') || line.includes('республика') || 
                         line.includes('обл.') || line.includes('район')) && 
                         line.length > 10 && !line.toLowerCase().includes('электрон')) {
                  address = line;
                }
                // Если строка содержит режим работы
                else if ((line.includes('Пн') || line.includes('Вт') || line.includes('Ср') || line.includes('Чт') || 
                         line.includes('Пт') || line.includes('Сб') || line.includes('Вс') || line.includes('выход') ||
                         line.includes('понедельник') || line.includes('вторник') || line.includes('среда') ||
                         line.includes('четверг') || line.includes('пятница') || line.includes('суббота') || line.includes('воскресенье')) && 
                         line.length > 10) {
                  schedule = line;
                }
              }
              
              // Проверяем, что у нас есть хотя бы название
              if (name && name.length > 10) {
                departments.push({
                  name: name,
                  address: address,
                  phone: phone,
                  schedule: schedule
                });
              }
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