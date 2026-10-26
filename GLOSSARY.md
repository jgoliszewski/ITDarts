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

**Lobby**:
Widok Ekranu wyników, gdy nie trwa mecz: QR do przejęcia Pilota i wynik ostatniego meczu.
_Avoid_: ekran startowy, home

**Panel tarczy**:
Część Pilota ze statusem połączenia i akcjami na Board Managerze: reset, detekcja, kalibracja, restart.
_Avoid_: ustawienia, settings

## Mecz

**Tura**:
Do trzech Rzutów jednego gracza, zakończonych Takeoutem. W angielskim UI: visit.
_Avoid_: kolejka, runda

**Poprawka**:
Podmiana jednego Rzutu w bieżącej Turze na inny segment, wybrany na Pilocie.
_Avoid_: edycja, korekta

**Undo**:
Cofnięcie ostatniego Rzutu. Przy pustej Turze cofa do poprzedniej Tury.
_Avoid_: cofnij turę

**Takeout done**:
Ręczne zakończenie Takeoutu z Pilota, gdy Board Manager nie zgłosi jego końca. Resetuje Board Managera i zaczyna następną Turę.
_Avoid_: next (w tym znaczeniu)

**Checkout**:
Rzut kończący leg zgodnie z regułą check-out gry. Też podpowiadana ścieżka przy wyniku do 170.
_Avoid_: finisz

**Match mode**:
Ustawienie X01: mecz do N wygranych legów albo setów. Wyłączony oznacza, że po każdym legu gracze decydują, czy grać dalej.
_Avoid_: tryb meczu (w UI)

**Bull-off**:
Rzut w bulla rozstrzygający, kto zaczyna mecz. Wariant „kto bliżej bulla” albo zasady PDC.
_Avoid_: losowanie

**Gra wspólna**:
Kilku graczy rzuca na zmianę na jeden wspólny wynik, bez rywalizacji. W UI: Co-op.
_Avoid_: team, drużyna (zostaje na przyszły tryb drużynowy)

**Ekran rekordu**:
Kilkusekundowy ekran przed startem gry z rekordem biura dla wybranego wariantu gry.
_Avoid_: intro, splash

## Gracze i statystyki

**Gracz**:
Zarejestrowany profil ze stałym ID i unikalnym imieniem, zakładany przed meczem. Tylko Graczom zbieramy statystyki.
_Avoid_: konto, użytkownik

**Gość**:
Uczestnik meczu dodany tylko na ten mecz, bez profilu i bez statystyk.
_Avoid_: anonim, tymczasowy gracz

**Log zdarzeń**:
Lista zdarzeń bieżącego meczu (rzuty, poprawki, undo, takeouty), z której silnik gry wylicza stan. Po meczu kompaktowany do obowiązujących lotek.
_Avoid_: historia (w tym znaczeniu), event store

**Średnia until 170**:
Średnia z 3 lotek liczona z całych Tur zaczętych z wynikiem powyżej 170.
_Avoid_: scoring average

**Okno**:
Zakres danych, z którego liczymy statystykę: czasowy (7 dni … all time) albo w legach (10, 100, all).
_Avoid_: okres, filtr

## Efekty

**Wyzwalacz**:
Zdarzenie gry, na które można podpiąć efekt: lotka, suma tury, kombinacja, bust, checkout, wygrany leg itd. Listę definiuje kod gry.
_Avoid_: trigger (w dokumentach), event

**Reguła**:
Jeden lub więcej Wyzwalaczy z przypisanym dźwiękiem i presetem ledów, wyklikana na stronie „Effects”. Naraz gra jedna Reguła, ta o najwyższym priorytecie.
_Avoid_: efekt (w tym znaczeniu), akcja

**Biblioteka dźwięków**:
Wspólna lista wgranych plików dźwiękowych, z której Reguły wybierają dźwięki.
_Avoid_: sound pack, paczka

**Caller**:
Głos sędziego, który zapowiada wynik tury, „you require”, game shot i bust. Osobny kanał z własną paczką nagrań.
_Avoid_: lektor, sędzia (w UI)

**Stan bazowy**:
Preset ledów świecący między efektami: lobby, mecz w toku, takeout, tarcza offline.
_Avoid_: idle
