import puppeteer from 'puppeteer';
import fs from 'fs';

async function checkKomiPage() {
  let browser = null;
  try {
    console.log('Запуск браузера для проверки страницы Республики Коми');
    
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
    
    // Переходим на страницу контактов Республики Коми
    const url = "https://r11.fssp.gov.ru/kontakty_fssp";
    console.log(`Переход на страницу: ${url}`);
    
    const response = await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    
    // Проверяем статус ответа
    console.log(`Статус ответа: ${response.status()}`);
    
    // Ждем загрузки контента
    await new Promise((resolve) => setTimeout(resolve, 3000));
    
    // Получаем HTML контент страницы
    const htmlContent = await page.content();
    
    // Сохраняем контент в файл для анализа
    fs.writeFileSync('komi-page-content.html', htmlContent, 'utf8');
    console.log('Контент страницы сохранен в komi-page-content.html');
    
    // Извлекаем данные с помощью JavaScript в контексте страницы
    const pageData = await page.evaluate(() => {
      // Собираем информацию о структуре страницы
      const structure = {
        tables: [],
        lists: [],
        divs: [],
        otherElements: []
      };
      
      // Проверяем таблицы
      const tables = document.querySelectorAll("table");
      structure.tablesCount = tables.length;
      
      tables.forEach((table, index) => {
        const rows = table.querySelectorAll("tr");
        const tableInfo = {
          index: index,
          rowsCount: rows.length,
          headers: []
        };
        
        // Проверяем заголовки таблицы
        const headers = table.querySelectorAll("th");
        headers.forEach(header => {
          tableInfo.headers.push(header.textContent.trim());
        });
        
        // Проверяем первые несколько строк таблицы
        const firstRows = [];
        const rowsArray = Array.from(rows).slice(0, 3);
        rowsArray.forEach((row, rowIndex) => {
          const cells = row.querySelectorAll("td, th");
          const cellData = Array.from(cells).map(cell => cell.textContent.trim());
          firstRows.push({
            rowIndex: rowIndex,
            cells: cellData
          });
        });
        
        tableInfo.firstRows = firstRows;
        structure.tables.push(tableInfo);
      });
      
      // Проверяем списки
      const lists = document.querySelectorAll("ul, ol");
      structure.listsCount = lists.length;
      
      lists.forEach((list, index) => {
        const items = list.querySelectorAll("li");
        structure.lists.push({
          index: index,
          type: list.tagName.toLowerCase(),
          itemsCount: items.length,
          firstItems: Array.from(items).slice(0, 3).map(item => item.textContent.trim())
        });
      });
      
      // Проверяем div-элементы с потенциальными данными
      const divs = document.querySelectorAll("div");
      const dataDivs = Array.from(divs).filter(div => {
        const text = div.textContent.trim();
        return text.length > 50 && (text.includes("Отдел") || text.includes("ФССП") || text.includes("адрес") || text.includes("телефон"));
      });
      
      structure.dataDivsCount = dataDivs.length;
      structure.dataDivs = dataDivs.slice(0, 5).map(div => ({
        text: div.textContent.trim().substring(0, 200) + (div.textContent.trim().length > 200 ? "..." : "")
      }));
      
      return structure;
    });
    
    // Сохраняем структуру в JSON файл
    fs.writeFileSync('komi-page-structure.json', JSON.stringify(pageData, null, 2), 'utf8');
    console.log('Структура страницы сохранена в komi-page-structure.json');
    console.log('Основная информация о структуре:');
    console.log(`Таблиц: ${pageData.tablesCount}`);
    console.log(`Списков: ${pageData.listsCount}`);
    console.log(`DIV-элементов с данными: ${pageData.dataDivsCount}`);
    
    return pageData;
  } catch (error) {
    console.error("Ошибка при проверке страницы:", error.message);
    console.error("Стек ошибки:", error.stack);
  } finally {
    // Закрываем браузер
    if (browser) {
      await browser.close();
    }
  }
}

// Запускаем проверку
checkKomiPage();