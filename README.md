# ITDarts

Biurowy system do gry w darta na tarczy Autodarts: zasady gier, stan meczu, wynik na dużym ekranie, Pilot w telefonie i statystyki. Wizja i decyzje są w [docs/](docs/), a pojęcia w [GLOSSARY.md](GLOSSARY.md).

## Uruchomienie na laptopie przy tarczy

Wymaga Node 24 LTS.

1. Skopiuj `config.example.json` do `config.json` i wpisz adres Board Managera (`board`).
2. Uruchom `start.bat`. Przy pierwszym starcie zainstaluje zależności, potem zbuduje front, uruchomi serwer na porcie 3000 i otworzy Edge w trybie kiosku.
3. Telefon w tej samej sieci skanuje QR z ekranu i przejmuje Pilota.

„Close app” w menu Pilota zamyka kiosk i serwer. Dane (SQLite, backupy) lądują w `data/`.

Efekty wyklikane na stronie `/effects` (reguły, dźwięki, stany bazowe ledów) serwer zapisuje od razu w `effects/` w repo. Żeby przenieść je na inny komputer, commitujesz i pushujesz `effects/`, a tam robisz pull. Działający serwer sam wczyta zmieniony plik. Adres WLED i przełączniki Sounds i LEDs zostają lokalnie. Szczegóły są w [EFEKTY.md](docs/EFEKTY.md#konfiguracja-w-repo).

### Konfiguracja (`config.json`)

| Pole | Znaczenie |
|---|---|
| `port` | Port serwera, domyślnie 3000. Otwórz go w zaporze Windows dla sieci prywatnej. |
| `board` | Adres Board Managera, `host:port`. Najlepiej z rezerwacją DHCP dla Raspberry Pi. |
| `dataDir` | Folder bazy i backupów. |
| `effectsDir` | Folder efektów w repo (`effects.json` i `sounds/`), domyślnie `effects`. |
| `extraBackupDir` | Drugi folder na backupy, np. zsynchronizowany OneDrive. `null` wyłącza. |
| `browser` | Ścieżka do przeglądarki kiosku. Domyślnie Edge, potem Chrome. |
| `ocheMeters` | Odległość od linii do tarczy w metrach do statystyki „Distance walked”. Domyślnie 2.37. |

## Development

```bash
npm install
npm run dev:fake
```

Uruchamia symulator Board Managera (`http://localhost:3180`, przyciski do rzucania lotek i takeoutu), serwer z przeładowaniem i Vite na `http://localhost:5173`. Z prawdziwą tarczą: `npm run dev`.

`dev:fake` uruchamia też atrapę WLED na `http://localhost:3190`, a sama atrapa startuje przez `npm run fake-wled`. Na stronie `/effects` wpisz adres `localhost:3190`.

### Zrzuty ekranu i testy na żywo: `npm run dev:shot`

Jednorazowa instancja obok Twojego deva, bez jego bazy i bez `effects/` z repo: atrapa tarczy na `3380`, atrapa WLED na `3390` i serwer na `3300` z gotowym webem (bez Vite). Dane i kopia `effects/` leżą w nowym folderze tymczasowym, adres WLED jest ustawiony, a presety wgrane. Po starcie skrypt wypisuje adresy i folder.

- **Koniec:** Ctrl+C zamyka trzy procesy, które sam uruchomił, i usuwa folder. Ze skryptu, bez konsoli: utwórz plik `stop` w folderze tymczasowym (Windows nie pozwala wysłać procesowi sygnału, na który mógłby odpowiedzieć).
- **Porty:** gdy 3300, 3380 lub 3390 jest zajęty, kończy się błędem i niczego nie zatrzymuje.
- **Flagi serwera:** `--effects <folder>` i `--web <folder>` (domyślnie `effects` i `dist/web`), obok `--data`, `--port` i `--board`.
- **Przełącznik atrapy w panelu tarczy:** startuje atrapę na porcie z adresu `--board`, gdy jest lokalny (w `dev:shot` 3380, więc nic nie wchodzi na 3180 Twojego deva), a w pozostałych przypadkach na 3180.
- **Nie zabijaj go twardo** (`taskkill /F` bez `/T`): procesy potomne i folder zostaną. Gdy już się stało, zwolnij porty po PID-ach z `netstat -ano`.

### Testy

```bash
npm test
npm run typecheck
```

## Struktura

- `games/`: czysta logika gier, bez I/O. Każda gra odtwarza mecz z logu zdarzeń ([ADR 0004](docs/adr/0004-log-zdarzen-i-sqlite.md)). X01 jest w `games/x01/`, a minigierki ([GRY.md](docs/GRY.md)) dzielą log tur z `games/turns.ts`. Katalog gier jest w `games/index.ts`.
- `server/`: Fastify, adapter Board Managera, SQLite (`node:sqlite`), websocket do przeglądarek, API statystyk. Efekty (reguły, Biblioteka dźwięków, WLED) są w `server/effects/`, a wyzwalacze w `games/effects.ts` ([EFEKTY.md](docs/EFEKTY.md)).
- `effects/`: konfiguracja efektów wyklikana na stronie, pod gitem. `effects.json` trzyma reguły, dźwięki i ustawienia, a `sounds/` pliki dźwięków.
- `bugs/`: zgłoszenia z „Report a bug” w menu, jeden plik JSON na zgłoszenie ([UI.md](docs/UI.md#zgłaszanie-błędów)).
- `assets/caller/<głos>/`: nagrania callera, czyli głosu sędziego w X01, jeden folder na głos ([EFEKTY.md](docs/EFEKTY.md#caller)). Co mówi, liczy `games/x01/caller.ts`.
- `web/`: React SPA. Ekran wyników i lobby na szerokim ekranie, Pilot na telefonie, `/stats` i `/effects` dla wszystkich.
