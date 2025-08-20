export default class Document {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.dateReceived = data.dateReceived || new Date().toISOString().split('T')[0];
    this.agency = data.agency || '';
    this.originalText = data.originalText || '';
    this.summary = data.summary || '';
    this.keySentences = data.keySentences || [];
    this.attachments = data.attachments || [];
    this.complaints = data.complaints || [];
    this.analysisStatus = data.analysisStatus || 'pending';
    this.lastAnalyzedAt = data.lastAnalyzedAt || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    
    // Поля для вложенных документов
    this.attachments = this.attachments.map(att => ({
      id: att.id || uuidv4(),
      name: att.name,
      type: att.type,
      size: att.size,
      path: att.path,
      text: att.text || '',
      analysis: att.analysis || {
        documentType: '',
        sentDate: '',
        senderAgency: '',
        summary: '',
        keySentences: []
      }
    }));
  }

  validate() {
    if (!this.originalText && this.attachments.length === 0) {
      throw new Error('Документ должен содержать текст или вложения');
    }
    
    if (this.attachments.some(att => !att.text && !att.analysis)) {
      throw new Error('Все вложения должны содержать текст или анализ');
    }
  }
}