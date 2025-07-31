import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

export const useComplaintStore = defineStore('complaint', () => {
  // Состояние
  const complaints = ref([])
  const isLoading = ref(false)
  const error = ref(null)
  const selectedAgencies = ref([])

  // Геттеры
  const agenciesOptions = computed(() => {
    return [
      'ФССП',
      'Прокуратура',
      'Суд (административное исковое заявление)',
      'Уполномоченный по правам человека (омбудсмен)'
      
    ]
  })

  // Базовый URL для API
  const API_BASE_URL = 'http://localhost:3001/api/complaints'

  // Общая функция для обработки ошибок
  const handleError = (error, defaultMessage = 'Произошла ошибка') => {
    const message = error.response?.data?.message || error.message || defaultMessage
    error.value = message
    console.error('API Error:', error)
    throw new Error(message)
  }

  // Действия
  const generateAIComplaint = async (payload) => {
  const formData = new FormData();
  formData.append('text', payload.comment);
  formData.append('agency', payload.agency);
  formData.append('documentId', payload.documentId);
  
  payload.files.forEach(file => {
    formData.append('attachments', file);
  });

  const response = await axios.post('/api/complaints/ai-complaint', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  
  return response.data;
};

  const fetchComplaints = async () => {
    isLoading.value = true
    try {
      const { data } = await axios.get(API_BASE_URL)
      complaints.value = data
      return data
    } catch (err) {
      handleError(err, 'Ошибка загрузки жалоб')
    } finally {
      isLoading.value = false
    }
  }

  const exportComplaint = async (complaintId, format = 'txt') => {
    try {
      const { data } = await axios.get(
        `${API_BASE_URL}/${complaintId}/export?format=${format}`,
        { responseType: 'blob' }
      )
      return data
    } catch (err) {
      handleError(err, 'Ошибка при экспорте жалобы')
    }
  }

  const deleteComplaint = async (id) => {
    isLoading.value = true
    try {
      await axios.delete(`${API_BASE_URL}/${id}`)
      // Оптимистичное обновление UI
      complaints.value = complaints.value.filter(c => c.id !== id)
      return true
    } catch (err) {
      handleError(err, 'Ошибка при удалении жалобы')
      return false
    } finally {
      isLoading.value = false
    }
  }

  return {
    // State
    complaints,
    isLoading,
    error,
    selectedAgencies,
    
    // Getters
    agenciesOptions,
    
    // Actions
    generateAIComplaint,
    fetchComplaints,
    exportComplaint,
    deleteComplaint
  }
})