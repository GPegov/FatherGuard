import fs from 'fs';
import path from 'path';

// Путь к файлу с известными городами для Якутии
const knownCitiesPath = path.join(process.cwd(), 'backend', 'dataBase', 'knownCities', '14.json');

// Функция для сортировки массива строк по убыванию длины
function sortByLengthDesc(arr) {
  return arr.sort((a, b) => b.length - a.length);
}

// Читаем содержимое файла
fs.readFile(knownCitiesPath, 'utf8', (err, data) => {
  if (err) {
    console.error('Ошибка при чтении файла:', knownCitiesPath, err);
    return;
  }

  try {
    // Парсим JSON
    const jsonData = JSON.parse(data);
    
    // Сортируем массив городов по убыванию длины
    if (jsonData.cities && Array.isArray(jsonData.cities)) {
      const originalLength = jsonData.cities.length;
      jsonData.cities = sortByLengthDesc(jsonData.cities);
      
      // Записываем обновленные данные обратно в файл
      fs.writeFile(knownCitiesPath, JSON.stringify(jsonData, null, 2), 'utf8', (err) => {
        if (err) {
          console.error('Ошибка при записи в файл:', knownCitiesPath, err);
          return;
        }
        console.log(`Файл обновлен: ${knownCitiesPath}`);
        console.log(`Количество городов: ${originalLength}`);
        console.log('Первые 10 городов:', jsonData.cities.slice(0, 10));
      });
    }
  } catch (parseError) {
    console.error('Ошибка при парсинге JSON в файле:', knownCitiesPath, parseError);
  }
});