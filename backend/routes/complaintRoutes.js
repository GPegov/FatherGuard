import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import * as docx from 'docx';

export default function complaintRoutes({ db }) {
  const router = Router()

  // Генерация жалобы
  router.post('/generate', async (req, res) => {
    try {
      const { documentId, agency } = req.body
      const doc = db.data.documents.find(d => d.id === documentId)
      if (!doc) return res.status(404).json({ message: 'Document not found' })

      // Здесь будет интеграция с моделью для генерации жалобы
      const complaintContent = `Жалоба в ${agency}\n\n` +
        `Основание: ${doc.summary}\n\n` +
        `Существенные моменты:\n${doc.keyParagraphs.join('\n')}`

      const complaint = {
        id: uuidv4(),
        documentId,
        agency,
        content: complaintContent,
        status: 'draft',
        createdAt: new Date().toISOString()
      }

      db.data.complaints.push(complaint)
      await db.write()

      res.status(201).json(complaint)
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  })

  // Экспорт жалобы
  router.get('/:id/export', async (req, res) => {
    try {
      const { format = 'txt' } = req.query
      const complaint = db.data.complaints.find(c => c.id === req.params.id)
      if (!complaint) return res.status(404).json({ message: 'Complaint not found' })

      if (format === 'txt') {
        res.setHeader('Content-Type', 'text/plain')
        res.setHeader('Content-Disposition', `attachment; filename=complaint_${complaint.agency}.txt`)
        res.send(complaint.content)
      } 
      else if (format === 'doc') {
        // Генерация DOCX с помощью docx
        const { Document, Paragraph, TextRun, Packer } = docx
        const doc = new Document({
          sections: [{
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: complaint.content,
                    size: 24
                  })
                ]
              })
            ]
          }]
        })

        const buffer = await Packer.toBuffer(doc)
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        res.setHeader('Content-Disposition', `attachment; filename=complaint_${complaint.agency}.docx`)
        res.send(buffer)
      }
      else {
        res.status(400).json({ message: 'Unsupported format' })
      }
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  })

  // Получение всех жалоб
  router.get('/', async (req, res) => {
    try {
      await db.read()
      res.json(db.data.complaints)
    } catch (err) {
      res.status(500).json({ message: err.message })
    }
  })

  return router
}