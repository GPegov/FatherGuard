import { ComplaintService } from './services/complaintService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Получаем путь к db.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'dataBase', 'db.json');

// Читаем реальные данные из db.json
const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// Берем первый документ из БД
const realDocument = dbData.documents[0];
console.log('Используем реальный документ:', realDocument.summary);

// Создаем тестовые данные на основе реального документа
const testData = {
  documentId: realDocument.id,
  agency: 'Федеральная служба судебных приставов',
  currentDocument: {
    id: realDocument.id,
    originalText: realDocument.originalText,
    summary: realDocument.summary,
    keySentences: realDocument.keySentences,
    violations: realDocument.violations,
    documentDate: realDocument.documentDate,
    senderAgency: realDocument.senderAgency,
    date: realDocument.date,
    fsspDepartment: realDocument.fsspDepartment,
    // Добавляем данные заявителя
    applicantFullName: 'Иванов Иван Иванович',
    applicantAddress: '677000, Республика Саха (Якутия), г. Якутск, ул. Ленина, д. 10, кв. 5',
    applicantPhone: '+7 (4112) 12-34-56',
    applicantEmail: 'ivanov@example.com',
    documentNumber: '123/456',
    executiveProductionNumber: '12345/2025/12/123456',
    legalReferences: [
      'Федеральный закон от 02.10.2007 № 229-ФЗ «Об исполнительном производстве», статья 36',
      'Федеральный закон от 02.10.2007 № 229-ФЗ «Об исполнительном производстве», статья 46',
      'Федеральный закон от 02.05.2006 № 59-ФЗ «О порядке рассмотрения обращений граждан Российской Федерации», статья 12'
    ],
    requirements: [
      'Провести проверку по обстоятельствам изложенного в настоящей жалобе',
      'Закрыть все исполнительные производства в отношении меня, по которым не удалось исполнить требования в течение 2 месяцев с момента возбуждения исполнительного производства',
      'Предоставить письменный ответ с указанием принятых мер в течение 30 дней со дня регистрации настоящей жалобы'
    ]
  },
  relatedDocuments: dbData.documents.slice(1, 3) // Берем еще несколько документов как приложения
};

// Создаем mock базы данных
const mockDB = {
  data: {
    documents: dbData.documents,
    complaints: []
  },
  write: () => Promise.resolve()
};

async function testRealFSSPData() {
  try {
    const complaintService = new ComplaintService();
    
    console.log('Тестирование интеграции EJS шаблонизатора с реальными данными ФССП...');
    
    // Тестируем генерацию жалобы
    const complaint = await complaintService.generateUnifiedComplaint(mockDB, testData);
    
    console.log('Жалоба успешно создана');
    console.log('Наличие контента:', !!complaint.content);
    console.log('Наличие шаблонизированного контента:', !!complaint.templatedContent);
    
    if (complaint.templatedContent) {
      // Сохраняем результат в файл для проверки
      const outputPath = path.join(__dirname, 'test-real-fssp-output.html');
      fs.writeFileSync(outputPath, complaint.templatedContent);
      console.log('Шаблонизированный контент сохранен в', outputPath);
    }
    
    if (complaint.content) {
      // Сохраняем текстовую версию жалобы
      const textPath = path.join(__dirname, 'test-real-fssp-complaint.txt');
      fs.writeFileSync(textPath, complaint.content);
      console.log('Текстовая версия жалобы сохранена в', textPath);
    }
    
    console.log('Тест пройден успешно!');
  } catch (error) {
    console.error('Ошибка при тестировании:', error);
  }
}

// Запускаем тест
testRealFSSPData();