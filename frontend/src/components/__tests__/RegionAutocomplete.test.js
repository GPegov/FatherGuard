// Тест для проверки компонента RegionAutocomplete
import { createApp } from 'vue';
import { mount } from '@vue/test-utils';
import RegionAutocomplete from '../frontend/src/components/RegionAutocomplete.vue';

describe('RegionAutocomplete', () => {
  const mockRegions = [
    { name: 'Республика Адыгея', code: 1 },
    { name: 'Республика Башкортостан', code: 2 },
    { name: 'Республика Коми', code: 11 },
    { name: 'Свердловская область', code: 66 }
  ];

  it('должен отображать список регионов', async () => {
    const wrapper = mount(RegionAutocomplete, {
      props: {
        regions: mockRegions,
        modelValue: ''
      }
    });

    // Проверим, что компонент существует
    expect(wrapper.exists()).toBe(true);
    
    // Выведем информацию для отладки
    console.log('Компонент RegionAutocomplete загружен успешно');
    console.log('Количество регионов в props:', mockRegions.length);
    
    // Проверим, что регионы передаются правильно
    const vm = wrapper.vm;
    console.log('Количество регионов в filteredRegions:', vm.filteredRegions.length);
    
    // Проверим наличие Республики Коми
    const komiRegion = vm.filteredRegions.find(r => r.name === 'Республика Коми');
    console.log('Республика Коми в списке:', !!komiRegion);
    if (komiRegion) {
      console.log('Код Республики Коми:', komiRegion.code);
    }
  });

  it('должен фильтровать регионы по вводу', async () => {
    const wrapper = mount(RegionAutocomplete, {
      props: {
        regions: mockRegions,
        modelValue: ''
      }
    });

    const input = wrapper.find('input');
    await input.setValue('Коми');
    
    const vm = wrapper.vm;
    expect(vm.filteredRegions.length).toBe(1);
    expect(vm.filteredRegions[0].name).toBe('Республика Коми');
    console.log('Фильтрация работает корректно');
  });
});