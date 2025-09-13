import { JSDOM } from 'jsdom';

// Специальный парсер для Республики Калмыкия (код 08)
export function parseKalmykiaData(htmlContent) {
  // Специальная обработка для Республики Калмыкия (код 08)
  console.log("Применение специальной логики парсинга для Республики Калмыкия");
  
  const departments = [];
  
  // Создаем виртуальный DOM из HTML контента
  const dom = new JSDOM(htmlContent);
  const doc = dom.window.document;
  
  // Ищем нумерованные списки с отделениями
  const lists = doc.querySelectorAll("ol");
  console.log("Найдено списков:", lists.length);
  
  lists.forEach((list, listIndex) => {
    const items = list.querySelectorAll("li");
    console.log(`Список ${listIndex + 1}: элементов ${items.length}`);
    
    items.forEach((item, itemIndex) => {
      const text = item.textContent.trim();
      console.log(`Элемент ${itemIndex + 1}: ${text}`);
      
      // Разделяем данные по символу "•"
      const parts = text.split("•").map(part => part.trim());
      
      if (parts.length >= 3) {
        // Обычно структура: [название, адрес, телефон, факс (опционально)]
        const departmentName = parts[0] || "Отделение ФССП";
        const address = parts[1] || "Адрес не указан";
        const phone = parts[2] || "Телефон не указан";
        
        departments.push({
          name: departmentName,
          address: address,
          phone: phone,
        });
      }
    });
  });
  
  return departments;
}