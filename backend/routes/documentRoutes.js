import { Router, json } from 'express'; // Добавьте json
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import Document from '../models/Document.js';
import aiService from '../services/aiService.js';
import pdfService from '../services/pdfService.js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default function documentRoutes({ db, upload }) {
  const router = Router();

  // Middleware для проверки JSON
  router.use(json({
    verify: (req, res, buf, encoding) => {
      try {
        JSON.parse(buf.toString());
      } catch (e) {
        console.error('Invalid JSON:', buf.toString());
        res.status(400).json({ message: 'Invalid JSON' });
        throw new Error('Invalid JSON');
      }
    }
  }));

  // Вспомогательные функции
  const normalizeDocument = (data) => {
    return {
      id: data.id || uuidv4(),
      date: data.date || new Date().toISOString().split('T')[0],
      agency: data.agency || '',
      originalText: data.originalText || '',
      summary: data.summary || '',
      documentDate: data.documentDate || '',
      senderAgency: data.senderAgency || '',
      keySentences: data.keySentences || [],
      attachments: (data.attachments || []).map(att => ({
        id: att.id || uuidv4(),
        name: att.name,
        type: att.type,
        size: att.size,
        path: att.path,
        text: att.text || '',
        analysis: att.analysis || null
      })),
      complaints: data.complaints || [],
      analysisStatus: data.analysisStatus || 'pending',
      lastAnalyzedAt: data.lastAnalyzedAt || null,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  };

  const validateDocument = (doc) => {
    if (!doc.originalText && (!doc.attachments || doc.attachments.length === 0)) {
      throw new Error('Документ должен содержать текст или вложения');
    }
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

        const newDocument = normalizeDocument({
          originalText: combinedText,
          comments: userComments,
          attachments: [{
            name: file.originalname,
            type: file.mimetype,
            size: file.size,
            path: `/uploads/${file.filename}`,
            text: fileContent
          }]
        });

        db.data.documents.push(newDocument);
        await db.write();
        filesData.push(newDocument);
        await fs.unlink(file.path);
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
        attachment.analysis = await aiService.analyzeLegalText(
          attachment.text,
          'Определи тип документа, дату отправления и ведомство',
          true
        );
      }
    }
  };

  // Обновление данных анализа
  const updateDocumentAnalysis = (doc, analysis) => {
    doc.summary = analysis.summary;
    doc.documentDate = analysis.documentDate || "";
    doc.senderAgency = analysis.senderAgency || "";
    doc.keySentences = analysis.keySentences;
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
        const newDocument = normalizeDocument({
          originalText: userText,
          comments: userComments
        });
        
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
      const doc = normalizeDocument(req.body);
      validateDocument(doc);
      
      db.data.documents.push(doc);
      await db.write();
      res.status(201).json(doc);
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
      const { model, instructions, strictMode } = req.body;
      const doc = db.data.documents.find(d => d.id === req.params.id);
      
      if (!doc) {
        return res.status(404).json({ 
          message: 'Документ не найден',
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

  // Жалобы для документа
  router.post('/:id/complaints', async (req, res) => {
    try {
      const { agency } = req.body;
      if (!agency) return res.status(400).json({ message: 'Не указано ведомство' });

      // Подготавливаем данные для унифицированного метода
      const complaintData = {
        documentId: req.params.id,
        agency: agency
      };

      // Используем унифицированный метод генерации жалобы
      const { generateUnifiedComplaint } = await import('../services/complaintService.js');
      const complaint = await generateUnifiedComplaint(db, complaintData);
      
      res.status(201).json(complaint);
    } catch (error) {
      res.status(500).json({ message: error.message });
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
      
      db.data.documents[docIndex] = {
        ...db.data.documents[docIndex],
        ...req.body,
        updatedAt: new Date().toISOString()
      };
      
      await db.write();
      res.json(db.data.documents[docIndex]);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  });

  return router; // Правильный экспорт для функции
} // Закрывающая скобка для function documentRoutes