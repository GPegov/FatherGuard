import fs from 'fs';
import { parseKomiData } from './services/parsing/specialCases/komiParser.js';

// Читаем содержимое HTML файла
const htmlContent = fs.readFileSync('./komi-page-content.html', 'utf8');

// Применяем парсер
const departments = parseKomiData(htmlContent);

console.log('Найденные отделения:');
console.log(`Всего отделений: ${departments.length}`);

// Выводим первые несколько отделений для проверки
departments.slice(0, 5).forEach((dept, index) => {
  console.log(`\n${index + 1}. ${dept.name}`);
  console.log(`   Адрес: ${dept.address}`);
  console.log(`   Телефон: ${dept.phone}`);
});

// Сохраняем результат в JSON файл для дальнейшего анализа
fs.writeFileSync('./komi-departments.json', JSON.stringify(departments, null, 2), 'utf8');
console.log('\nРезультаты сохранены в komi-departments.json');