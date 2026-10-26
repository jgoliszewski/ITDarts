# ITDarts: stan prac

Stan na 2026-10-26. Aktualizuj przy każdym większym kroku.

## Gałęzie

- **`main`:** dokumentacja do `f996e74` (wizja, UI, statystyki).
- **`feat/v1`:** cała aplikacja v1, minigierki i dokumentacja efektów ([EFEKTY.md](EFEKTY.md)). PR do `main` otwieramy po testach z prawdziwą tarczą.

## Gotowe

- **Grillingi:** UI ([#1](https://github.com/jgoliszewski/ITDarts/issues/1)), efekty ([#2](https://github.com/jgoliszewski/ITDarts/issues/2)), historia i statystyki ([#4](https://github.com/jgoliszewski/ITDarts/issues/4)), minigierki ([#3](https://github.com/jgoliszewski/ITDarts/issues/3), [GRY.md](GRY.md)).
- **Kod v1:**
  - silnik X01 z logiem zdarzeń, setami, bull-offem i checkoutami;
  - serwer z adapterem Board Managera i SQLite;
  - Ekran wyników, Pilot, setup, Players, Board panel, `/stats`.
- **Minigierki** według [GRY.md](GRY.md): ATC, Full Board, 121, Cricket, Killer i Higher or Lower.
  - Gry dzielą log tur z `games/turns.ts`. Każda jest czystą funkcją logu, więc Poprawka i Undo działają wszędzie.
  - Gotowe są też Co-op, Ekran rekordu ze „Skip”, „New record” na ekranie wygranej, „How to play” w setupie i w menu Pilota razem z „Show on screen”, podpowiedzi „i” przy opcjach i Reroll numerów w Killer.
  - Setup pamięta opcje osobno dla każdej gry i stawia ostatnio graną grę na początku listy.
  - Migracja 2 bazy dodaje `matches.variant` oraz `match_players.score` i `stats`.
  - `/stats` ma wybór gry, top 10 per wariant i statystyki gracza w danej grze. Profil X01, winrate i head-to-head liczą tylko X01.

- **Bull-off z tarczy** ([UI.md](UI.md#bull-off-z-tarczy)): odległość z coords, Closest i PDC, remisy, takeout po każdej lotce. Symulator ma klikalną tarczę z prawdziwymi coords.
- **Karta tury i swoosh** z pierwszych testów ([UI.md](UI.md#tura-i-takeout), [EFEKTY.md](EFEKTY.md#wbudowane-dźwięki)):
  - Karta pokazuje werdykt („Checkout”, „Bust”, „Life lost”, „Out”, „N marks”) albo wynik Tury od ostatniej lotki do końca takeoutu.
  - 121 i Higher or Lower trzymają cel, życia i zakres do zamknięcia Tury.
  - Kiosk gra swoosh z WebAudio przy każdej zmianie gracza (`turnPass` w stanie meczu), a kiosk Edge dostał flagę `--autoplay-policy`.
  - Swoosh wycisza przełącznik Sounds albo jego własny przełącznik na `/effects`. Głośność bierze z poziomu efektów.
  - Sprawdzone skryptem z symulatorem: checkout i bust w 121, Tura X01 z „Next player”.
- **Efekty** według [EFEKTY.md](EFEKTY.md), bez callera:
  - **Wyzwalacze:** każda gra zwraca wystąpienia z logu (`games/effects.ts`, `happenings` w modułach), a hub odpala nowe i zmienione. Tak samo działają minigierki, w tym „New record”. Takeout, start meczu i status tarczy zgłasza hub.
  - **Reguły i Biblioteka dźwięków:** migracja 3 dodaje tabele `settings`, `sounds` i `effect_rules`. Pliki leżą w `data/sounds/`, a backup kopiuje je do `backups/sounds/`.
  - **Strona `/effects`:** reguły z edytorem wyzwalaczy i „Test”, upload, odsłuch, nazwa i głośność dźwięków, WLED z presetami i stanami bazowymi, sekcja „Playback”.
  - **Pilot:** Sounds i LEDs w menu, trzymane przez serwer.
  - **Animacje:** 180, 140+, bust, konfetti, błysk kafelka T20 i Bull, wejście ekranu końca legu.
  - **Sprawdzone** skryptem przez websocket z symulatorem tarczy i atrapą WLED (`npm run fake-wled`): reguły 180 i T20, Poprawka S20 ↔ T20, Undo, Sounds off, powrót WLED do stanu bazowego. Do tego zrzuty strony `/effects`, edytora, menu i animacji.
- **Menu** rozdzielone na menu meczu i ogólne; Board panel, Players i Stats mają własne przyciski. Gracz w Players pokazuje swoje statystyki.

  Testy: `npm test` (88), `npm run typecheck`.

## Do sprawdzenia przy efektach

- [ ] Dźwięk z prawdziwego pliku w kiosku Edge bez kliknięcia (flaga autoplay), także po kilku godzinach bezczynności.
- [ ] Prawdziwy kontroler WLED: czy `"end"` z presetem bazowym wraca do tła i czy pobieranie `presets.json` działa na jego wersji.
- [ ] Upload dźwięku z telefonu (iOS Safari i Android) i odczyt długości pliku w przeglądarce.
- [ ] Czy animacje 180, 140+ i bust nie przeszkadzają na dużym ekranie przy prawdziwej grze.
- **Sprawdzone z symulatorem tarczy** (`npm run dev:fake`):
  - lobby, setup, rzuty, Poprawka, Undo, takeout, koniec legu i meczu, rematch;
  - przejęcie Pilota, End match z Save i Discard;
  - wznowienie po restarcie serwera, restart Board Managera, baner braku tarczy, statystyki.
- **Minigierki sprawdzone skryptem** przez websocket i symulator oraz zrzutami ekranu z headless Edge. Każda gra przeszła start, rzuty, takeout i koniec, a do tego Ekran rekordu, Reroll, „How to play” na ekranie, lobby, setup na telefonie i `/stats`. Nikt jeszcze w nie nie zagrał ręcznie.

## Do sprawdzenia z prawdziwą tarczą

Format websocketu sprawdzony podsłuchem Board Managera v2.0.2 (2026-10-26):

- [x] `ws://BOARD/api/events` wysyła `{type:'state', data:{throws, event, status}}`, rzut to `{segment:{name, number, multiplier, bed}, coords:{x, y}}`, coords: 1 = 170 mm, y w górę. Poza tarczą: `bed: 'Outside'`, `multiplier: 0`.
- [x] Takeout w polu `event`: „Takeout started”, „Takeout finished”. Po 3 lotkach `status: 'Takeout'`.
- [x] `GET /api/version` zwraca `2.0.2`.
- [ ] Bull-off na prawdziwej tarczy: kolejność, takeout po lotce, odległości w mm zgodne z rzeczywistością.
- [ ] Pełny mecz X01 i jedna minigierka na prawdziwej tarczy.
- [ ] Reset, start i stop detekcji, kalibracja i restart przez API.
- [ ] Czy Board Manager wstaje sam po `sudo reboot` Raspberry Pi.
- [ ] `start.bat` i tryb kiosku w Edge (nigdy nie odpalony), otwarty port 3000 w zaporze, wejście z telefonu przez QR.

## Znane problemy

- W `npm run dev` Vite łączy się z serwerem z localhost, więc serwer bierze każdą przeglądarkę, także telefon, za kiosk. Dźwięki reguł grają wtedy też na telefonie. W `npm start` i w kiosku tego problemu nie ma.
- Remis w ATC i Full Board zapisuje mecz bez zwycięzcy, więc nie wchodzi do winrate.
- W Co-op 121 podejście liczy się graczowi, który je zakończył: checkoutem albo ostatnią Turą.

- Gdy Pilot wciśnie „Next player” przed takeoutem, a Board Manager rozłączy się i połączy, zanim lotki zostaną wyjęte, stare lotki mogą wpaść następnemu graczowi.
- Na szerokim ekranie przyciski w Board panelu mogłyby mieć większe czcionki.

## Następne kroki

1. Testy z tarczą według listy powyżej (`npm run dev`, tarcza z `config.json` albo domyślnie `192.168.1.183:3180`), potem PR `feat/v1` → `main`.
2. Caller według [EFEKTY.md](EFEKTY.md#caller), gdy w [#5](https://github.com/jgoliszewski/ITDarts/issues/5) będzie paczka nagrań. Wystąpienia, z których będzie mówił, już są. Do tego sprawdzenie efektów z listy „Do sprawdzenia przy efektach”.
3. Zagrać w minigierki na prawdziwej tarczy i poprawić teksty „How to play” po pierwszych grach.
4. Otwarte issues:
   - [#5](https://github.com/jgoliszewski/ITDarts/issues/5): paczka callera i dźwięków efektów;
   - [#6](https://github.com/jgoliszewski/ITDarts/issues/6): ranking;
   - [#7](https://github.com/jgoliszewski/ITDarts/issues/7): backlog minigierek.

## Materiały poza repo

- Makiety UI: [ITDarts UI mockups](https://claude.ai/artifact/Bt8RmLqWv9733tb2nLkPQK).
- Lokalnie na laptopie przy tarczy, poza gitem: `config.json` (kopia `config.example.json`) i `data/` (baza i backupy).
