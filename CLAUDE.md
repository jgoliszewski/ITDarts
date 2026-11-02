# ITDarts: wskazówki dla Claude

- Zacznij od [docs/STAN.md](docs/STAN.md): co jest gotowe, co niesprawdzone i co dalej. Aktualizuj go przy większych krokach.
- **Rozmowa i dokumentacja** po polsku. **UI aplikacji** tylko po angielsku.
- **Pojęcia** bierz z [GLOSSARY.md](GLOSSARY.md), łącznie z listami „Avoid”.
- **Decyzje** są w `docs/` (WIZJA, UI, STATYSTYKI, EFEKTY), a trudne do odwrócenia w `docs/adr/`.
- **Nowe tematy** przechodzą grilling (skill `grilling`), zanim trafią do kodu. Wynik grillingu spisujemy w `docs/` i zamykamy issue z podsumowaniem.
- **Uruchamianie i struktura:** [README.md](README.md). Przed commitem: `npm test` i `npm run typecheck`.
- **Zrzuty ekranu i testy na żywo:** przez `npm run dev:shot` (osobna instancja na 3300, własna baza i kopia `effects/`, [README.md](README.md#zrzuty-ekranu-i-testy-na-żywo-npm-run-devshot)), nie przez `dev` ani na porcie użytkownika.
- **Bez prawdziwej tarczy:** `npm run dev:fake`. Symulator Board Managera działa na `http://localhost:3180`, a `/fake/throw?d=T20` i `/fake/takeout` służą do skryptów.
- **Zgłoszenia błędów** z menu „Report a bug” leżą w `bugs/*.json` ([UI.md](docs/UI.md#zgłaszanie-błędów)). Przy naprawie przeczytaj wszystkie, odtwórz mecz z `match.events` w teście, gdzie się da, i usuń plik w commicie z poprawką.
- **Zrzuty ekranu jako dowód:** gdy poprawka zmienia ekran, zrób zrzuty od nowa. Nie oddawaj tych sprzed poprawki.
- **Nowy Moment:** ustaw go w `ORDER` (`games/effects.ts`) przed Momentami, które padają tą samą lotką (np. `matchWon`), bo hub gra tylko jedną regułę. Dodaj test `pickRule`, który sprawdza, że wygrywa nowy Moment ([EFEKTY.md](docs/EFEKTY.md)).
- **Commity:** krótko, po angielsku, w trybie rozkazującym.
