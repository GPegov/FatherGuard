import { Router } from 'express';
import AIService from '../services/aiService.js';

const router = Router();

// Анализ текста на нарушения

// Унифицированный анализ текста
router.post('/analyze/text', async (req, res) => {
  try {
    const { text, instructions, strictMode } = req.body;
    const result = await AIService.analyzeText(text, instructions, strictMode);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Анализ конкретного документа
router.post('/analyze/document/:id', async (req, res) => {
  try {
    const { instructions, strictMode } = req.body;
    const result = await AIService.analyzeDocument(req.params.id, instructions, strictMode);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      documentId: req.params.id 
    });
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