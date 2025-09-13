import fs from 'fs';
import path from 'path';

// Загружаем список известных городов
const knownCitiesPath = path.join('./dataBase/knownCities/11.json');
const knownCitiesData = JSON.parse(fs.readFileSync(knownCitiesPath, 'utf8'));
const knownCities = knownCitiesData.cities;

console.log('Известные города Республики Коми (отсортированы по длине названия):');
console.log(`Всего городов: ${knownCities.length}`);

knownCities.forEach((city, index) => {
  console.log(`${index + 1}. ${city} (${city.length} символов)`);
});