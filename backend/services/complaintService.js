import { v4 as uuidv4 } from 'uuid';
import AIService from './aiService.js';

// Создаем экземпляр AIService
const aiService = new AIService();

class ComplaintService {
  constructor() {
    this.generateComplaint = this.generateComplaint.bind(this);
    this.generateUnifiedComplaint = this.generateUnifiedComplaint.bind(this);
  }

  // ЕДИНСТВЕННЫЙ унифицированный метод для генерации жалоб
  async generateUnifiedComplaint(db, requestData) {
    try {
      console.log('Генерация жалобы из данных:', requestData);
      
      const { documentId, agency, currentDocument, relatedDocuments } = requestData;
      
      // Проверка обязательных полей
      if (!agency) {
        throw new Error('Не указано ведомство');
      }

      // Получаем данные основного документа
      const mainDocData = await this.getMainDocumentData(db, documentId, currentDocument);
      
      // Получаем данные связанных документов
      const relatedDocsData = await this.getRelatedDocumentsData(db, documentId, mainDocData, relatedDocuments);
      
      // Генерируем жалобу через AI
      const complaintResult = await this.generateWithAI(mainDocData, relatedDocsData, agency);
      
      // Создаем и сохраняем объект жалобы
      const complaint = this.createComplaintObject(mainDocData, agency, relatedDocsData, complaintResult, documentId);
      
      // Сохраняем в БД
      await this.saveComplaintToDB(db, complaint, mainDocData);
      
      console.log('Жалоба успешно создана и сохранена');
      return complaint;

    } catch (error) {
      console.error('Ошибка в generateUnifiedComplaint:', error);
      throw error;
    }
  }

  // Получение данных основного документа
  async getMainDocumentData(db, documentId, currentDocument) {
    if (currentDocument && currentDocument.originalText) {
      console.log('Используем переданные данные документа');
      return this.normalizeDocumentData(currentDocument);
    }

    if (documentId) {
      console.log('Ищем документ в БД по ID:', documentId);
      const doc = db.data.documents.find(d => d.id === documentId);
      if (!doc) {
        throw new Error('Document not found');
      }
      return this.normalizeDocumentData(doc);
    }

    throw new Error('Не указан documentId и не переданы данные документа');
  }

  // Получение данных связанных документов
  async getRelatedDocumentsData(db, documentId, mainDocData, relatedDocuments) {
    if (relatedDocuments && relatedDocuments.length > 0) {
      console.log('Используем переданные связанные документы');
      return relatedDocuments.map(doc => this.normalizeDocumentData(doc));
    }

    if (documentId && db.data.documents) {
      console.log('Ищем связанные документы в БД');
      return db.data.documents.filter(d => 
        d.id !== documentId && 
        d.date && 
        mainDocData.date && 
        d.date <= mainDocData.date
      ).map(doc => this.normalizeDocumentData(doc));
    }

    return [];
  }

  // Нормализация данных документа
  normalizeDocumentData(doc) {
    return {
      id: doc.id || uuidv4(),
      originalText: doc.originalText || '',
      summary: doc.summary || '',
      keySentences: Array.isArray(doc.keySentences) ? doc.keySentences : [],
      violations: Array.isArray(doc.violations) ? doc.violations : [],
      documentDate: doc.documentDate || doc.date || '',
      senderAgency: doc.senderAgency || doc.agency || '',
      date: doc.date || new Date().toISOString().split('T')[0],
      agency: doc.agency || ''
    };
  }

  // Генерация жалобы через AI
  async generateWithAI(mainDocData, relatedDocsData, agency) {
    try {
      console.log("=== НАЧАЛО GENERATE WITH AI ===");
      // Подготавливаем данные для анализа
      const analysisData = {
        summary: mainDocData.summary,
        keySentences: mainDocData.keySentences,
        violations: mainDocData.violations,
        documentDate: mainDocData.documentDate,
        senderAgency: mainDocData.senderAgency,
        attachments: relatedDocsData
      };
      
      // Используем метод из aiService для построения промпта
      const promptData = aiService.buildComplaintPrompt(analysisData, agency);
      const prompt = aiService.preparePrompt(promptData, "generate_complaint", { agency });
      
      console.log('Отправка запроса к AI с промптом:', prompt.substring(0, 200) + '...');
      console.log('Полная длина промпта:', prompt.length);
      console.log("=== КОНЕЦ GENERATE WITH AI ===");
      
      // Проверим наличие текста в документе
      if (!mainDocData.originalText || mainDocData.originalText.trim().length === 0) {
        console.log('Внимание: основной документ не содержит текста');
        if (mainDocData.summary) {
          console.log('Используется summary документа:', mainDocData.summary.substring(0, 100) + '...');
        }
      } else {
        console.log('Текст основного документа (первые 200 символов):', mainDocData.originalText.substring(0, 200) + '...');
      }
      
      const response = await aiService.queryLocalModel(prompt, {
        temperature: 0.6,
        format: "json"
      });
      
      console.log('Ответ от AI получен:', typeof response);
      if (typeof response === 'string') {
        console.log('Ответ от AI (первые 200 символов):', response.substring(0, 200));
      } else {
        console.log('Ответ от AI (объект):', JSON.stringify(response).substring(0, 200));
      }
      
      return this.parseAIResponse(response);
      
    } catch (aiError) {
      console.error('Ошибка AI генерации:', aiError);
      console.error('Стек ошибки:', aiError.stack);
      // Возвращаем запасной вариант
      return {
        content: this.generateFallbackComplaint(mainDocData, agency)
      };
    }
  }

  // Парсинг ответа AI
  parseAIResponse(response) {
    try {
      if (typeof response === 'string') {
        // Пытаемся найти JSON в строке
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            content: parsed.content || parsed.complaint || response
          };
        }
        return { content: response };
      }
      
      if (typeof response === 'object') {
        return {
          content: response.content || response.complaint || JSON.stringify(response)
        };
      }
      
      return { content: 'Не удалось сгенерировать жалобу' };
      
    } catch (e) {
      console.error('Ошибка парсинга ответа AI:', e);
      return { content: response || 'Не удалось сгенерировать жалобу' };
    }
  }

  // Запасной вариант генерации жалобы
  generateFallbackComplaint(documentData, agency) {
    return `Жалоба в ${agency}

Основание: ${documentData.summary || 'Нарушение прав заявителя'}

Дата документа: ${documentData.documentDate || 'не указана'}
Ведомство-отправитель: ${documentData.senderAgency || 'не указано'}

Уважаемые сотрудники ${agency}!

На основании полученного документа сообщаю о нарушении моих прав. 

Прошу:
1. Провести проверку по изложенным фактам
2. Принять меры по устранению нарушений
3. Уведомить меня о результатах рассмотрения

Приложение: копия документа от ${documentData.documentDate}

Дата: ${new Date().toLocaleDateString('ru-RU')}
Подпись: _________________`;
  }

  // Создание объекта жалобы
  createComplaintObject(mainDocData, agency, relatedDocsData, complaintResult, documentId) {
    return {
      id: uuidv4(),
      documentId: documentId || mainDocData.id,
      agency: agency,
      content: complaintResult.content,
      relatedDocuments: relatedDocsData.map(d => d.id),
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      analysis: {
        violations: mainDocData.violations || []
      }
    };
  }

  // Сохранение жалобы в БД
  async saveComplaintToDB(db, complaint, mainDocData) {
    try {
      // Инициализируем коллекцию жалоб если нет
      if (!db.data.complaints) {
        db.data.complaints = [];
      }
      
      // Добавляем жалобу
      db.data.complaints.push(complaint);
      
      // Обновляем документ если он есть в БД
      if (mainDocData.id && db.data.documents) {
        const doc = db.data.documents.find(d => d.id === mainDocData.id);
        if (doc) {
          if (!doc.complaints) {
            doc.complaints = [];
          }
          doc.complaints.push(complaint.id);
        }
      }
      
      // Сохраняем изменения
      await db.write();
      
    } catch (dbError) {
      console.error('Ошибка сохранения в БД:', dbError);
      throw new Error('Не удалось сохранить жалобу в базу данных');
    }
  }

  /**
   * @deprecated Устаревший метод. Используйте generateUnifiedComplaint вместо него.
   * Сохранен для обратной совместимости.
   */
  async generateComplaint(complaintData) {
    console.log("Использование старого метода generateComplaint");
    
    // Адаптируем старый формат к новому
    const requestData = {
      agency: complaintData.agency || "ФССП",
      currentDocument: complaintData.currentDocument || complaintData,
      relatedDocuments: complaintData.relatedDocuments || []
    };
    
    // Создаем mock db объекта для совместимости
    const mockDB = {
      data: {
        documents: [],
        complaints: []
      },
      write: () => Promise.resolve()
    };
    
    try {
      const result = await this.generateUnifiedComplaint(mockDB, requestData);
      return result;
    } catch (error) {
      console.error('Ошибка в generateComplaint:', error);
      return {
        content: this.generateFallbackComplaint(
          complaintData.currentDocument || complaintData, 
          complaintData.agency || "ФССП"
        )
      };
    }
  }
}

// Создаем экземпляр сервиса
const complaintService = new ComplaintService();

// Экспортируем методы для обратной совместимости
export const generateUnifiedComplaint = complaintService.generateUnifiedComplaint.bind(complaintService);

/**
 * @deprecated Устаревший метод. Используйте generateUnifiedComplaint вместо него.
 * Экспортируется для обратной совместимости.
 */
export const generateComplaint = complaintService.generateComplaint.bind(complaintService);

// Экспортируем класс для тестирования
export { ComplaintService };