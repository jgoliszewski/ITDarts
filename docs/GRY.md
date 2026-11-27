# ITDarts: minigierki (etap 2)

Postanowienia z grillingu z 2026-10-26 ([#3](https://github.com/jgoliszewski/ITDarts/issues/3)). Pojęcia są zdefiniowane w [GLOSSARY.md](../GLOSSARY.md), UI w [UI.md](UI.md), efekty w [EFEKTY.md](EFEKTY.md), a statystyki w [STATYSTYKI.md](STATYSTYKI.md).

## Zakres

Gramy w X01 oraz 16 minigierek: Around the Clock, Full Board, 121, Cricket, Killer, Higher or Lower, Random Checkouts, Shanghai, Gotcha (dwie od 2026-10-29), Knockout, Football (od 2026-10-30), Bullseye (od 2026-11-09), Free throw (od 2026-11-13), Hare and Hounds, Catch 40 (dwie od 2026-11-27) i Bob's 27 (od 2026-11-27).

Backlogu nie ma. Halve-It, Count Up i Bermuda Triangle odrzuciliśmy 2026-10-30 (Count Up dalej odrzucony jako gra z wynikiem do pobicia: rzuty treningowe bez celu i bez zwycięzcy to osobny [Free throw](#free-throw), decyzja z 2026-11-13), razem z innymi propozycjami z tamtej rozmowy (m.in. Tic-Tac-Toe, Follow the Leader, Baseball, Golf) ([#7](https://github.com/jgoliszewski/ITDarts/issues/7)). Bob's 27 był na tej liście, ale 2026-11-27 odwróciliśmy tę decyzję: gra weszła jako trening double'ów z własnym rekordem ([Bob's 27](#bobs-27)).

## Wspólne zasady

- **Jedna gra, bez legów i setów.** Po końcu gry jest ekran wygranej z „Rematch”, „New match” i „Back to lobby”, jak w X01. Wyjątkiem są Higher or Lower i Gotcha z opcją „First to”.
- **Bez limitu rund** w żadnej grze poza Shanghai, który ma 7 albo 20 rund, Free throw z opcją „Visits” (10, 20 albo 30 Tur, domyślnie bez limitu), Catch 40, który kończy się po 40 celach, i Bob's 27, który ma 21 rund. Grę, która się zawiesi, kończy „End match” z Pilota. Random Checkouts i Free throw bez limitu nie mają końca wcale i zawsze kończy je „End match”.
- **Gracze:** 1–8, bez drużyn. Killer i Higher or Lower wymagają co najmniej 2 graczy, Hare and Hounds dokładnie 2, a Free throw dokładnie 1 (pole `maxPlayers` modułu gry: hub odrzuca start z większym składem).
- **Wycofanie gracza** w trakcie gry jest w każdej grze, zasady w [UI.md](UI.md#wycofanie-gracza).
- **Silnik:** każda gra liczy stan wyłącznie z Logu zdarzeń. Poprawka i Undo działają więc w każdej grze bez osobnej logiki, np. poprawka cofa zaliczony sektor przez przeliczenie stanu.
- **Tura** jak w X01: 3 lotki i Takeout. Po trafieniu celu następna lotka w tej samej Turze idzie już w kolejny cel.
- **Nagłówek** Ekranu wyników pokazuje grę i jej opcje, np. „ATC · Doubles · Clockwise”.

### Setup na Pilocie

- Kroki: **Players → Game → Options** ([UI.md](UI.md#start-i-koniec-meczu), od 2026-11-27; wcześniej jeden ekran: gra, opcje, gracze).
- **Kafelki gier** są w trzech grupach z nagłówkami, w stałej kolejności (od 2026-10-29, wcześniej ostatnio grana gra była pierwsza):
  - **Classic:** X01;
  - **Practice:** ATC, Full Board, 121, Random Checkouts, Free throw, Catch 40, Bob's 27;
  - **Versus:** Cricket, Killer, Higher or Lower, Shanghai, Gotcha, Knockout, Football, Bullseye, Hare and Hounds.

  Kafelek ma nazwę i opis (najwyżej 2 linie). Kafle nie są wygaszane, bo gra jest wybierana przed składem; gdy skład nie pasuje, przycisk Next na kroku Players jest zablokowany z powodem („2+ players”, „2 players” przy Hare and Hounds albo „Solo only”). Te same grupy są w wyborze gry na `/stats`.
- **Gracze, kolejność rzucania (Random, Closest, PDC) i goście** działają tak samo jak w X01. Kolejność wybiera się w kroku Players, jedna dla wszystkich gier; Nowy mecz wkłada bull-off do opcji każdej gry, która go ma (wszystkie poza Free throw).
- **„Start”** jest zablokowany, gdy skład nie pasuje do gry, z komunikatem, np. „Killer needs 2 or more players”, „Free throw is for 1 player” albo „Hare and Hounds is for 2 players”.
- **Opcje** setup pamięta osobno dla każdej gry.
- **Podpowiedź „i”** przy każdej opcji to jedno zdanie wyjaśnienia w dymku nad układem (od 2026-10-27), więc nic się nie przesuwa. Zamyka go stuknięcie gdziekolwiek. Tekst pochodzi z tej samej definicji co sekcja „Options” w opisie gry.
- **Opcje dla 2+ graczy** (Mode w Cricket, Co-op) są tylko przy 2+ graczach (od 2026-11-27, wcześniej widoczne od razu). Przy solo zamiast nich stoi linia „Solo: Mode appears with 2 or more players.”. Bez graczy nie da się przejść dalej niż Players („Pick players” w przycisku „Next”).

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
- Rekordy (z Ekranem rekordu) mają ATC, Full Board, 121, solo Cricket, solo Shanghai, Catch 40 i Bob's 27 (te dwie w jednym wariancie, solo i versus razem). X01 ma od 2026-11-16 tabele rekordów biura na `/stats` (Highest visit, Highest checkout, Best leg na wynik startowy), ale **bez Ekranu rekordu** i bez Momentu „New record”: nie ma definicji rekordu w module gry ([STATYSTYKI.md](STATYSTYKI.md#rekordy-biura-x01)).
- **Ekran rekordu:** po „Start” Ekran wyników pokazuje przez około 4 s nazwę wariantu i rekord biura, czyli wartość, kto go ustanowił i kiedy.
  - Pod rekordem biura (od 2026-11-23) stoją plakietki rekordów osobistych: solo „PB 31 Alice 3 Nov” (pierwsza gra w wariancie: „PB – Alice First game”), przy kilku graczach po jednej na gracza bez daty, od 5 graczy w dwóch kolumnach. Gracz, który trzyma rekord biura, ma pomarańczową „Best · PB” (solo bez liczby, bo stoi nad nią). Goście nie mają plakietki.
  - W Co-op pokazuje rekord co-op wariantu z imionami składu, a pod nim „Team 29 Alice & Bob 5 Nov”, czyli [rekord składu](#rekordy-w-trakcie-gry) (pierwsza gra składu: „Team –”). Skład z gościem nie ma plakietki.
  - Bez rekordu pokazuje „No record yet”, bez plakietek.
  - Pilot ma „Skip”. Ekran wraca przy każdym Rematch. Bull-off, jeśli jest włączony, idzie po nim, także w Rematch (nowy bull-off ustala kolejność gry).
- **Nowy rekord** (biura albo osobisty) sprawdzamy na końcu gry, a nie w trakcie. Odpala Wyzwalacz „New record” i animację na ekranie wygranej. Remis nie bije rekordu.
  - W Co-op dochodzi „NEW TEAM BEST”, gdy skład pobił swój rekord składu, a nie rekord biura (od 2026-11-23). Wyzwalacz „New record” tego nie odpala, zostaje tylko dla rekordu biura i osobistego.
- Goście nie mają rekordów.

### Rekordy w trakcie gry

Postanowienia z grillingu z 2026-11-23 (plan i makieta w `.scratch/records-live/`). Dotyczą wszystkich gier z rekordem: ATC, Full Board, solo Cricket, solo Shanghai, 121 i (od 2026-11-27) Bob's 27. X01 i Pilot (telefon) bez zmian.

- **Plakietki w hero** (prawy górny róg, górą równo z imieniem, jedna pod drugą, 40 u wysokości): „Best 23” (rekord biura, pomarańcz) nad „PB 31” (rekord osobisty gracza, który rzuca, neutralny). Same liczby, bez kto i kiedy. Wszystkie gry z rekordem poza 121 mają tarczę, więc stoją w prawym górnym rogu karty tarczy, poza pierścieniem numerów ([UI.md](UI.md#rekordy-w-trakcie-gry)).
  - Gracz trzyma rekord biura (jego PB jest pierwszym miejscem): jedna plakietka „Best · PB”. Remis z rekordem ustanowionym wcześniej przez kogoś innego nie scala.
  - Gość: tylko „Best”. Brak PB: „PB –”. Brak rekordu biura: „Best –”.
  - Kilku graczy bez Co-op: PB gracza, który rzuca, zmienia się z Turą.
  - Co-op: „Team 29” zamiast PB, czyli **rekord składu**: najlepszy wynik dokładnie tego zbioru graczy, kolejność bez znaczenia, a gracz wycofany z meczu nie należy do składu (po wycofaniu plakietka pokazuje rekord nowego składu). Scalone „Best · Team”, brak „Team –”, skład z gościem tylko „Best”.
- **Poza zasięgiem:** plakietka szarzeje (`--off`) z przekreśloną liczbą, gdy gra nie może już pobić rekordu (remis nie bije). Moduł gry podaje najlepszy wynik jeszcze osiągalny (`RecordDef.bound`):
  - ATC bez Skips oraz z Doubles i Trebles: zużyte lotki plus pozostałe cele. ATC ze Skips: same zużyte lotki (treble przeskakuje cele, więc minimum nie wiadomo); szarzeje dopiero po przekroczeniu.
  - Full Board: zużyte lotki plus niezamknięte sektory.
  - solo Cricket: zużyte lotki plus najmniej lotek na brakujące znaczniki (treble zamyka numer jedną lotką, bull bierze najwyżej 2 znaczniki na lotkę).
  - solo Shanghai: punkty plus trzy treble na każdą lotkę, która została w rundzie i w następnych rundach.
  - Bob's 27: wynik plus 6N za każdą pozostałą rundę D1–D20 (trzy double'e po 2N, razem z lotkami, które zostały w bieżącej rundzie) i 150 za rundę bull; gracz, który odpadł, nie ma już szansy (bound 0).
  - 121 nie szarzeje (gra nie ma końca). W Co-op liczą się lotki drużyny.
- **121:** zamiast plakietek druga chorągiewka na drabince, „PB 122” (Co-op: „Team”) obok „Best 135”; równe i należące do gracza: jedna „Best · PB”. Dwie chorągiewki na jednym szczeblu albo obie poza oknem (ze strzałką ↓) stoją jedna pod drugą. Rekord pobity w tej grze zostaje na zielonym szczeblu z ✓, póki jest w oknie. Pierwsza gra składu w Co-op nie ma chorągiewki „Team”.
- **Modal rekordów:** stuknięcie w plakietki albo w chorągiewkę 121 otwiera ten sam modal ([UI.md](UI.md#rekordy-w-trakcie-gry)): rekord biura, PB gracza (przy kilku graczach PB wszystkich, rzucający z obrysem i „THROWING”) albo rekord składu, a po prawej top 5 biura wariantu, jeden wynik na gracza (Co-op: na skład), z wyróżnionym wierszem gracza albo składu. Gdy jest poza top 5, dochodzi pod „⋯” z miejscem.
- **Skąd dane:** serwer liczy rekord biura, PB każdego gracza z miejscem, rekord składu i top 5 raz przy starcie meczu (`RecordInfo` w `server/protocol.ts`), a w Co-op od nowa po wycofaniu gracza i jego cofnięciu.

## Around the Clock (ATC)

- **Cele:** po kolei 1–20, na końcu zawsze bull.
- **Opcje:**
  - „Order”: „1–20” (domyślnie), „Clockwise” (20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5) albo „Random” (od 2026-10-29): kolejność 1–20 losowana na start gry, jedna dla wszystkich graczy, bull zostaje na końcu, a Rematch losuje od nowa. Z „Target” daje to losowe sektory, double albo treble;
  - „Target”: „Any” (domyślnie), „Doubles” albo „Trebles”;
  - „Multiplier skips”, tylko przy „Any”, domyślnie włączone: D przesuwa o 2 cele, T o 3, także w wylosowanej kolejności;
  - „Co-op”.
- **Trafienie:** w „Any” każdy segment celu, a bull to 25 albo 50. W „Doubles” tylko D, w „Trebles” tylko T, a bull w obu tylko 50.
- **Koniec:** gdy ktoś zaliczy bulla, dogrywamy rundę, żeby wszyscy mieli tyle samo Tur. Wygrywa najmniej lotek. Przy tej samej liczbie lotek wygrywają wszyscy remisujący. Pozostali są sklasyfikowani według postępu.
- **Ekran wyników:** układ w trzech kolumnach jak w każdej grze z tarczą ([UI.md](UI.md#ekran-wyników-dla-gier-z-tarczą)). Po lewej imię, duży aktualny cel i statystyki Darts, Hit rate, Per target. W środku tarcza w hero z rzędem kafelków lotek (trafienie zielone, pudło czerwone) i pigułkami rekordów w rogu. Po prawej lista graczy z postępem („7 / 21”), celem i paskiem postępu. Tarcza ([UI.md](UI.md#tarcza-w-hero)):
  - aktualny cel jest pomarańczowym segmentem. W „Any” świeci cały jego klin, a w „Doubles” i „Trebles” tylko jego ring double albo treble, z pomarańczowym obrysem (bull w obu tylko bullseye);
  - zaliczone cele są zielonymi segmentami z przygaszonym klinem, reszta jest szara;
  - lotki z bieżącej Tury są małymi kropkami w białej obwódce, zielonymi przy trafieniu i czerwonymi przy pudle. Kropka leży na środku swojego pola, więc single nigdy nie wypada na trebla (test w `web/src/components/Dartboard.test.ts`).
  - Tarcza pokazuje cele gracza, który rzuca. Hero nie powtarza postępu ani liczby lotek („3 / 21 · 5 darts” zniknęło 2026-11-26).
- **Wyzwalacze:** „Target hit”, „Game won”.
- **Statystyki:** hit rate. Rekordem jest najmniej lotek do końca, osobno dla każdej kombinacji Target × Multiplier skips. „Order” nie tworzy osobnego wariantu.

## Full Board

- **Cele:** każdy sektor 1–20 i bull, w dowolnej kolejności. Jedno trafienie zalicza sektor, mnożnik nic nie daje.
- **Opcje:** „Target” jak w ATC (w „Doubles” i „Trebles” bull tylko 50), „Co-op”.
- **Koniec:** jak w ATC.
- **Ekran wyników:** jak w ATC, w układzie z tarczą ([UI.md](UI.md#ekran-wyników-dla-gier-z-tarczą)). Tarcza aktywnego gracza: sektory jeszcze do zaliczenia są pomarańczowe (w „Doubles” i „Trebles” z obrysem ringu celu, bull tylko bullseye), zaliczone zielone z przygaszonym klinem, a lotki z bieżącej Tury są kropkami. Po lewej licznik „13 / 21” z kickerem „Sectors” i statystyki Darts, Hit rate, Per sector (bez „N darts” w notce). Lista graczy pokazuje licznik i pasek postępu.
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
  - **Drabinka celów** (od 2026-10-30, po grillingu): pionowy łańcuch kółek z numerami przy prawej krawędzi hero, jak pasek etapów procesu w Dynamics 365, połączony linią: ostatni zaliczony cel na górze (zielone kółko, na starcie puste miejsce), bieżący większy i pomarańczowy, trzy następne obrysowane w dół. Etykieta „Best N” pod kółkiem rekordu biurowego wariantu; gdy rekord jest dalej niż okno, pod ostatnim kółkiem ze strzałką w dół, a po pobiciu zostaje pod zaliczonym kółkiem, póki jest w oknie. Od 2026-11-23 obok niej chorągiewka PB (Co-op: Team), pobity rekord zielony z ✓, a stuknięcie otwiera modal rekordów ([Rekordy w trakcie gry](#rekordy-w-trakcie-gry)). Etykieta jest też w grze z gośćmi, choć taki wynik nie wchodzi do rekordów. Kółko celu nie powtarza serc ani liczby podejść. Pierwsza wersja, pozioma taśma dużych liczb pod wynikiem, odrzucona tego samego dnia jako za duża.
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
- **Opcja „Sectors”** (od 2026-11-19, widoczna zawsze, także solo): „15–20” (domyślnie) albo „Random”. Random losuje przy starcie 6 różnych numerów z 1–20 (mogą wypaść też 15–20), bull zostaje. Numery z ziarna zalogowanego na start (jak ATC Order: Random), więc Undo i Poprawka odtwarzają te same, a Rematch losuje nowe. Siatka: malejąco, bull na końcu. Stare mecze bez opcji grają jak klasyczny.
- **Solo:** trening, czyli zamknąć wszystko w jak najmniejszej liczbie lotek, bez punktów.
- **Bez Co-op**, bez „No score” i bez Tactics.
- **Ekran wyników:** siatka z wierszami 20 … 15 (w Random wylosowane numery malejąco) i Bull oraz kolumną na gracza ze znacznikami /, X, Ⓧ. Punkty są nad kolumną, aktywny gracz ma pomarańczową kolumnę. Sektor zamknięty u wszystkich jest wyszarzony. Siatka jest szersza niż lista w innych grach i wypełnia całą wysokość, a punkty nad kolumnami są duże i zwężają się przy wielu graczach (od 2026-10-28, ze zgłoszenia o za małych wynikach). Hero (lewa kolumna) pokazuje imię, duże punkty (bez kickera „Points”; solo kicker „Darts” i lotki jako duża liczba), MPR i statystyki Marks i Darts (solo tylko Marks). Kafelki lotek ze znacznikami stoją pod tarczą. **Tarcza** (od 2026-11-26 w obu wariantach, wcześniej od 2026-11-20 tylko w Random, [UI.md](UI.md#tarcza-w-hero)) pokazuje sektory w grze i bull w rzucającym graczu: pomarańczowy segment z 0–2 kreskami to otwarty sektor (kreski to jego znaczniki, jeden znacznik to jedna kreska), zielony z trzema kreskami to zamknięty przez niego (klin dalej świeci, bo sektor punktuje), szary z zakreskowanym klinem to zamknięty u wszystkich, a pozostałe numery są szare. Kropki lotek Tury jak w innych grach z tarczą. Od 5 graczy legenda „numer → imię” stoi w lewej kolumnie pod wynikiem.
- **Wyzwalacze:** „Marks in visit” 5–9 (9 przy trzech różnych trebles to White Horse), „Sector closed”, „Game won”.
- **Statystyki:** MPR (znaczniki na rundę). Rekordem jest solo: najmniej lotek; Random ma własny rekord (`cricket:solo:random`, „Cricket · Solo · Random”), klasyczny zostaje `cricket:solo`.

## Killer

- **Numery:** serwer losuje każdemu graczowi unikalny numer 1–20 i pokazuje go przed startem. Pilot ma „Reroll”.
- **Killer:** trafienie własnego double daje status killera do końca gry. Liczy się tylko D.
- **Życia:** opcja „Lives” 1–5, domyślnie 3.
  - Killer, który trafi double rywala, zabiera mu 1 życie.
  - Killer, który trafi własny double, traci 1 życie.
  - Single i treble nic nie robią.
- **Eliminacja** od razu po utracie ostatniego życia, także w środku Tury. Wygrywa ostatni gracz z życiem.
- **Ekran wyników:** lista pokazuje numer, życia (serca) i czerwoną plakietkę „Killer”, a wyeliminowani są wyszarzeni. Lewa kolumna to aktywny gracz z sercami pod imieniem, kickerem „Your double” (przed statusem) albo „Killer”, numerem i statystykami Lives taken i Rivals left. Kafelki lotek stoją pod tarczą. **Tarcza** ([UI.md](UI.md#tarcza-w-hero), od 2026-11-26) pokazuje rzucającemu, w co celować:
  - przed statusem killera jedynym celem jest własny double: pomarańczowy segment z obrysem pierścienia double i kreskami własnych żyć;
  - killer widzi double żywych rywali jako pomarańczowe segmenty z obrysem double i kreskami ich żyć (tyle kresek, ile opcja „Lives”, do 5). Własny double jest **czerwony** z kreskami własnych żyć, bo trafienie go odbiera życie;
  - wyeliminowani i numery, których nikt nie ma, są szare. Sąsiednie double w tym samym kolorze mają jeden obrys, a w różnych (np. czerwony obok pomarańczowego) osobne.
  - Zniknęły podpowiedzi „Hit a rival double” i „Hit your double to become a killer”: robi to tarcza.
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
- **Statystyki:** wygrane, winrate i „Visits survived”, czyli % Tur bez utraty życia (`survived ÷ visits` w `stats` gracza, ze wszystkich gier meczu; Tura urwana wycofaniem się nie liczy; stare mecze bez tych pól to brak danych). Bez rekordu.
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
- **Historia checkoutów** (2026-11-09, tylko [podsumowanie meczu](UI.md#podsumowanie-meczu), bez zapisu w bazie i bez `/stats`): jeden wiersz na wylosowaną liczbę, w kolejności gry. Kto zamknął, jego lotki przy tej liczbie (ta sama definicja co „darts per checkout”), Tury i busty przy liczbie (wszystkich graczy), lotki Tury zamykającej (np. „S1 D17”) i znaczek „1st visit” (ta sama definicja co statystyka). Ostatnia liczba, której nikt nie zamknął, jest wyszarzona jako „Not closed” z Turami i bustami, a bez wiersza, gdy nie padła przy niej żadna Tura. Liczy ją ten sam odtwarzany log co resztę gry, więc Undo i poprawki ją zmieniają.

## Free throw

Postanowienia z grillingu z 2026-11-13. Rzuty treningowe bez celu i bez zwycięzcy; to nie Count Up (odrzucony), bo nie ma wyniku do pobicia ani wygranej.

- **Gracze:** tylko solo, dokładnie 1. Bez Bull-offu, bez Co-op.
- **Tura:** jak wszędzie, 3 lotki i Takeout. Każda lotka liczy się za swoją wartość jak w X01. Undo i Poprawka działają z logu tur.
- **Opcje:** „Visits”: Unlimited (domyślnie), 10, 20 albo 30.
- **Koniec:** gra z limitem kończy się sama, gdy ostatnia Tura limitu jest zamknięta: Takeoutem albo „Next player” (Tura zamknięta przed trzecią lotką też się liczy). Po trzeciej lotce tej Tury ekran dalej pokazuje jej kartę, a fakt `visit` i caller padają jak w X01. Undo po końcu wraca do otwartej ostatniej Tury. Bez limitu kończy ją przycisk „Finish” (od 2026-11-16, obok Undo na Pilocie i telefonie, w każdej Turze, także z limitem przed jego końcem) albo „End match” z menu. „Finish” działa jak „End match” z „Save”, bez pytania: kończy grę zdarzeniem `end`, jak w Random Checkouts. W obu przypadkach **nikt nie wygrywa**: ekran „Game over” z wynikiem (np. „10 visits · average 41.3”) i „Summary”, bez „WINNER” i bez Wyzwalacza „Match won”. Undo cofa koniec.
- **Ekran wyników:** hero to suma bieżącej Tury z podpisem „This visit”, przy limicie z notką „Visit 7 of 20”. Tarcza w hero bez celu (podpis „No target” dla czytnika ekranu): cała w pełnych kolorach, z szarymi segmentami numerów, i kropki lotek Tury w miejscu wbicia. Po lewej statystyki Average, Darts, Highest visit. Lotki to kafelki „pole / wartość” bez kolorowania trafień. Wiersz gracza: średnia z 3 lotek z podpisem „average · 3 darts”. Na telefonie podpis przy dużej liczbie to „Average · Visit 1 of 10” (bez limitu samo „Average”), a suma Tury jest w „THIS TURN”. Ekran „Game over”: Average, Darts, Highest visit, 60+, 80+, 100+ (przy więcej niż 3 kafelkach siatka 3×2 jak w X01). Nagłówek „Free throw” albo „Free throw · 10 visits”.
- **Telefon:** „this turn” to suma Tury.
- **Efekty, animacje i caller jak w X01** (poza tym, co wymaga wyniku do zejścia: bust, checkout, „you require”, „game shot”): zob. [EFEKTY.md](EFEKTY.md). Free throw nie ma własnej listy efektów.
- **Statystyki:** mecz zapisany jako Free throw. Na `/stats`: średnia z 3 lotek (punkty / lotki × 3), lotki, najwyższa Tura (maksimum z meczów, nie suma), 60+, 80+, 100+ ([STATYSTYKI.md](STATYSTYKI.md#inne-gry)). Lotki trafiają do heatmapy gracza dla gry Free throw. Bez rekordu i bez Ekranu rekordu. `/stats` nie pokazuje „Won” ani winrate (nikt nigdy nie wygrywa), a lobby „LAST MATCH” pokazuje średnią z 3 lotek.

## Shanghai

Postanowienia z grillingu z 2026-10-29 ([#7](https://github.com/jgoliszewski/ITDarts/issues/7)).

- **Rundy:** w rundzie N celem jest sektor N. Opcja „Rounds”: 7 (domyślnie, sektory 1–7) albo 20 (1–20).
- **Punkty:** liczy się tylko sektor rundy, lotka daje N × mnożnik (S5 = 5, D5 = 10, T5 = 15). Inne sektory, bull i pudła dają 0.
- **Shanghai:** S, D i T sektora rundy w jednej Turze, w dowolnej kolejności. Przy 2+ graczach to natychmiastowa wygrana, bez dogrywania rundy. Solo Shanghai daje swoje punkty i Moment, a gra trwa do ostatniej rundy.
- **Koniec:** po ostatniej rundzie wygrywa najwięcej punktów. Przy remisie na pierwszym miejscu dogrywkę grają tylko remisujący: każdy jedną Turę na sektor 20, liczoną jak zwykła runda. Wygrywa najwięcej w tej rundzie, kolejny remis daje kolejną rundę na 20, do skutku. Shanghai na 20 w dogrywce też wygrywa. Punkty z dogrywki doliczają się do sumy.
- **Gracze:** 1–8, bez Co-op.
- **Ekran wyników:** jak w ATC. Hero pokazuje imię, duży sektor rundy z „Round 5 / 7” (w dogrywce „Tiebreak”), pod nim sumę punktów i punkty bieżącej Tury („61 points · 12 this visit”, suma od 2026-11-23, żeby plakietka „Best” miała się z czym porównać) i kafelki lotek: zielone, gdy lotka trafi sektor rundy, czerwone przy pudle. Tarcza ([UI.md](UI.md#tarcza-w-hero)) ma pomarańczowy segment sektora rundy z trzema kreskami: pełna kreska to S, D albo T tego sektora trafione w bieżącej Turze (trzy pełne to Shanghai); reszta numerów szara. Punktów tarcza nie pokazuje, więc zostają w notce, a po lewej statystyki Darts, Hit rate, Shanghais. Lista graczy pokazuje sumę punktów, a w dogrywce wyszarza tych, którzy jej nie grają. Karta Tury pokazuje dużą liczbę punktów Tury. Nagłówek np. „Shanghai · 7 rounds”.
- **Wyzwalacze:** „Hit” i „Miss” na każdą lotkę, nowy „Shanghai” (XL, dobry, na start dźwięk i ledy z White Horse), „Game won”.
- **Statystyki:** wygrane, liczba Shanghai i hit rate (% lotek w sektor rundy). Rekordem jest najwyższa suma punktów w grze solo, osobno dla 7 i 20 rund.

## Gotcha

Postanowienia z grillingu z 2026-10-29 ([#7](https://github.com/jgoliszewski/ITDarts/issues/7)).

- **Cel:** dojść dokładnie do celu, od 0 w górę. Opcja „Target”: 101, 201 (domyślnie) albo 301. Bez wymogu double.
- **Bust** jak w X01: przekroczenie celu cofa wynik do stanu sprzed Tury i kończy Turę.
- **Wygrana gry:** kto pierwszy trafi dokładnie w cel, wygrywa grę od razu, także w środku Tury.
- **Opcja „First to”** (od 2026-11-06) 1–5, domyślnie 1 (jedna gra jak dotąd), tak samo jak w Higher or Lower. Wygrana gra daje punkt. Dopóki nikt nie ma N punktów, kolejna gra startuje z wynikami 0 i tym samym celem, a zaczyna następny gracz w kolejności (jak w Higher or Lower). Do takeoutu Tury, która wygrała grę, ekran trzyma wyniki tej gry i kartę „Game won”. Mecz wygrywa, kto pierwszy zdobędzie N punktów. Nagłówek np. „Gotcha · 201 · First to 3” (przy 1 bez dopisku).
- **Gotcha** (od 2026-11-20 po każdej lotce, wcześniej na koniec Tury): lotka, która zmieniła wynik gracza (bez bustu), zeruje od razu każdego rywala w grze z takim samym wynikiem; wycofany nie jest zerowany. Gracz może w jednej Turze wyzerować kilku rywali kolejnymi lotkami. Bust cofa tylko wynik rzucającego: rywal wyzerowany wcześniejszą lotką tej Tury zostaje na 0. Pudło (0 punktów) nikogo nie zeruje.
- **Gracze:** 2–8.
- **Ekran wyników:** hero pokazuje imię, duży wynik, „Left” do celu i kafelki lotek, przygaszone tylko przy buście. Bez podpowiedzi checkoutu. Lista graczy pokazuje wyniki, a przy „First to” > 1 w drugiej linii też punkty („Left 81 · 1 point”); notka w hero zaczyna się wtedy od „Game 2”. Po karcie Tury notka w hero pokazuje np. „Gotcha! Kuba → 0”, gdy ktoś został wyzerowany (od 2026-11-01 już nie na samej karcie). Nagłówek np. „Gotcha · 201”.
- **Caller** podaje wynik Tury jak w X01, bez „you require” i bez „game shot”.
- **Wyzwalacze:** te same co w X01 od 2026-11-20: suma, przedział i kombinacja Tury, „Left on” i reguły tylko-checkout przy Turze, która trafiła cel ([EFEKTY.md](EFEKTY.md)), animacje 180 i 140+; „Bust” (istnieje), nowy „Gotcha” (L, zabawny, na start dźwięk i ledy z Bed and breakfast), „Game won” (po każdej grze poza ostatnią, przy „First to” > 1) i „Match won”. Bez „Hit” i „Miss”.
- **Statystyki:** wygrane (mecze) i liczba Gotcha (ile razy gracz kogoś wyzerował, we wszystkich grach meczu). Punkty (wygrane gry) zapisują się jako `legs_won`, jak w Higher or Lower; „Last match” i „Recent” pokazują je tylko przy First to powyżej 1. Bez rekordu.

## Knockout

Postanowienia z grillingu z 2026-10-30 ([#7](https://github.com/jgoliszewski/ITDarts/issues/7)).

- **Runda:** każdy, kto jest jeszcze w grze, rzuca jedną Turę. Zaczynający przesuwa się co rundę o jedno miejsce w kolejności (wyeliminowanych pomijamy). Kolejność pierwszej rundy ustala Random (losowana przy starcie) albo Bull-off.
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
- **Gol:** zależy od opcji „Goals on” (od 2026-11-13). Strzelec zatrzymuje piłkę i strzela dalej, aż ktoś mu ją odbierze. Bull nigdy nie jest golem. Po przejęciu piłki następna lotka tej samej Tury może już być golem.
  - **Big singles** (domyślnie): z piłką golem jest tylko duży single, czyli pole między treblem a double, w jednym z czterech wylosowanych sektorów. Double, treble i mały single w tych sektorach gola nie dają, single poza nimi też nie.
  - **Doubles:** z piłką każdy double 1–20 to gol (dotychczasowe zasady).
- **Losowanie sektorów (Big singles):** cztery sektory leżą co ćwierć tarczy, czyli co piąta pozycja w `BOARD_ORDER` (np. 20 · 6 · 3 · 11), więc jest pięć zestawów. Nowy zestaw losuje się przy każdym przejęciu piłki, ze środka i od rywala, także ten sam co przed chwilą. Bull posiadacza nic nie zmienia, więc nie losuje. Przed pierwszym przejęciem zestawu nie ma. Gdy posiadacza wycofamy, piłka jest wolna, a zestaw zostaje do następnego przejęcia, które losuje nowy. Losowanie idzie z ziarna w logu (`{ t: 'seed' }`, hub dopisuje je przy starcie w Big singles, także w Rematchu), po kolei z jednego generatora, więc Undo i Poprawka odtwarzają te same zestawy.
- **Duży czy mały single** rozstrzygają coords z tarczy: odległość od środka co najmniej 103 mm (połowa szerokości treble, ta sama granica co w Bullseye, `SINGLE_SPLIT_MM` i `isBigSingle` w `games/darts.ts`) to duży single. Lotka bez coords (wpisana na Pilocie, z klawiatury albo z „Nearby”) liczy się jako duży single. Poprawka i „Add dart” kliknięciem w dużą tarczę zapisują miejsce kliknięcia jako coords lotki, więc mały single nie jest golem.
- **Stare opcje:** mecz zapisany przed „Goals on” (historia, mecz w toku po restarcie) odtwarza się jako „Doubles”. Nowy mecz z setupu ma domyślnie „Big singles”, także gdy Pilot ma zapamiętane opcje Football bez tego klucza.
- **Opcje:**
  - „Kick-off”: „25/50” (domyślnie, piłkę daje każdy bull) albo „Bull only” (tylko 50);
  - „Goals on”: „Big singles” (domyślnie) albo „Doubles”;
  - „Goals”: 3, 5 (domyślnie) albo 10;
  - Bull-off.
- **Wygrana:** kto pierwszy dobije do liczby goli, wygrywa od razu, także w środku Tury. „End match” z „Save” kończy grę jak wygraną: wygrywa najwięcej goli, remisujący dzielą wygraną, a przy 0 goli nie ma zwycięzcy.
- **Gracze:** 2–8, każdy na siebie.
- **Ekran wyników:** hero pokazuje imię, dużą liczbę goli, kafelki lotek (zielone dla przejęcia i gola, czerwone dla reszty) i gdzie jest piłka. Tarcza ([UI.md](UI.md#tarcza-w-hero)): bez piłki pomarańczowy bull (przy „Bull only” obrys tylko na bullseye), z piłką w Big singles cztery pomarańczowe segmenty z obrysem dużych singli (opis dla czytnika ekranu „Big singles 20 · 6 · 3 · 11 score”), a z piłką w Doubles cały pierścień double w pełnych kolorach z obrysem dwoma okręgami. Gdy piłkę ma rywal, rzucający widzi cel bez piłki (bull). Notka mówi, kto ma piłkę („⚽ Your ball”, „Ball in the centre”, „Bob has the ball”), bez dopisków o tym, co punktuje. Po lewej statystyka „To win” (ile goli brakuje). Lista graczy pokazuje gole i piłkę przy posiadaczu. Karta Tury: „Goal!”, „2 goals!” albo „Ball won”, z dopiskiem, komu piłka została odebrana. Nagłówek np. „Football · 25/50 · Big singles · First to 5” albo „… · Doubles · …”.
- **Caller** milczy.
- **Wyzwalacze:** nowy „Goal” (M, dobry, na start dźwięk i ledy z Ton) i „Game won”. „Goal” jest w kolejności przed „Game won”, bo wygrana pada tą samą lotką. Przejęcie piłki nie ma Momentu.
- **Statystyki:** wygrane i liczba goli. Bez rekordu.

## Bullseye

Postanowienia z grillingu z 2026-11-09. Nie mylić z Bull-offem, który ustala kolejność przed meczem.

- **Punkty za lotkę:** bull (50) +2, 25 +1, single między 25 a treblem 0. Treble, single za treblem, double, pudło i lotka odbita (Pilot dopisuje ją jako pudło) −1. Tura zamknięta przed trzecią lotką dopisuje brakujące lotki jako pudła, każde po −1.
- **Single wewnętrzny czy zewnętrzny** rozstrzygają coords z tarczy: odległość od środka mniejsza niż połowa szerokości pierścienia treble (103 mm, `SINGLE_SPLIT_MM`, ta sama granica co w Football) to wewnętrzny. Lotka bez coords (wpisana na Pilocie albo poprawiona z klawiatury lub „Nearby”) liczy się jako wewnętrzna, czyli 0. Poprawka i „Add dart” kliknięciem w dużą tarczę zapisują miejsce kliknięcia (od 2026-11-13), więc poprawiony zewnętrzny single daje −1, a wewnętrzny 0.
- **Wynik** może spaść poniżej 0.
- **Opcje:**
  - „First to”: 3, 5 (domyślnie) albo 10 punktów;
  - Bull-off.
- **Koniec** (zmiana z 2026-11-09, wcześniej wygrywał od razu ten, kto pierwszy dobił do celu): wynik sprawdzamy dopiero po rundzie, czyli gdy każdy w grze rzucił swoją Turę. Tura gracza, który dobił do celu, toczy się do końca i wszystkie jej lotki się liczą. Jeśli po rundzie nikt nie ma co najmniej celu (także gdy ktoś dobił, a potem spadł), gramy dalej. Jeśli ktoś ma, wygrywa najwięcej punktów. Przy remisie na pierwszym miejscu dogrywkę grają tylko remisujący: każdy jedną Turę w kolejności gry, punkty doliczają się do sumy, wygrywa najwięcej. Kolejny remis daje kolejną rundę dogrywki, do skutku. Solo runda to jedna Tura. Wycofanie gracza w rundzie albo dogrywce działa jak w Shanghai.
- **„End match” z „Save”** kończy grę jak w Football: wygrywa najwięcej punktów, remisujący dzielą wygraną, a przy wyniku 0 lub niższym nie ma zwycięzcy.
- **Gracze:** 1–8, każdy na siebie, bez Co-op.
- **Ekran wyników:** jak w Football: hero z imieniem, dużym wynikiem i kafelkami lotek (zielone dla +, czerwone dla −1, neutralne dla 0), lista graczy z wynikami. Tarcza ([UI.md](UI.md#tarcza-w-hero)) ma pomarańczowy bull. Notka z zasadami punktacji zostaje, a lewa kolumna nie ma kafelków statystyk. W dogrywce hero ma „Tiebreak”, a lista wyszarza tych, którzy jej nie grają (jak w Shanghai). Nagłówek np. „Bullseye · First to 5”.
- **Caller** milczy.
- **Wyzwalacze:** tylko istniejące („Bull”, „Match won”), bez nowego Momentu.
- **Statystyki:** wygrane i suma punktów. Bez rekordu.

## Hare and Hounds

Postanowienia z grillingu z 2026-11-27. Pogoń po obwodzie tarczy dla dwóch graczy: zając ucieka, ogar goni. W UI „Hare”, „Hound”, „Head start”.

- **Gracze:** dokładnie 2, bez Co-op. Zającem jest pierwszy w kolejności (przy Random zając jest losowy, przy Closest i PDC wyznacza go Bull-off), więc rzuca pierwszy. „Rematch” zamienia role.
- **Trasa:** sektory w kolejności zgodnej z zegarem (`BOARD_ORDER`: 20, 1, 18, 4 … 12, 5). Zając stoi na 20, a jego pierwszym celem jest 1. Wygrywa, gdy zaliczy 20 celów, czyli wróci na 20, w chwili tego trafienia, także w środku Tury.
- **Ogar** stoi „Head start” sektorów za zającem (przy 3 na 9, pierwszym celem jest 12). Łapie zająca, gdy zaliczy sektor, na którym zając stoi: wygrywa od razu, a reszta jego lotek przepada. Zając stoi na ostatnim zaliczonym sektorze, więc do złapania trzeba go dogonić, nie wyprzedzić.
- **Trafienie** jak w ATC: cel to następny sektor na trasie, po trafieniu kolejna lotka tej samej Tury idzie w kolejny sektor. Bez przeskoków za double i treble. Bull nie jest na trasie.
- **Opcje:**
  - „Target”: „Any” (domyślnie), „Doubles” albo „Trebles”, jak w ATC: w „Doubles” liczy się tylko D celu, w „Trebles” tylko T;
  - „Head start”: 2, 3 (domyślnie), 4 albo 5 sektorów;
  - Bull-off.
- **Balans** (symulacja z 2026-11-27, ta sama celność obu graczy, zając rzuca pierwszy): przy „Head start” 3 zając wygrywa ok. 50% gier przy celności 45% (Any), 40% w Doubles i Trebles, a przy 4 ok. 50% w Doubles i Trebles. „How to play” podpowiada więc 4 dla Doubles i Trebles.
- **„End match” z „Save”** kończy grę bez zwycięzcy, ekran „Game over”.
- **Ekran wyników:** układ z tarczą w trzech kolumnach jak w ATC ([UI.md](UI.md#ekran-wyników-dla-gier-z-tarczą)). Po lewej imię, rola („Hare” albo „Hound”), dystans „Gap 3” (ile sektorów ogar ma do zająca) i statystyki Darts, Hit rate. Tarcza pokazuje cel rzucającego jak w ATC (pomarańczowy segment, w „Doubles” i „Trebles” tylko pierścień z obrysem) oraz sektory, na których stoją zając i ogar, każdy we własnym kolorze. Kropki lotek Tury jak w innych grach z tarczą. Lista graczy pokazuje rolę, postęp („7 / 20” zająca, ogar swój dystans) i pasek postępu. Wygląd ustala makieta `.scratch/hh-catch40/`. Nagłówek np. „Hare and Hounds · Head start 3” albo „… · Doubles · Head start 4”.
- **Caller** milczy.
- **Wyzwalacze:** tylko istniejące, „Target hit” i „Game won”, bez nowego Momentu.
- **Statystyki:** wygrane jako zając, wygrane jako ogar i hit rate. Bez rekordu i bez Ekranu rekordu.
- **Wdrożenie** (2026-11-27, decyzje spoza grillingu i odstępstwa):
  - „Rematch” zamienia role także po Bull-offie: rewanż startuje bez Bull-offu (wylosowałby role od nowa), a zającem jest ogar poprzedniego meczu. „Rematch” z lobby bierze zająca z zapisanego legu (`legs.starter_position`), bez rzuconych lotek pierwszego w kolejności. Znane ryzyko: mecz z Bull-offem zakończony przed pierwszą lotką nie ma legu, więc „Rematch” z lobby bierze za zająca pierwszego z zapisanego (przetasowanego) składu i role mogą się nie zamienić. „Rematch” z ekranu końca bierze kolejność z widoku meczu i działa zawsze.
  - Lista graczy według makiety: zając „7 / 20”, ogar „trafienia / (trafienia + dystans)”, np. „12 / 13”, więc jego pasek zapełnia się, gdy dogania zająca, a po złapaniu jest pełny.
  - Wynik gry: „Hound caught the hare on 19” albo „Hare made it round the board”; po wycofaniu „Hare won” / „Hound won”. Kafelki ekranu wygranej: Hits, Darts, Hit rate.
  - Tura, która łapie zająca, ma werdykt „Caught”. Widać go na telefonie; kiosk od razu pokazuje ekran wygranej, jak po każdej wygranej Turze w innych grach, więc karty Tury „CAUGHT” z makiety (ekran 3a) na kiosku nie ma.
  - Telefon podpowiada cel słowami: „Throw at 17”, „Throw at the double 17”.

## Catch 40

Postanowienia z grillingu z 2026-11-27. Trening checkoutów 61–100 z punktami za szybkość (źródło nazwy i zakresu: GoDartsPro; punktacja jest nasza, bo DartCounter nie opisuje jej publicznie).

- **Cele:** kolejno 61, 62 … 100, czyli 40 celów, takie same dla wszystkich graczy. Check-out zawsze z double.
- **Podejście:** na cel są 2 Tury (6 lotek). Bust jak w X01: wynik wraca do stanu sprzed Tury, a podejście trwa, dopóki są lotki. W drugiej Turze podejścia Tura kończy się od razu, gdy pozostałymi lotkami nie da się już zamknąć wyniku, jak w [121](#121). Po podejściu, udanym czy nie, gracz przechodzi do następnego celu. Tura zakończona bustem liczy się jako 3 lotki podejścia, jak Tura zamknięta Takeoutem, więc bust nigdy się nie opłaca: T20 (bust) i checkout 2 lotkami w 2. Turze to 5 lotek, 1 pkt, tyle samo co 3 pudła i ten sam checkout (decyzja użytkownika z 2026-11-27, po review). Tak samo liczy średnia lotek na checkout, a karta „Darts left” pokazuje po buście 3.
- **Punkty:** checkout w 2 lotkach 3 pkt, w 3 lotkach 2 pkt, w 4–6 lotkach 1 pkt, brak checkoutu 0 pkt. Od 61 nie da się zamknąć jedną lotką. Maksimum gry to 120.
- **Gracze:** 1–8, każdy na siebie, bez Co-op. Tury idą na zmianę jak w X01, a każdy gracz ma własny bieżący cel i własne podejście.
- **Koniec:** gdy wszyscy zaliczą podejścia do 40 celów. Wygrywa najwięcej punktów, przy remisie mniej lotek, a przy równej liczbie lotek wygrywają wszyscy remisujący.
- **„End match” z „Save”** kończy grę w każdej chwili, bez opcji długości gry: zwycięzca liczony jak wyżej z dotychczasowych punktów, przy 0 punktów nie ma zwycięzcy.
- **Ekran wyników:** hero jak w [121](#121): cel, reszta do zamknięcia, podpowiedź checkoutu z X01 i kropki lotek podejścia. Zamiast serc punkty gracza i licznik „23 / 40”. Lista graczy pokazuje punkty i postęp. Wygląd ustala makieta `.scratch/hh-catch40/`. Nagłówek „Catch 40”.
- **Caller** jak w 121: wynik Tury i „you require”, bez „game shot” ([EFEKTY.md](EFEKTY.md#caller)).
- **Wyzwalacze:** „Checkout”, „Bust” i „Attempt failed” (istnieją), „Game won”.
- **Statystyki:** punkty, skuteczność checkoutów w % i średnia liczba lotek na checkout. Rekordem jest najwięcej punktów, tylko z gry rozegranej przez wszystkie 40 celów; gra zakończona „End match” wchodzi do statystyk, ale nie do rekordów. Jeden wariant, solo i versus razem.
- **Wdrożenie** (2026-11-27, decyzje spoza grillingu):
  - Hero według makiety: chipy „Points” i „Attempt 14 / 40” w miejscu serc 121, „Visit 1 of 2” pod wynikiem, po prawej „This turn” i trasa checkoutu, bez drabinki. Plakietki rekordów (Best, PB) stoją w tym samym wierszu za chipami, bo Catch 40 nie ma tarczy ani drabinki (makieta ich nie pokazywała).
  - Karta pod listą: „Darts left” z kropkami podejścia i „Checkout %”; „Darts per checkout” tylko na ekranie końca i na `/stats`. Lista: punkty, „Target 74” i pasek rozegranych celów z 40.
  - Karta Tury po checkoucie pokazuje zdobyte punkty („+2”), po nieudanym podejściu „Attempt failed”. Ekran końca: wynik „78 points”, kafelki Points, Checkout %, Darts per checkout.
  - Gra zakończona „End match” nie ma wyniku rekordowego, więc lobby i „Recent matches” pokazują przy niej punkty ze statystyk.

## Bob's 27

Postanowienia z grillingu z 2026-11-27 (odwracają odrzucenie z 2026-10-30, [#7](https://github.com/jgoliszewski/ITDarts/issues/7)). Trening double'ów: punkty rosną za trafienia i maleją za pustą Turę.

- **Start:** 27 punktów.
- **Rundy:** 21. Runda N (1–20) celuje w double N, runda 21 w bull 50 (double bull; outer 25 się nie liczy). W nagłówku rundy „D5”, w 21. „Bull”.
- **Tura = runda:** 3 lotki. Każda lotka w double rundy dodaje jego wartość (2N, w rundzie bull 50). Tura bez trafienia odejmuje jedną wartość double (−2N, −50). Inne pola, outer 25 i pudła to brak trafienia. Lotki brakujące przy zamknięciu Tury (Takeout albo Next player przed 3. lotką) to pudła. Kara nalicza się, gdy Tura się kończy (3. lotka albo zamknięcie), więc poprawka lotki w jeszcze niezamkniętej Turze ją zmienia.
- **Odpadnięcie:** wynik 0 lub mniej po zakończeniu Tury wyrzuca gracza z gry (kolejka go pomija). Z 27 można spudłować D1–D4, a D5 bez trafienia daje −3. Wynik jest zawsze nieparzysty (start 27, wartości parzyste), więc w praktyce odpada się na liczbie ujemnej.
- **Maksimum:** 27 + 3·2·(1+…+20) + 3·50 = 1437.
- **Gracze:** 1–8, każdy na siebie, Tury na zmianę jak w Catch 40, bez Co-op. Grupa Practice, po Catch 40. Bull-off jak w pozostałych grach.
- **Koniec:** gdy każdy gracz skończył rundę bull albo odpadł.
- **Ranking i wygrana:** najpierw ci, co doszli do końca (wyższy wynik wyżej, remis to współwygrana), potem odpadnięci (później odpadł, tym wyżej; ta sama runda to remis). Wycofany gracz nigdy nie wygrywa.
  - **Solo:** doszedł do końca to wygrana („Game won”), odpadł to „Game over” bez zwycięzcy.
  - **Versus:** wygrywa pierwsze miejsce rankingu, także gdy wszyscy odpadli (wygrywa ten, kto odpadł najpóźniej).
- **„End match” z „Save”** kończy grę w każdej chwili: zwycięzca z bieżącego stanu wg rankingu (gracze, którzy jeszcze grają, liczą się jak ci, co doszli, z bieżącym wynikiem; odpadnięci niżej). Taka gra nie daje rekordu.
- **Ekran wyników:** jak [Shanghai](#shanghai). Hero ma tarczę z jednym podświetlonym (pomarańczowym) pierścieniem double sektora rundy, a w rundzie bull samym bullseye; reszta wygaszona ([UI.md](UI.md#tarcza-w-hero)). Po lewej imię, „Round 5 / 21 · D5”, duży wynik i linia „+20 this visit” albo, po Turze bez trafienia, „−10 · missed visit”; statystyki Darts i Hit rate. Kafelki lotek zielone (trafienie) i czerwone. Lista graczy pokazuje wynik i rundę, a odpadniętych wyszarza z „Out at D5”. Karta Tury: „+20”, „−10” albo „Kuba is out”. Gdy ostatnia Tura kończy grę (odpadł jedyny gracz albo ostatni), zamiast niej stoi ekran końca. Nagłówek „Bob's 27”. Widok telefonu jak w Shanghai: wiersze listy z rundą i wynikiem, „This turn” z liczbą punktów Tury z plusem albo minusem.
- **Wyzwalacze:** „Hit” i „Miss” na każdą lotkę, istniejący „Player eliminated”, „Game won” i „New record”. Bez nowego Momentu. Caller milczy.
- **Statystyki:** hit rate double (% lotek w double rundy), średni wynik końcowy (odpadnięty liczy się jako 0; główna statystyka ze strzałką, więcej to lepiej), liczba gier dograniych do końca (przetrwane 21 rund) i wygrane (tylko versus, jak w innych grach). Rekordem jest najwyższy wynik, tylko z gry, którą gracz dograł do końca rundy bull (odpadnięcie i „End match” nie wchodzą). Jeden wariant, solo i versus razem.
- **Opis „How to play”:** Goal, Your turn, What counts, How to win; opcji nie ma poza bull-offem.

## Statystyki na `/stats`

- Wybór gry.
- Dla gier z rekordem: tabela top 10 osobno dla każdego wariantu, z wynikiem, Graczem albo składem co-op i datą. X01 ma takie tabele bez Ekranu rekordu: Highest visit, Highest checkout i Best leg osobno na wynik startowy.
- Pod tabelą statystyki per gracz tej gry: hit rate, MPR, skuteczność podejść w 121, wygrane, checkouty i lotki na checkout w Random Checkouts, liczba Shanghai, liczba Gotcha, średnia Tura w Knockout, gole w Football, „Visits survived” w Higher or Lower, średnia z 3 lotek, najwyższa Tura i liczniki 60+/80+/100+ w Free throw, wygrane jako zając i ogar w Hare and Hounds, punkty, skuteczność checkoutów i lotki na checkout w Catch 40, średni wynik (odpadnięty to 0), hit rate double'ów i liczba gier dograniych do końca w Bob's 27.
- **Liczniki minigierek jako średnia na mecz** (suma małym drukiem), a główna statystyka gry ze strzałką zmiany względem poprzedniego Okna. Winrate liczy się jak w X01, tylko z meczów versus; w grach solo (Free throw) jest samo „Played” ([STATYSTYKI.md](STATYSTYKI.md#progres)).
- Zasady zapisu i okna są w [STATYSTYKI.md](STATYSTYKI.md).
