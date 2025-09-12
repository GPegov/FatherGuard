import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fsspRegions from './services/fsspRegions.js';

// Получаем __dirname в ES модуле
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Путь к папке с данными отделений ФССП
const departmentsDir = path.join(__dirname, 'dataBase', 'fsspDepartmentsDB');

// Функция для добавления кода региона в файл данных
function addRegionCodeToFile(filePath, regionCode) {
  try {
    // Читаем содержимое файла
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileContent);
    
    // Обновляем структуру данных для каждого региона
    if (data.regions && Array.isArray(data.regions)) {
      data.regions = data.regions.map(region => {
        // Добавляем код региона
        return {
          region: region.region,
          regionCode: regionCode,
          cities: region.cities
        };
      });
    }
    
    // Записываем обновленные данные обратно в файл
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Обновлен файл: ${filePath}`);
  } catch (error) {
    console.error(`Ошибка при обновлении файла ${filePath}:`, error.message);
  }
}

// Основная функция для обновления всех файлов
function updateAllRegionFiles() {
  try {
    // Получаем список всех файлов в папке
    const files = fs.readdirSync(departmentsDir);
    
    // Фильтруем только JSON файлы
    const jsonFiles = files.filter(file => path.extname(file) === '.json');
    
    console.log(`Найдено файлов для обновления: ${jsonFiles.length}`);
    
    // Обрабатываем каждый файл
    jsonFiles.forEach(file => {
      const filePath = path.join(departmentsDir, file);
      
      // Извлекаем код региона из имени файла (первые 2 символа)
      const regionCode = file.substring(0, 2);
      
      // Проверяем, что это действительно код региона (число)
      if (!isNaN(regionCode) && regionCode.length === 2) {
        console.log(`Обновление файла: ${file} с кодом региона: ${regionCode}`);
        addRegionCodeToFile(filePath, regionCode);
      } else {
        console.log(`Пропущен файл (некорректный формат имени): ${file}`);
      }
    });
    
    console.log('Все файлы успешно обновлены!');
  } catch (error) {
    console.error('Ошибка при обновлении файлов:', error.message);
  }
}

// Запускаем обновление
updateAllRegionFiles();