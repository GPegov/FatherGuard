// Тест для проверки интеграции специального парсера Республики Коми
import fs from 'fs';
import { parseKomiData } from './services/parsing/specialCases/komiParser.js';

// Создаем HTML, который имитирует реальную структуру страницы с двумя таблицами
const testHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Тест</title>
</head>
<body>
<!-- Первая таблица с общей информацией -->
<table>
<tr>
<td>
<strong>Юридический адрес:</strong>&nbsp;167000, г. Сыктывкар, ул. Пушкина, 110<br>
<strong>Фактический адрес:</strong> 167000, г. Сыктывкар, ул. Пушкина, 110<br>
<strong>Почтовый адрес:</strong> 167000, г. Сыктывкар, ул. Пушкина, 110<br>
<strong>e-mail: </strong><a href="mailto:mail@r11.fssp.gov.ru">mail@r11.fssp.gov.ru</a><br>
<strong>Телефон:</strong> 7 (8212) 28-74-50<br>
<strong>Факс:</strong> 7 (8212) 28-74-89<br>
<strong>Телефон дежурной части:</strong> 7 (8212) 28-74-69<br>
<strong>Телефон доверия:</strong> 7 (8212) 22-96-44<br>
<strong>Центр информирования граждан: </strong>7 (8212) 28-79-86
</td>
</tr>
</table>

<!-- Вторая таблица с отделениями -->
<table>
<thead>
<tr style="background-color: #88f09b;">
<td style="width: 10.9206%; vertical-align: middle; background-color: rgb(232, 232, 232); border-color: rgb(191, 191, 191);"><span style="color: #000000;">№ п/п</span></td>
<td style="width: 28.9711%; vertical-align: middle; background-color: rgb(232, 232, 232); border-color: rgb(191, 191, 191);"><span style="color: #000000;">Наименование<br>структурного<br>Подразделения&nbsp;</span></td>
<td style="vertical-align: middle; background-color: rgb(232, 232, 232); border-color: rgb(191, 191, 191);"><span style="color: #000000;">&nbsp;Почтовый<br>Адрес</span></td>
<td style="vertical-align: middle; background-color: rgb(232, 232, 232); border-color: rgb(191, 191, 191);"><span style="color: #000000;">&nbsp;Адрес<br>Электронной<br>Почты</span></td>
<td style="background-color: rgb(232, 232, 232); border-color: rgb(191, 191, 191);">
<p><span style="color: #000000;">Телефон для получения</span></p>
<p><span style="color: #000000;"> справочной информации</span></p>
<p><span style="color: #000000;"> о деятельности структурного подразделения&nbsp;</span></p>
</td>
</tr>
</thead>
<tbody>
<tr>
<td style="vertical-align: middle;">&nbsp;1</td>
<td style="vertical-align: middle;">&nbsp;ОСП по г.Сыктывкару №1</td>
<td style="vertical-align: middle;">167004 г. Сыктывкар,<br> ул. Куратова, 91</td>
<td style="vertical-align: middle;">osp01@r11.fssp.gov.ru</td>
<td style="vertical-align: middle;">
<p>8 (8212) 28-79-79</p>
<p>8 (8212) 28-79-96</p>
<p>8 (8212) 28-79-98</p>
</td>
</tr>
<tr>
<td style="vertical-align: middle; background-color: rgb(232, 232, 232);">&nbsp;2</td>
<td style="vertical-align: middle; background-color: rgb(232, 232, 232);">&nbsp;ОСП по г.Воркуте</td>
<td style="vertical-align: middle; background-color: rgb(232, 232, 232);">169900 г. Воркута<br> ул. Яновского, 1</td>
<td style="vertical-align: middle; background-color: rgb(232, 232, 232);">osp02@r11.fssp.gov.ru</td>
<td style="background-color: rgb(232, 232, 232); vertical-align: middle;">
<p>8 (82151) 3-14-34</p>
<p>8 (82151) 3-80-53</p>
<p>8 (82151) 3-80-98</p>
</td>
</tr>
</tbody>
</table>
</body>
</html>
`;

console.log('Тестирование специального парсера Республики Коми...');

const departments = parseKomiData(testHtml);

console.log(`Найдено отделений: ${departments.length}`);

if (departments.length >= 2) {
  console.log('\nПервое отделение:');
  console.log(`  Название: ${departments[0].name}`);
  console.log(`  Адрес: ${departments[0].address}`);
  console.log(`  Телефон: ${departments[0].phone}`);
  
  console.log('\nВторое отделение:');
  console.log(`  Название: ${departments[1].name}`);
  console.log(`  Адрес: ${departments[1].address}`);
  console.log(`  Телефон: ${departments[1].phone}`);
  
  console.log('\nТест пройден успешно!');
} else {
  console.log('Ошибка: не удалось извлечь отделения');
  console.log('Детали отделений:', JSON.stringify(departments, null, 2));
}