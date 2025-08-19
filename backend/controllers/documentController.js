import Document from '../models/Document.js';
import aiService from '../services/aiService.js';
import pdfService from '../services/pdfService.js';

export default {
  async createDocument(req, res) {
    try {
      const { text, files = [] } = req.body;
      const document = new Document({ text });
      
      if (files.length) {
        const fileContents = await Promise.all(
          files.map(file => pdfService.extractTextFromPdf(file.buffer))
        );
        document.text += '\n\n' + fileContents.join('\n\n');
      }

      const analysis = await aiService.analyzeWithDeepSeek(document.text);
      document.summary = analysis.summary;
      document.keySentences = analysis.keyParagraphs;

      await document.save();
      res.status(201).json(document);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async analyzeDocument(req, res) {
    try {
      const document = await Document.findById(req.params.id);
      const analysis = await aiService.analyzeWithDeepSeek(
        document.originalText,
        req.body.instructions
      );
      
      document.analysis = analysis;
      await document.save();
      
      res.json(analysis);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};