import puppeteer from "puppeteer";
import fsspRegions from "../backend/services/fsspRegions.js";

async function testKchrParser() {
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

    // Извлекаем данные с помощью JavaScript в контексте страницы
    const rawData = await page.evaluate((regionCode) => {
      const departments = [];

      // Специальная обработка для Карачаево-Черкесской Республики (код 09)
      if (regionCode === 9) {
        console.log("Применение специальной логики парсинга для Карачаево-Черкесской Республики");
        
        // Ищем таблицы с отделениями
        const tables = document.querySelectorAll("table");
        console.log("Найдено таблиц:", tables.length);

        tables.forEach((table, tableIndex) => {
          const rows = table.querySelectorAll("tr");
          console.log(`Таблица ${tableIndex + 1}: строк ${rows.length}`);

          if (rows.length > 1) {
            // Обрабатываем строки таблицы
            rows.forEach((row, rowIndex) => {
              const cells = row.querySelectorAll("td, th");
              
              // Для Карачаево-Черкесской Республики структура:
              // 0 - наименование подразделения
              // 1 - адрес
              // 2 - email
              // 3 - телефон
              if (cells.length >= 4) {
                const departmentName = cells[0].textContent.trim();
                const address = cells[1].textContent.trim();
                const phone = cells[3].textContent.trim();

                // Проверяем, является ли строка заголовочной
                let isHeaderRow = false;
                if (rowIndex === 0) {
                  const rowText = row.textContent.toLowerCase();
                  const headerKeywords = [
                    "наименование", "подразделения", "адрес", "электронной", "почты", 
                    "номер", "телефона", "email", "e-mail"
                  ];
                  
                  // Проверяем, содержит ли строка ключевые слова заголовка
                  isHeaderRow = headerKeywords.some(keyword => rowText.includes(keyword));
                }

                // Проверяем, что строка содержит данные и не является заголовочной
                if ((departmentName || address || phone) && !isHeaderRow) {
                  // Дополнительная проверка на заголовочные данные
                  const isHeaderData = (
                    departmentName.includes("Наименование подразделения") ||
                    address.includes("Адрес") && address.includes("электронной") ||
                    phone.includes("Номер телефона")
                  );

                  // Добавляем только если это не заголовочные данные
                  if (!isHeaderData) {
                    departments.push({
                      name: departmentName || "Отделение ФССП",
                      address: address || "Адрес не указан",
                      phone: phone || "Телефон не указан",
                    });
                  }
                }
                
                // Для отладки выводим содержимое каждой строки
                console.log(`Строка ${rowIndex}: ${departmentName} | ${address} | ${phone}`);
              }
            });
          }
        });

        return departments;
      }
      
      // Если это не КЧР, возвращаем пустой массив
      return departments;
    }, regionCode); // Передаем код региона в функцию

    console.log(`Получено ${rawData.length} отделений`);
    console.log("Данные об отделениях:");
    console.log(JSON.stringify(rawData, null, 2));

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
testKchrParser().catch(console.error);