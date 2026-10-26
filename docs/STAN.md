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

  Testy: `npm test` (58), `npm run typecheck`.
- **Sprawdzone z symulatorem tarczy** (`npm run dev:fake`):
  - lobby, setup, rzuty, Poprawka, Undo, takeout, koniec legu i meczu, rematch;
  - przejęcie Pilota, End match z Save i Discard;
  - wznowienie po restarcie serwera, restart Board Managera, baner braku tarczy, statystyki.
- **Minigierki sprawdzone skryptem** przez websocket i symulator oraz zrzutami ekranu z headless Edge. Każda gra przeszła start, rzuty, takeout i koniec, a do tego Ekran rekordu, Reroll, „How to play” na ekranie, lobby, setup na telefonie i `/stats`. Nikt jeszcze w nie nie zagrał ręcznie.

## Do sprawdzenia z prawdziwą tarczą

Adapter ([server/board.ts](../server/board.ts)) opiera się na założeniach, których nie sprawdziliśmy na Board Managerze v2.0.2:

- [ ] Websocket `ws://BOARD/api/events` wysyła `{type:'state', data:{throws, event, status | running}}`, a rzut ma postać `{segment:{number, multiplier}, coords:{x, y}}`. Jeśli format jest inny, poprawić `BmThrow`, `toDart` i `onState` w `board.ts`.
- [ ] Takeout przychodzi w polu `event` jako „Takeout started” i „Takeout finished”.
- [ ] `GET /api/version` istnieje. Jeśli nie, panel pokaże pustą wersję i nic się nie zepsuje.
- [ ] Reset, start i stop detekcji, kalibracja i restart przez API.
- [ ] Czy Board Manager wstaje sam po `sudo reboot` Raspberry Pi.
- [ ] `start.bat` i tryb kiosku w Edge (nigdy nie odpalony), otwarty port 3000 w zaporze, wejście z telefonu przez QR.

## Znane problemy

- Wyzwalacze minigierek z [GRY.md](GRY.md) („Target hit”, „Life lost” itd.) czekają na system efektów. Silnik nie zgłasza jeszcze zdarzeń, więc dojdą razem z [EFEKTY.md](EFEKTY.md).
- Remis w ATC i Full Board zapisuje mecz bez zwycięzcy, więc nie wchodzi do winrate.
- W Co-op 121 podejście liczy się graczowi, który je zakończył: checkoutem albo ostatnią Turą.

- Gdy Pilot wciśnie „Next player” przed takeoutem, a Board Manager rozłączy się i połączy, zanim lotki zostaną wyjęte, stare lotki mogą wpaść następnemu graczowi.
- Na szerokim ekranie przyciski w Board panelu mogłyby mieć większe czcionki.

## Następne kroki

1. Testy z tarczą według listy powyżej, poprawki adaptera, potem PR `feat/v1` → `main`.
2. Implementacja efektów według [EFEKTY.md](EFEKTY.md): strona `/effects`, Biblioteka dźwięków, WLED, animacje, caller. Jeszcze nic nie jest zakodowane.
3. Zagrać w minigierki na prawdziwej tarczy i poprawić teksty „How to play” po pierwszych grach.
4. Otwarte issues:
   - [#5](https://github.com/jgoliszewski/ITDarts/issues/5): paczka callera i dźwięków efektów;
   - [#6](https://github.com/jgoliszewski/ITDarts/issues/6): ranking;
   - [#7](https://github.com/jgoliszewski/ITDarts/issues/7): backlog minigierek.

## Materiały poza repo

- Makiety UI: [ITDarts UI mockups](https://claude.ai/artifact/Bt8RmLqWv9733tb2nLkPQK).
- Lokalnie na laptopie przy tarczy, poza gitem: `config.json` (kopia `config.example.json`) i `data/` (baza i backupy).
