import pdf from 'pdf-parse';

export default {
  async extractTextFromPdf(buffer) {
    try {
      const data = await pdf(buffer);
      return {
        text: data.text,
        metadata: data.metadata,
        numPages: data.numpages
      };
    } catch (error) {
      console.error('PDF parsing error:', error);
      throw new Error('Не удалось обработать PDF файл');
    }
  }
}