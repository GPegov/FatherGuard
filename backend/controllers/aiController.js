import aiService from '../services/aiService.js';

export default {
  async analyzeText(req, res) {
    console.log("Incoming request body:", req.body);
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: 'Текст обязателен' });
      }

      const result = await aiService.analyzeLegalText(text);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};