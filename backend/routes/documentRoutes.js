import { Router } from 'express';
import express from 'express';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import iconv from 'iconv-lite';

import pdfService from '../services/pdfService.js';
import { fileURLToPath } from 'url';
import { analyzeText, analyzeDocument } from '../services/documentService.js';
import ChronicleService from '../services/chronicleService.js';
import { AIConfig } from '../config/aiConfig.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default function documentRoutes({ db, upload }) {
  const router = Router();
  
  // Создаем экземпляр ChronicleService
  const chronicleService = new ChronicleService(path.join(__dirname, '../dataBase/chronicle.json'));

  // Вспомогательная функция для генерации combinedText в том же формате, что и в documentService.js
  const generateCombinedText = (document) => {
    // Собираем весь текст для объединенного анализа
    let combinedText = `СПРАВКА ДЛЯ ИИ:
Вы — юрист, защищающий права отца-плательщика алиментов.
ВАША ЗАДАЧА:
1. Проанализировать ВСЕ представленные материалы.
2. Отличать субъективные пояснения пользователя от официальных документов.
3. Оценивать действия обеих сторон на соответствие законодательству РФ.
4. Выявлять нарушения со стороны госорганов, а также указывать, если пользователь сам нарушает закон.
5. Сформировать краткую суть, ключевые предложения, список нарушений и дневниковую запись.

ИНСТРУКЦИИ ПО ФОРМАТАМ:
- ПОЯСНЕНИЯ ПОЛЬЗОВАТЕЛЯ: субъективны, могут содержать эмоции, неточности, но отражают его восприятие ситуации.
- ОФИЦИАЛЬНЫЕ ДОКУМЕНТЫ: юридически значимы, но могут содержать ошибки, нарушения сроков, неправомерные действия.

ТЕКСТЫ ДЛЯ АНАЛИЗА:
`;

    let hasOriginalText = false;
    let hasAttachmentText = false;
    
    // Добавляем основной текст документа
    if (document.originalText && typeof document.originalText === 'string' && document.originalText.trim()) {
      combinedText += `
[НАЧАЛО ПОЯСНЕНИЙ ПОЛЬЗОВАТЕЛЯ]
${document.originalText.trim()}
[КОНЕЦ ПОЯСНЕНИЙ ПОЛЬЗОВАТЕЛЯ]
`;
      hasOriginalText = true;
    }
    
    // Добавляем тексты вложений
    if (Array.isArray(document.attachments) && document.attachments.length > 0) {
      for (const attachment of document.attachments) {
        if (attachment.text && typeof attachment.text === 'string' && attachment.text.trim()) {
          combinedText += `
[НАЧАЛО ОФИЦИАЛЬНОГО ДОКУМЕНТА: "${attachment.name || 'Без названия'}"]
${attachment.text.trim()}
[КОНЕЦ ОФИЦИАЛЬНОГО ДОКУМЕНТА]
`;
          hasAttachmentText = true;
        }
      }
    }
    
    // Возвращаем сгенерированный combinedText или сообщение о его отсутствии
    if (!hasOriginalText && !hasAttachmentText) {
      return "СПРАВКА: Ни пояснения пользователя, ни вложенные документы не содержат текста для анализа.";
    }
    
    return combinedText;
  };

  // Middleware для проверки JSON только для POST и PUT запросов с JSON телом
  // Так как express.json() уже применяется в app.mjs, здесь мы просто добавим дополнительную проверку
  router.use((req, res, next) => {
    if ((req.method === 'POST' || req.method === 'PUT') && req.is('application/json')) {
      // Если есть тело запроса и оно не является объектом, значит возникла ошибка парсинга
      if (req.body && typeof req.body !== 'object') {
        console.error('Invalid JSON body:', req.body);
        return res.status(400).json({ message: 'Invalid JSON' });
      }
    }
    next();
  });

  // Извлечение текста из файла
  const extractFileContent = async (file) => {
    console.log('Извлечение текста из файла:', file);
    if (file.mimetype === 'application/pdf') {
      const dataBuffer = await fs.readFile(file.path);
      const pdfData = await pdfService.extractTextFromPdf(dataBuffer);
      console.log('Извлеченный текст из PDF:', pdfData.text ? pdfData.text.substring(0, 100) + '...' : 'null');
      
      // Проверка типа текста из PDF
      if (pdfData.text !== undefined && pdfData.text !== null) {
        if (typeof pdfData.text === 'string') {
          return pdfData.text;
        } else {
          console.log("Предупреждение: текст из PDF не является строкой:", typeof pdfData.text);
          return String(pdfData.text);
        }
      }
      return "";
    } else if (file.mimetype === 'text/plain') {
      // Чтение файла в бинарном виде для определения кодировки
      const buffer = await fs.readFile(file.path);
      
      // Определяем кодировку и конвертируем в UTF-8
      // Попробуем сначала UTF-8
      let text;
      try {
        text = buffer.toString('utf-8');
        
        // Проверяем, есть ли подозрение на неправильную кодировку (например, крякозябры)
        // Если текст содержит много вопросительных знаков или непечатных символов, 
        // возможно, это ошибка кодировки
        const nonPrintableChars = text.match(/[^\x20-\x7E\x0A\x0D\x09\u0400-\u04FF\u00C0-\u017F]/g);
        if (nonPrintableChars && nonPrintableChars.length > text.length * 0.3) { // если больше 30% непечатных символов
          // Попробуем кодировку Windows-1251 для кириллицы
          text = iconv.decode(buffer, 'win1251');
        }
      } catch (error) {
        console.log("Ошибка декодирования UTF-8, пробуем win1251:", error.message);
        // Если UTF-8 не сработал, используем win1251
        text = iconv.decode(buffer, 'win1251');
      }
      
      console.log('Извлеченный текст из TXT:', text ? text.substring(0, 100) + '...' : 'null');
      
      // Проверка типа текста из TXT
      if (text !== undefined && text !== null) {
        if (typeof text === 'string') {
          return text;
        } else {
          console.log("Предупреждение: текст из TXT не является строкой:", typeof text);
          return String(text);
        }
      }
      return "";
    }
    throw new Error('Неподдерживаемый тип файла');
  };

  // Обработка загруженных файлов
  const processUploadedFiles = async (files, userText, userComments) => {
    console.log('Обработка загруженных файлов:', { files, userText, userComments });
    if (!files || files.length === 0) {
      throw new Error('Нет файлов для загрузки');
    }

    // Проверяем тип userText
    let validUserText = "";
    if (userText !== undefined && userText !== null) {
      if (typeof userText === 'string') {
        validUserText = userText;
      } else {
        console.log("Предупреждение: userText не является строкой:", typeof userText);
        validUserText = String(userText);
      }
    }

    const filesData = [];
    
    for (const file of files) {
      try {
        console.log('Обработка файла:', file);
        console.log('MIME-тип файла:', file.mimetype);
        const fileContent = await extractFileContent(file);
        console.log('Извлеченный текст из файла:', fileContent ? fileContent.substring(0, 100) + '...' : 'null');
        console.log('Длина текста файла:', fileContent ? fileContent.length : 0);
        
        console.log('Создание вложения с текстом:', fileContent ? fileContent.substring(0, 100) + '...' : 'null (length: ' + (fileContent ? fileContent.length : 0) + ')');
        const newDocument = {
          id: uuidv4(),
          date: new Date().toISOString().split('T')[0],
          fsspDepartment: '',
          originalText: validUserText, 
          summary: '',
          documentDate: '',
          senderAgency: '',
          keySentences: [],
          attachments: [{
            id: uuidv4(),
            name: Buffer.from(file.originalname, 'latin1').toString('utf8'), // Исправляем кодировку
            type: file.mimetype,
            size: file.size,
            path: `/uploads/${file.filename}`,
            text: fileContent || '', 
            analysis: null,
            documentDate: '',
            senderAgency: '',
            summary: '',
            keySentences: []
          }],
          complaints: [],
          analysisStatus: 'pending',
          lastAnalyzedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          violations: []
        };

        console.log('Созданный документ из файла:', newDocument);

        // Инициализация коллекции документов, если её нет
        if (!db.data) {
          db.data = {};
        }
        if (!db.data.documents) {
          db.data.documents = [];
        }

        db.data.documents.push(newDocument);
        await db.write();






        filesData.push(newDocument);
        try {
          await fs.unlink(file.path);
        } catch (unlinkError) {
          console.error(`Не удалось удалить временный файл ${file.path}:`, unlinkError);
          // Не прерываем выполнение, просто логируем ошибку
        }
      } catch (fileError) {
        console.error(`Ошибка обработки файла ${Buffer.from(file.originalname, 'latin1').toString('utf8')}:`, fileError);
        continue;
      }
    }

    console.log('Обработанные файлы:', filesData);
    return filesData;
  };

  // Обновление данных анализа
  const updateDocumentAnalysis = (doc, analysis) => {
    console.log("Обновление данных анализа для документа", doc.id);
    console.log("Анализ:", analysis);
    
    // Проверяем, что analysis является объектом
    if (!analysis || typeof analysis !== 'object') {
      console.log("Предупреждение: analysis не является объектом:", typeof analysis);
      // Используем пустой объект как значение по умолчанию
      analysis = {};
    }
    
    doc.summary = analysis.summary || doc.summary || "";
    doc.documentDate = analysis.documentDate || doc.documentDate || "";
    doc.senderAgency = analysis.senderAgency || doc.senderAgency || "";
    doc.keySentences = Array.isArray(analysis.keySentences) ? analysis.keySentences : 
                      (Array.isArray(doc.keySentences) ? doc.keySentences : []);
    // Добавляем обработку нарушений
    doc.violations = Array.isArray(analysis.violations) ? analysis.violations : 
                    (Array.isArray(doc.violations) ? doc.violations : []);
    // Сохраняем объединённый текст для отладки
    doc.combinedText = analysis.combinedText || doc.combinedText || "";
    doc.analysisStatus = 'completed';
    doc.lastAnalyzedAt = new Date().toISOString();
    doc.updatedAt = new Date().toISOString();
    // Сохраняем regionCode, чтобы он не потерялся при анализе
    // (regionCode устанавливается при создании/редактировании документа)
    doc.regionCode = doc.regionCode || "";
    console.log("Данные анализа обновлены для документа", doc.id);
    console.log('Saved combinedText:', doc.combinedText.substring(0, 200));
  };

  // Сохранение жалобы
  const saveComplaint = (doc, complaint) => {
    if (!db.data.complaints) {
      db.data.complaints = [];
    }
    db.data.complaints.push(complaint);

    if (!doc.complaints) {
      doc.complaints = [];
    }
    doc.complaints.push(complaint.id);
    doc.updatedAt = new Date().toISOString();
  };

  // Загрузка файлов для временного хранения (без создания документа в базе)
  router.post('/upload', upload.array('files'), async (req, res) => {
    try {
      // Проверка типа userText
      let userText = "";
      if (req.body.text !== undefined && req.body.text !== null) {
        if (typeof req.body.text === 'string') {
          userText = req.body.text;
        } else {
          console.log("Предупреждение: userText не является строкой:", typeof req.body.text);
          userText = String(req.body.text);
        }
      }
      
      const userComments = req.body.comments || "";
      console.log('Получены данные для загрузки:', { userText, userComments, files: req.files });

      // Если есть файлы для обработки
      if (req.files && req.files.length > 0) {
        const processedAttachments = [];
        
        for (const file of req.files) {
          try {
            console.log('Обработка файла:', file);
            console.log('MIME-тип файла:', file.mimetype);
            const fileContent = await extractFileContent(file);
            console.log('Извлеченный текст из файла:', fileContent ? fileContent.substring(0, 100) + '...' : 'null');
            console.log('Длина текста файла:', fileContent ? fileContent.length : 0);
            
            const attachment = {
              id: uuidv4(),
              name: Buffer.from(file.originalname, 'latin1').toString('utf8'), // Исправляем кодировку
              type: file.mimetype,
              size: file.size,
              path: `/uploads/${file.filename}`,
              text: fileContent || '', 
              analysis: null,
              documentDate: '',
              senderAgency: '',
              summary: '',
              keySentences: []
            };
            
            processedAttachments.push(attachment);
            
            // Удаляем временный файл
            try {
              await fs.unlink(file.path);
            } catch (unlinkError) {
              console.error(`Не удалось удалить временный файл ${file.path}:`, unlinkError);
              // Не прерываем выполнение, просто логируем ошибку
            }
          } catch (fileError) {
            console.error(`Ошибка обработки файла ${Buffer.from(file.originalname, 'latin1').toString('utf8')}:`, fileError);
            continue;
          }
        }
        
        // Возвращаем только обработанные вложения и текст, без создания документа в базе
        return res.status(201).json({
          attachments: processedAttachments,
          originalText: userText,
          comments: userComments
        });
      }
      
      // Если есть только текст без файлов
      if (userText) {
        return res.status(201).json({
          attachments: [],
          originalText: userText,
          comments: userComments
        });
      }
      
      // Если нет ни текста, ни файлов
      return res.status(400).json({ 
        message: 'Необходимо предоставить текст или файлы для загрузки' 
      });
    } catch (err) {
      console.error('Ошибка загрузки:', err);
      res.status(500).json({ 
        message: err.message || 'Ошибка сервера при обработке документа'
      });
    }
  });

  // Создание документа
  router.post('/', async (req, res) => {
    try {
      const docData = req.body;
      console.log('Получены данные для создания документа:', docData);
      
      // Базовая валидация структуры
      if (!docData.id) {
        docData.id = uuidv4();
      }
      if (!docData.date) {
        docData.date = new Date().toISOString().split('T')[0];
      }
      if (!docData.createdAt) {
        docData.createdAt = new Date().toISOString();
      }
      docData.updatedAt = new Date().toISOString();
      
      // Проверка и коррекция типов полей
      let validOriginalText = "";
      if (docData.originalText !== undefined && docData.originalText !== null) {
        if (typeof docData.originalText === 'string') {
          validOriginalText = docData.originalText;
        } else {
          console.log("Предупреждение: originalText не является строкой:", typeof docData.originalText);
          validOriginalText = String(docData.originalText);
        }
      }
      
      // Установка значений по умолчанию для отсутствующих полей
      const newDocument = {
        id: docData.id,
        date: docData.date,
        fsspDepartment: docData.fsspDepartment || '',
        regionCode: docData.regionCode || '',
        originalText: validOriginalText,
        summary: docData.summary || '',
        documentDate: docData.documentDate || '',
        senderAgency: docData.senderAgency || '',
        keySentences: Array.isArray(docData.keySentences) ? docData.keySentences : [],
        attachments: Array.isArray(docData.attachments) ? docData.attachments.map(att => {
          // Проверка и коррекция типов полей вложения
          let validAttachmentText = "";
          if (att.text !== undefined && att.text !== null) {
            if (typeof att.text === 'string') {
              validAttachmentText = att.text;
            } else {
              console.log("Предупреждение: attachment text не является строкой:", typeof att.text);
              validAttachmentText = String(att.text);
            }
          }
          
          return {
            id: att.id || uuidv4(),
            name: att.name || '',
            type: att.type || '',
            size: att.size || 0,
            path: att.path || '',
            text: validAttachmentText,
            analysis: att.analysis || null,
            documentDate: att.documentDate || '',
            senderAgency: att.senderAgency || '',
            summary: att.summary || '',
            keySentences: Array.isArray(att.keySentences) ? att.keySentences : []
          };
        }) : [],
        complaints: Array.isArray(docData.complaints) ? docData.complaints : [],
        analysisStatus: docData.analysisStatus || 'pending',
        lastAnalyzedAt: docData.lastAnalyzedAt || null,
        createdAt: docData.createdAt,
        updatedAt: docData.updatedAt,
        violations: Array.isArray(docData.violations) ? docData.violations : [],
        combinedText: docData.combinedText || generateCombinedText({
          originalText: docData.originalText || "",
          attachments: docData.attachments || []
        })
      };
      
      console.log('Созданный документ:', newDocument);
      
      // Инициализация коллекции документов, если её нет
      if (!db.data) {
        db.data = {};
      }
      if (!db.data.documents) {
        db.data.documents = [];
      }
      
      db.data.documents.push(newDocument);
      await db.write();
      
      

      
      res.status(201).json(newDocument);
    } catch (err) {
      console.error('Ошибка создания документа:', err);
      res.status(400).json({ message: err.message });
    }
  });

  // Получение списка документов
  router.get('/', async (req, res) => {
    try {
      await db.read();
      const { limit = 50, offset = 0 } = req.query;
      
      const documents = db.data.documents
        .slice(parseInt(offset), parseInt(offset) + parseInt(limit))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      res.json({
        total: db.data.documents.length,
        items: documents
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // Получение документа по ID
  router.get('/:id', async (req, res) => {
    try {
      const doc = db.data.documents.find(d => d.id === req.params.id);
      if (!doc) return res.status(404).json({ message: 'Документ не найден' });
      res.json(doc);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  

  // Удаление документа
  router.delete('/:id', async (req, res) => {
    try {
      await db.read();
      const initialLength = db.data.documents.length;
      db.data.documents = db.data.documents.filter(d => d.id !== req.params.id);
      
      if (db.data.documents.length === initialLength) {
        return res.status(404).json({ message: 'Document not found' });
      }
      
      await db.write();
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // Получение жалоб для документа
  router.get('/:id/complaints', async (req, res) => {
    try {
      const complaints = db.data.complaints?.filter(c => c.documentId === req.params.id) || [];
      res.json(complaints);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // Обновление документа
  router.put('/:id', async (req, res) => {
    try {
      console.log(`Получен запрос на обновление документа с ID: ${req.params.id}`);
      console.log('Данные для обновления:', req.body);
      
      const docIndex = db.data.documents.findIndex(d => d.id === req.params.id);
      if (docIndex === -1) {
        console.log(`Документ с ID ${req.params.id} не найден`);
        return res.status(404).json({ message: 'Document not found' });
      }
      
      // Глубокое объединение данных документа
      const existingDoc = db.data.documents[docIndex];
      const updateData = req.body;
      console.log('Существующий документ:', existingDoc);
      console.log('Данные для обновления:', updateData);
      
      // Проверка и коррекция типов полей
      let validOriginalText = existingDoc.originalText || "";
      if (updateData.originalText !== undefined && updateData.originalText !== null) {
        if (typeof updateData.originalText === 'string') {
          validOriginalText = updateData.originalText;
        } else {
          console.log("Предупреждение: originalText не является строкой:", typeof updateData.originalText);
          validOriginalText = String(updateData.originalText);
        }
      }
      
      // Создаем обновленный документ, начиная с копии существующего
      // Используем только известные поля, игнорируем неизвестные
      const updatedDoc = {
        ...existingDoc,
        // Обновляем простые поля (игнорируем неизвестные)
        id: updateData.id || existingDoc.id,
        date: updateData.date || existingDoc.date,
        fsspDepartment: updateData.fsspDepartment || existingDoc.fsspDepartment,
        regionCode: updateData.regionCode || existingDoc.regionCode,
        originalText: validOriginalText,
        summary: updateData.summary || existingDoc.summary,
        documentDate: updateData.documentDate || existingDoc.documentDate,
        senderAgency: updateData.senderAgency || existingDoc.senderAgency,
        keySentences: Array.isArray(updateData.keySentences) ? updateData.keySentences : existingDoc.keySentences,
        complaints: Array.isArray(updateData.complaints) ? updateData.complaints : existingDoc.complaints,
        analysisStatus: updateData.analysisStatus || existingDoc.analysisStatus,
        lastAnalyzedAt: updateData.lastAnalyzedAt || existingDoc.lastAnalyzedAt,
        createdAt: updateData.createdAt || existingDoc.createdAt,
        updatedAt: new Date().toISOString(),
        violations: Array.isArray(updateData.violations) ? updateData.violations : existingDoc.violations,
        // Обновляем вложения с глубоким объединением
        attachments: Array.isArray(updateData.attachments) ? 
          updateData.attachments.map(newAttachment => {
            // Ищем существующее вложение по ID
            const existingAttachment = existingDoc.attachments.find(a => a.id === newAttachment.id);
            if (existingAttachment) {
              // Проверка и коррекция типов полей вложения
              let validAttachmentText = existingAttachment.text || "";
              if (newAttachment.text !== undefined && newAttachment.text !== null) {
                if (typeof newAttachment.text === 'string') {
                  validAttachmentText = newAttachment.text;
                } else {
                  console.log("Предупреждение: attachment text не является строкой:", typeof newAttachment.text);
                  validAttachmentText = String(newAttachment.text);
                }
              }
              
              // Если вложение существует, объединяем данные
              return {
                ...existingAttachment,
                ...newAttachment,
                // Для вложенных объектов analysis также делаем объединение
                analysis: newAttachment.analysis ? {
                  ...existingAttachment.analysis,
                  ...newAttachment.analysis
                } : existingAttachment.analysis,
                // Убедимся, что текст корректный
                text: validAttachmentText
              };
            } else {
              // Если это новое вложение, добавляем его как есть
              // Убеждаемся, что у него есть все необходимые поля
              // Проверка и коррекция типов полей вложения
              let validNewAttachmentText = "";
              if (newAttachment.text !== undefined && newAttachment.text !== null) {
                if (typeof newAttachment.text === 'string') {
                  validNewAttachmentText = newAttachment.text;
                } else {
                  console.log("Предупреждение: new attachment text не является строкой:", typeof newAttachment.text);
                  validNewAttachmentText = String(newAttachment.text);
                }
              }
              
              return {
                id: newAttachment.id || uuidv4(),
                name: newAttachment.name || '',
                type: newAttachment.type || '',
                size: newAttachment.size || 0,
                path: newAttachment.path || '',
                text: validNewAttachmentText,
                analysis: newAttachment.analysis || null,
                documentDate: newAttachment.documentDate || '',
                senderAgency: newAttachment.senderAgency || '',
                summary: newAttachment.summary || '',
                keySentences: Array.isArray(newAttachment.keySentences) ? newAttachment.keySentences : []
              };
            }
          }) : existingDoc.attachments
      };
      
      console.log('Обновленный документ:', updatedDoc);
      
      db.data.documents[docIndex] = updatedDoc;
      
      await db.write();
      res.json(updatedDoc);
    } catch (err) {
      console.error('Ошибка обновления документа:', err);
      res.status(400).json({ message: err.message });
    }
  });

  // Анализ документа по ID (может быть как сохранённый, так и временный документ)
  router.post('/:id/analyze', async (req, res) => {
    try {
      console.log("Начало обработки запроса на анализ документа");
      const { id } = req.params;
      console.log("Параметры запроса:", req.params);
      
      // Корректная обработка типа для strictMode
      let { instructions = "", strictMode = false, model, originalText, attachments = [] } = req.body;
      console.log("Тело запроса:", req.body);
      
      // Преобразуем strictMode в boolean, если он пришел как строка
      if (typeof strictMode === 'string') {
        strictMode = strictMode.toLowerCase() === 'true';
      } else if (typeof strictMode !== 'boolean') {
        // Если strictMode не boolean и не строка, используем значение по умолчанию
        strictMode = false;
      }
      
      console.log(`Получен запрос на анализ документа с ID: ${id}`);
      console.log(`Параметры анализа: model=${model}, instructions=${instructions}, strictMode=${strictMode}`);
      
      // Проверка наличия БД
      if (!db || !db.data || !db.data.documents) {
        console.error("Ошибка: БД не инициализирована правильно");
        return res.status(500).json({ 
          message: 'Ошибка сервера: БД не инициализирована' 
        });
      }
      
      // Сначала проверяем, существует ли документ в базе данных
      let doc = db.data.documents.find(d => d.id === id);
      
      if (doc) {
        // Документ существует в базе данных
        console.log(`Найден документ в базе:`, {
          id: doc.id,
          hasOriginalText: !!doc.originalText,
          originalTextLength: doc.originalText ? doc.originalText.length : 0,
          attachmentsCount: doc.attachments ? doc.attachments.length : 0
        });
      } else {
        // Документ не существует в базе данных, используем данные из тела запроса
        console.log(`Документ с ID ${id} не найден в базе, используем данные из тела запроса`);
        
        // Проверяем, что основной текст и вложения переданы в теле запроса
        if (!originalText && (!attachments || !Array.isArray(attachments) || attachments.length === 0)) {
          return res.status(400).json({ 
            message: 'Для анализа временного документа обязательно должны быть переданы originalText или attachments',
            documentId: id
          });
        }
        
        // Создаем временный документ для анализа
        doc = {
          id: id,
          date: new Date().toISOString().split('T')[0],
          fsspDepartment: '',
          originalText: originalText || '',
          summary: '',
          documentDate: '',
          senderAgency: '',
          keySentences: [],
          attachments: attachments.map(att => ({
            id: att.id || uuidv4(),
            name: att.name || 'Без названия',
            type: att.type || '',
            size: att.size || 0,
            path: att.path || '',
            text: att.text || '',
            analysis: null,
            documentDate: '',
            senderAgency: '',
            summary: '',
            keySentences: []
          })),
          complaints: [],
          analysisStatus: 'pending',
          lastAnalyzedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          violations: []
        };
        
        console.log(`Создан временный документ для анализа:`, {
          id: doc.id,
          hasOriginalText: !!doc.originalText,
          originalTextLength: doc.originalText ? doc.originalText.length : 0,
          attachmentsCount: doc.attachments ? doc.attachments.length : 0
        });
      }
      
      // Проверяем, что документ содержит текст или вложения
      const hasOriginalText = doc.originalText && doc.originalText.trim().length > 0;
      const hasAttachmentsWithText = doc.attachments && doc.attachments.some(att => att.text && att.text.trim().length > 0);
      
      console.log(`Проверка содержимого: hasOriginalText=${hasOriginalText}, hasAttachmentsWithText=${hasAttachmentsWithText}`);
      
      if (!hasOriginalText && !hasAttachmentsWithText) {
        console.log(`Документ не содержит текста для анализа`);
        return res.status(400).json({ 
          message: 'Документ должен содержать текст или вложения с текстом для анализа',
          documentId: id
        });
      }
      
      // Обновление статуса, если документ существует в базе
      if (doc.id && db.data.documents.some(d => d.id === doc.id)) {
        doc.analysisStatus = 'processing';
        doc.updatedAt = new Date().toISOString();
        await db.write();
        console.log(`Статус документа обновлен на 'processing'`);
      }

      console.log("Вызов analyzeDocument");
      const analysisResult = await analyzeDocument(doc, instructions, strictMode);
      console.log("Результат analyzeDocument:", analysisResult);
      
      if (analysisResult.success) {
        // Если документ существует в базе, обновляем его
        if (doc.id && db.data.documents.some(d => d.id === doc.id)) {
          // Обновление документа в базе данных
          console.log("Вызов updateDocumentAnalysis");
          updateDocumentAnalysis(doc, analysisResult.data);
          await db.write();
          console.log(`Документ обновлен после анализа`);
        }

        // Создаем запись в летописи всегда при успешном анализе
        try {
          await chronicleService.createEntryForAnalyzedDocument(doc);
        } catch (chronicleErr) {
          console.error('Ошибка создания записи в летописи:', chronicleErr);
          // Не прерываем выполнение основного запроса из-за ошибки летописи
        }

        res.json({
          ...analysisResult.data,
          modelUsed: model || process.env.AI_MODEL || process.env.MODEL_NAME || "qwen3:30b",
          analyzedAt: doc.lastAnalyzedAt,
          combinedText: analysisResult.data.combinedText || doc.combinedText || ""
        });
      } else {
        throw new Error(analysisResult.error || "Неизвестная ошибка анализа");
      }
    } catch (err) {
      console.error(`Ошибка анализа документа:`, err);
      console.error("Стек ошибки:", err.stack);
      
      // Обновление статуса документа в случае ошибки (только если документ существует в базе)
      try {
        const { id } = req.params;
        if (db && db.data && db.data.documents) {
          const doc = db.data.documents.find(d => d.id === id);
          if (doc) {
            doc.analysisStatus = 'failed';
            doc.updatedAt = new Date().toISOString();
            await db.write();
          }
        }
      } catch (dbError) {
        console.error("Ошибка при обновлении статуса документа:", dbError);
      }
      
      res.status(500).json({ 
        message: 'Ошибка при анализе документа',
        error: err.message 
      });
    }
  });



  return router; 
}