/**
 * Парсер данных об отделениях ФССП Саратовской области
 * Страница: https://r64.fssp.gov.ru/contacts/rukovodstvo_to
 * 
 * @param {string} htmlContent - HTML-контент страницы
 * @returns {Array<{ name: string, address: string, phone: string }>}
 */
export function parseSaratovData(htmlContent) {
  const departments = [];

  try {
    // Ищем таблицу, содержащую ключевые заголовки (более гибкий подход)
    // Сначала ищем таблицу, которая содержит "Наименование структурного подразделения"
    let tableMatch = htmlContent.match(/<table\b[^>]*>([\s\S]*?Наименование структурного подразделения[\s\S]*?)<\/table>/i);
    
    // Если не нашли таблицу с ключевым заголовком, ищем любую таблицу с телом
    if (!tableMatch) {
      tableMatch = htmlContent.match(/<table\b[^>]*>([\s\S]*?)<\/table>/i);
    }
    
    if (!tableMatch) {
      console.warn("Не найдена подходящая таблица на странице");
      return departments;
    }

    const tableBody = tableMatch[1];

    // Извлекаем все строки <tr> из таблицы (игнорируем thead)
    const rowMatches = tableBody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);

    for (const rowMatch of rowMatches) {
      const rowHtml = rowMatch[1];

      // Извлекаем ячейки <td>
      const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
        .map(match => cleanText(match[1]));

      // Проверяем, что в строке достаточно ячеек для извлечения данных
      // Структура таблицы Саратовской области: [№, название, ?, адрес, ?, телефон, ?]
      if (cells.length >= 6) {  // Должно быть минимум 6 ячеек для извлечения названия, адреса и телефона
        const departmentName = cells[1];  // Вторая ячейка - название отделения
        const departmentAddress = cells[3]; // Четвертая ячейка - адрес
        const departmentPhone = cells[5];   // Шестая ячейка - телефон
        
        // Проверяем, является ли строка заголовочной
        if (!isHeaderRow(departmentName, departmentAddress, departmentPhone)) {
          departments.push({
            name: departmentName.trim(),
            address: departmentAddress.trim() || "Адрес не указан",
            phone: departmentPhone.trim() || "Телефон не указан"
          });
        }
      } else if (cells.length >= 3) {
        // Альтернативный вариант - если таблица имеет другую структуру (3 ячейки)
        const [name, address, phone] = cells;
        
        // Проверяем, является ли строка заголовочной
        if (!isHeaderRow(name, address, phone)) {
          departments.push({
            name: name.trim(),
            address: address.trim() || "Адрес не указан",
            phone: phone.trim() || "Телефон не указан"
          });
        }
      }
    }

    console.log(`Успешно извлечено ${departments.length} отделений из таблицы`);
  } catch (error) {
    console.error("Ошибка при парсинге Саратовской области:", error);
  }

  return departments;
}

/**
 * Очистка текста от HTML-тегов и лишних пробелов
 */
function cleanText(html) {
  if (!html) return '';
  
  // Удаляем все HTML-теги
  let text = html.replace(/<[^>]*>/g, '');
  
  // Декодируем основные HTML-сущности
  const entities = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '<': '<',
    '>': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&laquo;': '«',
    '&raquo;': '»'
  };
  
  Object.keys(entities).forEach(entity => {
    text = text.split(entity).join(entities[entity]);
  });
  
  // Убираем лишние пробелы и неразрывные пробелы
  return text
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Проверка, является ли строка заголовочной
 * @param {string} name - Значение в ячейке с названием
 * @param {string} address - Значение в ячейке с адресом
 * @param {string} phone - Значение в ячейке с телефоном
 * @returns {boolean} True, если строка является заголовочной
 */
function isHeaderRow(name, address, phone) {
  // Объединяем значения для проверки
  const rowText = (name + ' ' + address + ' ' + phone).toLowerCase();
  
  // Стоп-слова для заголовочных строк
  const headerKeywords = [
    'наименование', 'структурного', 'подразделения', 'адрес', 'почты', 'почта',
    'телефон', 'e-mail', 'email', 'сайт', 'факс', 'контактная', 'информация',
    'номер', 'п/п', '№', 'справок', 'приемной', 'руководство', 'территориальный', 
    'орган', 'должность', 'фамилия', 'имя', 'отчество'
  ];
  
  // Проверяем, содержит ли строка хотя бы одно из ключевых слов для заголовка
  for (const keyword of headerKeywords) {
    if (rowText.includes(keyword)) {
      return true;
    }
  }
  
  return false;
}

export default parseSaratovData;