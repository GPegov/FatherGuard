import FSSPParser from './backend/services/parsing/fsspParser.js';

async function verifyFix() {
  console.log('=== Проверка исправления URL для Республики Башкортостан ===');
  
  try {
    // Создаем парсер для Башкортостана
    const parser = new FSSPParser('Республика Башкортостан');
    
    console.log('\n1. Базовая информация:');
    console.log(`   Название региона: ${parser.regionName}`);
    console.log(`   Код региона: ${parser.regionCode}`);
    console.log(`   Базовый URL (после исправления): ${parser.baseUrl}`);
    
    // Проверяем, что URL теперь правильный
    if (parser.baseUrl === 'https://r02.fssp.gov.ru/contacts') {
      console.log(`   ✅ URL корректен`);
    } else {
      console.log(`   ❌ URL некорректен, ожидается 'https://r02.fssp.gov.ru/contacts'`);
    }
    
  } catch (error) {
    console.error('\nОшибка при выполнении проверки:');
    console.error('Сообщение:', error.message);
  }
}

verifyFix();