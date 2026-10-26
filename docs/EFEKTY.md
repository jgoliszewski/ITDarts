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
- **Minigierki** mają własne wyzwalacze, np. trafiony cel w Around the Clock albo „New record”. Lista jest w [GRY.md](GRY.md). Reguła działa w każdej grze, w której jej wyzwalacz ma sens.

## Reguły

- **Reguła** to jeden lub więcej wyzwalaczy oraz efekt:
  - dźwięk, czyli jeden lub kilka wariantów z Biblioteki dźwięków, losowanych przy każdym trafieniu;
  - preset ledów i czas trwania.

  Obie części są opcjonalne. Regułę można wyłączyć bez usuwania.
- Reguła może nie mieć jeszcze ani dźwięku, ani ledów (2026-10-26). Wtedy nic nie gra, a lista pokazuje przy niej „No sound yet”. Dzięki temu można przygotować wyzwalacze, a dźwięki podpiąć później.
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
- **Wyzwalacze spoza tej listy** dostały miejsce przy implementacji (2026-10-26), bo grilling ich nie ustawił:
  - „New record” jest przed wygranym meczem, bo pada tą samą lotką i inaczej nigdy by nie zagrał;
  - zdarzenia minigierek są między bustem a kombinacją, w kolejności: eliminacja, utrata życia, killer, nieudane podejście, White Horse, znaczniki w turze, zamknięty sektor, zaliczony sektor, trafiony cel;
  - start meczu, start legu, takeout i tarcza są na samym końcu.
  - Przy remisie priorytetów gra starsza reguła.
- **„Dowolna liczba”** w lotce i kombinacji to 1–20, bez bulla i pudła. Bull i 25 wybiera się osobno.
- **Zestaw startowy** (2026-10-26), zapisany w `effects/effects.json`, bez dźwięków. Kolejność ma znaczenie, bo przy remisie priorytetów gra reguła wcześniejsza:
  - 180 (suma 180, a do tego kombinacja T20 · T20 · T20, żeby przy 180 wygrywała z „Clean 20s”);
  - Big Fish (170 z checkoutem);
  - High finish (100–170 z checkoutem);
  - Madhouse (2 z checkoutem, czyli D1);
  - Checkout;
  - Bust;
  - Clean 20s (trzy lotki w dowolne 20);
  - Bed and breakfast (26);
  - Ton 40 (140–179);
  - Ton (100–139);
  - No score (0 bez checkoutu);
  - Bullseye;
  - Match won i Set won;
  - Game on (start meczu);
  - New record, White Horse i Player out (minigierki).

  Ostatni leg meczu gra „Match won” zamiast „Big Fish” czy „Checkout”, bo tak ustawia priorytet. Wcześniejsze postanowienie „bez szablonów” (Q17) dotyczy przycisków w UI, a ten zestaw to jednorazowo dodane reguły.
- **Poprawki i Undo:**
  - świeża lotka (z tarczy albo dopisana ręcznie) odpala efekty;
  - Poprawka nie odpala efektu lotki. Odpala tylko efekt tury lub checkoutu, który dzięki niej powstał (S20 → T20 daje 180);
  - Undo nic nie odpala.
- **Jak to działa:** każdy moduł gry zwraca listę wystąpień wyzwalaczy z całego logu (`happenings` w `games/`). Hub porównuje listę przed i po każdym zdarzeniu i odpala to, co nowe lub zmienione. Dlatego Poprawka i Undo nie potrzebują osobnej logiki. Animacje wybiera ten sam mechanizm, więc Poprawka S20 → T20 pokazuje też animację 180.

## Dźwięk

- Gra tylko w przeglądarce kiosku na laptopie. Edge dostaje flagę `--autoplay-policy=no-user-gesture-required`. Telefony milczą.
- **Biblioteka dźwięków** to wspólna lista plików. Reguły wybierają z niej, a jeden plik może służyć wielu regułom.
  - Upload z UI, także z telefonu: mp3, wav lub ogg, do 2 MB i 10 s (pierwotnie 5 MB, zmienione przy przeniesieniu do repo).
  - Przy każdym pliku jest odsłuch, zmiana nazwy i suwak głośności, bo pliki z różnych źródeł mają różny poziom.
  - Pliku używanego przez regułę nie da się usunąć.
  - Pliki i ich opis leżą w repo, w `effects/` ([Konfiguracja w repo](#konfiguracja-w-repo)). Wcześniej były w `data/sounds/` i SQLite.
- Dźwięki efektów wgrywamy sami do Biblioteki. Osobnej darmowej paczki pod darta nie szukamy (#5).
- Na stronie efektów są osobne poziomy głośności dla efektów i dla callera. Głośność całości ustawiamy w Windows.

### Wbudowane dźwięki

Ustalone po pierwszych testach (2026-10-26): bez sygnału gracze nie wiedzą, że kolej następnego.

- **Dźwięk zmiany gracza:** gra, gdy Tura przechodzi na następnego gracza, czyli po końcu takeoutu, po „Takeout done” i po „Next player”. Gra też przy starcie następnego legu. Nie gra w bull-offie ani po końcu meczu.
- To arpeggio marimby: C5, E5, G5 co 75 ms. Wybrane 2026-10-26 z kilkunastu propozycji w miejsce pierwszego swoosha (szum z opadającym filtrem), który brzmiał za ostro.
- Jest na sztywno w kodzie, jak animacje. Nie jest Regułą i nie da się go przypisać do innego wyzwalacza.
- Syntetyzowany w przeglądarce kiosku (WebAudio), więc nie potrzebuje pliku ani licencji.
- Wycisza go przełącznik Sounds na Pilocie, a głośność bierze z poziomu efektów. W Playback jest jego odsłuch.
- Reguła na „Takeout end” gra niezależnie od niego. Kto chce własny dźwięk, wyłącza wbudowany dźwięk na stronie efektów. Jego przełącznik ma w `effects.json` klucz `swoosh`, zostawiony po pierwszej wersji.

## Konfiguracja w repo

Grilling z 2026-10-26: konfiguracja wyklikana w domu ma działać też w pracy.

- **Do repo trafiają:** reguły, Biblioteka dźwięków (pliki, nazwy, głośności), stany bazowe ledów, głośność efektów i callera oraz przełącznik swoosha.
- **Lokalnie zostają:** adres WLED oraz przełączniki Sounds, Caller i LEDs z Pilota. Leżą w SQLite, w tabeli `settings`.
- Reguły i stany bazowe wskazują presety WLED po numerze, więc działają tak samo tylko na kontrolerach z tymi samymi numerami presetów.
- **Miejsce:** `effects/effects.json` i `effects/sounds/` w katalogu głównym repo. Ścieżkę zmienia `effectsDir` w `config.json`.
- **Źródło prawdy:** plik w repo. Serwer czyta go na starcie i zapisuje od razu przy każdej zmianie na stronie efektów. Commit, push i pull robimy ręcznie, aplikacja nie dotyka gita.
- **Zmiana pliku przy działającym serwerze**, np. po `git pull`: serwer pilnuje pliku i przeładowuje go na żywo. Uszkodzony plik, np. ze znacznikami konfliktu, nie wchodzi. Zostaje ostatnia dobra wersja, a strona efektów pokazuje czerwony baner z błędem.
- **Identyfikatory:** reguła ma krótki losowy identyfikator (np. `r7f3a`), żeby reguły dodane osobno w domu i w pracy się nie zderzyły. Dźwięk jest wskazywany nazwą pliku.
- **Pliki dźwięków** dostają czytelną nazwę z nazwy przy uploadzie (`crowd-roar.mp3`, przy powtórce `crowd-roar-2.mp3`). Zmiana nazwy na stronie nie zmienia pliku.
- **Limit uploadu** to 2 MB, a nie 5 MB, bo każdy plik zostaje w historii gita. Długość nadal do 10 s.
- **JSON pod gita:** stała kolejność kluczy, reguły w kolejności dodania, wcięcia, nowa linia na końcu. Zmiana jednej reguły zmienia tylko jej blok.
- **Przeniesienie danych:** przy pierwszym starcie bez pliku serwer przenosi reguły, dźwięki i ustawienia z SQLite do `effects/`, a potem usuwa stare tabele.
- **Backup** obejmuje tylko bazę (mecze, gracze). Kopią efektów jest historia gita.

## Ledy (WLED)

- Jeden kontroler WLED, sterowany z serwera przez JSON API, nigdy z przeglądarki.
- Efekty są presetami zaprojektowanymi w aplikacji WLED. Reguła podaje preset i czas trwania, domyślnie 1 s.
- Serwer wysyła playlistę z presetem efektu na zadany czas. Jako `"end"` podaje preset bieżącego stanu bazowego, a bez niego `255`. WLED sam wraca wtedy do tła, a serwer nie odmierza czasu.
- Nowe zdarzenie przerywa trwający efekt.
- Zmiana stanu bazowego czeka na koniec trwającego efektu, żeby takeout nie uciął efektu po 180 (z implementacji).
- Przełącznik LEDs na Pilocie wyłączony gasi ledy, a włączony zapala stan bazowy.
- Do testów bez kontrolera jest atrapa: `npm run fake-wled` (port 3190). Na stronie efektów wpisujemy adres `localhost:3190`, a `http://localhost:3190` pokazuje aktualny kolor.
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
| Bust | czerwony błysk lub drgnięcie w hero, „BUST” na karcie tury ([UI.md](UI.md#tura-i-takeout)) |
| Wygrany leg | wejście ekranu końca legu |
| Wygrany mecz | konfetti |
| T20, Bull | błysk kafelka lotki |

Z implementacji (2026-10-26):

- 180 to pomarańczowy błysk na cały ekran z wielkim czarnym „180”, bo karta tury pokazuje już pomarańczowe 180 i zwykła animacja z nim zlewała się.
- 140+ to plakietka z wynikiem nad kartą tury.
- Bust to czerwony błysk od krawędzi ekranu. Drgnięcia hero nie ma, bo przy buście hero zasłania karta tury.
- Animacje widzi każdy Ekran wyników, także nie-kiosk. Dźwięk gra tylko w kiosku.

## Caller

Głos sędziego, zaszyty w kodzie. Ustalony w grillingu [#5](https://github.com/jgoliszewski/ITDarts/issues/5) (2026-10-26). Wszystko poza tym, co mówi sędzia (pojedyncze lotki, okrzyki, dźwięki pod konkretne wyniki), to Reguły.

- **Tylko X01.** W 121 i pozostałych minigierkach caller milczy.
- **Co mówi** (stały zestaw, bez kategorii do wyłączania):
  - „game on” na starcie każdego legu, a przy pierwszym legu po bull-offie;
  - wynik tury, 1–180;
  - „no score” przy turze za 0 i przy każdym buście;
  - „you require N” na początku tury, tylko gdy zamknięcie jest możliwe w wybranym check-oucie (ta sama logika co podpowiedź checkoutu). Przy Double out milczy więc przy 169, 168, 166, 165, 163, 162 i 159, a przy Double in także przed wejściem;
  - przy zamknięciu, zamiast wyniku: „game shot and the N-th leg” (przy setach numer legu w secie, powyżej 20. legu cisza) albo na koniec meczu „game shot and the match”.
- **Wynik tury** pada zaraz po trzeciej lotce. Przy krótszej turze pada przy „Next player” albo przy takeoucie.
- **Poprawka** po wywołaniu wyniku wywołuje poprawiony wynik jeszcze raz. Undo milczy.
- **Kolejność:** najpierw dźwięk efektu, potem caller. Caller czeka na koniec efektu, ale najdłużej 2 s. Kolejne wywołania czekają na poprzednie, np. wynik, a po takeoucie „you require” następnego gracza.
- Bez imion graczy, pojedynczych lotek, bull-offa i zapowiedzi legów.
- **Sterowanie:** przełącznik Caller na Pilocie, niezależny od Sounds, domyślnie włączony, trzymany per laptop w SQLite. Suwak głośności callera jest na stronie efektów, a jego wartość leży w repo obok głośności efektów. Gra tylko w kiosku, jak reszta dźwięków.
- **Głos:** Ash z OpenAI TTS, EN-GB, z paczki darts-caller `openai/en-GB-ash-MALE-v2.zip` (`https://darts-downloads.peschi.org/soundfiles/openai/en-GB-ash-MALE-v2.zip`). Wybrany z około 90 głosów (paczki darts-caller, Edge, Kokoro i Piper).
  - Nagrania leżą w repo w `assets/caller/` jako część aplikacji, a serwer podaje je pod `/caller/<plik>`. Wyciągnięte jednorazowo, 1:1, bez obróbki. W repo nie ma skryptu ani uploadu.
  - Nazwy plików w konwencji darts-caller: `1.mp3`–`180.mp3`, `you_require.mp3`, `gameon.mp3`, `busted.mp3` (z nagraniem „no score”), `gameshot_l1_n.mp3`–`gameshot_l20_n.mp3`, `matchshot.mp3`. Inną paczkę darts-caller da się więc podłożyć bez mapowania.
  - `assets/caller/SOURCE.md` mówi, z której paczki i którego wiersza CSV pochodzi każdy plik.
  - Paczka nie ma licencji. Akceptujemy to, bo repo jest prywatne i nagrań nie publikujemy.
  - Brak pliku oznacza ciszę przy tym wywołaniu. Test pilnuje, że każdy potrzebny plik jest w `assets/caller/`.

## Strona „Effects”

- Wejście z menu Pilota, adres `/effects`. Działa na telefonie i na laptopie, dla każdego w LAN, bez logowania.
- Zmiany działają od razu, bez restartu, i są trzymane w SQLite.
- Zawartość:
  - reguły, każda z przyciskiem „Test”, który odpala dźwięk i ledy bez rzucania;
  - Biblioteka dźwięków;
  - WLED: adres, test połączenia, presety pobierane z kontrolera z wyborem po nazwie, stany bazowe;
  - caller: przełącznik i głośność.
- Na start nie ma żadnych reguł. Animacje działają od razu, bo są w kodzie.
- Ledy da się wypróbować bez reguły i bez rzucania: przycisk „Try” przy presecie w edytorze reguły i przy każdym stanie bazowym, a do tego lista presetów z kontrolera. Podgląd gra preset przez zadany czas (w liście 3 s) i wraca do stanu bazowego, także przy wyłączonym przełączniku LEDs. Wtedy po podglądzie ledy znowu gasną (2026-10-26).
- Z implementacji (2026-10-26): strona ma też sekcję „Playback” z przełącznikami Sounds i LEDs, wbudowanym swooshem i głośnością efektów. Od #5 jest w niej też caller.

### Układ strony

Grilling z 2026-10-26, po pierwszych testach: jedna długa strona była nieczytelna. Makiety A1–A4 (telefon) i C (laptop) są w [ITDarts UI mockups](https://claude.ai/artifact/Bt8RmLqWv9733tb2nLkPQK).

- **Zakładki:** Rules, Sounds, LEDs i Playback, każda z własnym adresem (`/effects/rules`, `/effects/sounds`, `/effects/leds`, `/effects/playback`). `/effects` otwiera Rules.
- **Telefon (poniżej 1100 px):** zakładki na górze, a w nagłówku pigułka statusu. Kropka jest zielona, gdy Sounds i LEDs są włączone, a bursztynowa, gdy któryś jest wyłączony albo WLED nie odpowiada. Stuknięcie w pigułkę otwiera Playback.
- **Laptop (od 1100 px):** zakładki z boku, a pod nimi ten sam status. W Rules obok listy jest edytor zaznaczonej reguły. Na start zaznaczona jest pierwsza reguła, a przy pustej liście edytor od razu tworzy nową. Sounds, LEDs i Playback to jedna kolumna do 720 px.

**Rules**
- Reguły są w grupach „Darts, visits and results”, „Minigames” i „Match and board”. Reguła trafia do grupy swojego najważniejszego wyzwalacza.
- W grupie kolejność idzie według priorytetu, a przy remisie od najstarszej.
- Wiersz pokazuje nazwę (bez nazwy: wyzwalacze), wyzwalacze, dźwięk, kolor i nazwę presetu ledów oraz przełącznik. Stuknięcie otwiera edytor. Na liście nie ma „Test” ani usuwania.
- Pusta lista: „No rules yet. Scoreboard animations work without them.” i „New rule”. Bez szablonów.

**Edytor reguły**
- Na telefonie zajmuje cały ekran i ma własny adres (`/effects/rules/12`, `/effects/rules/new`). Wstecz działa jak „Cancel”.
- Nazwa jest opcjonalna. Obok niej jest przełącznik reguły.
- Blok „When”: wyzwalacze jako chipy, a parametry zaznaczonego chipu pod nimi. „+ Add trigger” otwiera arkusz z wyzwalaczami w grupach, z krótkim opisem.
- Blok „Then”: warianty dźwięku z odsłuchem i „+ Add a variant from the library” oraz preset ledów z czasem i „Try”.
- Zapis tylko przez „Save”, bo reguła w połowie edycji mogłaby zagrać w trakcie meczu. Wyjście albo przejście do innej reguły z niezapisanymi zmianami pyta „Discard changes?”.
- „Test whole rule” gra to, co widać w edytorze, także bez zapisu. Gra też przy wyłączonych przełącznikach, a wtedy obok jest krótka informacja o tym.
- „Delete” jest tylko w edytorze, z potwierdzeniem.

**Sounds**
- Na górze upload. Przy każdym dźwięku są odsłuch, długość, liczba reguł, które go używają, i suwak głośności.
- **Wyszukiwarka** nad listą i w arkuszu „Add a sound” w edytorze reguły (2026-10-26, gdy dźwięków zrobiło się kilkadziesiąt). Szuka po nazwie i pliku, bez względu na wielkość liter i polskie znaki, a słowa mogą być w dowolnej kolejności.
- **Nazwa nowego dźwięku** (2026-10-26): po wybraniu pliku, a przed wysłaniem, okno „Name the new sound” z odsłuchem i polem nazwy. Pole ma zaznaczoną nazwę wziętą z pliku, więc wpisywanie ją zastępuje. Pod spodem widać nazwę pliku w repo, bo powstaje z tej nazwy i późniejsza zmiana nazwy jej nie rusza.
- Zmiana nazwy i usuwanie są w menu „⋯”. Przy użytym dźwięku „Delete” jest wyłączone i wymienia te reguły.

**LEDs**
- Status połączenia z adresem i wersją WLED. „Change” zmienia adres, a bez adresu od razu widać pole adresu.
- Stany bazowe z kolorem i nazwą presetu oraz „Try”. Preset wybiera się w arkuszu z kolorami, a w nim każdy preset ma też „Try”. Ten sam wybór jest w edytorze reguły.
- Siatka presetów z kontrolera: stuknięcie gra preset przez 3 s.
- Kolor kropki to pierwszy kolor pierwszego segmentu z `presets.json`. Bez niego kropka jest pustym szarym okręgiem.

**Playback**
- Sounds, LEDs, swoosh i głośność efektów jak dotąd.
- Caller: przełącznik z odsłuchem przykładowego wywołania i suwak „Caller volume”.

## Pilot

W menu Pilota są trzy przełączniki: Sounds, Caller i LEDs, oraz wejście „Effects”. Ich stan trzyma serwer, więc przetrwa restart.
