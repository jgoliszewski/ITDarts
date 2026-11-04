# ITDarts: UI i UX (etap 2)

Postanowienia z grillingu z 2026-10-25 ([#1](https://github.com/jgoliszewski/ITDarts/issues/1)). Pojęcia są zdefiniowane w [GLOSSARY.md](../GLOSSARY.md), a wizja systemu w [WIZJA.md](WIZJA.md).

Makiety: [ITDarts UI mockups](https://claude.ai/artifact/Bt8RmLqWv9733tb2nLkPQK) (canvas z 11 ekranami; poprawka lotki i tarcza są klikalne).

Wzorce podpatrzone w Scolii (wynik i poprawka lotki), HomeDarts (minimalizm), Autodarts (setup X01) i tools-for-autodarts (takeout na cały ekran).

## Ekrany i tryby

- **Domyślnie** wszystko działa na dotykowym laptopie przy tarczy. Laptop jest jednocześnie Ekranem wyników i Pilotem, a pasek Pilota jest zawsze widoczny pod wynikiem.
- **Tryb wynika z tego, kto ma Pilota.** Gdy telefon przejmie Pilota, laptop sam staje się czystym Ekranem wyników z dyskretnym „Take control”. Nie ma osobnego przełącznika trybów.
- **Telefon obsługuje wszystko.** Główny ekran może nie być dotykowy, więc każda akcja jest dostępna z Pilota na telefonie.
- **Jeden responsywny widok Pilota** dla laptopa i telefonu, projektowany najpierw pod telefon i dotyk.
- **Przejęcie Pilota** jest natychmiastowe, bez potwierdzenia. Poprzedni Pilot dostaje komunikat, kto przejął, i ten sam przycisk, żeby odebrać. Nazwę urządzenia (telefon, laptop) wyliczamy z przeglądarki.

## Styl

- Tylko angielski i tylko jeden ciemny motyw.
- Kolory ITBOOM: tło prawie czarne, karty w odcieniach szarości, pomarańcz `#F58224` jako jedyny akcent. Oznacza aktywnego gracza i główne akcje. Na pomarańczowym tle tekst jest czarny, bo biały ma za słaby kontrast.
- Kolory stanów: zielony dla „Ready”, bursztynowy dla takeoutu, czerwony dla bustu i restartu.
- Bez kolorów per gracz. Wracamy do nich, jeśli dojdzie tryb drużynowy.
- Czcionki: Barlow Condensed dla liczb, Inter dla reszty. Obie dołączone lokalnie, bo aplikacja działa offline.
- Duże cele dotykowe i przyciski w kształcie pigułki.

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

- **Kafelek gry w setupie:** ikona jest tłem w prawym dolnym rogu, 96 px, ucięta krawędzią o około 1/6. Mocniejsze ucięcie (1/4 i 1/2) odrzuciliśmy, bo ikony przestawały być rozpoznawalne. Ikony bez ucięcia (80 px) też, bo przy niskim kafelku wchodziła pod opis. Na zwykłym kafelku jest szara (`#3A3A40`), a na zaznaczonym przyciemnia pomarańcz. Tekst leży nad nią.
- **Małe ikony:** przed nazwą gry na chipach wyboru gry na `/stats` i w nagłówku Ekranu wyników, w kolorze tekstu obok. Pomarańcz zostaje tylko dla stanu „zaznaczone i aktywne”.
- **Bez ikon:** na karcie ostatniego meczu w lobby i w „How to play”, bo tam nazwa gry stoi dużym tekstem.

## Ekran wyników

- **Układ:** hero aktywnego gracza po lewej, lista wszystkich graczy po prawej. Działa dla 2–8 graczy bez zmiany układu.
- **Jeden układ dla wszystkich gier** (od 2026-11-01, z przeglądu zrzutów wszystkich gier w tych samych chwilach):
  - Duża liczba w hero ma ten sam rozmiar w X01 i minigierkach. Mniejsza jest tylko w grach z tarczą, bo dzieli hero z tarczą.
  - Kafelek lotki wszędzie pokazuje duże pole i małą wartość (T20 / 60), także w X01, i ma tę samą szerokość. W grach z tarczą kafelki leżą pod tarczą przez całą szerokość hero.
  - Prawa kolumna ma jedną szerokość (620), bez względu na grę i liczbę graczy. Wyjątkiem jest siatka Cricketa. Wiersze listy są pełnowymiarowe do 4 graczy, a kompaktowe od 5, też w minigierkach.
  - Pod listą minigierki mają kartę „IMIĘ · THIS MATCH” z liczbami aktywnego gracza, tymi samymi co w podsumowaniu (np. ATC: hit rate i lotki), do 4 graczy. Higher or Lower nie zbiera liczb, więc nie ma karty. W 121 pierwszym kafelkiem jest „Darts left” z lotkami do końca podejścia. Tekst w kafelkach statystyk jest wyśrodkowany, też w X01.
  - Zaliczone sektory na tarczy (ATC, Full Board) są zakreskowane o ok. 15% ciemniej niż żywe pola, żeby od razu odróżniały się od reszty tarczy.
- **Hero:** imię, wygrane legi, ogromny wynik i 3 kafelki lotek. Bez licznika „N darts left” (od 2026-10-30, kafelki to pokazują); w rogu zostają tylko „Bust”, „Checked out” i „Needs a double to start”. Puste miejsca są obrysowane.
- **Checkout:** gdy da się skończyć leg lotkami, które zostały w turze, obok wyniku jest ścieżka (np. „T19 · D12”). Gdy się nie da (bogey, za mało lotek, pudło w trakcie), jest „Setup”: lotki, które najlepiej ustawiają checkout pod następną turę (np. „T20 · S14”). Samo punktowanie w T20 daleko od końca nie ma podpowiedzi.
  - Przy double out trasy są z tabeli checkoutów PDC (41–170). Dopóki lotki trafiają w zaplanowaną trasę, podpowiedź ją kontynuuje (130: T20, dalej „T20 · D5”, a nie trasa z tabeli dla 70). Po zejściu z planu bierze trasę z tabeli dla nowego wyniku, jeśli mieści się w lotkach, które zostały.
  - Resztę (mniej lotek niż trasa z tabeli, wyniki do 40, Setup, single i master out) liczy optymalna strategia: każda lotka minimalizuje oczekiwaną liczbę lotek do końca legu przy modelu pudeł dobrego klubowego gracza (40% w treble i double; `games/x01/checkout.ts`, za Kohler 1982 i Haugh & Wang 2022). Bust cofa wynik do początku tury, więc strategia go unika.
  - W 121 na ostatniej turze próby nie ma „Setup”, bo cel i tak wraca do początku.
- **Drabinka celów w 121** (od 2026-10-30): taśma celów pod wynikiem z chorągiewką rekordu i odometr celu, opisane w [GRY.md](GRY.md#121).
- **Lista graczy:** stała kolejność rzucania. Aktywny gracz ma pomarańczowy wiersz. W wierszu: imię, legi, średnia z meczu i wynik.
- **Serca** (od 2026-10-30): życia w 121, Knockout i Killer to wszędzie konturowe serca, czerwone póki są, przygaszone po stracie. W tekstach (lista, telefon) znak ♡. Pełnych serc nie używamy.
- **Kropki legów** (od 2026-10-27, ze zgłoszenia o nieczytelnym wyniku): trochę większe niż na początku. Od 2026-10-30 jeszcze większe, a „avg” w wierszu ma większą czcionkę i jaśniejszy kolor, bo z daleka były słabo widoczne. W pomarańczowym wierszu aktywnego gracza niewygrany leg jest jaśniejszą kropką, żeby nie zlewał się z wygranym. Liczby setów i legów obok kropek próbowaliśmy i odrzuciliśmy.
- **Statystyki, do 4 graczy** (od 2026-10-28, ze zgłoszenia; wcześniej tylko przy 2):
  - karta z 6 ostatnimi wizytami aktywnego gracza;
  - karta z meczu: średnia z legu, średnia z meczu, najlepsza wizyta i liczniki 60+, 80+, 100+ (od 2026-10-27 zamiast 100+, 140+, 180, pod poziom biura).
  - Przy 3–4 graczach bez karty ostatnich wizyt. Przy 5+ graczach zostaje sama lista, w wersji kompaktowej. Bez first 9, checkout % i liczby lotek w legu. Szerszą listę przy 3–4 graczach (760) zdjęliśmy 2026-11-01, żeby kolumna miała tę samą szerokość we wszystkich grach.
- **Nagłówek:** gra i ustawienia (np. „X01 · 501 · Double out · First to 3 legs”), status tarczy, przycisk QR i menu.
- **Bust:** czerwony „BUST” w hero. Wynik wraca do stanu sprzed tury.
- **Efekty:** Ekran wyników ma warstwę na nakładki z animacjami. Animacje, dźwięki, ledy i caller są opisane w [EFEKTY.md](EFEKTY.md).

## Tura i takeout

- **Takeout** kończy turę automatycznie. Lotki, których brakuje do trzech, wpadają jako Miss.
- **Karta tury** (z testów 2026-10-26): gdy Tura się skończy (trzecia lotka, bust, checkout, utrata życia), ekran nie przeskakuje dalej, tylko od razu pokazuje kartę tury. Przy krótszej Turze karta pojawia się z początkiem takeoutu.
  - Na karcie jest tylko imię, duży werdykt i lotki (od 2026-11-01). Nad liczbą jest samo imię, bez „scored”. Werdykt to „CHECKOUT”, „BUST” (czerwony) albo zdarzenie gry, np. „LIFE LOST”. Bez werdyktu jest wynik tury: suma w X01, 121 i Higher or Lower, w Cricket liczba marków („4 MARKS”, od 2026-10-28, ze zgłoszenia: po poprawce S2 na T17 liczba trafień się nie zmieniała), a w pozostałych minigierkach liczba trafień („2 HITS”).
  - Karta i inne nakładki mieszczą się nad paskiem Pilota (od 2026-10-28, ze zgłoszenia: pasek „Removing darts” wystawał pod pasek).
  - Lotki to duże kafelki jak na ekranie gry (od 2026-10-27, ze zgłoszenia o nieczytelnej karcie), z polem na górze (np. „S7”). W grach liczonych trafieniami (ATC, Full Board, Cricket, Killer) kafelek jest zielony przy trafieniu i czerwony przy pudle (od 2026-10-27). W 121 i Higher or Lower lotka, która nic nie dała, jest wygaszona. Niedorzucone lotki to puste kafelki.
  - Bez kafelków ze stanem po Turze („Left”, „Target”, „Range” itd.) i bez notek gry pod lotkami (zdjęte 2026-11-01): nikt ich nie czytał, a hero pokazuje to samo po końcu takeoutu. Zostaje „Pull the darts” i pasek takeoutu.
  - Hero pod kartą trzyma stan z chwili końca Tury, np. w 121 nadal „Target 121”. Nowy cel, nowe życie i następny gracz pojawiają się dopiero po końcu takeoutu.
  - Checkout kończący leg X01 pokazuje od razu ekran końca legu, jak dotąd.
- W czasie takeoutu ekran jest przyszarzony. Pod kartą tury jest bursztynowy pasek „Removing darts” ze spinnerem i ostrzeżeniem, że rzuty przed „Ready” się nie liczą.
- **Koniec takeoutu** (sam albo przez „Takeout done”) gra krótki dźwięk zmiany gracza (arpeggio marimby) i dopiero wtedy przełącza na następnego gracza. Dźwięk opisuje [EFEKTY.md](EFEKTY.md#wbudowane-dźwięki).
- **Zacięty takeout:** Board Manager czasem nie zgłasza końca takeoutu i wtedy nie widzi nowych rzutów. Pilot ma w czasie takeoutu główny przycisk „Takeout done”. Wywołuje on Reset na Board Managerze i przechodzi do następnej tury. Po około 15 s ekran podpowiada „Board stuck? Use Takeout done on the pilot”.
- Lotki rzucone przed „Takeout done” nie istnieją dla systemu. Gracz dopisuje je przez „Add dart” albo rzuca jeszcze raz.

## Pilot w trakcie meczu

- **Pasek:** wskazówka, „Undo” i główny przycisk. Główny przycisk to „Next player”, w czasie takeoutu „Takeout done”, a po legu bez match mode „Next leg”.
- **Undo** cofa jedną lotkę. Gdy w turze nie ma lotek, cofa do poprzedniej tury z jej trzema lotkami.
- **Poprawka lotki:** stuknięcie w kafelek otwiera arkusz.
  - Zakładka „Nearby” to siatka 3×3: sąsiad z lewej, odczytane pole i sąsiad z prawej, w wierszach Double, Single i Triple. Pomyłkę o jedno pole poprawia jedno stuknięcie.
  - Zakładka „All” to przełącznik Single/Double/Triple i liczby 1–20.
  - Pod obiema zakładkami są Miss, 25 i Bull.
  - Na laptopie obok zakładek jest zawsze widoczna duża tarcza z pogrubionymi pierścieniami. Małe białe kropki bez numerów (od 2026-10-27) pokazują lotki: z coords Board Managera stoją tam, gdzie lotka się wbiła (chybienie przycięte do pierścienia numerów, z właściwej strony tarczy), bez coords (lotka wpisana ręcznie) w środku pola. Poprawiana lotka jest większa, z grubszym obrysem; przy „Add dart” nic nie jest wyróżnione. Przy implementacji zamiast trzeciej zakładki, bo na dużym ekranie mieści się obok.
  - Na laptopie lewa kolumna nie przewija się (od 2026-10-27): czerwony „Cancel” jest w nagłówku obok „read as”, podpowiedź o stuknięciu w tarczę jest jedną linią w dolnym marginesie okna, żeby tarcza miała całą wysokość, a klawisze zmniejszają się na niskich ekranach. Sprawdzone do 1280×720.
- Poprawić da się każdą lotkę w bieżącej turze, czyli przed takeoutem. Starsze tury tylko przez Undo.
- Wybór od razu podmienia rzut. Poprawiona lotka jest krótko podświetlona, także na Ekranie wyników.

## Wycofanie gracza

Z grillingu 2026-11-04. Pojęcia: Wycofanie z meczu i Wycofanie z legu ([GLOSSARY.md](../GLOSSARY.md)).

- **Gdzie:** tylko Pilot. Stuknięcie w wiersz gracza (lista na telefonie, lista na Ekranie wyników, gdy Pilotem jest laptop) otwiera okno na środku ekranu z imieniem (także na telefonie, decyzja z review 2026-11-04). W X01 są w nim „Remove from leg” i czerwony „Remove from match”, w minigierkach sam „Remove player”. Każdy przycisk pyta o potwierdzenie („Remove Ann from the match?”). Kto nie jest Pilotem, nic po stuknięciu nie dostaje.
- **Kiedy nie:** w trakcie bull-offu, i gdy w meczu (albo w legu) grałoby już tylko dwóch: wtedy jest „End match”, bez walkowera.
- **Wycofany z meczu:** zostaje na liście wyszarzony z „Left” i swoim wynikiem do tej chwili, kolejka go pomija do końca meczu, także w następnych legach i setach X01. Usunięty w trakcie swojej Tury kończy ją rzuconymi lotkami, gra idzie do następnego. Brakujących lotek nie dopisuje się jako pudła, więc średnia liczy tylko rzucone (decyzja z review 2026-11-04).
- **Wycofany z legu (X01):** wyszarzony z „Back next leg” do końca legu, leg liczy mu się jak przegrany. W następnym legu wraca na swoje miejsce w kolejności, także jako zaczynający, gdy wypada jego kolej.
- **Gry:** Killer, Knockout i Higher or Lower traktują wycofanego jak wyeliminowanego (z „Left” zamiast „Out”, bez Momentu), w Killerze jego numeru nikt już nie trafia, a runda Knockout w toku kończy się bez niego. W Cricketcie jego zamknięcia przestają blokować punkty, jego punkty zostają zamrożone. W Football piłka, którą miał, jest wolna. W Gotcha Tura przerwana wycofaniem zostawia mu punkty, ale nikogo nie zeruje. W Co-op drużyna gra dalej bez niego. W pozostałych grach jest po prostu pomijany.
- **Undo** cofa wycofanie, gdy to ostatnie zdarzenie. Wycofanie nie odpala Momentu, dźwięku ani ledów.
- **Statystyki:** lotki wycofanego z meczu liczą się do średnich i rekordów z Tur (X01), a jego wynik niedokończonej minigierki nie trafia do rekordów, ale mecz nie liczy mu się jako rozegrany, wygrany ani przegrany. W podsumowaniu stoi na końcu, wyszarzony z „Left”, bez miejsca. Rematch startuje bez niego. Wycofany z legu jest w meczu normalnie.

## Start i koniec meczu

- **Nowy mecz** to jeden ekran Pilota:
  - kafelki gier;
  - gracze z kolejnością (przeciąganie, „Shuffle”, ostatnio używani gracze jako duże przyciski, reszta graczy i „+ Guest” jako chipy; nowych graczy zakłada się tylko w „Players”). Od 2026-10-27 przyciski graczy są nad listą kolejności, więc dodawanie nie spycha ich w dół. Dodany gracz znika z przycisków, a pozostali przesuwają się na jego miejsce;
  - opcje gry z modułu i „Start match”.
  - Na laptopie (od 1100 px, od 2026-10-27) to trzy kolumny bez przewijania: gry, opcje, gracze z „Start match” pod nimi. Wiersze graczy i odstępy w opcjach są tam niższe, a przy setach „First to” i „Legs per set” stoją obok siebie, żeby 8 graczy i mecz na sety zmieściły się od 1280×720 (sprawdzone też przy 1513×690, czyli laptop ze skalowaniem 125%). Na telefonie jedna kolumna jak dotąd.
- **Opcje X01:**
  - start score: 201, 301 albo 501 (od 2026-10-27 zamiast 701);
  - check-in i check-out (w kolejności Single, Double, Master; domyślnie Double);
  - match mode: Off, Legs lub Sets, z „First to N”;
  - bull-off: Off, „Closest to bull” lub zasady PDC.
- **Gracze i goście:** opisani w [STATYSTYKI.md](STATYSTYKI.md).
- **Wspólny wygląd kart** (od 2026-11-01): koniec legu, koniec meczu i Ekran rekordu mają duży napis nad zwycięzcą, duże imię i duże kafelki z liczbami. Pod kafelkami nie ma linijek tekstu („Legs so far”, „Next leg starts after the takeout”, „The summary opens from the pilot”, „Game on in a moment”): co dalej, mówi pasek Pilota.
- **Koniec legu:** ekran ze zwycięzcą, checkoutem, liczbą lotek i średnią z legu.
  - W match mode trzyma się do końca takeoutu, potem następny leg startuje sam.
  - Bez match mode czeka na „Next leg” albo „End match”.
- **Koniec meczu:** karta wygranej („WINNER” we wszystkich grach, w minigierkach też „SHARED WIN” albo „GAME OVER”; od 2026-11-01 zamiast „MATCH WON” w X01) pokazuje zwycięzcę i kafelki: w X01 legi, średnią i checkout, w minigierkach wynik gry i liczby zwycięzcy z podsumowania. Status tarczy w nagłówku to wtedy „Game over” w każdej grze. Karta ma na Pilocie jeden przycisk „Summary”, który zapisuje mecz i otwiera [podsumowanie](#podsumowanie-meczu). „End match” ze „Save to stats” i zwykłe zakończenie po legu bez match mode też prowadzą do podsumowania, „Discard” prosto do lobby.

## Podsumowanie meczu

Postanowienia z grillingu z 2026-10-28 (zgłoszenia: heatmapa, porównanie graczy, distance walked).

- Pełny ekran zamiast lobby na dużym ekranie i w telefonach, aż Pilot wybierze „Rematch” (z bull-offem w opcjach zaczyna się od nowego bull-offu w kolejności z setupu, bez bull-offu zaczyna następny w kolejności z setupu), „New match” albo „Back to lobby”. Bez kontroli widać podsumowanie bez przycisków. Serwer trzyma je w pamięci, restart wraca do lobby.
- Od góry:
  - nagłówek: „MATCH WON” i zwycięzca z wynikiem w legach albo setach, w minigrach wynik gry, a po przerwaniu „MATCH ENDED”;
  - porównanie w stylu Autodarts: przy dwóch graczach nazwa statystyki pośrodku, wartości po bokach, a pod nimi paski od środka na zewnątrz w kolorach graczy, długie według udziału w sumie (przy „lower” według odwrotności). Najlepsza wartość jest w pigułce koloru gracza. Przy 3–4 graczach każdy ma kolumnę z wartością i paskiem. Szerokość jest ograniczona (560 px przy dwóch), żeby liczby były blisko siebie. X01: średnia, pierwsze 9, checkout %, najwyższy checkout, najkrótszy leg, 60+, 80+, 100+, lotki. Minigry: liczby z modułu gry, jak w profilu na `/stats`. Ostatni wiersz to „Distance walked” w metrach;
  - [heatmapa](#heatmapa) graczy z tego meczu.
- Goście mają pełną kolumnę i heatmapę, bo podsumowanie liczy się z meczu, a nie z historii.
- Na telefonie heatmapa jest pod porównaniem, a przyciski są przypięte na dole.
- **Kolory graczy** według miejsca w meczu albo w porównaniu: 1 różowy, 2 turkusowy, 3 pomarańczowy, 4 zielony, dalej od nowa. Profil gracza ich nie zapisuje.

## Heatmapa

- Tarcza jak wszystkie inne w aplikacji (ta z ATC i Full Board, od 2026-10-28). Plamki jak w Autodarts: pojedyncza lotka zielonożółta z niebieską poświatą, a nakładające się przechodzą w żółć i czerwień. Coords są przeliczane pierścień po pierścieniu na poszerzone pola tej tarczy.
- Rysuje tylko lotki z coords; lotki poprawione albo dopisane ręcznie po prostu nie występują. Bez żadnych coords zamiast tarczy jest „No positions recorded”. Lotek z bull-offu nie ma.
- **Dwóch graczy:** jedna tarcza z pionową linią, którą przeciąga się palcem albo myszą. Na lewo od linii są lotki pierwszego gracza, na prawo drugiego, a przy linii u góry wiszą ich imiona w ich kolorach. Przy 3–4 graczach nad tarczą, wyśrodkowane, są dwa pola wyboru, domyślnie dwaj pierwsi.
- **Jeden gracz** (solo, profil gracza): tarcza bez linii.

## Lobby i QR

- Bez meczu Ekran wyników pokazuje lobby:
  - duży QR z adresem laptopa;
  - wynik ostatniego meczu;
  - „New match here” i „Rematch” dla dotykowego ekranu.
- Po starcie aplikacji QR jest widoczny od razu, żeby telefon mógł przejąć Pilota.
- W trakcie meczu QR jest ukryty pod przyciskiem w nagłówku.

## Menu Pilota

Menu ma tylko to, czego nie ma pod osobnym przyciskiem. Board panel otwiera ikona tarczy w nagłówku obok QR (na telefonie: status tarczy w nagłówku). New match to przycisk na ekranie głównym, a Players, Stats i Effects są w rzędzie na górze ekranu głównego (kiosk: nad ostatnim meczem po prawej, telefon Pilota: pod nagłówkiem).

- **W trakcie meczu:** How to play i End match, z potwierdzeniem. W trakcie legu End match pyta też, czy zapisać mecz do statystyk („Save” albo „Discard”).
- **Bez meczu:** Close app, czyli wyjście z kiosku, z potwierdzeniem. Tylko na laptopie przy tarczy.
- **Na telefonie** dochodzi Show QR, bo nagłówek telefonu nie ma przycisku QR.
- **Bez kontroli:** Take control i Stats.
- **Report a bug:** w każdym menu, także bez kontroli ([Zgłaszanie błędów](#zgłaszanie-błędów)).
- **Efekty:** w menu meczu i ogólnym są przełączniki Sounds, Caller i LEDs. W każdym menu, także bez kontroli, jest wejście „Effects” na stronę `/effects` ([EFEKTY.md](EFEKTY.md)). Układ strony z zakładkami opisuje [EFEKTY.md](EFEKTY.md#układ-strony), a makiety to A1–A4 i C.

## Players

- Lista graczy z polem „New player name”. Archiwalni są pod „Show archived”.
- Wejście w gracza pokazuje jego statystyki, te same co `/stats/:id` (wybór gry i okresu), a pod nimi „Manage”: zmiana imienia, scalanie, archiwizacja i anonimizacja.

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
