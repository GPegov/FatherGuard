import { defineStore } from "pinia";
import { ref, computed } from "vue";
import axios from "axios";
import { saveAs } from "file-saver";

const API_BASE = "http://localhost:3001";

export const useComplaintStore = defineStore("complaint", () => {
  // Состояние
  const complaints = ref([]);
  const isLoading = ref(false);
  const error = ref(null);
  const isGenerating = ref(false);
  const isExporting = ref(false);

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
    error.value = null;
    try {
      const { data } = await axios.get(`${API_BASE}/api/complaints`);
      complaints.value = data;
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  const generateComplaint = async (documentId, agency, instructions = "") => {
    isGenerating.value = true;
    error.value = null;

    try {
      const { data } = await axios.post(`${API_BASE}/api/complaints/generate`, {
        documentId,
        agency,
        instructions
      });

      complaints.value.unshift(data);
      return data;
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      isGenerating.value = false;
    }
  };

  const exportComplaint = async (complaintId, format = "txt") => {
    isExporting.value = true;
    error.value = null;
    try {
      const response = await axios.get(
        `${API_BASE}/api/complaints/${complaintId}/export?format=${format}`,
        { responseType: format === "doc" ? "blob" : "text" }
      );

      const complaint = complaints.value.find(c => c.id === complaintId);
      const fileName = `Жалоба_${complaint.agency}_${new Date(complaint.createdAt).toLocaleDateString('ru-RU')}.${format}`;

      if (format === "doc") {
        saveAs(response.data, fileName);
      } else {
        const blob = new Blob([response.data], { type: "text/plain;charset=utf-8" });
        saveAs(blob, fileName);
      }

      return response.data;
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      isExporting.value = false;
    }
  };

  const deleteComplaint = async (id) => {
    isLoading.value = true;
    error.value = null;
    try {
      await axios.delete(`${API_BASE}/api/complaints/${id}`);
      complaints.value = complaints.value.filter((c) => c.id !== id);
      return true;
    } catch (err) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    // Состояние
    complaints,
    isLoading,
    error,
    isGenerating,
    isExporting,

    // Геттеры
    agenciesOptions,
    getComplaintsByDocument,

    // Действия
    fetchComplaints,
    generateComplaint,
    exportComplaint,
    deleteComplaint,
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
