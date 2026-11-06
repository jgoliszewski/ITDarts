# ITDarts: minigierki (etap 2)

Postanowienia z grillingu z 2026-10-26 ([#3](https://github.com/jgoliszewski/ITDarts/issues/3)). Pojęcia są zdefiniowane w [GLOSSARY.md](../GLOSSARY.md), UI w [UI.md](UI.md), efekty w [EFEKTY.md](EFEKTY.md), a statystyki w [STATYSTYKI.md](STATYSTYKI.md).

## Zakres

Gramy w X01 oraz 11 minigierek: Around the Clock, Full Board, 121, Cricket, Killer, Higher or Lower, Random Checkouts, Shanghai, Gotcha (dwie od 2026-10-29), Knockout i Football (od 2026-10-30).

Backlogu nie ma. Bob's 27, Halve-It, Count Up i Bermuda Triangle odrzuciliśmy 2026-10-30, razem z innymi propozycjami z tamtej rozmowy (m.in. Tic-Tac-Toe, Follow the Leader, Baseball, Golf) ([#7](https://github.com/jgoliszewski/ITDarts/issues/7)).

## Wspólne zasady

- **Jedna gra, bez legów i setów.** Po końcu gry jest ekran wygranej z „Rematch”, „New match” i „Back to lobby”, jak w X01. Wyjątkiem jest Higher or Lower z opcją „First to”.
- **Bez limitu rund** w żadnej grze poza Shanghai, który ma 7 albo 20 rund. Grę, która się zawiesi, kończy „End match” z Pilota. Random Checkouts nie ma końca wcale i zawsze kończy ją „End match”.
- **Gracze:** 1–8, bez drużyn. Killer i Higher or Lower wymagają co najmniej 2 graczy.
- **Wycofanie gracza** w trakcie gry jest w każdej grze, zasady w [UI.md](UI.md#wycofanie-gracza).
- **Silnik:** każda gra liczy stan wyłącznie z Logu zdarzeń. Poprawka i Undo działają więc w każdej grze bez osobnej logiki, np. poprawka cofa zaliczony sektor przez przeliczenie stanu.
- **Tura** jak w X01: 3 lotki i Takeout. Po trafieniu celu następna lotka w tej samej Turze idzie już w kolejny cel.
- **Nagłówek** Ekranu wyników pokazuje grę i jej opcje, np. „ATC · Doubles · Clockwise”.

### Setup na Pilocie

- Kolejność kroków: gra, opcje, gracze.
- **Kafelki gier** są w trzech grupach z nagłówkami, w stałej kolejności (od 2026-10-29, wcześniej ostatnio grana gra była pierwsza):
  - **Classic:** X01;
  - **Practice:** ATC, Full Board, 121, Random Checkouts;
  - **Versus:** Cricket, Killer, Higher or Lower, Shanghai, Gotcha, Knockout, Football.

  Kafelek ma nazwę, jedno zdanie opisu i liczbę graczy („1–8”, „2–8”). Te same grupy są w wyborze gry na `/stats`.
- **Gracze, kolejność, Shuffle, goście i Bull-off** działają tak samo jak w X01.
- **„Start”** jest zablokowany, gdy skład nie pasuje do gry, z komunikatem, np. „Killer needs at least 2 players”.
- **Opcje** setup pamięta osobno dla każdej gry.
- **Podpowiedź „i”** przy każdej opcji to jedno zdanie wyjaśnienia w dymku nad układem (od 2026-10-27), więc nic się nie przesuwa. Zamyka go stuknięcie gdziekolwiek. Tekst pochodzi z tej samej definicji co sekcja „Options” w opisie gry.
- **Opcje dla 2+ graczy** (Mode w Cricket, Co-op, Bull-off) są widoczne od razu, zanim ktoś zostanie dodany (od 2026-10-27). Bez graczy „Start match” jest wyszarzony.

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
- Rekordy mają ATC, Full Board, 121, solo Cricket i solo Shanghai. X01 na razie nie ma.
- **Ekran rekordu:** po „Start” Ekran wyników pokazuje przez około 4 s nazwę wariantu i rekord biura, czyli wartość, kto go ustanowił i kiedy.
  - Rekordów osobistych na tym ekranie nie pokazujemy.
  - W Co-op pokazuje rekord co-op wariantu z imionami składu.
  - Bez rekordu pokazuje „No record yet”.
  - Pilot ma „Skip”. Ekran wraca przy każdym Rematch. Bull-off, jeśli jest włączony, idzie po nim, także w Rematch (nowy bull-off ustala kolejność gry).
- **Nowy rekord** (biura albo osobisty) sprawdzamy na końcu gry, a nie w trakcie. Odpala Wyzwalacz „New record” i animację na ekranie wygranej.
- Goście nie mają rekordów.

## Around the Clock (ATC)

- **Cele:** po kolei 1–20, na końcu zawsze bull.
- **Opcje:**
  - „Order”: „1–20” (domyślnie), „Clockwise” (20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5) albo „Random” (od 2026-10-29): kolejność 1–20 losowana na start gry, jedna dla wszystkich graczy, bull zostaje na końcu, a Rematch losuje od nowa. Z „Target” daje to losowe sektory, double albo treble;
  - „Target”: „Any” (domyślnie), „Doubles” albo „Trebles”;
  - „Multiplier skips”, tylko przy „Any”, domyślnie włączone: D przesuwa o 2 cele, T o 3, także w wylosowanej kolejności;
  - „Co-op”.
- **Trafienie:** w „Any” każdy segment celu, a bull to 25 albo 50. W „Doubles” tylko D, w „Trebles” tylko T, a bull w obu tylko 50.
- **Koniec:** gdy ktoś zaliczy bulla, dogrywamy rundę, żeby wszyscy mieli tyle samo Tur. Wygrywa najmniej lotek. Przy tej samej liczbie lotek wygrywają wszyscy remisujący. Pozostali są sklasyfikowani według postępu.
- **Ekran wyników:** hero pokazuje imię, duży aktualny cel i kafelki lotek z trafieniem lub pudłem. Prawą połowę hero zajmuje duża tarcza w kolorach tarczy do wklikiwania lotek (od 2026-10-27, ze zgłoszenia):
  - proporcje są bliskie prawdziwym, tylko treble, double, 25 i bull są trochę szersze, żeby było je widać;
  - aktualny cel zachowuje swoje kolory i ma pomarańczowy, przerywany obwód, który biegnie dookoła. W „Doubles” i „Trebles” obwód obejmuje tylko jego pierścień. Numer celu wygląda jak pozostałe;
  - zaliczone cele są zakreskowane na szaro, a ich numery przygaszone (wariant O z makiet);
  - lotki z bieżącej Tury są małymi kropkami w białej obwódce, zielonymi przy trafieniu i czerwonymi przy pudle. Kropka leży na środku swojego pola, więc single nigdy nie wypada na trebla (test w `web/src/components/Dartboard.test.ts`).

  Lista graczy pokazuje postęp („7 / 21”) i cel.
- **Wyzwalacze:** „Target hit”, „Game won”.
- **Statystyki:** hit rate. Rekordem jest najmniej lotek do końca, osobno dla każdej kombinacji Target × Multiplier skips. „Order” nie tworzy osobnego wariantu.

## Full Board

- **Cele:** każdy sektor 1–20 i bull, w dowolnej kolejności. Jedno trafienie zalicza sektor, mnożnik nic nie daje.
- **Opcje:** „Target” jak w ATC (w „Doubles” i „Trebles” bull tylko 50), „Co-op”.
- **Koniec:** jak w ATC.
- **Ekran wyników:** hero pokazuje dużą tarczę aktywnego gracza na prawej połowie, jak w ATC: zaliczone sektory są zakreskowane, a lotki z bieżącej Tury są kropkami. Po lewej jest licznik „13 / 21” i kafelki lotek. Lista graczy pokazuje licznik.
- **Wyzwalacze:** „Sector cleared”, „Board cleared” (wygrana).
- **Statystyki:** rekordem jest najmniej lotek do końca, osobno dla każdego „Target”.

## 121

- **Tylko solo albo Co-op**, bez rywalizacji. Przy 2+ graczach Co-op jest włączony na sztywno.
- **Podejście:** zaczynasz od celu 121. Na checkout z double masz 3 albo 4 Tury (9 lub 12 lotek).
  - Bust działa jak w X01: wynik wraca do stanu sprzed Tury, a podejście trwa, dopóki są lotki.
  - Checkout przed końcem lotek kończy podejście, a reszta lotek przepada.
  - W ostatniej Turze podejścia Tura kończy się od razu, gdy pozostałymi lotkami nie da się już zamknąć wyniku, np. jedna lotka przy nieparzystej reszcie (od 2026-10-27, ze zgłoszenia).
  - W Co-op lotki podejścia rozkładają się na kolejnych graczy.
  - W Co-op kolejne podejścia zaczynają gracze na zmianę według kolejności gry (od 2026-11-04, ze zgłoszenia): podejście 1 zaczyna pierwszy, podejście 2 drugi, i tak dalej, z pominięciem wycofanych. Gdy wycofany zostaje zaczynający, następne podejście zaczyna następny po nim w kolejności. Wcześniej następne podejście zaczynał następny po ostatnim rzucającym, więc przy 2 graczach i 4 Turach zawsze zaczynał ten sam.
- **Sukces:** cel rośnie o 1. **Porażka:** cel zostaje i tracisz życie.
- **Życia:** zawsze 3. Gra kończy się po utracie ostatniego.
- **Opcje:**
  - „Visits per target”: 3 (domyślnie) albo 4;
  - „Refill lives on checkout”, domyślnie włączone: sukces przywraca 3 życia. Wyłączone oznacza 3 życia na całą grę.
- **Ekran wyników:** hero pokazuje cel, ile zostało do zamknięcia, życia i podpowiedź checkoutu z X01. Lotki do końca podejścia to duża liczba i kropka na każdą lotkę, po trzy na Turę, zużyte puste (od 2026-10-27, ze zgłoszenia). Od 2026-11-01 są w karcie „Darts left” pod listą graczy, bo tam było puste miejsce, a nie obok lotek Tury. Caller mówi jak w X01, bez „game shot” ([EFEKTY.md](EFEKTY.md#caller)).
  - **Drabinka celów** (od 2026-10-30, po grillingu): pionowy łańcuch kółek z numerami przy prawej krawędzi hero, jak pasek etapów procesu w Dynamics 365, połączony linią: ostatni zaliczony cel na górze (zielone kółko, na starcie puste miejsce), bieżący większy i pomarańczowy, trzy następne obrysowane w dół. Etykieta „Best N” pod kółkiem rekordu biurowego wariantu; gdy rekord jest dalej niż okno, pod ostatnim kółkiem ze strzałką w dół, a po pobiciu zostaje pod zaliczonym kółkiem, póki jest w oknie. Etykieta jest też w grze z gośćmi, choć taki wynik nie wchodzi do rekordów. Kółko celu nie powtarza serc ani liczby podejść. Pierwsza wersja, pozioma taśma dużych liczb pod wynikiem, odrzucona tego samego dnia jako za duża.
  - **Ruch po checkoucie:** gdy po takeoucie hero przełącza cel, łańcuch przesuwa się o jedno kółko w górę, a liczba celu w podpisie przewija się jak licznik (tylko cyfry, które się zmieniają). Oba ruchy startują razem i trwają 0,5 s. Undo i Poprawka cofają bez animacji.
  - **Hero bez tekstu „N darts left”** (od 2026-10-30, z przeglądu ekranu: kafelki lotek pokazują, ile rzucono).
  - **Kropki i serca:** przy checkoucie kropki podejścia zielenieją razem z kartą tury. Nieudane podejście błyska kropkami na czerwono i trzęsie traconym sercem w chwili końca Tury, razem z kartą „ATTEMPT FAILED”; po takeoucie kropki zapalają się od nowa po cichu, a przy „Refill lives” odzyskane serca wyskakują. Drabinka i odometr są tylko w hero, nie na karcie tury ani na telefonie.
- **Wyzwalacze:** „Checkout” i „Bust” (istnieją), „Attempt failed”.
- **Statystyki:** skuteczność podejść w %. W Co-op podejście i checkout liczą się każdemu, kto rzucał w tym podejściu (od 2026-10-30). Rekordem jest najwyższy zaliczony cel, osobno dla każdej kombinacji Visits × Refill, solo albo Co-op.

## Cricket

- **Sektory:** 15–20 i bull. S daje 1 znacznik, D 2, T 3. Bull 25 daje 1, a 50 daje 2. Trzy znaczniki zamykają sektor, a nadwyżka od razu punktuje (T20 przy 1 znaczniku zamyka 20 i daje 20 pkt).
- **Opcja „Mode”:**
  - „Standard” (domyślnie): punktujesz w sektorze zamkniętym u siebie i otwartym u któregoś rywala. Wygrywa ten, kto zamknął wszystko i ma co najmniej tyle punktów co każdy rywal;
  - „Cut-throat”: punkty dopisują się rywalom, którzy mają sektor otwarty. Wygrywa ten, kto zamknął wszystko i ma najmniej punktów.
- **Solo:** trening, czyli zamknąć wszystko w jak najmniejszej liczbie lotek, bez punktów.
- **Bez Co-op**, bez „No score” i bez Tactics.
- **Ekran wyników:** siatka z wierszami 20 … 15 i Bull oraz kolumną na gracza ze znacznikami /, X, Ⓧ. Punkty są nad kolumną, aktywny gracz ma pomarańczową kolumnę. Sektor zamknięty u wszystkich jest wyszarzony. Siatka jest szersza niż lista w innych grach i wypełnia całą wysokość, a punkty nad kolumnami są duże i zwężają się przy wielu graczach (od 2026-10-28, ze zgłoszenia o za małych wynikach). Hero obok siatki pokazuje imię i kafelki lotek ze znacznikami.
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
- **T1 liczy się zawsze jako zero** (od 2026-10-27), więc da się zejść poniżej 3. Nie jest pudłem: tura dalej trwa. Kafelek lotki pokazuje 0.
- **Pudło** (lotka poza punktowanym polem, także odbita) to nieudana tura bez względu na sumę.
- **Życia** (od 2026-11-06, po meczu w dwie osoby): opcja „Lives” 1–5, domyślnie 3, jak w Killerze. Nieudana tura od razu zabiera 1 życie, a zakres zostaje. Po utracie ostatniego życia gracz odpada.
- **Bez unieważniania rund** (od 2026-11-06): wcześniej, gdy w jednej rundzie odpadli wszyscy pozostali, runda się nie liczyła i zakres wracał. Ta zasada jest usunięta, rund się nie powtarza.
- **Gra** kończy się od razu, gdy zostaje jeden gracz, i daje mu punkt, nawet jeśli w tej rundzie jeszcze nie rzucał.
- **Opcja „First to”** 1–5, domyślnie 1. Kolejna gra startuje z zakresem 26–45 i wszystkimi graczami z pełnymi życiami, a zaczyna następny w kolejności. Mecz wygrywa ten, kto pierwszy zdobędzie N punktów.
- **Ekran wyników** (wariant B2.2 z `.scratch/hol-lives/mockup-b2.html`): duża suma Tury (przed pierwszą lotką 0) stoi jak szpilka nad swoim miejscem na skali 0–180: liczba i pionowa kreska do paska. Suma z kreską są czerwone, gdy Tura przegrywa (suma w zakresie albo pudło), a poza zakresem białe, bez napisu. Pasek jest zielony poza zakresem i czerwony w zakresie, pod nim podziałka co 30 (bez liczb, które wpadłyby na granice) i duże czerwone granice zakresu pod swoimi miejscami. Przy wąskim zakresie (start 26–45) granice rozsuwają się od środka. Przy samych końcach skali szpilka i liczby dosuwają się do krawędzi, więc nie wychodzą poza hero. Obok imienia są duże serca aktywnego gracza jak w 121: serce, które zabiera skończona nieudana Tura, pęka, zanim gracz wyjmie lotki. Karta Tury pokazuje wtedy „LIFE LOST”, a przy ostatnim życiu „OUT”. Lista graczy pokazuje punkty i małe serca jak w Knockout, a wyeliminowani w bieżącej grze są wyszarzeni.
- **Wyzwalacze:** „Life lost” (każda nieudana tura), „Player eliminated” (ostatnie życie), „Game won”, „Match won”.
- **Statystyki:** wygrane. Bez rekordu.
- **Znany przypadek brzegowy:** gdy zakres dojdzie do 180 na górze i 3 na dole, nikt nie da rady go ominąć. Nie obsługujemy tego osobno, bo to praktycznie niemożliwe. Taką grę kończy „End match”.

## Random Checkouts

Postanowienia z grillingu z 2026-10-29. Losowe sektory, double i treble są opcją „Order: Random” w [ATC](#around-the-clock-atc), a nie osobną grą.

- **Liczba do zamknięcia** jest losowana z zakresu. Liczb, których nie da się zamknąć przy wybranej regule (np. 169, 168, 166, 165, 163, 162, 159 przy Double), nigdy nie losujemy.
- **Do skutku:** reszta schodzi przez kolejne Tury jak w X01, bez limitu lotek. Bust cofa resztę do stanu sprzed Tury.
- **Bez końca:** nie ma limitu checkoutów ani Tur. Grę kończy „End match”, a „Save” pokazuje ekran wygranej z „Summary”. Liczba, której nikt nie zamknął, przepada.
- **Gracze:** 1–8.
  - **Rywalizacja:** wszyscy dostają tę samą liczbę, a każdy ma własną resztę i rzuca swoje Tury po kolei. Kto pierwszy zamknie, dostaje punkt od razu, bez dogrywania rundy. Potem wszyscy dostają nową liczbę, a pierwszy rzuca do niej ten, kto zamknął: to nagroda za checkout. Dalej kolejka idzie normalnie.
  - **Co-op:** jedna wspólna reszta, gracze rzucają Tury na zmianę. Punkt dostaje ten, kto zamknie, a drużyna ma wspólny licznik checkoutów. Po checkoucie losujemy nową liczbę i rzuca następny gracz.
- **Wygrana:** najwięcej punktów w chwili „End match”. Przy remisie wygrywają wszyscy remisujący. Gra zakończona przy 0 punktów albo w Co-op nie ma zwycięzcy, a ekran pokazuje „Game over”. Wyzwalacz „Game won” odpala tylko wtedy, gdy padł choć jeden checkout.
- **Opcje:**
  - „Range”: Min i Max z presetami „2–40”, „41–80”, „81–120”, „121–170” i „Any”. Max to 170 przy Double i 180 przy Single i Master, Min to 2 przy Double i 1 przy pozostałych. Domyślnie 41–80;
  - „Check-out”: Single, Double (domyślnie) albo Master, jak w X01;
  - „Hints”, domyślnie włączone: podpowiedź checkoutu z X01;
  - „Co-op”.
- **Ekran wyników:** hero jak w 121, czyli reszta, podpowiedź checkoutu (gdy „Hints” włączone) i kafelki lotek. Lista graczy pokazuje punkty i resztę każdego. Nagłówek np. „Random Checkouts · 41–80 · Double out”.
- **Caller** jak w 121: wynik Tury, „no score” i „you require”, także po nowej liczbie, bez „game shot” ([EFEKTY.md](EFEKTY.md#caller)).
- **Wyzwalacze:** „Checkout” i „Bust” (istnieją), „Game won” przy zapisie.
- **Statystyki:** liczba checkoutów, średnia liczba lotek na checkout i % checkoutów zamkniętych w pierwszej Turze. Bez rekordu, bo gra nie ma końca.

## Shanghai

Postanowienia z grillingu z 2026-10-29 ([#7](https://github.com/jgoliszewski/ITDarts/issues/7)).

- **Rundy:** w rundzie N celem jest sektor N. Opcja „Rounds”: 7 (domyślnie, sektory 1–7) albo 20 (1–20).
- **Punkty:** liczy się tylko sektor rundy, lotka daje N × mnożnik (S5 = 5, D5 = 10, T5 = 15). Inne sektory, bull i pudła dają 0.
- **Shanghai:** S, D i T sektora rundy w jednej Turze, w dowolnej kolejności. Przy 2+ graczach to natychmiastowa wygrana, bez dogrywania rundy. Solo Shanghai daje swoje punkty i Moment, a gra trwa do ostatniej rundy.
- **Koniec:** po ostatniej rundzie wygrywa najwięcej punktów. Przy remisie na pierwszym miejscu dogrywkę grają tylko remisujący: każdy jedną Turę na sektor 20, liczoną jak zwykła runda. Wygrywa najwięcej w tej rundzie, kolejny remis daje kolejną rundę na 20, do skutku. Shanghai na 20 w dogrywce też wygrywa. Punkty z dogrywki doliczają się do sumy.
- **Gracze:** 1–8, bez Co-op.
- **Ekran wyników:** jak w ATC. Hero pokazuje imię, duży sektor rundy z „Round 5 / 7” (w dogrywce „Tiebreak”), punkty bieżącej Tury i kafelki lotek: zielone, gdy lotka trafi sektor rundy, czerwone przy pudle. Prawą połowę hero zajmuje tarcza z ATC z podświetlonym sektorem rundy. Lista graczy pokazuje sumę punktów, a w dogrywce wyszarza tych, którzy jej nie grają. Karta Tury pokazuje dużą liczbę punktów Tury. Nagłówek np. „Shanghai · 7 rounds”.
- **Wyzwalacze:** „Hit” i „Miss” na każdą lotkę, nowy „Shanghai” (XL, dobry, na start dźwięk i ledy z White Horse), „Game won”.
- **Statystyki:** wygrane, liczba Shanghai i hit rate (% lotek w sektor rundy). Rekordem jest najwyższa suma punktów w grze solo, osobno dla 7 i 20 rund.

## Gotcha

Postanowienia z grillingu z 2026-10-29 ([#7](https://github.com/jgoliszewski/ITDarts/issues/7)).

- **Cel:** dojść dokładnie do celu, od 0 w górę. Opcja „Target”: 101, 201 (domyślnie) albo 301. Bez wymogu double.
- **Bust** jak w X01: przekroczenie celu cofa wynik do stanu sprzed Tury i kończy Turę.
- **Wygrana:** kto pierwszy trafi dokładnie w cel, wygrywa od razu, także w środku Tury.
- **Gotcha:** na koniec Tury, jeśli wynik gracza się zmienił, każdy rywal z takim samym wynikiem spada do 0. Bust nikogo nie zeruje, bo wynik wraca do stanu sprzed Tury.
- **Gracze:** 2–8.
- **Ekran wyników:** hero pokazuje imię, duży wynik, „Left” do celu i kafelki lotek, przygaszone tylko przy buście. Bez podpowiedzi checkoutu. Lista graczy pokazuje wyniki. Po karcie Tury notka w hero pokazuje np. „Gotcha! Kuba → 0”, gdy ktoś został wyzerowany (od 2026-11-01 już nie na samej karcie). Nagłówek np. „Gotcha · 201”.
- **Caller** podaje wynik Tury jak w X01, bez „you require” i bez „game shot”.
- **Wyzwalacze:** „Bust” (istnieje), nowy „Gotcha” (L, zabawny, na start dźwięk i ledy z Bed and breakfast), „Game won”. Bez „Hit” i „Miss”.
- **Statystyki:** wygrane i liczba Gotcha (ile razy gracz kogoś wyzerował). Bez rekordu.

## Knockout

Postanowienia z grillingu z 2026-10-30 ([#7](https://github.com/jgoliszewski/ITDarts/issues/7)).

- **Runda:** każdy, kto jest jeszcze w grze, rzuca jedną Turę. Zaczynający przesuwa się co rundę o jedno miejsce w kolejności (wyeliminowanych pomijamy). Kolejność pierwszej rundy ustalają Shuffle albo Bull-off.
- **Suma Tury** jak w X01: S/D/T × sektor, bull 25 albo 50. Pudło i odbita lotka dają 0, ale same nie przegrywają.
- **Najniższa suma rundy traci życie**, także przy remisie: tracą je wszyscy z najniższą sumą. Życia odbieramy na koniec rundy, po Turze ostatniego gracza.
- **Życia:** zawsze 3, bez opcji. Po stracie ostatniego gracz odpada, a kolejka go pomija.
- **Wszyscy odpadliby naraz:** jeśli najniższą sumę mają wszyscy pozostali i każdy ma ostatnie życie, runda się nie liczy. Nikt nie traci życia i gramy następną rundę.
- **Wygrana:** ostatni gracz z życiem. „End match” z „Save” zapisuje grę bez zwycięzcy, jak w Killer.
- **Gracze:** 2–8.
- **Ekran wyników:** hero pokazuje imię, życia, dużą sumę Tury i kafelki lotek (przygaszone przy 0). Obok sumy jest duży kafelek „To beat” z najniższą sumą rundy do tej pory, zielony („Beaten”), gdy Tura ją przebije; pierwszy w rundzie widzi „First to throw” (od 2026-10-30, ze zgłoszenia: wynik do pobicia był za mało widoczny). Lista graczy pokazuje sumę w bieżącej rundzie i życia jako duże serca, a wyeliminowani są wyszarzeni. Karta Tury po ostatniej Turze rundy pokazuje, kto stracił życie („Kuba loses a life”, „Kuba is out”, „Round replayed: everyone would be out”). Nagłówek „Knockout · 3 lives”.
- **Caller** podaje sumę Tury jak w X01, bez „you require” i bez „game shot”.
- **Wyzwalacze** (od 2026-10-30, ze zgłoszenia: smutny dźwięk na koniec rundy słyszał ostatni gracz, choć odpadał ktoś inny):
  - nowy „Lowest visit” (M, zły, dźwięk i ledy z Life lost): Tura jest najniższa spośród rzuconych w tej rundzie, remis też. Nie odpala dla pierwszej Tury rundy;
  - „Life lost” i „Player eliminated” na koniec rundy odpalają tylko wtedy, gdy dotyczą gracza, który właśnie rzucał. Pozostali usłyszeli „Lowest visit” przy swojej Turze;
  - „Game won”.
- **Statystyki:** wygrane i średnia Tura. Bez rekordu.

## Football

Postanowienia z grillingu z 2026-10-30 ([#7](https://github.com/jgoliszewski/ITDarts/issues/7)).

- **Piłka:** jedna na wszystkich, na starcie na środku (nikt jej nie ma). Bull przejmuje piłkę ze środka albo od posiadacza. Bull posiadacza nic nie robi.
- **Gol:** z piłką każdy double 1–20 to gol, a strzelec zatrzymuje piłkę i strzela dalej, aż ktoś mu ją odbierze. Bull nigdy nie jest golem. Po przejęciu piłki następna lotka tej samej Tury może już być golem.
- **Opcje:**
  - „Kick-off”: „25/50” (domyślnie, piłkę daje każdy bull) albo „Bull only” (tylko 50);
  - „Goals”: 3, 5 (domyślnie) albo 10;
  - Bull-off.
- **Wygrana:** kto pierwszy dobije do liczby goli, wygrywa od razu, także w środku Tury. „End match” z „Save” kończy grę jak wygraną: wygrywa najwięcej goli, remisujący dzielą wygraną, a przy 0 goli nie ma zwycięzcy.
- **Gracze:** 2–8, każdy na siebie.
- **Ekran wyników:** hero pokazuje imię, dużą liczbę goli, kafelki lotek (zielone dla przejęcia i gola, czerwone dla reszty) i gdzie jest piłka. Prawą połowę hero zajmuje tarcza z ATC: bez piłki podświetlony bull (przy „Bull only” sam środek), z piłką pierścień doubles. Lista graczy pokazuje gole i piłkę przy posiadaczu. Karta Tury: „Goal!”, „2 goals!” albo „Ball won”, z dopiskiem, komu piłka została odebrana. Nagłówek np. „Football · 25/50 · First to 5”.
- **Caller** milczy.
- **Wyzwalacze:** nowy „Goal” (M, dobry, na start dźwięk i ledy z Ton) i „Game won”. „Goal” jest w kolejności przed „Game won”, bo wygrana pada tą samą lotką. Przejęcie piłki nie ma Momentu.
- **Statystyki:** wygrane i liczba goli. Bez rekordu.

## Statystyki na `/stats`

- Wybór gry.
- Dla gier z rekordem: tabela top 10 osobno dla każdego wariantu, z wynikiem, Graczem albo składem co-op i datą.
- Pod tabelą statystyki per gracz tej gry: hit rate, MPR, skuteczność podejść w 121, wygrane, checkouty i lotki na checkout w Random Checkouts, liczba Shanghai, liczba Gotcha, średnia Tura w Knockout, gole w Football.
- Zasady zapisu i okna są w [STATYSTYKI.md](STATYSTYKI.md).
