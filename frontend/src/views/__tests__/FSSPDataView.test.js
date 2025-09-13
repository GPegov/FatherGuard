// Тест для проверки компонента FSSPDataView
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import FSSPDataView from '../frontend/src/views/FSSPDataView.vue';

// Мокаем axios
jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn()
}));

// Мокаем RegionAutocomplete компонент
jest.mock('../frontend/src/components/RegionAutocomplete.vue', () => ({
  name: 'RegionAutocomplete',
  template: '<div class="mock-region-autocomplete"></div>',
  props: ['regions', 'modelValue'],
  emits: ['update:modelValue', 'regionSelected']
}));

describe('FSSPDataView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('должен загружать список регионов при монтировании', async () => {
    // Мокаем ответ API для списка регионов
    const mockRegionsResponse = {
      data: {
        success: true,
        regions: [
          { name: 'Республика Адыгея', code: 1 },
          { name: 'Республика Коми', code: 11 },
          { name: 'Свердловская область', code: 66 }
        ]
      }
    };
    
    require('axios').get.mockResolvedValueOnce(mockRegionsResponse);
    
    // Мокаем ответ API для данных ФССП
    const mockDataResponse = {
      data: {
        success: true,
        data: {
          timestamp: '2023-01-01T00:00:00Z',
          regions: []
        }
      }
    };
    
    require('axios').get.mockResolvedValueOnce(mockDataResponse);
    
    const wrapper = mount(FSSPDataView);
    
    // Ждем загрузки данных
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Проверим, что список регионов загружен
    expect(wrapper.vm.availableRegions.length).toBe(3);
    expect(wrapper.vm.availableRegions[1].name).toBe('Республика Коми');
    expect(wrapper.vm.availableRegions[1].code).toBe(11);
    
    console.log('Список регионов загружен корректно');
    console.log('Количество регионов:', wrapper.vm.availableRegions.length);
    console.log('Республика Коми в списке:', 
      wrapper.vm.availableRegions.find(r => r.name === 'Республика Коми'));
  });

  it('должен позволять выбор региона', async () => {
    // Мокаем ответы API
    require('axios').get.mockResolvedValueOnce({
      data: {
        success: true,
        regions: [
          { name: 'Республика Коми', code: 11 },
          { name: 'Свердловская область', code: 66 }
        ]
      }
    });
    
    require('axios').get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          timestamp: '2023-01-01T00:00:00Z',
          regions: []
        }
      }
    });
    
    const wrapper = mount(FSSPDataView);
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Проверим начальное значение
    expect(wrapper.vm.selectedRegion).toBe('Свердловская область');
    
    // Изменим выбор региона
    wrapper.vm.selectedRegion = 'Республика Коми';
    await wrapper.vm.$nextTick();
    
    expect(wrapper.vm.selectedRegion).toBe('Республика Коми');
    console.log('Выбор региона работает корректно');
  });
});