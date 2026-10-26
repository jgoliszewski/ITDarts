# ITDarts

Biurowy system do gry w darta na tarczy Autodarts: zasady gier, stan meczu, wynik na dużym ekranie, Pilot w telefonie i statystyki. Wizja i decyzje są w [docs/](docs/), a pojęcia w [GLOSSARY.md](GLOSSARY.md).

## Uruchomienie na laptopie przy tarczy

Wymaga Node 24 LTS.

1. Skopiuj `config.example.json` do `config.json` i wpisz adres Board Managera (`board`).
2. Uruchom `start.bat`. Przy pierwszym starcie zainstaluje zależności, potem zbuduje front, uruchomi serwer na porcie 3000 i otworzy Edge w trybie kiosku.
3. Telefon w tej samej sieci skanuje QR z ekranu i przejmuje Pilota.

„Close app” w menu Pilota zamyka kiosk i serwer. Dane (SQLite, backupy) lądują w `data/`.

### Konfiguracja (`config.json`)

| Pole | Znaczenie |
|---|---|
| `port` | Port serwera, domyślnie 3000. Otwórz go w zaporze Windows dla sieci prywatnej. |
| `board` | Adres Board Managera, `host:port`. Najlepiej z rezerwacją DHCP dla Raspberry Pi. |
| `dataDir` | Folder bazy i backupów. |
| `extraBackupDir` | Drugi folder na backupy, np. zsynchronizowany OneDrive. `null` wyłącza. |
| `browser` | Ścieżka do przeglądarki kiosku. Domyślnie Edge, potem Chrome. |

## Development

```bash
npm install
npm run dev:fake
```

Uruchamia symulator Board Managera (`http://localhost:3180`, przyciski do rzucania lotek i takeoutu), serwer z przeładowaniem i Vite na `http://localhost:5173`. Z prawdziwą tarczą: `npm run dev`.

Ledy bez kontrolera: `npm run fake-wled` uruchamia atrapę WLED na `http://localhost:3190`. Na stronie `/effects` wpisz adres `localhost:3190`.

```bash
npm test
npm run typecheck
```

## Struktura

- `games/`: czysta logika gier, bez I/O. Każda gra odtwarza mecz z logu zdarzeń ([ADR 0004](docs/adr/0004-log-zdarzen-i-sqlite.md)). X01 jest w `games/x01/`, a minigierki ([GRY.md](docs/GRY.md)) dzielą log tur z `games/turns.ts`. Katalog gier jest w `games/index.ts`.
- `server/`: Fastify, adapter Board Managera, SQLite (`node:sqlite`), websocket do przeglądarek, API statystyk. Efekty (reguły, Biblioteka dźwięków, WLED) są w `server/effects/`, a wyzwalacze w `games/effects.ts` ([EFEKTY.md](docs/EFEKTY.md)).
- `web/`: React SPA. Ekran wyników i lobby na szerokim ekranie, Pilot na telefonie, `/stats` i `/effects` dla wszystkich.
- `index.html`: pierwszy prototyp X01, zostawiony dla porównania.
