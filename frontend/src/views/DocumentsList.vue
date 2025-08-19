<template>
  <div class="documents-list">
    <div class="header">
      <h1>Архив входящих документов</h1>
      <router-link to="/" class="new-doc-btn">+ Новый документ</router-link>
    </div>

    <div class="filters">
      <input v-model="searchQuery" type="text" placeholder="Поиск по тексту" class="search-input" />
      <select v-model="selectedAgency" class="agency-select">
        <option value="">Все ведомства</option>
        <option v-for="agency in agenciesList" :key="agency" :value="agency">
          {{ agency }}
        </option>
      </select>
      <button @click="applyFilters" class="filter-btn">Применить</button>
      <button @click="resetFilters" class="filter-btn">Сбросить</button>
    </div>

    <div v-if="isLoading" class="loading">Загрузка документов...</div>
    <div v-else-if="filteredDocuments.length === 0" class="empty">
      Нет документов, соответствующих фильтрам
    </div>


    <ul v-else class="documents">
      <li 
        v-for="doc in filteredDocuments" 
        :key="doc.id" 
        class="document-item"
      >
        <div class="document-main" @click="viewDocument(doc.id)">
          <div class="document-meta">
            <span class="document-date">{{ formatDate(doc.date) }}</span>
            <span class="document-agency">{{ doc.agency }}</span>
          </div>
          <p class="document-summary">
            {{ doc.summary || doc.originalText.substring(0, 100) + '...' }}
          </p>
        </div>
        <div class="document-actions">
          <button 
            @click.stop="analyzeDocument(doc.id)" 
            class="analyze-btn" 
            :disabled="isAnalyzing"
          >
            {{ isAnalyzing ? 'Анализ...' : 'Проверить законность' }}
          </button>
          <button 
            @click.stop="confirmDelete(doc.id)" 
            class="delete-btn"
          >
            Удалить
          </button>
        </div>
      </li>
    </ul>


    <!-- Модальное окно подтверждения удаления -->
    <div v-if="showDeleteModal" class="modal-overlay">
      <div class="modal-content">
        <h3>Подтверждение удаления</h3>
        <p>Вы уверены, что хотите удалить этот документ?</p>
        <div class="modal-actions">
          <button @click="deleteDocument" class="confirm-btn">Да, удалить</button>
          <button @click="showDeleteModal = false" class="cancel-btn">Отмена</button>
        </div>
      </div>
    </div>



    <div v-if="showComplaintDialog" class="complaint-dialog">
      <div class="dialog-content">
        <h3>Выберите ведомство для жалобы</h3>
        <select v-model="selectedComplaintAgency" class="agency-select">
          <option v-for="agency in complaintAgencies" :key="agency" :value="agency">
            {{ agency }}
          </option>
        </select>
        <div class="dialog-actions">
          <button @click="generateComplaint" class="action-btn primary">
            Сформировать жалобу
          </button>
          <button @click="showComplaintDialog = false" class="action-btn">
            Отмена
          </button>
        </div>
      </div>
    </div>

    <NotificationToast 
      v-if="showNotification"
      :message="notificationMessage"
      :type="notificationType"
      :duration="1500"
      @close="showNotification = false"
    />

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useDocumentStore } from '@/stores/documentStore'
import { useComplaintStore } from '@/stores/complaintStore'
import { useRouter } from 'vue-router'
import NotificationToast from '@/components/ui/NotificationToast.vue'

const documentStore = useDocumentStore()
const complaintStore = useComplaintStore()
const router = useRouter()
const showNotification = ref(false)
const notificationMessage = ref('')
const notificationType = ref('success')

const isLoading = ref(false)
const isAnalyzing = ref(false)
const searchQuery = ref('')
const selectedAgency = ref('')
const showComplaintDialog = ref(false)
const selectedComplaintAgency = ref('')
const currentDocumentId = ref(null)

// Для удаления документов
const showDeleteModal = ref(false)
const documentToDelete = ref(null)

const confirmDelete = (id) => {
  documentToDelete.value = id
  showDeleteModal.value = true
}

const deleteDocument = async () => {
  if (documentToDelete.value) {
    try {
      await documentStore.deleteDocument(documentToDelete.value)
      await documentStore.fetchDocuments()
      
      // Показываем уведомление
      notificationMessage.value = 'Документ успешно удалён'
      notificationType.value = 'success'
      showNotification.value = true
    } catch (error) {
      console.error('Ошибка удаления:', error)
      
      // Уведомление об ошибке
      notificationMessage.value = 'Ошибка при удалении документа'
      notificationType.value = 'error'
      showNotification.value = true
    }
  }
  showDeleteModal.value = false
}


const viewDocument = (id) => {
  router.push(`/documents/${id}`)
}

// Загружаем документы при монтировании
onMounted(async () => {
  isLoading.value = true
  try {
    await documentStore.fetchDocuments()
  } finally {
    isLoading.value = false
  }
})

// Получаем список ведомств
const agenciesList = computed(() => documentStore.agenciesList)

// Фильтрация документов
const filteredDocuments = computed(() => {
  return documentStore.documents.filter((doc) => {
    const matchesSearch =
      searchQuery.value === '' ||
      doc.summary.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      doc.originalText.toLowerCase().includes(searchQuery.value.toLowerCase())

    const matchesAgency =
      selectedAgency.value === '' || doc.agency === selectedAgency.value

    return matchesSearch && matchesAgency
  })
})

// Варианты ведомств для жалоб
const complaintAgencies = computed(() => complaintStore.agenciesOptions)

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('ru-RU')
}

const applyFilters = () => {
  // Фильтрация происходит автоматически через computed свойство
}

const resetFilters = () => {
  searchQuery.value = ''
  selectedAgency.value = ''
}

const analyzeDocument = async (docId) => {
  isAnalyzing.value = true;
  currentDocumentId.value = docId;
  try {
    // Выполняем анализ документа через documentStore
    await documentStore.fetchDocumentById(docId);
    await documentStore.analyzeDocument();
    
    // После анализа показываем диалог выбора ведомства
    showComplaintDialog.value = true;
  } catch (error) {
    console.error('Ошибка анализа:', error);
    // Показываем уведомление об ошибке
    notificationMessage.value = 'Ошибка при анализе документа';
    notificationType.value = 'error';
    showNotification.value = true;
  } finally {
    isAnalyzing.value = false;
  }
}

const generateComplaint = async () => {
  if (!selectedComplaintAgency.value || !currentDocumentId.value) return

  try {
    await complaintStore.generateComplaint(
      currentDocumentId.value,
      selectedComplaintAgency.value
    )
    router.push('/complaints')
    
    // Показываем уведомление об успешной генерации
    notificationMessage.value = 'Жалоба успешно сформирована';
    notificationType.value = 'success';
    showNotification.value = true;
  } catch (error) {
    console.error('Ошибка генерации жалобы:', error)
    // Показываем уведомление об ошибке
    notificationMessage.value = 'Ошибка при формировании жалобы';
    notificationType.value = 'error';
    showNotification.value = true;
  } finally {
    showComplaintDialog.value = false
  }
}
</script>

<style scoped>
.documents-list {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

h1 {
  font-size: 1.5em;
  color: #2c3e50;
}

.new-doc-btn {
  background: #42b983;
  color: white;
  padding: 10px 15px;
  border-radius: 4px;
  text-decoration: none;
  font-size: 0.9em;
}

.filters {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  min-width: 200px;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.agency-select {
  min-width: 200px;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.filter-btn {
  background: #f0f0f0;
  border: 1px solid #ddd;
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
}

.documents {
  list-style: none;
  padding: 0;
  margin: 0;
}

.document-item {
  background: white;
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 15px;
  margin-bottom: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: box-shadow 0.2s;
  cursor: pointer;
}

.document-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.document-main {
  flex: 1;
}

.document-meta {
  display: flex;
  gap: 15px;
  margin-bottom: 8px;
  font-size: 0.9em;
  color: #666;
}

.document-date {
  font-weight: bold;
}

.document-agency {
  background: #f0f0f0;
  padding: 2px 8px;
  border-radius: 4px;
}

.document-summary {
  margin: 0;
  line-height: 1.5;
}

.analyze-btn {
  background: #2196f3;
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
  margin-left: 15px;
  white-space: nowrap;
}

.analyze-btn:disabled {
  background: #cccccc;
  cursor: not-allowed;
}

.loading,
.empty {
  text-align: center;
  padding: 40px;
  color: #666;
}

.complaint-dialog {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.dialog-content {
  background: white;
  padding: 25px;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
}

.dialog-content h3 {
  margin-top: 0;
  margin-bottom: 20px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.action-btn {
  padding: 8px 15px;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
}

.action-btn.primary {
  background: #42b983;
  color: white;
  border: none;
}


/* Удаление и модальное окно */

.document-actions {
  display: flex;
  gap: 10px;
  margin-left: 15px;
}

.delete-btn {
  background: #ff4444;
  color: white;
  border: none;
  padding: 8px 15px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.3s;
}

.delete-btn:hover {
  background: #cc0000;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 25px;
  border-radius: 8px;
  max-width: 400px;
  width: 90%;
}

.modal-content h3 {
  margin-top: 0;
  color: #2c3e50;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.confirm-btn {
  background: #ff4444;
  color: white;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.cancel-btn {
  background: #f0f0f0;
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
}


</style>