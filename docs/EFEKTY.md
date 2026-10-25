# ITDarts: efekty, ledy i caller (etap 2)

Postanowienia z grillingu z 2026-10-25 ([#2](https://github.com/jgoliszewski/ITDarts/issues/2)). Pojęcia są zdefiniowane w [GLOSSARY.md](../GLOSSARY.md), a UI w [UI.md](UI.md).

Wzorujemy się na Tools for Autodarts, darts-caller i darts-wled, ale ich ustawień nie importujemy. Eksport z obecnego pluginu służy jako ściągawka.

## Wyzwalacze

Listę wyzwalaczy definiuje kod: moduł gry zgłasza zdarzenia. W UI tylko przypisujemy do nich efekty.

| Wyzwalacz | Przykład | Gry |
|---|---|---|
| Lotka | T20, Bull, 25, dowolna podwójna, Miss | wszystkie |
| Suma tury | 180, 26, 0 („no score”) | X01 |
| Próg lub przedział tury | 100+, 140+, 100–170 | X01 |
| Kombinacja | 1-5-20, T20 · T20 · Bull | X01 |
| Bust | | X01 |
| Checkout / wygrany leg | | wszystkie |
| Wygrany set, wygrany mecz | | wszystkie |
| Start meczu, start legu | | wszystkie |
| Takeout | start, koniec | wszystkie |
| Tarcza | offline, online | wszystkie |

- **Kombinacja** to trzy pola wybierane klawiaturą z poprawki lotki. Pole jest konkretne (S20) albo „dowolne 20” (S, D lub T). Przełącznik „Kolejność ma znaczenie” jest domyślnie wyłączony.
- **Warunek checkoutu** przy wyzwalaczach tury (suma, próg, kombinacja): „Any”, „Only checkout” albo „No checkout”.
  - Ton+ finish to przedział 100–170 z „Only checkout”.
  - Big Fish to suma 170 z „Only checkout”, bo 170 da się zamknąć tylko jako T20 · T20 · Bull.
- **Minigierki** dopiszą własne wyzwalacze, np. trafiony cel w Around the Clock ([#3](https://github.com/jgoliszewski/ITDarts/issues/3)). Reguła działa w każdej grze, w której jej wyzwalacz ma sens.

## Reguły

- **Reguła** to jeden lub więcej wyzwalaczy oraz efekt:
  - dźwięk, czyli jeden lub kilka wariantów z Biblioteki dźwięków, losowanych przy każdym trafieniu;
  - preset ledów i czas trwania.

  Obie części są opcjonalne. Regułę można wyłączyć bez usuwania.
- Nie ma reguł per gracz ani imion w efektach.
- **Gra jedna reguła naraz**, ta o najwyższym priorytecie:
  1. wygrany mecz;
  2. wygrany set;
  3. reguła z warunkiem „Only checkout”;
  4. checkout / wygrany leg;
  5. bust;
  6. kombinacja;
  7. dokładna suma tury;
  8. próg lub przedział tury;
  9. lotka.

  Reguła z kilkoma wyzwalaczami dostaje priorytet najbardziej konkretnego dopasowanego wyzwalacza.
- **Poprawki i Undo:**
  - świeża lotka (z tarczy albo dopisana ręcznie) odpala efekty;
  - Poprawka nie odpala efektu lotki. Odpala tylko efekt tury lub checkoutu, który dzięki niej powstał (S20 → T20 daje 180);
  - Undo nic nie odpala.

## Dźwięk

- Gra tylko w przeglądarce kiosku na laptopie. Edge dostaje flagę `--autoplay-policy=no-user-gesture-required`. Telefony milczą.
- **Biblioteka dźwięków** to wspólna lista plików. Reguły wybierają z niej, a jeden plik może służyć wielu regułom.
  - Upload z UI, także z telefonu: mp3, wav lub ogg, do 5 MB i 10 s.
  - Przy każdym pliku jest odsłuch, zmiana nazwy i suwak głośności, bo pliki z różnych źródeł mają różny poziom.
  - Pliku używanego przez regułę nie da się usunąć.
  - Pliki leżą w `data/sounds/`, opis w SQLite. Backup obejmuje oba.
- Gotową darmową paczkę dźwięków efektów szukamy razem z paczką callera w [#5](https://github.com/jgoliszewski/ITDarts/issues/5).
- Na stronie efektów są osobne poziomy głośności dla efektów i dla callera. Głośność całości ustawiamy w Windows.

## Ledy (WLED)

- Jeden kontroler WLED, sterowany z serwera przez JSON API, nigdy z przeglądarki.
- Efekty są presetami zaprojektowanymi w aplikacji WLED. Reguła podaje preset i czas trwania, domyślnie 1 s.
- Serwer wysyła playlistę z presetem efektu na zadany czas i `"end": 255`. WLED sam wraca wtedy do poprzedniego presetu, a serwer nie odmierza czasu.
- Nowe zdarzenie przerywa trwający efekt.
- **Stany bazowe**, czyli tło między efektami, każdy z własnym presetem:
  - lobby;
  - mecz w toku;
  - takeout;
  - tarcza offline.

## Animacje na Ekranie wyników

Animacje są na sztywno w kodzie i nie da się ich konfigurować w UI. Nie blokują Pilota i nie zasłaniają wyniku dłużej niż około 2 s.

| Zdarzenie | Animacja |
|---|---|
| 180 | pełny ekran |
| 140+ | mniejsza |
| Bust | czerwony błysk lub drgnięcie w hero |
| Wygrany leg | wejście ekranu końca legu |
| Wygrany mecz | konfetti |
| T20, Bull | błysk kafelka lotki |

## Caller

Caller to osobny kanał tego samego systemu: korzysta z tych samych zdarzeń i tego samego odtwarzacza.

- **Co mówi** (każdą kategorię da się włączyć lub wyłączyć):
  - wynik tury;
  - „you require N” na początku tury, gdy zostaje 170 lub mniej;
  - game on;
  - game shot i match shot;
  - bust;
  - pojedyncze lotki, domyślnie wyłączone.
- **Wynik tury** pada zaraz po trzeciej lotce. Przy krótszej turze pada przy „Next player” albo przy takeoucie.
- **Kolejność:** najpierw dźwięk efektu, potem caller. Caller czeka na koniec efektu, ale najdłużej 2 s. Nigdy nie grają na siebie.
- Bez imion graczy. Wrócimy do tego, jeśli w #5 wyjdzie TTS.
- **Paczka nagrań:** źródło i sposób instalacji ustalamy w [#5](https://github.com/jgoliszewski/ITDarts/issues/5). Bez paczki caller milczy, a reszta efektów działa.

## Strona „Effects”

- Wejście z menu Pilota, adres `/effects`. Działa na telefonie i na laptopie, dla każdego w LAN, bez logowania.
- Zmiany działają od razu, bez restartu, i są trzymane w SQLite.
- Zawartość:
  - reguły, każda z przyciskiem „Test”, który odpala dźwięk i ledy bez rzucania;
  - Biblioteka dźwięków;
  - WLED: adres, test połączenia, presety pobierane z kontrolera z wyborem po nazwie, stany bazowe;
  - caller: kategorie i głośność.
- Na start nie ma żadnych reguł. Animacje działają od razu, bo są w kodzie.

## Pilot

W menu Pilota są trzy przełączniki: Sounds, Caller i LEDs. Ich stan trzyma serwer, więc przetrwa restart.
