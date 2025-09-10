import FSSPParser from './backend/services/fsspParser.js';
import fs from 'fs';

async function testAltaiSaveProtection() {
  console.log('=== Тест защиты от перезаписи данных Республики Алтай ===');
  
  try {
    // Создаем парсер для Республики Алтай
    const parser = new FSSPParser('Республика Алтай');
    
    console.log(`\nРегион: ${parser.regionName}`);
    console.log(`Код региона: ${parser.regionCode}`);
    console.log(`Файл данных: ${parser.dataFilePath}`);
    
    // Проверяем существование файла
    if (fs.existsSync(parser.dataFilePath)) {
      console.log(`\nФайл данных существует`);
      
      // Читаем текущие данные
      const currentData = JSON.parse(fs.readFileSync(parser.dataFilePath, 'utf8'));
      console.log(`Текущая временная метка: ${currentData.timestamp}`);
      console.log(`Количество регионов: ${currentData.regions.length}`);
      
      // Пробуем сохранить данные (это должно быть заблокировано)
      console.log(`\nПопытка сохранения данных...`);
      const testData = [
        {
          region: "Тестовый регион",
          cities: [
            {
              name: "Тестовый город",
              departments: []
            }
          ]
        }
      ];
      
      await parser.saveToFile(testData);
      
      // Проверяем, что данные не изменились
      const newData = JSON.parse(fs.readFileSync(parser.dataFilePath, 'utf8'));
      console.log(`Новая временная метка: ${newData.timestamp}`);
      
      if (currentData.timestamp === newData.timestamp) {
        console.log(`✅ Данные не были перезаписаны - защита работает`);
      } else {
        console.log(`❌ Данные были перезаписаны - защита не работает`);
      }
    } else {
      console.log(`\nФайл данных не существует`);
    }
    
  } catch (error) {
    console.error('\nОшибка при тестировании:');
    console.error('Сообщение:', error.message);
  }
}

testAltaiSaveProtection();