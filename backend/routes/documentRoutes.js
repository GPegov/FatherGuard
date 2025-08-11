import { Router } from 'express';
import express from 'express';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import Document from '../models/Document.js';
import aiService from '../services/aiService.js';
import pdfService from '../services/pdfService.js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default function documentRoutes({ db, upload }) {
  const router = Router();

  // Middleware для проверки JSON
  router.use(express.json({
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
      keyParagraphs: data.keyParagraphs || [],
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
    doc.keyParagraphs = analysis.keyParagraphs;
    doc.analysisStatus = 'completed';
    doc.lastAnalyzedAt = new Date().toISOString();
    doc.updatedAt = new Date().toISOString();
  };

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

      const doc = db.data.documents.find(d => d.id === req.params.id);
      if (!doc) return res.status(404).json({ message: 'Документ не найден' });

      const relatedDocs = db.data.documents.filter(d => 
        d.date <= doc.date && d.id !== req.params.id
      );

      const complaint = await generateComplaint(doc, agency, relatedDocs);
      saveComplaint(doc, complaint);

      res.status(201).json(complaint);
    } catch (err) {
      res.status(500).json({ 
        message: err.message || 'Ошибка генерации жалобы',
        details: err.response?.data
      });
    }
  });

  // Генерация жалобы
  const generateComplaint = async (doc, agency, relatedDocs) => {
    const complaint = await aiService.generateComplaintV2(
      doc.originalText,
      agency,
      relatedDocs.map(d => d.originalText)
    );

    return {
      id: uuidv4(),
      documentId: doc.id,
      agency,
      content: complaint.content,
      violations: complaint.violations || [],
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
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

  return router;
}









// import aiService from '../services/aiService.js';
// import { Router } from 'express';
// import pdf from 'pdf-parse';
// import fs from 'fs/promises';
// import { v4 as uuidv4 } from 'uuid';
// import express from 'express';
// import path from 'path';

// export default function documentRoutes({ db, upload }) {
//   const router = Router();

//   // Middleware для проверки JSON
//   router.use(express.json({
//     verify: (req, res, buf, encoding) => {
//       try {
//         JSON.parse(buf.toString());
//       } catch (e) {
//         console.error('Invalid JSON:', buf.toString());
//         throw new Error('Invalid JSON');
//       }
//     }
//   }));

//   // Загрузка документа (текст + файлы)
//   router.post('/upload', upload.array('files'), async (req, res) => {
//     try {
//       const userText = req.body.text || "";
//       const userComments = req.body.comments || "";
      
//       // Только текст без файлов
//       if (userText && (!req.files || req.files.length === 0)) {
//         const newDocument = {
//           id: uuidv4(),
//           date: req.body.date || new Date().toISOString().split('T')[0],
//           agency: req.body.agency || "",
//           originalText: userText,
//           summary: "",
//           documentDate: "",
//           senderAgency: "",
//           keyParagraphs: [],
//           attachments: [],
//           comments: userComments,
//           analysisStatus: 'pending',
//           lastAnalyzedAt: null,
//           createdAt: new Date().toISOString(),
//           updatedAt: new Date().toISOString()
//         };

//         db.data.documents.push(newDocument);
//         await db.write();
//         return res.status(201).json(newDocument);
//       }

//       // Обработка файлов
//       if (!req.files || req.files.length === 0) {
//         return res.status(400).json({ message: 'Нет файлов для загрузки' });
//       }

//       const filesData = [];
      
//       for (const file of req.files) {
//         try {
//           let fileContent = '';
          
//           if (file.mimetype === 'application/pdf') {
//             const dataBuffer = await fs.readFile(file.path);
//             const pdfData = await pdf(dataBuffer);
//             fileContent = pdfData.text;
//           } else if (file.mimetype === 'text/plain') {
//             fileContent = await fs.readFile(file.path, 'utf-8');
//           }

//           const combinedText = [userText, fileContent].filter(Boolean).join('\n\n');

//           const newDocument = {
//             id: uuidv4(),
//             date: req.body.date || new Date().toISOString().split('T')[0],
//             agency: req.body.agency || "",
//             originalText: combinedText,
//             summary: "",
//             documentDate: "",
//             senderAgency: "",
//             keyParagraphs: [],
//             attachments: [{
//               id: uuidv4(),
//               name: file.originalname,
//               type: file.mimetype,
//               size: file.size,
//               path: `/uploads/${file.filename}`,
//               text: fileContent,
//               analysis: null
//             }],
//             comments: userComments,
//             analysisStatus: 'pending',
//             lastAnalyzedAt: null,
//             createdAt: new Date().toISOString(),
//             updatedAt: new Date().toISOString()
//           };

//           db.data.documents.push(newDocument);
//           await db.write();
//           filesData.push(newDocument);
//           await fs.unlink(file.path);
//         } catch (fileError) {
//           console.error(`Ошибка обработки файла ${file.originalname}:`, fileError);
//           continue;
//         }
//       }

//       res.status(201).json(filesData[0]);
//     } catch (err) {
//       console.error('Ошибка загрузки:', err);
//       res.status(500).json({ 
//         message: err.message || 'Ошибка сервера при обработке документа'
//       });
//     }
//   });

//   // Создание документа (альтернативный endpoint)
//   router.post('/', async (req, res) => {
//     try {
//       const doc = {
//         id: uuidv4(),
//         date: req.body.date || new Date().toISOString().split('T')[0],
//         agency: req.body.agency || "",
//         originalText: req.body.originalText || "",
//         summary: req.body.summary || "",
//         documentDate: req.body.documentDate || "",
//         senderAgency: req.body.senderAgency || "",
//         keyParagraphs: req.body.keyParagraphs || [],
//         attachments: req.body.attachments?.map(att => ({
//           ...att,
//           id: att.id || uuidv4(),
//           analysis: att.analysis || null
//         })) || [],
//         comments: req.body.comments || "",
//         analysisStatus: req.body.analysisStatus || 'pending',
//         lastAnalyzedAt: req.body.lastAnalyzedAt || null,
//         createdAt: new Date().toISOString(),
//         updatedAt: new Date().toISOString()
//       };
      
//       if (!doc.originalText && doc.attachments.length === 0) {
//         return res.status(400).json({ message: 'Текст или файл обязательны' });
//       }

//       db.data.documents.push(doc);
//       await db.write();
//       res.status(201).json(doc);
//     } catch (err) {
//       res.status(400).json({ message: err.message });
//     }
//   });

//   // Получение списка документов (с пагинацией)
//   router.get('/', async (req, res) => {
//     try {
//       await db.read();
//       const { limit = 50, offset = 0 } = req.query;
      
//       const documents = db.data.documents
//         .slice(parseInt(offset), parseInt(offset) + parseInt(limit))
//         .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

//       res.json({
//         total: db.data.documents.length,
//         items: documents
//       });
//     } catch (err) {
//       res.status(500).json({ message: err.message });
//     }
//   });

//   // Получение конкретного документа
//   router.get('/:id', async (req, res) => {
//     try {
//       const doc = db.data.documents.find(d => d.id === req.params.id);
//       if (!doc) return res.status(404).json({ message: 'Документ не найден' });
//       res.json(doc);
//     } catch (err) {
//       res.status(500).json({ message: err.message });
//     }
//   });

//   // Анализ документа
//   router.post('/:id/analyze', async (req, res) => {
//     try {
//       const { model, instructions, strictMode } = req.body;
//       const doc = db.data.documents.find(d => d.id === req.params.id);
      
//       if (!doc) {
//         return res.status(404).json({ 
//           message: 'Документ не найден',
//           documentId: req.params.id
//         });
//       }

//       console.log(`Анализ документа ${req.params.id} с моделью ${model}`);
      
//       // Обновляем статус документа
//       doc.analysisStatus = 'processing';
//       doc.updatedAt = new Date().toISOString();
//       await db.write();

//       const analysis = await aiService.analyzeLegalText(
//         doc.originalText,
//         instructions,
//         strictMode
//       );

//       // Анализ вложенных документов
//       if (doc.attachments?.length) {
//         for (const attachment of doc.attachments) {
//           if (attachment.text) {
//             attachment.analysis = await aiService.analyzeLegalText(
//               attachment.text,
//               'Определи тип документа, дату отправления и ведомство',
//               true
//             );
//           }
//         }
//       }

//       // Обновляем документ
//       const updateData = {
//         summary: analysis.summary,
//         documentDate: analysis.documentDate || "",
//         senderAgency: analysis.senderAgency || "",
//         keyParagraphs: analysis.keyParagraphs,
//         analysisStatus: 'completed',
//         lastAnalyzedAt: new Date().toISOString(),
//         updatedAt: new Date().toISOString()
//       };

//       Object.assign(doc, updateData);
//       await db.write();

//       res.json({
//         ...updateData,
//         modelUsed: model,
//         analyzedAt: updateData.lastAnalyzedAt
//       });

//     } catch (err) {
//       console.error(`Ошибка анализа документа ${req.params.id}:`, err);
      
//       // Обновляем статус в случае ошибки
//       const doc = db.data.documents.find(d => d.id === req.params.id);
//       if (doc) {
//         doc.analysisStatus = 'failed';
//         doc.updatedAt = new Date().toISOString();
//         await db.write();
//       }
      
//       res.status(500).json({
//         message: 'Ошибка при анализе документа',
//         error: err.message,
//         documentId: req.params.id,
//         stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
//       });
//     }
//   });

//   // Удаление документа
//   router.delete('/:id', async (req, res) => {
//     try {
//       await db.read();
//       const initialLength = db.data.documents.length;
//       db.data.documents = db.data.documents.filter(d => d.id !== req.params.id);
      
//       if (db.data.documents.length === initialLength) {
//         return res.status(404).json({ message: 'Document not found' });
//       }
      
//       await db.write();
//       res.status(204).end();
//     } catch (err) {
//       res.status(500).json({ message: err.message });
//     }
//   });

//   // Жалобы для документа
//   router.post('/:id/complaints', async (req, res) => {
//     try {
//       const { agency } = req.body;
//       if (!agency) return res.status(400).json({ message: 'Не указано ведомство' });

//       const doc = db.data.documents.find(d => d.id === req.params.id);
//       if (!doc) return res.status(404).json({ message: 'Документ не найден' });

//       // Получаем связанные документы
//       const relatedDocs = db.data.documents.filter(d => 
//         d.date <= doc.date && d.id !== req.params.id
//       );

//       const complaint = await aiService.generateComplaintV2(
//         doc.originalText,
//         agency,
//         relatedDocs.map(d => d.originalText)
//       );

//       // Сохраняем жалобу
//       const newComplaint = {
//         id: uuidv4(),
//         documentId: req.params.id,
//         agency,
//         content: complaint.content,
//         violations: complaint.violations || [],
//         status: 'draft',
//         createdAt: new Date().toISOString(),
//         updatedAt: new Date().toISOString()
//       };

//       if (!db.data.complaints) {
//         db.data.complaints = [];
//       }
//       db.data.complaints.push(newComplaint);
//       await db.write();

//       // Добавляем ссылку на жалобу в документ
//       if (!doc.complaints) {
//         doc.complaints = [];
//       }
//       doc.complaints.push(newComplaint.id);
//       doc.updatedAt = new Date().toISOString();
//       await db.write();

//       res.status(201).json(newComplaint);
//     } catch (err) {
//       res.status(500).json({ 
//         message: err.message || 'Ошибка генерации жалобы',
//         details: err.response?.data
//       });
//     }
//   });

//   // Получение жалоб для документа
//   router.get('/:id/complaints', async (req, res) => {
//     try {
//       const complaints = db.data.complaints?.filter(c => c.documentId === req.params.id) || [];
//       res.json(complaints);
//     } catch (err) {
//       res.status(500).json({ message: err.message });
//     }
//   });

//   // Обновление документа
// router.put('/:id', async (req, res) => {
//   try {
//     const docIndex = db.data.documents.findIndex(d => d.id === req.params.id);
//     if (docIndex === -1) return res.status(404).json({ message: 'Document not found' });
    
//     db.data.documents[docIndex] = {
//       ...db.data.documents[docIndex],
//       ...req.body,
//       updatedAt: new Date().toISOString()
//     };
    
//     await db.write();
//     res.json(db.data.documents[docIndex]);
//   } catch (err) {
//     res.status(400).json({ message: err.message });
//   }
// });

//   return router;
// }