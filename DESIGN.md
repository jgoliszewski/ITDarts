---
name: ITDarts
description: Biurowy system do darta w ITBOOM. Ciemny motyw, jeden pomarańczowy akcent, liczby czytelne z trzech metrów, obsługa kciukiem.
colors:
  bg: "#0A0A0B"
  card: "#141416"
  card-2: "#1A1A1D"
  tile: "#1C1C1F"
  raised: "#1F1F23"
  sheet: "#17171A"
  drawer: "#121214"
  toast: "#26262B"
  key: "#232327"
  line: "#2E2E33"
  faint: "#3A3A40"
  off: "#6E6E75"
  off-on-accent: "rgba(17, 17, 17, 0.6)"
  disabled-bg: "#1F1F23"
  disabled-fg: "#8E8E94"
  text: "#F5F5F5"
  soft: "#D4D4D8"
  muted: "#A1A1A6"
  muted-2: "#8E8E94"
  accent: "#F58224"
  accent-ink: "#3A2410"
  ink: "#111111"
  on-accent: "#111111"
  green: "#3CCB7F"
  amber: "#F5B83D"
  amber-bg: "#2A2312"
  red: "#FF5A5F"
  red-soft: "#FF8A8E"
  red-bg: "#2A1A1B"
  green-bg: "#13261C"
  green-band: "#1F4D33"
  p1: "#E0325F"
  p2: "#16B2C9"
  p3: "#F5D63D"
  p4: "#3CCB7F"
  scrim: "rgba(10, 10, 11, 0.8)"
  scrim-solid: "rgba(10, 10, 11, 0.92)"
typography:
  tv-mega:
    fontFamily: "Barlow Condensed, Inter, system-ui, sans-serif"
    fontSize: "400px"
    fontWeight: 700
    lineHeight: 0.8
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
  tv-display:
    fontFamily: "Barlow Condensed, Inter, system-ui, sans-serif"
    fontSize: "240px"
    fontWeight: 700
    lineHeight: 0.85
    fontFeature: "tnum"
  tv-xl:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "120px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.03em"
  tv-l:
    fontFamily: "Barlow Condensed, Inter, system-ui, sans-serif"
    fontSize: "96px"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum"
  tv-score:
    fontFamily: "Barlow Condensed, Inter, system-ui, sans-serif"
    fontSize: "88px"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum"
  tv-title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "64px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  tv-lead:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1.15
  tv-name:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.2
  tv-meta:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.3
  tv-label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.08em"
  ui-xs:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.3
  ui-sm:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.4
  ui-md:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.5
  ui-lg:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.3
  ui-xl:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: 1.2
  ui-2xl:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1.2
  ui-num-sm:
    fontFamily: "Barlow Condensed, Inter, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1.05
    fontFeature: "tnum"
  ui-num-md:
    fontFamily: "Barlow Condensed, Inter, system-ui, sans-serif"
    fontSize: "56px"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum"
  ui-num-lg:
    fontFamily: "Barlow Condensed, Inter, system-ui, sans-serif"
    fontSize: "72px"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum"
rounded:
  pill: "9999px"
  card: "36px"
  row: "26px"
  tile: "18px"
  sheet: "28px"
  box: "20px"
  key: "16px"
  sm: "12px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "24px"
  s6: "32px"
  s7: "40px"
  s8: "56px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.ui-md}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "52px"
  button-primary-disabled:
    backgroundColor: "{colors.disabled-bg}"
    textColor: "{colors.disabled-fg}"
  button-secondary:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    typography: "{typography.ui-md}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "52px"
  button-danger:
    backgroundColor: "{colors.red-bg}"
    textColor: "{colors.red-soft}"
    typography: "{typography.ui-md}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "52px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    height: "52px"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    typography: "{typography.ui-sm}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "44px"
  chip-on:
    backgroundColor: "{colors.text}"
    textColor: "{colors.ink}"
  segment:
    backgroundColor: "{colors.card}"
    textColor: "{colors.soft}"
    typography: "{typography.ui-sm}"
    rounded: "{rounded.pill}"
    padding: "4px"
    height: "52px"
  segment-on:
    backgroundColor: "{colors.text}"
    textColor: "{colors.ink}"
  dialog:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.text}"
    rounded: "{rounded.sheet}"
    padding: "28px"
    width: "560px"
  sheet:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.text}"
    rounded: "{rounded.sheet}"
    padding: "20px 16px 20px"
    width: "560px"
  drawer:
    backgroundColor: "{colors.drawer}"
    textColor: "{colors.text}"
    padding: "32px"
    width: "600px"
  toast:
    backgroundColor: "{colors.toast}"
    textColor: "{colors.text}"
    typography: "{typography.ui-md}"
    rounded: "{rounded.box}"
    padding: "12px 16px"
  toast-error:
    backgroundColor: "{colors.red-bg}"
    textColor: "{colors.red-soft}"
  dropdown-list:
    backgroundColor: "{colors.card-2}"
    textColor: "{colors.text}"
    typography: "{typography.ui-md}"
    rounded: "{rounded.key}"
    padding: "6px"
  dart-tile-x01:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    typography: "{typography.tv-l}"
    rounded: "{rounded.row}"
    width: "230px"
    height: "160px"
  dart-tile-hit:
    backgroundColor: "{colors.green}"
    textColor: "{colors.ink}"
    rounded: "{rounded.row}"
  dart-tile-miss:
    backgroundColor: "{colors.red}"
    textColor: "{colors.ink}"
    rounded: "{rounded.row}"
  dart-tile-dead:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.muted}"
    rounded: "{rounded.row}"
  player-row:
    backgroundColor: "{colors.card-2}"
    textColor: "{colors.text}"
    typography: "{typography.tv-name}"
    rounded: "{rounded.row}"
    padding: "24px 28px"
  player-row-active:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "28px 32px"
  card-ui:
    backgroundColor: "{colors.card}"
    textColor: "{colors.text}"
    rounded: "{rounded.box}"
    padding: "16px"
  empty-state:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.ui-md}"
    padding: "40px 24px"
---

# Design System: ITDarts

> Ten plik opisuje system zaimplementowany w `web/src/styles.css`: tokeny z nagłówka są zmiennymi w `:root` (nazwy z myślnikiem przed cyfrą bez myślnika: `card-2` → `--card2`, `muted-2` → `--muted2`; `rounded.*` → `--r-*`, `spacing.sN` → `--sp-N`, `typography.*` → `--fs-*`). Decyzje produktowe: [docs/UI.md](docs/UI.md). Pojęcia: [GLOSSARY.md](GLOSSARY.md).

**Jednostki.** Wartości w pikselach w tym pliku dla **Ekranu wyników** (kiosk: Ekran wyników, Lobby, Summary na TV, nakładki) to piksele makiety 1920×1080. W kodzie zawsze `calc(N * var(--u))`, gdzie `--u = min(100vw / 1920, 100vh / 1080)`. Wartości dla **Pilota** (telefon i laptop jako Pilot), `/stats` i `/effects` to zwykłe piksele CSS. Tokeny `tv-*` i `rounded.card/row/tile` są kioskowe, `ui-*` i `rounded.sheet/box/key/sm` są Pilota. Odstępy (`spacing`) są wspólne: te same liczby w px i w `u`.

## Overview

**Creative North Star: "Tablica przy oche"**

Ekran wyników to tablica wyników w pubie: czyta się ją z trzech metrów, w półmroku, w przerwie między rzutami. Pilot to druga strona tej samej tablicy: wąski, ciemny, obsługiwany kciukiem jedną ręką, kiedy w drugiej jest lotka. System ma dwie skale, ale jeden charakter. Czarne tło, szare karty bez obramowań, jedna pomarańcza dla tego, co dzieje się teraz (aktywny gracz, główna akcja), liczby w wąskim Barlow Condensed, które da się odczytać z daleka, i reszta tekstu w Inter.

Gęstość jest niska na Ekranie wyników i średnia na Pilocie. Na Ekranie wyników liczy się to, co widać z oche: wynik 400 px, imię, trzy lotki. Na Pilocie liczy się to, co da się trafić kciukiem: 44 px minimum, przyciski w kształcie pigułki, press zamiast hover. Dekoracja jest zbędna, a ruch jest po to, żeby potwierdzić dotyk albo pokazać, skąd coś przyszło, nigdy po to, żeby opóźnić odczyt wyniku. Celebracja należy do Momentów ([docs/EFEKTY.md](docs/EFEKTY.md)), nie do UI.

Odrzucone wprost (z [docs/UI.md](docs/UI.md)): kolory per gracz poza Summary i Compare, jasny motyw, emoji zamiast ikon, pełne serca, ruch w liczbach wyniku.

**Key Characteristics:**
- Jeden ciemny motyw, tylko angielski w UI, czcionki lokalne (offline, bez CDN).
- Jeden akcent `#F58224`. Czarny (`ink`) tekst na pomarańczowym, nigdy biały.
- Czytelność z daleka wygrywa z estetyką: rozmiar i kontrast przed ozdobą.
- Dotyk przed myszą: stan `:active`, bez `:hover` (poza `(hover: hover) and (pointer: fine)`).
- Głębia z warstw odcieni szarości; cień tylko dla rzeczy, które unoszą się nad treścią.

## Colors

Paleta ITBOOM: prawie czarne tło, karty w odcieniach szarości, pomarańcz jako jedyny akcent i trzy kolory stanów. Wartości są w frontmatterze (normatywne). Tu jest ich rola.

### Primary
- **Pomarańcz ITBOOM** (`accent`): aktywny gracz (wiersz, hero), główna akcja (`button-primary`), główna metryka na `/stats`, #1 w rekordach, suma Tury na karcie Tury, zaznaczony kafelek gry. Nigdzie indziej. Kontrast na `bg` 7,63:1, na `card` 7,10:1.
- **Atrament** (`ink` = `on-accent`, `#111111`): tekst i ikony na pomarańczowym, zielonym, czerwonym, żółtym i kolorach graczy, oraz tekst na zaznaczonym segmencie i chipie (`text` jako tło). Zastępuje rozproszone `#111` i `#0A0A0B`. Kontrast na `accent` 7,28:1.
- **Pomarańczowy atrament** (`accent-ink`): drugi poziom tekstu na pomarańczowym wierszu (meta, podpisy). 5,63:1 na `accent`.

### Secondary
Brak. System ma jeden akcent z założenia.

### Tertiary (kolory stanów)
- **Zieleń** (`green`): „Ready”, trafienie (kafelek lotki w grach liczonych trafieniami, ikona zaliczenia), wygrana, `kicker` kart wyników.
- **Bursztyn** (`amber`, tło `amber-bg`): takeout, remis w bull-offie, baner informacyjny.
- **Zielone tło** (`green-bg` `#13261C`): tylko pigułka „Checked out” w rogu hero X01 (zielony tekst `green` na `green-bg`). Para dla `amber`/`amber-bg` (pigułka „Needs a double to start”) i `red`/`red-bg`.
- **Zielone pasmo** (`green-band` `#1F4D33`): tylko zakres „in range” na skali Higher or Lower.
- **Czerwień** (`red`, `red-soft` na tekst, tło `red-bg`): bust, pudło w grach liczonych trafieniami, życia (serca), restart, błędy. `red-soft` zawsze na `red-bg`, `red` na `card` i `bg` (6,03:1).

### Kolory graczy (tylko Summary i Compare)
- **Różowy** (`p1`), **turkusowy** (`p2`), **żółty** (`p3`, decyzja D2, zamiast pomarańczowego `#F0A020`, który zlewał się z akcentem), **zielony** (`p4`). Według miejsca w meczu albo w porównaniu, dalej od nowa. Profil gracza ich nie zapisuje. Tekst na nich to `ink`. Źródło prawdy to CSS (`--p1…--p4`), `Compare.tsx` czyta je stąd.

### Neutral
- **Tło** (`bg`) i warstwy: `card` (karty, hero, lista), `card-2` (wiersz listy, Cricket), `tile` (kafelki statystyk), `raised` (przycisk drugorzędny, kafelek lotki, dymek), `sheet` (dialog, sheet, karta nakładki), `drawer` (panel tarczy, pełnoekranowy test), `toast`, `key` (klawisz Poprawki). Każda następna warstwa jest jaśniejsza o jeden mały krok: rozróżnia głębię bez obramowania.
- **Tekst:** `text` (główny, 18,15:1 na `bg`), `soft` (drugi poziom, 12,45:1 na `card`), `muted` (cichy, 7,15:1 na `card`), `muted-2` (najcichszy, 5,65:1 na `card`).
- **Linie:** `line` (obrys pola, separator, pusty slot), `faint` (tylko dekoracja: ikona w tle kafelka gry, uchwyt sheeta). `line` i `faint` nie niosą informacji i mają < 3:1.
- **Stany wyłączone:** `off` (`#6E6E75`) i `off-on-accent` (`rgba(17,17,17,.6)`). Nowe, bo dotychczasowe `#2E2E33`, `#3A3A40` i `rgba(17,17,17,.22/.3)` miały 1,3–1,8:1. Użycie: niewygrany leg (kropka), stracone serce, wycofany gracz (ikona i tekst), puste miejsce na lotkę, powód blokady „Start match”. Kontrast `off` na `card` 3,64:1, na `card-2` 3,43:1, na `raised` 3,25:1, na `bg` 3,91:1. `off-on-accent` na `accent` 3,45:1.
- **Przycisk nieaktywny:** `disabled-bg` + `disabled-fg` (5,04:1) zamiast `opacity: .45` (dawało 2,3:1 na głównym). `disabled-fg` jest tekstem, więc musi mieć 4,5:1.
- **Nakładki:** `scrim` (`rgba(10,10,11,.8)`) pod dialogiem, sheetem, drawerem i kartą Tury; `scrim-solid` (`.92`) tylko pod QR.

### Named Rules
**The One Voice Rule.** Pomarańcz oznacza „teraz” i „główne”. Jeśli na jednym ekranie jest go więcej niż aktywny gracz, jedna główna akcja i najwyżej jedna liczba, coś jest źle. Dlatego kafelki lotek w X01 są neutralne (D1), a dane na `/stats` w `soft` (D3).

**The Ink-On-Orange Rule.** Na pomarańczowym tle zawsze `ink` (7,28:1). Biały ma za słaby kontrast (2,4:1).

**The Off Floor Rule.** Nic, co niesie stan (wygrany/niewygrany, życie, wycofany), nie schodzi poniżej 3:1. Tylko dekoracja (`line`, `faint`) może.

## Typography

**Display / liczby:** Barlow Condensed (z fallbackiem Inter, system-ui), `font-variant-numeric: tabular-nums`, waga 700.
**Body / UI:** Inter (z fallbackiem system-ui). Obie czcionki dołączone lokalnie.

**Character:** Wąskie, ciężkie cyfry dają największy możliwy wynik w danym miejscu. Inter niesie imiona i opisy: neutralny, czytelny przy małych rozmiarach i w wielu wagach.

Dwie drabinki, bo dwie odległości czytania. Nie mieszaj ich: Ekran wyników używa `tv-*`, Pilot i `/stats` używają `ui-*`.

### Hierarchy: Ekran wyników (kiosk, `u`)
- **tv-mega** (700, 400, 0.8): wynik w hero X01 i minigierkach. Tylko ta liczba. Moment „180” (760) jest poza systemem.
- **tv-display** (700, 240, 0.85): suma na karcie Tury, pin w Higher or Lower (dziś 220).
- **tv-xl** (800, 120, 1): zwycięzca na kartach wyników, BUST w hero, werdykt.
- **tv-l** (700, 96, 1): kafelki lotek, liczby w kartach wyników i „this turn”.
- **tv-score** (700, 88 / 72 compact, 1): wynik w wierszu listy.
- **tv-title** (700, 64, 1.1): imię w hero (dziś 48: za małe z 3–4 m), ścieżka checkoutu.
- **tv-lead** (700, 40): „who” na karcie Tury, podpis pod liczbą, wartości w kafelkach wizyt.
- **tv-name** (700, 30 / 26 compact): imię w wierszu listy, kicker kart.
- **tv-meta** (600, 24): meta wiersza, „Pull the darts”, podpisy.
- **tv-label** (700, 18, 0.08em, wersaliki): etykiety `caps`. **Minimum na kiosku.**

**Wyjątki lokalne wariantu D** (Ekran wyników, prototyp `proto/x01-variants.html?v=D`; świadomie poza drabinką, wpisane w regułach CSS, nie jako tokeny):
- imię w wierszu listy **36u** (do 4 graczy; kompaktowo 26u), meta wiersza **26u**;
- etykieta „CHECKOUT”/„SETUP”/„THIS TURN” w prawej połowie hero **26u**;
- suma Tury „THIS TURN” w prawej połowie hero **220u** (`accent`, szara przy 0; w 121 obok drabinki 160u), trasa 3-lotkowa 60u;
- pigułka statusu w rogu hero **32u** (800, wysokość 60u);
- numer miejsca w nagłówku kolumny Cricketa od 5 graczy **44u** (inicjały 24u, legenda numer → imię 34u/40u).

**Minimum tekstu na kiosku:** `max(16px, calc(18 * var(--u)))`. Przy 1280×720 `u` = 0,667 i 18u to 12 px, więc podłoga 16 px ratuje czytelność. Nic na Ekranie wyników nie jest mniejsze, także podpisy 11–16u z dzisiejszego kodu.

### Hierarchy: Pilot i `/stats` (px)
Wybrana drabinka: 12 / 14 / 16 / 20 / 24 / 28 plus liczby 40 / 56 / 72. Powód: 14 (23 użycia) i 16 (15) to dziś najczęstsze rozmiary tekstu, a 13 (23) i 15 (22) różnią się od nich o 1 px, więc scalają się bez widocznej zmiany. Krok 2 px poniżej 20 daje rytm, który da się zapamiętać.
- **ui-xs** (600, 12): daty, `caps` w kaflach, podpisy kolumn. Najmniejszy tekst w całym systemie na Pilocie.
- **ui-sm** (600, 14): podpisy, meta, tekst chipa i segmentu, `vs-note`. (Scala 13 i 14.)
- **ui-md** (600, 16): treść, etykiety opcji, toasty, przyciski, pola. (Scala 15, 16, 17.)
- **ui-lg** (700, 20): imiona, tytuły kafelków, delta główna. (Scala 18, 20, 22.)
- **ui-xl** (800, 24): tytuły ekranów i dialogów.
- **ui-2xl** (800, 28): tytuł profilu gracza, `center-msg`.
- **ui-num-sm / md / lg** (700, 40 / 56 / 72): liczby kafli statystyk, główna metryka, wynik aktywnego gracza na telefonie. (Scala 36→40, 44→40, 48→56, 64→56.)

### Named Rules
**The Three Metres Rule.** Z trzech metrów czyta się to, co ma ≥ 24u (30u dla imion). Tekst `tv-label` jest do podpisania, nie do czytania.

**The Numbers Are Barlow Rule.** Każda liczba o znaczeniu (wynik, średnia, delta, mm) to `Barlow Condensed` z `tabular-nums`. Imię i opis to Inter.

## Layout

**Ekran wyników** (`.big`, wypełnia okno, bez przewijania): nagłówek 80u, pod nim `board-main` w dwóch kolumnach: hero aktywnego gracza (reszta szerokości) i prawa kolumna **stałe 620u**, w każdej grze i przy 2–8 graczach. Wyjątki: siatka Cricketa (860u) i lobby (640u). Marginesy zewnętrzne 40u, odstęp między kolumnami 24u. Ostatni wiersz prawej kolumny to przyciski Pilota (`z-actions`), nad nakładkami. Wiersze listy są pełnowymiarowe do 4 graczy, kompaktowe od 5.

**Pilot** (jedna kolumna, `max-width: 560px`, wyśrodkowana): nagłówek 64 px, treść z marginesem 16 px i odstępem 16 px, przypięty na dole wiersz akcji (`p-actions`) z gradientem krycia, który kończy się nad treścią. **Laptop jako Pilot** od 1100 px: Setup w trzech kolumnach (gry, opcje, gracze) bez przewijania, od 1280×720.

**`/stats`, Players, Compare:** kolumna do 1100 px, marginesy 16 px.

**Summary:** na TV (`wide`) dwie kolumny (porównanie i heatmapa) w `tv-*` i `u`, bez przewijania strony; na telefonie jedna kolumna z przypiętymi przyciskami.

### Odstępy
Skala 4 / 8 / 12 / 16 / 24 / 32 / 40 / 56 (`spacing.s1…s8`), w px i w `u`. Wartości 6, 10, 14, 18, 20, 28 zaokrąglamy do najbliższej. `s8` (56) tylko dla dużych kart kiosku (padding hero, karty wyników).

### Cele dotykowe
Minimum **44 × 44 px** na wszystkim, co się stuka, także na kiosku przy 1280×720: `max(44px, calc(N * var(--u)))`. Dotyczy m.in. przycisków Pilota w prawej kolumnie (64u), ikon w nagłówku (48u), `bo-picks` (56u). Chip, segment, przycisk wielokrotności i krok steppera mają wysokość 44 px (dziś 36–40). Mała widoczna ikona (np. „i” 24 px) dostaje obszar 44 px przez `::after`.

### Responsywność (punkty)
- **< 560 px:** dialog `one-row` układa akcje w kolumnę; Summary jedna kolumna.
- **< 600 px:** `/stats` zagęszcza kolumny tabeli double i checkoutów.
- **≥ 1100 px:** Setup w trzech kolumnach. **< 1100 px:** kompaktowe kafelki gier bez opisu, 3 kolumny, ~64 px wysokości (D4).
- Przy 1280×720 kiosk skaluje się `u`, a podłogi (`16px`, `44px`) trzymają minimum.

## Elevation & Depth

System jest **płaski i warstwowy**. Głębię robi jaśniejszy odcień szarości (`bg` → `card` → `card-2`/`tile` → `raised`), nie obramowanie ani cień. Karta nie ma ramki. Cień mają tylko rzeczy, które unoszą się nad treścią i mogą zasłonić inny element.

### Shadow Vocabulary
- **shadow-float** (`box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5)`): toast, lista Dropdown, dymek informacji. Jeden cień uniesienia zamiast czterech (dziś 0.4, 0.5 i `0 12px 32px #000a`).
- **shadow-tag** (`box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5)`): plakietki na heatmapie (imię przy linii, uchwyt).
- **Obrys stanu** (`box-shadow: inset 0 0 0 2px var(--accent)` i `0 0 0 Nu …`): oznacza stan (aktywny słupek Cricketa, bieżący szczebel drabinki, błysk kafelka), nie głębię. Zostaje poza tokenem uniesienia.

### Scrim
- **scrim** (`rgba(10, 10, 11, 0.8)`): pod dialogiem, sheetem, drawerem, kartą Tury i nakładką wyniku. Jeden token zamiast 0,6 / 0,8 / 0,92.
- **scrim-solid** (`rgba(10, 10, 11, 0.92)`): tylko QR, gdzie nic spod spodu nie ma być czytane.

### Warstwy (`z-index`)
Nazwane, w kolejności od dołu. Wartości są dzisiejsze: system nadaje nazwy, nie zmienia kolejności.

| Warstwa | Wartość | Co |
|---|---|---|
| `z-row` | 1 | wiersz przeciągany w Setup, sticky nagłówek edytora |
| `z-overlay` | 20 | karta Tury i nakładki wyniku na Ekranie wyników; lista Dropdown |
| `z-actions` | 30 | wiersz przycisków Pilota (nad nakładką, klikalny); dymek informacji |
| `z-editor` | 35 | edytor reguł `/effects`, **pod** scrimem (świadomy wyjątek: Discard changes przyciemnia edytor) |
| `z-fx` | 40 | warstwa Momentów (nad kartą Tury) |
| `z-scrim` | 40 | scrim (równy `z-fx`, jak dziś; kolejność rozstrzyga DOM) |
| `z-qr` | 45 | nakładka QR |
| `z-modal` | 50 | dialog, sheet, drawer, wide-fix, pełnoekranowy test tarczy |
| `z-screen` | 60 | How to play na telefonie |
| `z-toast` | 70 | toasty |
| `z-banner` | 80 | baner „Lost connection” (dziś inline) |

### Named Rules
**The Flat-By-Default Rule.** Powierzchnie są płaskie. Cień dostaje element, który może zasłonić treść, i tylko `shadow-float` albo `shadow-tag`.

**The Layer Order Rule.** Wiersz przycisków Pilota (`z-actions`) leży nad nakładką (`z-overlay`), a Moment (`z-fx`) nad kartą Tury. Nie zmieniaj tej kolejności przy nowych warstwach.

## Shapes

Kształt to **pigułka i zaokrąglony prostokąt**. Przyciski, chipy, segmenty, przełączniki i kropki są pigułką (`9999px`). Karty i wiersze są prostokątami z dużym promieniem.

### Promienie
- **Ekran wyników (`u`):** `card` 36 (hero, lista, karty prawej kolumny, nakładki; dziś 36/40), `row` 26 (wiersz listy, kafelek lotki; dziś 28/26), `tile` 18 (kafelki statystyk, wizyt, komórki Cricketa; dziś 14/18/20/24).
- **Pilot (px):** `sheet` 28 (dialog, sheet, wide-fix), `box` 20 (karty, kafelek gry, wiersz gracza, lotka; dziś 18/20/22/24), `key` 16 (pole, klawisz, wiersz listy, dropdown; dziś 14/16), `sm` 12 (dymek, plakietka). Wiersze tabel i `cmp-val` 10 → `sm` 12.
- **Pigułka** `9999px`: wszystko, co stukane i małe.

### Reguła zagnieżdżenia
Element zagnieżdżony ma promień **o jeden stopień mniejszy** od rodzica: `sheet` 28 → `box` 20 → `key` 16 → `sm` 12; `card` 36 → `row` 26 → `tile` 18. Wyjątek: pigułka może stać w dowolnym rodzicu. Dzięki temu odstęp od krawędzi rodzica wygląda równo na rogach.

### Ikony i obrys
Ikony liniowe, siatka 24, kreska 2 w kolorze tekstu (jedna na grę w `GameIcon.tsx`). Bez emoji. Puste miejsce na lotkę to obrys przerywany (`dashed`) w `line`. Serca to konturowe SVG (czerwone żywe, `off` stracone), nigdy pełne.

## Components

Wartości liczbowe są w frontmatterze (`components`), tu jest charakter i zachowanie. **Tory interakcji:** na dotyku jest tylko `:active` (press), `:hover` tylko w `@media (hover: hover) and (pointer: fine)`; `:focus-visible` to obrys 2 px `accent` z odsunięciem 2 px.

### Buttons
Pigułka, 52 px wysokości, 16 px / 600, padding 0 24. Na kiosku przycisk jest większy (`calc(64 * u)` w prawej kolumnie, 80u na kartach wyników), ale nie niższy niż 44 px.
- **Primary** (`button-primary`): `accent` + `ink`, waga 800. Jeden na ekran. „Next player”, „Start match”, „Takeout done”.
- **Secondary** (`button-secondary`, domyślny `.btn`): `raised` + `text`.
- **Danger** (`button-danger`): `red-bg` + `red-soft`, waga 700. „Remove from match”, restart, discard.
- **Ghost:** obrys 1 px `line`, bez tła.
- **Disabled** (`button-primary-disabled`): `disabled-bg` + `disabled-fg`, bez `opacity`. Powód blokady stoi obok jako tekst w `muted` (≥ 4,5:1).
- **Press:** `:active` → `scale(0.97)` w `--dur-press`; większe powierzchnie (kafelek gry, karta gracza, wiersz listy) `scale(0.98)`. Wiersze graczy na Ekranie wyników (stuknięcie → Wycofanie): `opacity: 0.8`, bez skali. Przycisk wyłączony nie reaguje.

### Chips / segmenty
- **Chip** (`chip`, `chip-on`): pigułka 44 px, obrys `line`; zaznaczony: tło `text`, tekst `ink`. Z ikoną gry z lewej (kolor tekstu). Pomarańcz tylko dla „zaznaczone i aktywne” w kontekście akcji.
- **Segment** (`segment`, `segment-on`): grupa w pigułce na `card`, przycisk 44 px; zaznaczony `text` + `ink`. **Jeden wspólny komponent** zamiast `.seg`, `.mult-row` i `.chip.on`. Zmiana zaznaczenia przez opacity warstwy tła w `--dur-fast`.
- **Switch:** 48×28, gałka przesuwana `transform`, tor `accent` gdy włączony; wyłączony `line`.

### Cards / wiersze
- **Karta** (`card`): `card`, `rounded.card` 36u, padding 28u/32u, bez obramowania i cienia. Wersja Pilota (`card-ui`): `rounded.box`.
- **Wiersz gracza** (`player-row`): `card-2`, `rounded.row`, imię `tv-name`, wynik `tv-score`. **Aktywny** (`player-row-active`): `accent` + `on-accent`, meta w `accent-ink`, kropki legów `off-on-accent` (niewygrany) i `ink` (wygrany). Wycofany: tekst i ikony w kolorze `off` (3,43:1 na `card-2`) zamiast `opacity: .4` (dawało 1,8–3,0:1). Zmiana aktywnego gracza jest natychmiastowa, bez przejścia koloru.
- **Wiersz kompaktowy** od 5 graczy: ten sam komponent, padding 14u/24u, `tv-name` 26, wynik 72.

### Kafelek lotki
Szerokość 230u, wysokość 160u, `rounded.row`, wielkie pole nad małą wartością (T20 / 60).
- **X01** (`dart-tile-x01`, D1): `raised` + `text`. Pomarańcz ma tylko suma Tury obok kafelków.
- **Minigierki liczone trafieniami** (ATC, Full Board, Cricket, Killer): `dart-tile-hit` zielony i `dart-tile-miss` czerwony, tekst `ink`. Bez zmian.
- **Pozostałe minigierki** (121, Higher or Lower): kafelek bez wyniku to `dart-tile-dead` (`raised` + `muted`). Kafelek z wynikiem zostaje taki jak dziś (decyzja do potwierdzenia przy tickecie Ekranu wyników).
- **Pusty:** obrys przerywany `line`, bez wypełnienia. Poprawka z Pilota: zielony pierścień 1,6 s (Moment `flash`), poza zakresem.
- Brak animacji wejścia w Turze (setki razy dziennie, w tym samym miejscu co Moment).

### Dialog
Wyśrodkowany, `sheet` + `rounded.sheet` 28, padding 28, szerokość `min(560px, 100vw − 32px)` (`one-row`: 680). Tytuł `ui-xl`, tekst `soft`, akcje po prawej (na wąskim ekranie w kolumnie). Pod `scrim`. Wejście: opacity + `scale(.96)` w `--dur-base`; Esc zamyka, fokus uwięziony w oknie i wraca do wywołującego. Tytuł i imię nie powtarzają tej samej treści.

### Sheet (Poprawka na telefonie)
Dolny arkusz `sheet`, `rounded` 28 28 0 0, `max-width: 560px`, uchwyt `faint` 40×5. Wchodzi od dołu `translateY(100%)` w `--dur-sheet` z `--ease-drawer`. Na laptopie ta sama zawartość to `wide-fix` (prawie cały ekran, opacity + `scale(.98)`).

### Drawer (Panel tarczy)
Od prawej krawędzi, `drawer`, 600 px, padding 32. Wejście `translateX(100%)` w `--dur-sheet` z `--ease-drawer`, scrim z fade.

### Toast
`toast`, `rounded.box`, padding 12/16, `ui-md`, `shadow-float`. Błąd: `red-bg` + `red-soft`. **Na Ekranie wyników** (`.big`) stoi pod nagłówkiem przy lewej krawędzi (nad hero), w `u`, nie wchodzi na prawą kolumnę i wiersz przycisków. **Gdzie indziej** na dole pośrodku. Wchodzi od swojej krawędzi (`translateY(±8px)`) w `--dur-base`, wychodzi samym opacity w `--dur-exit`. Akcja w toaście ma 44 px.

### Dropdown
Przycisk `card` + obrys `line`, 44 px, wartość w `Barlow` wersalikami, znacznik koloru z lewej, strzałka obraca się o 180°. Lista `card-2`, `rounded.key`, `shadow-float`, pozycje ≥ 44 px, **pełna obsługa klawiatury** (strzałki, Enter, Esc). Wejście `scale(.97)` z `transform-origin: top`.

### Pola
Wysokość 52 px, padding 0 16, `rounded.key`, obrys `line`; fokus: obrys `accent`. Placeholder `muted-2`.

### EmptyState (nowy)
Dla pustych danych (`/stats` bez meczów, brak rekordów, brak ostatniego meczu w Lobby, gracz bez meczów). Wyśrodkowany: tytuł `ui-lg` w `text`, jedno zdanie `ui-md` w `muted`, **jedna** akcja (np. „New match”), padding 40/24, bez ramki i bez ilustracji. Nie pokazuje braku danych jako zera.

### Nakładki Ekranu wyników
Karta Tury i wynik legu/meczu: `sheet` + `rounded.card` 40 → **36** (system), pod `scrim`. Wspólny wygląd: kicker `tv-lead`, wielki napis, kafelki `result-grid` (`raised`, `tile`). Karta Tury **nie** ma animacji wejścia (konflikt z Momentami). Wiersz przycisków leży nad nakładką.

### Ruch
Pełne tokeny: sidecar `.impeccable/design.json` → `extensions.motion`, a tu zasady.

| token | wartość | do czego |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | wejścia, press, zmiany stanu |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | sheet i drawer od krawędzi |
| `--dur-press` | 120 ms | `:active` |
| `--dur-fast` | 150 ms | zakładki, segmenty, chipy, switch, strzałki, dropdown, dymek, wiersz listy |
| `--dur-base` | 200 ms | dialog, scrim, toast, przejście ekranu (crossfade) |
| `--dur-sheet` | 250 ms | FixSheet na telefonie, Panel tarczy |
| `--dur-exit` | 150 ms | każde wyjście (krócej niż wejście) |

Mapowanie klas interakcji:

| klasa interakcji | właściwości | czas | krzywa |
|---|---|---|---|
| press | `transform: scale(.97/.98)`; wiersze graczy `opacity: .8` | `--dur-press` | `--ease-out` |
| zaznaczenie: zakładka, segment, chip, switch | `opacity` warstwy tła; `transform` gałki | `--dur-fast` | `--ease-out` |
| strzałka rozwinięcia | `transform: rotate` | `--dur-fast` | `--ease-out` |
| popover, dropdown, dymek | `opacity` + `scale(.97)` / `translateY(-4px)` | `--dur-fast` | `--ease-out` |
| wejście wiersza listy (Setup) | `opacity` + `translateY(-4px)` | `--dur-fast` | `--ease-out` |
| dialog, menu | `opacity` + `scale(.96)` (menu `--dur-fast`) | `--dur-base` | `--ease-out` |
| scrim, nakładka pełnoekranowa, przejście ekranu | `opacity` | `--dur-base` | `--ease-out` |
| toast | `opacity` + `translateY(±8px)` | `--dur-base` | `--ease-out` |
| sheet, drawer | `translateY(100%)` / `translateX(100%)` | `--dur-sheet` | `--ease-drawer` |
| wyjście czegokolwiek | jak wejście, krócej lub samo `opacity` | `--dur-exit` | `--ease-out` |

**Czego nie animujemy:** liczb wyniku (wynik, średnie, `this turn`), kafelków lotek w Turze, wejścia karty Tury, zmiany aktywnego gracza, hoverów, stagger list w Stats/Players/Summary, rozwijania grup (animacja wysokości), banerów ostrzegawczych („Lost connection”, obrót tarczy), zmiany Okna na `/stats`. Dialogi centrowane przez `transform: translate(-50%,-50%)` animujemy właściwością `scale`, nie `transform` (inaczej zgubią środek).

**Przejścia ekranów:** krótki crossfade ~200 ms wszędzie (decyzja użytkownika): WAAPI `opacity` na `#root` przy zmianie ekranu; `@view-transition` dla przejść między dokumentami (`/stats`, `/effects`).

**Reduced motion** (`@media (prefers-reduced-motion: reduce)`, jeden blok na końcu `styles.css`, **obejmuje też Momenty**, sam CSS, zachowanie bez ustawienia bez zmian): zostaje `opacity` i kolor (fade scrimów, dialogów, toastów, ekranów; press `scale(.97)`; winieta Bust, tło 180, błysk kropek, pierścień kafelka). Znika `transform` i ruch ciągły: „180” bez skali, plakietka 140+ bez przesunięcia, konfetti `display: none`, `pop` kart i serc samym opacity, drgnięcie serca (zostaje kolor), drabinka i odometr 121 w stanie końcowym, spinner takeoutu stoi, obrys celu stoi (nadal przerywany i pomarańczowy), gałka switcha i wejście wiersza bez przesunięcia, `::view-transition-group(*)` 0 s.

## Do's and Don'ts

### Do:
- **Do** używać jednego akcentu `#F58224` tylko dla „teraz” i „główne”: aktywny gracz, jedna główna akcja, główna metryka, suma Tury.
- **Do** pisać `ink` (`#111111`) na pomarańczowym, zielonym, czerwonym, żółtym i kolorach graczy.
- **Do** trzymać jeden ciemny motyw i UI wyłącznie po angielsku (dokumentacja po polsku).
- **Do** ładować Barlow Condensed i Inter lokalnie: aplikacja działa offline, bez CDN i zewnętrznych czcionek, skryptów i obrazów.
- **Do** animować tylko `transform` i `opacity` (wyjątek: tor 48×28 switcha, kolor błysku kropek).
- **Do** dawać stan `:active` każdemu elementowi, który da się stuknąć, i `:focus-visible` (obrys 2 px `accent`).
- **Do** trzymać 44 × 44 px minimum także na kiosku przy 1280×720: `max(44px, calc(N * var(--u)))`.
- **Do** trzymać tekst na kiosku ≥ `max(16px, calc(18 * var(--u)))`.
- **Do** oznaczać stany wyłączone `off` / `off-on-accent` (≥ 3:1) i tekst nieaktywnego przycisku `disabled-fg` (≥ 4,5:1).
- **Do** wybierać wartość z drabinki (typografia, odstępy, promienie, z-index, czasy), zamiast wpisywać nową.
- **Do** zaczynać każdy nowy Moment od wpisu w `ORDER` (`games/effects.ts`) przed Momentami padającymi tą samą lotką.
- **Do** dawać pustym danym `EmptyState` z jedną akcją, a brak porównania pokazywać jako „–”, nie jako 0.
- **Do** dopisywać zmianę decyzji z UI.md do UI.md w tym samym PR.

### Don't:
- **Don't** dodawać drugiego akcentu ani koloru per gracz poza Summary i Compare (zostaje do trybu drużynowego).
- **Don't** pisać białego tekstu na pomarańczowym (2,4:1).
- **Don't** dodawać jasnego motywu ani przełącznika motywu.
- **Don't** używać emoji jako ikon ani pełnych serc (konturowe SVG; w tekście ♡).
- **Don't** animować liczb wyniku, kafelków lotek w Turze, wejścia karty Tury ani zmiany aktywnego gracza.
- **Don't** dodawać `:hover` poza `@media (hover: hover) and (pointer: fine)`. Pilot to dotyk.
- **Don't** używać `opacity` do stanu wyłączonego tekstu i ikon niosących informację (kontrast spada poniżej 3:1).
- **Don't** używać `#111` ani `#0A0A0B` wprost w CSS: `--ink`, `--bg`.
- **Don't** wpisywać `box-shadow` ani `rgba(…)` scrimu inline: `shadow-float`, `shadow-tag`, `scrim`.
- **Don't** nakładać na prawą kolumnę ani wiersz przycisków Ekranu wyników niczego poza przyciskami Pilota (karta Tury, toasty, bull-off).
- **Don't** reklamować telefonu na Ekranie wyników laptopa (QR, „on the pilot”).
- **Don't** kopiować wartości `px` z Pilota na Ekran wyników ani odwrotnie: dwie drabinki, dwie odległości.
- **Don't** ukrywać czytelności z daleka za estetyką: gdy ładniejsze koliduje z czytelnym z trzech metrów, wygrywa czytelne.
