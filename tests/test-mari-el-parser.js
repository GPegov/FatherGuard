import FSSPParser from '../backend/services/parsing/fsspParser.js';

// Создаем экземпляр парсера для Республики Марий Эл
const parser = new FSSPParser("Республика Марий Эл");

// Запускаем парсинг
parser.parseAllData()
  .then(result => {
    console.log('Результат парсинга:');
    console.log(JSON.stringify(result, null, 2));
  })
  .catch(error => {
    console.error('Ошибка при парсинге:', error);
  });