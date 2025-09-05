import { Router } from 'express';
import FSSPParser from '../services/fsspParser.js';

const router = Router();

// Middleware для получения AIService из app.locals
router.use((req, res, next) => {
  if (req.app.locals.aiService) {
    req.aiService = req.app.locals.aiService;
  }
  next();
});

// Запуск парсинга данных ФССП
router.post('/parse', async (req, res) => {
  try {
    console.log('Запуск парсинга данных ФССП по запросу API');
    const fsspParser = new FSSPParser(req.aiService);
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

// Получение данных ФССП
router.get('/data', async (req, res) => {
  try {
    console.log('Получение данных ФССП');
    const fsspParser = new FSSPParser();
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

export default router;