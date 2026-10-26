# ITDarts: wizja systemu (etap 1)

Postanowienia z grillingu z 2026-10-23. Pojęcia są zdefiniowane w [GLOSSARY.md](../GLOSSARY.md), a decyzje trudne do odwrócenia w [docs/adr](adr/).

## Czym jest

Własny biurowy system do gry w darta na tarczy Autodarts w biurze ITBOOM. Zastępuje oficjalne UI Autodarts przy grze lokalnej.

Po co:
- Część gier w oficjalnym UI wymaga subskrypcji.
- Chcemy dodawać własne gry (np. 121).

Skala: jedno biuro i jedna tarcza. Nie sprzedajemy tego produktu.

## Zakres

W zakresie:
- zasady gier, stan meczu i prezentacja wyniku
- poprawianie i dopisywanie rzutów
- panel tarczy (patrz niżej)
- gry dopisywane jako moduły w kodzie

Poza zakresem:
- gra online w oficjalnym Autodarts
- wymiana danych z kontem Autodarts, w obie strony
- edytor gier w UI
- logowanie i konta dostępowe
- wiele tarcz lub biur
- ustawienia Board Managera (zostają w oficjalnym panelu `:3180`)

## Granica z Autodarts

**Board Manager** (Raspberry Pi w LAN) odpowiada za kamery, detekcję lotek i eventy (`Throw detected`, `Takeout started/finished`, `Manual reset`). Nie modyfikujemy go.

**ITDarts** odpowiada za wszystko powyżej detekcji.

Rzuty z Board Managera traktujemy jako podpowiedź. Po ręcznej poprawce lub dopisaniu rzutu obowiązuje wersja ITDarts, a z Board Managera bierzemy już tylko nowe rzuty ([ADR 0002](adr/0002-itdarts-nadpisuje-detekcje.md)).

Akceptujemy, że Board Manager przy starcie wymaga połączenia z chmurą Autodarts. Gdy chmura nie działa, nie gramy. Nie budujemy obejścia.

### Panel tarczy

ITDarts wywołuje lokalne API Board Managera przez serwer, nigdy bezpośrednio z przeglądarki.

| Akcja | Endpoint | Potwierdzenie |
|---|---|---|
| Reset | `POST /api/reset` | nie |
| Start/stop detekcji | `PUT /api/start`, `PUT /api/stop` | nie |
| Kalibracja | `POST /api/config/calibration/auto` (~60 s) | tak |
| Restart Board Managera | `POST /api/restart` | tak |

Panel pokazuje też status połączenia z tarczą. Podgląd kamer pominęliśmy. Dodamy go, gdy kalibracja zacznie sprawiać problemy.

## Gdzie i jak działa

- **Serwer:** jeden lokalny proces na dotykowym laptopie z Windowsem, który stoi przy tarczy. Z Raspberry Pi łączy się po LAN.
- **Źródło prawdy:** serwer jest jedynym klientem websocketu Board Managera i jedynym miejscem, w którym żyje stan meczu oraz logika gier ([ADR 0001](adr/0001-lokalny-serwer-zrodlem-prawdy.md)).
- **Przeglądarki:** to wyłącznie widoki. Wysyłają komendy i dostają gotowy stan.
  - **Ekran wyników:** tylko wyświetla mecz.
  - **Pilot:** zawsze dokładnie jeden. Domyślnie jest nim laptop. Każde urządzenie może przejąć pilota przyciskiem „Przejmij pilota”, a poprzedni pilot od razu przechodzi w podgląd. Telefon wchodzi przez kod QR wyświetlany na ekranie.
- **Dostęp:** każdy w biurowym LAN, bez logowania.
- **Offline:** działa bez internetu. Nie ładuje niczego z CDN, fontów z sieci ani zewnętrznych API.
- **Odporność na awarie:**
  - Gdy Board Manager się rozłączy, serwer sam ponawia połączenie, a ekrany pokazują „brak tarczy”. Mecz trwa dalej na rzutach wpisywanych ręcznie z pilota.
  - Bieżący mecz trafia do bazy SQLite po każdym zdarzeniu i jest wczytywany po starcie, więc mecz przetrwa restart serwera lub laptopa ([ADR 0004](adr/0004-log-zdarzen-i-sqlite.md)).
- **Uruchamianie:** ręcznie, skryptem `start.bat`. Uruchamia serwer i otwiera przeglądarkę w trybie `--kiosk`. Autostart przy logowaniu dodamy, gdy ręczne odpalanie zacznie przeszkadzać.

## Stack

Wybrany pod pisanie przez AI ([ADR 0003](adr/0003-stack-pod-vibe-coding.md)):

- **Front:** TypeScript, React i Vite (SPA). Interfejs minimalistyczny, z animacjami i efektami tam, gdzie mają sens (np. `motion`, `canvas-confetti`).
- **Serwer:** Node LTS, Fastify, `@fastify/websocket`, `@fastify/static`, uruchamiany przez `tsx`.
- **Repo:** jedno repo z jednym `package.json` i katalogami `server/`, `web/`, `games/`.

## Do sprawdzenia ręcznie przed developmentem

- [ ] Czy na Board Managerze v2.0.2 działają kalibracja i restart przez API. Dla resetu mamy dowód, a dla reszty tylko deklarację z kodu HomeDarts.
- [ ] Czy usługa Board Managera wstaje sama po `sudo reboot` Raspberry Pi.

## Etap 2

- **UI:** ustalone w [UI.md](UI.md).
- **Efekty:** dźwięki, ledy WLED, animacje i caller ustalone w [EFEKTY.md](EFEKTY.md). Paczka nagrań callera: [#5](https://github.com/jgoliszewski/ITDarts/issues/5).
- **Gry:** X01 (sety, legi) oraz minigierki ustalone w [GRY.md](GRY.md). Backlog kolejnych: [#7](https://github.com/jgoliszewski/ITDarts/issues/7).
- **Zapis wyników:** gracze, historia meczów i statystyki ustalone w [STATYSTYKI.md](STATYSTYKI.md). Ranking odłożony do [#6](https://github.com/jgoliszewski/ITDarts/issues/6).
- **Dodatki:** Slack/Teams. Podpowiedzi checkoutu są w [UI.md](UI.md).
- **Poprawki:** UX poprawiania pojedynczej lotki ustalony w [UI.md](UI.md).
- **Prototyp:** `index.html` zostaje w repo dla porównania. Aplikacja żyje w `server/`, `web/` i `games/` (patrz [README](../README.md)).
