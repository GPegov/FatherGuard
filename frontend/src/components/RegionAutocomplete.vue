<template>
  <div class="autocomplete-wrapper" ref="wrapperRef">
    <div class="input-with-code">
      <input
        ref="inputRef"
        v-model="searchTerm"
        type="text"
        placeholder="Начните вводить название региона..."
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
      <div v-if="selectedRegionCode" class="region-code">
        {{ selectedRegionCode }}
      </div>
    </div>
    <div v-if="showSuggestions" class="suggestions-container" @click="onSuggestionsClick">
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
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';

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
    const wrapperRef = ref(null);
    const searchTerm = ref(props.modelValue || '');
    const lastSelectedRegion = ref(props.modelValue || ''); // запоминаем последний выбранный
    const showSuggestions = ref(false);
    const selectedIndex = ref(-1);

    // Фильтрация: если пусто — все регионы
    const filteredRegions = computed(() => {
      if (!searchTerm.value) return props.regions;
      const term = searchTerm.value.toLowerCase();
      return props.regions.filter(r => r.name.toLowerCase().includes(term));
    });

    // Получение кода выбранного региона
    const selectedRegionCode = computed(() => {
      if (!searchTerm.value) return '';
      const region = props.regions.find(r => r.name === searchTerm.value);
      return region ? region.code : '';
    });

    // --- ОСНОВНАЯ ФУНКЦИЯ: Прокрутка к региону по центру ---
    const scrollToRegionCenter = async (regionName) => {
      // Убедимся, что список виден
      await nextTick();
      let attempts = 0;
      const maxAttempts = 10;

      const tryScroll = () => {
        const list = wrapperRef.value?.querySelector('.suggestions-list');
        if (!list) {
          if (attempts < maxAttempts) {
            attempts++;
            setTimeout(tryScroll, 50); // попробуем снова
          }
          return;
        }

        const items = list.querySelectorAll('.suggestion-item');
        let targetItem = null;

        for (let item of items) {
          const nameEl = item.querySelector('.region-name');
          if (nameEl && nameEl.textContent.trim() === regionName) {
            targetItem = item;
            break;
          }
        }

        if (!targetItem) {
          console.warn(`Регион "${regionName}" не найден в списке`);
          return;
        }

        const containerHeight = list.clientHeight;
        const itemHeight = targetItem.offsetHeight;
        const itemTop = targetItem.offsetTop;

        // Центр: scrollTop = itemTop - половина высоты окна + половина высоты элемента
        const scrollTop = itemTop - containerHeight / 2 + itemHeight / 2;

        list.scrollTop = Math.max(0, scrollTop);
        console.log(`Прокручено к "${regionName}", offsetTop=${itemTop}, scrollTop=${scrollTop}`);
      };

      tryScroll();
    };

    const onFocus = () => {
      // Сохраняем текущий регион перед сбросом
      if (searchTerm.value) {
        lastSelectedRegion.value = searchTerm.value;
      }
      // Сбрасываем текущий регион при фокусе
      searchTerm.value = '';
      showSuggestions.value = true;
      selectedIndex.value = -1;

      // Приоритет: текущий ввод → последний выбранный
      const regionToScroll = searchTerm.value || lastSelectedRegion.value;

      if (regionToScroll) {
        // Задержка для гарантии отрисовки списка
        nextTick(() => {
          scrollToRegionCenter(regionToScroll);
        });
      }
    };

    const onClick = () => {
      // Сохраняем текущий регион перед сбросом
      if (searchTerm.value) {
        lastSelectedRegion.value = searchTerm.value;
      }
      // Сбрасываем текущий регион при клике на инпут
      searchTerm.value = '';
      showSuggestions.value = true;
      selectedIndex.value = -1;
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
          // Восстанавливаем последний выбранный регион, если пользователь не выбрал новый
          if (!searchTerm.value && lastSelectedRegion.value) {
            searchTerm.value = lastSelectedRegion.value;
            emit('update:modelValue', lastSelectedRegion.value);
          }
        }
      }, 200);
    };

    const selectRegion = (region) => {
      searchTerm.value = region.name;
      lastSelectedRegion.value = region.name;
      showSuggestions.value = false;
      selectedIndex.value = -1;
      emit('update:modelValue', region.name);
      emit('regionSelected', region.name);
    };

    // Обработчик стрелок (для полноты)
    const onArrowDown = () => {
      if (!showSuggestions.value) showSuggestions.value = true;
      if (filteredRegions.value.length > 0) {
        selectedIndex.value = (selectedIndex.value + 1) % filteredRegions.value.length;
        nextTick(scrollToSelectedIndex);
      }
    };

    const onArrowUp = () => {
      if (!showSuggestions.value) showSuggestions.value = true;
      if (filteredRegions.value.length > 0) {
        selectedIndex.value = selectedIndex.value <= 0
          ? filteredRegions.value.length - 1
          : selectedIndex.value - 1;
        nextTick(scrollToSelectedIndex);
      }
    };

    const onEnter = () => {
      if (showSuggestions.value && selectedIndex.value >= 0) {
        selectRegion(filteredRegions.value[selectedIndex.value]);
      } else if (filteredRegions.value.length > 0) {
        selectRegion(filteredRegions.value[0]);
      }
    };

    const onEscape = () => {
      showSuggestions.value = false;
      selectedIndex.value = -1;
    };

    const onSuggestionsClick = (event) => {
      // Если клик был непосредственно на контейнере (а не на элементе списка), сбрасываем регион
      if (event.target === event.currentTarget) {
        // Сохраняем текущий регион как последний, если он есть
        if (searchTerm.value) {
          lastSelectedRegion.value = searchTerm.value;
        }
        // Сбрасываем текущий регион
        searchTerm.value = '';
        emit('update:modelValue', '');
      }
    };

    const scrollToSelectedIndex = () => {
      if (selectedIndex.value === -1 || !wrapperRef.value) return;
      const list = wrapperRef.value.querySelector('.suggestions-list');
      if (!list) return;

      const items = list.querySelectorAll('.suggestion-item');
      const selectedRegionName = filteredRegions.value[selectedIndex.value]?.name;
      let targetItem = null;

      for (let item of items) {
        const nameEl = item.querySelector('.region-name');
        if (nameEl && nameEl.textContent.trim() === selectedRegionName) {
          targetItem = item;
          break;
        }
      }

      if (!targetItem) return;

      const itemTop = targetItem.offsetTop;
      const itemBottom = itemTop + targetItem.offsetHeight;
      const containerHeight = list.clientHeight;
      const scrollTop = list.scrollTop;
      const scrollBottom = scrollTop + containerHeight;

      if (itemTop < scrollTop) {
        list.scrollTop = itemTop - containerHeight / 2 + targetItem.offsetHeight / 2;
      } else if (itemBottom > scrollBottom) {
        list.scrollTop = itemTop - containerHeight / 2 + targetItem.offsetHeight / 2;
      }
    };

    // Синхронизация с внешним значением
    watch(() => props.modelValue, (newVal) => {
      if (newVal !== searchTerm.value) {
        searchTerm.value = newVal || '';
        if (newVal) lastSelectedRegion.value = newVal;
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
      filteredRegions,
      selectedRegionCode,
      onInput,
      onFocus,
      onBlur,
      onClick,
      onArrowDown,
      onArrowUp,
      onEnter,
      onEscape,
      onSuggestionsClick,
      selectRegion,
      scrollToRegionCenter,
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
  padding-right: 50px;
  /* Padding to accommodate the region code */
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
  right: 15px;
  /* Moved to the right edge */
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