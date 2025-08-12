import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { v4 as uuidv4 } from "uuid";
import { saveAs } from "file-saver";
import { useDocumentStore } from "./documentStore";
import aiService from "../../../backend/services/aiService";
import { Packer } from "docx";
import { Document, Paragraph, TextRun } from "docx";

export const useComplaintStore = defineStore("complaint", () => {
  const documentStore = useDocumentStore();

  // Состояние
  const complaints = ref([]);
  const isLoading = ref(false);
  const error = ref(null);
  const isGenerating = ref(false);
  const isExporting = ref(false);
  const generatedComplaint = ref(null);

  // Геттеры
  const agenciesOptions = computed(() => [
    "Федеральная служба судебных приставов (ФССП)",
    "Прокуратура",
    "Суд (административное исковое заявление)",
    "Уполномоченный по правам человека (омбудсмен)",
  ]);

  const getComplaintsByDocument = computed(() => (documentId) => {
    return complaints.value.filter((c) => c.documentId === documentId);
  });

  // Действия
  const fetchComplaints = async () => {
    isLoading.value = true;
    try {
      // В реальном приложении здесь будет запрос к API
      // Для примера используем локальные данные
      complaints.value = JSON.parse(localStorage.getItem("complaints") || "[]");
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const generateComplaint = async (payload) => {
    isGenerating.value = true;
    error.value = null;

    try {
      const { documentId, agency, instructions } = payload;

      // Получаем документ и связанные документы
      const doc = await documentStore.fetchDocumentById(documentId);
      const relatedDocs = documentStore.documents.filter(
        (d) => d.date <= doc.date && d.id !== documentId
      );

      // Генерируем жалобу через AI сервис
      const result = await aiService.generateComplaint(
        doc.originalText,
        agency,
        relatedDocs.map((d) => d.originalText),
        instructions
      );

      // Формируем объект жалобы
      const newComplaint = {
        id: uuidv4(),
        documentId,
        agency,
        summary: complaintContent.summary, // Краткая суть (п.4)
        verbatimSections: complaintContent.verbatimSections, // Дословные параграфы (п.5)
        relatedDocuments: relatedDocs.map((d) => ({
          id: d.id,
          date: d.date, // Дата отправления (п.6а)
          agency: d.senderAgency, // Ведомство-отправитель (п.6б)
          summary: d.documentSummary, // Краткая суть документа (п.6в)
          text: d.fullText, // Полный текст (п.6г)
          verbatimSections: d.verbatimSections, // Дословные параграфы (п.6д)
        })),
        status: "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Сохраняем в хранилище
      complaints.value.unshift(newComplaint);
      generatedComplaint.value = newComplaint;

      // Сохраняем в локальное хранилище (в реальном приложении - API запрос)
      localStorage.setItem("complaints", JSON.stringify(complaints.value));

      return newComplaint;
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      isGenerating.value = false;
    }
  };

  const saveComplaint = async (complaintData) => {
    isLoading.value = true;
    try {
      const index = complaints.value.findIndex(
        (c) => c.id === complaintData.id
      );
      if (index !== -1) {
        complaints.value[index] = {
          ...complaints.value[index],
          ...complaintData,
          updatedAt: new Date().toISOString(),
        };
      } else {
        complaints.value.unshift({
          ...complaintData,
          id: uuidv4(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      localStorage.setItem("complaints", JSON.stringify(complaints.value));
      return complaints.value[index !== -1 ? index : 0];
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const exportComplaint = async (complaintId, format = "txt") => {
    isExporting.value = true;
    try {
      const complaint = complaints.value.find((c) => c.id === complaintId);
      if (!complaint) throw new Error("Жалоба не найдена");

      if (format === "txt") {
        const blob = new Blob([complaint.content], { type: "text/plain" });
        saveAs(
          blob,
          `Жалоба_${complaint.agency}_${formatDate(complaint.createdAt)}.txt`
        );
        return blob;
      }

      if (format === "doc") {
        const doc = new Document({
          sections: [
            {
              properties: {},
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: complaint.content,
                      size: 24,
                    }),
                  ],
                }),
              ],
            },
          ],
        });

        const buffer = await Packer.toBuffer(doc);
        const blob = new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });

        saveAs(
          blob,
          `Жалоба_${complaint.agency}_${formatDate(complaint.createdAt)}.docx`
        );
        return blob;
      }

      throw new Error("Неподдерживаемый формат экспорта");
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      isExporting.value = false;
    }
  };

  const deleteComplaint = async (id) => {
    isLoading.value = true;
    try {
      complaints.value = complaints.value.filter((c) => c.id !== id);
      localStorage.setItem("complaints", JSON.stringify(complaints.value));
      return true;
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const updateComplaintStatus = async (id, status) => {
    try {
      const index = complaints.value.findIndex((c) => c.id === id);
      if (index !== -1) {
        complaints.value[index].status = status;
        complaints.value[index].updatedAt = new Date().toISOString();
        localStorage.setItem("complaints", JSON.stringify(complaints.value));
      }
      return complaints.value[index];
    } catch (err) {
      error.value = err.message;
      throw err;
    }
  };

  // Вспомогательные функции
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("ru-RU");
  };

  return {
    // Состояние
    complaints,
    isLoading,
    error,
    isGenerating,
    isExporting,
    generatedComplaint,

    // Геттеры
    agenciesOptions,
    getComplaintsByDocument,

    // Действия
    fetchComplaints,
    generateComplaint,
    saveComplaint,
    exportComplaint,
    deleteComplaint,
    updateComplaintStatus,
  };
});

// import { defineStore } from 'pinia';
// import { ref, computed } from 'vue';
// import axios from 'axios';
// import { saveAs } from 'file-saver';

// export const useComplaintStore = defineStore('complaint', () => {
//   // Состояние
//   const complaints = ref([]);
//   const isLoading = ref(false);
//   const error = ref(null);
//   const isGenerating = ref(false);
//   const isExporting = ref(false);

//   // Геттеры
//   const agenciesOptions = computed(() => [
//     'ФССП',
//     'Прокуратура',
//     'Суд (административное исковое заявление)',
//     'Уполномоченный по правам человека (омбудсмен)'
//   ]);

//   const draftedComplaints = computed(() =>
//     complaints.value.filter(c => c.status === 'draft')
//   );

//   const sentComplaints = computed(() =>
//     complaints.value.filter(c => c.status === 'sent')
//   );

//   // Действия
//   const fetchComplaints = async () => {
//     isLoading.value = true;
//     try {
//       const { data } = await axios.get('/api/complaints');
//       complaints.value = data;
//     } catch (err) {
//       error.value = err.response?.data?.message || err.message;
//       throw err;
//     } finally {
//       isLoading.value = false;
//     }
//   };

//   const generateComplaint = async (payload) => {
//     isGenerating.value = true;
//     try {
//       const { data } = await axios.post('/api/complaints/generate', {
//         documentId: payload.documentId,
//         agency: payload.agency,
//         instructions: payload.instructions,
//         relatedDocumentId: null,
//       });

//       complaints.value.unshift(data);
//       return data;
//     } catch (err) {
//       error.value = err.response?.data?.message || err.message;
//       throw err;
//     } finally {
//       isGenerating.value = false;
//     }
//   };

//   const exportComplaint = async (complaintId, format = 'txt') => {
//     isExporting.value = true;
//     try {
//       const response = await axios.get(
//         `/api/complaints/${complaintId}/export?format=${format}`,
//         { responseType: format === 'doc' ? 'blob' : 'text' }
//       );

//       const complaint = complaints.value.find(c => c.id === complaintId);
//       const fileName = `Жалоба_${complaint.agency}_${new Date(complaint.createdAt).toLocaleDateString('ru-RU')}.${format}`;

//       if (format === 'doc') {
//         saveAs(response.data, fileName);
//       } else {
//         const blob = new Blob([response.data], { type: 'text/plain;charset=utf-8' });
//         saveAs(blob, fileName);
//       }

//       return response.data;
//     } catch (err) {
//       error.value = err.response?.data?.message || err.message;
//       throw err;
//     } finally {
//       isExporting.value = false;
//     }
//   };

//   const deleteComplaint = async (id) => {
//     isLoading.value = true;
//     try {
//       await axios.delete(`/api/complaints/${id}`);
//       complaints.value = complaints.value.filter(c => c.id !== id);
//       return true;
//     } catch (err) {
//       error.value = err.response?.data?.message || err.message;
//       throw err;
//     } finally {
//       isLoading.value = false;
//     }
//   };

//   const updateComplaintStatus = async (id, status) => {
//     try {
//       const { data } = await axios.patch(`/api/complaints/${id}`, { status });
//       const index = complaints.value.findIndex(c => c.id === id);
//       if (index !== -1) {
//         complaints.value[index] = data;
//       }
//       return data;
//     } catch (err) {
//       error.value = err.response?.data?.message || err.message;
//       throw err;
//     }
//   };

//   return {
//     // Состояние
//     complaints,
//     isLoading,
//     error,
//     isGenerating,
//     isExporting,

//     // Геттеры
//     agenciesOptions,
//     draftedComplaints,
//     sentComplaints,

//     // Действия
//     fetchComplaints,
//     generateComplaint,
//     exportComplaint,
//     deleteComplaint,
//     updateComplaintStatus
//   };
// });
