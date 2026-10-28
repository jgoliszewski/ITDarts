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

## Ekran wyników

- **Układ:** hero aktywnego gracza po lewej, lista wszystkich graczy po prawej. Działa dla 2–8 graczy bez zmiany układu.
- **Hero:** imię, wygrane legi, ogromny wynik, liczba lotek do końca tury i 3 kafelki lotek. Kafelek pokazuje dużą wartość i mały segment (60 / T20). Puste miejsca są obrysowane.
- **Checkout:** gdy da się skończyć leg lotkami, które zostały w turze, obok wyniku jest ścieżka (np. „T19 · D12”). Gdy się nie da (bogey, za mało lotek, pudło w trakcie), jest „Setup”: lotki, które najlepiej ustawiają checkout pod następną turę (np. „T20 · S14”). Samo punktowanie w T20 daleko od końca nie ma podpowiedzi.
  - Przy double out trasy są z tabeli checkoutów PDC (41–170). Dopóki lotki trafiają w zaplanowaną trasę, podpowiedź ją kontynuuje (130: T20, dalej „T20 · D5”, a nie trasa z tabeli dla 70). Po zejściu z planu bierze trasę z tabeli dla nowego wyniku, jeśli mieści się w lotkach, które zostały.
  - Resztę (mniej lotek niż trasa z tabeli, wyniki do 40, Setup, single i master out) liczy optymalna strategia: każda lotka minimalizuje oczekiwaną liczbę lotek do końca legu przy modelu pudeł dobrego klubowego gracza (40% w treble i double; `games/x01/checkout.ts`, za Kohler 1982 i Haugh & Wang 2022). Bust cofa wynik do początku tury, więc strategia go unika.
  - W 121 na ostatniej turze próby nie ma „Setup”, bo cel i tak wraca do początku.
- **Lista graczy:** stała kolejność rzucania. Aktywny gracz ma pomarańczowy wiersz. W wierszu: imię, legi, średnia z meczu i wynik.
- **Kropki legów** (od 2026-10-27, ze zgłoszenia o nieczytelnym wyniku): trochę większe niż na początku. W pomarańczowym wierszu aktywnego gracza niewygrany leg jest jaśniejszą kropką, żeby nie zlewał się z wygranym. Liczby setów i legów obok kropek próbowaliśmy i odrzuciliśmy.
- **Statystyki, tylko przy 2 graczach:**
  - karta z 6 ostatnimi wizytami aktywnego gracza;
  - karta z meczu: średnia z legu, średnia z meczu, najlepsza wizyta i liczniki 60+, 80+, 100+ (od 2026-10-27 zamiast 100+, 140+, 180, pod poziom biura).
  - Przy 3+ graczach zostaje sama lista. Bez first 9, checkout % i liczby lotek w legu.
- **Nagłówek:** gra i ustawienia (np. „X01 · 501 · Double out · First to 3 legs”), status tarczy, przycisk QR i menu.
- **Bust:** czerwony „BUST” w hero. Wynik wraca do stanu sprzed tury.
- **Efekty:** Ekran wyników ma warstwę na nakładki z animacjami. Animacje, dźwięki, ledy i caller są opisane w [EFEKTY.md](EFEKTY.md).

## Tura i takeout

- **Takeout** kończy turę automatycznie. Lotki, których brakuje do trzech, wpadają jako Miss.
- **Karta tury** (z testów 2026-10-26): gdy Tura się skończy (trzecia lotka, bust, checkout, utrata życia), ekran nie przeskakuje dalej, tylko od razu pokazuje kartę tury. Przy krótszej Turze karta pojawia się z początkiem takeoutu.
  - Na karcie: imię, duży werdykt i lotki. Werdykt to „CHECKOUT”, „BUST” (czerwony) albo zdarzenie gry, np. „LIFE LOST”. Bez werdyktu jest wynik tury: suma w X01, 121 i Higher or Lower, a w pozostałych minigierkach liczba trafień („2 HITS”).
  - Lotki to duże kafelki jak na ekranie gry (od 2026-10-27, ze zgłoszenia o nieczytelnej karcie). W minigierkach na górze jest pole (np. „S7”). W grach liczonych trafieniami (ATC, Full Board, Cricket, Killer) kafelek jest zielony przy trafieniu i czerwony przy pudle (od 2026-10-27). W 121 i Higher or Lower lotka, która nic nie dała, jest wygaszona. Niedorzucone lotki to puste kafelki.
  - Pod lotkami są kafelki ze stanem po Turze: X01 „Left”, 121 „Target”, „Left” i „Darts in attempt”, Higher or Lower „Range”, reszta minigierek to samo co hero (np. „Target 7”) i jego notka (np. „2 / 21 · 3 darts”).
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
  - Na laptopie obok zakładek jest zawsze widoczna duża tarcza z pogrubionymi pierścieniami. Małe białe kropki bez numerów (od 2026-10-27) pokazują, gdzie system odczytał lotki. Przy implementacji zamiast trzeciej zakładki, bo na dużym ekranie mieści się obok.
  - Na laptopie lewa kolumna nie przewija się (od 2026-10-27): czerwony „Cancel” jest w nagłówku obok „read as”, podpowiedź o stuknięciu w tarczę jest jedną linią w dolnym marginesie okna, żeby tarcza miała całą wysokość, a klawisze zmniejszają się na niskich ekranach. Sprawdzone do 1280×720.
- Poprawić da się każdą lotkę w bieżącej turze, czyli przed takeoutem. Starsze tury tylko przez Undo.
- Wybór od razu podmienia rzut. Poprawiona lotka jest krótko podświetlona, także na Ekranie wyników.

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
- **Koniec legu:** ekran ze zwycięzcą, checkoutem, liczbą lotek i średnią z legu.
  - W match mode trzyma się do końca takeoutu, potem następny leg startuje sam.
  - Bez match mode czeka na „Next leg” albo „End match”.
- **Koniec meczu:** karta wygranej („MATCH WON”, w minigrach „WINNER” albo „GAME OVER”) ma na Pilocie jeden przycisk „Summary”, który zapisuje mecz i otwiera [podsumowanie](#podsumowanie-meczu). „End match” ze „Save to stats” i zwykłe zakończenie po legu bez match mode też prowadzą do podsumowania, „Discard” prosto do lobby.

## Podsumowanie meczu

Postanowienia z grillingu z 2026-10-28 (zgłoszenia: heatmapa, porównanie graczy, distance walked).

- Pełny ekran zamiast lobby na dużym ekranie i w telefonach, aż Pilot wybierze „Rematch” (zaczyna następny w kolejności), „New match” albo „Back to lobby”. Bez kontroli widać podsumowanie bez przycisków. Serwer trzyma je w pamięci, restart wraca do lobby.
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

Menu ma tylko to, czego nie ma pod osobnym przyciskiem. Board panel otwiera ikona tarczy w nagłówku obok QR (na telefonie: status tarczy w nagłówku). New match, Players i Stats to przyciski na ekranie głównym.

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
- **Closest:** wygrywa najmniejsza odległość. **PDC:** to samo, ale trafienie w to samo pole co lider (bull albo 25) to remis.
- Remis: rzucają ponownie tylko remisujący liderzy, w odwrotnej kolejności. Tak samo przy 3+ graczach.
- Lotka poza tarczą liczy się po odległości. Lotka bez coords jest ostatnia. Niewykryta lotka: rzuca się jeszcze raz.
- Przy jednym graczu bull-offu nie ma, nawet gdy opcja jest włączona. Serwer zapisuje wtedy mecz z bull-offem „Off”.
- Undo zdejmuje ostatnią lotkę bull-offu. Przyciski „X starts” na Pilocie zostają jako ręczne nadpisanie.
- Ekran pokazuje przybliżonego bulla z ringiem trebli i sektorami, kropki lotek z imionami i przerywany okrąg wokół bulla dla każdej lotki (obszar do pobicia), obok listę od najbliższej z mm i kto rzuca.
- Po rozstrzygnięciu ekran mówi „X starts”, a pierwszy leg rusza po takeoucie.
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
- Ustawienia kamer i detekcji zostają w Board Managerze (`:3180`).
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
