// Тестирование шаблонизатора FatherGuard
import { ComplaintService } from '../services/complaintService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Получаем __dirname в ES модулях
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Создаем экземпляр сервиса
const complaintService = new ComplaintService();

// Читаем тестовые данные
const testDataPath = path.join(__dirname, 'complaint-data-example.json');
const testData = JSON.parse(fs.readFileSync(testDataPath, 'utf8'));

// Тестовые данные для генерации жалобы
const mockDB = {
  data: {
    documents: [],
    complaints: []
  },
  write: () => Promise.resolve()
};

const requestData = {
  agency: 'Федеральная служба судебных приставов',
  currentDocument: testData.document,
  relatedDocuments: testData.relatedDocuments
};

// Тест 1: Генерация жалобы через шаблонизатор
console.log('=== Тест 1: Генерация жалобы через шаблонизатор ===');
try {
  const result = await complaintService.generateUnifiedComplaint(mockDB, requestData);
  console.log('Жалоба успешно сгенерирована');
  console.log('Наличие текстовой версии:', !!result.content);
  console.log('Наличие HTML версии:', !!result.templatedContent);
  
  // Сохраняем HTML версию для просмотра
  fs.writeFileSync('test-complaint.html', result.templatedContent, 'utf8');
  console.log('HTML версия жалобы сохранена в test-complaint.html');
} catch (error) {
  console.error('Ошибка при генерации жалобы:', error);
}

// Тест 2: Проверка выбора шаблона
console.log('\n=== Тест 2: Проверка выбора шаблона ===');
const fsspTemplatePath = complaintService.getTemplatePath('Федеральная служба судебных приставов');
const officialTemplatePath = complaintService.getTemplatePath('Прокуратура');

console.log('Путь к шаблону ФССП:', fsspTemplatePath);
console.log('Путь к официальному шаблону:', officialTemplatePath);

// Проверяем существование файлов
console.log('Шаблон ФССП существует:', fs.existsSync(fsspTemplatePath));
console.log('Официальный шаблон существует:', fs.existsSync(officialTemplatePath));

// Тест 3: Подготовка данных для шаблона
console.log('\n=== Тест 3: Подготовка данных для шаблона ===');
const templateData = complaintService.prepareTemplateData(
  testData.document, 
  testData.relatedDocuments, 
  'Федеральная служба судебных приставов', 
  {}
);

console.log('Подготовленные данные для шаблона:');
console.log('- Дата жалобы:', templateData.complaintDate);
console.log('- Получатель:', templateData.recipient);
console.log('- Отдел ФССП:', templateData.fsspDepartment);
console.log('- Количество нарушений:', templateData.violations.length);
console.log('- Количество приложений:', templateData.attachments.length);

// Тест 4: Рендеринг шаблона напрямую
console.log('\n=== Тест 4: Рендеринг шаблона напрямую ===');
try {
  const html = await complaintService.renderComplaintTemplate('ФССП', templateData);
  console.log('Шаблон успешно отрендерен, длина:', html.length);
  
  // Сохраняем для просмотра
  fs.writeFileSync('test-direct-render.html', html, 'utf8');
  console.log('Результат рендеринга сохранен в test-direct-render.html');
} catch (error) {
  console.error('Ошибка при рендеринге шаблона:', error);
}

console.log('\n=== Тестирование завершено ===');