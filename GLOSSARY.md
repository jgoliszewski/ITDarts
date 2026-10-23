# ITDarts

Własna aplikacja do biurowej tarczy Autodarts: zasady gier, stan meczu i prezentacja wyniku. Rozpoznawanie lotek zostaje po stronie Autodarts.

## Sprzęt i detekcja

**Tarcza**:
Fizyczna tarcza w biurze razem z kamerami i Raspberry Pi, na którym działa Board Manager.
_Avoid_: board (w rozmowie), dartboard

**Board Manager**:
Oprogramowanie Autodarts na Pi, które rozpoznaje lotki i wystawia lokalne API w LAN. Źródło prawdy o tym, co wylądowało na tarczy.
_Avoid_: BM (w dokumentach), serwer Autodarts

**Rzut**:
Jedna lotka wykryta przez Board Manager (segment i mnożnik).
_Avoid_: throw, lotka (jako zdarzenie)

**Takeout**:
Wyjmowanie lotek z tarczy po turze. Board Manager sygnalizuje jego początek i koniec.
_Avoid_: zbieranie, clear

## Ekrany

**Ekran wyników**:
Urządzenie, które tylko wyświetla stan meczu, bez wprowadzania danych.
_Avoid_: scoreboard, TV

**Pilot**:
Urządzenie (np. telefon), z którego gracze startują mecz i poprawiają rzuty. W danej chwili jest dokładnie jeden.
_Avoid_: kontroler, remote
