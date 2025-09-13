// Специальный парсер для Республики Мордовия (код 13)
// Сайт: https://r13.fssp.gov.ru/contacts/telefony_dlja_spravok

/**
 * Парсинг данных для Республики Мордовия
 * @param {string} htmlContent - HTML содержимое страницы
 * @returns {Array} Массив с данными об отделениях
 */
export function parseMordoviaData(htmlContent) {
  console.log("Применение специального парсера для Республики Мордовия (код 13)");
  
  const departments = [];
  
  try {
    // Используем регулярные выражения для извлечения данных таблицы
    // Находим таблицу с отделениями
    const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
    const tableMatches = htmlContent.match(tableRegex);
    
    if (!tableMatches || tableMatches.length === 0) {
      console.warn("Таблица с отделениями не найдена на странице Республики Мордовия");
      return departments;
    }
    
    // Берем первую таблицу
    const tableContent = tableMatches[0];
    
    // Извлекаем строки таблицы
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const rowMatches = tableContent.match(rowRegex);
    
    if (!rowMatches || rowMatches.length === 0) {
      console.warn("Строки в таблице не найдены на странице Республики Мордовия");
      return departments;
    }
    
    console.log(`Найдено ${rowMatches.length} строк в таблице Республики Мордовия`);
    
    // Обрабатываем строки, начиная со второй (пропускаем заголовок)
    for (let i = 1; i < rowMatches.length; i++) {
      const rowContent = rowMatches[i];
      
      // Извлекаем ячейки
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cellMatches = rowContent.match(cellRegex);
      
      // В таблице Мордовии структура ячеек может отличаться
      // Обычно: 0 - номер, 1 - наименование, 2 - адрес, 3 - телефон
      if (cellMatches && cellMatches.length >= 4) {
        // Извлекаем текст из ячеек, удаляя HTML теги
        const departmentName = cleanText(cellMatches[1]);
        const address = cleanText(cellMatches[2]);
        const phone = cleanText(cellMatches[3]);
        
        // Проверяем, что строка содержит данные
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
    
    console.log(`Извлечено ${departments.length} отделений для Республики Мордовия`);
  } catch (error) {
    console.error("Ошибка при парсинге данных Республики Мордовия:", error.message);
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
  
  // Удаляем лишние пробелы
  clean = clean.replace(/\s+/g, ' ').trim();
  
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
    "номер", "п/п", "№", "справок", "приемной"
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

export default parseMordoviaData;