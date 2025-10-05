import { FSSPParser } from './services/parsing/fsspParser.js';
import fs from 'fs';
import path from 'path';

async function testFullKomiParsing() {
  console.log('Полный тест парсинга Республики Коми');
  
  try {
    // Создаем экземпляр парсера для Республики Коми
    const parser = new FSSPParser("Республика Коми");
    
    console.log(`Регион: ${parser.regionName}`);
    console.log(`Код региона: ${parser.regionCode}`);
    console.log(`Имя файла: ${parser.fileName}`);
    console.log(`Путь к файлу: ${parser.dataFilePath}`);
    
    // Проверим существование директории для данных
    const dbDir = path.dirname(parser.dataFilePath);
    if (!fs.existsSync(dbDir)) {
      console.log('Создание директории для данных...');
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    // Запускаем полный парсинг
    console.log('\nЗапуск полного парсинга...');
    const result = await parser.parseAllData();
    
    console.log('\nРезультаты парсинга:');
    console.log(`Успешно: ${result.success}`);
    console.log(`Сообщение: ${result.message}`);
    
    if (result.statistics) {
      console.log('\nСтатистика:');
      console.log(`Регионов: ${result.statistics.regions}`);
      console.log(`Городов: ${result.statistics.cities}`);
      console.log(`Отделений: ${result.statistics.departments}`);
    }
    
    // Проверяем сохраненные данные
    console.log('\nПроверка сохраненных данных...');
    if (fs.existsSync(parser.dataFilePath)) {
      console.log('Файл данных существует');
      
      const savedData = JSON.parse(fs.readFileSync(parser.dataFilePath, 'utf8'));
      console.log(`Временная метка: ${savedData.timestamp}`);
      
      if (savedData.regions && savedData.regions.length > 0) {
        console.log(`Всего регионов в данных: ${savedData.regions.length}`);
        
        // Выводим информацию о первом регионе
        const firstRegion = savedData.regions[0];
        console.log(`\nРегион: ${firstRegion.region}`);
        console.log(`Городов: ${firstRegion.cities.length}`);
        
        // Выводим первые несколько городов
        firstRegion.cities.slice(0, 5).forEach((city, index) => {
          console.log(`  ${index + 1}. ${city.name} (${city.departments.length} отделений)`);
        });
      }
    } else {
      console.log('Файл данных НЕ существует');
    }
    
    console.log('\nТест завершен успешно!');
    
  } catch (error) {
    console.error('Ошибка при полном тестировании парсинга:', error.message);
    console.error('Стек ошибки:', error.stack);
  }
}

// Запускаем тест
testFullKomiParsing();