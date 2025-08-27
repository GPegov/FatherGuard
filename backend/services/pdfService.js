import pdf from 'pdf-parse';

export default {
  async extractTextFromPdf(buffer) {
    try {
      console.log('Извлечение текста из PDF буфера размером:', buffer.length);
      const data = await pdf(buffer);
      console.log('Извлеченный текст из PDF:', data.text ? data.text.substring(0, 100) + '...' : 'null');
      
      // Проверка типа текста из PDF
      let validText = "";
      if (data.text !== undefined && data.text !== null) {
        if (typeof data.text === 'string') {
          validText = data.text;
        } else {
          console.log("Предупреждение: текст из PDF не является строкой:", typeof data.text);
          validText = String(data.text);
        }
      }
      
      return {
        text: validText,
        metadata: data.metadata,
        numPages: data.numpages
      };
    } catch (error) {
      console.error('PDF parsing error:', error);
      throw new Error('Не удалось обработать PDF файл');
    }
  }
}