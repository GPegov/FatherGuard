// src/stores/complaintStore.js
import { defineStore } from 'pinia'
import { useDocumentStore } from './documentStore'

export const useComplaintStore = defineStore('complaint', {
  state: () => ({
    agencies: [
     'Федеральная Служба Судебных Приставов',
     'Прокуратура', 
     'Суд (административное исковое заявление)',
     'Уполномоченный по правам человека (омбудсмен)'
    ],
    generatedComplaint: null,
    isGenerating: false,
    error: null
  }),

  getters: {
    agenciesOptions: (state) => state.agencies,
    hasGeneratedComplaint: (state) => !!state.generatedComplaint
  },

  actions: {
    async generateComplaint(payload) {
      this.isGenerating = true
      this.error = null
      
      try {
        // Здесь будет логика генерации жалобы через API или AI
        // Для примера - симуляция генерации
        
        const documentStore = useDocumentStore()
        const document = await documentStore.fetchDocumentById(payload.documentId)
        
        // Симуляция генерации жалобы (в реальном приложении здесь будет вызов API)
        const mockComplaint = `Жалоба на документ №${payload.documentId}
        
Дата: ${new Date().toLocaleDateString('ru-RU')}
Ведомство: ${payload.agency}
От: [Ваше имя]
Адресат: ${payload.agency}

Суть жалобы:
${document.summary || 'Не указана краткая суть документа'}

Дополнительные сведения:
${payload.instructions || 'Нет дополнительных инструкций'}

Приложения:
- Оригинал документа
- Сопроводительные материалы

С уважением,
[Ваше имя]`

        this.generatedComplaint = mockComplaint
        return { content: mockComplaint }
        
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.isGenerating = false
      }
    },

    async saveComplaintToDocument(payload) {
      try {
        const documentStore = useDocumentStore()
        // Здесь будет логика сохранения жалобы в документ
        // Пример:
        await documentStore.addComplaintToDocument(payload.documentId, {
          agency: payload.agency,
          content: payload.content,
          createdAt: new Date().toISOString()
        })
      } catch (error) {
        this.error = error.message
        throw error
      }
    }
  }
})









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