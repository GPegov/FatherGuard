import { Router } from 'express'
import pdf from 'pdf-parse'
import fs from 'fs/promises'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'

export default function documentRoutes({ db, upload }) {
  const router = Router()

  // Улучшенная загрузка файлов с комментариями
  router.post('/upload', upload.array('files'), async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'No files were uploaded.' })
      }

      const filesData = []
      const userComments = req.body.comments || "" // Получаем комментарии из тела запроса
      
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

          // Создаем полный документ с комментариями
          const newDocument = {
            id: uuidv4(),
            date: new Date().toISOString().split('T')[0],
            agency: "",
            originalText: fileContent,
            summary: "",
            keyParagraphs: [],
            attachments: [{
              id: uuidv4(),
              name: file.originalname,
              type: file.mimetype,
              size: file.size,
              path: `/uploads/${file.filename}`
            }],
            comments: userComments, // Сохраняем комментарии
            createdAt: new Date().toISOString()
          }

          // Сохраняем в базу данных
          db.data.documents.push(newDocument)
          await db.write()

          filesData.push(newDocument)

          // Удаляем временный файл после обработки
          await fs.unlink(file.path)
        } catch (fileError) {
          console.error(`Error processing file ${file.originalname}:`, fileError)
          continue // Продолжаем обработку остальных файлов
        }
      }

      if (filesData.length === 0) {
        return res.status(500).json({ message: 'Failed to process any files' })
      }

      res.status(201).json(filesData[0]) // Возвращаем первый обработанный документ
    } catch (err) {
      console.error('Upload error:', err)
      res.status(500).json({ message: err.message })
    }
  })

  // Остальные роуты остаются без изменений
  router.post('/', async (req, res) => {
    try {
      const doc = {
        id: uuidv4(),
        ...req.body,
        createdAt: new Date().toISOString()
      }
      
      db.data.documents.push(doc)
      await db.write()
      
      res.status(201).json(doc)
    } catch (err) {
      res.status(400).json({ message: err.message })
    }
  })

  router.get('/', async (req, res) => {
    try {
      await db.read()
      res.json(db.data.documents)
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  })

  router.get('/:id', async (req, res) => {
    try {
      const doc = db.data.documents.find(d => d.id === req.params.id)
      if (!doc) return res.status(404).json({ message: 'Document not found' })
      res.json(doc)
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  })

  router.post('/:id/analyze', async (req, res) => {
    try {
      const doc = db.data.documents.find(d => d.id === req.params.id)
      if (!doc) return res.status(404).json({ message: 'Document not found' })

      // Здесь будет интеграция с моделью deepseek-r1:14b
      const analysisResult = {
        summary: doc.originalText.substring(0, 150) + '... [анализ]',
        keyParagraphs: [
          doc.originalText.substring(50, 200),
          doc.originalText.substring(300, 450)
        ]
      }

      Object.assign(doc, {
        summary: analysisResult.summary,
        keyParagraphs: analysisResult.keyParagraphs
      })
      
      await db.write()
      res.json(analysisResult)
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  })

  return router
}