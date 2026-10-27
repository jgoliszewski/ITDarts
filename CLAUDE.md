# ITDarts: wskazówki dla Claude

- Zacznij od [docs/STAN.md](docs/STAN.md): co jest gotowe, co niesprawdzone i co dalej. Aktualizuj go przy większych krokach.
- **Rozmowa i dokumentacja** po polsku. **UI aplikacji** tylko po angielsku.
- **Pojęcia** bierz z [GLOSSARY.md](GLOSSARY.md), łącznie z listami „Avoid”.
- **Decyzje** są w `docs/` (WIZJA, UI, STATYSTYKI, EFEKTY), a trudne do odwrócenia w `docs/adr/`.
- **Nowe tematy** przechodzą grilling (skill `grilling`), zanim trafią do kodu. Wynik grillingu spisujemy w `docs/` i zamykamy issue z podsumowaniem.
- **Uruchamianie i struktura:** [README.md](README.md). Przed commitem: `npm test` i `npm run typecheck`.
- **Bez prawdziwej tarczy:** `npm run dev:fake`. Symulator Board Managera działa na `http://localhost:3180`, a `/fake/throw?d=T20` i `/fake/takeout` służą do skryptów.
- **Zgłoszenia błędów** z menu „Report a bug” leżą w `bugs/*.json` ([UI.md](docs/UI.md#zgłaszanie-błędów)). Przy naprawie przeczytaj wszystkie, odtwórz mecz z `match.events` w teście, gdzie się da, i usuń plik w commicie z poprawką.
- **Commity:** krótko, po angielsku, w trybie rozkazującym.
