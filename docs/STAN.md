# ITDarts: stan prac

Stan na 2026-10-29. Aktualizuj przy każdym większym kroku.

## Gałęzie

- **`main`:** dokumentacja do `f996e74` (wizja, UI, statystyki).
- **`feat/v1`:** cała aplikacja v1, minigierki i dokumentacja efektów ([EFEKTY.md](EFEKTY.md)). PR do `main` otwieramy po testach z prawdziwą tarczą.

## Gotowe

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
- **Grilling hostingu** ([#8](https://github.com/jgoliszewski/ITDarts/issues/8), 2026-10-28): plan w [HOSTING.md](HOSTING.md), jeszcze nic nie zaimplementowane.
- **Grillingi:** UI ([#1](https://github.com/jgoliszewski/ITDarts/issues/1)), efekty ([#2](https://github.com/jgoliszewski/ITDarts/issues/2)), historia i statystyki ([#4](https://github.com/jgoliszewski/ITDarts/issues/4)), minigierki ([#3](https://github.com/jgoliszewski/ITDarts/issues/3), [GRY.md](GRY.md)).
- **Kod v1:**
  - silnik X01 z logiem zdarzeń, setami, bull-offem i checkoutami;
  - serwer z adapterem Board Managera i SQLite;
  - Ekran wyników, Pilot, setup, Players, Board panel, `/stats`.
- **Minigierki** według [GRY.md](GRY.md): ATC, Full Board, 121, Cricket, Killer, Higher or Lower, Random Checkouts i Shanghai.
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

  Testy: `npm test` (134), `npm run typecheck`.
- **Sprawdzone z symulatorem tarczy** (`npm run dev:fake`):
  - lobby, setup, rzuty, Poprawka, Undo, takeout, koniec legu i meczu, rematch;
  - przejęcie Pilota, End match z Save i Discard;
  - wznowienie po restarcie serwera, restart Board Managera, baner braku tarczy, statystyki.
- **Minigierki sprawdzone skryptem** przez websocket i symulator oraz zrzutami ekranu z headless Edge. Każda gra przeszła start, rzuty, takeout i koniec, a do tego Ekran rekordu, Reroll, „How to play” na ekranie, lobby, setup na telefonie i `/stats`. Nikt jeszcze w nie nie zagrał ręcznie.

## Do sprawdzenia przy efektach

- [ ] Dźwięk z prawdziwego pliku w kiosku Edge bez kliknięcia (flaga autoplay), także po kilku godzinach bezczynności.
- [ ] Prawdziwy kontroler WLED: czy `"end"` z presetem bazowym wraca do tła. Pobieranie `presets.json` działa (WLED 0.15.4).
- [x] Ledy Momentów na ringu (2026-10-29, [#10](https://github.com/jgoliszewski/ITDarts/issues/10)): presety 100–128 są na kontrolerze, ring tarczy to segment 0, podział na 48, oba ringi startują na godzinie 1 i idą zgodnie ze wskazówkami. Obejrzane w podglądzie `led-sim.html` z „Play on the ring”, poprawki z ringu w [MAPA.md](MAPA.md#przypisania).
- [ ] Ledy i dźwięki Momentów w meczu: czy efekty po lotce nie psują detekcji i takeoutu, dźwięki w kiosku (lista w [#10](https://github.com/jgoliszewski/ITDarts/issues/10), punkt 4).
- [ ] Upload dźwięku z telefonu (iOS Safari i Android) i odczyt długości pliku w przeglądarce.
- [ ] Czy animacje 180, 140+ i bust nie przeszkadzają na dużym ekranie przy prawdziwej grze.
- [ ] Caller na żywo w kiosku: czy słychać go wyraźnie obok efektów, czy „you require” nie wchodzi na arpeggio zmiany gracza i czy domyślne 80% głośności pasuje.
- [ ] Dźwięki wbudowane w meczu: głośność względem plików i callera, czy Treble po każdej trójce nie męczy w X01, czy 180 i Match won nie przesterowują na głośnikach.
- [ ] Przeniesienie konfiguracji: push z domu, pull w pracy przy działającym serwerze. Stany bazowe wskazują presety atrapy (1–4), więc w pracy trzeba je raz ustawić pod prawdziwy kontroler.

## Do sprawdzenia z prawdziwą tarczą

Format websocketu sprawdzony podsłuchem Board Managera v2.0.2 (2026-10-26):

- [x] `ws://BOARD/api/events` wysyła `{type:'state', data:{throws, event, status}}`, rzut to `{segment:{name, number, multiplier, bed}, coords:{x, y}}`, coords: 1 = 170 mm, y w górę. Poza tarczą: `bed: 'Outside'`, `multiplier: 0`.
- [x] Takeout w polu `event`: „Takeout started”, „Takeout finished”. Po 3 lotkach `status: 'Takeout'`.
- [x] `GET /api/version` zwraca `2.0.2`.
- [x] Od 2026-10-29 tarcza ma Board Managera 2.1.0, format websocketu sprawdzony podsłuchem 2.1.0: płaski rzut `{segmentNumber, multiplier, segmentName, coordsX, coordsY, bed, bouncer, failed, method}`, zdarzenia camelCase (`throwDetected`, `takeoutStarted`, `takeoutFinished`), `status` `throw`/`takeout`/`takeoutInProgress`, a `event` jest lepki (pierwsza lotka po takeoucie przychodzi jeszcze z `takeoutFinished`). Adapter czyta oba formaty (2.0.2 i 2.1.0); `bouncer` i `failed` ignorujemy, nazwa ręcznego resetu w 2.1.0 niepotwierdzona.
- [ ] Bull-off na prawdziwej tarczy: kolejność, takeout po lotce, odległości w mm zgodne z rzeczywistością.
- [ ] Pełny mecz X01 i jedna minigierka na prawdziwej tarczy.
- [ ] Reset, start i stop detekcji, kalibracja i restart przez API.
- [ ] Czy Board Manager wstaje sam po `sudo reboot` Raspberry Pi.
- [ ] `start.bat` i tryb kiosku w Edge (nigdy nie odpalony), otwarty port 3000 w zaporze, wejście z telefonu przez QR.

## Znane problemy

- W `npm run dev` Vite łączy się z serwerem z localhost, więc serwer bierze każdą przeglądarkę, także telefon, za kiosk. Dźwięki reguł grają wtedy też na telefonie. W `npm start` i w kiosku tego problemu nie ma.
- Kiosk trzyma zdekodowane dźwięki po nazwie pliku. Gdy dźwięk zostanie usunięty i w jego miejsce wgrany inny o tej samej nazwie, kiosk gra stary aż do przeładowania strony.
- W Co-op 121 podejście liczy się graczowi, który je zakończył: checkoutem albo ostatnią Turą.
- Gdy takeout i nowe lotki zdarzą się w czasie rozłączenia z Board Managerem, nowe lotki do liczby lotek sprzed rozłączenia przepadną (trzeba je wpisać ręcznie).

## Następne kroki

1. Testy z tarczą według listy powyżej (`npm run dev`, tarcza z `config.json` albo domyślnie `192.168.1.183:3180`), potem PR `feat/v1` → `main`.
2. Sprawdzenie efektów i callera z listy „Do sprawdzenia przy efektach”.
3. Zagrać w minigierki na prawdziwej tarczy i poprawić teksty „How to play” po pierwszych grach.
4. Otwarte issues:
   - [#6](https://github.com/jgoliszewski/ITDarts/issues/6): ranking;
   - [#7](https://github.com/jgoliszewski/ITDarts/issues/7): backlog minigierek;
   - [#9](https://github.com/jgoliszewski/ITDarts/issues/9): mapa Momentów, dźwięki i ledy. Postanowienia są w [MAPA.md](MAPA.md), a kod jest gotowy: nowe dźwięki, Reguły bazowe Next player, Hit, Miss i minigierek, presety ledów z kodu i symulator (`npm run led-sim`). Czeka na sprawdzenie przy tarczy, a potem na przeróbkę strony Effects i konfiguratora ([MAPA.md](MAPA.md#do-zrobienia)).
5. Hosting w internecie, gdy się zdecydujemy: plan i kolejność prac w [HOSTING.md](HOSTING.md), zaczynając od prototypu kiosku jako przekaźnika.

## Materiały poza repo

- Makiety UI: [ITDarts UI mockups](https://claude.ai/artifact/Bt8RmLqWv9733tb2nLkPQK).
- Lokalnie na laptopie przy tarczy, poza gitem: `config.json` (kopia `config.example.json`) i `data/` (baza i backupy).
