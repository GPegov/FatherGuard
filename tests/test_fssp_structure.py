import requests
from bs4 import BeautifulSoup

def test_fssp_structure():
    print("Тест структуры сайта ФССП")
    
    try:
        # Попробуем получить главную страницу контактов
        url = "https://fssp.gov.ru/contacts"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        response = requests.get(url, headers=headers)
        print(f"Статус ответа: {response.status_code}")
        
        if response.status_code == 200:
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Попробуем найти регионы разными способами
            print("\nПоиск регионов:")
            
            # Способ 1: Поиск ссылок на контакты
            region_links = soup.find_all('a', href=lambda x: x and '/contacts/' in x)
            print(f"Найдено ссылок на контакты: {len(region_links)}")
            
            if region_links:
                for link in region_links[:5]:  # Покажем первые 5
                    print(f"  - {link.text.strip()}: {link.get('href')}")
            
            # Способ 2: Поиск по CSS классам
            dropdown_items = soup.find_all(class_=lambda x: x and 'dropdown' in x.lower())
            print(f"\nНайдено элементов dropdown: {len(dropdown_items)}")
            
            # Способ 3: Поиск заголовков
            headers = soup.find_all(['h1', 'h2', 'h3', 'h4'])
            print(f"\nНайдено заголовков: {len(headers)}")
            for header in headers[:5]:
                print(f"  - {header.name}: {header.text.strip()}")
                
        else:
            print("Не удалось получить страницу")
            
    except Exception as e:
        print(f"Ошибка: {e}")

if __name__ == "__main__":
    test_fssp_structure()