import { ComplaintService } from './services/complaintService.js';
import fs from 'fs';

// Создаем тестовые данные
const testData = {
  documentId: 'test-123',
  agency: 'Федеральная служба судебных приставов',
  currentDocument: {
    id: 'doc-123',
    originalText: 'Тестовый документ о нарушении прав',
    summary: 'Нарушение прав на получение алиментов',
    keySentences: ['Нарушены сроки перечисления алиментов', 'Неправильно указаны реквизиты счета'],
    violations: ['Нарушение статьи 9 закона об исполнительном производстве'],
    documentDate: '2025-09-20',
    senderAgency: 'Отдел судебных приставов по Московскому району г. Якутска',
    date: '2025-09-20',
    fsspDepartment: 'Федеральная служба судебных приставов'
  },
  relatedDocuments: []
};

// Создаем mock базы данных
const mockDB = {
  data: {
    documents: [testData.currentDocument],
    complaints: []
  },
  write: () => Promise.resolve()
};

async function testTemplateIntegration() {
  try {
    const complaintService = new ComplaintService();
    
    console.log('Тестирование интеграции EJS шаблонизатора...');
    
    // Тестируем генерацию жалобы
    const complaint = await complaintService.generateUnifiedComplaint(mockDB, testData);
    
    console.log('Жалоба успешно создана');
    console.log('Наличие контента:', !!complaint.content);
    console.log('Наличие шаблонизированного контента:', !!complaint.templatedContent);
    
    if (complaint.templatedContent) {
      // Сохраняем результат в файл для проверки
      fs.writeFileSync('test-output.html', complaint.templatedContent);
      console.log('Шаблонизированный контент сохранен в test-output.html');
    }
    
    console.log('Тест пройден успешно!');
  } catch (error) {
    console.error('Ошибка при тестировании:', error);
  }
}

// Запускаем тест
testTemplateIntegration();