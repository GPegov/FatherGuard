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
      const prompt = this.buildAIPrompt(mainDocData, relatedDocsData, agency);
      console.log('Отправка запроса к AI с промптом:', prompt.substring(0, 200) + '...');
      
      const response = await aiService.queryLocalModel(prompt, {
        temperature: 0.6,
        taskType: "complaint",
        format: "json"
      });
      
      return this.parseAIResponse(response);
      
    } catch (aiError) {
      console.error('Ошибка AI генерации:', aiError);
      // Возвращаем запасной вариант
      return {
        content: this.generateFallbackComplaint(mainDocData, agency)
      };
    }
  }

  // Построение промпта для AI
  buildAIPrompt(mainDocData, relatedDocsData, agency) {
    // Создаем структурированные данные для AI
    const analysisData = {
      task: "GENERATE_COMPLAINT",
      agency: agency,
      mainDocument: {
        summary: mainDocData.summary,
        keySentences: mainDocData.keySentences.slice(0, 10), // Ограничиваем количество
        violations: mainDocData.violations,
        documentDate: mainDocData.documentDate,
        senderAgency: mainDocData.senderAgency
      },
      hasRelatedDocuments: relatedDocsData.length > 0,
      relatedDocumentsCount: relatedDocsData.length
    };

    return `Ты - профессиональный юрист. Создай официальную жалобу в ${agency} от первого лица заявителя.

ОСНОВНЫЕ ДАННЫЕ:
${JSON.stringify(analysisData, null, 2)}

ИНСТРУКЦИИ:
1. Создай структурированную жалобу в формате делового письма от первого лица
2. Используй деловой стиль, строго по существу
3. Укажи конкретные нарушения законов
4. Сделай ссылки на статьи законов
5. Предложи конкретные требования
6. Не включай полный текст документа

Верни результат в формате JSON:
{
  "content": "текст жалобы"
}`;
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

  // Старый метод для обратной совместимости
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
export const generateComplaint = complaintService.generateComplaint.bind(complaintService);

// Экспортируем класс для тестирования
export { ComplaintService };









// import { v4 as uuidv4 } from 'uuid';
// import AIService from './aiService.js';

// // Создаем экземпляр AIService
// const aiService = new AIService();

// // Форматирование и создание объекта жалобы
// const formatComplaint = (doc, agency, relatedDocs, complaintResult, documentId) => {
//   return {
//     id: uuidv4(),
//     documentId: documentId || doc.id,
//     agency,
//     content: complaintResult.content,
//     relatedDocuments: relatedDocs.map(d => d.id),
//     status: 'draft',
//     createdAt: new Date().toISOString(),
//     updatedAt: new Date().toISOString(),
//     analysis: {
//       violations: complaintResult.violations || []
//     }
//   };
// };

// // Вспомогательный метод для генерации запасной жалобы
// const generateFallbackComplaint = (complaintData) => {
//   const doc = complaintData.currentDocument;
//   const agency = complaintData.agency || "ФССП";
  
//   // Определяем, какой формат данных мы получили
//   const isCurrentDocFormat = doc && doc.fullText !== undefined;
  
//   if (isCurrentDocFormat) {
//     // Новый формат данных
//     return "Жалоба в " + agency + "\n\n" +
//       "Документ: " + (doc.summary || "Без описания") + "\n" +
//       "Дата: " + new Date().toLocaleDateString() + "\n\n" +
//       "Текст: " + (doc.fullText ? doc.fullText.substring(0, 25000) : "Нет текста") + "...";
//   } else {
//     // Старый формат данных
//     return "Жалоба в " + agency + "\n\n" +
//       "Документ: " + (doc.summary || "Без описания") + "\n" +
//       "Дата: " + (doc.documentDate || "Не указана") + "\n\n" +
//       "Текст: " + (doc.originalText ? doc.originalText.substring(0, 25000) : "Нет текста") + "...";
//   }
// };

// // Создаем структурированный промпт для генерации жалобы
// const buildUnifiedComplaintPrompt = (complaintData) => {
//   // Создаем структурированный промт для генерации жалобы
//   const doc = complaintData.currentDocument;
//   const relatedDocs = complaintData.relatedDocuments || [];
//   const agency = complaintData.agency || "ФССП";
  
//   // Формируем основную информацию о документе
//   const documentInfo = {
//     agency: agency,
//     fullText: doc.fullText || doc.originalText || "",
//     summary: doc.summary || "",
//     keySentences: doc.keySentences || [],
//     violations: doc.violations || [],
//     documentDate: doc.documentDate || doc.date || "Не указана",
//     senderAgency: doc.senderAgency || ""
//   };
  
//   // Добавляем информацию о связанных документах
//   if (relatedDocs.length > 0) {
//     documentInfo.relatedDocuments = relatedDocs.map(relatedDoc => ({
//       fullText: relatedDoc.fullText || relatedDoc.originalText || "",
//       summary: relatedDoc.summary || "",
//       keySentences: relatedDoc.keySentences || [],
//       violations: relatedDoc.violations || [],
//       documentDate: relatedDoc.documentDate || relatedDoc.date || "Не указана",
//       senderAgency: relatedDoc.senderAgency || ""
//     }));
//   }
  
//   // Логирование для отладки
//   console.log('Текст для анализа:', (doc.fullText || doc.originalText || "").substring(0, 200) + '...');
  
//   // Создаем подробный промт для AI
//   return `Ты - профессиональный юрист. Создай официальную жалобу в ${agency} от первого лица заявителя.

// ИНСТРУКЦИИ:
// 1. Создай структурированную жалобу в формате делового письма строго от первого лица ("я", "меня", "мне")
// 2. Используй деловой стиль, строго и по существу
// 3. Укажи конкретные нарушения закона сотрудниками ${agency}
// 4. Сделай прямые ссылки на статьи закона, которые были нарушены
// 5. Предложи конкретные требования для устранения нарушений
// 6. Не включай полный текст документа или его краткую суть
// 7. Верни результат строго в формате JSON с полем "content"

// ДАННЫЕ ДЛЯ ЖАЛОБЫ:
// ${JSON.stringify(documentInfo, null, 2)}

// СГЕНЕРИРУЙ ЖАЛОБУ В ФОРМАТЕ JSON:
// {
//   "content": "текст жалобы строго от первого лица заявителя"
// }`;
// };

// // Новый универсальный метод для генерации жалоб
// const generateComplaint = async (complaintData) => {
//   console.log("Генерация жалобы из данных:", complaintData);
  
//   // Определяем, какой формат данных у нас есть
//   let preparedData;
//   if (complaintData.currentDocument) {
//     // Формат complaintData
//     preparedData = complaintData;
//   } else if (complaintData.fullText || complaintData.originalText) {
//     // Формат currentDocument
//     preparedData = {
//       currentDocument: complaintData,
//       relatedDocuments: complaintData.relatedDocuments || [],
//       agency: complaintData.agency || "ФССП"
//     };
//   } else {
//     // Неизвестный формат, создаем минимальную структуру
//     preparedData = {
//       currentDocument: {
//         fullText: complaintData.text || "",
//         summary: "",
//         keySentences: []
//       },
//       relatedDocuments: [],
//       agency: complaintData.agency || "ФССП"
//     };
//   }
  
//   try {
//     const prompt = buildUnifiedComplaintPrompt(preparedData);
//     console.log("Сформированный промт для генерации жалобы:", prompt);
    
//     // Используем aiService для генерации жалобы
//     const response = await aiService.queryLocalModel(prompt, {
//       temperature: 0.6,
//       taskType: "complaint",
//       format: "json"
//     });
    
//     console.log("Ответ от AI-модели:", response);
    
//     // Обработка ответа от модели
//     let content = "";
    
//     if (response) {
//       if (typeof response === 'string') {
//         // Если ответ - строка, пытаемся найти JSON в строке
//         const jsonMatch = response.match(/\{[\s\S]*\}/);
//         if (jsonMatch) {
//           try {
//             const parsed = JSON.parse(jsonMatch[0]);
//             content = parsed.content || parsed.complaint || parsed.text || jsonMatch[0];
//           } catch (e) {
//             content = response;
//           }
//         } else {
//           content = response;
//         }
//       } else if (typeof response === 'object') {
//         // Если ответ - объект, пытаемся извлечь содержимое
//         content = response.content || 
//                   response.complaint || 
//                   response.text || 
//                   JSON.stringify(response, null, 2);
//       }
//     }
    
//     // Если контент пустой или содержит только JSON, генерируем жалобу по умолчанию
//     if (!content || content.trim() === "{}" || content.trim().startsWith("{")) {
//       content = generateFallbackComplaint(preparedData);
//     }
    
//     return {
//       content: content
//     };
//   } catch (error) {
//     console.error("Ошибка генерации жалобы:", error);
//     // Если основная генерация не удалась, создаем запасную жалобу
//     return {
//       content: generateFallbackComplaint(preparedData)
//     };
//   }
// };

// // Унифицированный метод генерации жалобы
// const generateUnifiedComplaint = async (db, requestData) => {
//   const { documentId, agency, currentDocument, relatedDocuments } = requestData;
  
//   // Проверка обязательных полей
//   if (!agency) {
//     throw new Error('Не указано ведомство');
//   }

//   // Если переданы полные данные документов, используем их
//   if (currentDocument && (currentDocument.fullText || currentDocument.originalText)) {
//     console.log('Используем переданные данные документов для генерации жалобы');
    
//     // Подготовка данных для генерации жалобы
//     const complaintData = {
//       currentDocument: currentDocument,
//       relatedDocuments: relatedDocuments || [],
//       agency: agency
//     };
    
//     // Генерация жалобы через AI сервис
//     let complaintResult;
//     try {
//       console.log('Вызов AI сервиса для генерации жалобы с переданными данными');
//       complaintResult = await generateComplaint(complaintData);
//       console.log('Результат от AI сервиса:', complaintResult);
//     } catch (aiError) {
//       console.error('Ошибка генерации жалобы через AI:', aiError);
//       // Если AI не сработал, используем запасной вариант
//       complaintResult = await generateComplaint({
//         currentDocument: currentDocument,
//         agency: agency
//       });
//     }

//     // Если documentId не передан, ищем документ по тексту
//     let doc = null;
//     if (documentId) {
//       doc = db.data.documents.find(d => d.id === documentId);
//     } else {
//       doc = db.data.documents.find(d => d.originalText === (currentDocument.fullText || currentDocument.originalText));
//     }
    
//     // Если документ найден, получаем связанные документы
//     let relatedDocs = [];
//     if (doc) {
//       relatedDocs = db.data.documents.filter(d => 
//         d.id !== doc.id && d.date <= doc.date
//       );
//     } else if (relatedDocuments) {
//       // Если документ не найден, но переданы связанные документы, используем их
//       relatedDocs = relatedDocuments;
//     }

//     // Создание объекта жалобы
//     const complaint = formatComplaint(
//       doc || { id: documentId || uuidv4() },
//       agency,
//       relatedDocs,
//       complaintResult,
//       documentId
//     );

//     // Сохранение в БД
//     if (!db.data.complaints) {
//       db.data.complaints = [];
//     }
//     db.data.complaints.push(complaint);
//     await db.write();
//     console.log('Жалоба сохранена в БД');

//     // Обновление документа, если он найден
//     if (doc) {
//       if (!doc.complaints) {
//         doc.complaints = [];
//       }
//       doc.complaints.push(complaint.id);
//       await db.write();
//       console.log('Документ обновлен');
//     }

//     return complaint;
//   }

//   // Если данные документов не переданы, используем логику с поиском документов в БД
//   console.log('Используем логику с поиском документов в БД');
  
//   // Поиск документа
//   const doc = db.data.documents.find(d => d.id === documentId);
//   console.log('Найден документ:', doc);
//   if (!doc) {
//     throw new Error('Document not found');
//   }

//   // Поиск связанных документов
//   const relatedDocs = db.data.documents.filter(d => 
//     d.id !== documentId && d.date <= doc.date
//   );
//   console.log('Связанные документы:', relatedDocs);

//   // Подготовка данных предыдущих документов
//   const relatedDocData = relatedDocs.map(d => ({
//     fullText: d.originalText || d.fullText || '',
//     summary: d.summary || '',
//     keySentences: d.keySentences || [],
//     documentDate: d.documentDate || '',
//     senderAgency: d.senderAgency || '',
//     violations: d.violations || []
//   }));
//   console.log('Подготовленные данные связанных документов:', relatedDocData);

//   // Подготовка данных для AI-модели
//   const aiRequestData = {
//     currentDocument: {
//       fullText: doc.originalText,
//       summary: doc.summary || '',
//       keySentences: doc.keySentences || [],
//       documentDate: doc.documentDate || '',
//       senderAgency: doc.senderAgency || '',
//       violations: doc.violations || []
//     },
//     relatedDocuments: relatedDocData,
//     agency: agency
//   };
  
//   console.log('Данные для AI-модели:', JSON.stringify(aiRequestData, null, 2));

//   // Генерация жалобы через AI сервис
//   let complaintResult;
//   try {
//     console.log('Вызов AI сервиса для генерации жалобы');
//     complaintResult = await generateComplaint(aiRequestData);
//     console.log('Результат от AI сервиса:', complaintResult);
//   } catch (aiError) {
//     console.error('Ошибка генерации жалобы через AI:', aiError);
//     // Если AI не сработал, используем запасной вариант
//     complaintResult = await generateComplaint({
//       currentDocument: doc,
//       agency: agency
//     });
//   }

//   // Создание объекта жалобы
//   const complaint = formatComplaint(doc, agency, relatedDocs, complaintResult, documentId);
//   console.log('Создан объект жалобы:', complaint);

//   // Сохранение в БД
//   if (!db.data.complaints) {
//     db.data.complaints = [];
//   }
//   db.data.complaints.push(complaint);
//   await db.write();
//   console.log('Жалоба сохранена в БД');

//   // Обновление документа
//   if (!doc.complaints) {
//     doc.complaints = [];
//   }
//   doc.complaints.push(complaint.id);
//   await db.write();
//   console.log('Документ обновлен');

//   return complaint;
// };

// export { generateUnifiedComplaint };