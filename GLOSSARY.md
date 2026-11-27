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
Widok Ekranu wyników, gdy nie trwa mecz: duże „New match” i „Rematch” oraz wynik ostatniego meczu.
_Avoid_: ekran startowy, home

**Panel tarczy**:
Część Pilota ze statusem połączenia i akcjami na Board Managerze: reset, detekcja, kalibracja, restart.
_Avoid_: ustawienia, settings

**Tarcza w hero**:
Narysowana tarcza w grach z tarczą na Ekranie wyników: pokazuje, w co trafić, i stan celów gracza, który rzuca. To obraz, nie fizyczna Tarcza. Komponent `HeroBoard`; do wklikiwania lotek (telefon, laptop) służy osobny `Dartboard`, a `TargetBoard` w pełnych kolorach zostaje tylko jako tło Heatmap i Test board.
_Avoid_: minitarcza, plansza, tarcza celów

**Pierścień numerów**:
Pas z numerami 1–20 wokół tarczy w hero. Składa się z Segmentów, po jednym na sektor, a numery są obrócone promieniście.
_Avoid_: obwódka, ramka z numerami

**Segment** (w hero):
Jedno pole Pierścienia numerów: sektor 1–20 albo bull (pierścień wokół zewnętrznego bulla). Ma stan (cel, zaliczony, własny double killera, poza grą, zamknięty u wszystkich, bez celu), kolor tego stanu i Kreski stanu. Nie mylić z segmentem Rzutu z Board Managera.
_Avoid_: kafelek (kafelek to lotka), pole, klocek

**Ciąg**:
Sąsiednie Segmenty (5 sąsiaduje z 20) w tym samym kolorze albo, dla obrysu, z tym samym Ringiem celu i kolorem: rysują się jako jeden pas albo jeden obrys. Segmenty w różnych kolorach nie tworzą Ciągu, nawet gdy sąsiadują.
_Avoid_: grupa, blok, seria

**Kreski stanu**:
Do trzech (w Killer pięciu) łuków na wewnętrznej krawędzi Segmentu: znaczniki Cricketa, życia w Killer, S, D i T w Shanghai. Pełna kreska to „jest”, pusta to „jeszcze nie”. Nie mylić ze znacznikami w siatce Cricketa ani z kropkami lotek.
_Avoid_: pipsy, kropki (kropki to lotki Tury na tarczy), znaczniki (w tym znaczeniu)

**Ring celu**:
Ta część sektora, w którą trzeba trafić: cały sektor, duży single, double albo treble (dla bulla bullseye). Widać go tylko na tarczy jako obrys i pełne kolory, a Pierścień numerów go nie powtarza. Nie mylić z ringami ledów ([MAPA.md](docs/MAPA.md)).
_Avoid_: pierścień (samo słowo), obwód, obrys celu

## Mecz

**Tura**:
Do trzech Rzutów jednego gracza, zakończonych Takeoutem. W angielskim UI: visit.
_Avoid_: kolejka, runda

**Poprawka**:
Podmiana jednego Rzutu w bieżącej Turze na inny segment, wybrany na Pilocie.
_Avoid_: edycja, korekta

**Duży single / mały single**:
Single w polu między treblem a double (duży, inaczej zewnętrzny) albo między 25 a treblem (mały, inaczej wewnętrzny). Granica leży w połowie szerokości treble, 103 mm od środka: od 103 mm (włącznie) to duży single (`SINGLE_SPLIT_MM`, ta sama w Football i Bullseye). Rozstrzygają go coords Rzutu, a bez coords Rzut liczy się jako duży single (Football w Big singles) albo jako mały (Bullseye).
_Avoid_: single outer/inner (w UI: „Big singles”)

**Undo**:
Cofnięcie ostatniego Rzutu. Przy pustej Turze cofa do poprzedniej Tury.
_Avoid_: cofnij turę

**Takeout done**:
Ręczne zakończenie Takeoutu z Pilota, gdy Board Manager nie zgłosi jego końca. Resetuje Board Managera i zaczyna następną Turę.
_Avoid_: next (w tym znaczeniu)

**Checkout**:
Rzut kończący leg zgodnie z regułą check-out gry. Też podpowiadana ścieżka, gdy lotki w turze mogą skończyć leg.
_Avoid_: finisz

**Setup**:
Podpowiadane lotki, gdy w tej turze nie da się zrobić Checkoutu: ustawiają wynik pod Checkout w następnej turze.
_Avoid_: ustawka, leave

**Match mode**:
Ustawienie X01: mecz do N wygranych legów albo setów. Wyłączony oznacza, że po każdym legu gracze decydują, czy grać dalej.
_Avoid_: tryb meczu (w UI)

**Wycofanie z meczu**:
Pilot usuwa gracza z meczu w toku: gracz zostaje wyszarzony z dopiskiem „Left” i nie rzuca do końca meczu. W UI „Remove from match”, w minigierkach „Remove player”.
_Avoid_: kick, wyrzucenie, pauza

**Wycofanie z legu**:
W X01 gracz nie rzuca do końca bieżącego legu („Back next leg”) i wraca w następnym. W UI „Remove from leg”.
_Avoid_: kick, wyrzucenie, pauza

**Bull-off**:
Rzut w bulla rozstrzygający, kto zaczyna mecz. Wariant „kto bliżej bulla” albo zasady PDC. Wybierany w kroku Players Nowego meczu, jeden dla wszystkich gier.
_Avoid_: losowanie

**Szybka gra**:
Zapisana gra z opcjami, startowana jednym stuknięciem z kroku Players w Nowym meczu, ze składem i Bull-offem z tego kroku. Trzy sloty osobno dla solo i dla 2+ graczy, wspólne dla wszystkich urządzeń. W UI: Quick game, nagłówek Quick start.
_Avoid_: preset, ulubiona gra, skrót

**Zając / ogar**:
Role w Hare and Hounds: zając ucieka po obwodzie tarczy od 20, ogar startuje kilka sektorów za nim i go goni. W UI „Hare” i „Hound”.
_Avoid_: lis, fox, uciekający, goniący

**Przewaga**:
Liczba sektorów, o którą ogar startuje za zającem w Hare and Hounds. W UI „Head start”.
_Avoid_: handicap, gap (w UI „Gap” to bieżący dystans w trakcie gry)

**Gra wspólna**:
Kilku graczy rzuca na zmianę na jeden wspólny wynik, bez rywalizacji. W UI: Co-op.
_Avoid_: team, drużyna (zostaje na przyszły tryb drużynowy)

**Rekord biura**:
Najlepszy wynik wariantu minigierki w biurze. Pokazuje go Ekran rekordu przed grą, kafelki rekordów w lobby (na kiosku stuknięcie otwiera „Record attempt”, na telefonie „New match” z tym wariantem) i tabele na `/stats`.
_Avoid_: high score, top score

**Rekord osobisty**:
Najlepszy wynik gracza w wariancie minigierki. W UI: „PB” (plakietka w hero, modal rekordów, Ekran rekordu) i „NEW PERSONAL BEST”. Goście go nie mają.
_Avoid_: personal record, high score

**Rekord składu**:
Najlepszy wynik dokładnie tego składu gry wspólnej w wariancie: zbiór zarejestrowanych graczy, kolejność bez znaczenia, gracz wycofany z meczu nie należy do składu. W UI: „Team” i „Team best” (plakietka, modal, Ekran rekordu) oraz „NEW TEAM BEST”. To jedyne miejsce, gdzie gra wspólna mówi w UI „team” (grilling 2026-11-23).
_Avoid_: rekord drużyny, team record

**Record attempt**:
Okno w lobby kiosku po stuknięciu kafelka rekordu: pokazuje rekord do pobicia i pozwala wybrać graczy (solo 1, gra wspólna 2 lub więcej, bez Gościa), a „Start” uruchamia mecz z opcjami meczu rekordu, bez Setupu.
_Avoid_: challenge, quick start

**Pościg**:
Dwie szare linie na kafelku rekordu z 2. i 3. miejscem w okrągłej plakietce („2 Bob 28”, „3 Cy 31”), czyli to, co trzeba jeszcze pobić po rekordziście. Miejsce liczy osoby (co-op: składy), nie wyniki. W UI bez nazwy.

**Strona rekordów**:
Jeden ekran siatki 4×2 kafelków rekordów w lobby kiosku, z grupami po grach pod nagłówkiem (ikona i nazwa gry). Strony przesuwają się swipe'em, kropkami i same co 10 s; gra z ponad 8 wariantami ciągnie się jako „<Gra> (cont.)”.
_Avoid_: slajd, karuzela (w UI bez nazwy)

**Ekran rekordu**:
Kilkusekundowy ekran przed startem gry z rekordem biura dla wybranego wariantu gry, a pod nim rekordami osobistymi graczy albo rekordem składu.
_Avoid_: intro, splash

**Poza zasięgiem**:
Stan plakietki rekordu w trakcie gry: gra nie może już tego rekordu pobić (remis nie bije), więc plakietka szarzeje z przekreśloną liczbą.
_Avoid_: przegrany rekord, out

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

**Okno**:
Zakres danych, z którego liczymy statystykę: czasowy (7 dni … all time) albo w legach (10, 100, all).
_Avoid_: okres, filtr

**Poprzednie Okno**:
Okno tuż przed wybranym, z którego liczymy strzałkę zmiany: okres tej samej długości przed oknem czasowym albo poprzednie 10 / 100 legów (minigierki: meczów). Nie istnieje dla „All time”, gdy wybrane Okno jest puste (nie ma w nim żadnego legu ani meczu) ani przy mniej niż 3 legach (meczach).
_Avoid_: okres bazowy, baseline

## Efekty

**Wyzwalacz**:
Zdarzenie gry, na które można podpiąć efekt: lotka, suma tury, kombinacja, bust, checkout, wygrany leg itd. Listę definiuje kod gry.
_Avoid_: trigger (w dokumentach), event

**Reguła**:
Jeden lub więcej Wyzwalaczy z przypisanym dźwiękiem i presetem ledów, wyklikana na stronie „Effects”. Naraz gra jedna Reguła, ta o najwyższym priorytecie.
_Avoid_: efekt (w tym znaczeniu), akcja

**Moment**:
Chwila w grze, na którą może coś zagrać: dźwięk, ledy albo jedno i drugie, z siłą (S, M, L, XL) i charakterem (neutralny, dobry, zły, zabawny). Każda Reguła bazowa to jeden Moment; mapa Momentów jest w [MAPA.md](docs/MAPA.md).
_Avoid_: akcja, event

**Biblioteka dźwięków**:
Wspólna lista wgranych plików dźwiękowych i Dźwięków wbudowanych, z której Reguły wybierają dźwięki.
_Avoid_: sound pack, paczka

**Dźwięk wbudowany**:
Dźwięk syntezowany w kiosku (marimba, dzwonki, kalimba), bez pliku, w kodzie. W UI „Built-in”. Nie da się go usunąć ani przemianować, tylko ściszyć.
_Avoid_: default sound, preset dźwięku

**Reguła bazowa**:
Reguła z listy w kodzie, zawsze obecna w `effects.json`, z Dźwiękiem wbudowanym jako domyślnym. Da się ją wyłączyć i nadpisać, a „Reset to default” przywraca definicję. W UI „Built-in rule”.
_Avoid_: default, szablon, reguła systemowa

**Caller**:
Głos sędziego w X01: „game on”, wynik tury, „no score”, „you require” i game shot. Zaszyty w kodzie, z nagraniami w `assets/caller/`; da się go tylko włączyć lub wyłączyć i ściszyć.
_Avoid_: lektor, sędzia (w UI)

**Stan bazowy**:
Preset ledów świecący między efektami: lobby, mecz w toku, takeout, tarcza offline.
_Avoid_: idle
