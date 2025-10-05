// Простой тест для проверки фильтрации регионов
const regions = [
  { name: 'Республика Адыгея', code: 1 },
  { name: 'Республика Башкортостан', code: 2 },
  { name: 'Республика Коми', code: 11 },
  { name: 'Свердловская область', code: 66 }
];

function filterRegions(searchTerm, regionsList) {
  if (!searchTerm) return regionsList;
  const term = searchTerm.toLowerCase();
  return regionsList.filter(r => r.name.toLowerCase().includes(term));
}

// Тест фильтрации
console.log('Тест фильтрации регионов:');

// Пустой поиск - должны отображаться все регионы
const allRegions = filterRegions('', regions);
console.log('Пустой поиск:', allRegions.length, 'регионов');

// Поиск "Коми"
const komiRegions = filterRegions('Коми', regions);
console.log('Поиск "Коми":', komiRegions.length, 'регионов');
komiRegions.forEach(region => {
  console.log('  -', region.name, `(${region.code})`);
});

// Поиск "Республика"
const republicRegions = filterRegions('Республика', regions);
console.log('Поиск "Республика":', republicRegions.length, 'регионов');
republicRegions.forEach(region => {
  console.log('  -', region.name, `(${region.code})`);
});