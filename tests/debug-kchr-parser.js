import puppeteer from "puppeteer";
import fsspRegions from "../backend/services/fsspRegions.js";

async function debugKchrParser() {
  const regionName = "Карачаево-Черкесская Республика";
  const regionCode = fsspRegions[regionName] || 9;
  const baseUrl = `https://r${regionCode.toString().padStart(2, '0')}.fssp.gov.ru/contacts`;
  
  let browser = null;

  try {
    console.log(`Запуск браузера для получения данных по региону: ${regionName} (${regionCode})`);
    console.log(`URL для парсинга: ${baseUrl}`);

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
    console.log(`Переход на страницу контактов: ${baseUrl}`);
    const response = await page.goto(baseUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Проверяем статус ответа
    console.log(`Статус ответа: ${response.status()}`);

    // Ждем загрузки контента
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Проверяем URL страницы
    const currentPageUrl = page.url();
    console.log(`Текущий URL страницы: ${currentPageUrl}`);

    // Получаем весь HTML контент страницы
    const htmlContent = await page.content();
    console.log("Длина HTML контента:", htmlContent.length);
    
    // Извлекаем данные с помощью JavaScript в контексте страницы
    const debugData = await page.evaluate(() => {
      console.log("Начало анализа страницы");
      
      // Ищем все таблицы
      const tables = document.querySelectorAll("table");
      console.log("Найдено таблиц:", tables.length);
      
      const tableInfo = [];
      
      tables.forEach((table, tableIndex) => {
        const rows = table.querySelectorAll("tr");
        console.log(`Таблица ${tableIndex + 1}: строк ${rows.length}`);
        
        const tableData = {
          index: tableIndex,
          rowCount: rows.length,
          rows: []
        };
        
        // Анализируем первые 5 строк таблицы
        const rowsToCheck = Math.min(5, rows.length);
        for (let i = 0; i < rowsToCheck; i++) {
          const row = rows[i];
          const cells = row.querySelectorAll("td, th");
          const cellData = [];
          
          cells.forEach((cell, cellIndex) => {
            cellData.push({
              index: cellIndex,
              tagName: cell.tagName,
              text: cell.textContent.trim(),
              html: cell.innerHTML.trim().substring(0, 100) // Ограничиваем длину
            });
          });
          
          tableData.rows.push({
            index: i,
            cellCount: cells.length,
            cells: cellData
          });
        }
        
        tableInfo.push(tableData);
      });
      
      // Ищем другие возможные элементы с контактной информацией
      const lists = document.querySelectorAll("ul, ol");
      console.log("Найдено списков:", lists.length);
      
      const listInfo = [];
      lists.forEach((list, listIndex) => {
        const items = list.querySelectorAll("li");
        console.log(`Список ${listIndex + 1}: элементов ${items.length}`);
        
        const listItems = [];
        const itemsToCheck = Math.min(5, items.length);
        for (let i = 0; i < itemsToCheck; i++) {
          listItems.push({
            index: i,
            text: items[i].textContent.trim().substring(0, 100)
          });
        }
        
        listInfo.push({
          index: listIndex,
          itemCount: items.length,
          items: listItems
        });
      });
      
      // Ищем div с классами, которые могут содержать контактную информацию
      const divs = document.querySelectorAll("div");
      console.log("Найдено div элементов:", divs.length);
      
      // Ищем потенциально релевантные div по классам или содержимому
      const contactDivs = [];
      divs.forEach((div, divIndex) => {
        const className = div.className || "";
        const text = div.textContent.trim();
        
        // Проверяем, содержит ли div контактную информацию
        if (className.toLowerCase().includes("contact") || 
            className.toLowerCase().includes("kontakt") ||
            text.toLowerCase().includes("отделение") ||
            text.toLowerCase().includes("фссп") ||
            text.toLowerCase().includes("адрес") ||
            text.toLowerCase().includes("телефон")) {
          contactDivs.push({
            index: divIndex,
            className: className,
            text: text.substring(0, 200) // Ограничиваем длину
          });
        }
      });
      
      console.log("Найдено потенциально релевантных div:", contactDivs.length);
      
      return {
        tableInfo,
        listInfo,
        contactDivs
      };
    });

    console.log("Результаты анализа:");
    console.log(JSON.stringify(debugData, null, 2));
    
  } catch (error) {
    console.error(`Ошибка при получении данных по региону ${regionName}:`, error.message);
    console.error("Стек ошибки:", error.stack);
  } finally {
    // Закрываем браузер
    if (browser) {
      await browser.close();
    }
  }
}

// Запускаем функцию
debugKchrParser().catch(console.error);