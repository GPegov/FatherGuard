import AIService from '../services/aiService.js';

// Создаем экземпляр AIService
const aiService = new AIService();

const analyzeText = async (req, res) => {
  try {
    const result = await aiService.analyzeLegalText(req.body.text);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const generateComplaint = async (req, res) => {
  try {
    // Для совместимости с существующим API, преобразуем данные
    const { text, agency } = req.body;
    const result = await aiService.generateComplaintV2(
      { fullText: text },
      agency,
      [],
      ""
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export default { analyzeText, generateComplaint };