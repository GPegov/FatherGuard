import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Получаем путь к текущему файлу
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Имитация API endpoint'ов для тестирования
const app = express();
app.use(express.json());

// Эндпоинт для запуска парсинга
app.post('/api/fssp/parse', async (req, res) => {
  try {
    const { regionCode } = req.body;
    
    // Имитация вызова парсера
    const { FSSPParser } = await import('./services/parsing/fsspParser.js');
    
    if (regionCode === '11') {
      const parser = new FSSPParser("Республика Коми");
      const result = await parser.parseAllData();
      
      res.json({
        success: result.success,
        message: result.message,
        statistics: result.statistics
      });
    } else {
      res.status(400).json({ error: 'Поддерживается только парсинг для Республики Коми (код 11)' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Эндпоинт для получения данных
app.get('/api/fssp/data/:regionCode', async (req, res) => {
  try {
    const { regionCode } = req.params;
    
    if (regionCode === '11') {
      const { default: fsspRegions } = await import('./services/fsspRegions.js');
      const regionName = Object.keys(fsspRegions).find(key => fsspRegions[key] === 11);
      
      if (regionName) {
        const transliterate = (await import('./services/transliterate.js')).default;
        const fileName = `11_${transliterate(regionName)}.json`;
        const dataFilePath = join(__dirname, 'dataBase', 'fsspDepartmentsDB', fileName);
        
        if (fs.existsSync(dataFilePath)) {
          const data = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
          res.json(data);
        } else {
          res.status(404).json({ error: 'Данные не найдены' });
        }
      } else {
        res.status(404).json({ error: 'Регион не найден' });
      }
    } else {
      res.status(400).json({ error: 'Поддерживается только получение данных для Республики Коми (код 11)' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Создаем тестовый сервер
const PORT = 3001;
const server = app.listen(PORT, () => {
  console.log(`Тестовый сервер запущен на порту ${PORT}`);
  
  // Запускаем тесты
  setTimeout(runTests, 1000);
});

async function runTests() {
  console.log('\n=== ТЕСТИРОВАНИЕ API ДЛЯ РЕСПУБЛИКИ КОМИ ===\n');
  
  try {
    // Тест 1: Получение данных
    console.log('Тест 1: Получение данных для Республики Коми...');
    
    const getDataResponse = await fetch(`http://localhost:${PORT}/api/fssp/data/11`);
    const getDataResult = await getDataResponse.json();
    
    if (getDataResponse.ok) {
      console.log('✓ Получение данных успешно');
      console.log(`  Временная метка: ${getDataResult.timestamp}`);
      console.log(`  Регионов: ${getDataResult.regions.length}`);
      if (getDataResult.regions.length > 0) {
        console.log(`  Городов в первом регионе: ${getDataResult.regions[0].cities.length}`);
        if (getDataResult.regions[0].cities.length > 0) {
          console.log(`  Первый город: ${getDataResult.regions[0].cities[0].name}`);
          console.log(`  Отделений в первом городе: ${getDataResult.regions[0].cities[0].departments.length}`);
        }
      }
    } else {
      console.log('✗ Ошибка получения данных:', getDataResult.error);
    }
    
    console.log('\n=== ТЕСТИРОВАНИЕ ЗАВЕРШЕНО ===');
  } catch (error) {
    console.error('Ошибка при тестировании:', error.message);
  } finally {
    // Закрываем сервер
    server.close();
  }
}