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
- **Checkout:** przy wyniku do 170 obok wyniku jest ścieżka dla liczby lotek, które zostały w turze (np. „T19 · D12”).
- **Lista graczy:** stała kolejność rzucania. Aktywny gracz ma pomarańczowy wiersz. W wierszu: imię, legi, średnia z meczu i wynik.
- **Statystyki, tylko przy 2 graczach:**
  - karta z 6 ostatnimi wizytami aktywnego gracza;
  - karta z meczu: średnia z legu, średnia z meczu, najlepsza wizyta i liczniki 100+, 140+, 180.
  - Przy 3+ graczach zostaje sama lista. Bez first 9, checkout % i liczby lotek w legu.
- **Nagłówek:** gra i ustawienia (np. „X01 · 501 · Double out · First to 3 legs”), status tarczy, przycisk QR i menu.
- **Bust:** czerwony „BUST” w hero. Wynik wraca do stanu sprzed tury.
- **Efekty:** Ekran wyników ma warstwę na nakładki z animacjami. Animacje, dźwięki, ledy i caller są opisane w [EFEKTY.md](EFEKTY.md).

## Tura i takeout

- **Takeout** kończy turę automatycznie. Lotki, których brakuje do trzech, wpadają jako Miss.
- **Karta tury** (z testów 2026-10-26): gdy Tura się skończy (trzecia lotka, bust, checkout, utrata życia), ekran nie przeskakuje dalej, tylko od razu pokazuje kartę tury. Przy krótszej Turze karta pojawia się z początkiem takeoutu.
  - Na karcie: imię, duży werdykt i lotki. Werdykt to „CHECKOUT”, „BUST” (czerwony) albo zdarzenie gry, np. „LIFE LOST”. Bez werdyktu jest wynik tury jak dotąd.
  - Hero pod kartą trzyma stan z chwili końca Tury, np. w 121 nadal „Target 121”. Nowy cel, nowe życie i następny gracz pojawiają się dopiero po końcu takeoutu.
  - Checkout kończący leg X01 pokazuje od razu ekran końca legu, jak dotąd.
- W czasie takeoutu ekran jest przyszarzony. Pod kartą tury jest bursztynowy pasek „Removing darts” ze spinnerem i ostrzeżeniem, że rzuty przed „Ready” się nie liczą.
- **Koniec takeoutu** (sam albo przez „Takeout done”) gra krótki swoosh i dopiero wtedy przełącza na następnego gracza. Dźwięk opisuje [EFEKTY.md](EFEKTY.md#wbudowane-dźwięki).
- **Zacięty takeout:** Board Manager czasem nie zgłasza końca takeoutu i wtedy nie widzi nowych rzutów. Pilot ma w czasie takeoutu główny przycisk „Takeout done”. Wywołuje on Reset na Board Managerze i przechodzi do następnej tury. Po około 15 s ekran podpowiada „Board stuck? Use Takeout done on the pilot”.
- Lotki rzucone przed „Takeout done” nie istnieją dla systemu. Gracz dopisuje je przez „Add dart” albo rzuca jeszcze raz.

## Pilot w trakcie meczu

- **Pasek:** wskazówka, „Undo” i główny przycisk. Główny przycisk to „Next player”, w czasie takeoutu „Takeout done”, a po legu bez match mode „Next leg”.
- **Undo** cofa jedną lotkę. Gdy w turze nie ma lotek, cofa do poprzedniej tury z jej trzema lotkami.
- **Poprawka lotki:** stuknięcie w kafelek otwiera arkusz.
  - Zakładka „Nearby” to siatka 3×3: sąsiad z lewej, odczytane pole i sąsiad z prawej, w wierszach Double, Single i Triple. Pomyłkę o jedno pole poprawia jedno stuknięcie.
  - Zakładka „All” to przełącznik Single/Double/Triple i liczby 1–20.
  - Pod obiema zakładkami są Miss, 25 i Bull.
  - Na laptopie obok zakładek jest zawsze widoczna duża tarcza z pogrubionymi pierścieniami. Białe znaczniki pokazują, gdzie system odczytał lotki. Przy implementacji zamiast trzeciej zakładki, bo na dużym ekranie mieści się obok.
- Poprawić da się każdą lotkę w bieżącej turze, czyli przed takeoutem. Starsze tury tylko przez Undo.
- Wybór od razu podmienia rzut. Poprawiona lotka jest krótko podświetlona, także na Ekranie wyników.

## Start i koniec meczu

- **Nowy mecz** to jeden ekran Pilota:
  - kafelki gier;
  - gracze z kolejnością (przeciąganie, „Shuffle”, chipy ostatnio używanych graczy, „Add guest” i „New player”);
  - opcje gry z modułu i „Start match”.
- **Opcje X01:**
  - start score;
  - check-in i check-out;
  - match mode: Off, Legs lub Sets, z „First to N”;
  - bull-off: Off, „Closest to bull” lub zasady PDC.
- **Gracze i goście:** opisani w [STATYSTYKI.md](STATYSTYKI.md).
- **Koniec legu:** ekran ze zwycięzcą, checkoutem, liczbą lotek i średnią z legu.
  - W match mode trzyma się do końca takeoutu, potem następny leg startuje sam.
  - Bez match mode czeka na „Next leg” albo „End match”.
- **Koniec meczu:** ekran wygranej trzyma się do wyboru na Pilocie: „Rematch” (zaczyna następny w kolejności), „New match” albo „Back to lobby”.

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
- **Bez meczu:** Close app, czyli wyjście z kiosku.
- **Na telefonie** dochodzi Show QR, bo nagłówek telefonu nie ma przycisku QR.
- **Bez kontroli:** Take control i Stats.
- **Efekty:** w menu meczu i ogólnym są przełączniki Sounds i LEDs. W każdym menu, także bez kontroli, jest wejście „Effects” na stronę `/effects` ([EFEKTY.md](EFEKTY.md)). Przełącznik Caller dojdzie z paczką nagrań.

## Players

- Lista graczy z polem „New player name”. Archiwalni są pod „Show archived”.
- Wejście w gracza pokazuje jego statystyki, te same co `/stats/:id` (wybór gry i okresu), a pod nimi „Manage”: zmiana imienia, scalanie, archiwizacja i anonimizacja.

## Bull-off z tarczy

Gdy opcja bull-off to „Closest to bull” albo PDC, mecz zaczyna się od rzutów w bulla. Serwer liczy odległość od środka z coords Board Managera (1 = 170 mm, zewnętrzna krawędź double).

- Każdy rzuca jedną lotkę, w kolejności z setupu. Po każdej lotce takeout. Lotka rzucona przed takeoutem jest ignorowana.
- **Closest:** wygrywa najmniejsza odległość. **PDC:** to samo, ale trafienie w to samo pole co lider (bull albo 25) to remis.
- Remis: rzucają ponownie tylko remisujący liderzy, w odwrotnej kolejności. Tak samo przy 3+ graczach.
- Lotka poza tarczą liczy się po odległości. Lotka bez coords jest ostatnia. Niewykryta lotka: rzuca się jeszcze raz.
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
- Ustawienia kamer i detekcji zostają w Board Managerze (`:3180`).

## Stany awaryjne

- **Brak tarczy:** oba ekrany pokazują baner „Brak tarczy, wpisuj rzuty ręcznie”, a Pilot przełącza się na klawiaturę z zakładki „All” jako główne wejście. Gdy tarcza wraca, baner znika.
- **Wznowienie po restarcie:** mecz wraca od razu na oba ekrany. Pilot pokazuje dyskretne „Mecz wznowiony” z opcją zakończenia.

## Poza zakresem

- Efekty, dźwięki, WLED, animacje i caller: [EFEKTY.md](EFEKTY.md). Paczka nagrań callera: [#5](https://github.com/jgoliszewski/ITDarts/issues/5).
- Minigierki, ich setup, „How to play” i Ekran rekordu: [GRY.md](GRY.md).
- Widok „Stats” i zapis wyników: [STATYSTYKI.md](STATYSTYKI.md). Ranking: [#6](https://github.com/jgoliszewski/ITDarts/issues/6).
