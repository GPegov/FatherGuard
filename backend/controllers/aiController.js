import aiService from '../services/aiService.js';

const analyzeText = async (req, res) => {
  try {
    const result = await aiService.analyzeText(req.body.text);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const generateComplaint = async (req, res) => {
  try {
    const result = await aiService.generateComplaint(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export default { analyzeText, generateComplaint };