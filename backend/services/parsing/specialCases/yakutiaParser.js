// Специальный парсер для Республики Саха (Якутия) (код 14)
// Сайт: https://r14.fssp.gov.ru/contacts/2252777

/**
 * Парсинг данных для Республики Саха (Якутия)
 * @param {string} htmlContent - HTML содержимое страницы
 * @returns {Array} Массив с данными об отделениях
 */
export function parseYakutiaData(htmlContent) {
  console.log("Применение специального парсера для Республики Саха (Якутия) (код 14)");
  
  const departments = [];
  
  try {
    // Используем регулярные выражения для извлечения данных таблицы
    // Находим таблицу с отделениями
    const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
    const tableMatches = htmlContent.match(tableRegex);
    
    if (!tableMatches || tableMatches.length === 0) {
      console.warn("Таблица с отделениями не найдена на странице Республики Саха (Якутия)");
      return departments;
    }
    
    // Берем первую таблицу (предполагаем, что она одна)
    const tableContent = tableMatches[0];
    
    // Извлекаем строки таблицы, пропуская заголовок
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const rowMatches = tableContent.match(rowRegex);
    
    if (!rowMatches || rowMatches.length <= 1) {
      console.warn("Строки в таблице не найдены на странице Республики Саха (Якутия)");
      return departments;
    }
    
    console.log(`Найдено ${rowMatches.length} строк в таблице Республики Саха (Якутия)`);
    
    // Обрабатываем строки, начиная со второй (пропускаем заголовок)
    for (let i = 1; i < rowMatches.length; i++) {
      const rowContent = rowMatches[i];
      
      // Извлекаем ячейки
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cellMatches = rowContent.match(cellRegex);
      
      // В таблице Якутии структура ячеек:
      // 0 - номер
      // 1 - наименование структурного отделения
      // 2 - почтовый адрес
      // 3 - адрес электронной почты
      // 4 - телефон
      if (cellMatches && cellMatches.length >= 5) {
        // Извлекаем текст из ячеек, удаляя HTML теги
        const departmentName = cleanText(cellMatches[1]);
        const address = cleanText(cellMatches[2]);
        const phone = cleanText(cellMatches[4]);
        
        // Проверяем, что строка содержит данные и не является заголовочной
        if ((departmentName || address || phone) && 
            !isHeaderRow(rowContent, departmentName, address, phone)) {
          
          // Формируем название отделения
          const name = departmentName || "Отделение ФССП";
          
          // Добавляем в массив
          departments.push({
            name: name,
            address: address || "Адрес не указан",
            phone: phone || "Телефон не указан"
          });
        }
      }
    }
    
    console.log(`Извлечено ${departments.length} отделений для Республики Саха (Якутия)`);
  } catch (error) {
    console.error("Ошибка при парсинге данных Республики Саха (Якутия):", error.message);
    console.error("Стек ошибки:", error.stack);
  }
  
  return departments;
}

/**
 * Очистка текста от HTML тегов
 * @param {string} text - Текст с HTML тегами
 * @returns {string} Очищенный текст
 */
function cleanText(text) {
  if (!text) return "";
  
  // Удаляем HTML теги
  let clean = text.replace(/<[^>]*>/g, '');
  
  // Заменяем HTML entities
  clean = clean.replace(/&nbsp;/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/&laquo;/g, '«')
              .replace(/&raquo;/g, '»');
  
  // Удаляем лишние пробелы и специальные символы
  clean = clean.replace(/\s+/g, ' ').trim();
  clean = clean.replace(/\u00A0/g, ' '); // Неразрывный пробел
  
  return clean;
}

/**
 * Проверка, является ли строка заголовочной
 * @param {string} rowContent - Содержимое строки таблицы
 * @param {string} name - Название отделения
 * @param {string} address - Адрес
 * @param {string} phone - Телефон
 * @returns {boolean} True, если строка является заголовочной
 */
function isHeaderRow(rowContent, name, address, phone) {
  // Проверяем по содержимому ячеек
  const rowText = rowContent.toLowerCase();
  
  // Стоп-слова для заголовочных строк
  const stopWords = [
    "наименование", "структурного", "подразделения", "адрес", "почты", "почта",
    "телефон", "e-mail", "email", "сайт", "факс", "контактная", "информация",
    "номер", "п/п", "№", "справок", "приемной", "примечания"
  ];
  
  // Проверяем, содержит ли строка стоп-слова
  for (const word of stopWords) {
    if (rowText.includes(word)) {
      return true;
    }
  }
  
  // Проверяем типовые заголовочные данные
  const isHeaderData = (
    name.includes("Наименование структурного подразделения") ||
    address.includes("Почтовый адрес") ||
    phone.includes("Телефон для получения справочной информации") ||
    (name.toLowerCase().includes("подразделение") &&
     address.toLowerCase().includes("адрес") &&
     phone.toLowerCase().includes("телефон"))
  );
  
  return isHeaderData;
}

export default parseYakutiaData;