import { Router } from 'express';
import express from 'express';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';

import pdfService from '../services/pdfService.js';
import { fileURLToPath } from 'url';
import { analyzeText, analyzeDocument, analyzeAttachment } from '../services/documentService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default function documentRoutes({ db, upload }) {
  const router = Router();

  // Middleware для проверки JSON только для POST и PUT запросов с JSON телом
  router.use((req, res, next) => {
    if ((req.method === 'POST' || req.method === 'PUT') && req.is('application/json')) {
      express.json({
        verify: (req, res, buf, encoding) => {
          try {
            if (buf.length > 0) {
              JSON.parse(buf.toString());
            }
          } catch (e) {
            console.error('Invalid JSON:', buf.toString());
            // Отправляем ошибку и завершаем обработку
            res.status(400).json({ message: 'Invalid JSON' });
            // Не выбрасываем ошибку, а просто возвращаемся
            return;
          }
        }
      })(req, res, next);
    } else {
      next();
    }
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
      const text = await fs.readFile(file.path, 'utf-8');
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
        const fileContent = await extractFileContent(file);
        console.log('Извлеченный текст из файла:', fileContent ? fileContent.text.substring(0, 100) + '...' : 'null');
        
        // Комбинируем пользовательский текст и текст из файла
        // Если пользовательский текст пуст, используем только текст из файла
        // Если текст из файла пуст, используем только пользовательский текст
        const combinedText = [validUserText, fileContent].filter(Boolean).join('');
        console.log('Комбинированный текст:', combinedText ? combinedText.substring(0, 100) + '...' : 'null');

        const newDocument = {
          id: uuidv4(),
          date: new Date().toISOString().split('T')[0],
          agency: '',
          originalText: combinedText || '', 
          summary: '',
          documentDate: '',
          senderAgency: '',
          keySentences: [],
          attachments: [{
            id: uuidv4(),
            name: file.originalname,
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
        console.error(`Ошибка обработки файла ${file.originalname}:`, fileError);
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
    doc.analysisStatus = 'completed';
    doc.lastAnalyzedAt = new Date().toISOString();
    doc.updatedAt = new Date().toISOString();
    console.log("Данные анализа обновлены для документа", doc.id);
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

  // Загрузка документа (текст + файлы)
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

      // Обработка только текста
      if (userText && (!req.files || req.files.length === 0)) {
        const newDocument = {
          id: uuidv4(),
          date: new Date().toISOString().split('T')[0],
          agency: '',
          originalText: userText,
          summary: '',
          documentDate: '',
          senderAgency: '',
          keySentences: [], // Используем keySentences
          attachments: [],
          complaints: [],
          analysisStatus: 'pending',
          lastAnalyzedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          violations: []
        };
        
        console.log('Созданный документ (только текст):', newDocument);
        
        // Инициализация коллекции документов, если её нет
        if (!db.data) {
          db.data = {};
        }
        if (!db.data.documents) {
          db.data.documents = [];
        }
        
        db.data.documents.push(newDocument);
        await db.write();
        return res.status(201).json(newDocument);
      }

      // Обработка файлов
      const filesData = await processUploadedFiles(req.files, userText, userComments);
      console.log('Загруженные файлы:', filesData);
      res.status(201).json(filesData[0]);
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
        agency: docData.agency || '',
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
        violations: Array.isArray(docData.violations) ? docData.violations : []
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

  // Анализ документа
  router.post('/:id/analyze', async (req, res) => {
    try {
      console.log('Raw body:', req.body);
      console.log('Type of strictMode:', typeof req.body.strictMode, req.body.strictMode);
      console.log(`Получен запрос на анализ документа с ID: ${req.params.id}`);
      
      // Используем значения по умолчанию, если параметры не переданы
      const { 
        model = process.env.AI_MODEL || "llama3.1/18/8192",
        instructions = "",
        strictMode = false 
      } = req.body;
      
      console.log(`Параметры анализа: model=${model}, instructions=${instructions}, strictMode=${strictMode}`);
      
      const doc = db.data.documents.find(d => d.id === req.params.id);
      
      if (!doc) {
        console.log(`Документ с ID ${req.params.id} не найден`);
        return res.status(404).json({ 
          message: 'Документ не найден',
          documentId: req.params.id
        });
      }
      
      console.log(`Найден документ:`, {
        id: doc.id,
        hasOriginalText: !!doc.originalText,
        originalTextLength: doc.originalText ? doc.originalText.length : 0,
        attachmentsCount: doc.attachments ? doc.attachments.length : 0
      });
      
      // Проверяем, что документ содержит текст или вложения
      const hasOriginalText = doc.originalText && doc.originalText.trim().length > 0;
      const hasAttachmentsWithText = doc.attachments && doc.attachments.some(att => att.text && att.text.trim().length > 0);
      
      console.log(`Проверка содержимого: hasOriginalText=${hasOriginalText}, hasAttachmentsWithText=${hasAttachmentsWithText}`);
      
      if (!hasOriginalText && !hasAttachmentsWithText) {
        console.log(`Документ не содержит текста для анализа`);
        return res.status(400).json({ 
          message: 'Документ должен содержать текст или вложения с текстом для анализа',
          documentId: req.params.id
        });
      }
      
      // Обновление статуса
      doc.analysisStatus = 'processing';
      doc.updatedAt = new Date().toISOString();
      await db.write();
      console.log(`Статус документа обновлен на 'processing'`);

      console.log("Вызов analyzeDocument");
      const analysisResult = await analyzeDocument(doc, instructions, strictMode);
      console.log("Результат analyzeDocument:", analysisResult);
      
      if (analysisResult.success) {
        // Обновление документа
        console.log("Вызов updateDocumentAnalysis");
        updateDocumentAnalysis(doc, analysisResult.data);
        await db.write();
        console.log(`Документ обновлен после анализа`);

        res.json({
          ...analysisResult.data,
          modelUsed: model,
          analyzedAt: doc.lastAnalyzedAt
        });
      } else {
        throw new Error(analysisResult.error || "Неизвестная ошибка анализа");
      }

    } catch (err) {
      console.error(`Ошибка анализа документа ${req.params.id}:`, err);
      
      // Обновление статуса в случае ошибки
      const doc = db.data.documents.find(d => d.id === req.params.id);
      if (doc) {
        doc.analysisStatus = 'failed';
        doc.updatedAt = new Date().toISOString();
        await db.write();
      }
      
      res.status(500).json({
        message: 'Ошибка при анализе документа',
        error: err.message,
        documentId: req.params.id,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
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
        agency: updateData.agency || existingDoc.agency,
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

  // Анализ документа по ID
  router.post('/:id/analyze', async (req, res) => {
    try {
      const { id } = req.params;
      // Корректная обработка типа для strictMode
      let { instructions = "", strictMode = false } = req.body;
      
      // Преобразуем strictMode в boolean, если он пришел как строка
      if (typeof strictMode === 'string') {
        strictMode = strictMode.toLowerCase() === 'true';
      } else if (typeof strictMode !== 'boolean') {
        // Если strictMode не boolean и не строка, используем значение по умолчанию
        strictMode = false;
      }
      
      console.log(`Получен запрос на анализ документа с ID: ${id}`);
      
      // Используем значения по умолчанию, если параметры не переданы
      const { 
        model = process.env.AI_MODEL || "llama3.1/18/8192"
      } = req.body;
      
      console.log(`Параметры анализа: model=${model}, instructions=${instructions}, strictMode=${strictMode}`);
      
      const doc = db.data.documents.find(d => d.id === id);
      
      if (!doc) {
        console.log(`Документ с ID ${id} не найден`);
        return res.status(404).json({ 
          message: 'Документ не найден',
          documentId: id
        });
      }
      
      console.log(`Найден документ:`, {
        id: doc.id,
        hasOriginalText: !!doc.originalText,
        originalTextLength: doc.originalText ? doc.originalText.length : 0,
        attachmentsCount: doc.attachments ? doc.attachments.length : 0
      });
      
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
      
      // Обновление статуса
      doc.analysisStatus = 'processing';
      doc.updatedAt = new Date().toISOString();
      await db.write();
      console.log(`Статус документа обновлен на 'processing'`);

      console.log("Вызов analyzeDocument");
      const analysisResult = await analyzeDocument(doc, instructions, strictMode);
      console.log("Результат analyzeDocument:", analysisResult);
      
      if (analysisResult.success) {
        // Обновление документа
        console.log("Вызов updateDocumentAnalysis");
        updateDocumentAnalysis(doc, analysisResult.data);
        await db.write();
        console.log(`Документ обновлен после анализа`);

        res.json({
          ...analysisResult.data,
          modelUsed: model,
          analyzedAt: doc.lastAnalyzedAt
        });
      } else {
        throw new Error(analysisResult.error || "Неизвестная ошибка анализа");
      }
    } catch (err) {
      console.error(`Ошибка анализа документа:`, err);
      
      // Обновление статуса документа в случае ошибки
      const { id } = req.params;
      const doc = db.data.documents.find(d => d.id === id);
      if (doc) {
        doc.analysisStatus = 'failed';
        doc.updatedAt = new Date().toISOString();
        await db.write();
      }
      
      res.status(500).json({ 
        message: 'Ошибка при анализе документа',
        error: err.message 
      });
    }
  });

  // Анализ произвольного текста
  router.post('/analyze', async (req, res) => {
    try {
      // Корректная обработка типа для strictMode
      let { text, instructions = "", strictMode = false } = req.body;
      
      // Преобразуем strictMode в boolean, если он пришел как строка
      if (typeof strictMode === 'string') {
        strictMode = strictMode.toLowerCase() === 'true';
      } else if (typeof strictMode !== 'boolean') {
        // Если strictMode не boolean и не строка, используем значение по умолчанию
        strictMode = false;
      }
      
      if (!text) {
        return res.status(400).json({ message: 'Текст обязателен' });
      }
      
      // Проверка типа параметра text
      if (typeof text !== 'string') {
        return res.status(400).json({ 
          message: 'Параметр text должен быть строкой',
          receivedType: typeof text,
          receivedValue: typeof text === 'object' ? '[object Object]' : String(text)
        });
      }
      
      // Анализируем текст
      console.log("Анализ текста через упрощенный путь анализа");
      const analysisResult = await analyzeText(text, instructions, strictMode);
      
      if (analysisResult.success) {
        res.json(analysisResult.data);
      } else {
        throw new Error(analysisResult.error);
      }
    } catch (err) {
      console.error('Ошибка анализа текста:', err);
      res.status(500).json({ 
        message: 'Ошибка при анализе текста',
        error: err.message 
      });
    }
  });

  return router; 
}