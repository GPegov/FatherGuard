export default class Document {
  constructor(data) {
    this.id = data.id;
    this.content = data.content || '';
    this.agency = data.agency;
    this.createdAt = data.createdAt;
    this.summary = data.summary || ''; 
    this.keyParagraphs = data.keyParagraphs || []; 
    this.originalText = data.originalText || ''; 
    this.attachments = data.attachments || []; 
  }
  validate() {
  if (!this.originalText && this.attachments.length === 0) {
    throw new Error('Документ должен содержать текст или вложения')
  }
}
}