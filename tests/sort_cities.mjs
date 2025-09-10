import fs from 'fs';
import path from 'path';

// Путь к директории с файлами известных городов
const knownCitiesDir = path.join(process.cwd(), 'backend', 'dataBase', 'knownCities');

// Функция для сортировки массива строк по убыванию длины
function sortByLengthDesc(arr) {
  return arr.sort((a, b) => b.length - a.length);
}

// Получаем список всех файлов в директории
fs.readdir(knownCitiesDir, (err, files) => {
  if (err) {
    console.error('Ошибка при чтении директории:', err);
    return;
  }

  // Обрабатываем каждый файл
  files.forEach(file => {
    if (path.extname(file) === '.json') {
      const filePath = path.join(knownCitiesDir, file);
      
      // Читаем содержимое файла
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          console.error('Ошибка при чтении файла:', filePath, err);
          return;
        }

        try {
          // Парсим JSON
          const jsonData = JSON.parse(data);
          
          // Сортируем массив городов по убыванию длины
          if (jsonData.cities && Array.isArray(jsonData.cities)) {
            jsonData.cities = sortByLengthDesc(jsonData.cities);
            
            // Записываем обновленные данные обратно в файл
            fs.writeFile(filePath, JSON.stringify(jsonData, null, 2), 'utf8', (err) => {
              if (err) {
                console.error('Ошибка при записи в файл:', filePath, err);
                return;
              }
              console.log('Файл обновлен:', filePath);
            });
          }
        } catch (parseError) {
          console.error('Ошибка при парсинге JSON в файле:', filePath, parseError);
        }
      });
    }
  });
});