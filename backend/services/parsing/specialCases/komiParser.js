import { JSDOM } from 'jsdom';

// Специальный парсер для Республики Коми (код 11)
export function parseKomiData(htmlContent) {
  // Специальная обработка для Республики Коми (код 11)
  console.log("Применение специальной логики парсинга для Республики Коми");
  
  const departments = [];
  
  // Создаем виртуальный DOM из HTML контента
  const dom = new JSDOM(htmlContent);
  const doc = dom.window.document;
  
  // Ищем таблицы с отделениями
  const tables = doc.querySelectorAll("table");
  console.log(`Найдено таблиц: ${tables.length}`);
  
  // В Республике Коми данные находятся во второй таблице
  if (tables.length >= 2) {
    const targetTable = tables[1]; // Вторая таблица содержит отделения
    const rows = targetTable.querySelectorAll("tr");
    console.log(`Таблица содержит строк: ${rows.length}`);
    
    if (rows.length > 1) {
      // Обрабатываем строки таблицы, пропуская заголовок
      rows.forEach((row, rowIndex) => {
        const cells = row.querySelectorAll("td");
        
        // Для Республики Коми структура:
        // 0 - № п/п
        // 1 - Наименование структурного подразделения
        // 2 - Почтовый адрес
        // 3 - Адрес электронной почты
        // 4 - Телефон для получения справочной информации
        if (cells.length >= 5) {
          const departmentName = cells[1].textContent.trim();
          const address = cells[2].textContent.trim();
          const phone = cells[4].textContent.trim();
          
          // Проверяем, является ли строка заголовочной
          let isHeaderRow = false;
          if (rowIndex === 0) {
            const rowText = row.textContent.toLowerCase();
            const headerKeywords = [
              "№", "п/п", "наименование", "структурного", "подразделения",
              "почтовый", "адрес", "электронной", "почты", "телефон",
              "справочной", "информации"
            ];
            
            // Проверяем, содержит ли строка ключевые слова заголовка
            isHeaderRow = headerKeywords.some(keyword => rowText.includes(keyword));
          }
          
          // Проверяем, что строка содержит данные и не является заголовочной
          if ((departmentName || address || phone) && !isHeaderRow) {
            // Дополнительная проверка на заголовочные данные
            const isHeaderData = (
              departmentName.includes("Наименование") && departmentName.includes("структурного") ||
              address.includes("Почтовый") && address.includes("адрес") ||
              phone.includes("Телефон для получения") && phone.includes("справочной информации")
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
  }
  
  console.log(`Извлечено отделений: ${departments.length}`);
  return departments;
}