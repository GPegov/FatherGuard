import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Document, Paragraph, TextRun, Packer } from 'docx';
import AIService from '../services/aiService.js';

// Создаем экземпляр AIService
const aiService = new AIService();

export default function complaintRoutes({ db }) {
  const router = Router();

  // Генерация жалобы
  router.post('/generate', async (req, res) => {
    try {
      console.log('Получен запрос на генерацию жалобы:', req.body);
      const { documentId, agency, currentDocument, relatedDocuments } = req.body;
      
      // Проверка обязательных полей
      if (!agency || !documentId) {
        console.log('Не указаны обязательные параметры');
        return res.status(400).json({ message: 'Не указаны обязательные параметры' });
      }

      // Если переданы полные данные документов, используем их
      if (currentDocument && relatedDocuments) {
        console.log('Используем переданные данные документов для генерации жалобы');
        
        // Подготовка данных для генерации жалобы
        const complaintData = {
          currentDocument: currentDocument,
          relatedDocuments: relatedDocuments,
          agency: agency,
          instructions: ''
        };
        
        // Генерация жалобы через AI сервис
        let complaintResult;
        try {
          console.log('Вызов AI сервиса для генерации жалобы с переданными данными');
          complaintResult = await aiService.generateComplaintFromData(complaintData);
          console.log('Результат от AI сервиса:', complaintResult);
        } catch (aiError) {
          console.error('Ошибка генерации жалобы через AI:', aiError);
          // Если AI не сработал, используем запасной вариант
          complaintResult = {
            content: generateFallbackComplaint(currentDocument, agency),
          };
        }

        // Создание объекта жалобы
        const complaint = {
          id: uuidv4(),
          documentId,
          agency,
          content: complaintResult.content || generateFallbackComplaint(currentDocument, agency),
          relatedDocuments: relatedDocuments.map((d, index) => `related-doc-${index}`), // Заглушки для ID
          status: 'draft',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        console.log('Создан объект жалобы:', complaint);

        // Сохранение в БД
        if (!db.data.complaints) {
          db.data.complaints = [];
        }
        db.data.complaints.push(complaint);
        await db.write();
        console.log('Жалоба сохранена в БД');

        // Обновление документа
        const doc = db.data.documents.find(d => d.id === documentId);
        if (doc) {
          if (!doc.complaints) {
            doc.complaints = [];
          }
          doc.complaints.push(complaint.id);
          await db.write();
          console.log('Документ обновлен');
        }

        res.status(201).json(complaint);
        return;
      }

      // Если данные документов не переданы, используем старую логику
      console.log('Используем старую логику с поиском документов в БД');
      
      // Поиск документа
      const doc = db.data.documents.find(d => d.id === documentId);
      console.log('Найден документ:', doc);
      if (!doc) {
        console.log('Документ не найден');
        return res.status(404).json({ message: 'Document not found' });
      }

      // Поиск связанных документов
      const relatedDocs = db.data.documents.filter(d => 
        d.id !== documentId && d.date <= doc.date
      );
      console.log('Связанные документы:', relatedDocs);

      // Подготовка данных предыдущих документов
      const relatedDocData = relatedDocs.map(d => ({
        fullText: d.originalText || d.fullText || '',
        summary: d.summary || '',
        keySentences: d.keySentences || []
      }));
      console.log('Подготовленные данные связанных документов:', relatedDocData);

      // Подготовка данных для AI-модели
      const aiRequestData = {
        currentDocument: {
          fullText: doc.originalText,
          summary: doc.summary || '',
          keySentences: doc.keySentences || []
        },
        relatedDocuments: relatedDocData,
        agency: agency,
        instructions: ''
      };
      
      console.log('Данные для AI-модели:', JSON.stringify(aiRequestData, null, 2));

      // Генерация жалобы через AI сервис
      let complaintResult;
      try {
        console.log('Вызов AI сервиса для генерации жалобы');
        
        // Подготовка данных для генерации жалобы
        const complaintData = {
          currentDocument: {
            fullText: doc.originalText,
            summary: doc.summary || '',
            keySentences: doc.keySentences || []
          },
          relatedDocuments: relatedDocData,
          agency: agency,
          instructions: ''
        };
        
        complaintResult = await aiService.generateComplaintFromData(complaintData);
        console.log('Результат от AI сервиса:', complaintResult);
      } catch (aiError) {
        console.error('Ошибка генерации жалобы через AI:', aiError);
        // Если AI не сработал, используем запасной вариант
        complaintResult = {
          content: generateFallbackComplaint(doc, agency),
          violations: []
        };
      }

      // Создание объекта жалобы
      const complaint = {
        id: uuidv4(),
        documentId,
        agency,
        content: complaintResult.content || generateFallbackComplaint(doc, agency),
        relatedDocuments: relatedDocs.map(d => d.id),
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        analysis: {
          violations: complaintResult.violations || []
        }
      };
      console.log('Создан объект жалобы:', complaint);

      // Сохранение в БД
      if (!db.data.complaints) {
        db.data.complaints = [];
      }
      db.data.complaints.push(complaint);
      await db.write();
      console.log('Жалоба сохранена в БД');

      // Обновление документа
      if (!doc.complaints) {
        doc.complaints = [];
      }
      doc.complaints.push(complaint.id);
      await db.write();
      console.log('Документ обновлен');

      res.status(201).json(complaint);
    } catch (err) {
      console.error('Ошибка генерации жалобы:', err);
      res.status(500).json({ message: err.message });
    }
  });

  // Вспомогательный метод для генерации содержания жалобы
  function generateFallbackComplaint(docOrCurrentDoc, agency) {
    // Определяем, какой формат данных мы получили
    const isCurrentDocFormat = docOrCurrentDoc && docOrCurrentDoc.fullText !== undefined;
    
    if (isCurrentDocFormat) {
      // Новый формат данных
      return `Жалоба в ${agency}\n\n` +
        `Документ: ${docOrCurrentDoc.summary || "Без описания"}\n` +
        `Дата: ${new Date().toLocaleDateString()}\n\n` +
        `Текст: ${docOrCurrentDoc.fullText ? docOrCurrentDoc.fullText.substring(0, 500) : "Нет текста"}...`;
    } else {
      // Старый формат данных
      return `Жалоба в ${agency}\n\n` +
        `Документ: ${docOrCurrentDoc.summary || "Без описания"}\n` +
        `Дата: ${docOrCurrentDoc.documentDate || "Не указана"}\n\n` +
        `Текст: ${docOrCurrentDoc.originalText ? docOrCurrentDoc.originalText.substring(0, 500) : "Нет текста"}...`;
    }
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