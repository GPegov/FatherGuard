<template>
  <div class="autocomplete-wrapper" ref="wrapperRef">
    <input
      ref="inputRef"
      v-model="searchTerm"
      type="text"
      :placeholder="placeholder"
      class="autocomplete-input"
      @input="onInput"
      @focus="onFocus"
      @click="onClick"
      @blur="onBlur"
      @keydown.down.prevent="onArrowDown"
      @keydown.up.prevent="onArrowUp"
      @keydown.enter.prevent="onEnter"
      @keydown.esc="onEscape"
    />
    <div v-if="showSuggestions" class="suggestions-container">
      <ul v-if="filteredAgencies.length > 0" class="suggestions-list">
        <li
          v-for="(agency, index) in filteredAgencies"
          :key="index"
          :class="['suggestion-item', { 'selected': index === selectedIndex }]"
          @click="selectAgency(agency)"
          @mouseenter="selectedIndex = index"
        >
          {{ agency }}
        </li>
      </ul>
      <div v-else class="no-suggestions">
        {{ noSuggestionsText }}
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';

export default {
  name: 'AgencyAutocomplete',
  props: {
    agencies: {
      type: Array,
      required: true,
      default: () => []
    },
    modelValue: {
      type: String,
      default: ''
    },
    placeholder: {
      type: String,
      default: 'Начните вводить название отделения ФССП...'
    },
    noSuggestionsText: {
      type: String,
      default: 'Отделения ФССП не найдены'
    }
  },
  emits: ['update:modelValue', 'agencySelected'],
  setup(props, { emit }) {
    const inputRef = ref(null);
    const wrapperRef = ref(null);
    const searchTerm = ref(props.modelValue || '');
    const showSuggestions = ref(false);
    const selectedIndex = ref(-1);

    // Фильтрация агентств по введённому тексту
    const filteredAgencies = computed(() => {
      if (!searchTerm.value) return props.agencies;
      const term = searchTerm.value.toLowerCase();
      return props.agencies.filter(agency => 
        agency.toLowerCase().includes(term)
      );
    });

    const onFocus = () => {
      showSuggestions.value = true;
      selectedIndex.value = -1;
    };

    const onClick = () => {
      if (!showSuggestions.value) {
        showSuggestions.value = true;
        selectedIndex.value = -1;
      }
    };

    const onInput = () => {
      showSuggestions.value = true;
      selectedIndex.value = -1;
      emit('update:modelValue', searchTerm.value);
    };

    const onBlur = (event) => {
      setTimeout(() => {
        if (!event.relatedTarget || !event.relatedTarget.closest('.autocomplete-wrapper')) {
          showSuggestions.value = false;
          selectedIndex.value = -1;
        }
      }, 200);
    };

    const selectAgency = (agency) => {
      searchTerm.value = agency;
      showSuggestions.value = false;
      selectedIndex.value = -1;
      emit('update:modelValue', agency);
      emit('agencySelected', agency);
    };

    // Обработчик стрелок
    const onArrowDown = () => {
      if (!showSuggestions.value) showSuggestions.value = true;
      if (filteredAgencies.value.length > 0) {
        selectedIndex.value = (selectedIndex.value + 1) % filteredAgencies.value.length;
        nextTick(scrollToSelectedIndex);
      }
    };

    const onArrowUp = () => {
      if (!showSuggestions.value) showSuggestions.value = true;
      if (filteredAgencies.value.length > 0) {
        selectedIndex.value = selectedIndex.value <= 0
          ? filteredAgencies.value.length - 1
          : selectedIndex.value - 1;
        nextTick(scrollToSelectedIndex);
      }
    };

    const onEnter = () => {
      if (showSuggestions.value && selectedIndex.value >= 0) {
        selectAgency(filteredAgencies.value[selectedIndex.value]);
      } else if (filteredAgencies.value.length > 0) {
        selectAgency(filteredAgencies.value[0]);
      }
    };

    const onEscape = () => {
      showSuggestions.value = false;
      selectedIndex.value = -1;
    };

    const scrollToSelectedIndex = () => {
      if (selectedIndex.value === -1 || !wrapperRef.value) return;
      const list = wrapperRef.value.querySelector('.suggestions-list');
      if (!list) return;

      const items = list.querySelectorAll('.suggestion-item');
      if (items[selectedIndex.value]) {
        const item = items[selectedIndex.value];
        const itemTop = item.offsetTop;
        const itemBottom = itemTop + item.offsetHeight;
        const containerHeight = list.clientHeight;
        const scrollTop = list.scrollTop;
        const scrollBottom = scrollTop + containerHeight;

        if (itemTop < scrollTop) {
          list.scrollTop = itemTop;
        } else if (itemBottom > scrollBottom) {
          list.scrollTop = itemBottom - containerHeight;
        }
      }
    };

    // Синхронизация с внешним значением
    watch(() => props.modelValue, (newVal) => {
      if (newVal !== searchTerm.value) {
        searchTerm.value = newVal || '';
      }
    });

    // Клик вне компонента
    const handleClickOutside = (event) => {
      if (wrapperRef.value && !wrapperRef.value.contains(event.target)) {
        showSuggestions.value = false;
        selectedIndex.value = -1;
      }
    };

    onMounted(() => {
      document.addEventListener('click', handleClickOutside);
    });

    onUnmounted(() => {
      document.removeEventListener('click', handleClickOutside);
    });

    return {
      inputRef,
      wrapperRef,
      searchTerm,
      showSuggestions,
      selectedIndex,
      filteredAgencies,
      onInput,
      onFocus,
      onBlur,
      onClick,
      onArrowDown,
      onArrowUp,
      onEnter,
      onEscape,
      selectAgency,
      scrollToSelectedIndex
    };
  }
};
</script>

<style scoped>
.autocomplete-wrapper {
  position: relative;
  width: 100%;
}

.autocomplete-input {
  width: 100%;
  padding: 10px 15px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1em;
  background-color: white;
  box-sizing: border-box;
}

.autocomplete-input:focus {
  outline: none;
  border-color: #42b983;
  box-shadow: 0 0 0 2px rgba(66, 185, 131, 0.2);
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
  border-radius: 0 0 4px 4px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  max-height: 200px;
  overflow-y: auto;
}

.suggestions-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.suggestion-item {
  padding: 10px 15px;
  cursor: pointer;
  border-bottom: 1px solid #eee;
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-item:hover,
.suggestion-item.selected {
  background-color: #f5f5f5;
}

.suggestion-item.selected {
  background-color: #e8f5e9;
}

.no-suggestions {
  padding: 10px 15px;
  color: #666;
  font-style: italic;
}
</style>