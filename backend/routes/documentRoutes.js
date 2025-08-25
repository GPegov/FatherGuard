import { Router } from 'express';
import express from 'express';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import Document from '../models/Document.js';
import pdfService from '../services/pdfService.js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default function documentRoutes({ db, upload, aiService }) {
  const router = Router();

  // Middleware для проверки JSON
  router.use(express.json({
    verify: (req, res, buf, encoding) => {
      try {
        JSON.parse(buf.toString());
      } catch (e) {
        console.error('Invalid JSON:', buf.toString());
        // Отправляем ошибку и завершаем обработку
        res.status(400).json({ message: 'Invalid JSON' });
        // Не выбрасываем ошибку, а просто возвращаемся
        return;
      }
    }
  }));

  

  const validateDocument = (doc) => {
    // Документ может быть создан без текста и вложений, они могут быть добавлены позже
    // Валидация происходит при анализе документа
    return true;
  };

  // Извлечение текста из файла
  const extractFileContent = async (file) => {
    if (file.mimetype === 'application/pdf') {
      const dataBuffer = await fs.readFile(file.path);
      const pdfData = await pdfService.extractTextFromPdf(dataBuffer);
      return pdfData.text;
    } else if (file.mimetype === 'text/plain') {
      return await fs.readFile(file.path, 'utf-8');
    }
    throw new Error('Неподдерживаемый тип файла');
  };

  // Обработка загруженных файлов
  const processUploadedFiles = async (files, userText, userComments) => {
    if (!files || files.length === 0) {
      throw new Error('Нет файлов для загрузки');
    }

    const filesData = [];
    
    for (const file of files) {
      try {
        const fileContent = await extractFileContent(file);
        const combinedText = [userText, fileContent].filter(Boolean).join('\n\n');

        const newDocument = {
          id: uuidv4(),
          date: new Date().toISOString().split('T')[0],
          agency: '',
          originalText: combinedText,
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
            text: fileContent,
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

    return filesData;
  };

  // Анализ содержимого документа
  const analyzeDocumentContent = async (doc, instructions, strictMode) => {
    return await aiService.analyzeLegalText(
      doc.originalText,
      instructions,
      strictMode
    );
  };

  // Анализ вложений
  const analyzeAttachments = async (doc) => {
    if (!doc.attachments?.length) return;

    for (const attachment of doc.attachments) {
      if (attachment.text) {
        try {
          const analysis = await aiService.analyzeLegalText(
            attachment.text,
            'Определи тип документа, дату отправления и ведомство',
            true
          );
          // Обновляем поля анализа во вложении
          attachment.analysis = analysis;
          attachment.documentDate = analysis.documentDate || "";
          attachment.senderAgency = analysis.senderAgency || "";
          attachment.summary = analysis.summary || "";
          attachment.keySentences = Array.isArray(analysis.keySentences) ? analysis.keySentences : [];
        } catch (error) {
          console.error(`Ошибка анализа вложения ${attachment.id}:`, error);
          // Можно оставить поля пустыми или установить статус ошибки
        }
      }
    }
  };

  // Обновление данных анализа
const updateDocumentAnalysis = (doc, analysis) => {
  doc.summary = analysis.summary;
  doc.documentDate = analysis.documentDate || "";
  doc.senderAgency = analysis.senderAgency || "";
  doc.keySentences = Array.isArray(analysis.keySentences) ? analysis.keySentences : [];
  doc.analysisStatus = 'completed';
  doc.lastAnalyzedAt = new Date().toISOString();
  doc.updatedAt = new Date().toISOString();
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
      const userText = req.body.text || "";
      const userComments = req.body.comments || "";

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
      
      // Установка значений по умолчанию для отсутствующих полей
      const newDocument = {
        id: docData.id,
        date: docData.date,
        agency: docData.agency || '',
        originalText: docData.originalText || '',
        summary: docData.summary || '',
        documentDate: docData.documentDate || '',
        senderAgency: docData.senderAgency || '',
        keySentences: Array.isArray(docData.keySentences) ? docData.keySentences : [],
        attachments: Array.isArray(docData.attachments) ? docData.attachments.map(att => ({
          id: att.id || uuidv4(),
          name: att.name || '',
          type: att.type || '',
          size: att.size || 0,
          path: att.path || '',
          text: att.text || '',
          analysis: att.analysis || null,
          documentDate: att.documentDate || '',
          senderAgency: att.senderAgency || '',
          summary: att.summary || '',
          keySentences: Array.isArray(att.keySentences) ? att.keySentences : []
        })) : [],
        complaints: Array.isArray(docData.complaints) ? docData.complaints : [],
        analysisStatus: docData.analysisStatus || 'pending',
        lastAnalyzedAt: docData.lastAnalyzedAt || null,
        createdAt: docData.createdAt,
        updatedAt: docData.updatedAt,
        violations: Array.isArray(docData.violations) ? docData.violations : []
      };
      
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
      // Используем значения по умолчанию, если параметры не переданы
      const { 
        model = process.env.AI_MODEL || "llama3.1/18/8192",
        instructions = "",
        strictMode = false 
      } = req.body;
      
      const doc = db.data.documents.find(d => d.id === req.params.id);
      
      if (!doc) {
        return res.status(404).json({ 
          message: 'Документ не найден',
          documentId: req.params.id
        });
      }
      
      // Проверяем, что документ содержит текст или вложения
      if (!doc.originalText && (!doc.attachments || doc.attachments.length === 0)) {
        return res.status(400).json({ 
          message: 'Документ должен содержать текст или вложения для анализа',
          documentId: req.params.id
        });
      }
      
      // Обновление статуса
      doc.analysisStatus = 'processing';
      doc.updatedAt = new Date().toISOString();
      await db.write();

      const analysis = await analyzeDocumentContent(doc, instructions, strictMode);
      await analyzeAttachments(doc);

      // Обновление документа
      updateDocumentAnalysis(doc, analysis);
      await db.write();

      res.json({
        ...analysis,
        modelUsed: model,
        analyzedAt: doc.lastAnalyzedAt
      });

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
      const docIndex = db.data.documents.findIndex(d => d.id === req.params.id);
      if (docIndex === -1) return res.status(404).json({ message: 'Document not found' });
      
      // Глубокое объединение данных документа
      const existingDoc = db.data.documents[docIndex];
      const updateData = req.body;
      
      // Создаем обновленный документ, начиная с копии существующего
      const updatedDoc = {
        ...existingDoc,
        // Обновляем простые поля
        date: updateData.date || existingDoc.date,
        agency: updateData.agency || existingDoc.agency,
        originalText: updateData.originalText || existingDoc.originalText,
        summary: updateData.summary || existingDoc.summary,
        documentDate: updateData.documentDate || existingDoc.documentDate,
        senderAgency: updateData.senderAgency || existingDoc.senderAgency,
        keySentences: Array.isArray(updateData.keySentences) ? updateData.keySentences : existingDoc.keySentences,
        complaints: Array.isArray(updateData.complaints) ? updateData.complaints : existingDoc.complaints,
        analysisStatus: updateData.analysisStatus || existingDoc.analysisStatus,
        lastAnalyzedAt: updateData.lastAnalyzedAt || existingDoc.lastAnalyzedAt,
        violations: Array.isArray(updateData.violations) ? updateData.violations : existingDoc.violations,
        // Обновляем вложения с глубоким объединением
        attachments: Array.isArray(updateData.attachments) ? 
          updateData.attachments.map(newAttachment => {
            // Ищем существующее вложение по ID
            const existingAttachment = existingDoc.attachments.find(a => a.id === newAttachment.id);
            if (existingAttachment) {
              // Если вложение существует, объединяем данные
              return {
                ...existingAttachment,
                ...newAttachment,
                // Для вложенных объектов analysis также делаем объединение
                analysis: newAttachment.analysis ? {
                  ...existingAttachment.analysis,
                  ...newAttachment.analysis
                } : existingAttachment.analysis
              };
            } else {
              // Если это новое вложение, добавляем его как есть
              // Убеждаемся, что у него есть все необходимые поля
              return {
                id: newAttachment.id || uuidv4(),
                name: newAttachment.name || '',
                type: newAttachment.type || '',
                size: newAttachment.size || 0,
                path: newAttachment.path || '',
                text: newAttachment.text || '',
                analysis: newAttachment.analysis || null,
                documentDate: newAttachment.documentDate || '',
                senderAgency: newAttachment.senderAgency || '',
                summary: newAttachment.summary || '',
                keySentences: Array.isArray(newAttachment.keySentences) ? newAttachment.keySentences : []
              };
            }
          }) : existingDoc.attachments,
        updatedAt: new Date().toISOString()
      };
      
      db.data.documents[docIndex] = updatedDoc;
      
      await db.write();
      res.json(updatedDoc);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  });

  // Анализ вложения
  router.post('/attachments/analyze', async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ message: 'Текст вложения обязателен' });
      }

      // Анализируем текст вложения
      const analysis = await aiService.analyzeAttachment(text);
      
      res.json(analysis);
    } catch (err) {
      console.error('Ошибка анализа вложения:', err);
      res.status(500).json({ 
        message: 'Ошибка при анализе вложения',
        error: err.message 
      });
    }
  });

  // Анализ произвольного текста
  router.post('/analyze-text', async (req, res) => {
    try {
      const { text, instructions = "", strictMode = false } = req.body;
      if (!text) {
        return res.status(400).json({ message: 'Текст обязателен' });
      }

      // Анализируем текст
      const analysis = await aiService.analyzeLegalText(text, instructions, strictMode);
      
      res.json(analysis);
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