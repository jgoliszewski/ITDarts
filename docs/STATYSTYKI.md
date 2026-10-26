# ITDarts: historia gier i statystyki (etap 2)

Postanowienia z grillingu z 2026-10-25 ([#4](https://github.com/jgoliszewski/ITDarts/issues/4)). Pojęcia są zdefiniowane w [GLOSSARY.md](../GLOSSARY.md), model danych w [ADR 0004](adr/0004-log-zdarzen-i-sqlite.md), a UI w [UI.md](UI.md).

## Co zapisujemy

- **Bieżący mecz** to log zdarzeń w SQLite, zapisywany po każdym zdarzeniu.
- **Po zakończeniu meczu** log jest kompaktowany do obowiązujących lotek. Nie trzymamy oryginalnej detekcji ani informacji, czy lotkę wpisano ręcznie.
- **Kontekst meczu:** gra i jej opcje, gracze w kolejności rzucania, kto zaczynał, data, status.
- **Lotka:** segment i mnożnik, gracz, numer w turze, czas, wynik przed i po, bust.
- **Współrzędne** z Board Managera zapisujemy, gdy przychodzą, tylko przy rzutach niepoprawianych i niedopisanych ręcznie. Na razie nic ich nie wyświetla (kiedyś heatmapy).

## Gracze

- **Gracz** (zarejestrowany): profil zakładany wcześniej, wybierany przy starcie meczu. Zbieramy jego statystyki.
  - Zakładanie na ekranie „Players” w menu Pilota albo przyciskiem „New player” w setupie meczu.
  - Stałe ID i unikalne imię (bez względu na wielkość liter). Zmiana imienia nie rusza historii.
  - Scalanie dwóch profili z potwierdzeniem.
- **Gość:** „Add guest” w setupie dodaje imię tylko na ten mecz (domyślnie „Guest 1”). Od gości nie zbieramy żadnych statystyk. Gościnnych meczów nie da się podpiąć pod profil założony później.
- **Usuwanie:**
  - archiwizacja ukrywa gracza z list i chipów, statystyki zostają;
  - anonimizacja na życzenie zmienia imię na „Deleted player”;
  - meczów nie usuwamy, bo psułoby to statystyki pozostałych.

## Co wchodzi do statystyk

- **Statystyki rzutowe** (średnie, liczniki, checkouty) zarejestrowanych graczy liczą się zawsze, także w meczach z gośćmi i w grze solo.
- **Winrate i head-to-head:** tylko zakończone mecze, w których grało co najmniej dwóch graczy i wszyscy są zarejestrowani.
- **„End match” w trakcie meczu** pyta, czy zapisać mecz do statystyk:
  - „Discard” usuwa mecz całkowicie, także z historii;
  - „Save” dodaje wszystkie tury do statystyk rzutowych. Checkout %, najkrótszy leg i rekordy liczą tylko dokończone legi. Mecz nie wchodzi do winrate.
- „End match” po skończonym legu bez match mode to zwykły koniec meczu i o nic nie pyta.

## Statystyki X01

| Statystyka | Jak liczymy |
|---|---|
| Średnia | Punkty ÷ lotki × 3. Bust to 0 punktów, a jego lotki się liczą. |
| Średnia z pierwszych 9 | Jak wyżej, z pierwszych trzech tur legu. |
| Średnia until 170 | Jak wyżej, z całych tur zaczętych z wynikiem powyżej 170, łącznie z turą, która schodzi poniżej. Leg zaczęty od 170 lub mniej jej nie daje. |
| Checkout % | Udane checkouty ÷ lotki rzucone przy wyniku do skończenia jedną lotką. |
| Najwyższy checkout | Największy wynik zamknięty jedną turą. |
| Najkrótszy leg | Najmniej lotek w wygranym legu. |
| 100+, 140+, 180 | Liczba tur z co najmniej taką sumą. |
| Winrate, head-to-head | Wygrane ÷ mecze według zasad wyżej. |

Definicji średniej until 170 nie znaleźliśmy w żadnym oficjalnym źródle. Przyjęliśmy najczęstszy podział legu na fazę punktowania i fazę checkoutu, bez cięcia tury w połowie.

Później, bez zmian w modelu (policzą się wstecz): skuteczność na poszczególnych double, bust rate, heatmapy.

## Okna

- **Czasowe:** 7 dni, 30 dni, 3 miesiące, rok, all time.
- **W legach:** ostatnie 10, ostatnie 100, all.

## Inne gry

Każdy moduł gry w `games/` definiuje swoje statystyki liczone z zapisanych lotek, np. MPR w Cricket albo rekord w ATC. Lista, rekordy i tabele na `/stats` są w [GRY.md](GRY.md).

## Prezentacja

- Widok „Stats” jest tylko do odczytu i otwiera się z dowolnego urządzenia w LAN bez przejmowania Pilota.
- Zawartość: lista graczy, profil gracza z oknami, head-to-head.
- Telefon pamięta wybór „to ja” i otwiera się od razu na tym profilu.
- W trakcie meczu Ekran wyników pokazuje tylko to, co ustala [UI.md](UI.md). Historii tam nie ma.
- Makiety widoku robimy przy implementacji statystyk.

## Backup

- Serwer kopiuje bazę przy starcie i po każdym zakończonym meczu do folderu `backups/` i trzyma ostatnie 30 kopii.
- Opcjonalny drugi folder z konfiguracji, np. zsynchronizowany OneDrive.
- Eksportu CSV/JSON nie robimy, bo plik SQLite sam w sobie jest eksportem.

## Poza zakresem

- Ranking: [#6](https://github.com/jgoliszewski/ITDarts/issues/6).
- Import historii z konta Autodarts.
