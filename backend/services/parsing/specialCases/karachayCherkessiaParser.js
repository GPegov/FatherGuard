import { JSDOM } from 'jsdom';

// Специальный парсер для Карачаево-Черкесской Республики (код 09)
export function parseKarachayCherkessiaData(htmlContent) {
  // Специальная обработка для Карачаево-Черкесской Республики (код 09)
  console.log("Применение специальной логики парсинга для Карачаево-Черкесской Республики");
  
  const departments = [];
  
  // Создаем виртуальный DOM из HTML контента
  const dom = new JSDOM(htmlContent);
  const doc = dom.window.document;
  
  // Ищем таблицы с отделениями
  const tables = doc.querySelectorAll("table");
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
        }
      });
    }
  });

  return departments;
}