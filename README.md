# Fiszki - Backend (API)

To jest repozytorium backendu dla naszej aplikacji do nauki słówek. Poniżej znajdziecie instrukcję, jak odpalić ten kod u siebie lokalnie, żeby móc podpiąć pod to widoki Frontendu.

# Jak odpalić projekt u siebie (Windows)

**1. Pobranie kodu**
Skolonuj to repozytorium do siebie na dysk i wejdź w terminalu do folderu z projektem tam, gdzie leży plik `manage.py`.

**2. Stworzenie środowiska wirtualnego**
Wpisz w terminalu:
`python -m venv venv`

**3. Uruchomienie środowiska**
Wpisz:
`venv\Scripts\activate`
*(Jeśli Windows wyrzuci Wam czerwony błąd z uprawnieniami, wpiszcie najpierw: `Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process`, wciśnijcie `Y`, i powtórzcie komendę z activate).*

**4. Instalacja bibliotek**
Żeby pobrać Django i inne pakiety wpisz:
`pip install -r requirements.txt`

**5. Zbudowanie bazy danych**
Plik bazy danych nie jest na GitHubie. Musicie wygenerować własne, puste tabele na swoim komputerze. Wpisz:
`python manage.py migrate`

**6. Odpalenie serwera**
`python manage.py runserver`

Główne adresy API to: `http://127.0.0.1:8000/api/`

Po uruchomieniu serwera dostępna jest też prosta warstwa frontowa pod adresem:
`http://127.0.0.1:8000/`

Na stronie głównej można:
- założyć konto,
- zalogować się,
- utworzyć nowy zestaw,
- dodać do niego pierwsze słówka,
- podejrzeć listę dostępnych zestawów.
