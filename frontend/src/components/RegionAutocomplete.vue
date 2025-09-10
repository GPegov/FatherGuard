<template>
  <div class="autocomplete-wrapper">
    <div class="input-with-code">
      <input
        ref="inputRef"
        v-model="searchTerm"
        type="text"
        placeholder="Начните вводить регион..."
        class="autocomplete-input"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
        @keydown.down.prevent="onArrowDown"
        @keydown.up.prevent="onArrowUp"
        @keydown.enter.prevent="onEnter"
        @keydown.esc="onEscape"
      />
      <div v-if="selectedRegionCode" class="region-code">
        {{ selectedRegionCode }}
      </div>
      <button 
        v-if="searchTerm && searchTerm.length > 0" 
        @click="clearInput" 
        class="clear-button"
        type="button"
      >
        ✕
      </button>
    </div>
    <div v-if="showSuggestions" class="suggestions-container">
      <ul v-if="filteredRegions.length > 0" class="suggestions-list">
        <li
          v-for="(region, index) in filteredRegions"
          :key="region.name"
          :class="['suggestion-item', { 'selected': index === selectedIndex }]"
          @click="selectRegion(region)"
          @mouseenter="selectedIndex = index"
        >
          <div class="region-name">{{ region.name }}</div>
          <div class="region-code-small">{{ region.code }}</div>
        </li>
      </ul>
      <div v-else class="no-suggestions">
        Регионы не найдены
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue';

export default {
  name: 'RegionAutocomplete',
  props: {
    regions: {
      type: Array,
      required: true
    },
    modelValue: {
      type: String,
      default: ''
    }
  },
  emits: ['update:modelValue', 'regionSelected'],
  setup(props, { emit }) {
    const inputRef = ref(null);
    const searchTerm = ref(props.modelValue || '');
    const showSuggestions = ref(false);
    const selectedIndex = ref(-1);

    // Фильтрация регионов по введенному тексту
    const filteredRegions = computed(() => {
      if (!searchTerm.value) {
        return props.regions; // Показываем все регионы если поле пустое
      }
      
      const term = searchTerm.value.toLowerCase();
      return props.regions
        .filter(region => region.name.toLowerCase().includes(term));
        // Не ограничиваем количество результатов
    });

    // Получение кода выбранного региона
    const selectedRegionCode = computed(() => {
      if (!searchTerm.value) return '';
      const region = props.regions.find(r => r.name === searchTerm.value);
      return region ? region.code : '';
    });

    // Обработчики событий
    const onInput = () => {
      showSuggestions.value = true;
      selectedIndex.value = -1;
      emit('update:modelValue', searchTerm.value);
    };

    const onFocus = () => {
      showSuggestions.value = true;
      selectedIndex.value = -1;
    };

    const onBlur = () => {
      // Небольшая задержка для возможности клика по suggestion
      setTimeout(() => {
        showSuggestions.value = false;
        selectedIndex.value = -1;
      }, 200);
    };

    const onArrowDown = () => {
      if (!showSuggestions.value) {
        showSuggestions.value = true;
      }
      
      if (filteredRegions.value.length > 0) {
        selectedIndex.value = (selectedIndex.value + 1) % filteredRegions.value.length;
      }
    };

    const onArrowUp = () => {
      if (!showSuggestions.value) {
        showSuggestions.value = true;
      }
      
      if (filteredRegions.value.length > 0) {
        selectedIndex.value = selectedIndex.value <= 0 
          ? filteredRegions.value.length - 1 
          : selectedIndex.value - 1;
      }
    };

    const onEnter = () => {
      if (showSuggestions.value && selectedIndex.value >= 0) {
        selectRegion(filteredRegions.value[selectedIndex.value]);
      } else if (filteredRegions.value.length > 0) {
        // Если ничего не выбрано, выбираем первый элемент
        selectRegion(filteredRegions.value[0]);
      }
    };

    const onEscape = () => {
      showSuggestions.value = false;
      selectedIndex.value = -1;
    };

    const selectRegion = (region) => {
      searchTerm.value = region.name;
      showSuggestions.value = false;
      selectedIndex.value = -1;
      emit('update:modelValue', region.name);
      emit('regionSelected', region.name);
      inputRef.value?.blur();
    };

    // Очистка поля ввода
    const clearInput = () => {
      searchTerm.value = '';
      showSuggestions.value = true;
      selectedIndex.value = -1;
      emit('update:modelValue', '');
      inputRef.value?.focus();
    };

    // Следим за изменением внешнего значения
    watch(() => props.modelValue, (newVal) => {
      if (newVal !== searchTerm.value) {
        searchTerm.value = newVal || '';
      }
    });

    return {
      inputRef,
      searchTerm,
      showSuggestions,
      selectedIndex,
      filteredRegions,
      selectedRegionCode,
      onInput,
      onFocus,
      onBlur,
      onArrowDown,
      onArrowUp,
      onEnter,
      onEscape,
      selectRegion,
      clearInput
    };
  }
};
</script>

<style scoped>
.autocomplete-wrapper {
  position: relative;
  width: 100%;
}

.input-with-code {
  position: relative;
  display: flex;
  align-items: center;
}

.autocomplete-input {
  width: 100%;
  padding: 12px 15px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 16px;
  background-color: white;
  box-sizing: border-box;
  padding-right: 85px; /* Increased padding to accommodate the clear button */
  position: relative;
  z-index: 0;
}

.autocomplete-input:focus {
  outline: none;
  border-color: #4CAF50;
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
}

.region-code {
  position: absolute;
  right: 50px; /* Moved left to avoid overlapping with clear button */
  top: 50%;
  transform: translateY(-50%);
  background-color: #4CAF50;
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  z-index: 1;
}

.clear-button {
  position: absolute;
  right: 15px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #999;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  z-index: 2;
  transition: all 0.2s ease;
  opacity: 0.7;
}

.clear-button:hover {
  background-color: #f0f0f0;
  color: #666;
  opacity: 1;
}

.suggestions-container {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 1000;
  background: white;
  border: 1px solid #ddd;
  border-top: none;
  border-radius: 0 0 6px 6px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  max-height: 300px;
  overflow-y: auto;
}

.suggestions-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.suggestion-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 15px;
  cursor: pointer;
  border-bottom: 1px solid #eee;
}

.suggestion-item:last-child {
  border-bottom: none;
}

.region-name {
  flex: 1;
}

.region-code-small {
  background-color: #e0e0e0;
  color: #333;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.suggestion-item:hover,
.suggestion-item.selected {
  background-color: #f5f5f5;
}

.suggestion-item.selected {
  background-color: #e8f5e9;
}

.no-suggestions {
  padding: 12px 15px;
  color: #666;
  font-style: italic;
}
</style>