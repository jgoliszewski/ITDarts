# ITDarts: minigierki (etap 2)

Postanowienia z grillingu z 2026-10-26 ([#3](https://github.com/jgoliszewski/ITDarts/issues/3)). Pojęcia są zdefiniowane w [GLOSSARY.md](../GLOSSARY.md), UI w [UI.md](UI.md), efekty w [EFEKTY.md](EFEKTY.md), a statystyki w [STATYSTYKI.md](STATYSTYKI.md).

## Zakres

Gramy w X01 oraz 6 minigierek: Around the Clock, Full Board, 121, Cricket, Killer i Higher or Lower.

Shanghai, Bob's 27, Halve-It, Count Up, Bermuda Triangle i Gotcha są w backlogu ([#7](https://github.com/jgoliszewski/ITDarts/issues/7)). Grillujemy je dopiero wtedy, gdy ktoś w biurze o nie poprosi.

## Wspólne zasady

- **Jedna gra, bez legów i setów.** Po końcu gry jest ekran wygranej z „Rematch”, „New match” i „Back to lobby”, jak w X01. Wyjątkiem jest Higher or Lower z opcją „First to”.
- **Bez limitu rund** w żadnej grze. Grę, która się zawiesi, kończy „End match” z Pilota.
- **Gracze:** 1–8, bez drużyn. Killer i Higher or Lower wymagają co najmniej 2 graczy.
- **Silnik:** każda gra liczy stan wyłącznie z Logu zdarzeń. Poprawka i Undo działają więc w każdej grze bez osobnej logiki, np. poprawka cofa zaliczony sektor przez przeliczenie stanu.
- **Tura** jak w X01: 3 lotki i Takeout. Po trafieniu celu następna lotka w tej samej Turze idzie już w kolejny cel.
- **Nagłówek** Ekranu wyników pokazuje grę i jej opcje, np. „ATC · Doubles · Clockwise”.

### Setup na Pilocie

- Kolejność kroków: gra, opcje, gracze.
- **Kafelki gier:** X01, ATC, Full Board, 121, Cricket, Killer, Higher or Lower. Kafelek ma nazwę, jedno zdanie opisu i liczbę graczy („1–8”, „2–8”). Ostatnio grana gra jest pierwsza.
- **Gracze, kolejność, Shuffle, goście i Bull-off** działają tak samo jak w X01.
- **„Start”** jest zablokowany, gdy skład nie pasuje do gry, z komunikatem, np. „Killer needs at least 2 players”.
- **Opcje** setup pamięta osobno dla każdej gry.
- **Podpowiedź „i”** przy każdej opcji to jedno zdanie wyjaśnienia. Tekst pochodzi z tej samej definicji co sekcja „Options” w opisie gry.

### Opis gry („How to play”)

- Duży, dobrze widoczny przycisk „How to play” z ikoną „?” w pomarańczowym obrysie. Jest w setupie obok nazwy gry i w menu Pilota w trakcie gry. Otwiera opis na cały ekran Pilota.
- Przycisk „Show on screen” pokazuje opis na Ekranie wyników. Zamyka go Pilot albo pierwszy rzut.
- Opis jest po angielsku, w stałym układzie: „Goal”, „Your turn”, „What counts”, „How to win”, „Options”. W sekcji „Options” wybrane w setupie wartości są podświetlone.
- Tekst jest na sztywno w module gry w `games/`. Opis ma też X01.

### Gra wspólna (Co-op)

- Przełącznik „Co-op” w setupie ATC i Full Board. W 121 przy 2+ graczach Co-op włącza się sam.
- Wszyscy gracze tworzą jedną drużynę ze wspólnym postępem. Każdy rzuca pełną Turę, potem następny w kolejności.
- Nie ma zwycięzcy. Wynikiem jest np. „Completed in 74 darts” albo najwyższy cel w 121.
- **Ekran wyników:** hero pokazuje wspólny postęp i imię osoby, która rzuca. Lista graczy pokazuje skład w kolejności i ile celów zaliczył każdy.
- **Statystyki:** hit rate każdego Gracza liczy się z jego własnych lotek. Rekordy co-op są osobne od solo i przypisane do składu. Nie psują rekordów indywidualnych.
- Drużyna na drużynę to osobny temat na później.

### Rekordy i Ekran rekordu

- Moduł gry może zdefiniować **statystykę rekordową**: co jest rekordem, czy lepiej mniej, czy więcej, i które opcje tworzą osobny wariant. Rekord zawsze dotyczy dokładnie jednego wariantu.
- Rekordy mają ATC, Full Board, 121 i solo Cricket. X01 na razie nie ma.
- **Ekran rekordu:** po „Start” Ekran wyników pokazuje przez około 4 s nazwę wariantu i rekord biura, czyli wartość, kto go ustanowił i kiedy.
  - Rekordów osobistych na tym ekranie nie pokazujemy.
  - W Co-op pokazuje rekord co-op wariantu z imionami składu.
  - Bez rekordu pokazuje „No record yet”.
  - Pilot ma „Skip”. Ekran wraca przy każdym Rematch. Bull-off, jeśli jest włączony, idzie po nim.
- **Nowy rekord** (biura albo osobisty) sprawdzamy na końcu gry, a nie w trakcie. Odpala Wyzwalacz „New record” i animację na ekranie wygranej.
- Goście nie mają rekordów.

## Around the Clock (ATC)

- **Cele:** po kolei 1–20, na końcu zawsze bull.
- **Opcje:**
  - „Order”: „1–20” (domyślnie) albo „Clockwise” (20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5);
  - „Target”: „Any” (domyślnie), „Doubles” albo „Trebles”;
  - „Multiplier skips”, tylko przy „Any”, domyślnie włączone: D przesuwa o 2 cele, T o 3;
  - „Co-op”.
- **Trafienie:** w „Any” każdy segment celu, a bull to 25 albo 50. W „Doubles” tylko D, w „Trebles” tylko T, a bull w obu tylko 50.
- **Koniec:** gdy ktoś zaliczy bulla, dogrywamy rundę, żeby wszyscy mieli tyle samo Tur. Wygrywa najmniej lotek. Przy tej samej liczbie lotek wygrywają wszyscy remisujący. Pozostali są sklasyfikowani według postępu.
- **Ekran wyników:** hero pokazuje imię, duży aktualny cel i kafelki lotek z trafieniem lub pudłem. Lista graczy pokazuje postęp („7 / 21”) i cel.
- **Wyzwalacze:** „Target hit”, „Game won”.
- **Statystyki:** hit rate. Rekordem jest najmniej lotek do końca, osobno dla każdej kombinacji Target × Multiplier skips. „Order” nie tworzy osobnego wariantu.

## Full Board

- **Cele:** każdy sektor 1–20 i bull, w dowolnej kolejności. Jedno trafienie zalicza sektor, mnożnik nic nie daje.
- **Opcje:** „Target” jak w ATC (w „Doubles” i „Trebles” bull tylko 50), „Co-op”.
- **Koniec:** jak w ATC.
- **Ekran wyników:** hero pokazuje grafikę tarczy aktywnego gracza z zaliczonymi sektorami na pomarańczowo i licznik „13 / 21”. Lista graczy pokazuje licznik.
- **Wyzwalacze:** „Sector cleared”, „Board cleared” (wygrana).
- **Statystyki:** rekordem jest najmniej lotek do końca, osobno dla każdego „Target”.

## 121

- **Tylko solo albo Co-op**, bez rywalizacji. Przy 2+ graczach Co-op jest włączony na sztywno.
- **Podejście:** zaczynasz od celu 121. Na checkout z double masz 3 albo 4 Tury (9 lub 12 lotek).
  - Bust działa jak w X01: wynik wraca do stanu sprzed Tury, a podejście trwa, dopóki są lotki.
  - Checkout przed końcem lotek kończy podejście, a reszta lotek przepada.
  - W Co-op lotki podejścia rozkładają się na kolejnych graczy.
- **Sukces:** cel rośnie o 1. **Porażka:** cel zostaje i tracisz życie.
- **Życia:** zawsze 3. Gra kończy się po utracie ostatniego.
- **Opcje:**
  - „Visits per target”: 3 (domyślnie) albo 4;
  - „Refill lives on checkout”, domyślnie włączone: sukces przywraca 3 życia. Wyłączone oznacza 3 życia na całą grę.
- **Ekran wyników:** hero pokazuje cel, ile zostało do zamknięcia, „Darts left” w podejściu, życia i podpowiedź checkoutu z X01. Caller mówi „you require” jak w X01.
- **Wyzwalacze:** „Checkout” i „Bust” (istnieją), „Attempt failed”.
- **Statystyki:** skuteczność podejść w %. Rekordem jest najwyższy zaliczony cel, osobno dla każdej kombinacji Visits × Refill, solo albo Co-op.

## Cricket

- **Sektory:** 15–20 i bull. S daje 1 znacznik, D 2, T 3. Bull 25 daje 1, a 50 daje 2. Trzy znaczniki zamykają sektor, a nadwyżka od razu punktuje (T20 przy 1 znaczniku zamyka 20 i daje 20 pkt).
- **Opcja „Mode”:**
  - „Standard” (domyślnie): punktujesz w sektorze zamkniętym u siebie i otwartym u któregoś rywala. Wygrywa ten, kto zamknął wszystko i ma co najmniej tyle punktów co każdy rywal;
  - „Cut-throat”: punkty dopisują się rywalom, którzy mają sektor otwarty. Wygrywa ten, kto zamknął wszystko i ma najmniej punktów.
- **Solo:** trening, czyli zamknąć wszystko w jak najmniejszej liczbie lotek, bez punktów.
- **Bez Co-op**, bez „No score” i bez Tactics.
- **Ekran wyników:** siatka z wierszami 20 … 15 i Bull oraz kolumną na gracza ze znacznikami /, X, Ⓧ. Punkty są nad kolumną, aktywny gracz ma pomarańczową kolumnę. Sektor zamknięty u wszystkich jest wyszarzony. Hero nad siatką pokazuje imię i kafelki lotek ze znacznikami.
- **Wyzwalacze:** „Marks in visit” 5–9 (9 przy trzech różnych trebles to White Horse), „Sector closed”, „Game won”.
- **Statystyki:** MPR (znaczniki na rundę). Rekordem jest solo: najmniej lotek.

## Killer

- **Numery:** serwer losuje każdemu graczowi unikalny numer 1–20 i pokazuje go przed startem. Pilot ma „Reroll”.
- **Killer:** trafienie własnego double daje status killera do końca gry. Liczy się tylko D.
- **Życia:** opcja „Lives” 1–5, domyślnie 3.
  - Killer, który trafi double rywala, zabiera mu 1 życie.
  - Killer, który trafi własny double, traci 1 życie.
  - Single i treble nic nie robią.
- **Eliminacja** od razu po utracie ostatniego życia, także w środku Tury. Wygrywa ostatni gracz z życiem.
- **Ekran wyników:** lista pokazuje numer, życia i ikonę killera, a wyeliminowani są wyszarzeni. Hero to aktywny gracz z numerem i kafelkami lotek.
- **Wyzwalacze:** „Became killer”, „Life lost”, „Player eliminated”, „Game won”.
- **Statystyki:** wygrane i liczba odebranych żyć. Bez rekordu.

## Higher or Lower

- **Zakres zakazany** startuje jako 26–45. Tura jest udana, gdy suma 3 lotek wypada poza zakresem.
  - Suma powyżej górnej granicy przesuwa górną granicę na tę sumę (rzucone 60 daje zakres 26–60).
  - Suma poniżej dolnej granicy przesuwa dolną granicę na tę sumę (rzucone 15 daje zakres 15–60).
  - Suma równa granicy jest w zakresie, czyli przegrywa.
  - Zakres tylko rośnie.
- **Pudło** (lotka poza punktowanym polem, także odbita) to nieudana tura bez względu na sumę.
- **Nieudana tura** od razu eliminuje, bez żyć. Zakres po eliminacji zostaje.
- **Wszyscy odpadają w jednej rundzie:** jeśli w tej samej rundzie odpadną wszyscy pozostali, runda się nie liczy. Zakres wraca do stanu sprzed rundy i wszyscy grają dalej.
- **Gra** kończy się, gdy zostaje jeden gracz, i daje mu punkt.
- **Opcja „First to”** 1–5, domyślnie 1. Kolejna gra startuje z zakresem 26–45 i wszystkimi graczami, a zaczyna następny w kolejności. Mecz wygrywa ten, kto pierwszy zdobędzie N punktów.
- **Ekran wyników:** hero pokazuje dużą sumę Tury na skali z czerwonym zakresem i kafelki lotek. Lista graczy pokazuje punkty, a wyeliminowani w bieżącej grze są wyszarzeni.
- **Wyzwalacze:** „Player eliminated”, „Game won”, „Match won”.
- **Statystyki:** wygrane. Bez rekordu.
- **Znany przypadek brzegowy:** gdy zakres dojdzie do 180 na górze i 3 na dole, nikt nie da rady go ominąć. Nie obsługujemy tego osobno, bo to praktycznie niemożliwe. Taką grę kończy „End match”.

## Statystyki na `/stats`

- Wybór gry.
- Dla gier z rekordem: tabela top 10 osobno dla każdego wariantu, z wynikiem, Graczem albo składem co-op i datą.
- Pod tabelą statystyki per gracz tej gry: hit rate, MPR, skuteczność podejść w 121, wygrane.
- Zasady zapisu i okna są w [STATYSTYKI.md](STATYSTYKI.md).
