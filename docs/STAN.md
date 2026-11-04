# ITDarts: stan prac

Stan na 2026-11-03. Aktualizuj przy każdym większym kroku.

## Gałęzie

- **`main`:** cała aplikacja v1, minigierki i efekty. `feat/v1` jest w niej w całości wmergowana.

## Gotowe

- **Ekran kiosku nie gaśnie** (2026-11-03): strona na `localhost` trzyma Screen Wake Lock (`web/src/main.tsx`) i bierze go ponownie po powrocie karty, jak film na pełnym ekranie. Sprawdzone: typecheck i testy. Niesprawdzone: drugi laptop i firmowa blokada ekranu z zasad IT (GPO może zablokować ekran mimo wake locka).
- **Sector closed bez ruchu i 0,8 s** (2026-11-03, [EFEKTY.md](EFEKTY.md#presety-momentów-2026-10-28)): w Cricketcie lotki ginęły po Sector closed (4 na 35 wobec 0 na 222 po Hit i Miss), bo ruch na ringu w trakcie Tury wygląda dla kamer jak takeout. Preset 122 to teraz stała zieleń na obu ringach (`leds.ts`), reguła `b-sector-closed` ma 0,8 s. Test w `leds.test.ts`. Treble i Bull zostają z ruchem. Niesprawdzone: prawdziwa tarcza, a presety trzeba wgrać na kontroler (`npm run leds:upload`).
- **Kropki lotek w arkuszu poprawki w miejscu wbicia** (2026-11-03, [UI.md](UI.md#pilot-w-trakcie-meczu)): duża tarcza w `FixSheet` rysuje lotki z coords Board Managera (`coordsSpot` z pierścieniami `R`, chybienie przycięte do promienia 368 przez `inputSpot`), a lotki bez coords w środku pola. Poprawiana lotka to większa biała kropka z grubym obrysem. Test w `Dartboard.test.ts` (granice pierścieni, chybienie w widoku). Sprawdzone zrzutami z atrapy tarczy w `.scratch/fix-coords/`. Niesprawdzone: prawdziwa tarcza.
- **`npm run dev:shot`** (2026-11-02, [README.md](../README.md#zrzuty-ekranu-i-testy-na-żywo-npm-run-devshot)): jednorazowa instancja do zrzutów i testów na żywo, niezależna od deva: atrapy na 3380 i 3390, serwer na 3300 z folderem tymczasowym na dane, kopią `effects/` i zbudowanym webem (nowe flagi `--effects` i `--web`). Zamyka własne procesy i kasuje folder, a przy zajętym porcie kończy się błędem. Przełącznik atrapy tarczy bierze port z `--board`, żeby nie wchodził na 3180. Sprawdzone: zrzut `/effects/leds` z presetami atrapy w `.scratch/dev-shot/`, porty po zakończeniu wolne, dev na 3000 i 5173 bez zmian.
- **Grupy w Effects** (2026-11-02, [EFEKTY.md](EFEKTY.md#układ-strony), [MAPA.md](MAPA.md#do-zrobienia)): Rules, Sounds i LEDs oraz pickery dźwięku i presetu używają grup z mapy (Match, Darts, Visits, Leg end, Minigames, Board), zwijanych, ze stanem w przeglądarce. Dźwięk z pliku ma opcjonalne pole `group` (upload i menu „⋯”), a wbudowane dźwięki i presety ITDarts mają grupę w kodzie. Testy: przypisanie wyzwalacza, grupa każdego wpisu `BUILTIN_SOUNDS` i `LEDS`, zapis i czyszczenie `group`. Sprawdzone w przeglądarce na osobnej instancji (laptop 1280 i telefon 375), zrzuty w `.scratch/fx-groups/`.
- **Bull-off: kolejność gry, próg 5 mm, nowy ekran** (2026-11-02, [UI.md](UI.md#bull-off-z-tarczy)): w Closest remis to mniej niż 5 mm od lidera (`TIE_MM`), PDC bez zmian. Po bull-offie gra idzie w kolejności z rankingu bull-offu (`order` w `BullOffView`), a nie w rotacji z setupu: X01 (także zaczynający kolejnych legów i setów) i wszystkie minigierki (`Turns.order`, `nextIn` i `rotate` w `games/turns.ts`). „X starts” z Pilota daje X, a dalej kolejność z setupu, więc stare logi z samym `start` odtwarzają się jak dotąd. Lista graczy na Ekranie wyników, w Cricket i na telefonie idzie w kolejności gry. Rematch z włączonym bull-offem zaczyna się od nowego bull-offu z tym samym setupem (`rematchSetup` w `server/hub.ts`), a bez bull-offu jak dotąd zaczyna następny w kolejności z setupu. Ekran bull-offu według wariantu A z makiety: karta o stałej wysokości, tarcza 740 px przycięta do koła, imiona lotek bez nachodzenia, status „Too close: 3.0 mm”, dogrywka z „ROUND 2”, „PLAYING ORDER” po rozstrzygnięciu, bez notki z zasadami. Sprawdzone testami (`games/bulloff.test.ts`: próg, dogrywka 3 rund, remis na dalszych miejscach, brak coords, PDC, X01 na 4 graczy z drugim legiem, Cricket) i zrzutami z symulatora na osobnej bazie (1920×1080 i 375 px: rzucanie, takeout, „Too close”, dogrywka, kolejność, lista po starcie) w `.scratch/bulloff/`. Niesprawdzone: prawdziwa tarcza, 5–8 graczy na ekranie bull-offu (wiersze się zmniejszają, przyciski „X starts” mogą się zawinąć), mecz w toku z bull-offem w chwili aktualizacji. **Przed aktualizacją zakończ albo porzuć mecz w toku.** Log meczu w toku odtwarza się po restarcie według nowych zasad. Gdy w meczu Closest dwie lotki bull-offu dzieliło mniej niż 5 mm, po odtworzeniu bull-off wraca do dogrywki, a rozegrane wizyty z tego meczu przepadają. Zakończone mecze są bezpieczne, bo w bazie leżą jako legi z zapisanym zaczynającym.
- **Wyrównanie widoków gier** (2026-11-01, z przeglądu zrzutów wszystkich 12 gier w sesji, [UI.md](UI.md#ekran-wyników)): ta sama duża liczba w hero, kafelek lotki „pole / wartość” wszędzie (`DartFace`), kafelki pod tarczą przez całą szerokość, prawa kolumna 620 we wszystkich grach, karta „THIS MATCH” pod listą minigierek z liczbami z podsumowania (`MiniSide`), w 121 kafelek „Darts left” w tej karcie zamiast obok lotek. Karta Tury bez kafelków stanu i notek, sam napis z imieniem. Koniec legu, koniec meczu i Ekran rekordu bez linijek pod kafelkami i z większym tekstem, minigierki z kafelkami liczb zwycięzcy, „WINNER” i „Game over” w każdej grze. Zaliczone sektory na tarczy ciemniejsze. Sprawdzone zrzutami z bota (osobna instancja, 3 graczy, wszystkie gry do końca) w `.scratch/align/index.html`. Niesprawdzone: 5–8 graczy, 2 graczy i telefon. Do zrobienia osobno: podsumowanie minigierek ma pustą połowę ekranu.
- **Ikony gier** (2026-10-30, grilling w sesji, [UI.md](UI.md#ikony-gier)): liniowa ikona dla każdej gry (`GameIcon`). Na kafelkach w setupie jest szarym tłem uciętym o 1/6, a na chipach `/stats` i w nagłówku Ekranu wyników stoi przed nazwą. Sprawdzone w przeglądarce: setup na telefonie (375 px), `/stats` i nagłówek meczu Knockout na 1920×1080, zrzuty w `.scratch/game-icons/`.
- **Drabinka celów w 121** (2026-10-30, po grillingu, [GRY.md](GRY.md#121)): pionowy łańcuch kółek z numerami celów przy prawej krawędzi hero (zaliczony zielony, bieżący pomarańczowy) z etykietą „Best N” rekordu biurowego (`raw` w `RecordInfo`), odometr celu w podpisie, przesunięcie taśmy i przewinięcie cyfry po takeoucie, zielone kropki po checkoucie, czerwony błysk kropek i pęknięcie serca przy „Life lost”, wyskok serc przy refill (`web/src/components/Ladder.tsx`). Z przeglądu: konturowe serca w całej aplikacji, hero minigierek bez „N darts left”, kafelek podejścia bez podpisu. Sprawdzone testem okna drabinki i w przeglądarce na osobnej instancji z symulatorem: checkout, przesunięcie, nieudane podejście, chorągiewka wstrzyknięta w DOM. Zrzuty w `.scratch/121-ladder/`. Niesprawdzone: chorągiewka z prawdziwego rekordu (wymaga zarejestrowanego gracza) i animacje na żywo w kiosku.
- **Knockout i Football** (2026-10-30, grilling w [#7](https://github.com/jgoliszewski/ITDarts/issues/7), [GRY.md](GRY.md#knockout)):
  - Knockout (`games/knockout.ts`): runda po jednej Turze, najniższa suma traci życie (remisujący wszyscy), 3 życia, zaczynający przesuwa się co rundę, runda się nie liczy, gdy odpadliby wszyscy. Caller podaje sumę Tury, statystyki: wygrane i średnia Tura;
  - Football (`games/football.ts`): jedna piłka, bull ją przejmuje (opcja Kick-off 25/50 albo Bull only), z piłką double 1–20 to gol, opcja Goals 3/5/10, „Save” kończy grę wygraną najwięcej goli (jak w Random Checkouts). Tarcza na hero obrysowuje bull albo cały pierścień doubles (`target="ring"` w `TargetBoard`). Nowy Moment „Goal” (reguła bazowa `b-goal`, dźwięk i ledy z Ton) przed „Match won” w `ORDER`;
  - backlog minigierek z #7 odrzucony, issue zamknięte;
  - po pierwszych testach (2026-10-30): w Knockout większe serca na liście, kafelek „To beat” obok sumy Tury i nowy Moment „Lowest visit” (reguła bazowa `b-lowest`). Smutny dźwięk słyszy tylko ten, czyja Tura jest najniższa do tej pory, a „Life lost” i „Player eliminated” na koniec rundy tylko wtedy, gdy dotyczą ostatniego rzucającego;
  - sprawdzone testami (`games/knockout.test.ts`, `games/football.test.ts`, test `pickRule` dla „Goal”) i skryptem przez websocket z symulatorem tarczy na osobnej bazie: Knockout na 3 graczy od utraty życia przez eliminację do wygranej, Football z golem, odebraniem piłki, „End match” z „Save” i zapisem goli w statystykach, setup na telefonie. Zrzuty 1920×1080 w `.scratch/knockout-football/`. Niesprawdzone: dźwięk i ledy „Goal” w kiosku, caller Knockout na żywo, `/stats` obu gier w przeglądarce.
- **Poprawki „Znanych problemów”** (2026-10-30):
  - w `npm run dev` proxy Vite przekazuje adres przeglądarki (`xfwd`), a serwer bierze go zamiast adresu proxy, więc telefon nie jest już kiosk. Sprawdzone połączeniem przez `localhost:5173` (kiosk) i `192.168.1.94:5173` (telefon);
  - dźwięk z biblioteki ma adres z wersją pliku (`url` w `Sound`, `/sounds/<plik>?v=<mtime>`), więc kiosk nie gra starego dźwięku po podmianie pliku o tej samej nazwie. Przy okazji przyciski odtwarzania plików na `/effects` grają z tego adresu; wcześniej pobierały stronę zamiast dźwięku i milczały. Sprawdzone w przeglądarce na `/effects/sounds`;
  - w Co-op 121 podejście i checkout liczą się każdemu, kto rzucał w podejściu ([GRY.md](GRY.md#121));
  - po ponownym połączeniu z Board Managerem adapter porównuje lotki w tarczy (segment i coords) z już policzonymi. Gdy się nie zgadzają, był takeout w czasie rozłączenia: hub dostaje „takeout finished”, a nowe lotki wchodzą wszystkie. Lepki `takeoutFinished` po reconnect nie odpala już drugiego takeoutu. Test w `server/board.test.ts`; na prawdziwej tarczy jeszcze nie sprawdzone.

- **Random Checkouts i ATC „Order: Random”** (2026-10-29, [GRY.md](GRY.md#random-checkouts)): zaimplementowane.
  - Losowość z ziarna w logu: hub dopisuje `{ t: 'seed' }` na start i przy Rematch, gra losuje z niego deterministycznie (`seeded` w `games/turns.ts`), więc Undo i Poprawka przywracają te same liczby. ATC tasuje 1–20 tak jak numery w Killer, bull zostaje na końcu.
  - Moduł `games/randomco.ts`: wspólna liczba, własna reszta albo wspólna w Co-op, bust, punkt za checkout, nowa liczba dla wszystkich, liczby niemożliwe przy regule nigdy nie losowane (`canCheckOut`), granice zakresu w `normalizeOptions`. Podpowiedź i caller z 121 i X01.
  - „End match” z „Save” dopisuje do logu `{ t: 'end' }`: gra kończy się jak wygrana (najwięcej punktów, remis dzielą, bez punktów i w Co-op bez zwycięzcy), ekran wygranej ma „Summary”, Undo cofa koniec.
  - Statystyki gracza: checkouty, lotki na checkout (własne lotki zamykającego przy tej liczbie) i % w pierwszej Turze.
  - Sprawdzone: testy `games/randomco.test.ts` i ATC w `games/minigames.test.ts`; skryptem przez websocket z symulatorem tarczy na osobnej bazie: start, bust, checkout z punktem i nową liczbą, Undo przywraca liczbę i ponowny checkout daje tę samą następną, End match z Save i ekran wygranej, Summary i zapis meczu, ATC Random. Zrzuty w `.scratch/random-checkouts/`. Niesprawdzone: caller na żywo w kiosku i `/stats` dla nowej gry w przeglądarce.
- **Grupy gier i Shanghai** (2026-10-29, [GRY.md](GRY.md#shanghai)):
  - kafelki w setupie i wybór gry na `/stats` są w grupach Classic, Practice i Versus w stałej kolejności (`group` w module gry, `GAME_GROUPS` w `games/index.ts`); ostatnio grana gra jest tylko domyślnie wybrana;
  - Shanghai (`games/shanghai.ts`): 7 albo 20 rund, punkty z sektora rundy, Shanghai kończy grę od 2 graczy (solo tylko Moment), dogrywka na 20 tylko dla remisujących, do skutku; stan z logu, więc Undo i Poprawka działają. Rekord: najwyższa suma solo, osobno dla 7 i 20 rund. Statystyki: wygrane, Shanghai, hit rate;
  - nowy Moment „Shanghai” (reguła bazowa `b-shanghai`, dźwięk i ledy z White Horse) dopisany w regułach, edytorze, symulatorze ledów i [MAPA.md](MAPA.md);
  - sprawdzone testami (`games/shanghai.test.ts`) i skryptem z `dev:fake` na osobnej bazie: pełna gra na 3 graczy, dogrywka z drugą rundą, ekran wyników 1920×1080 i setup 375 px w `.scratch/shanghai-gotcha/`. Niesprawdzone: dźwięk i ledy Momentu w kiosku, `/stats` Shanghai w przeglądarce, Shanghai w dogrywce na ekranie.
- **Gotcha** (2026-10-29, [GRY.md](GRY.md#gotcha)): `games/gotcha.ts`, grupa Versus, 2–8 graczy.
  - Wynik od 0 w górę do 101, 201 (domyślnie) albo 301, dokładnie w cel, bez double. Bust jak w X01, dokładny cel wygrywa od razu, także w środku Tury. Na koniec Tury, jeśli wynik gracza się zmienił, rywale z takim samym wynikiem spadają do 0 (bust, 0 → 0 i Tura bez punktów nikogo nie zerują). Stan z logu, więc Undo i Poprawka działają;
  - Ekran wyników: hero z wynikiem i „Left”, karta Tury z „Gotcha! Kuba → 0”, kafelki lotek przygaszone tylko przy buście. Caller: wynik Tury i „busted”, bez „you require” i „game shot”. Statystyki: wygrane i liczba Gotcha (każdy wyzerowany rywal to jedna), bez rekordu;
  - nowy Moment „Gotcha” (reguła bazowa `b-gotcha`, dźwięk i ledy z Bed and breakfast) dopisany w tych samych miejscach co „Shanghai” i w [MAPA.md](MAPA.md);
  - sprawdzone testami (`games/gotcha.test.ts`) i skryptem z `dev:fake` na osobnej bazie: Gotcha, bust bez zerowania i wygrana dokładnie w cel, zrzuty 1920×1080 w `.scratch/shanghai-gotcha/` (`gotcha-*`). Niesprawdzone: dźwięk i ledy Momentu i caller w kiosku, `/stats` Gotcha w przeglądarce, mecz na 3+ graczy na ekranie.
- **Grilling hostingu** ([#8](https://github.com/jgoliszewski/ITDarts/issues/8), 2026-10-28): plan w [HOSTING.md](HOSTING.md), jeszcze nic nie zaimplementowane.
- **Grillingi:** UI ([#1](https://github.com/jgoliszewski/ITDarts/issues/1)), efekty ([#2](https://github.com/jgoliszewski/ITDarts/issues/2)), historia i statystyki ([#4](https://github.com/jgoliszewski/ITDarts/issues/4)), minigierki ([#3](https://github.com/jgoliszewski/ITDarts/issues/3), [GRY.md](GRY.md)).
- **Kod v1:**
  - silnik X01 z logiem zdarzeń, setami, bull-offem i checkoutami;
  - serwer z adapterem Board Managera i SQLite;
  - Ekran wyników, Pilot, setup, Players, Board panel, `/stats`.
- **Minigierki** według [GRY.md](GRY.md): ATC, Full Board, 121, Cricket, Killer, Higher or Lower, Random Checkouts, Shanghai, Gotcha, Knockout i Football.
  - Gry dzielą log tur z `games/turns.ts`. Każda jest czystą funkcją logu, więc Poprawka i Undo działają wszędzie.
  - Gotowe są też Co-op, Ekran rekordu ze „Skip”, „New record” na ekranie wygranej, „How to play” w setupie i w menu Pilota razem z „Show on screen”, podpowiedzi „i” przy opcjach i Reroll numerów w Killer.
  - Setup pamięta opcje osobno dla każdej gry i domyślnie wybiera ostatnio graną.
  - Migracja 2 bazy dodaje `matches.variant` oraz `match_players.score` i `stats`.
  - `/stats` ma wybór gry, top 10 per wariant i statystyki gracza w danej grze. Profil X01, winrate i head-to-head liczą tylko X01.

- **Bull-off z tarczy** ([UI.md](UI.md#bull-off-z-tarczy)): odległość z coords, Closest i PDC, remisy, takeout po każdej lotce. Symulator ma klikalną tarczę z prawdziwymi coords.
- **Karta tury i swoosh** z pierwszych testów ([UI.md](UI.md#tura-i-takeout), [EFEKTY.md](EFEKTY.md#wbudowane-dźwięki)):
  - Karta pokazuje werdykt („Checkout”, „Bust”, „Life lost”, „Out”, „N marks”) albo wynik Tury od ostatniej lotki do końca takeoutu.
  - 121 i Higher or Lower trzymają cel, życia i zakres do zamknięcia Tury.
  - Kiosk gra dźwięk zmiany gracza z WebAudio (`turnPass` w stanie meczu), a kiosk Edge dostał flagę `--autoplay-policy`. Od 2026-10-26 to arpeggio marimby zamiast swoosha.
  - Od 2026-10-27 minigierki grają też trafienie i pudło (kwinta w górę i w dół): ATC, Full Board i Cricket po każdej lotce, Higher or Lower raz na Turę ([EFEKTY.md](EFEKTY.md#wbudowane-dźwięki)). Logika w `dartCue` (`web/src/match.ts`) z testem. Nie słuchane jeszcze w kiosku.
  - Dźwięk wycisza przełącznik Sounds albo jego własny przełącznik na `/effects`. Głośność bierze z poziomu efektów.
  - Sprawdzone skryptem z symulatorem: checkout i bust w 121, Tura X01 z „Next player”.
- **Efekty** według [EFEKTY.md](EFEKTY.md):
  - **Wyzwalacze:** każda gra zwraca wystąpienia z logu (`games/effects.ts`, `happenings` w modułach), a hub odpala nowe i zmienione. Tak samo działają minigierki, w tym „New record”. Takeout, start meczu i status tarczy zgłasza hub.
  - **Konfiguracja w repo** ([EFEKTY.md](EFEKTY.md#konfiguracja-w-repo)):
    - reguły, Biblioteka dźwięków i wspólne ustawienia leżą w `effects/effects.json` i `effects/sounds/`, pod gitem;
    - adres WLED i przełączniki Sounds i LEDs zostają w SQLite (`settings`);
    - serwer pilnuje pliku i przeładowuje go po `git pull`, a uszkodzony plik zostawia ostatnią dobrą wersję i pokazuje baner;
    - pierwszy start przeniósł dane z tabel z migracji 3 i je usunął.
    - Pilnowanie pliku sprawdzone na Windows skryptem: podmiana pliku jak przy pullu i znaczniki konfliktu.
  - **Strona `/effects`** w układzie z grillingu ([EFEKTY.md](EFEKTY.md#układ-strony)), kod w `web/src/screens/effects/`:
    - zakładki Rules, Sounds, LEDs i Playback z własnymi adresami, na laptopie (od 1100 px) z boku, z listą reguł i edytorem obok;
    - edytor „When → Then” z chipami wyzwalaczy, arkuszem dodawania i „Discard changes?”, także przy przycisku wstecz;
    - „Test whole rule” gra niezapisaną regułę (`POST /api/effects/test`): dźwięk na urządzeniu, które kliknęło, ledy na kontrolerze (od 2026-10-27);
    - presety mają kolor z `presets.json`, a każdy da się wypróbować przez „Try” (`POST /api/wled/preview`).
    - Sprawdzone w przeglądarce na telefonie (375 px) i laptopie (1280 px) z atrapą WLED.
  - **Pilot:** Sounds, Caller i LEDs w menu, trzymane przez serwer.
  - **Caller** według [EFEKTY.md](EFEKTY.md#caller), grilling w [#5](https://github.com/jgoliszewski/ITDarts/issues/5):
    - Huw Ware (prawdziwy sędzia, paczka z autodarts.x10.mx) i cztery głosy TTS z paczek darts-caller (Brian, Arthur, Stephen, Ballad; Ash usunięty), każdy z kompletem kluczy callera (wyniki, `require_1`–`require_180`, game on, no score, game shot) w `assets/caller/<głos>/` z opisem pochodzenia w `SOURCE.md`, serwowane pod `/caller/<głos>/`; wybór „Caller voice” w Playback, zapis `callerVoice` w `effects.json` (2026-10-27). Nierozstrzygnięte: wszystkie brzmią płasko przy 180, do rozważenia własna generacja TTS z instrukcją stylu sędziego;
    - wywołania liczy `games/x01/caller.ts` z tych samych wystąpień co efekty, a hub dokleja je do wiadomości `fx`. Kiosk gra je po dźwięku efektu (najdłużej 2 s czekania) i jedno po drugim;
    - przełącznik Caller (SQLite) i „Caller volume” (`callerVolume` w `effects/effects.json`) na Pilocie i w Playback;
    - sprawdzone skryptem przez websocket na osobnej instancji z symulatorem tarczy: game on, wynik, „no score” przy buście, poprawka, undo, takeout z „you require”, game shot, następny leg i Caller off. Kiosk pobrał nagrania bez błędów.
  - **Animacje:** 180, 140+, bust, konfetti, błysk kafelka T20 i Bull, wejście ekranu końca legu.
  - **Sprawdzone** skryptem przez websocket z symulatorem tarczy i atrapą WLED (`npm run fake-wled`): reguły 180 i T20, Poprawka S20 ↔ T20, Undo, Sounds off, powrót WLED do stanu bazowego. Do tego zrzuty strony `/effects`, edytora, menu i animacji.
- **Zgłaszanie błędów** ([UI.md](UI.md#zgłaszanie-błędów)): „Report a bug” w każdym menu zapisuje `bugs/<czas>.json` z kontekstem i logiem meczu. Sprawdzone skryptem przez websocket: zapis i odrzucenie pustego opisu. Dialogu nikt jeszcze nie klikał.
- **Podsumowanie meczu, heatmapa, porównanie i distance walked** (2026-10-28, grilling ze zgłoszeń, [UI.md](UI.md#podsumowanie-meczu), [STATYSTYKI.md](STATYSTYKI.md#prezentacja)):
  - karta wygranej ma „Summary”; serwer zapisuje mecz i trzyma raport (`games/report.ts`, `summary` w stanie) do Rematch, New match albo Back to lobby. „End match” z „Save” też go pokazuje;
  - heatmapa w stylu Autodarts z linią między dwoma graczami (`web/src/components/Heatmap.tsx`) w podsumowaniu, w profilu gracza i na `/stats/compare`; dane z `GET /api/stats/heat`;
  - „Distance walked” = Tury × 2 × `ocheMeters` (domyślnie 2,37 m);
  - sprawdzone skryptem z symulatorem tarczy (mecz wygrany i przerwany z gośćmi) i zrzutami: 1920×1080, 1600×900, telefon 375 px, `/stats/compare`. Przeciągania linii i przycisku „Summary” nikt jeszcze nie klikał.
- **Test board** w panelu tarczy (2026-10-28, grilling ze zgłoszenia, [UI.md](UI.md#panel-tarczy)): log 30 zdarzeń z coords, ostatnia ramka Board Managera, lotki i takeouty w teście omijają mecz (`boardTest` w stanie, sam gaśnie po 10 min). Sprawdzone skryptem z symulatorem i zrzutami (1600×900, 375 px); na prawdziwej tarczy jeszcze nie.
- **Kalibracja** najpierw włącza detekcję, bo Board Manager odrzuca ją przy zatrzymanej; błędy akcji pokazują tekst od Board Managera. Nie sprawdzone na prawdziwej tarczy.
- **Start meczu** (2026-10-29) zawsze wysyła do Board Managera „start detection” i reset (`Board.prepare`), bo tarcza często nie wykrywała lotek na początku meczu, choć pokazywała detekcję. Powtórny start sprawdzony na Board Managerze 2.0.2: odpowiada 200 i nic nie psuje. W meczu jeszcze nie sprawdzone.
- **Menu** rozdzielone na menu meczu i ogólne; Board panel, Players i Stats mają własne przyciski. Gracz w Players pokazuje swoje statystyki.

- **Podpowiedzi Checkout i Setup** ([UI.md](UI.md#ekran-wyników)), 2026-10-27, ze zgłoszenia: trasy z tabeli PDC (z kontynuacją zaplanowanej trasy w turze), a poza tabelą optymalna strategia (oczekiwana liczba lotek z modelem pudeł), aktualizowana po każdej lotce, z „Setup”, gdy checkoutu nie ma. Działa w X01 i 121. Sprawdzone testami, jeszcze nie oglądane na ekranie.

- **Caller w 121 i nowa karta tury** (2026-10-27, ze zgłoszeń): caller w 121 jak w X01, bez „game shot” ([EFEKTY.md](EFEKTY.md#caller)); karta tury z dużymi kafelkami lotek i stanu we wszystkich grach ([UI.md](UI.md#tura-i-takeout)); w 121 kafelek z lotkami do końca podejścia ([GRY.md](GRY.md#121)). Karta 121 i ATC sprawdzona zrzutem na osobnej instancji. Callera 121 nikt jeszcze nie słyszał w kiosku.

- **Reguły bazowe i dźwięki wbudowane** (2026-10-27, grilling w sesji, [EFEKTY.md](EFEKTY.md#dźwięk)): 27 dźwięków syntezowanych w kiosku (`server/effects/builtin.ts`, `web/src/sound.ts`), sekcja „Built-in” w Sounds, 24 reguły bazowe ze stałymi id `b-…` (w tym Treble 15–20), „Reset to default” i brak „Delete” w edytorze. `effects.json` przepisany: starsze reguły startowe dostały stałe id i domyślne dźwięki, a własne pliki zostały jako nadpisania. Sprawdzone testami, zrzutami `/effects` i odsłuchem w headless Chromium bez błędów. Nikt jeszcze nie słyszał ich w kiosku ani w meczu.

- **Tarcza w ATC i Full Board** (2026-10-27, ze zgłoszenia):
  - duża tarcza w kolorach tarczy do wklikiwania lotek, z lekko poszerzonymi treble, double i bullami, na prawej połowie hero (`TargetBoard` w `web/src/components/Dartboard.tsx`): aktualny cel ATC z pomarańczowym, biegnącym, przerywanym obwodem, zaliczone cele zakreskowane, kropki lotek z Tury ([GRY.md](GRY.md#around-the-clock-atc)). Test pilnuje, że każda kropka leży w swoim polu;
  - karta tury w grach liczonych trafieniami ma zielone i czerwone kafelki ([UI.md](UI.md#tura-i-takeout)).
  - Sprawdzone zrzutami z symulatorem w 1920×1080. Nikt jeszcze nie widział tego na ekranie w biurze.

- **Kropki legów na Ekranie wyników X01** (2026-10-27, ze zgłoszenia): trochę większe, a w aktywnym wierszu niewygrane legi są jaśniejsze ([UI.md](UI.md#ekran-wyników)). Sprawdzone zrzutem z symulatorem w meczu na sety.

- **Liczniki tur 60+, 80+, 100+** (2026-10-27) zamiast 100+, 140+, 180 na karcie meczu i na `/stats` ([STATYSTYKI.md](STATYSTYKI.md)). Efekty i animacje 140+ i 180 zostają bez zmian.

- **Okno poprawki i nowy mecz na laptopie** (2026-10-27): „Fix dart” bez przewijania, z czerwonym „Cancel” w nagłówku i tarczą na całą wysokość; „New match” w trzech kolumnach bez przewijania ([UI.md](UI.md#start-i-koniec-meczu)). Sprawdzone pomiarem w przeglądarce od 1280×720 do 1920×1080 i na telefonie.

- **Higher or Lower** (2026-10-27): T1 liczy się jako zero, a przed pierwszą lotką hero pokazuje 0 zamiast kreski, która wyglądała jak biały prostokąt ([GRY.md](GRY.md#higher-or-lower)).
- **New match** (2026-10-27): podpowiedzi „i” w dymku, opcje dla 2+ graczy od razu, przyciski graczy nad listą kolejności, check-out Single / Double / Master ([GRY.md](GRY.md#setup-na-pilocie), [UI.md](UI.md#start-i-koniec-meczu)).

- **Poprawki ze „Znanych problemów”** (2026-10-28):
  - remis w ATC i Full Board daje wygraną wszystkim remisującym: migracja 4 dodaje `match_players.won`, z niego liczą „Won” w ostatnim meczu, historia gracza i statystyki minigierki. `winner_position` zostaje tylko dla jednego zwycięzcy;
  - po „Next player” przed takeoutem i ponownym połączeniu z Board Managerem stare lotki nie wpadają następnemu graczowi: `Board` pamięta przetworzone lotki przez reconnect, hub pyta tylko przy pierwszym połączeniu (test w `server/board.test.ts`);
  - większe napisy na przyciskach Board panelu na laptopie. Nie oglądane jeszcze na ekranie.

  Testy: `npm test` (253 na 2026-10-30), `npm run typecheck`.
- **Sprawdzone z symulatorem tarczy** (`npm run dev:fake`):
  - lobby, setup, rzuty, Poprawka, Undo, takeout, koniec legu i meczu, rematch;
  - przejęcie Pilota, End match z Save i Discard;
  - wznowienie po restarcie serwera, restart Board Managera, baner braku tarczy, statystyki.
- **Minigierki sprawdzone skryptem** przez websocket i symulator oraz zrzutami ekranu z headless Edge. Każda gra przeszła start, rzuty, takeout i koniec, a do tego Ekran rekordu, Reroll, „How to play” na ekranie, lobby, setup na telefonie i `/stats`. Nikt jeszcze w nie nie zagrał ręcznie.

## Do sprawdzenia przy efektach

Pozycje z `[x]` bez daty potwierdzone przy tarczy 2026-10-30.

- [x] Dźwięk z prawdziwego pliku w kiosku Edge bez kliknięcia (flaga autoplay), także po kilku godzinach bezczynności.
- [x] Prawdziwy kontroler WLED: czy `"end"` z presetem bazowym wraca do tła. Pobieranie `presets.json` działa (WLED 0.15.4).
- [x] Ledy Momentów na ringu (2026-10-29, [#10](https://github.com/jgoliszewski/ITDarts/issues/10)): presety 100–128 są na kontrolerze, ring tarczy to segment 0, podział na 48, oba ringi startują na godzinie 1 i idą zgodnie ze wskazówkami. Obejrzane w podglądzie `led-sim.html` z „Play on the ring”, poprawki z ringu w [MAPA.md](MAPA.md#przypisania).
- [x] Ledy i dźwięki Momentów w meczu: czy efekty po lotce nie psują detekcji i takeoutu, dźwięki w kiosku (lista w [#10](https://github.com/jgoliszewski/ITDarts/issues/10), punkt 4).
- [ ] Cricket po zmianie Sector closed (2026-11-03): zagrać mecz i sprawdzić, czy 3. lotka po zamknięciu sektora już nie ginie (`replay.ts` z `.scratch/cricket-takeout/` na nowym meczu). Obserwować też Treble 15–20 i Bull w X01, czy po nich następna lotka nie ginie.
- [ ] Upload dźwięku z telefonu (iOS Safari i Android) i odczyt długości pliku w przeglądarce.
- [ ] Czy animacje 180, 140+ i bust nie przeszkadzają na dużym ekranie przy prawdziwej grze.
- [x] Caller na żywo w kiosku: czy słychać go wyraźnie obok efektów, czy „you require” nie wchodzi na arpeggio zmiany gracza i czy domyślne 80% głośności pasuje.
- [x] Dźwięki wbudowane w meczu: głośność względem plików i callera, czy Treble po każdej trójce nie męczy w X01, czy 180 i Match won nie przesterowują na głośnikach.
- [ ] Przeniesienie konfiguracji: push z domu, pull w pracy przy działającym serwerze. Stany bazowe wskazują presety atrapy (1–4), więc w pracy trzeba je raz ustawić pod prawdziwy kontroler.

## Do sprawdzenia z prawdziwą tarczą

Format websocketu sprawdzony podsłuchem Board Managera v2.0.2 (2026-10-26):

- [x] `ws://BOARD/api/events` wysyła `{type:'state', data:{throws, event, status}}`, rzut to `{segment:{name, number, multiplier, bed}, coords:{x, y}}`, coords: 1 = 170 mm, y w górę. Poza tarczą: `bed: 'Outside'`, `multiplier: 0`.
- [x] Takeout w polu `event`: „Takeout started”, „Takeout finished”. Po 3 lotkach `status: 'Takeout'`.
- [x] `GET /api/version` zwraca `2.0.2`.
- [x] Od 2026-10-29 tarcza ma Board Managera 2.1.0, format websocketu sprawdzony podsłuchem 2.1.0: płaski rzut `{segmentNumber, multiplier, segmentName, coordsX, coordsY, bed, bouncer, failed, method}`, zdarzenia camelCase (`throwDetected`, `takeoutStarted`, `takeoutFinished`), `status` `throw`/`takeout`/`takeoutInProgress`, a `event` jest lepki (pierwsza lotka po takeoucie przychodzi jeszcze z `takeoutFinished`). Adapter czyta oba formaty (2.0.2 i 2.1.0); `bouncer` i `failed` ignorujemy, nazwa ręcznego resetu w 2.1.0 niepotwierdzona.
Wszystko z tej listy potwierdzone przy tarczy 2026-10-30.

- [x] Bull-off na prawdziwej tarczy: kolejność, takeout po lotce, odległości w mm zgodne z rzeczywistością.
- [x] Pełny mecz X01 i jedna minigierka na prawdziwej tarczy.
- [x] Reset, start i stop detekcji, kalibracja i restart przez API.
- [x] Czy Board Manager wstaje sam po `sudo reboot` Raspberry Pi.
- [x] `start.bat` i tryb kiosku w Edge, otwarty port 3000 w zaporze, wejście z telefonu przez QR.

## Znane problemy

Brak otwartych. Ostatnie cztery poprawione 2026-10-30 (wyżej, w „Gotowe”).

## Następne kroki

1. Sprawdzić przy tarczy, co zostało w „Do sprawdzenia przy efektach”, i odzyskanie lotek po rozłączeniu z Board Managerem.
2. Zagrać w minigierki na prawdziwej tarczy i poprawić teksty „How to play” po pierwszych grach.
3. Przeróbka strony Effects i konfiguratora według [MAPA.md](MAPA.md#do-zrobienia).
4. Otwarte issues (backlog minigierek z #7 zamknięty 2026-10-30):
   - [#6](https://github.com/jgoliszewski/ITDarts/issues/6): ranking.
5. Hosting w internecie, gdy się zdecydujemy: plan i kolejność prac w [HOSTING.md](HOSTING.md), zaczynając od prototypu kiosku jako przekaźnika.

## Materiały poza repo

- Makiety UI: [ITDarts UI mockups](https://claude.ai/artifact/Bt8RmLqWv9733tb2nLkPQK).
- Lokalnie na laptopie przy tarczy, poza gitem: `config.json` (kopia `config.example.json`) i `data/` (baza i backupy).
