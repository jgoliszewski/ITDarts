# ITDarts: stan prac

Stan na 2026-10-26. Aktualizuj przy każdym większym kroku.

## Gałęzie

- **`main`:** dokumentacja do `f996e74` (wizja, UI, statystyki).
- **`feat/v1`:** cała aplikacja v1 i dokumentacja efektów ([EFEKTY.md](EFEKTY.md)). PR do `main` otwieramy po testach z prawdziwą tarczą.

## Gotowe

- **Grillingi:** UI ([#1](https://github.com/jgoliszewski/ITDarts/issues/1)), efekty ([#2](https://github.com/jgoliszewski/ITDarts/issues/2)), historia i statystyki ([#4](https://github.com/jgoliszewski/ITDarts/issues/4)), minigierki ([#3](https://github.com/jgoliszewski/ITDarts/issues/3), [GRY.md](GRY.md)).
- **Kod v1:**
  - silnik X01 z logiem zdarzeń, setami, bull-offem i checkoutami;
  - serwer z adapterem Board Managera i SQLite;
  - Ekran wyników, Pilot, setup, Players, Board panel, `/stats`.

  Testy: `npm test` (28), `npm run typecheck`.
- **Sprawdzone z symulatorem tarczy** (`npm run dev:fake`):
  - lobby, setup, rzuty, Poprawka, Undo, takeout, koniec legu i meczu, rematch;
  - przejęcie Pilota, End match z Save i Discard;
  - wznowienie po restarcie serwera, restart Board Managera, baner braku tarczy, statystyki.

## Do sprawdzenia z prawdziwą tarczą

Adapter ([server/board.ts](../server/board.ts)) opiera się na założeniach, których nie sprawdziliśmy na Board Managerze v2.0.2:

- [ ] Websocket `ws://BOARD/api/events` wysyła `{type:'state', data:{throws, event, status | running}}`, a rzut ma postać `{segment:{number, multiplier}, coords:{x, y}}`. Jeśli format jest inny, poprawić `BmThrow`, `toDart` i `onState` w `board.ts`.
- [ ] Takeout przychodzi w polu `event` jako „Takeout started” i „Takeout finished”.
- [ ] `GET /api/version` istnieje. Jeśli nie, panel pokaże pustą wersję i nic się nie zepsuje.
- [ ] Reset, start i stop detekcji, kalibracja i restart przez API.
- [ ] Czy Board Manager wstaje sam po `sudo reboot` Raspberry Pi.
- [ ] `start.bat` i tryb kiosku w Edge (nigdy nie odpalony), otwarty port 3000 w zaporze, wejście z telefonu przez QR.

## Znane problemy

- Gdy Pilot wciśnie „Next player” przed takeoutem, a Board Manager rozłączy się i połączy, zanim lotki zostaną wyjęte, stare lotki mogą wpaść następnemu graczowi.
- Na szerokim ekranie przyciski w Board panelu mogłyby mieć większe czcionki.

## Następne kroki

1. Testy z tarczą według listy powyżej, poprawki adaptera, potem PR `feat/v1` → `main`.
2. Implementacja efektów według [EFEKTY.md](EFEKTY.md): strona `/effects`, Biblioteka dźwięków, WLED, animacje, caller. Jeszcze nic nie jest zakodowane.
3. Implementacja minigierek według [GRY.md](GRY.md): ATC, Full Board, 121, Cricket, Killer, Higher or Lower, Co-op, Ekran rekordu, „How to play”.
4. Otwarte issues:
   - [#5](https://github.com/jgoliszewski/ITDarts/issues/5): paczka callera i dźwięków efektów;
   - [#6](https://github.com/jgoliszewski/ITDarts/issues/6): ranking;
   - [#7](https://github.com/jgoliszewski/ITDarts/issues/7): backlog minigierek.

## Materiały poza repo

- Makiety UI: [ITDarts UI mockups](https://claude.ai/artifact/Bt8RmLqWv9733tb2nLkPQK).
- Lokalnie na laptopie przy tarczy, poza gitem: `config.json` (kopia `config.example.json`) i `data/` (baza i backupy).
