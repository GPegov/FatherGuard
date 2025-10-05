import { FSSPParser } from './services/parsing/fsspParser.js';
import fs from 'fs';

async function debugKomiParsing() {
  console.log('Отладка парсинга Республики Коми...');
  
  try {
    // Создаем экземпляр парсера для Республики Коми
    const parser = new FSSPParser("Республика Коми");
    
    console.log(`Регион: ${parser.regionName}`);
    console.log(`Код региона: ${parser.regionCode}`);
    console.log(`URL для парсинга: ${parser.baseUrl}`);
    
    // Проверим, что у нас правильный URL
    if (parser.baseUrl !== 'https://r11.fssp.gov.ru/kontakty_fssp') {
      console.log('ПРЕДУПРЕЖДЕНИЕ: URL не совпадает с ожидаемым!');
      console.log(`Ожидаемый: https://r11.fssp.gov.ru/kontakty_fssp`);
      console.log(`Фактический: ${parser.baseUrl}`);
    }
    
    // Попробуем выполнить парсинг
    console.log('\nЗапуск парсинга...');
    const result = await parser.getRegionData();
    
    console.log('\nРезультаты парсинга:');
    console.log(`Тип результата: ${typeof result}`);
    
    if (result && result.cities) {
      console.log(`Найдено городов: ${result.cities.length}`);
      
      // Выведем информацию о первых нескольких городах
      result.cities.slice(0, 3).forEach((city, index) => {
        console.log(`  ${index + 1}. ${city.name} (${city.departments ? city.departments.length : 0} отделений)`);
        if (city.departments && city.departments.length > 0) {
          console.log(`     Первое отделение: ${city.departments[0].name}`);
        }
      });
    } else if (Array.isArray(result)) {
      console.log(`Получен массив с ${result.length} элементами`);
      result.slice(0, 3).forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.name || item.departmentName || 'Без названия'}`);
        console.log(`     Адрес: ${item.address || 'Нет адреса'}`);
      });
    } else {
      console.log('Неожиданный формат результата:', JSON.stringify(result, null, 2));
    }
    
  } catch (error) {
    console.error('Ошибка при отладке парсинга:', error.message);
    console.error('Стек ошибки:', error.stack);
  }
}

// Запускаем отладку
debugKomiParsing();