<template>
  <div class="complaints-list">
    <div class="header">
      <h1>Сформированные жалобы</h1>
      <router-link to="/documents" class="back-btn">← К документам</router-link>
    </div>

    <!-- Отладочная информация -->
    <div v-if="debugMode" class="debug-info">
      <pre>Store state: {{ JSON.stringify(complaintStore.$state, null, 2) }}</pre>
    </div>

    <div v-if="isLoading" class="loading">
      <p>Загрузка жалоб...</p>
      <progress indeterminate></progress>
    </div>

    <div v-else-if="!complaints.length" class="empty">
      <p>Нет сформированных жалоб</p>
      <router-link to="/" class="create-link">Создать первую жалобу</router-link>
    </div>

    <ul v-else class="complaints">
      <li v-for="complaint in complaints" :key="complaint.id" class="complaint-item">
        <div class="complaint-card">
          <h3>{{ complaint.agency }}</h3>
          <p class="date">{{ formatDate(complaint.createdAt) }}</p>
          <p class="preview">{{ complaint.content.substring(0, 100) }}...</p>
          <div class="actions">
            <button @click="exportComplaint(complaint.id, 'txt')" class="export-btn">
              TXT
            </button>
            <button @click="exportComplaint(complaint.id, 'doc')" class="export-btn">
              DOC
            </button>
            <button 
              @click.stop="confirmDelete(complaint)" 
              class="delete-btn"
            >
              Удалить
            </button>
          </div>
        </div>
      </li>
    </ul>

    <!-- Модальное окно подтверждения удаления -->
    <div v-if="showDeleteModal" class="modal-overlay">
      <div class="modal-content">
        <h3>Подтверждение удаления</h3>
        <p>Вы уверены, что хотите удалить жалобу в "{{ complaintToDelete?.agency }}"?</p>
        <div class="modal-actions">
          <button @click="deleteComplaint" class="confirm-btn">Да, удалить</button>
          <button @click="showDeleteModal = false" class="cancel-btn">Отмена</button>
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
import { useComplaintStore } from '@/stores/complaintStore'
import { saveAs } from 'file-saver'
import NotificationToast from '@/components/ui/NotificationToast.vue'


// Debug
const debugMode = ref(false)

// Store
const complaintStore = useComplaintStore()
const isLoading = ref(false)
const complaints = computed(() => complaintStore.complaints || [])

// Удаление жалоб
const showDeleteModal = ref(false)
const complaintToDelete = ref(null)
const showNotification = ref(false)
const notificationMessage = ref('')
const notificationType = ref('success')

const confirmDelete = (complaint) => {
  complaintToDelete.value = complaint
  showDeleteModal.value = true
}

const deleteComplaint = async () => {
  if (complaintToDelete.value) {
    try {
      await complaintStore.deleteComplaint(complaintToDelete.value.id)
      notificationMessage.value = 'Жалоба успешно удалена'
      notificationType.value = 'success'
    } catch (error) {
      notificationMessage.value = 'Ошибка при удалении жалобы'
      notificationType.value = 'error'
      console.error('Ошибка удаления:', error)
    } finally {
      showNotification.value = true
      showDeleteModal.value = false
    }
  }
}



const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('ru-RU')
}

const exportComplaint = async (complaintId, format) => {
  try {
    const blob = await complaintStore.exportComplaint(complaintId, format)
    const complaint = complaints.value.find(c => c.id === complaintId)
    const filename = `Жалоба_${complaint.agency}_${formatDate(complaint.createdAt)}.${format}`
    saveAs(blob, filename)
  } catch (error) {
    console.error('Export error:', error)
    notificationMessage.value = 'Ошибка при экспорте'
    notificationType.value = 'error'
    showNotification.value = true
  }
}

// Lifecycle
onMounted(async () => {
  isLoading.value = true
  try {
    await complaintStore.fetchComplaints()
  } catch (error) {
    console.error('Failed to load complaints:', error)
    notificationMessage.value = 'Ошибка загрузки жалоб'
    notificationType.value = 'error'
    showNotification.value = true
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
.complaints-list {
  max-width: 800px;
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
  color: #2c3e50;
}

.back-btn {
  color: #42b983;
  text-decoration: none;
  font-weight: bold;
}

.loading, .empty {
  text-align: center;
  padding: 40px;
  color: #666;
}

.create-link {
  color: #42b983;
  text-decoration: none;
  font-weight: bold;
}

.complaints {
  list-style: none;
  padding: 0;
  display: grid;
  gap: 15px;
}

.complaint-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.complaint-card h3 {
  margin-top: 0;
  color: #35495e;
}

.date {
  color: #666;
  font-size: 0.9em;
}

.preview {
  color: #333;
  margin: 10px 0;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

.export-btn {
  background: #f5f5f5;
  border: 1px solid #ddd;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
}

.export-btn:hover {
  background: #42b983;
  color: white;
  border-color: #42b983;
}

.delete-btn {
  background: #ff4444;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.delete-btn:hover {
  background: #cc0000;
}

/* Модальное окно */
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

/* Debug styles */
.debug-info {
  background: #f8f8f8;
  padding: 15px;
  margin-bottom: 20px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.8em;
  overflow-x: auto;
}
</style>