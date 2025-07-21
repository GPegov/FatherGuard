export default {
  async createAIComplaint(req, res) {
    try {
      const { text, agency, documentId } = req.body;
      const files = req.files?.attachments || [];

      // Анализ текста и файлов
      const fileContents = await Promise.all(
        files.map(file => parseFileContent(file.path))
      );
      
      const fullText = [text, ...fileContents].join('\n\n');
      const result = await aiService.generateComplaint(fullText, files, agency);

      // Сохранение жалобы
      const complaint = await Complaint.create({
        content: result.content,
        agency,
        documentId,
        analysis: result.analysis
      });

      res.json(complaint);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};