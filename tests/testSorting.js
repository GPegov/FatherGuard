// Тест для проверки сортировки городов по длине
const cities = [
  "Туринск",
  "Туринская Слобода"
];

console.log("Исходный массив:");
console.log(cities);

// Сортировка по длине (сначала самые длинные)
const sortedCities = [...cities].sort((a, b) => b.length - a.length);

console.log("После сортировки по длине:");
console.log(sortedCities);

// Проверим длины
console.log("Длины:");
sortedCities.forEach(city => {
  console.log(`${city}: ${city.length} символов`);
});