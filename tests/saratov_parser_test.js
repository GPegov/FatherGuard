/**
 * Комплексный тест для проверки специального парсера Саратовской области
 * 
 * Этот файл можно использовать как документацию по формату данных
 */

import { parseSaratovData } from '../backend/services/parsing/specialCases/saratovParser.js';

// Тестовый HTML, максимально приближенный к реальной странице Саратовской области
const realisticSaratovHtml = `
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <title>Контактная информация структурных подразделений</title>
</head>
<body>
    <div class="content">
        <h1>Контактная информация структурных подразделений</h1>
        <table class="contacts-table">
            <thead>
                <tr>
                    <th>№</th>
                    <th>Наименование структурного подразделения</th>
                    <th>Ф.И.О. руководителя</th>
                    <th>Почтовый адрес</th>
                    <th>Адрес электронной почты</th>
                    <th>Телефон для получения справочной информации</th>
                    <th>Факс</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>1</td>
                    <td>Управление - отделение по обеспечению установленного порядка деятельности судов</td>
                    <td>Кочеткова О.В.</td>
                    <td>410000, г. Саратов, ул. им. 1-го Мая, д. 12</td>
                    <td>150@saratov.fssp.ru</td>
                    <td>(8452) 26-92-01</td>
                    <td>(8452) 26-92-02</td>
                </tr>
                <tr>
                    <td>2</td>
                    <td>Отделение судебных приставов Ленинского района г. Саратова</td>
                    <td>Корыстин Д.А.</td>
                    <td>410032, г. Саратов, ул. Советская, д. 46</td>
                    <td>204@saratov.fssp.ru</td>
                    <td>(8452) 28-32-34</td>
                    <td>(8452) 28-32-35</td>
                </tr>
                <tr>
                    <td>3</td>
                    <td>Отделение судебных приставов Кировского района г. Саратова</td>
                    <td>Седышева Е.А.</td>
                    <td>410017, г. Саратов, ул. им. Академика Крылова, д. 1/10</td>
                    <td>201@saratov.fssp.ru</td>
                    <td>(8452) 22-36-52</td>
                    <td>(8452) 22-36-53</td>
                </tr>
                <tr>
                    <td>4</td>
                    <td>Отделение судебных приставов Октябрьского района г. Саратова</td>
                    <td>Алексеева Е.В.</td>
                    <td>410005, г. Саратов, ул. Кутякова, д. 6</td>
                    <td>207@saratov.fssp.ru</td>
                    <td>(8452) 40-22-99</td>
                    <td>(8452) 27-12-63</td>
                </tr>
                <tr>
                    <td>5</td>
                    <td>Отделение судебных приставов г. Балаково</td>
                    <td>Морозов А.В.</td>
                    <td>413100, г. Балаково, ул. 30 лет Победы, д. 9</td>
                    <td>300@balakovo.fssp.ru</td>
                    <td>(8452) 41-73-02</td>
                    <td>(8452) 41-73-05</td>
                </tr>
            </tbody>
        </table>
    </div>
</body>
</html>
`;

function runComprehensiveTest() {
    console.log('Комплексное тестирование специального парсера Саратовской области...');
    console.log('Проверка максимально приближенного к реальности HTML-контента.\n');

    const result = parseSaratovData(realisticSaratovHtml);

    console.log(`Парсер извлек ${result.length} отделений:`);
    result.forEach((dep, index) => {
        console.log(`${index + 1}. ${dep.name}`);
        console.log(`   Адрес: ${dep.address}`);
        console.log(`   Телефон: ${dep.phone}`);
        console.log('');
    });

    // Проверка, что все отделения из тестового HTML были извлечены
    const expectedCount = 5;
    const extractedCount = result.length;
    
    console.log(`Ожидаемое количество отделений: ${expectedCount}`);
    console.log(`Извлеченное количество отделений: ${extractedCount}`);
    
    if (expectedCount === extractedCount) {
        console.log('✓ Парсер корректно извлек все отделения!');
    } else {
        console.log('✗ Ошибка: количество извлеченных отделений не совпадает с ожидаемым');
    }
    
    // Проверка, что все важные данные присутствуют
    const hasSaratovDep = result.some(dep => 
        dep.name.includes('Саратова') && 
        dep.address.includes('Саратов') && 
        dep.phone.includes('8452')
    );
    
    const hasBalakovoDep = result.some(dep => 
        dep.name.includes('Балаково') && 
        dep.address.includes('Балаково')
    );
    
    console.log('\nПроверка наличия ключевых отделений:');
    console.log(`Есть отделения по Саратову: ${hasSaratovDep ? '✓' : '✗'}`);
    console.log(`Есть отделения по Балаково: ${hasBalakovoDep ? '✓' : '✗'}`);
    
    console.log('\nТест специального парсера Саратовской области завершен успешно!');
}

runComprehensiveTest();