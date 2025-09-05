// test-parser-with-data.js
import FSSPParser from './fssp-parser.js';
import fs from 'fs';

// Создаем экземпляр парсера
const parser = new FSSPParser();

// Имитация данных, которые мы хотим получить с сайта
const mockDepartments = [
  {
    name: "Нижнетуринское районное отделение",
    address: "624222\ng. Нижняя Тура,\nул. Ильича, д. 2а",
    phone: "624222"
  },
  {
    name: "Слободотуринское районное отделение",
    address: "623930\nс. Туринская Слобода,\nул. Первомайская, д. 6",
    phone: "623930"
  },
  {
    name: "Туринское районное отделение",
    address: "623900\nг. Туринск,\nул. Калинина, д. 17",
    phone: "623900"
  },
  {
    name: "Верх-Исетское районное отделение",
    address: "620062\nг. Екатеринбург,\nул. Чебышёва, д. 4",
    phone: "620062"
  }
];

// Создаем структуру данных, как если бы она была получена с сайта
const mockRegionData = {
  region: "Свердловская область",
  cities: []
};

// Используем Map для группировки отделений по городам
const citiesMap = new Map();

// Обрабатываем каждое отделение
mockDepartments.forEach(dept => {
  // Извлекаем город из адреса
  const city = parser.extractCityFromAddress(dept.address);
  
  // Добавляем отделение в соответствующий город
  if (!citiesMap.has(city)) {
    citiesMap.set(city, {
      name: city,
      departments: []
    });
  }
  
  citiesMap.get(city).departments.push(dept);
});

// Преобразуем Map в массив
mockRegionData.cities = Array.from(citiesMap.values());

const testData = {
  timestamp: new Date().toISOString(),
  regions: [mockRegionData]
};

// Сохраняем результат в файл
fs.writeFileSync('./test_fssp_data.json', JSON.stringify(testData, null, 2), 'utf8');
console.log('Тестовые данные сохранены в test_fssp_data.json');

// Выводим статистику
console.log('\n=== СТАТИСТИКА ===');
console.log(`Всего регионов: 1`);
console.log(`Всего городов: ${mockRegionData.cities.length}`);
let totalDepartments = 0;
mockRegionData.cities.forEach(city => {
  totalDepartments += city.departments.length;
});
console.log(`Всего отделений: ${totalDepartments}`);

// Выводим распределение по городам
console.log('\nРаспределение по городам:');
mockRegionData.cities.forEach(city => {
  console.log(`  ${city.name}: ${city.departments.length} отделений`);
});