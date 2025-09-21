import puppeteer from 'puppeteer';
import fs from 'fs';

async function analyzeYakutiaPage() {
  let browser = null;
  
  try {
    console.log('Запуск браузера для анализа страницы Республики Саха (Якутия)...');
    
    // Запускаем браузер
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    
    const page = await browser.newPage();
    
    // Устанавливаем User-Agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );
    
    // Переходим на страницу контактов
    const url = "https://r14.fssp.gov.ru/contacts/2252777";
    console.log(`Переход на страницу: ${url}`);
    
    const response = await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    
    // Проверяем статус ответа
    console.log(`Статус ответа: ${response.status()}`);
    
    // Ждем загрузки контента
    await new Promise((resolve) => setTimeout(resolve, 5000));
    
    // Получаем HTML содержимое страницы
    const htmlContent = await page.content();
    
    // Сохраняем HTML для анализа
    fs.writeFileSync('yakutia_page.html', htmlContent, 'utf8');
    console.log('HTML страницы сохранен в файл yakutia_page.html');
    
    // Извлекаем текстовое содержимое для анализа
    const textContent = await page.evaluate(() => document.body.innerText);
    fs.writeFileSync('yakutia_text.txt', textContent, 'utf8');
    console.log('Текст страницы сохранен в файл yakutia_text.txt');
    
    // Проверяем URL страницы
    const currentPageUrl = page.url();
    console.log(`Текущий URL страницы: ${currentPageUrl}`);
    
    // Ищем таблицы на странице
    const tables = await page.evaluate(() => {
      const tableElements = document.querySelectorAll('table');
      console.log(`Найдено таблиц: ${tableElements.length}`);
      
      const tablesInfo = [];
      tableElements.forEach((table, index) => {
        const rows = table.querySelectorAll('tr');
        console.log(`Таблица ${index + 1}: строк ${rows.length}`);
        
        // Получаем текст первых нескольких строк для анализа структуры
        const firstRows = [];
        for (let i = 0; i < Math.min(5, rows.length); i++) {
          firstRows.push(rows[i].innerText);
        }
        
        tablesInfo.push({
          index: index + 1,
          rowsCount: rows.length,
          firstRows: firstRows
        });
      });
      
      return tablesInfo;
    });
    
    console.log('Информация о таблицах:');
    console.log(JSON.stringify(tables, null, 2));
    
  } catch (error) {
    console.error('Ошибка при анализе страницы:', error.message);
    console.error('Стек ошибки:', error.stack);
  } finally {
    // Закрываем браузер
    if (browser) {
      await browser.close();
    }
  }
}

analyzeYakutiaPage();