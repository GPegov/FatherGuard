import { Router } from 'express';
import { Document, Paragraph, TextRun, Packer } from 'docx';
import { generateUnifiedComplaint } from '../services/complaintService.js';

export default function complaintRoutes({ db }) {
  const router = Router();

  // Генерация жалобы (унифицированный метод)
  router.post('/generate', async (req, res) => {
    try {
      console.log('Получен запрос на генерацию жалобы:', req.body);
      const complaint = await generateUnifiedComplaint(db, req.body);
      res.status(201).json(complaint);
    } catch (err) {
      console.error('Ошибка генерации жалобы:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // Экспорт жалобы

  // Экспорт жалобы
  router.get('/:id/export', async (req, res) => {
    try {
      const { format = 'txt' } = req.query;
      const complaint = db.data.complaints.find(c => c.id === req.params.id);
      
      if (!complaint) {
        return res.status(404).json({ message: 'Complaint not found' });
      }

      if (format === 'txt') {
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename=complaint_${complaint.agency}.txt`);
        res.send(complaint.content);
      } 
      else if (format === 'doc') {
        const docxDocument = new Document({
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
        });

        const buffer = await Packer.toBuffer(docxDocument);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename=complaint_${complaint.agency}.docx`);
        res.send(buffer);
      }
      else {
        res.status(400).json({ message: 'Unsupported format' });
      }
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // Получение всех жалоб
  router.get('/', async (req, res) => {
    try {
      await db.read();
      
      // Сортировка по дате создания (новые сначала)
      const complaints = db.data.complaints?.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      ) || [];
      
      res.json(complaints);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // Удаление жалобы
  router.delete('/:id', async (req, res) => {
    try {
      await db.read();
      const initialLength = db.data.complaints.length;
      
      // Удаление жалобы
      db.data.complaints = db.data.complaints.filter(c => c.id !== req.params.id);
      
      if (db.data.complaints.length === initialLength) {
        return res.status(404).json({ message: 'Complaint not found' });
      }
      
      // Удаление ссылки из документа
      for (const doc of db.data.documents) {
        if (doc.complaints) {
          doc.complaints = doc.complaints.filter(id => id !== req.params.id);
        }
      }
      
      await db.write();
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  return router;
}