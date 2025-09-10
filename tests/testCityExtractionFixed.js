// Тест для проверки извлечения города из адреса с правильно отсортированными городами
const fs = require('fs');
const path = require('path');

// Функция для формирования имени файла с ведущим нулем для кодов 1-9
function getKnownCitiesFileName(regionCode) {
  // Добавляем ведущий ноль только для кодов от 1 до 9
  return regionCode.toString().padStart(2, '0') + '.json';
}

// Загружаем данные для Свердловской области
const regionCode = 66; // Свердловская область
const fileName = getKnownCitiesFileName(regionCode);
const knownCitiesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'backend', 'dataBase', 'knownCities', fileName), 'utf8'));
const knownCities = knownCitiesData.cities || [];

console.log("Города в Свердловской области (первые 10):");
console.log(knownCities.slice(0, 10));

// Проверим, как определяется город из адреса
const testAddresses = [
  "с. Туринская Слобода, ул. Ленина, д. 1",
  "г. Туринск, ул. Советская, д. 5"
];

console.log("\nТестирование извлечения городов:");

testAddresses.forEach(address => {
  console.log(`\nАдрес: ${address}`);
  
  // Имитация алгоритма поиска
  const prefixMatch = address.match(/(?:г\.|город|с\.|село|п\.|посёлок|пос\.)\s*([^\d,;]+)/i);
  if (prefixMatch) {
    let cityPart = prefixMatch[1].trim();
    console.log(`Найденная часть: "${cityPart}"`);
    
    // Обрезаем всё, что идёт после улицы/дома
    const streetIndicators = [
      'ул.', 'улица', 'пер.', 'переулок', 'пр.', 'проспект', 'ш.', 'шоссе',
      'мкр.', 'микрорайон', 'д.', 'дом', 'корп.', 'корпус', 'стр.', 'строение',
      'обл.', 'область', 'р-н', 'район', 'пл.', 'площадь'
    ];
    
    for (const indicator of streetIndicators) {
      const escaped = indicator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\s*${indicator}.*`, 'i');
      cityPart = cityPart.replace(regex, '');
    }
    
    // Убираем лишние символы в конце
    cityPart = cityPart.replace(/[.,;].*$/, '').trim();
    console.log(`После обрезки: "${cityPart}"`);
    
    // Проверяем, совпадает ли с известным городом (с приоритетом по длине)
    let found = false;
    for (const city of knownCities) {
      if (cityPart.startsWith(city)) {
        console.log(`Найдено совпадение: ${city}`);
        found = true;
        break;
      }
    }
    
    if (!found) {
      console.log("Город не найден");
    }
  }
});