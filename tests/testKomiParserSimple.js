import { FSSPParser } from './services/parsing/fsspParser.js';

async function testKomiParser() {
  console.log('Тест парсера Республики Коми');
  
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
    
    // Попробуем выполнить парсинг (только для тестирования, ограничим время)
    console.log('\nЗапуск парсинга (таймаут 10 секунд)...');
    
    // Создаем promise с таймаутом
    const parsePromise = parser.getRegionData();
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve({ timeout: true }), 10000);
    });
    
    // Ждем первый завершенный promise
    const result = await Promise.race([parsePromise, timeoutPromise]);
    
    if (result && result.timeout) {
      console.log('Таймаут: парсинг занимает слишком много времени');
    } else {
      console.log('\nРезультаты парсинга:');
      console.log(`Тип результата: ${typeof result}`);
      
      if (result && result.region) {
        console.log(`Регион: ${result.region}`);
        if (result.cities) {
          console.log(`Найдено городов: ${result.cities.length}`);
          
          // Выведем информацию о первых нескольких городах
          result.cities.slice(0, 3).forEach((city, index) => {
            console.log(`  ${index + 1}. ${city.name} (${city.departments ? city.departments.length : 0} отделений)`);
          });
        }
      } else {
        console.log('Неожиданный формат результата:', JSON.stringify(result, null, 2));
      }
    }
    
  } catch (error) {
    console.error('Ошибка при тестировании парсера:', error.message);
    console.error('Стек ошибки:', error.stack);
  }
}

// Запускаем тест
testKomiParser();