<template>
  <transition name="fade">
    <div v-if="show" class="notification-center">
      <div class="notification-content">
        {{ message }}
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({
  message: String,
  type: {
    type: String,
    default: 'success'
  },
  duration: {
    type: Number,
    default: 3000
  }
})

const show = ref(false)

onMounted(() => {
  show.value = true
  setTimeout(() => {
    show.value = false
  }, props.duration)
})
</script>

<style scoped>
.notification-center {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 2;
  display: flex;
  justify-content: center;
  align-items: center;
}

.notification-content {
  padding: 16px 32px;
  border-radius: 8px;
  background-color: #42b983;
  color: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  font-size: 1.1em;
  max-width: 80%;
  text-align: center;
}

/* Варианты цветов */
.notification-content.success {
  background-color: #42b983;
}

.notification-content.error {
  background-color: #ff4444;
}

.notification-content.warning {
  background-color: #ffbb33;
}

/* Анимации */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Дополнительная анимация масштаба */
.fade-enter-active .notification-content {
  animation: scale-in 0.3s ease;
}

.fade-leave-active .notification-content {
  animation: scale-out 0.3s ease;
}

@keyframes scale-in {
  from {
    transform: scale(0.9);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes scale-out {
  from {
    transform: scale(1);
    opacity: 1;
  }
  to {
    transform: scale(0.9);
    opacity: 0;
  }
}
</style>