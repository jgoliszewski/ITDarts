# ITDarts: historia gier i statystyki (etap 2)

Postanowienia z grillingu z 2026-10-25 ([#4](https://github.com/jgoliszewski/ITDarts/issues/4)). Przebudowa statystyk („stats v2”) z grillingu z 2026-11-13 i 2026-11-16 (sesja, bez issue): pytanie „czy się poprawiam” najpierw, „kto lepszy” potem, ciekawostki na dole. Pojęcia są zdefiniowane w [GLOSSARY.md](../GLOSSARY.md), model danych w [ADR 0004](adr/0004-log-zdarzen-i-sqlite.md), a UI w [UI.md](UI.md).

## Co zapisujemy

- **Bieżący mecz** to log zdarzeń w SQLite, zapisywany po każdym zdarzeniu.
- **Po zakończeniu meczu** log jest kompaktowany do obowiązujących lotek. Nie trzymamy oryginalnej detekcji ani informacji, czy lotkę wpisano ręcznie.
- **Kontekst meczu:** gra i jej opcje, gracze w kolejności rzucania, kto zaczynał, data, status.
- **Lotka:** segment i mnożnik, gracz, numer w turze, czas, wynik przed i po, bust.
- **Współrzędne** z Board Managera zapisujemy, gdy przychodzą, tylko przy rzutach niepoprawianych i niedopisanych ręcznie. Rysuje je heatmapa ([UI.md](UI.md#heatmapa)).

## Gracze

- **Gracz** (zarejestrowany): profil zakładany wcześniej, wybierany przy starcie meczu. Zbieramy jego statystyki.
  - Zakładanie na ekranie „Players” w menu Pilota (tylko tam, setup meczu nie zakłada graczy).
  - Stałe ID i unikalne imię (bez względu na wielkość liter). Zmiana imienia nie rusza historii.
  - Scalanie dwóch profili z potwierdzeniem.
- **Gość:** „+ Guest” w setupie dodaje imię tylko na ten mecz (domyślnie „Guest 1”). Od gości nie zbieramy żadnych statystyk. Gościnnych meczów nie da się podpiąć pod profil założony później.
- **Usuwanie:**
  - archiwizacja ukrywa gracza z list i chipów, statystyki zostają;
  - anonimizacja na życzenie zmienia imię na „Deleted player”;
  - meczów nie usuwamy, bo psułoby to statystyki pozostałych.

## Co wchodzi do statystyk

- **Statystyki rzutowe** (średnie, liczniki, checkouty) zarejestrowanych graczy liczą się zawsze, także w meczach z gośćmi i w grze solo.
- **Winrate i head-to-head:** tylko zakończone mecze, w których grało co najmniej dwóch graczy i wszyscy są zarejestrowani, a gracz nie został wycofany z meczu. Ta sama definicja (`matches.counts_results`) dotyczy minigierek, patrz „Winrate w minigierkach”.
- **„End match” w trakcie meczu** pyta, czy zapisać mecz do statystyk:
  - „Discard” usuwa mecz całkowicie, także z historii;
  - „Save” dodaje wszystkie tury do statystyk rzutowych. Checkout %, najkrótszy leg i rekordy liczą tylko dokończone legi. Mecz nie wchodzi do winrate.
- „End match” po skończonym legu bez match mode to zwykły koniec meczu i o nic nie pyta.

## Statystyki X01

| Statystyka | Jak liczymy |
|---|---|
| Średnia | Punkty ÷ lotki × 3. Bust to 0 punktów, a jego lotki się liczą. |
| Średnia z pierwszych 9 | Jak wyżej, z pierwszych trzech tur legu. |
| Checkout % | Udane checkouty ÷ lotki rzucone przy wyniku do skończenia jedną lotką. |
| Najwyższy checkout | Największy wynik zamknięty jedną turą. |
| Najwyższa Tura (Highest visit) | Najwięcej punktów w jednej turze. Bust to 0 punktów. |
| Best leg | Najmniej lotek w wygranym legu, liczone tylko z **najczęściej granego wyniku startowego** gracza (remis w liczbie legów: wyższy wynik startowy) i podawane z dopiskiem, np. „15 darts · 301”. Bez podziału na pozostałe warianty (check-in, check-out). Statystyka zwraca też liczbę legów i najlepszy leg dla każdego granego wyniku startowego, żeby Compare mógł wybrać wynik najczęstszy łącznie u obu graczy („Best leg · 301”). |
| Bust rate | % tur zakończonych bustem (jedno miejsce po przecinku). Mniej znaczy lepiej. |
| 60+, 80+, 100+ | Liczba tur w przedziałach 60–79, 80–99 i od 100 w górę, każda tura liczy się raz. Od 2026-10-27 zamiast 100+, 140+, 180, pod poziom biura. Profil pokazuje główną liczbę jako **% tur** w przedziale, a sumę małym drukiem. Liczone z zapisanych tur, więc dotyczy też starszych meczów. |
| Winrate, head-to-head | Wygrane ÷ mecze według zasad wyżej. |

**Tabela double** (profil X01, pod statystykami; nie ma jej w Compare ani w podsumowaniu meczu): kolumny Double, Hit, Attempts i %, sortowane po próbach. Próba to lotka rzucona przy wyniku do zamknięcia jedną lotką, przypisana do double, którego ten wynik wymagał (wynik ÷ 2, 50 to bull). Trafienie to lotka, która zamknęła leg. Liczą się tylko Tury z check-out „double” i tylko dokończone legi, czyli ta sama pętla co Checkout %. Dla gracza, który gra wyłącznie double out, suma prób z tabeli równa się liczbie prób w Checkout %. Bull to double jak inne (w API `double: 25`).

Później (policzą się wstecz z zapisanych lotek): celność (% treble, sektory), ekran szczegółów meczu z historii, ranking ([#6](https://github.com/jgoliszewski/ITDarts/issues/6)).

## Okna

- **Czasowe:** 7 dni, 30 dni, 3 miesiące, rok, all time.
- **W legach:** ostatnie 10, ostatnie 100, all.

**Przełącznik Okien** (od 2026-11-18) to jedna kontrolka. Na co dzień pokazuje cztery Okna: **30D, 3M, All, Last 10** (w minigierkach „Last 10 matches”, bo tam jeden leg to jeden mecz). Pozostałe trzy (7D, 1Y, Last 100) są pod przyciskiem **„More”**, który rozwija je w tym samym rzędzie. Gdy zapamiętane Okno jest jednym z ukrytych, przełącznik od razu pokazuje wszystkie siedem. Na telefonie rząd przewija się w bok zamiast łamać. Gracz, który danej gry nigdy nie grał, nie widzi przełącznika, tylko pusty stan „Pick … in New match”; puste Okno czasowe ma przycisk „Show all time”.

**Bez trendu:** główny kafelek bez porównania (patrz Progres) mówi dlaczego: „No trend for All time”, „No trend · fewer than 3 legs before” (minigierki: matches), a Checkout % „No trend · fewer than 10 attempts”. Zmiana wartości procentowej jest w punktach procentowych („▲ 2.4 pp”).

**Podsumowanie solo** (Summary jednego Gracza, nie Gościa) ma pod wynikiem linię „▲ 24.2 vs your 30-day average”: główna statystyka gry z tego meczu (X01: Average) wobec średniej Gracza z 30 dni (`GET /api/stats/players/:id?window=30d`, w minigierkach z `&game=`). Mecz jest już zapisany, gdy Summary się pokazuje, więc widok odejmuje go od Okna: X01 z Averages i lotek (`avg × darts`), minigierki z sum (`totals`) i liczby meczów. Gdy w 30 dniach nie ma innego meczu, linii nie ma.

**Recent matches** pokazuje profil każdej gry, nie tylko X01: do 10 ostatnich meczów tej gry w Oknie (w Oknie w legach minigierki: ostatnie 10 meczów), przeciwnicy w kolejności rzucania albo „Solo”, wynik ze strony gracza (X01: jego legi pierwsze, minigierki: wynik jak w Lobby).

## Progres

Profil odpowiada najpierw na „czy się poprawiam”, więc statystyki porównujemy z **poprzednim Oknem** (`GET /api/stats/players/:id`, pole `previous`; w minigierkach `previous` w odpowiedzi gry).

- **Okno czasowe** porównuje się z okresem tej samej długości tuż przed nim: dla 7 dni to `[teraz − 14 dni, teraz − 7 dni)`.
- **Okno w legach** (10, 100) porównuje się z poprzednimi 10 albo 100 legami gracza według świeżości. W minigierkach, które mają jeden leg na mecz, to poprzednie N meczów.
- **Brak porównania** (`null`): dla „All time”, gdy bieżące Okno nie ma żadnego legu (minigierki: meczu) i gdy poprzednie Okno ma mniej niż 3 legi (minigierki: 3 mecze). Samo Checkout % nie ma porównania, gdy bieżące albo poprzednie Okno ma mniej niż 10 prób checkoutu (jedno trafienie z jednej próby to nie 100%).
- **Strzałka zmiany** pokazuje różnicę liczbą, zieloną przy poprawie i czerwoną przy spadku. Statystyki, w których mniej znaczy lepiej (Bust rate, Darts per checkout), mają odwrócony kolor. X01: Average, First 9, Checkout %. Winrate bez strzałki.
- **Wykres Average** (`trend` w odpowiedzi): punkt to jeden mecz X01 z wybranego Okna, z Averagem gracza w tym meczu, rosnąco po czasie. Profil rysuje wykres od 3 punktów i tylko dla gracza (nie w Compare). Przerywana linia to Average całego Okna, ta sama liczba co na kafelku nad wykresem (ważona lotkami), a nie średnia z punktów. Mecz przecięty granicą Okna wchodzi do wykresu i do kafelków tylko z Turami, które mieszczą się w Oknie, więc jego punkt pokazuje Average tej części meczu.

## Inne gry

Każdy moduł gry w `games/` definiuje swoje statystyki liczone z zapisanych lotek, np. MPR w Cricket albo rekord w ATC. Lista, rekordy i tabele na `/stats` są w [GRY.md](GRY.md).

**Częstości „na mecz”.** Liczniki minigierek profil pokazuje jako średnią na mecz, a sumę małym drukiem. Mianownikiem jest `matches` w odpowiedzi gry: liczba meczów, z których zsumowano `totals` (razem z meczami, z których gracz został wycofany, bo jego lotki liczą się w sumach). Główna statystyka ze strzałką: ATC, Full Board i Shanghai: hit rate; Cricket: MPR; 121: Attempts won; Random Checkouts: Darts per checkout; Knockout: Average visit; Killer: Lives taken na mecz; Football: Goals na mecz; Gotcha: Gotchas na mecz; Bullseye: Points na mecz; Free throw: Average.

**Winrate w minigierkach** liczymy jak w X01: do „versus played / won / winrate” wchodzą mecze zakończone, z co najmniej dwoma Graczami, bez Gości, bez remisu (`matches.counts_results`), w których gracz nie został wycofany. Osobno zwracamy liczbę rozegranych meczów (solo też, bez wycofanych). W grze tylko solo (Free throw) versus to 0 i profil pokazuje samo „Played”. W Oknie z grami solo i versus naraz winrate liczy się z versus, a solo wchodzi tylko do „Played”. Mecz zapisany przez „Save” i remis (np. ATC) nie wchodzą do winrate.

**Reguła ogólna:** klucz `best` w `stats` minigierki agreguje się na `/stats` jako maksimum, pozostałe klucze jako sumy. Nowa gra z kluczem `best` dostaje maksimum po samej nazwie klucza (`server/stats.ts`).

**Free throw** (od 2026-11-13) zapisuje w `stats` gracza: `darts`, `points`, `visits` (zakończone Tury), `best` (najwyższa Tura), `v60`, `v80` i `v100` (Tury od 60, 80 i 100 punktów). `/stats` sumuje je po meczach, ale `best` bierze jako maksimum. Pokazuje średnią z 3 lotek (`points / darts × 3`), lotki, najwyższą Turę i liczniki. Lotki z coords trafiają do heatmapy (`GET /api/stats/heat?game=freethrow`, ta sama ścieżka co inne minigierki). Główna statystyka ze strzałką to Average; 60+/80+/100+ pokazujemy jako % Tur z sumą małym drukiem; najwyższa Tura zostaje maksimum (`best`, także w poprzednim Oknie). To gra solo, więc profil pokazuje samo „Played”, bez winrate. Profil X01, średnie X01 i head-to-head bez zmian. Bez rekordu.

**Higher or Lower** (od 2026-11-16) zapisuje w `stats` gracza `visits` (ocenione Tury) i `survived` (Tury bez utraty życia), ze wszystkich gier meczu (First to powyżej 1). Statystyka „Visits survived” to `survived ÷ visits`. Tura urwana wycofaniem gracza nie jest oceniana, więc się nie liczy. Mecze zapisane wcześniej nie mają tych pól: to brak danych, nie zero, więc nie wchodzą ani do licznika, ani do mianownika.

## Rekordy biura X01

Na `/stats`, all time, bez wyboru Okna, tylko Gracze (Goście nie zostawiają Tur). Trzy rodzaje tabel top 10 (`GET /api/stats/records?game=x01`, ten sam kształt `RecordTable` co rekordy minigierek):

- **Highest visit:** najwięcej punktów w jednej Turze.
- **Highest checkout:** największy wynik zamknięty Turą, tylko dokończone legi.
- **Best leg** osobno dla każdego granego wyniku startowego (klucz `leg:301`, „Best leg · 301”): wygrany leg z najmniejszą liczbą lotek.

Konwencje jak przy rekordach minigierek (`Db.records`): jeden wiersz na gracza i mecz (najlepsza wartość z meczu), ten sam gracz może wystąpić wiele razy, najlepsze pierwsze, przy remisie wcześniejszy pierwszy. Tabela bez wierszy się nie pojawia.

**Bez Ekranu rekordu i bez Momentu „New record” w X01:** moduł X01 nie ma definicji rekordu (`GAMES.x01.record`), bo ta definicja włączałaby oba ([GRY.md](GRY.md#rekordy-i-ekran-rekordu)). Rekordy X01 liczy samo `/stats` z zapisanych Tur.

## Lista graczy

- **Average X01 z 30 dni** (jak dotąd) i obok niego Average z poprzednich 30 dni (`avgPrev`), z którego widok liczy strzałkę. Brak (`null`) przy mniej niż 3 legach w tamtym okresie.
- **Liczba meczów** z ostatnich 30 dni, wszystkie gry, bez meczów, z których gracz został wycofany (wcześniej liczba z całej historii).

## Ciekawostki

Mała sekcja „Fun facts” na dole profilu: **Darts** (liczba rzuconych lotek) i **Distance walked** (przeniesione spod heatmapy). Nie podświetlamy ich w Compare, bo więcej nie znaczy lepiej.

## Prezentacja

- Widok „Stats” jest tylko do odczytu i otwiera się z dowolnego urządzenia w LAN bez przejmowania Pilota.
- Zawartość: lista graczy, profil gracza z oknami i progresem, rekordy biura X01, head-to-head.
- **Układ `/stats`** (od 2026-11-18): na liście najpierw gracze i wejście do Compare, potem rekordy biura. Rekordy leżą w siatce, każda tabela pokazuje 5 najlepszych, a reszta jest pod „Show top 10” (nagłówek „Top 10 ·” tylko, gdy tabela ma 10 wierszy). Chipy gier stoją w jednym przewijanym rzędzie na grupę gier (poniżej 600 px).
- **Kolory** (D3, od 2026-11-18): dane są bez pomarańczu. Linia i kropki wykresu Average oraz paski w tabeli double mają kolor drugiego poziomu tekstu, a obie liczby head-to-head kolor tekstu. Pomarańcz zostaje na głównej metryce profilu, na #1 w rekordach i na głównym przycisku. Strzałki zmiany są zielone albo czerwone, jak w „Progres”. Kolory graczy (różowy, turkusowy, żółty, zielony) są tylko w Compare i podsumowaniu meczu ([UI.md](UI.md#podsumowanie-meczu)).
- **Profil** (od 2026-11-18): imię i „This is me” stoją nad wyborem gry. Główna zmiana ma postać pigułki („▲ 2.4 pp” na zielonym albo czerwonym tle). Pod osią wykresu Average są daty pierwszego, środkowego i ostatniego meczu. Double z mniej niż 5 prób są przygaszone. Gracz, który nigdy nie grał, widzi „Dee hasn't played yet. Pick Dee in New match.”, a gracz bez meczów danej gry w Oknie w legach „… hasn't played Football yet”. Puste Okno czasowe pokazuje „Nothing in the last 30 days” i „Show all time”.
- **Zarchiwizowany gracz** otwarty wprost z `/stats/:id` dostaje imię z odpowiedzi API (`window=all`), bo nie ma go na liście.
- Telefon pamięta wybór „to ja” i otwiera się od razu na tym profilu.
- **Heatmapa w profilu gracza** z wybranej gry i okna ([UI.md](UI.md#heatmapa)), a „Distance walked” w km jest w sekcji ciekawostek na dole profilu.
- **Porównanie graczy** na `/stats/compare`, wejście przyciskiem „Compare” na liście graczy:
  - dokładnie dwóch zarejestrowanych graczy, wybieranych w dwóch polach „X VS Y” pod oknem czasu (od 2026-10-28; wcześniej chipy 2–4), plus gra i okno;
  - tabela z kolumną na gracza i wierszami jak w profilu tej gry, z podświetloną najlepszą wartością;
  - pod nią heatmapa z linią i dystans w km. Od 1100 px tabela i heatmapa stoją obok siebie. Head-to-head zostaje w profilu;
  - gdy jeden z graczy nie ma danej gry w Oknie, nad tabelą stoi notka „Dee has no Football in this window.”. Imiona są tylko w polach wyboru, tabela nie powtarza ich drugi raz.
- **Distance walked:** każda Tura to przejście do tarczy i z powrotem, czyli 2 × odległość od linii do tarczy (`ocheMeters` w `config.json`, domyślnie 2,37 m). Bull-off się nie liczy.
- W trakcie meczu Ekran wyników pokazuje tylko to, co ustala [UI.md](UI.md). Historii tam nie ma.
- Makiety widoku robimy przy implementacji statystyk.

## Backup

- Serwer kopiuje bazę przy starcie i po każdym zakończonym meczu do folderu `backups/` i trzyma ostatnie 30 kopii.
- Opcjonalny drugi folder z konfiguracji, np. zsynchronizowany OneDrive.
- Eksportu CSV/JSON nie robimy, bo plik SQLite sam w sobie jest eksportem.

## Poza zakresem

- Celność (% treble, sektory) i ekran szczegółów meczu z historii: patrz „Później” przy statystykach X01.
- Ranking: [#6](https://github.com/jgoliszewski/ITDarts/issues/6).
- Import historii z konta Autodarts.
