import { Router } from 'express';
import FSSPParser from '../services/fsspParser.js';

const router = Router();

// Запуск парсинга данных ФССП по региону
router.post('/parse', async (req, res) => {
  try {
    const { region } = req.body || {};
    console.log(`Запуск парсинга данных ФССП по запросу API для региона: ${region || 'по умолчанию'}`);
    const fsspParser = new FSSPParser(region);
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
    const { region } = req.query || {};
    console.log(`Получение данных ФССП для региона: ${region || 'по умолчанию'}`);
    const fsspParser = new FSSPParser(region);
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

// Получение списка доступных регионов
router.get('/regions', async (req, res) => {
  try {
    console.log('Получение списка доступных регионов');
    // Получаем список регионов из объекта fsspRegions
    const regions = Object.keys((await import('../services/fsspRegions.js')).default);
    res.json({ success: true, regions });
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