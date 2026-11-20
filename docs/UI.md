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
- Kolory ITBOOM: tło prawie czarne, karty w odcieniach szarości, pomarańcz `#F58224` jako jedyny akcent (od 2026-11-18 według zasady „pomarańcz = teraz i główne”). Oznacza **aktywnego gracza** (wiersz, hero), **główną akcję**, **sumę Tury** (karta Tury, „THIS TURN” w hero, telefon) oraz na `/stats` główną metrykę, #1 w rekordach i zaznaczony kafelek gry. Poza tym pomarańcz zostaje tylko tam, gdzie oznacza rekord albo punkt odniesienia: „read as T20” w Poprawce (audyt A#12), Ekran rekordu, chorągiewka „Best” na drabince 121 i plakietka „NEW RECORD”. Po review brancha (2026-11-18) zeszły do neutralnych kolorów: kicker „READY FOR THE NEXT ONE” i wynik zwycięzcy ostatniego meczu w lobby i na telefonie (biały), zaznaczona pozycja Dropdown na `/stats` i w Compare (jak zaznaczony segment: białe tło, czarny tekst), How to play (kicker i nagłówki szare, wybrana opcja jak zaznaczony segment) i numery kolejności rzucania w Setup (szare). Na pomarańczowym tle tekst jest czarny, bo biały ma za słaby kontrast.
- **Kafelki lotek** (D1, od 2026-11-18): w grach liczonych punktami neutralne (szare tło, jasny tekst, pomarańcz tylko dla sumy Tury): X01 oraz 121, Random Checkouts, Gotcha, Knockout, Free throw i Higher or Lower. Lotka, która nic nie dała (w 121 i podobnych, w X01 przy double in przed otwierającym double), jest wygaszona. W grach liczonych trafieniami (ATC, Full Board, Cricket, Killer, Shanghai, Football) zielone przy trafieniu i czerwone przy pudle. W Bullseye według punktów lotki: zielone dla zysku, czerwone dla −1, wygaszone dla 0. Telefon koloruje tak samo jak Ekran wyników (`dartTone` w `web/src/match.ts`).
- Kolory stanów: zielony dla „Ready” i trafienia, bursztynowy dla takeoutu, czerwony dla bustu, pudła, życia i restartu.
- **Kolory per gracz** tylko w podsumowaniu meczu i Compare ([Podsumowanie meczu](#podsumowanie-meczu)). Gdzie indziej ich nie ma. Wracamy do nich szerzej, jeśli dojdzie tryb drużynowy.
- **Dane na `/stats` bez pomarańczu** (D3, od 2026-11-18): linia wykresu i paski double są w kolorze drugiego poziomu tekstu, a obie liczby head-to-head w kolorze tekstu.
- Czcionki: Barlow Condensed dla liczb, Inter dla reszty. Obie dołączone lokalnie, bo aplikacja działa offline.
- **Dotyk przed myszą** (od 2026-11-18): reakcją na stuknięcie jest stan wciśnięcia (lekkie zmniejszenie, wiersze graczy przygaszone), a nie hover. Hover działa tylko przy myszy (`(hover: hover) and (pointer: fine)`).
- **Długie imiona** (od 2026-11-18) nie wychodzą poza swoje pole: w Summary nagłówki kolumn i tytuł zwycięzcy łamią się w środku słowa, karta gracza na `/stats` zawija imię, nagłówek profilu, nagłówek ekranu na telefonie i Players kończą się wielokropkiem (pełne imię w dymku), plakietka imienia na linii heatmapy pokazuje najwyżej 11 znaków z wielokropkiem, a w grach z sercami imię w hero kończy się przed sercami. Lista rekordów w lobby wygasza dół, gdy jest dłuższa niż karta.
- **Cele dotykowe i tekst:** każdy element do stukania ma co najmniej 44 × 44 px, także na kiosku przy 1280×720 (na laptopie chipy w Setupie zostają 40 px, więc pomiar je tam pomija). Tekst na kiosku nie schodzi poniżej 16 px. Przyciski mają kształt pigułki.

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
- **`prefers-reduced-motion`:** zostaje przezroczystość i kolor, znika przesunięcie, skalowanie i ruch ciągły. Dotyczy też **Momentów** ([EFEKTY.md](EFEKTY.md#animacje-na-ekranie-wyników)): sam CSS, bez zmian przy zwykłych ustawieniach.

## Ekran wyników

- **Układ:** hero aktywnego gracza po lewej, lista wszystkich graczy po prawej. Działa dla 2–8 graczy bez zmiany układu.
- **Jeden układ dla wszystkich gier** (od 2026-11-01, z przeglądu zrzutów wszystkich gier w tych samych chwilach):
  - Duża liczba w hero ma ten sam rozmiar w X01 i minigierkach. Mniejsza jest tylko w grach z tarczą, bo dzieli hero z tarczą.
  - Kafelek lotki wszędzie pokazuje duże pole i małą wartość (T20 / 60), także w X01, i ma tę samą szerokość. W grach z tarczą kafelki leżą pod tarczą przez całą szerokość hero. Kolory kafelków: [Styl](#styl) (D1).
  - Prawa kolumna ma jedną szerokość (620), bez względu na grę i liczbę graczy. Wyjątkiem jest siatka Cricketa. Wiersze listy są pełnowymiarowe do 4 graczy, a kompaktowe od 5, też w minigierkach.
  - Pod listą minigierki mają kartę „IMIĘ · THIS MATCH” z liczbami aktywnego gracza, tymi samymi co w podsumowaniu (np. ATC: hit rate i lotki), do 4 graczy. Higher or Lower nie ma liczb na karcie („Visits survived” jest tylko na `/stats`). W 121 pierwszym kafelkiem jest „Darts left” z lotkami do końca podejścia. Tekst w kafelkach statystyk jest wyśrodkowany, też w X01.
  - Zaliczone sektory na tarczy (ATC, Full Board) są zakreskowane o ok. 15% ciemniej niż żywe pola, żeby od razu odróżniały się od reszty tarczy.
- **Hero:** imię, wygrane legi, ogromny wynik i 3 kafelki lotek. Bez licznika „N darts left” (od 2026-10-30, kafelki to pokazują). Puste miejsca są obrysowane.
- **Hero X01, wariant D** (od 2026-11-18, po prototypie; hybryda wariantów A i C):
  - imię ma 64 u, kropki legów 26 u;
  - **prawa połowa hero** jest oddzielona linią. U góry duża suma „THIS TURN” (pomarańczowa, szara przy 0), pod nią checkout albo „Setup” (trasa do trzech lotek), albo przy buście duże czerwone „BUST”. Suma nie stoi już w rzędzie lotek;
  - **pigułka w rogu hero** jest tylko dla „Checked out” (zielona) i „Needs a double to start” (bursztynowa, przy double in, dopóki gracz się nie otworzył). Bust ma swoje „BUST” przy wyniku, bez pigułki;
  - lotki rzucone przed otwierającym double są wygaszone w hero i na karcie Tury (logika `x01Dead` w `web/src/match.ts`); przy straight in nic się nie gasi;
  - „+ Add” (dopisanie lotki) jest nieaktywne po Buście.
- **Minigierki z panelem Tury:** ten sam wzór prawej połowy hero (duża suma „THIS TURN”, pod nią główna informacja tury) mają 121, Random Checkouts, Gotcha i Knockout (`turnPanel` w `web/src/match.ts`). W 121 panel jest węższy, bo po prawej stoi drabinka celów.
  - **Knockout:** duża liczba w hero po lewej to „To beat” (zielona, gdy ktoś jest już pobity), a „THIS TURN” stoi w panelu po prawej, jak w X01 i Gotcha. Na starcie rundy po lewej jest „First to throw” bez liczby, a w panelu szare „THIS TURN 0”.
  - **Bez panelu:** Higher or Lower (skala 0–180 z pinezką już pokazuje sumę Tury, a pod nią jest legenda zakresu, w którym traci się życie, np. „Lose a life inside 26–81”), Killer (własny hero: numer i kicker „KILLER” na czerwono, serca w hero i na liście, a lotki są tam trafieniami, więc suma Tury nic nie znaczy), Shanghai i Free throw (hero z tarczą zajmuje prawą połowę; w Free throw suma Tury jest główną liczbą hero, „This visit”) i pozostałe gry z tarczą.
- **Cricket:** do 4 graczy kolumny siatki mają pełne imiona (zwykle gramy maksymalnie w czterech). Od 5 graczy (od 2026-11-18, przy 8 graczach imiona się nie mieściły) kolumna ma numer miejsca, dwie litery imienia (gość: pierwsza litera i numer, np. „G2”) i wynik, a w hero stoi legenda „numer → imię” z aktywnym graczem w pomarańczu. Inicjały mogą się powtórzyć (Anna i Andrzej to „AN”), więc rozstrzyga numer (`initials` w `web/src/match.ts`).
- **Tarcza w hero** (ATC, Full Board, Free throw, Football, Bullseye, Shanghai i od 2026-11-20 Cricket z Sectors: Random) mieści się w kolumnie do 620 u i jest zawsze kwadratem w granicach hero. W Cricket Random cała tarcza ma normalne kolory, a sektory w grze i bull mają nieruchomy obrys (bez `tb-march`); sektor zamknięty u wszystkich traci obrys.
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
- **Gry:** Killer, Knockout i Higher or Lower traktują wycofanego jak wyeliminowanego (z „Left” zamiast „Out”, bez Momentu), w Killerze jego numeru nikt już nie trafia, a runda Knockout w toku kończy się bez niego. W Cricketcie jego zamknięcia przestają blokować punkty, jego punkty zostają zamrożone. W Football piłka, którą miał, jest wolna. W Gotcha Tura przerwana wycofaniem zostawia mu punkty, ale nikogo nie zeruje. W Co-op drużyna gra dalej bez niego. W pozostałych grach jest po prostu pomijany.
- **Undo** cofa wycofanie, gdy to ostatnie zdarzenie. Wycofanie nie odpala Momentu, dźwięku ani ledów.
- **Statystyki:** lotki wycofanego z meczu liczą się do średnich i rekordów z Tur (X01), a jego wynik niedokończonej minigierki nie trafia do rekordów, ale mecz nie liczy mu się jako rozegrany, wygrany ani przegrany. W podsumowaniu stoi na końcu, wyszarzony z „Left”, bez miejsca. Rematch startuje bez niego. Wycofany z legu jest w meczu normalnie.

## Start i koniec meczu

- **Nowy mecz** to jeden ekran Pilota:
  - kafelki gier;
  - gracze z kolejnością (przeciąganie, „Shuffle”, ostatnio używani gracze jako duże przyciski, reszta graczy i „+ Guest” jako chipy; nowych graczy zakłada się tylko w „Players”). Od 2026-10-27 przyciski graczy są nad listą kolejności, więc dodawanie nie spycha ich w dół. Dodany gracz znika z przycisków, a pozostali przesuwają się na jego miejsce;
  - opcje gry z modułu i przycisk startu.
  - **Przycisk startu** mówi, co wystartuje (od 2026-11-18): „Start · Killer · 2 players” (`startLabel` w `web/src/match.ts`, przy jednym graczu „1 player”). Gdy start jest zablokowany (np. Free throw dla 2 graczy), powód stoi w samym przycisku („Free throw is for 1 player”), w kolorach przycisku nieaktywnego.
  - **Telefon i wąskie okna** (poniżej 1100 px, od 2026-11-18): jedna kolumna, w kolejności **gra, gracze, opcje, Start** (D5; ta sama kolejność w DOM, więc Tab idzie za obrazem). Kafelki gier są kompaktowe (D4): bez opisu, nazwa, liczba graczy i ikona 64 px, 3 kolumny, około 64 px wysokości (dwuwyrazowe nazwy łamią się na dwie linie i kafelek ma wtedy do 80 px). Opis wybranej gry stoi w sekcji opcji, obok „How to play”. Wybrana gra przewija się do widoku przy wejściu na ekran.
  - **Laptop** (od 1100 px, od 2026-10-27) to trzy kolumny bez przewijania: gry, opcje, gracze z przyciskiem startu pod nimi (kolejność Tab jak kolumn, od lewej). Kafelki gier mają tam opisy. Wiersze graczy (44 px) i odstępy w opcjach są niższe, a przy setach „First to” i „Legs per set” stoją obok siebie, żeby 8 graczy i mecz na sety zmieściły się od 1280×720 (sprawdzone też przy 1513×690, czyli laptop ze skalowaniem 125%; pomiar 1–8 graczy, z 0 i 4 zarejestrowanymi poza składem). Żeby lista kolejności zawsze była w widoku (od 2026-11-18):
    - wszystkie przyciski dodawania (ostatni gracze, pozostali i „+ Guest”) są mniejsze (40 px) i stoją w jednym rzędzie przewijanym w poziomie, a „+ Guest” jest przyklejony do prawej krawędzi rzędu (ucięty przycisk obok podpowiada przewijanie). Kółko myszy nad rzędem przewija go w bok, aż dojdzie do końca, i dopiero potem przewija się strona;
    - przy 8 graczach, czyli pełnym składzie, przycisków dodawania nie ma, jest linia „8 players, the most a match takes”.
  - **Lista kolejności:** uchwyt przeciągania ma 44 × 44 px, a strzałki ↑ i ↓ na uchwycie przesuwają wiersz. Nowy wiersz wchodzi krótko (z lekkim przesunięciem z góry), usunięcie jest natychmiastowe; przy reduced motion wiersz tylko się rozjaśnia. Pusta lista pokazuje „Tap a player above to add”. „How to play” jest przyciskiem bez akcentu (obrys), żeby pomarańcz został dla startu.
- **Opcje X01:**
  - start score: 201, 301 albo 501 (od 2026-10-27 zamiast 701);
  - check-in i check-out (w kolejności Single, Double, Master; domyślnie Double);
  - match mode: Off, Legs lub Sets, z „First to N”;
  - bull-off: Off, „Closest to bull” lub zasady PDC.
- **Gracze i goście:** opisani w [STATYSTYKI.md](STATYSTYKI.md).
- **Wspólny wygląd kart** (od 2026-11-01): koniec legu, koniec meczu i Ekran rekordu mają duży napis nad zwycięzcą, duże imię i duże kafelki z liczbami. Pod kafelkami nie ma linijek tekstu („Legs so far”, „Next leg starts after the takeout”, „The summary opens from the pilot”, „Game on in a moment”): co dalej, mówią przyciski Pilota.
- **Koniec legu:** ekran ze zwycięzcą, checkoutem, liczbą lotek i średnią z legu.
  - W match mode trzyma się do końca takeoutu, potem następny leg startuje sam.
  - Bez match mode czeka na „Next leg” albo „End match”.
- **Koniec meczu:** karta wygranej („WINNER” we wszystkich grach, w minigierkach też „SHARED WIN” albo „GAME OVER”; od 2026-11-01 zamiast „MATCH WON” w X01) pokazuje zwycięzcę i kafelki: w X01 legi, średnią i checkout, w minigierkach wynik gry i liczby zwycięzcy z podsumowania. Status tarczy w nagłówku to wtedy „Game over” w każdej grze. Karta ma na Pilocie jeden przycisk „Summary”, który zapisuje mecz i otwiera [podsumowanie](#podsumowanie-meczu). „End match” ze „Save to stats” i zwykłe zakończenie po legu bez match mode też prowadzą do podsumowania, „Discard” prosto do lobby.

## Podsumowanie meczu

Postanowienia z grillingu z 2026-10-28 (zgłoszenia: heatmapa, porównanie graczy, distance walked).

- **Skala na TV** (od 2026-11-18): na dużym ekranie podsumowanie jest w jednostkach `u` jak Ekran wyników (wartości 44 u, etykiety 24 u, imiona 28 u), więc czyta się je z oche i mieści się bez przewijania od 1280×720 do 1920×1080 (pomiar przy 2 i 4 graczach i w Free throw solo). Przy 3 i więcej graczach etykieta statystyki stoi w wierszu, a kolumny graczy obok niej.
- Pełny ekran zamiast lobby na dużym ekranie i w telefonach, aż Pilot wybierze „Rematch” (z bull-offem w opcjach zaczyna się od nowego bull-offu w kolejności z setupu, bez bull-offu zaczyna następny w kolejności z setupu), „New match” albo „Back to lobby”. Bez kontroli widać podsumowanie bez przycisków. Serwer trzyma je w pamięci, restart wraca do lobby.
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

- Bez meczu Ekran wyników pokazuje lobby (od 2026-11-16 bez QR):
  - po lewej „READY FOR THE NEXT ONE” albo „NO MATCH YET”, „Game on?”, duży „New match” i pod nim „Rematch …”, gdy jest ostatni mecz. Przycisk to „Rematch Ann vs Bob” do trzech graczy, a od czterech „Rematch · 4 players” (od 2026-11-18);
  - po prawej Players, Stats, Effects, wynik ostatniego meczu i pod nim **Office records** (D6, od 2026-11-18). Solo pokazuje się w ostatnim meczu jak wygrana.
- **Office records** to rekordy biura minigierek (decyzja użytkownika, 2026-11-18): jeden kafelek na wariant gry z rekordem, z ikoną gry, wariantem (np. „ATC · Any · Skips · Clockwise”), wartością oraz kto i kiedy ją ustanowił. Kafelki są po dwa w rzędzie, w kolejności grup gier, a w grupie alfabetycznie po etykiecie. W ATC etykieta kończy się Order meczu rekordu (1–20, Clockwise albo Random), bo Order nie należy do wariantu rekordu, a stuknięcie i tak otwiera grę z tym Order (`extra` w `RecordDef`, `games/turns.ts`).
  - **Stuknięcie w kafelek** otwiera „New match” z tą grą i opcjami meczu rekordu, żeby spróbować go pobić. Lobby odbiera przy tym Pilota po cichu, jak „New match”. Gra i opcje obowiązują tylko, dopóki Setup jest otwarty; po wyjściu z niego następny „New match” otwiera ostatnią grę, jak zwykle. Rekord co-op otwiera Setup z opcją co-op, ale bez graczy.
  - **Bez rekordów** jest jeden kafelek „No records yet · Play a minigame to set one”. Gdy wariantów jest za dużo, lista przewija się w karcie (strona nie przewija się nigdy).
  - Dane z `GET /api/lobby/records` (`Stats.lobbyRecords()` w `server/stats.ts`), pobierane przy wejściu do lobby i po zmianie ostatniego meczu, a nie ze stanu huba. Rekordy X01 nie ma tu: X01 nie ma Ekranu rekordu ([STATYSTYKI.md](STATYSTYKI.md#rekordy-biura-x01)).
  - Przy 5 i więcej graczach w ostatnim meczu jego wiersze są kompaktowe, żeby rekordy zmieściły się pod kartą.
- „New match”, „Rematch”, Players i kafelki rekordów po cichu odbierają Pilota, gdyby miał go telefon.
- **Telefon-Pilot** ma ekran startu (PhoneHome) z tymi samymi słowami co lobby („Ready for the next one” albo „No match yet”, „Game on?”, „Rematch …”), z tym samym ostatnim meczem (solo jako wygrana) i z tymi samymi kafelkami rekordów pod nim. Stuknięcie w rekord otwiera „New match” tak samo jak na kiosku. Długa lista rekordów spycha „Game on?” w dół, ale przyciski są przyklejone do dołu.
- **Obrót tarczy:** raz w miesiącu lobby pokazuje żółty baner „Rotate the board 3 sectors” z przyciskiem „Done” (spready zużywają się nierówno). Baner jest, gdy obrotu jeszcze nie zapisano albo minęło 30 dni lub więcej. „Done” zapisuje datę na serwerze (`boardRotatedAt` w `settings`) i liczenie zaczyna się od nowa. Tylko w lobby: nie w meczu i nie na telefonie. Stan liczy się przy każdej zmianie stanu, więc serwer bez ruchu przez wiele dni pokaże baner dopiero po następnej zmianie.
- Nakładka QR („Scan to take control”) zostaje tylko na „Show QR” z telefonu-Pilota.

## Menu Pilota

Menu jest oknem dialogowym (`role="dialog"`, od 2026-11-18): fokus startuje na „How to play”, Esc je zamyka i oddaje fokus przyciskowi „Menu”, a Tab krąży po jego pozycjach. Ma tylko to, czego nie ma pod osobnym przyciskiem. Board panel otwiera ikona tarczy w nagłówku (na telefonie: status tarczy w nagłówku). New match to przycisk na ekranie głównym, a Players, Stats i Effects są w rzędzie na górze ekranu głównego (kiosk: nad ostatnim meczem po prawej, telefon Pilota: pod nagłówkiem).

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
