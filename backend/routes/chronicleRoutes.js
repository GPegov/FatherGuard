import { Router } from 'express';
import ChronicleService from '../services/chronicleService.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default function chronicleRoutes({ db }) {
  const router = Router();
  
  // Создаем экземпляр ChronicleService
  const chronicleService = new ChronicleService(path.join(__dirname, '../dataBase/chronicle.json'));

  // Получение всех записей летописи (от новых к старым)
  router.get('/', async (req, res) => {
    try {
      console.log('Получение всех записей летописи');
      const entries = await chronicleService.getAllChronicleEntries();
      
      res.json({
        success: true,
        data: entries,
        total: entries.length,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('Ошибка получения летописи:', err);
      res.status(500).json({ 
        success: false,
        message: 'Ошибка при получении записей летописи',
        error: err.message 
      });
    }
  });

  // Получение записей в хронологическом порядке (от старых к новым)
  router.get('/chronological', async (req, res) => {
    try {
      console.log('Получение записей летописи в хронологическом порядке');
      const entries = await chronicleService.getChronicleEntriesChronologically();
      
      res.json({
        success: true,
        data: entries,
        total: entries.length,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('Ошибка получения хронологических записей:', err);
      res.status(500).json({ 
        success: false,
        message: 'Ошибка при получении хронологических записей',
        error: err.message 
      });
    }
  });

  // Получение записей летописи для конкретного документа
  router.get('/document/:documentId', async (req, res) => {
    try {
      const { documentId } = req.params;
      console.log(`Получение записей летописи для документа: ${documentId}`);
      
      const entries = await chronicleService.getChronicleForDocument(documentId);
      
      res.json({
        success: true,
        data: entries,
        total: entries.length,
        documentId: documentId,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('Ошибка получения летописи для документа:', err);
      res.status(500).json({ 
        success: false,
        message: 'Ошибка при получении записей летописи для документа',
        error: err.message 
      });
    }
  });

  // Получение записей по типу события
  router.get('/type/:eventType', async (req, res) => {
    try {
      const { eventType } = req.params;
      console.log(`Получение записей летописи по типу: ${eventType}`);
      
      const allEntries = await chronicleService.getAllChronicleEntries();
      const filteredEntries = allEntries.filter(entry => 
        entry.eventType === eventType
      );
      
      res.json({
        success: true,
        data: filteredEntries,
        total: filteredEntries.length,
        eventType: eventType,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('Ошибка получения записей по типу:', err);
      res.status(500).json({ 
        success: false,
        message: 'Ошибка при получении записей летописи по типу',
        error: err.message 
      });
    }
  });

  // Получение записей за период
  router.get('/period/:startDate', async (req, res) => {
    try {
      const { startDate, endDate } = req.params;
      const endDateToUse = endDate || new Date().toISOString().split('T')[0];
      
      console.log(`Получение записей летописи за период: ${startDate} - ${endDateToUse}`);
      
      const allEntries = await chronicleService.getChronicleEntriesChronologically();
      const filteredEntries = allEntries.filter(entry => {
        const entryDate = new Date(entry.date);
        const start = new Date(startDate);
        const end = new Date(endDateToUse);
        
        return entryDate >= start && entryDate <= end;
      });
      
      res.json({
        success: true,
        data: filteredEntries,
        total: filteredEntries.length,
        period: {
          start: startDate,
          end: endDateToUse
        },
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('Ошибка получения записей за период:', err);
      res.status(500).json({ 
        success: false,
        message: 'Ошибка при получении записей летописи за период',
        error: err.message 
      });
    }
  });

  // Получение статистики по летописи
  router.get('/stats', async (req, res) => {
    try {
      console.log('Получение статистики по летописи');
      
      const allEntries = await chronicleService.getAllChronicleEntries();
      
      // Статистика по типам событий
      const eventsByType = allEntries.reduce((acc, entry) => {
        acc[entry.eventType] = (acc[entry.eventType] || 0) + 1;
        return acc;
      }, {});
      
      // Статистика по месяцам
      const entriesByMonth = allEntries.reduce((acc, entry) => {
        const month = entry.date.substring(0, 7); // YYYY-MM
        acc[month] = (acc[month] || 0) + 1;
        return acc;
      }, {});
      
      // Последняя дата обновления
      const lastUpdate = allEntries.length > 0 
        ? allEntries[0].updatedAt 
        : null;
      
      res.json({
        success: true,
        data: {
          totalEntries: allEntries.length,
          eventsByType,
          entriesByMonth,
          lastUpdate,
          dateRange: allEntries.length > 0 ? {
            earliest: allEntries[allEntries.length - 1].date,
            latest: allEntries[0].date
          } : null
        },
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('Ошибка получения статистики летописи:', err);
      res.status(500).json({ 
        success: false,
        message: 'Ошибка при получении статистики летописи',
        error: err.message 
      });
    }
  });

  // Создание новой записи летописи
  router.post('/', async (req, res) => {
    try {
      const entryData = req.body;
      console.log('Создание новой записи летописи:', entryData);
      
      // Валидация обязательных полей
      if (!entryData.content) {
        return res.status(400).json({
          success: false,
          message: 'Поле content обязательно для заполнения'
        });
      }

      const newEntry = await chronicleService.createChronicleEntry(entryData);
      
      res.status(201).json({
        success: true,
        data: newEntry,
        message: 'Запись успешно создана'
      });
    } catch (err) {
      console.error('Ошибка создания записи летописи:', err);
      res.status(400).json({ 
        success: false,
        message: 'Ошибка при создании записи летописи',
        error: err.message 
      });
    }
  });

  // Обновление записи летописи
  router.put('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      console.log(`Обновление записи летописи: ${id}`, updateData);
      
      const updatedEntry = await chronicleService.updateChronicleEntry(id, updateData);
      
      if (!updatedEntry) {
        return res.status(404).json({
          success: false,
          message: 'Запись летописи не найдена'
        });
      }
      
      res.json({
        success: true,
        data: updatedEntry,
        message: 'Запись успешно обновлена'
      });
    } catch (err) {
      console.error('Ошибка обновления записи летописи:', err);
      res.status(400).json({ 
        success: false,
        message: 'Ошибка при обновлении записи летописи',
        error: err.message 
      });
    }
  });

  // Удаление записи летописи
  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`Удаление записи летописи: ${id}`);
      
      const deleted = await chronicleService.deleteChronicleEntry(id);
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Запись летописи не найдена'
        });
      }
      
      res.json({
        success: true,
        message: 'Запись успешно удалена'
      });
    } catch (err) {
      console.error('Ошибка удаления записи летописи:', err);
      res.status(500).json({ 
        success: false,
        message: 'Ошибка при удалении записи летописи',
        error: err.message 
      });
    }
  });

  // Получение конкретной записи по ID
  router.get('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`Получение записи летописи: ${id}`);
      
      const allEntries = await chronicleService.getAllChronicleEntries();
      const entry = allEntries.find(e => e.id === id);
      
      if (!entry) {
        return res.status(404).json({
          success: false,
          message: 'Запись летописи не найдена'
        });
      }
      
      res.json({
        success: true,
        data: entry
      });
    } catch (err) {
      console.error('Ошибка получения записи летописи:', err);
      res.status(500).json({ 
        success: false,
        message: 'Ошибка при получении записи летописи',
        error: err.message 
      });
    }
  });

  return router;
}






// import { Router } from 'express';
// import ChronicleService from '../services/chronicleService.js';
// import path from 'path';
// import { fileURLToPath } from 'url';

// const __dirname = path.dirname(fileURLToPath(import.meta.url));

// export default function chronicleRoutes({ db }) {
//   const router = Router();
  
//   // Создаем экземпляр ChronicleService
//   const chronicleService = new ChronicleService(path.join(__dirname, '../dataBase/chronicle.json'));

//   // Получение всех записей летописи
//   router.get('/', async (req, res) => {
//     try {
//       const entries = await chronicleService.getAllChronicleEntries(); // От новых к старым
//       res.json(entries);
//     } catch (err) {
//       console.error('Ошибка получения летописи:', err);
//       res.status(500).json({ message: err.message });
//     }
//   });

//   // Получение записей летописи для конкретного документа
//   router.get('/document/:documentId', async (req, res) => {
//     try {
//       const { documentId } = req.params;
//       const entries = await chronicleService.getChronicleForDocument(documentId);
//       res.json(entries);
//     } catch (err) {
//       console.error('Ошибка получения летописи для документа:', err);
//       res.status(500).json({ message: err.message });
//     }
//   });

//   // Создание новой записи летописи (для тестирования или администратором)
//   router.post('/', async (req, res) => {
//     try {
//       const entryData = req.body;
//       const newEntry = await chronicleService.createChronicleEntry(entryData);
//       res.status(201).json(newEntry);
//     } catch (err) {
//       console.error('Ошибка создания записи летописи:', err);
//       res.status(400).json({ message: err.message });
//     }
//   });

//   // Обновление записи летописи
//   router.put('/:id', async (req, res) => {
//     try {
//       const { id } = req.params;
//       const updateData = req.body;
//       const updatedEntry = await chronicleService.updateChronicleEntry(id, updateData);
      
//       if (!updatedEntry) {
//         return res.status(404).json({ message: 'Запись летописи не найдена' });
//       }
      
//       res.json(updatedEntry);
//     } catch (err) {
//       console.error('Ошибка обновления записи летописи:', err);
//       res.status(400).json({ message: err.message });
//     }
//   });

//   // Удаление записи летописи
//   router.delete('/:id', async (req, res) => {
//     try {
//       const { id } = req.params;
//       const deleted = await chronicleService.deleteChronicleEntry(id);
      
//       if (!deleted) {
//         return res.status(404).json({ message: 'Запись летописи не найдена' });
//       }
      
//       res.status(204).end();
//     } catch (err) {
//       console.error('Ошибка удаления записи летописи:', err);
//       res.status(500).json({ message: err.message });
//     }
//   });

//   return router;
// }