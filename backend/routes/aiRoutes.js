import { Router } from 'express';
import AIService from '../services/aiService.js';

const router = Router();

// Анализ текста на нарушения
router.post('/analyze', async (req, res) => {
  try {
    const { text } = req.body;
    const result = await AIService.analyzeLegalText(text);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Генерация жалобы
router.post('/generate-complaint', async (req, res) => {
  try {
    const { text, agency } = req.body;
    const result = await AIService.generateComplaint(text, agency);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;