import { v4 as uuidv4 } from 'uuid';
import AIService from './aiService.js';

// Создаем экземпляр AIService
const aiService = new AIService();

// Форматирование и создание объекта жалобы
const formatComplaint = (doc, agency, relatedDocs, complaintResult, documentId) => {
  return {
    id: uuidv4(),
    documentId: documentId || doc.id,
    agency,
    content: complaintResult.content,
    relatedDocuments: relatedDocs.map(d => d.id),
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    analysis: {
      violations: complaintResult.violations || []
    }
  };
};

// Вспомогательный метод для генерации запасной жалобы
const generateFallbackComplaint = (complaintData) => {
  const doc = complaintData.currentDocument;
  const agency = complaintData.agency || "ФССП";
  
  // Определяем, какой формат данных мы получили
  const isCurrentDocFormat = doc && doc.fullText !== undefined;
  
  if (isCurrentDocFormat) {
    // Новый формат данных
    return "Жалоба в " + agency + "\n\n" +
      "Документ: " + (doc.summary || "Без описания") + "\n" +
      "Дата: " + new Date().toLocaleDateString() + "\n\n" +
      "Текст: " + (doc.fullText ? doc.fullText.substring(0, 25000) : "Нет текста") + "...";
  } else {
    // Старый формат данных
    return "Жалоба в " + agency + "\n\n" +
      "Документ: " + (doc.summary || "Без описания") + "\n" +
      "Дата: " + (doc.documentDate || "Не указана") + "\n\n" +
      "Текст: " + (doc.originalText ? doc.originalText.substring(0, 25000) : "Нет текста") + "...";
  }
};

// Создаем структурированный промпт для генерации жалобы
const buildUnifiedComplaintPrompt = (complaintData) => {
  // Создаем структурированный промт для генерации жалобы
  const doc = complaintData.currentDocument;
  const relatedDocs = complaintData.relatedDocuments || [];
  const agency = complaintData.agency || "ФССП";
  
  // Формируем основную информацию о документе
  const documentInfo = {
    agency: agency,
    violations: doc.violations || [],
    documentDate: doc.documentDate || doc.date || "Не указана"
  };
  
  // Добавляем информацию о связанных документах
  if (relatedDocs.length > 0) {
    documentInfo.relatedDocuments = relatedDocs.map(relatedDoc => ({
      violations: relatedDoc.violations || []
    }));
  }
  
  // Создаем подробный промт для AI
  return `Ты - профессиональный юрист. Создай официальную жалобу в ${agency} от первого лица заявителя.

ИНСТРУКЦИИ:
1. Создай структурированную жалобу в формате делового письма строго от первого лица ("я", "меня", "мне")
2. Используй деловой стиль, строго и по существу
3. Укажи конкретные нарушения закона сотрудниками ${agency}
4. Сделай прямые ссылки на статьи закона, которые были нарушены
5. Предложи конкретные требования для устранения нарушений
6. Не включай полный текст документа или его краткую суть
7. Верни результат строго в формате JSON с полем "content"

ДАННЫЕ ДЛЯ ЖАЛОБЫ:
${JSON.stringify(documentInfo, null, 2)}

СГЕНЕРИРУЙ ЖАЛОБУ В ФОРМАТЕ JSON:
{
  "content": "текст жалобы строго от первого лица заявителя"
}`;
};

// Новый универсальный метод для генерации жалоб
const generateComplaint = async (complaintData) => {
  console.log("Генерация жалобы из данных:", complaintData);
  
  // Определяем, какой формат данных у нас есть
  let preparedData;
  if (complaintData.currentDocument) {
    // Формат complaintData
    preparedData = complaintData;
  } else if (complaintData.fullText || complaintData.originalText) {
    // Формат currentDocument
    preparedData = {
      currentDocument: complaintData,
      relatedDocuments: complaintData.relatedDocuments || [],
      agency: complaintData.agency || "ФССП"
    };
  } else {
    // Неизвестный формат, создаем минимальную структуру
    preparedData = {
      currentDocument: {
        fullText: complaintData.text || "",
        summary: "",
        keySentences: []
      },
      relatedDocuments: [],
      agency: complaintData.agency || "ФССП"
    };
  }
  
  try {
    const prompt = buildUnifiedComplaintPrompt(preparedData);
    console.log("Сформированный промт для генерации жалобы:", prompt);
    
    // Используем aiService для генерации жалобы
    const response = await aiService.queryLocalModel(prompt, {
      temperature: 0.6,
      taskType: "complaint",
      format: "json"
    });
    
    console.log("Ответ от AI-модели:", response);
    
    // Обработка ответа от модели
    let content = "";
    
    if (response) {
      if (typeof response === 'string') {
        // Если ответ - строка, пытаемся найти JSON в строке
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            content = parsed.content || parsed.complaint || parsed.text || jsonMatch[0];
          } catch (e) {
            content = response;
          }
        } else {
          content = response;
        }
      } else if (typeof response === 'object') {
        // Если ответ - объект, пытаемся извлечь содержимое
        content = response.content || 
                  response.complaint || 
                  response.text || 
                  JSON.stringify(response, null, 2);
      }
    }
    
    // Если контент пустой или содержит только JSON, генерируем жалобу по умолчанию
    if (!content || content.trim() === "{}" || content.trim().startsWith("{")) {
      content = generateFallbackComplaint(preparedData);
    }
    
    return {
      content: content
    };
  } catch (error) {
    console.error("Ошибка генерации жалобы:", error);
    // Если основная генерация не удалась, создаем запасную жалобу
    return {
      content: generateFallbackComplaint(preparedData)
    };
  }
};

// Унифицированный метод генерации жалобы
const generateUnifiedComplaint = async (db, requestData) => {
  const { documentId, agency, currentDocument, relatedDocuments } = requestData;
  
  // Проверка обязательных полей
  if (!agency) {
    throw new Error('Не указано ведомство');
  }

  // Если переданы полные данные документов, используем их
  if (currentDocument) {
    console.log('Используем переданные данные документов для генерации жалобы');
    
    // Подготовка данных для генерации жалобы
    const complaintData = {
      currentDocument: currentDocument,
      relatedDocuments: relatedDocuments || [],
      agency: agency
    };
    
    // Генерация жалобы через AI сервис
    let complaintResult;
    try {
      console.log('Вызов AI сервиса для генерации жалобы с переданными данными');
      complaintResult = await generateComplaint(complaintData);
      console.log('Результат от AI сервиса:', complaintResult);
    } catch (aiError) {
      console.error('Ошибка генерации жалобы через AI:', aiError);
      // Если AI не сработал, используем запасной вариант
      complaintResult = await generateComplaint({
        currentDocument: currentDocument,
        agency: agency
      });
    }

    // Если documentId не передан, ищем документ по тексту
    let doc = null;
    if (documentId) {
      doc = db.data.documents.find(d => d.id === documentId);
    } else {
      doc = db.data.documents.find(d => d.originalText === currentDocument.fullText);
    }
    
    // Если документ найден, получаем связанные документы
    let relatedDocs = [];
    if (doc) {
      relatedDocs = db.data.documents.filter(d => 
        d.id !== doc.id && d.date <= doc.date
      );
    } else if (relatedDocuments) {
      // Если документ не найден, но переданы связанные документы, используем их
      relatedDocs = relatedDocuments;
    }

    // Создание объекта жалобы
    const complaint = formatComplaint(
      doc || { id: documentId || uuidv4() },
      agency,
      relatedDocs,
      complaintResult,
      documentId
    );

    // Сохранение в БД
    if (!db.data.complaints) {
      db.data.complaints = [];
    }
    db.data.complaints.push(complaint);
    await db.write();
    console.log('Жалоба сохранена в БД');

    // Обновление документа, если он найден
    if (doc) {
      if (!doc.complaints) {
        doc.complaints = [];
      }
      doc.complaints.push(complaint.id);
      await db.write();
      console.log('Документ обновлен');
    }

    return complaint;
  }

  // Если данные документов не переданы, используем логику с поиском документов в БД
  console.log('Используем логику с поиском документов в БД');
  
  // Поиск документа
  const doc = db.data.documents.find(d => d.id === documentId);
  console.log('Найден документ:', doc);
  if (!doc) {
    throw new Error('Document not found');
  }

  // Поиск связанных документов
  const relatedDocs = db.data.documents.filter(d => 
    d.id !== documentId && d.date <= doc.date
  );
  console.log('Связанные документы:', relatedDocs);

  // Подготовка данных предыдущих документов
  const relatedDocData = relatedDocs.map(d => ({
    fullText: d.originalText || d.fullText || '',
    summary: d.summary || '',
    keySentences: d.keySentences || []
  }));
  console.log('Подготовленные данные связанных документов:', relatedDocData);

  // Подготовка данных для AI-модели
  const aiRequestData = {
    currentDocument: {
      fullText: doc.originalText,
      summary: doc.summary || '',
      keySentences: doc.keySentences || []
    },
    relatedDocuments: relatedDocData,
    agency: agency
  };
  
  console.log('Данные для AI-модели:', JSON.stringify(aiRequestData, null, 2));

  // Генерация жалобы через AI сервис
  let complaintResult;
  try {
    console.log('Вызов AI сервиса для генерации жалобы');
    complaintResult = await generateComplaint(aiRequestData);
    console.log('Результат от AI сервиса:', complaintResult);
  } catch (aiError) {
    console.error('Ошибка генерации жалобы через AI:', aiError);
    // Если AI не сработал, используем запасной вариант
    complaintResult = await generateComplaint({
      currentDocument: doc,
      agency: agency
    });
  }

  // Создание объекта жалобы
  const complaint = formatComplaint(doc, agency, relatedDocs, complaintResult, documentId);
  console.log('Создан объект жалобы:', complaint);

  // Сохранение в БД
  if (!db.data.complaints) {
    db.data.complaints = [];
  }
  db.data.complaints.push(complaint);
  await db.write();
  console.log('Жалоба сохранена в БД');

  // Обновление документа
  if (!doc.complaints) {
    doc.complaints = [];
  }
  doc.complaints.push(complaint.id);
  await db.write();
  console.log('Документ обновлен');

  return complaint;
};

export { generateUnifiedComplaint };