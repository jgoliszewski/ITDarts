# ITDarts: UI i UX (etap 2)

Postanowienia z grillingu z 2026-10-25 ([#1](https://github.com/jgoliszewski/ITDarts/issues/1)). Pojęcia są zdefiniowane w [GLOSSARY.md](../GLOSSARY.md), a wizja systemu w [WIZJA.md](WIZJA.md).

Makiety: [ITDarts UI mockups](https://claude.ai/artifact/Bt8RmLqWv9733tb2nLkPQK) (canvas z 11 ekranami; poprawka lotki i tarcza są klikalne).

Wzorce podpatrzone w Scolii (wynik i poprawka lotki), HomeDarts (minimalizm), Autodarts (setup X01) i tools-for-autodarts (takeout na cały ekran).

## Ekrany i tryby

- **Domyślnie** wszystko działa na dotykowym laptopie przy tarczy. Laptop jest jednocześnie Ekranem wyników i Pilotem, a przyciski Pilota są ostatnim wierszem prawej kolumny (od 2026-11-16, wcześniej pasek pod wynikiem).
- **Tryb wynika z tego, kto ma Pilota.** Gdy telefon przejmie Pilota, laptop sam staje się czystym Ekranem wyników bez przycisków, a „Take control” zostaje w menu. Nie ma osobnego przełącznika trybów.
- **Laptop nie reklamuje telefonu** (od 2026-11-16): używamy tylko dotykowego laptopa, więc Ekran wyników nie ma QR, przycisku QR ani tekstów „on the pilot”. Telefon dalej może przejąć Pilota po wpisaniu adresu, a nakładkę QR może wywołać telefon-Pilot („Show QR”).
- **Telefon obsługuje wszystko.** Główny ekran może nie być dotykowy, więc każda akcja jest dostępna z Pilota na telefonie.
- **Jeden responsywny widok Pilota** dla laptopa i telefonu, projektowany najpierw pod telefon i dotyk.
- **Przejęcie Pilota** jest natychmiastowe, bez potwierdzenia. Poprzedni Pilot dostaje komunikat, kto przejął, i ten sam przycisk, żeby odebrać. Nazwę urządzenia (telefon, laptop) wyliczamy z przeglądarki.
- **Komunikaty (toasty)** na Ekranie wyników stoją pod nagłówkiem przy lewej krawędzi, nad hero, i nie wchodzą na prawą kolumnę ani wiersz przycisków (od 2026-11-16). Na telefonie i pozostałych ekranach są na dole pośrodku.

## Styl

- **Źródło tokenów:** [DESIGN.md](../DESIGN.md) (kolory, typografia, odstępy, promienie, ruch). Tu są decyzje produktowe, tam wartości; w kodzie tokeny są zmiennymi CSS w `:root` w `web/src/styles.css`.
- Tylko angielski i tylko jeden ciemny motyw.
- Kolory ITBOOM: tło prawie czarne, karty w odcieniach szarości, pomarańcz `#F58224` jako jedyny akcent (od 2026-11-18 według zasady „pomarańcz = teraz i główne”). Oznacza **aktywnego gracza** (wiersz, hero), **główną akcję**, **sumę Tury** (karta Tury, „THIS TURN” w hero, telefon) oraz na `/stats` główną metrykę, #1 w rekordach i zaznaczony kafelek gry. Poza tym pomarańcz zostaje tylko tam, gdzie oznacza rekord albo punkt odniesienia: „read as T20” w Poprawce (audyt A#12), Ekran rekordu, chorągiewka „Best” na drabince 121, plakietki „Best” w hero i plakietka „NEW RECORD”. Po review brancha (2026-11-18) zeszły do neutralnych kolorów: kicker „READY FOR THE NEXT ONE” i wynik zwycięzcy ostatniego meczu w lobby i na telefonie (biały), zaznaczona pozycja Dropdown na `/stats` i w Compare (jak zaznaczony segment: białe tło, czarny tekst), How to play (kicker i nagłówki szare, wybrana opcja jak zaznaczony segment) i numery kolejności rzucania w Setup (szare). Na pomarańczowym tle tekst jest czarny, bo biały ma za słaby kontrast.
- **Kafelki lotek** (D1, od 2026-11-18): w grach liczonych punktami neutralne (szare tło, jasny tekst, pomarańcz tylko dla sumy Tury): X01 oraz 121, Random Checkouts, Gotcha, Knockout, Free throw i Higher or Lower. Lotka, która nic nie dała (w 121 i podobnych, w X01 przy double in przed otwierającym double), jest wygaszona. W grach liczonych trafieniami (ATC, Full Board, Cricket, Killer, Shanghai, Football) zielone przy trafieniu i czerwone przy pudle. W Bullseye według punktów lotki: zielone dla zysku, czerwone dla −1, wygaszone dla 0. Telefon koloruje tak samo jak Ekran wyników (`dartTone` w `web/src/match.ts`).
- Kolory stanów: zielony dla „Ready” i trafienia, bursztynowy dla takeoutu, czerwony dla bustu, pudła, życia i restartu.
- **Kolory per gracz** tylko w podsumowaniu meczu i Compare ([Podsumowanie meczu](#podsumowanie-meczu)). Gdzie indziej ich nie ma. Wracamy do nich szerzej, jeśli dojdzie tryb drużynowy.
- **Dane na `/stats` bez pomarańczu** (D3, od 2026-11-18): linia wykresu i paski double są w kolorze drugiego poziomu tekstu, a obie liczby head-to-head w kolorze tekstu.
- Czcionki: Barlow Condensed dla liczb, Inter dla reszty. Obie dołączone lokalnie, bo aplikacja działa offline.
- **Dotyk przed myszą** (od 2026-11-18): reakcją na stuknięcie jest stan wciśnięcia (lekkie zmniejszenie, wiersze graczy przygaszone), a nie hover. Hover działa tylko przy myszy (`(hover: hover) and (pointer: fine)`).
- **Długie imiona** (od 2026-11-18) nie wychodzą poza swoje pole: w Summary nagłówki kolumn i tytuł zwycięzcy łamią się w środku słowa, karta gracza na `/stats` zawija imię, nagłówek profilu, nagłówek ekranu na telefonie i Players kończą się wielokropkiem (pełne imię w dymku), plakietka imienia na linii heatmapy pokazuje najwyżej 11 znaków z wielokropkiem, a w grach z sercami imię w hero kończy się przed sercami. Lista rekordów w lobby wygasza dół, gdy jest dłuższa niż karta.
- **Cele dotykowe i tekst:** każdy element do stukania ma co najmniej 44 × 44 px, także na kiosku przy 1280×720 (od 2026-11-27 także chipy graczy w Nowym meczu). Tekst na kiosku nie schodzi poniżej 16 px. Przyciski mają kształt pigułki.

### Ikony gier

Postanowienia z grillingu z 2026-10-30, żeby gry dało się szybciej rozpoznać wzrokiem.

- **Styl:** liniowe, jak reszta ikon aplikacji (siatka 24, kreska w kolorze tekstu), jedna na grę, w `web/src/components/GameIcon.tsx`. Bez emoji, bo różnie wyglądają na Windowsie, Androidzie i iOS.
- **Symbole:**

  | Gra | Symbol |
  |---|---|
  | X01 | tarcza z celownikiem |
  | ATC | okrągła strzałka wokół bulla |
  | Full Board | tarcza w ćwiartkach z ptaszkiem |
  | 121 | drabinka |
  | Random Checkouts | kostka do gry |
  | Cricket | X w kółku |
  | Killer | czaszka |
  | Higher or Lower | strzałki góra i dół |
  | Shanghai | trzy rosnące słupki |
  | Gotcha | strzałka zawracająca na zero |
  | Knockout | serce |
  | Football | piłka |
  | Bullseye | strzałka w tarczy |
  | Free throw | lotka w locie |
  | Hare and Hounds | dwie kropki goniące się po okręgu |
  | Catch 40 | stoper |

- **Kafelek gry w setupie:** ikona jest tłem w prawym dolnym rogu, 96 px, ucięta krawędzią o około 1/6. Mocniejsze ucięcie (1/4 i 1/2) odrzuciliśmy, bo ikony przestawały być rozpoznawalne. Ikony bez ucięcia (80 px) też, bo przy niskim kafelku wchodziła pod opis. Na zwykłym kafelku jest szara (`#3A3A40`), a na zaznaczonym przyciemnia pomarańcz. Tekst leży nad nią.
- **Kafelek kompaktowy** (poniżej 1100 px, od 2026-11-18, patrz [Start i koniec meczu](#start-i-koniec-meczu)): bez opisu, ikona 64 px w rogu, też ucięta krawędzią i szara, a na zaznaczonym przyciemnia pomarańcz.
- **Małe ikony:** przed nazwą gry na chipach wyboru gry na `/stats` i w nagłówku Ekranu wyników, w kolorze tekstu obok. Pomarańcz zostaje tylko dla stanu „zaznaczone i aktywne”.
- **Bez ikon:** na karcie ostatniego meczu w lobby i w „How to play”, bo tam nazwa gry stoi dużym tekstem.

## Ruch UI

Od 2026-11-18, z przeróbki UI ([DESIGN.md](../DESIGN.md#ruch) ma tokeny, czasy i krzywe). Ruch jest subtelny (150–250 ms, ease-out) i służy do potwierdzenia dotyku albo pokazania, skąd coś przyszło. Nie opóźnia odczytu wyniku.

- **Animujemy zmiany stanu:**
  - dialogi (w tym menu Pilota): wejście przez przezroczystość i lekkie powiększenie, wyjście krótsze;
  - sheety i panele od krawędzi: arkusz Poprawki na telefonie od dołu, Panel tarczy od prawej;
  - zakładki, segmenty, chipy, przełączniki i listy rozwijane;
  - toasty: na Ekranie wyników z góry, na telefonie z dołu;
  - przejścia ekranów: krótki crossfade około 200 ms wszędzie (decyzja użytkownika), też między `/stats` i `/effects`;
  - stan wciśnięcia przycisków i wierszy.
- **Wyjścia są krótsze niż wejścia** i animują się przy oknach zarządzanych przez aplikację (menu, „End match”, „Close app”, „Report a bug”, Poprawka, wycofanie gracza, Panel tarczy, dialogi w Players). Potwierdzenie w panelu tarczy i dialogi na `/effects` zamykają się od razu.
- **Czego nie animujemy:** liczb wyniku (wynik, średnie, suma Tury), kafelków lotek, wejścia karty Tury, zmiany aktywnego gracza, hoverów, list na `/stats`, Players i w podsumowaniu, rozwijania grup, banerów ostrzegawczych ani zmiany Okna na `/stats`. Wyjątek to drabinka i odometr w 121 ([GRY.md](GRY.md#121)).
- **Klawiatura i fokus:** każde okno zaczyna fokus na pierwszej bezpiecznej akcji (menu na „How to play”, wycofanie gracza na „Cancel”), Esc zamyka najwyższe okno i oddaje fokus przyciskowi, który je otworzył. Lista rozwijana (np. wybór gracza w Compare) i zakładki Poprawki obsługują strzałki, Home i End.
- **`prefers-reduced-motion`:** zostaje przezroczystość i kolor, znika przesunięcie, skalowanie i ruch ciągły. **Wyjątek: strony rekordów w lobby** ([Lobby i QR](#lobby-i-qr)) jadą sprężyną ≈0,35–0,45 s (dłużej niż 150–250 ms) także przy `reduce`, bo bez ruchu puszczenie palca dawałoby przeskok. Dotyczy też **Momentów** ([EFEKTY.md](EFEKTY.md#animacje-na-ekranie-wyników)): sam CSS, bez zmian przy zwykłych ustawieniach.

## Ekran wyników

- **Układ:** hero aktywnego gracza po lewej, lista wszystkich graczy po prawej. Działa dla 2–8 graczy bez zmiany układu.
- **Jeden układ dla wszystkich gier** (od 2026-11-01, z przeglądu zrzutów wszystkich gier w tych samych chwilach):
  - Duża liczba w hero ma ten sam rozmiar w X01 i minigierkach. Mniejsza jest tylko w grach z tarczą, bo stoi w wąskiej lewej kolumnie ([Ekran wyników dla gier z tarczą](#ekran-wyników-dla-gier-z-tarczą)).
  - Kafelek lotki wszędzie pokazuje duże pole i małą wartość (T20 / 60), także w X01, i ma tę samą szerokość. W grach z tarczą leżą w karcie tarczy, pod tarczą, w jednym rzędzie trzech. Kolory kafelków: [Styl](#styl) (D1).
  - Prawa kolumna ma jedną szerokość (620), bez względu na grę i liczbę graczy. Wyjątkiem są gry z tarczą: mają trzy kolumny, a prawa (lista graczy albo siatka Cricketa) ma 460 u. Wiersze listy są pełnowymiarowe do 4 graczy, a kompaktowe od 5, też w minigierkach (gry z tarczą: [niżej](#ekran-wyników-dla-gier-z-tarczą)).
  - Pod listą minigierki bez tarczy mają kartę „IMIĘ · THIS MATCH” z liczbami aktywnego gracza, tymi samymi co w podsumowaniu, do 4 graczy (`MiniSide`). Gry z tarczą jej nie mają: te liczby stoją na dole lewej kolumny. Higher or Lower nie ma liczb na karcie („Visits survived” jest tylko na `/stats`). W 121 pierwszym kafelkiem jest „Darts left” z lotkami do końca podejścia. Tekst w kafelkach statystyk jest wyśrodkowany, też w X01.
  - Stan sektorów na tarczy w hero (cel, zaliczony, zamknięty, poza grą) opisuje [Tarcza w hero](#tarcza-w-hero).
- **Hero:** imię, wygrane legi, ogromny wynik i 3 kafelki lotek. Bez licznika „N darts left” (od 2026-10-30, kafelki to pokazują). Puste miejsca są obrysowane.
- **Hero X01, wariant D** (od 2026-11-18, po prototypie; hybryda wariantów A i C):
  - imię ma 64 u, kropki legów 26 u;
  - **prawa połowa hero** jest oddzielona linią. U góry duża suma „THIS TURN” (pomarańczowa, szara przy 0), pod nią checkout albo „Setup” (trasa do trzech lotek), albo przy buście duże czerwone „BUST”. Suma nie stoi już w rzędzie lotek;
  - **pigułka w rogu hero** jest tylko dla „Checked out” (zielona) i „Needs a double to start” (bursztynowa, przy double in, dopóki gracz się nie otworzył). Bust ma swoje „BUST” przy wyniku, bez pigułki;
  - lotki rzucone przed otwierającym double są wygaszone w hero i na karcie Tury (logika `x01Dead` w `web/src/match.ts`); przy straight in nic się nie gasi;
  - „+ Add” (dopisanie lotki) jest nieaktywne po Buście.
- **Minigierki z panelem Tury:** ten sam wzór prawej połowy hero (duża suma „THIS TURN”, pod nią główna informacja tury) mają 121, Random Checkouts, Gotcha i Knockout (`turnPanel` w `web/src/match.ts`). W 121 panel jest węższy, bo po prawej stoi drabinka celów.
  - **Knockout:** duża liczba w hero po lewej to „To beat” (zielona, gdy ktoś jest już pobity), a „THIS TURN” stoi w panelu po prawej, jak w X01 i Gotcha. Na starcie rundy po lewej jest „First to throw” bez liczby, a w panelu szare „THIS TURN 0”.
  - **Bez panelu:** Higher or Lower (skala 0–180 z pinezką już pokazuje sumę Tury, a pod nią jest legenda zakresu, w którym traci się życie, np. „Lose a life inside 26–81”), Killer (kicker „Killer” na czerwono albo „Your double”, serca pod imieniem i na liście, a lotki są tam trafieniami, więc suma Tury nic nie znaczy), Shanghai i Free throw (w Free throw suma Tury jest główną liczbą hero, „This visit”) i pozostałe gry z tarczą: ich hero to lewa kolumna [układu z tarczą](#ekran-wyników-dla-gier-z-tarczą), bez panelu Tury.
- **Cricket:** do 4 graczy kolumny siatki mają pełne imiona (zwykle gramy maksymalnie w czterech). Od 5 graczy (od 2026-11-18, przy 8 graczach imiona się nie mieściły) kolumna ma numer miejsca, dwie litery imienia (gość: pierwsza litera i numer, np. „G2”) i wynik, a w lewej kolumnie, pod wynikiem, stoi legenda „numer → imię” z aktywnym graczem w pomarańczu. Inicjały mogą się powtórzyć (Anna i Andrzej to „AN”), więc rozstrzyga numer (`initials` w `web/src/match.ts`).
- **Tarcza w hero** (ATC, Full Board, Shanghai, Football, Bullseye, Free throw, Cricket w obu wariantach i Killer, od 2026-11-26) i układ w trzech kolumnach: [Tarcza w hero](#tarcza-w-hero) i [Ekran wyników dla gier z tarczą](#ekran-wyników-dla-gier-z-tarczą).
- **Checkout** (w prawej połowie hero, pod sumą Tury): gdy da się skończyć leg lotkami, które zostały w turze, obok wyniku jest ścieżka (np. „T19 · D12”). Gdy się nie da (bogey, za mało lotek, pudło w trakcie), jest „Setup”: lotki, które najlepiej ustawiają checkout pod następną turę (np. „T20 · S14”). Samo punktowanie w T20 daleko od końca nie ma podpowiedzi.
  - Przy double out trasy są z tabeli checkoutów PDC (41–170). Dopóki lotki trafiają w zaplanowaną trasę, podpowiedź ją kontynuuje (130: T20, dalej „T20 · D5”, a nie trasa z tabeli dla 70). Po zejściu z planu bierze trasę z tabeli dla nowego wyniku, jeśli mieści się w lotkach, które zostały.
  - Resztę (mniej lotek niż trasa z tabeli, wyniki do 40, Setup, single i master out) liczy optymalna strategia: każda lotka minimalizuje oczekiwaną liczbę lotek do końca legu przy modelu pudeł dobrego klubowego gracza (40% w treble i double; `games/x01/checkout.ts`, za Kohler 1982 i Haugh & Wang 2022). Bust cofa wynik do początku tury, więc strategia go unika.
  - W 121 na ostatniej turze próby nie ma „Setup”, bo cel i tak wraca do początku.
- **Drabinka celów w 121** (od 2026-10-30): taśma celów pod wynikiem z chorągiewką rekordu i odometr celu, opisane w [GRY.md](GRY.md#121).
- **Lista graczy:** stała kolejność rzucania. Aktywny gracz ma pomarańczowy wiersz. W wierszu: imię, legi, średnia z meczu i wynik.
- **Serca** (od 2026-10-30): życia w 121, Knockout i Killer to wszędzie konturowe serca, czerwone póki są, po stracie w kolorze `--off` (od 2026-11-18, także w Momencie „Life lost”; wcześniej `#3A3A40`, z daleka prawie niewidoczne). W tekstach (lista, telefon) znak ♡. Pełnych serc nie używamy.
- **Kropki legów** (od 2026-10-27, ze zgłoszenia o nieczytelnym wyniku): trochę większe niż na początku. Od 2026-10-30 jeszcze większe, a „avg” w wierszu ma większą czcionkę i jaśniejszy kolor, bo z daleka były słabo widoczne. W pomarańczowym wierszu aktywnego gracza niewygrany leg jest jaśniejszą kropką, żeby nie zlewał się z wygranym. Liczby setów i legów obok kropek próbowaliśmy i odrzuciliśmy.
- **Statystyki, do 4 graczy** (od 2026-10-28, ze zgłoszenia; wcześniej tylko przy 2):
  - karta z 6 ostatnimi wizytami aktywnego gracza;
  - karta z meczu: średnia z legu, średnia z meczu, najlepsza wizyta i liczniki 60+, 80+, 100+ (od 2026-10-27 zamiast 100+, 140+, 180, pod poziom biura).
  - Przy 3–4 graczach bez karty ostatnich wizyt. Przy 5+ graczach zostaje sama lista, w wersji kompaktowej. Bez first 9, checkout % i liczby lotek w legu. Szerszą listę przy 3–4 graczach (760) zdjęliśmy 2026-11-01, żeby kolumna miała tę samą szerokość we wszystkich grach.
- **Nagłówek:** gra i ustawienia (np. „X01 · 501 · Double out · First to 3 legs”), status tarczy, ikona tarczy (u Pilota) i menu. Bez przycisku QR (od 2026-11-16). Status gotowej tarczy to samo „Ready” (od 2026-11-18, wcześniej „Ready · throw”), na kiosku i na telefonie.
- **Bust:** duże czerwone „BUST” w prawej połowie hero, bez pigułki w rogu. Wynik wraca do stanu sprzed tury.
- **Efekty:** Ekran wyników ma warstwę na nakładki z animacjami. Animacje, dźwięki, ledy i caller są opisane w [EFEKTY.md](EFEKTY.md).

### Tarcza w hero

Od 2026-11-26 (gałąź `feat/board-targets`, plan, decyzje i makiety w `.scratch/cricket-board-vis/`). Model segmentów jest w `web/src/components/targets.ts`, rysunek w `HeroBoard.tsx`, a mapowanie gier na segmenty w `web/src/screens/boardTargets.ts`. Tarcza do wklikiwania lotek (telefon, laptop) to osobny `Dartboard`, a Heatmap i Test board używają `TargetBoard` w pełnych kolorach; tej zmiany nie dotyczą.

- **Pierścień numerów:** wokół tarczy biegnie pas z numerami 1–20, jeden **segment** na sektor. Cele i ich stan widać w pasie, a sama tarcza pokazuje tylko, w którą jej część trzeba trafić.
- **Anatomia segmentu:** numer pośrodku pasa i do 3 kresek stanu na jego wewnętrznej krawędzi (w Killer do 5, krótszych). Kreska pełna znaczy „jest”, pusta „jeszcze nie”: znacznik Cricketa, życie w Killer, S, D albo T sektora rundy w Shanghai trafione w tej Turze. Kreski idą łukiem wzdłuż pasa i obracają się razem z numerem.
- **Kolory segmentu** (jeden stan na segment):
  - **pomarańczowy:** cel, w który trzeba trafić teraz (numer i kreski ciemne);
  - **zielony** (ciemnozielony pas, zielony numer i kreski): zamknięty albo zaliczony przez gracza, który rzuca;
  - **czerwony:** własny double killera, bo trafienie go kosztuje życie (numer i kreski ciemne);
  - **szary:** poza grą;
  - **szary z ciemniejszym numerem:** zamknięty u wszystkich graczy (Cricket), a na tarczy jego klin jest zakreskowany;
  - **szary z jasnym numerem:** gra bez celu w sektorze (Free throw, Football z piłką w Doubles, gdzie celem jest cały ring double).
- **Ring celu tylko na tarczy:** gdy liczy się tylko część sektora (treble, double, duży single albo bullseye), ta część jest w pełnych kolorach tarczy i ma pomarańczowy obrys (czerwony dla własnego double killera), a reszta klina jest przygaszona. Gdy liczy się cały sektor, klin jest w pełnych kolorach bez obrysu. Pas z numerami ringu nie powtarza.
- **Wygaszenie:** przygaszony klin jest ciemny, ale na tyle jasny, że tarcza dalej wygląda jak tarcza. Klin zamknięty u wszystkich jest zakreskowany, a jego segment szary, więc „zamknięte u wszystkich” różni się od „poza grą”.
- **Bull:** pierścień wokół zewnętrznego bulla w kolorze stanu i z kreskami jak segment. Obrys stoi na bullseye, gdy liczy się tylko on (ATC w Doubles i Trebles, Football z Bull only), a w pozostałych przypadkach na zewnętrznym bullu.
- **Ciągi:** sąsiednie segmenty (kolejność jak na tarczy, 5 sąsiaduje z 20) w tym samym kolorze łączą się w jeden pas z cienkimi przegrodami, zaokrąglony tylko na końcach ciągu. Sąsiednie cele z tym samym ringiem i kolorem mają jeden ciągły obrys. W różnych kolorach się nie łączą: pas ma wtedy szerszą przerwę, a obrysy kończą się przed granicą (np. czerwony 10 obok pomarańczowego 9 w Killer). Cały pierścień w jednym stanie to jeden okrąg pasa, a obrys całego ringu to dwa okręgi (Football z piłką w Doubles).
- **Orientacja numerów:** każdy numer jest obrócony promieniście, górą cyfr na zewnątrz, jak na prawdziwej tarczy. Numery w dolnej części (od 11 i 6 w dół: 8, 16, 7, 19, 3, 17, 2, 15, 10) są obrócone o 180°, żeby dało się je czytać od dołu.
- **Kropki lotek** z bieżącej Tury: zielone przy trafieniu, czerwone przy pudle, w białej obwódce, w miejscu wbicia (bez coords na środku swojego pola). Numery leżą nad kropkami, żeby pudło na pierścieniu numerów żadnego nie zasłoniło. Tarcza nie ma animacji.
- **Stan na tarczy to stan gracza, który rzuca**, więc zmienia się z Turą: w Cricket zamknięte sektory i kreski, w Killer cele i życia, w ATC i Full Board zaliczone cele.
- **Znaczniki ról** (Hare and Hounds, od 2026-11-27, makieta `.scratch/hh-catch40/`): sektor, na którym stoi zając, ma pas w kolorze `--hare` (turkus gracza 2, `#16B2C9`), a sektor ogara w `--hound` (fiolet `#A78BFA`); oba z ciemnym numerem, klin przygaszony. Na wewnętrznej krawędzi pasa stoi **znacznik**: ciemne kółko z rysunkiem zająca albo ogara w kolorze roli, obrócone jak numer, a numer tego sektora odsuwa się na zewnątrz i maleje (32 zamiast 36). Cel rzucającego (pomarańczowy) wygrywa z kolorem roli, gdy ogar celuje w sektor zająca. Po złapaniu oba znaczniki stoją obok siebie na jednym sektorze, a celu nie ma. Ten sam znacznik (`RoleToken` w `HeroBoard.tsx`) stoi w lewej kolumnie przed nazwą roli i w wierszach listy. Model: stany `hare` i `hound` oraz pole `roles` w `BoardTargets` (`targets.ts`).

| Stan | Segment | Tarcza | Gry |
|---|---|---|---|
| Cel, dowolny ring | pomarańczowy | klin w pełnych kolorach, reszta przygaszona | ATC i Full Board w Any, Shanghai (sektor rundy), Bullseye i Football bez piłki (bull), Cricket (sektory w grze) |
| Cel, jeden ring | pomarańczowy | tylko ten ring w pełnych kolorach z pomarańczowym obrysem, reszta klina przygaszona | ATC i Full Board w Doubles lub Trebles, Football Big singles, Killer (double) |
| Cel z kreskami | pomarańczowy z kreskami | jak wyżej | Cricket (znaczniki 0–2), Shanghai (S, D, T w tej Turze), Killer (życia rywala) |
| Zaliczony albo zamknięty przez ciebie | zielony | ATC i Full Board: klin przygaszony. Cricket: klin w pełnych kolorach, bo sektor dalej punktuje | ATC, Full Board, Cricket (3 znaczniki) |
| Własny double killera | czerwony, z kreskami własnych żyć | double w pełnych kolorach z czerwonym obrysem | Killer, po statusie killera |
| Poza grą | szary | klin przygaszony | każda gra: sektory bez celu, wyeliminowani w Killer |
| Zamknięty u wszystkich | szary z ciemniejszym numerem | klin zakreskowany | Cricket |
| Bez celu w sektorze | szary z jasnym numerem | Free throw: cała tarcza w pełnych kolorach. Football z piłką w Doubles: pierścień double w pełnych kolorach, obrysowany dwoma okręgami | Free throw, Football |
| Tu stoi zając / ogar | turkusowy / fioletowy, ze znacznikiem roli | klin przygaszony | Hare and Hounds |

### Ekran wyników dla gier z tarczą

Od 2026-11-26, dla ATC, Full Board, Shanghai, Football, Bullseye, Free throw, Cricket i Killer, od 2026-11-27 też Hare and Hounds (`hasBoard` w `web/src/screens/MiniBoard.tsx`). Rozmiary ustala `styles.css` (sekcja „games with a board”), a to, co stoi w lewej kolumnie i na liście, czysta logika w `web/src/screens/boardHero.ts`.

- **Trzy kolumny** (340 u, reszta, 460 u): gracz, karta tarczy, lista graczy z przyciskami Pilota pod spodem. Cricket od 6 graczy ma szerszą prawą kolumnę (558, 636, 714 u przy 6, 7, 8 graczach), żeby nagłówek każdego gracza w siatce miał ≥ 44 px przy 1280×720; tarcza maleje (przy 8 graczach ok. 670 px przy 1920).
- **Lewa kolumna** (hero): imię, w Killer pod nim serca (pięć serc nie wypchnie imienia), kicker z dużą liczbą (200 u, od 5 znaków 120 u), notka, w Cricket od 5 graczy legenda „numer → imię”, a **na dole 1–3 kafelki statystyk gracza z tego meczu**: te same liczby co w podsumowaniu, tylko takie, jakie widok gry już ma. Statystyki dotyczą gracza, który rzuca:
  - ATC: Darts, Hit rate, Per target. Full Board: Darts, Hit rate, Per sector. W Co-op „per” liczy lotki drużyny;
  - Shanghai: Darts, Hit rate, Shanghais. Free throw: Average, Darts, Highest visit;
  - Cricket: Marks i Darts (solo tylko Marks, bo lotki są dużą liczbą). Killer: Lives taken i Rivals left. Football: To win (ile goli brakuje);
  - Bullseye bez kafelków: widok gry nie ma nic poza punktami;
  - Hare and Hounds: Darts i Hit rate, a nad nimi pod imieniem rola ze znacznikiem („HARE” turkusem, „HOUND” fioletem) i kicker „Gap” nad dystansem jako dużą liczbą.
- **Kicker i notka** zostają tylko tam, gdzie tarcza ich nie powie: „Target” (ATC), „Sectors” (Full Board), „Round N / M” i punkty („61 points · 12 this visit”, Shanghai), „Goals” i kto ma piłkę (Football), „Points” i zasady punktacji (Bullseye), „This visit” i „Visit N of M” (Free throw), „Killer” albo „Your double” (Killer). Cricket nie ma kickera „Points” (liczba to zawsze punkty, a nagłówek siatki je powtarza), a jego MPR jest notką; solo Cricket ma kicker „Darts”.
- **Usunięte teksty** (tarcza pokazuje to samo): postęp i lotki w ATC („3 / 21 · 5 darts”) i Full Board („N darts”), „Hit a rival double” i „Hit your double to become a killer” w Killer, „· doubles score” i „· hit the bull” w Football, kicker „Points” w Cricket. „⚽ Your ball”, „Ball in the centre” i „Bob has the ball” zostają, bo tarcza nie mówi, kto ma piłkę.
- **Karta tarczy** (środek): tarcza tak duża, jak pozwala karta, a pod nią rząd trzech kafelków lotek, dalej do poprawki dotykiem („Fix dart”, „+ Add”). W prawym górnym rogu karty stoją pigułki rekordów, poza pierścieniem numerów ([Rekordy w trakcie gry](#rekordy-w-trakcie-gry)).
- **Lista graczy** (prawa kolumna): wiersze wypełniają kolumnę i są wyższe niż w grach bez tarczy, a do 3 graczy jeszcze większe (imię 52 u, wynik 120 u; od 4 graczy imię 38 u, wynik 96 u; od 6 graczy kompaktowe: imię 28 u, linia 24 u, wynik 64 u, serca 30 u, cieńszy pasek, żeby 8 wierszy zmieściło się przy 1280×720). W ATC, Full Board, Football i Hare and Hounds każdy wiersz ma **pasek postępu**: zaliczone cele z 21 (ATC), zaliczone sektory z 21 (Full Board), gole z celu gry (Football), cele zająca z 20 i trafienia ogara z jego drogi do zająca (Hare and Hounds, wynik „7 / 20” i „12 / 13” z mniejszym mianownikiem, wiersz ze znacznikiem roli). Pozostałe gry go nie mają. W Killer serca stoją pod imieniem, a killera oznacza czerwona plakietka „Killer” (od 6 graczy w tej samej linii co serca). Cricket ma zamiast listy siatkę znaczników.
- **Pod listą tylko przyciski:** karty „THIS MATCH” nie ma, bo liczby są po lewej.

### Rekordy w trakcie gry

Od 2026-11-23, zasady w [GRY.md](GRY.md#rekordy-w-trakcie-gry), makieta w `.scratch/records-live/mockup.html`.

- **Plakietki** (`RecordPills` w `web/src/screens/MiniBoard.tsx`, logika w `web/src/records.ts`): pigułki 40 u, etykieta wersalikami 17 u, liczba Barlow 28 u (w karcie tarczy 44 u i 18 u, z minimum 30 px i 16 px), w prawym górnym rogu karty tarczy (20 u od prawej i od góry), wyrównane do prawej. „Best” i „Best · PB / Team” pomarańczowe, „PB” i „Team” neutralne na `--raised`, poza zasięgiem wszystko w `--off` z przekreśloną liczbą. Cała grupa jest jednym przyciskiem (co najmniej 44 px), bez dodatkowej ikony. Gry z rekordem i tarczą mają pigułki w karcie tarczy; 121 ma chorągiewki, a Catch 40 (bez tarczy i drabinki, od 2026-11-27) ma pigułki w górnym wierszu hero, za chipami „Points” i „Attempt”.
- **Chorągiewki 121:** PB (Team) na `--raised` w kolorze tekstu, pobity rekord na `--green-bg` w zielonym z ✓, druga chorągiewka na tym samym szczeblu niżej. Chorągiewka jest przyciskiem, a niewidoczny margines daje jej 44 px wysokości.
- **Modal rekordów** (`RecordModal`): karta 1560 u na przyciemnionym tle, kicker „RECORDS” i nazwa wariantu, dwie kolumny. Lewa: wiersz „Office best” (pomarańczowy; scalony „Office best · PB” z obrysem), pod nim „PB” albo „Team best” z datą lub „First game”, przy kilku graczach sekcja „PB · this match” z mniejszymi wierszami (rzucający z obrysem i „THROWING”, gość „Guest”), dla gościa notka „Guests have no PB.”. Prawa: „Office top 5” (Co-op: „· teams”), #1 pomarańczowy, wiersz gracza lub składu z obrysem, poniżej top 5 pod „⋯” z miejscem. Zamyka X (72 u) i stuknięcie poza kartą; nowy mecz startuje bez modalu. Modal widzi tylko ekran, na którym go otwarto (kiosk albo laptop).
- **Ekran rekordu:** te same pigułki w większej wersji (72 u, liczba 52 u, imię i data obok), od 5 graczy w dwóch kolumnach po 64 u.

## Tura i takeout

- **Takeout** kończy turę automatycznie. Lotki, których brakuje do trzech, wpadają jako Miss.
- **Karta tury** (z testów 2026-10-26): gdy Tura się skończy (trzecia lotka, bust, checkout, utrata życia), ekran nie przeskakuje dalej, tylko od razu pokazuje kartę tury. Przy krótszej Turze karta pojawia się z początkiem takeoutu.
  - Na karcie jest tylko imię, duży werdykt i lotki (od 2026-11-01). Nad liczbą jest samo imię, bez „scored”. Werdykt to „CHECKOUT”, „BUST” (czerwony) albo zdarzenie gry, np. „LIFE LOST”. Bez werdyktu jest wynik tury: suma w X01, 121 i Higher or Lower, w Cricket liczba marków („4 MARKS”, od 2026-10-28, ze zgłoszenia: po poprawce S2 na T17 liczba trafień się nie zmieniała), a w pozostałych minigierkach liczba trafień („2 HITS”).
  - Karta i inne nakładki nie nachodzą na wiersz przycisków w prawej kolumnie. Wiersz leży nad przyciemnieniem nakładki i zostaje klikalny („Takeout done”, „Next leg”, „Skip”, „Undo”). Karta bull-offu jest podniesiona o 48 u, żeby kończyła się nad przyciskami (od 2026-11-16, wcześniej nakładki kończyły się nad paskiem Pilota).
  - Lotki to duże kafelki jak na ekranie gry (od 2026-10-27, ze zgłoszenia o nieczytelnej karcie), z polem na górze (np. „S7”). W grach liczonych trafieniami (ATC, Full Board, Cricket, Killer, Shanghai, Football) kafelek jest zielony przy trafieniu i czerwony przy pudle (od 2026-10-27). W grach punktowych kafelek jest neutralny, a lotka, która nic nie dała (121, Higher or Lower, Random Checkouts, Gotcha, Knockout, Free throw, X01 przed otwierającym double), jest wygaszona ([Styl](#styl), D1). Niedorzucone lotki to puste kafelki.
  - Bez kafelków ze stanem po Turze („Left”, „Target”, „Range” itd.) i bez notek gry pod lotkami (zdjęte 2026-11-01): nikt ich nie czytał, a hero pokazuje to samo po końcu takeoutu. Zostaje „Pull the darts” i pasek takeoutu.
  - Hero pod kartą trzyma stan z chwili końca Tury, np. w 121 nadal „Target 121”. Nowy cel, nowe życie i następny gracz pojawiają się dopiero po końcu takeoutu.
  - Checkout kończący leg X01 pokazuje od razu ekran końca legu, jak dotąd.
- W czasie takeoutu ekran jest przyszarzony. Pod kartą tury jest bursztynowy pasek „Removing darts” ze spinnerem i ostrzeżeniem, że rzuty przed „Ready” się nie liczą.
- **Koniec takeoutu** (sam albo przez „Takeout done”) gra krótki dźwięk zmiany gracza (arpeggio marimby) i dopiero wtedy przełącza na następnego gracza. Dźwięk opisuje [EFEKTY.md](EFEKTY.md#wbudowane-dźwięki).
- **Zacięty takeout:** Board Manager czasem nie zgłasza końca takeoutu i wtedy nie widzi nowych rzutów. Pilot ma w czasie takeoutu główny przycisk „Takeout done”. Wywołuje on Reset na Board Managerze i przechodzi do następnej tury. Po około 15 s ekran podpowiada „Board stuck? Tap Takeout done.”
- Lotki rzucone przed „Takeout done” nie istnieją dla systemu. Gracz dopisuje je przez „Add dart” albo rzuca jeszcze raz.

## Pilot w trakcie meczu

- **Przyciski:** na Ekranie wyników ostatni wiersz prawej kolumny, „Undo” (węższy) i główny przycisk, bez wskazówki. Trzeci przycisk („Reroll numbers” w Killer przed pierwszą lotką, „End match” po legu bez match mode) jest w wierszu nad nimi. Na telefonie pasek ze wskazówką, „Undo” (węższe, w proporcji 1 : 1,5 do głównego przycisku) i głównym przyciskiem; pasek jest przypięty do dołu z uwzględnieniem safe area. Główny przycisk to „Next player”, w czasie takeoutu „Takeout done”, a po legu bez match mode „Next leg”.
- **Telefon-Pilot** (od 2026-11-18, spójnie z Ekranem wyników):
  - sekcja Tury stoi tuż nad paskiem przycisków, a lista graczy u góry;
  - nagłówek Tury liczy się jak karta Tury na kiosku (`turnHead` w `web/src/match.ts`): suma w pomarańczu, czerwone „BUST”, werdykt Tury w jego kolorze (np. „LIFE LOST”), w grach liczonych trafieniami „1 hit” i „2 hits”, w Cricket marki, w Bullseye punkty ze znakiem. W 121 jest to suma Tury, a ile zostało do celu, widać w wierszu gracza;
  - kafelki lotek mają kolory z [Stylu](#styl) (D1);
  - wiersz gracza ma kropki legów jak Ekran wyników, wycofany jest wygaszony („Left”);
  - ekran ma wysokość `100dvh` i odstępy od wcięć ekranu (notch, pasek gestów).
- **Widz** (telefon bez kontroli): ten sam nagłówek Tury i lotki, status tarczy jako zwykły tekst w nagłówku (nie jest przyciskiem, bo widz nie ma Panelu tarczy), a linia „Pilot: …” stoi nad przyciskami, w treści.
- **Undo** cofa jedną lotkę. Gdy w turze nie ma lotek, cofa do poprzedniej tury z jej trzema lotkami.
- **Poprawka lotki:** stuknięcie w kafelek otwiera arkusz.
  - Zakładki „Nearby” i „All” są prawdziwymi zakładkami (od 2026-11-18): strzałki ←/→ przełączają je i przenoszą fokus, Home i End skaczą na pierwszą i ostatnią, a Tab ma jeden przystanek na zakładkach. Arkusz na telefonie nie ma uchwytu do przeciągania, zamykają go „Cancel”, tło i Esc.
  - Zakładka „Nearby” to siatka 3×3: sąsiad z lewej, odczytane pole i sąsiad z prawej, w wierszach Double, Single i Triple. Pomyłkę o jedno pole poprawia jedno stuknięcie.
  - Zakładka „All” to przełącznik Single/Double/Triple i liczby 1–20.
  - Pod obiema zakładkami są Miss, 25 i Bull. Pod „Nearby” z etykietą „Other” (wyrównaną z Double, Single i Triple), pod „All” w jednym rzędzie z klawiaturą, bez etykiety.
  - Na laptopie obok zakładek jest zawsze widoczna duża tarcza z pogrubionymi pierścieniami. Małe białe kropki bez numerów (od 2026-10-27) pokazują lotki: z coords Board Managera stoją tam, gdzie lotka się wbiła (chybienie przycięte do pierścienia numerów, z właściwej strony tarczy), bez coords (lotka wpisana ręcznie) w środku pola. Poprawiana lotka jest większa, z grubszym obrysem; przy „Add dart” nic nie jest wyróżnione. Przy implementacji zamiast trzeciej zakładki, bo na dużym ekranie mieści się obok. Stuknięcie w tarczę, przy poprawce i przy „Add dart”, zapisuje miejsce kliknięcia jako coords lotki (jednostki Board Managera, 1 = 170 mm, liczone przez macierz SVG, więc także gdy tarcza jest w prostokącie), więc gry rozróżniające single wewnętrzny od zewnętrznego (Bullseye, Football w Big singles) widzą, gdzie lotka stała; Keypad i „Nearby” zapisują lotkę bez coords.
  - Na laptopie lewa kolumna nie przewija się (od 2026-10-27): czerwony „Cancel” jest w nagłówku obok „read as”, podpowiedź o stuknięciu w tarczę jest jedną linią w dolnym marginesie okna, żeby tarcza miała całą wysokość, a klawisze zmniejszają się na niskich ekranach. Sprawdzone do 1280×720.
- Poprawić da się każdą lotkę w bieżącej turze, czyli przed takeoutem. Starsze tury tylko przez Undo.
- Wybór od razu podmienia rzut. Poprawiona lotka jest krótko podświetlona, także na Ekranie wyników.

## Wycofanie gracza

Z grillingu 2026-11-04. Pojęcia: Wycofanie z meczu i Wycofanie z legu ([GLOSSARY.md](../GLOSSARY.md)).

- **Gdzie:** tylko Pilot. Stuknięcie w wiersz gracza (lista na telefonie, lista na Ekranie wyników, gdy Pilotem jest laptop) otwiera okno na środku ekranu z imieniem (także na telefonie, decyzja z review 2026-11-04). Tytuł to „Remove Bob?”, a linia pod nim mówi, jakie są drogi: „Out for this leg only, or for the rest of the match.”, samo „Out for this leg only.” albo samo „Out for the rest of the match.” (`removeIntro` w `web/src/match.ts`). W X01 są w nim „Remove from leg” i czerwony „Remove from match”, w minigierkach sam „Remove player”, a z „Cancel” stoją w jednym rzędzie, równe na całą szerokość okna (poniżej 560 px jeden pod drugim, „Cancel” na dole). Każdy przycisk pyta o potwierdzenie („Remove Ann from the match?” albo „… from this leg?”, z opisem skutków i „Undo takes it back.”). Kto nie jest Pilotem, nic po stuknięciu nie dostaje.
- **Kiedy nie:** w trakcie bull-offu, i gdy w meczu (albo w legu) grałoby już tylko dwóch: wtedy jest „End match”, bez walkowera. Okno nie ma wtedy przycisków wycofania, ma tytuł „Can't remove Bob” (od 2026-11-18) i w linii powód (np. „Fewer than two players would be left: use End match”). Obok „Cancel” jest „End match”, który zamyka okno i otwiera zwykłe pytanie o koniec meczu. To samo okno jest na Ekranie wyników i na telefonie.
- **Wycofany z meczu:** zostaje na liście wyszarzony z „Left” i swoim wynikiem do tej chwili, kolejka go pomija do końca meczu, także w następnych legach i setach X01. Usunięty w trakcie swojej Tury kończy ją rzuconymi lotkami, gra idzie do następnego. Brakujących lotek nie dopisuje się jako pudła, więc średnia liczy tylko rzucone (decyzja z review 2026-11-04).
- **Wycofany z legu (X01):** wyszarzony z „Back next leg” do końca legu, leg liczy mu się jak przegrany. W następnym legu wraca na swoje miejsce w kolejności, także jako zaczynający, gdy wypada jego kolej.
- **Gry:** Killer, Knockout i Higher or Lower traktują wycofanego jak wyeliminowanego (z „Left” zamiast „Out”, bez Momentu), w Killerze jego numeru nikt już nie trafia, a runda Knockout w toku kończy się bez niego. W Cricketcie jego zamknięcia przestają blokować punkty, jego punkty zostają zamrożone. W Football piłka, którą miał, jest wolna. W Gotcha zerowania z lotek rzuconych przed wycofaniem zostają, a punkty wycofanego też. W Co-op drużyna gra dalej bez niego. W pozostałych grach jest po prostu pomijany.
- **Undo** cofa wycofanie, gdy to ostatnie zdarzenie. Wycofanie nie odpala Momentu, dźwięku ani ledów.
- **Statystyki:** lotki wycofanego z meczu liczą się do średnich i rekordów z Tur (X01), a jego wynik niedokończonej minigierki nie trafia do rekordów, ale mecz nie liczy mu się jako rozegrany, wygrany ani przegrany. W podsumowaniu stoi na końcu, wyszarzony z „Left”, bez miejsca. Rematch startuje bez niego. Wycofany z legu jest w meczu normalnie.

## Start i koniec meczu

- **Nowy mecz** to trzy kroki Pilota: **Game → Players → Options** (od 2026-11-27 najpierw gra; wcześniej Players → Game → Options, a przed 2026-11-27 jeden ekran z trzema kolumnami; plany i makiety w `.scratch/new-match-flow/` i `.scratch/game-first/`):
  - **Nagłówek:** „New match” i kroki. Zaliczone kroki są zielone, pokazują wartość („Game · X01”, „Players · Kuba, Marta +4”) i są klikalne, ale tylko wstecz. Strzałka wstecz cofa o krok, a z Game zamyka Nowy mecz.
  - **Game:** kafle w grupach Classic (X01 na całą szerokość), Practice i Versus; na laptopie Classic i Practice w lewej kolumnie, Versus w prawej, wszystkie bez przewijania. Opis gry ma najwyżej 2 linie. Kafle nie są wygaszane (składu jeszcze nie ma); wybrana gra (ostatnio grana) jest podświetlona. Stuknięcie w kafel przechodzi od razu do Players; na dole jest tylko „Close” i „Tap a game”.
  - **Players** (układ B z makiety `.scratch/game-first/mockup.html`): po lewej „Who's playing?” i **wszyscy zarejestrowani gracze jako równe kafle** w 3 kolumnach (ostatnio grający pierwsi, potem reszta w kolejności listy), na końcu kafel „+ Guest” (formularz gościa pod siatką, nowych graczy zakłada się tylko w „Players”). Kafel ma wysokość 64–100 px zależnie od liczby graczy (wypełnia wysokość; gdy się nie mieści, przewija się sama siatka), okrągły awatar z inicjałami (`initials`, kolor `--p1…--p4` z `id % 4`, gość neutralny), imię i okrągły znacznik po prawej. Kafel jest przełącznikiem: wybrany jest biały ze znacznikiem ✓, drugie stuknięcie go zdejmuje. **Bez numeru kolejności**, bez listy kolejności i bez przeciągania. Zaznaczony gracz, który stracił kafel (np. zarchiwizowany na innym urządzeniu), i dodany gość dostają własny kafel, żeby dało się ich zdjąć.
  - **Kolumna po prawej (380 px)** to „Who throws first”: trzy karty **Random / Closest / PDC** z ikoną i jednym zdaniem opisu, pod nimi „N players: imiona” i „Next · Options”. Karty są tylko dla gry z bull-offem (`hasBullOff`) i od 2+ graczy; przy 0–1 graczu są wygaszone z „2+ players”, a przy grze bez bull-offu kolumna nie ma kart. Wybór jest zapamiętany lokalnie, jak opcje gier (`itdarts.bullOff`). **Random** to dotychczasowa wartość „Off” (bez zmiany modelu i serwera): Nowy mecz tasuje graczy (Fisher–Yates, `throwOrder` i `shuffled` w `web/src/match.ts`) tuż przed `startMatch`, więc kolejność klikania nie ma znaczenia. **Closest** i **PDC** zostawiają kolejność klikania, a serwer losuje kolejność rzutów w bull-offie. Rematch przy Random przesuwa kolejność o jednego, jak dotąd (`rematchSetup`). Nowy mecz wkłada bull-off do opcji gry, która go ma (`withBullOff` w `games/quick.ts`), a Free throw dostaje opcje bez niego.
  - **„Next · Options”** stoi na dole prawej kolumny. Gdy skład nie pasuje do gry, przycisk jest nieaktywny (kolory przycisku nieaktywnego) i zamiast tekstu podaje powód: „Pick players” przy 0 graczach, w innym razie „Solo only”, „2 players” albo „2+ players” (`lineupBlock` i `whyNot` w `web/src/match.ts`). Kafle można zaznaczać dowolnie.
  - **Options** (układ C z makiety): po lewej kolumna 340 px z **pomarańczowym kafelkiem gry** jak w kroku Game (nazwa, opis, znak wodny ikony, „How to play” z obrysem) i tuż pod nim kartą graczy (chipy z awatarem i imieniem, „Throws first: Random”, bez linii przy 1 graczu i w grze bez bull-offu). Po prawej opcje w dwóch kolumnach (X01: Start score | Match mode, Check-out | First to, Check-in | Legs per set), rozłożone na wysokość (`align-content: space-evenly`). Etykieta ma 20 px, a pod nią stoi opis z `info` modułu gry (16 px) zamiast ikony „i”; segmenty mają 60 px i tekst 20 px. Opcje dla 2+ graczy (Mode w Cricket, Co-op) są tylko przy 2+ graczach, a przy solo stoi linia „Solo: Mode appears with 2 or more players.”. Na dole „Back”, podsumowanie („Kuba, Marta · X01 · 501 · Double out · First to 3 legs”) i przycisk startu.
  - **Gra z góry** (kafel rekordu na telefonie): Nowy mecz otwiera się na Players, z krokiem Game zaliczonym i klikalnym. Okno „Record attempt” na kiosku bez zmian.
  - **Przycisk startu** mówi, co wystartuje (od 2026-11-18): „Start · Killer · 2 players” (`startLabel` w `web/src/match.ts`, przy jednym graczu „1 player”). Gdy start jest zablokowany (np. trwa mecz), powód stoi w samym przycisku, w kolorach przycisku nieaktywnego.
  - **Telefon i okna poniżej 1100 px:** te same 3 kroki w jednej kolumnie. Players: kafle w 2 kolumnach (pusty znacznik ukryty, żeby zmieściły się imiona), potem „Who throws first”, lista graczy i przypięty na dole „Next · Options”. Options: kafelek gry, karta graczy, opcje jedna pod drugą. W nagłówku kroki są samymi numerami.
  - **Laptop od 1280×720:** bez przewijania strony przy 0–8 graczach i 14 albo 24 zarejestrowanych, tekst co najmniej 16 px, cele co najmniej 44 px. Przy wielu graczach przewija się sama siatka kafli, a prawa kolumna z „Next” zostaje w widoku.
- **Quick start zniknął z UI** (2026-11-27): kafle slotów, ołówek (edycja Game → Options z „Save quick game”) i „Remove” zostały usunięte z Nowego meczu. Serwer zostaje bez zmian: sloty `quickGames` w tabeli `settings` i komenda `setQuickGame` (pamiętają się do ewentualnego powrotu), a `games/quick.ts` trzyma `withBullOff`, `hasBullOff` i resztę (`slotLabel`, `fitsSet` itd.). Historia: pierwotny opis w git (commity z 2026-11-27 na gałęzi `jgoliszewskiitboom/new-match-flow`).
- **Opcje X01:**
  - start score: 201, 301 albo 501 (od 2026-10-27 zamiast 701);
  - check-in i check-out (w kolejności Single, Double, Master; domyślnie Double);
  - match mode: Off, Legs lub Sets, z „First to N”;
  - kolejność rzucania (bull-off): Random (dawne „Off”), Closest albo PDC, od 2026-11-27 wybierana w kroku Players, jedna dla wszystkich gier, nie jest opcją X01.
- **Gracze i goście:** opisani w [STATYSTYKI.md](STATYSTYKI.md).
- **Wspólny wygląd kart** (od 2026-11-01): koniec legu, koniec meczu i Ekran rekordu mają duży napis nad zwycięzcą, duże imię i duże kafelki z liczbami. Pod kafelkami nie ma linijek tekstu („Legs so far”, „Next leg starts after the takeout”, „The summary opens from the pilot”, „Game on in a moment”): co dalej, mówią przyciski Pilota.
- **Koniec legu:** ekran ze zwycięzcą, checkoutem, liczbą lotek i średnią z legu.
  - W match mode trzyma się do końca takeoutu, potem następny leg startuje sam.
  - Bez match mode czeka na „Next leg” albo „End match”.
- **Koniec meczu:** karta wygranej („WINNER” we wszystkich grach, w minigierkach też „SHARED WIN” albo „GAME OVER”; od 2026-11-01 zamiast „MATCH WON” w X01) pokazuje zwycięzcę i kafelki: w X01 legi, średnią i checkout, w minigierkach wynik gry i liczby zwycięzcy z podsumowania. Status tarczy w nagłówku to wtedy „Game over” w każdej grze. Karta ma na Pilocie jeden przycisk „Summary”, który zapisuje mecz i otwiera [podsumowanie](#podsumowanie-meczu). „End match” ze „Save to stats” i zwykłe zakończenie po legu bez match mode też prowadzą do podsumowania, „Discard” prosto do lobby.

## Podsumowanie meczu

Postanowienia z grillingu z 2026-10-28 (zgłoszenia: heatmapa, porównanie graczy, distance walked).

- **Skala na TV** (od 2026-11-18): na dużym ekranie podsumowanie jest w jednostkach `u` jak Ekran wyników (wartości 44 u, etykiety 24 u, imiona 28 u), więc czyta się je z oche i mieści się bez przewijania od 1280×720 do 1920×1080 (pomiar przy 2 i 4 graczach i w Free throw solo). Przy 3 i więcej graczach etykieta statystyki stoi w wierszu, a kolumny graczy obok niej.
- Pełny ekran zamiast lobby na dużym ekranie i w telefonach, aż Pilot wybierze „Rematch” (z bull-offem w opcjach zaczyna się od nowego bull-offu z wylosowaną kolejnością rzutów, bez bull-offu zaczyna następny w kolejności z setupu), „New match” albo „Back to lobby”. Bez kontroli widać podsumowanie bez przycisków. Serwer trzyma je w pamięci, restart wraca do lobby.
- Od góry:
  - nagłówek: „MATCH WON” i zwycięzca z wynikiem w legach albo setach, w minigrach wynik gry, a po przerwaniu „MATCH ENDED”;
  - porównanie w stylu Autodarts: przy dwóch graczach nazwa statystyki pośrodku, wartości po bokach, a pod nimi paski od środka na zewnątrz w kolorach graczy, długie według udziału w sumie (przy „lower” według odwrotności). Najlepsza wartość jest w pigułce koloru gracza. Przy 3–4 graczach każdy ma kolumnę z wartością i paskiem. Pasek rysuje się tylko wtedy, gdy są co najmniej dwie wartości do porównania. Szerokość jest ograniczona (560 px przy dwóch), żeby liczby były blisko siebie. X01: średnia, pierwsze 9, checkout %, Bust rate, najwyższa Tura, najwyższy checkout, najkrótszy leg, 60+, 80+, 100+ (liczby, nie %), lotki. Minigry: liczby z tego meczu (profil na `/stats` pokazuje częstości na mecz). Ostatni wiersz to „Distance walked” w metrach;
  - w Random Checkouts sekcja „Checkouts” pod porównaniem: lista wylosowanych liczb ([GRY.md](GRY.md#random-checkouts)), imię zamykającego w jego kolorze. Na szerokim ekranie to lewa kolumna, która przewija się sama, więc długa lista nie wypycha heatmapy ani przycisków;
  - [heatmapa](#heatmapa) graczy z tego meczu.
- **Solo** (jeden Gracz albo Gość, od 2026-11-18): bez porównania, więc liczby są kafelkami (na TV trzy w rzędzie), z „Distance walked” jako ostatnim, a heatmapa jest większa. Pod wynikiem Gracza (nie Gościa) stoi linia „▲ 24.2 vs your 30-day average”: główna statystyka gry z tego meczu (X01: Average) wobec średniej Gracza z ostatnich 30 dni **bez tego meczu** ([STATYSTYKI.md](STATYSTYKI.md#okna)). Gdy w 30 dniach nie ma innego meczu, linii nie ma.
- Goście mają pełną kolumnę i heatmapę, bo podsumowanie liczy się z meczu, a nie z historii.
- Na telefonie heatmapa jest pod porównaniem, a przyciski są przypięte na dole. Przy szerokości do 400 px „Rematch” zajmuje cały rząd, a dwa pozostałe przyciski stoją obok siebie.
- **Kolory graczy** według miejsca w meczu albo w porównaniu: 1 różowy, 2 turkusowy, 3 żółty, 4 zielony, dalej od nowa (D2, od 2026-11-18; gracz 3 był pomarańczowy i zlewał się z akcentem, tekst na kolorach graczy jest czarny). Profil gracza ich nie zapisuje. Kolory są w CSS jako `--p1…--p4`, a Compare czyta je stamtąd.

## Heatmapa

- Tarcza jak wszystkie inne w aplikacji (ta z ATC i Full Board, od 2026-10-28). Plamki jak w Autodarts: pojedyncza lotka zielonożółta z niebieską poświatą, a nakładające się przechodzą w żółć i czerwień. Coords są przeliczane pierścień po pierścieniu na poszerzone pola tej tarczy.
- Rysuje tylko lotki z coords; lotki poprawione albo dopisane ręcznie po prostu nie występują. Bez żadnych coords zamiast tarczy jest „No positions recorded”. Lotek z bull-offu nie ma.
- **Dwóch graczy:** jedna tarcza z pionową linią, którą przeciąga się myszą, palcem albo uchwytem (od 2026-11-18 uchwyt ma 48 × 48 px). Na telefonie pionowy ruch palca po tarczy przewija stronę, a linię przesuwa dopiero ruch w bok o ponad 8 px, który jest większy niż ruch w pionie (`sidewaysDrag` w `web/src/components/interaction.ts`). Na lewo od linii są lotki pierwszego gracza, na prawo drugiego, a przy linii u góry wiszą ich imiona w ich kolorach. Przy 3–4 graczach nad tarczą, wyśrodkowane, są dwa pola wyboru, domyślnie dwaj pierwsi.
- **Jeden gracz** (solo, profil gracza): tarcza bez linii.

## Lobby i QR

- Bez meczu Ekran wyników pokazuje lobby. Rekordy są główną treścią (grilling 2026-11-25, makieta wariant A w `.scratch/lobby-records/mockup.html`):
  - **po lewej** rekordy pogrupowane po grach, na stronach 4×2 (niżej), a pod nimi kropki, nazwy gier ze strony i link „All records →” do `/stats` (tabele wszystkich wariantów);
  - **po prawej wąska kolumna:** „READY FOR THE NEXT ONE” albo „NO MATCH YET”, „Game on?”, duży „New match”, pod nim „Rematch …” (długie imiona zawijają się do kolejnej linii) (do trzech graczy „Rematch Ann vs Bob”, od czterech „Rematch · 4 players”), jedna szara linia ostatniego meczu („Last: 121 · Anna · Target 140”, w X01 przy dwóch graczach obie strony „Anna 3–1 Bob”, przy 3+ sam zwycięzca bez liczby; solo i remis pokazują wszystkich graczy, mecz przerwany dopisuje „ended early”) i na dole Players, Stats, Effects. Karty ostatniego meczu już nie ma.
- **Kafelek rekordu:** opcje wariantu **bez nazwy gry**, łamane tylko na separatorze „ · ”, nigdy w środku segmentu jak „1–20” albo „Co-op” (nazwa gry jest w nagłówku grupy: „Any · Skips · Clockwise”, „Co-op”, „Solo · Random”; ATC z Order meczu rekordu), duża wartość z jednostką w pomarańczu, rekordzista (bold, skład co-op „Ewa & Tom”) i **pościg**: 2. i 3. miejsce w dwóch wierszach jaśniejszym szarym, bez dat. Miejsce jest w okrągłej plakietce o stałej szerokości (2. srebrzysta, 3. stonowany brąz, ciemna cyfra o kontraście ponad 4,5:1, bez pomarańczu, który jest tylko dla wartości rekordu), żeby cyfra nie zlewała się z imieniem. Miejsce liczy osoby (co-op: składy), nie wyniki: jedna pozycja na gracza, jak Ekran rekordu (`Db.rankedRecords`), decyzja użytkownika 2026-11-25. Brak wyników na tych miejscach to brak wiersza, a gdy nikt nie goni, jest jeden szary wiersz „Nobody close yet”. Długie imię lub skład w wierszu kończy się wielokropkiem, a pełny tekst jest w `title`.
- **Które warianty i jak na stronach** (grilling 2026-11-26, makieta wariant H w `.scratch/lobby-groups/mockup.html`): **wszystkie** warianty z rekordem, bez limitu. Gry idą według liczby meczów z ostatnich 30 dni (suma jej wariantów), potem od zawsze, potem nazwy; warianty w grze tak samo, z etykietą na końcu (`Stats.lobbyTop()`). Każda gra ma nagłówek: ikona, nazwa i linia.
  - **Strona** to zawsze ta sama siatka 4×2, więc kafelek ma ten sam rozmiar na każdej stronie, także na stronie z małą grupą (puste miejsca zostają puste). Wyjątek: gdy rekordów jest łącznie 1–4 (jedna strona), kafelki rosną: 1 na całą stronę, 2 obok siebie albo 2×2 (gdy grupy się tak nie ułożą, np. 3 i 1 z dwóch gier, zostaje 4×2). Gra z 5–8 wariantami ma stronę dla siebie, a gra z ponad 8 dzieli się: pierwsze 8 na stronie „ATC”, reszta jako „ATC (cont.)” idzie dalej jak każda grupa: do 4 wariantów dopakowana first-fit, 5–8 na własnej stronie. Gry do 4 wariantów pakują się **first-fit** w rzędy po 4 kafelki (mniejsza grupa dopełnia pierwszy rząd z miejscem, bez dziur), dwa rzędy to strona. Strony dużych grup są pierwsze, kolejność gier jest więc przybliżona. Nic nie jest ucinane, strona nie przewija się nigdy (`recordPages` w `web/src/records.ts`).
  - **Pod siatką** są kropki stron (stuknięcie przełącza, cel 44 px; aktywna kropka rozszerza się i jaśnieje płynnie razem z ruchem strony), nazwy gier z bieżącej strony i „All records →”. Przy jednej stronie nie ma kropek, nazw, rotacji ani gestu.
  - **Gest:** przeciągnięcie w bok (pointer events, `touch-action: pan-y`). Do 10 px dotyk jest stuknięciem, potem oś się blokuje (poziom = strony, pion = nic), kafelek pod palcem traci stan wciśnięcia i nie dostaje kliknięcia, a strony idą za palcem 1:1 od miejsca blokady. Na krawędziach gumka `(o·d·0,55)/(d + 0,55·|o|)`, swipe nie zawija.
  - **Sprężyna zamiast czasu:** pasek stron porusza sprężyna krytycznie tłumiona na rAF (bez przestrzelenia, bez nowej zależności, tylko `transform`; krok `springStep`). Po puszczeniu startuje z prędkością palca, a cel to strona najbliższa punktowi, do którego zaniósłby pęd (`pozycja + v·0,998/(1−0,998)`, najwyżej o jedną stronę od startowej, `projectPage`). Szybki ruch leci więc na następną stronę nawet przy krótkim przeciągnięciu, a wraca tylko wolne, krótkie. Response 0,35 s po swipe i po kropce, 0,45 s w auto-rotacji.
  - **Przerywalność:** ruchomą stronę (auto-rotacja, dojazd po swipe) można złapać w każdej chwili, strony zatrzymują się tam, gdzie są (bez skoku), a śledzenie palca startuje z tej pozycji; puszczenie bez przeciągnięcia dojeżdża do najbliższej strony i nie otwiera kafelka.
  - **Auto-rotacja** co 10 s tym samym ruchem sprężyny, z ostatniej strony na pierwszą jednym przejściem (za ostatnią stoi kopia pierwszej, po dojechaniu pasek wraca na prawdziwą niepostrzeżenie). Stoi w trakcie przeciągania i przy otwartym „Record attempt”, a po każdej zmianie strony liczy 10 s od nowa. Lista odświeża się po zmianie ostatniego meczu; gdy bieżąca strona zniknie, widać ostatnią.
  - **`prefers-reduced-motion` nie dotyczy stron rekordów** (decyzja użytkownika 2026-11-26, odstępstwo od reguły „Ruch UI”): gest, dokończenie ruchu po puszczeniu, pęd i auto-rotacja zawsze jadą sprężyną. Powód: Windows użytkownika zgłasza `reduce` także na kiosku, a bez ruchu puszczenie palca dawałoby natychmiastowy przeskok strony, co psuje sam gest. Ruch jest poziomy, krótki (≈0,35 s) i bez przestrzelenia.
- **Bez rekordów** jest jeden kafelek „No records yet · Play a minigame to set one” na całą stronę.
- **Stuknięcie w kafelek** (zmiana względem D6, tylko kiosk) nie otwiera Setupu, tylko okno **„Record attempt”**: nazwa wariantu, „Record to beat” z wartością i rekordzistą, chipy graczy (bez Gościa, bo gość nie ma PB i nie wchodzi do rekordów), podpowiedź „Pick 1 player” albo „Pick 2 or more players” z licznikiem, „Cancel” i „Start”.
  - **Solo** (ATC, Full Board, 121, Cricket, Shanghai bez co-op): dokładnie 1 gracz; stuknięcie innego zamienia wybór. **Co-op:** co najmniej 2, najwyżej tylu, ile pozwala gra (8); przy pełnym składzie pozostałe chipy są wyszarzone. Reguła jest w `web/src/records.ts` (`attemptReady`, `togglePick`).
  - Nikt nie jest zaznaczony na starcie, a „Start” jest nieaktywny, dopóki liczba się nie zgadza. Kolejność stuknięć to kolejność rzutów.
  - „Start” uruchamia mecz istniejącą akcją `startMatch` z opcjami meczu rekordu (`options` z `GET /api/lobby/records`, z Order w ATC; rekord co-op ma opcję co-op) i wybranymi graczami, bez Setupu i bez furtki do niego. Inną konfigurację daje „New match”.
  - Okno jest zwykłym `Dialog`: fokus wchodzi do środka, Esc, „Cancel” i stuknięcie w tło zamykają je ([Klawiatura i fokus](#klawiatura-i-fokus)). Stuknięcie w kafelek po cichu odbiera Pilota, jak „New match”.
- Dane z `GET /api/lobby/records?top=1` (`Stats.lobbyTop()` w `server/stats.ts`; pola `title` (nazwa gry), `sub` (opcje bez nazwy gry), `chase`, `coop`, `minPlayers`, `maxPlayers` w `LobbyRecord`; `label` zostaje dla okna „Record attempt” i aria), pobierane przy wejściu do lobby i po zmianie ostatniego meczu, a nie ze stanu huba. Bez parametru endpoint oddaje pełną listę w kolejności grup gier (`lobbyRecords()`), z której korzysta telefon. Rekordy X01 nie ma tu: X01 nie ma Ekranu rekordu ([STATYSTYKI.md](STATYSTYKI.md#rekordy-biura-x01)).
- „New match”, „Rematch”, Players i kafelki rekordów po cichu odbierają Pilota, gdyby miał go telefon.
- **Telefon-Pilot** ma ekran startu (PhoneHome) z tymi samymi słowami co lobby („Ready for the next one” albo „No match yet”, „Game on?”, „Rematch …”), z tym samym ostatnim meczem (solo jako wygrana) i z kafelkami rekordów pod nim (pełna lista w kolejności grup gier, od 2026-11-26 z nagłówkiem gry nad każdą grupą i etykietą kafelka bez nazwy gry, bez stron). Stuknięcie w rekord otwiera „New match” z grą i opcjami rekordu (Setup), a nie okno „Record attempt”. Długa lista rekordów spycha „Game on?” w dół, ale przyciski są przyklejone do dołu.
- **Obrót tarczy:** raz w miesiącu lobby pokazuje żółty baner „Rotate the board 3 sectors” z przyciskiem „Done” (spready zużywają się nierówno). Baner jest, gdy obrotu jeszcze nie zapisano albo minęło 30 dni lub więcej. „Done” zapisuje datę na serwerze (`boardRotatedAt` w `settings`) i liczenie zaczyna się od nowa. Tylko w lobby: nie w meczu i nie na telefonie. Stan liczy się przy każdej zmianie stanu, więc serwer bez ruchu przez wiele dni pokaże baner dopiero po następnej zmianie.
- Nakładka QR („Scan to take control”) zostaje tylko na „Show QR” z telefonu-Pilota.

## Menu Pilota

Menu jest oknem dialogowym (`role="dialog"`, od 2026-11-18): fokus startuje na „How to play”, Esc je zamyka i oddaje fokus przyciskowi „Menu”, a Tab krąży po jego pozycjach. Ma tylko to, czego nie ma pod osobnym przyciskiem. Board panel otwiera ikona tarczy w nagłówku (na telefonie: status tarczy w nagłówku). New match to przycisk na ekranie głównym, a Players, Stats i Effects są rzędem przycisków na ekranie głównym (kiosk: na dole prawej kolumny, pod linią ostatniego meczu; telefon Pilota: pod nagłówkiem).

- **W trakcie meczu:** How to play i End match, z potwierdzeniem. W trakcie legu End match pyta też, czy zapisać mecz do statystyk („Save” albo „Discard”).
- **Bez meczu:** Close app, czyli wyjście z kiosku, z potwierdzeniem. Tylko na laptopie przy tarczy.
- **Na telefonie-Pilocie** dochodzi Show QR, które pokazuje nakładkę QR na Ekranie wyników. Telefon bez kontroli go nie ma.
- **Bez kontroli:** Take control i Stats.
- **Report a bug:** w każdym menu, także bez kontroli ([Zgłaszanie błędów](#zgłaszanie-błędów)).
- **Efekty:** w menu meczu i ogólnym (laptop i telefon-Pilot) są nad przełącznikami suwak „Volume” z przyciskiem „Mute”/„Unmute” i przełączniki Sounds, Caller i LEDs ([EFEKTY.md](EFEKTY.md#dźwięk)); tylko u Pilota. Szczegóły Volume i Mute (od 2026-11-18):
  - **Volume** to master 0–100% (krok 5%), mnożnik nad wszystkim, co gra kiosk. Nad suwakiem stoi wartość w procentach, przy wyciszeniu „Muted · 90%”. Suwak ma 44 px wysokości i zapisuje się po puszczeniu (pointer, klawisz albo utrata fokusu).
  - **Mute** wycisza wszystko bez zmiany Sounds i Caller. Gdy jest włączony, przycisk ma czerwone tło i napis „Unmute”, a suwak jest wygaszony.
  - **Podgląd:** po puszczeniu suwaka kiosk gra krótki dźwięk zmiany gracza na nowym poziomie, bez względu na to, który Pilot ruszył suwak (podgląd wysyła serwer). Bez podglądu przy Mute, przy Sounds off i przy samym Mute/Unmute albo przełącznikach.
  - Ustawienia są lokalne dla laptopa i przetrwają restart ([EFEKTY.md](EFEKTY.md#dźwięk)). W każdym menu, także bez kontroli, jest wejście „Effects” na stronę `/effects` ([EFEKTY.md](EFEKTY.md)). Układ strony z zakładkami opisuje [EFEKTY.md](EFEKTY.md#układ-strony), a makiety to A1–A4 i C.

## Players

- Lista graczy z polem „New player name”. Archiwalni są pod „Show archived”.
- **Archive** (od 2026-11-18) nie pyta o potwierdzenie, tylko pokazuje komunikat „Anna archived” z przyciskiem „Undo” (przy przywracaniu „Anna restored”). Anonimizacja („Delete …?”) i scalanie („Merge … into…”) pytają jak dotąd.
- Wejście w gracza pokazuje u góry „Manage” (D7, od 2026-11-18): zwiniętą sekcję ze zmianą imienia, scalaniem, archiwizacją i anonimizacją, a pod nią jego statystyki, te same co `/stats/:id` (wybór gry i okresu). Imię stoi raz, w nagłówku ekranu, a przycisk „This is me” jest w każdej grze.

## Bull-off z tarczy

Gdy opcja bull-off to „Closest to bull” albo PDC, mecz zaczyna się od rzutów w bulla. Serwer liczy odległość od środka z coords Board Managera (1 = 170 mm, zewnętrzna krawędź double).

- Każdy rzuca jedną lotkę, w kolejności z setupu. Po każdej lotce takeout. Lotka rzucona przed takeoutem jest ignorowana.
- **Closest:** wygrywa najmniejsza odległość. Każdy, kto jest mniej niż 5 mm od lidera, remisuje z nim (próg `TIE_MM` w `games/bulloff.ts`). **PDC:** bez progu, remis to ta sama odległość albo to samo pole co lider (bull albo 25).
- Remis: rzucają ponownie tylko remisujący z liderem, w odwrotnej kolejności. Tak samo przy 3+ graczach. Dogrywka jest tylko o pierwsze miejsce, dalsze miejsca się nie dogrywają.
- Lotka poza tarczą liczy się po odległości. Lotka bez coords jest ostatnia. Niewykryta lotka: rzuca się jeszcze raz.
- **Kolejność gry** to ranking bull-offu, nie rotacja z setupu: zwycięzca, potem pozostali uczestnicy dogrywek (kto doszedł do późniejszej rundy, jest wyżej, a w tej samej rundzie decyduje odległość z niej), potem reszta według odległości z pierwszej rundy. Przy równej odległości albo bez coords decyduje kolejność z setupu, a lotka bez coords jest za wszystkimi z coords. Tak samo w PDC.
- W X01 zaczynający kolejny leg (i set) przesuwa się o jedno miejsce w kolejności gry. Minigierki, w których zaczynający przesuwa się co rundę (Knockout, Higher or Lower), też idą po kolejności gry.
- Kolejność wynika z logu meczu, więc Undo i Poprawka ją przywracają. Lista graczy na Ekranie wyników i na telefonie pokazuje graczy w kolejności gry.
- **Kolejność rzutów w bull-offie jest losowana** (od 2026-11-20): serwer przetasowuje graczy z lobby przy starcie meczu, a zapisany skład ma już tę kolejność, więc log i odtwarzanie są stałe. Rematch z bull-offem losuje od nowa. Bez bull-offu kolejność z lobby zostaje, także rotacja w Rematch. „Kolejność z setupu” w remisach i w „X starts” znaczy więc wylosowaną kolejność.
- Przy jednym graczu bull-offu nie ma, nawet gdy opcja jest włączona. Serwer zapisuje wtedy mecz z bull-offem „Off”.
- Undo zdejmuje ostatnią lotkę bull-offu. Przyciski „X starts” na Pilocie zostają jako ręczne nadpisanie: X zaczyna, a reszta idzie po kolejności z setupu.
- **Ekran** (kiosk): karta o stałej wysokości. U góry kicker „BULL-OFF”, w dogrywce „BULL-OFF · ROUND 2”. Z lewej tarcza 740 px przycięta do koła, z zoomem `R = clamp(1,1 × najdalsza lotka, 112, 185)` mm: ring trebli prawie na styk, a lotka za treblem oddala widok aż do całej tarczy. Kropki lotek z imionami (imiona nie nachodzą na siebie) i przerywany okrąg dla każdej lotki. Lider na pomarańczowo, remisujący na żółto.
- Z prawej status o stałej wysokości (2 linie nagłówka i podpis; długi tekst się zmniejsza, ale nie rozpycha karty): „X, throw at the bull”, „Take out the dart” z „X next”, „Too close: 3.0 mm” na żółto z „Ola and Ania throw again · take out the dart” (PDC: „Tie in the Bull”), w dogrywce podpis „Rethrow: Ania vs Ola were 3.0 mm apart”, po rozstrzygnięciu „X starts” na zielono z „Take out the dart”.
- Pod statusem lista rundy, zawsze od tej samej wysokości: miejsce, imię, pole i mm, od najbliższej. Ci, co jeszcze nie rzucali, mają „–” na dole, a rzucający ▶ i obwódkę (oprócz czasu takeoutu). W dogrywce odpadli z wcześniejszych rund są przygaszeni na dole z podpisem „round 1”. Po rozstrzygnięciu lista staje się kolejnością gry („PLAYING ORDER”, 1., 2., …). Pod listą przyciski „X starts” dla Pilota.
- Telefon: te same części jedna pod drugą (status, tarcza, lista, przyciski).
- Po rozstrzygnięciu pierwszy leg rusza po takeoucie.
- Lotki bull-offu są w logu meczu z coords, ale nie liczą się do statystyk.
- Działa we wszystkich grach (X01 i minigierki przez `games/turns.ts`).

## Panel tarczy

- Na telefonie jest osobnym ekranem, a na laptopie szufladą nad wynikiem. Zawartość jest ta sama.
- Status połączenia: adres, wersja Board Managera, czy trwa detekcja, ostatnie zdarzenie.
- Akcje:
  - Reset;
  - Start/stop detekcji;
  - Calibrate, z potwierdzeniem i informacją o około 60 s;
  - Restart Board Managera, z potwierdzeniem.
- Przycisk „LEDs to white”: ustawia oba ringi WLED na ciepłą biel (`WARM`) bez względu na przełącznik LEDs, gdy ledy utkną w innym kolorze. Bez adresu WLED serwer odpowiada „Set the WLED address first”. Kolejny stan bazowy albo Moment normalnie go nadpisze.
- Przełącznik „Fake board”: serwer uruchamia symulator Board Managera na `:3180` i łączy się z nim zamiast z prawdziwą tarczą, a przycisk „Open fake board” otwiera stronę do klikania lotek. Wyłączenie wraca do adresu z `config.json`. Wybór nie przetrwa restartu serwera.
- Ustawienia kamer i detekcji zostają w Board Managerze (`:3180`). Przycisk „Open Board Manager” otwiera jego stronę (`http://<adres tarczy>/`, od wersji 2.1.0) w nowej karcie. Przy Fake board go nie ma. Kiosk na laptopie nie pokazuje tego przycisku ani „Open fake board”, bo w trybie kiosku nie ma kart ani powrotu; otwiera się je z telefonu.
- **Test board** (od 2026-10-28): przycisk w panelu otwiera widok testu: na laptopie na cały ekran (tarcza po lewej, stan i zdarzenia po prawej, bez przewijania strony), na telefonie zamiast panelu. Widać w nim stan (połączenie, detekcja, takeout, czas od ostatniej ramki z Board Managera), te same przyciski co w panelu (Reset, Start/Stop detection, Calibrate, Restart, z tymi samymi potwierdzeniami), tarczę z kropkami lotek rzuconych w teście, listę ostatnich 30 zdarzeń z godziną i coords oraz zwijane „Raw” z ostatnią ramką JSON.
  - W trakcie testu lotki i takeouty nie trafiają do meczu. Koniec testu nie resetuje tarczy, a lotki wyciągnięte w teście się nie liczą.
  - Test kończy się przyciskiem „Done”, zamknięciem panelu albo sam po 10 minutach, żeby zapomniany test nie połykał lotek w meczu.
  - Serwer zawsze trzyma ostatnie 30 zdarzeń, więc po otwarciu testu widać też, co działo się przed chwilą. Błędy akcji (np. kalibracji) też trafiają do listy.

## Stany awaryjne

- **Brak tarczy:** oba ekrany pokazują baner „Brak tarczy, wpisuj rzuty ręcznie”, a Pilot przełącza się na klawiaturę z zakładki „All” jako główne wejście. Gdy tarcza wraca, baner znika.
- **Wznowienie po restarcie:** mecz wraca od razu na oba ekrany. Pilot pokazuje dyskretne „Mecz wznowiony” z opcją zakończenia.

## Zgłaszanie błędów

Błędy wychodzą w trakcie gry, a naprawiamy je hurtowo później, z Claude.

- „Report a bug” w menu otwiera dialog z polem opisu. Zgłosić może każdy: Pilot, widz na telefonie i kiosk.
- Serwer zapisuje zgłoszenie jako plik `bugs/<czas>.json`, pod gitem, tak samo jak `effects/`. W pracy robisz commit i push, a przy naprawie pull.
- Do opisu serwer dokleja: czas, commit aplikacji (z „-dirty”, gdy działały lokalne zmiany), urządzenie (nazwa, kiosk, Pilot), ekran, user agent i cały rekord trwającego meczu z logiem zdarzeń. Z logu da się odtworzyć mecz w teście.
- Naprawione zgłoszenie usuwa commit z poprawką. W `bugs/` leżą więc tylko otwarte, a historia zostaje w gicie.

## Poza zakresem

- Efekty, dźwięki, WLED, animacje i caller: [EFEKTY.md](EFEKTY.md). Paczka nagrań callera: [#5](https://github.com/jgoliszewski/ITDarts/issues/5).
- Minigierki, ich setup, „How to play” i Ekran rekordu: [GRY.md](GRY.md).
- Widok „Stats” i zapis wyników: [STATYSTYKI.md](STATYSTYKI.md). Ranking: [#6](https://github.com/jgoliszewski/ITDarts/issues/6).
