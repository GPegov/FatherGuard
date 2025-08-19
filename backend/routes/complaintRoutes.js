import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Document, Paragraph, TextRun, Packer } from 'docx';
import aiService from '../services/aiService.js';

export default function complaintRoutes({ db }) {
  const router = Router();

  // Генерация жалобы
  router.post('/generate', async (req, res) => {
    try {
      const { documentId, agency, instructions } = req.body;
      
      // Проверка обязательных полей
      if (!agency || !documentId) {
        return res.status(400).json({ message: 'Не указаны обязательные параметры' });
      }

      // Поиск документа
      const doc = db.data.documents.find(d => d.id === documentId);
      if (!doc) {
        return res.status(404).json({ message: 'Document not found' });
      }

      // Поиск связанных документов
      const relatedDocs = db.data.documents.filter(d => 
        d.id !== documentId && d.date <= doc.date
      );

      // Генерация жалобы через AI сервис
      let complaintContent;
      try {
        const result = await aiService.generateComplaintV2(
          doc.originalText,
          agency,
          relatedDocs.map(d => d.originalText),
          instructions
        );
        complaintContent = result.content || generateFallbackComplaint(doc, agency);
      } catch (aiError) {
        console.error('Ошибка генерации жалобы через AI:', aiError);
        complaintContent = generateFallbackComplaint(doc, agency);
      }

      // Создание объекта жалобы
      const complaint = {
        id: uuidv4(),
        documentId,
        agency,
        content: complaintContent,
        relatedDocuments: relatedDocs.map(d => d.id),
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Сохранение в БД
      if (!db.data.complaints) {
        db.data.complaints = [];
      }
      db.data.complaints.push(complaint);
      await db.write();

      // Обновление документа
      if (!doc.complaints) {
        doc.complaints = [];
      }
      doc.complaints.push(complaint.id);
      await db.write();

      res.status(201).json(complaint);
    } catch (err) {
      console.error('Ошибка генерации жалобы:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // Вспомогательный метод для генерации содержания жалобы
  function generateFallbackComplaint(doc, agency) {
    return `Жалоба в ${agency}\n\n` +
      `Документ: ${doc.summary || "Без описания"}\n` +
      `Дата: ${doc.documentDate || "Не указана"}\n\n` +
      `Текст: ${doc.originalText.substring(0, 500)}...`;
  }

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