import aiService from '../services/aiService.js';
import { Router } from 'express'
import pdf from 'pdf-parse'
import fs from 'fs/promises'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'

export default function documentRoutes({ db, upload }) {
  const router = Router()

  // Универсальный обработчик загрузки (текст + файлы)
  router.post('/upload', upload.array('files'), async (req, res) => {
    try {
      const userText = req.body.text || ""
      const userComments = req.body.comments || ""
      
      // Случай 1: Только текст без файлов
      if (userText && (!req.files || req.files.length === 0)) {
        const newDocument = {
          id: uuidv4(),
          date: new Date().toISOString().split('T')[0],
          agency: "",
          originalText: userText,
          summary: "",
          keyParagraphs: [],
          attachments: [],
          comments: userComments,
          createdAt: new Date().toISOString()
        }

        db.data.documents.push(newDocument)
        await db.write()
        return res.status(201).json(newDocument)
      }

      // Случай 2: Файлы с текстом или без
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'Нет файлов для загрузки' })
      }

      const filesData = []
      
      for (const file of req.files) {
        try {
          let fileContent = ''
          
          if (file.mimetype === 'application/pdf') {
            const dataBuffer = await fs.readFile(file.path)
            const pdfData = await pdf(dataBuffer)
            fileContent = pdfData.text
          } else if (file.mimetype === 'text/plain') {
            fileContent = await fs.readFile(file.path, 'utf-8')
          }

          // Объединяем текст из формы с текстом файла
          const combinedText = [userText, fileContent].filter(Boolean).join('\n\n')

          const newDocument = {
            id: uuidv4(),
            date: new Date().toISOString().split('T')[0],
            agency: "",
            originalText: combinedText,
            summary: "",
            keyParagraphs: [],
            attachments: [{
              id: uuidv4(),
              name: file.originalname,
              type: file.mimetype,
              size: file.size,
              path: `/uploads/${file.filename}`
            }],
            comments: userComments,
            createdAt: new Date().toISOString()
          }

          db.data.documents.push(newDocument)
          await db.write()
          filesData.push(newDocument)
          await fs.unlink(file.path)
        } catch (fileError) {
          console.error(`Ошибка обработки файла ${file.originalname}:`, fileError)
          continue
        }
      }

      res.status(201).json(filesData[0])
    } catch (err) {
      console.error('Ошибка загрузки:', err)
      res.status(500).json({ 
        message: err.message || 'Ошибка сервера при обработке документа'
      })
    }
  })

  // Создание документа (альтернативный endpoint)
  router.post('/', async (req, res) => {
    try {
      const doc = {
        id: uuidv4(),
        date: req.body.date || new Date().toISOString().split('T')[0],
        agency: req.body.agency || "",
        originalText: req.body.originalText || "",
        summary: req.body.summary || "",
        keyParagraphs: req.body.keyParagraphs || [],
        attachments: req.body.attachments || [],
        comments: req.body.comments || "",
        createdAt: new Date().toISOString()
      }
      
      // Валидация обязательных полей
      if (!doc.originalText && doc.attachments.length === 0) {
        return res.status(400).json({ message: 'Текст или файл обязательны' })
      }

      db.data.documents.push(doc)
      await db.write()
      res.status(201).json(doc)
    } catch (err) {
      res.status(400).json({ message: err.message })
    }
  })

  // Получение списка документов (с пагинацией)
  router.get('/', async (req, res) => {
    try {
      await db.read()
      const { limit = 50, offset = 0 } = req.query
      
      const documents = db.data.documents
        .slice(parseInt(offset), parseInt(offset) + parseInt(limit))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

      res.json({
        total: db.data.documents.length,
        items: documents
      })
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  })

  // Получение конкретного документа
  router.get('/:id', async (req, res) => {
    try {
      const doc = db.data.documents.find(d => d.id === req.params.id)
      if (!doc) return res.status(404).json({ message: 'Документ не найден' })
      res.json(doc)
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  })

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

    console.log(`Анализ документа ${req.params.id} с моделью ${model}`);
    
    const analysis = await aiService.analyzeLegalText(
      doc.originalText,
      instructions,
      strictMode
    );

    // Сохраняем только определенные поля
    const updateData = {
      summary: analysis.summary,
      keyParagraphs: analysis.keyParagraphs,
      updatedAt: new Date().toISOString(),
      analysisStatus: 'completed'
    };

    Object.assign(doc, updateData);
    await db.write();

    res.json({
      ...updateData,
      modelUsed: model,
      analyzedAt: updateData.updatedAt
    });

  } catch (err) {
    console.error(`Ошибка анализа документа ${req.params.id}:`, err);
    
    res.status(500).json({
      message: 'Ошибка при анализе документа',
      error: err.message,
      documentId: req.params.id,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});


  router.delete('/:id', async (req, res) => {
  try {
    await db.read()
    const initialLength = db.data.documents.length
    db.data.documents = db.data.documents.filter(d => d.id !== req.params.id)
    
    if (db.data.documents.length === initialLength) {
      return res.status(404).json({ message: 'Document not found' })
    }
    
    await db.write()
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
  
})

router.post('/:id/complaints', async (req, res) => {
  try {
    const { agency } = req.body;
    if (!agency) return res.status(400).json({ message: 'Не указано ведомство' });

    const complaint = await aiService.generateComplaintV2(
      req.params.id, 
      agency,
      db
    );

    res.status(201).json(complaint);
  } catch (err) {
    res.status(500).json({ 
      message: err.message || 'Ошибка генерации жалобы',
      details: err.response?.data
    });
  }
});

router.get('/:id/complaints', async (req, res) => {
  try {
    const complaints = db.data.complaints?.filter(c => c.documentId === req.params.id) || [];
    res.json(complaints);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


  return router
}