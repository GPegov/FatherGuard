import { Router } from 'express';
import FSSPParser from '../services/fsspParser.js';

const router = Router();

// Установка заголовков для правильной кодировки
router.use((req, res, next) => {
  res.header('Content-Type', 'application/json; charset=utf-8');
  next();
});

// Запуск парсинга данных ФССП по региону
router.post('/parse', async (req, res) => {
  try {
    const { region, regionCode } = req.body || {};
    console.log(`Запуск парсинга данных ФССП по запросу API для региона: ${region || 'по умолчанию'}, код: ${regionCode || 'не указан'}`);
    
    // Если указан код региона, используем его для создания парсера
    let fsspParser;
    if (regionCode) {
      // Находим имя региона по коду
      const fsspRegions = (await import('../services/fsspRegions.js')).default;
      const regionName = Object.keys(fsspRegions).find(key => fsspRegions[key] === parseInt(regionCode));
      if (regionName) {
        fsspParser = new FSSPParser(regionName);
      } else {
        // Если регион не найден по коду, создаем парсер с указанным именем или по умолчанию
        fsspParser = new FSSPParser(region);
      }
    } else {
      // Если код региона не указан, создаем парсер как раньше
      fsspParser = new FSSPParser(region);
    }
    
    const result = await fsspParser.parseAllData();
    res.json(result);
  } catch (error) {
    console.error('Ошибка в endpoint /parse:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Внутренняя ошибка сервера',
      error: error.message 
    });
  }
});

// Получение данных ФССП по региону
router.get('/data', async (req, res) => {
  try {
    const { region, regionCode } = req.query || {};
    console.log(`Получение данных ФССП для региона: ${region || 'по умолчанию'}, код: ${regionCode || 'не указан'}`);
    
    // Если указан код региона, используем его для создания парсера
    let fsspParser;
    if (regionCode) {
      // Находим имя региона по коду
      const fsspRegions = (await import('../services/fsspRegions.js')).default;
      const regionName = Object.keys(fsspRegions).find(key => fsspRegions[key] === parseInt(regionCode));
      if (regionName) {
        fsspParser = new FSSPParser(regionName);
      } else {
        // Если регион не найден по коду, создаем парсер с указанным именем или по умолчанию
        fsspParser = new FSSPParser(region);
      }
    } else {
      // Если код региона не указан, создаем парсер как раньше
      fsspParser = new FSSPParser(region);
    }
    
    const data = await fsspParser.getData();
    
    if (data) {
      res.json({ success: true, data });
    } else {
      res.json({ success: false, message: 'Данные не найдены' });
    }
  } catch (error) {
    console.error('Ошибка в endpoint /data:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Внутренняя ошибка сервера',
      error: error.message 
    });
  }
});

// Получение списка доступных регионов с кодами
router.get('/regions', async (req, res) => {
  try {
    console.log('Получение списка доступных регионов');
    // Получаем список регионов с кодами из объекта fsspRegions
    const fsspRegions = (await import('../services/fsspRegions.js')).default;
    const regions = Object.keys(fsspRegions);
    const regionsWithCodes = regions.map(region => ({
      name: region,
      code: fsspRegions[region]
    }));
    res.json({ success: true, regions: regionsWithCodes });
  } catch (error) {
    console.error('Ошибка в endpoint /regions:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Внутренняя ошибка сервера',
      error: error.message 
    });
  }
});

export default router;