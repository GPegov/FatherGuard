import { Router } from 'express';
import ChronicleService from '../services/chronicleService.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default function chronicleRoutes({ db }) {
  const router = Router();
  
  // Создаем экземпляр ChronicleService
  const chronicleService = new ChronicleService(path.join(__dirname, '../dataBase/chronicle.json'));

  // Получение всех записей летописи
  router.get('/', async (req, res) => {
    try {
      const entries = await chronicleService.getAllChronicleEntries(); // От новых к старым
      res.json(entries);
    } catch (err) {
      console.error('Ошибка получения летописи:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // Получение записей летописи для конкретного документа
  router.get('/document/:documentId', async (req, res) => {
    try {
      const { documentId } = req.params;
      const entries = await chronicleService.getChronicleForDocument(documentId);
      res.json(entries);
    } catch (err) {
      console.error('Ошибка получения летописи для документа:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // Создание новой записи летописи (для тестирования или администратором)
  router.post('/', async (req, res) => {
    try {
      const entryData = req.body;
      const newEntry = await chronicleService.createChronicleEntry(entryData);
      res.status(201).json(newEntry);
    } catch (err) {
      console.error('Ошибка создания записи летописи:', err);
      res.status(400).json({ message: err.message });
    }
  });

  // Обновление записи летописи
  router.put('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const updatedEntry = await chronicleService.updateChronicleEntry(id, updateData);
      
      if (!updatedEntry) {
        return res.status(404).json({ message: 'Запись летописи не найдена' });
      }
      
      res.json(updatedEntry);
    } catch (err) {
      console.error('Ошибка обновления записи летописи:', err);
      res.status(400).json({ message: err.message });
    }
  });

  // Удаление записи летописи
  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await chronicleService.deleteChronicleEntry(id);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Запись летописи не найдена' });
      }
      
      res.status(204).end();
    } catch (err) {
      console.error('Ошибка удаления записи летописи:', err);
      res.status(500).json({ message: err.message });
    }
  });

  return router;
}