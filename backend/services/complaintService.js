import { v4 as uuidv4 } from 'uuid';
import AIService from './aiService.js';
import ejs from 'ejs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { aiService } from './documentService.js';

// Получаем __dirname в ES модулях
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Используем общий экземпляр AIService из documentService

class ComplaintService {
  constructor() {
    this.generateComplaint = this.generateComplaint.bind(this);
    this.generateUnifiedComplaint = this.generateUnifiedComplaint.bind(this);
    this.renderComplaintTemplate = this.renderComplaintTemplate.bind(this);
    this.getTemplatePath = this.getTemplatePath.bind(this);
    this.prepareTemplateData = this.prepareTemplateData.bind(this);
  }

  // ЕДИНСТВЕННЫЙ унифицированный метод для генерации жалоб
  async generateUnifiedComplaint(db, requestData) {
    try {
      console.log('Генерация жалобы из данных:', requestData);
      console.log('requestData.agency:', requestData.agency);
      console.log('requestData.data?.agency:', requestData.data?.agency);
      console.log('requestData.options?.agency:', requestData.options?.agency);
      
      // Проверим все возможные значения, связанные с agency
      console.log('Все ключи requestData:', Object.keys(requestData));
      console.log('Полный requestData.agency typeof:', typeof requestData.agency);
      
      // Поддержка разных форматов запроса
      // Определяем agency из разных возможных источников
      let agency = requestData.agency || requestData.data?.agency || requestData.options?.agency;
      console.log('Итоговое значение agency:', agency);
      
      // Если агентство все еще не определено, используем запасной вариант
      if (!agency) {
        console.log('Агентство не найдено в обычных полях, ищем в других возможных местах...');
        
        // Попробуем найти агентство в других возможных местах
        if (requestData.documentId && db.data.documents) {
          const doc = db.data.documents.find(d => d.id === requestData.documentId);
          if (doc && doc.fsspDepartment) {
            agency = doc.fsspDepartment;
            console.log('Агентство найдено из документа:', agency);
          }
        }
      }
      
      // Проверим, если agency - это объект, возможно, нужно извлечь значение из него
      if (agency && typeof agency === 'object' && agency.value) {
        agency = agency.value;
        console.log('Извлечено agency из объекта:', agency);
      }
      
      const { documentId, currentDocument, relatedDocuments } = requestData;
      
      // Проверка обязательных полей
      if (!agency) {
        console.error('Агентство не найдено ни в одном источнике!');
        console.error('Полный requestData:', requestData);
        throw new Error('Не указано ведомство');
      }

      // Получаем данные основного документа
      const mainDocData = await this.getMainDocumentData(db, documentId, currentDocument);
      
      // Получаем данные связанных документов
      const relatedDocsData = await this.getRelatedDocumentsData(db, documentId, mainDocData, relatedDocuments);
      
      // Генерируем жалобу через AI
      const complaintResult = await this.generateWithAI(mainDocData, relatedDocsData, agency);
      
      // Генерируем жалобу через шаблон
      const templateData = this.prepareTemplateData(mainDocData, relatedDocsData, agency, complaintResult);
      const templatedComplaint = await this.renderComplaintTemplate(agency, templateData);
      
      // Создаем и сохраняем объект жалобы
      const complaint = this.createComplaintObject(mainDocData, agency, relatedDocsData, complaintResult, documentId, templatedComplaint);
      
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
      senderAgency: doc.senderAgency || doc.fsspDepartment || '',
      date: doc.date || new Date().toISOString().split('T')[0],
      agency: doc.fsspDepartment || ''
    };
  }

  async generateWithAI(mainDocData, relatedDocsData, agency) {
    try {
      console.log("=== НАЧАЛО GENERATE WITH AI ===");
      const analysisData = {
        summary: mainDocData.summary,
        keySentences: mainDocData.keySentences,
        violations: mainDocData.violations,
        documentDate: mainDocData.documentDate,
        senderAgency: mainDocData.senderAgency,
        attachments: relatedDocsData
      };

      console.log('Отправка запроса к AI для генерации жалобы...');
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

      // ЕДИНСТВЕННЫЙ ВЫЗОВ — через aiService
      const response = await aiService.generateComplaint(analysisData, agency, 'user_explanation');

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

  // Резервный механизм генерации при ошибках шаблонизации
  async generateFallbackWithTemplate(documentData, relatedDocsData, agency) {
    try {
      // Подготавливаем минимальные данные для шаблона
      const templateData = {
        complaintDate: new Date().toLocaleDateString('ru-RU'),
        recipient: agency || 'Государственный орган',
        recipientPosition: 'Должностному лицу',
        recipientAddress: '127994, г. Москва, ул. Щепкина, д. 8',
        fsspDepartment: agency && agency.includes('ФССП') ? agency : '',
        applicantFullName: documentData.applicantFullName || 'Не указано',
        applicantAddress: documentData.applicantAddress || 'Не указано',
        applicantPhone: documentData.applicantPhone || 'Не указано',
        applicantEmail: documentData.applicantEmail || 'Не указано',
        documentDate: documentData.documentDate || new Date().toISOString().split('T')[0],
        documentNumber: documentData.documentNumber || 'Не указано',
        documentAgency: documentData.senderAgency || agency || 'Не указано',
        documentSummary: documentData.summary || 'Не указано',
        violations: documentData.violations || [],
        legalReferences: documentData.legalReferences || [],
        requirements: documentData.requirements || [],
        attachments: relatedDocsData.map(doc => {
          return {
            date: doc.documentDate || 'Не указана',
            summary: doc.summary || 'Не указано'
          };
        }),
        complaintNumber: `ФГ-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
        executiveProductionNumber: documentData.executiveProductionNumber || ''
      };

      // Пытаемся использовать шаблон
      const templatedComplaint = await this.renderComplaintTemplate(agency, templateData);
      return {
        content: this.generateFallbackComplaint(documentData, agency),
        templatedContent: templatedComplaint
      };
    } catch (error) {
      console.error('Ошибка резервного механизма генерации:', error);
      // Если шаблон не работает, возвращаем только текстовую жалобу
      return {
        content: this.generateFallbackComplaint(documentData, agency)
      };
    }
  }

  // Создание объекта жалобы
  createComplaintObject(mainDocData, agency, relatedDocsData, complaintResult, documentId, templatedComplaint = null) {
    return {
      id: uuidv4(),
      documentId: documentId || mainDocData.id,
      agency: agency,
      content: complaintResult.content,
      templatedContent: templatedComplaint,
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

  // Получение пути к шаблону в зависимости от типа органа
  getTemplatePath(agency) {
    const templatesDir = path.join(__dirname, '..', 'templates');
    
    // Определяем шаблон в зависимости от типа органа
    if (agency && agency.toLowerCase().includes('фссп')) {
      return path.join(templatesDir, 'fssp-complaint.ejs');
    } else {
      return path.join(templatesDir, 'official-complaint.ejs');
    }
  }

  // Подготовка данных для шаблона
  prepareTemplateData(mainDocData, relatedDocsData, agency, complaintResult) {
    const currentDate = new Date().toLocaleDateString('ru-RU');
    
    // Основные данные заявителя (можно расширить)
    const applicantData = {
      fullName: mainDocData.applicantFullName || 'Не указано',
      address: mainDocData.applicantAddress || 'Не указано',
      phone: mainDocData.applicantPhone || 'Не указано',
      email: mainDocData.applicantEmail || 'Не указано'
    };

    // Данные документа
    const documentData = {
      date: mainDocData.documentDate || new Date().toISOString().split('T')[0],
      number: mainDocData.documentNumber || 'Не указано',
      agency: mainDocData.senderAgency || agency || 'Не указано',
      summary: mainDocData.summary || 'Не указано',
      violations: mainDocData.violations || []
    };

    // Связанные документы
    const attachments = relatedDocsData.map(doc => {
      return {
        date: doc.documentDate || 'Не указана',
        summary: doc.summary || 'Не указано'
      };
    });

    // Подготавливаем данные для шаблона
    return {
      complaintDate: currentDate,
      recipient: this.getRecipientForAgency(agency),
      recipientPosition: this.getRecipientPositionForAgency(agency),
      recipientAddress: this.getRecipientAddressForAgency(agency),
      fsspDepartment: agency.includes('ФССП') ? agency : '',
      applicantFullName: applicantData.fullName,
      applicantAddress: applicantData.address,
      applicantPhone: applicantData.phone,
      applicantEmail: applicantData.email,
      documentDate: documentData.date,
      documentNumber: documentData.number,
      documentAgency: documentData.fsspDepartment,
      documentSummary: documentData.summary,
      violations: documentData.violations,
      legalReferences: mainDocData.legalReferences || [],
      requirements: mainDocData.requirements || [],
      attachments: attachments,
      complaintNumber: `ФГ-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
      executiveProductionNumber: mainDocData.executiveProductionNumber || ''
    };
  }

  // Получение получателя в зависимости от органа
  getRecipientForAgency(agency) {
    if (agency && agency.toLowerCase().includes('фссп')) {
      return 'Федеральная служба судебных приставов';
    } else {
      return agency || 'Государственный орган';
    }
  }

  // Получение должности получателя в зависимости от органа
  getRecipientPositionForAgency(agency) {
    if (agency && agency.toLowerCase().includes('фссп')) {
      return 'Начальнику управления';
    } else {
      return 'Должностному лицу';
    }
  }

  // Получение адреса получателя в зависимости от органа
  getRecipientAddressForAgency(agency) {
    // В реальной реализации здесь должна быть логика определения адреса
    // в зависимости от конкретного органа. Пока возвращаем общий адрес.
    return '127994, г. Москва, ул. Щепкина, д. 8';
  }

  // Рендеринг шаблона жалобы
  async renderComplaintTemplate(agency, templateData) {
    try {
      const templatePath = this.getTemplatePath(agency);
      
      // Проверяем существование шаблона
      if (!fs.existsSync(templatePath)) {
        throw new Error(`Шаблон не найден: ${templatePath}`);
      }

      // Рендерим шаблон с данными
      const renderedHtml = await ejs.renderFile(templatePath, { data: templateData });
      return renderedHtml;
    } catch (error) {
      console.error('Ошибка рендеринга шаблона:', error);
      throw error;
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
      // Пытаемся сгенерировать через шаблон
      try {
        const templateData = this.prepareTemplateData(
          complaintData.currentDocument || complaintData, 
          complaintData.relatedDocuments || [], 
          complaintData.agency || "ФССП", 
          {}
        );
        const templatedComplaint = await this.renderComplaintTemplate(
          complaintData.agency || "ФССП", 
          templateData
        );
        return {
          content: this.generateFallbackComplaint(
            complaintData.currentDocument || complaintData, 
            complaintData.agency || "ФССП"
          ),
          templatedContent: templatedComplaint
        };
      } catch (templateError) {
        console.error('Ошибка генерации шаблона в generateComplaint:', templateError);
        return {
          content: this.generateFallbackComplaint(
            complaintData.currentDocument || complaintData, 
            complaintData.agency || "ФССП"
          )
        };
      }
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