# Mapa momentów, dźwięki i ledy (szkic do grillingu #9)

Szkic z 2026-10-28 do grillingu [#9](https://github.com/jgoliszewski/ITDarts/issues/9), przygotowany bez tarczy i ringu. **Nic tu nie jest jeszcze postanowione.** Na końcu jest pierwsza runda pytań z rekomendacjami, a pod nią to, co od nich zależy.

## Symulator ledów

```bash
npm run led-sim
```

Otwiera `http://localhost:5173/led-sim.html` (strona działa też przy `npm run dev` i `npm run dev:fake`). Kod jest w `web/src/ledsim/`, a strona w `web/led-sim.html`. Od 2026-10-29 to sam podgląd: Momenty i sekwencje z ledami z `server/effects/leds.ts`, tymi samymi co na kontrolerze, z dźwiękiem i przełącznikiem „Play on the ring”, który gra je też na prawdziwym ringu (przez „Try”, więc aplikacja musi działać). Zestawy do porównania, wybory i notatki zostały usunięte. Zakładka Sound check, zestawy A–D i propozycje dźwięków zostały usunięte po decyzjach, więc ich opisy niżej są historyczne.

- **Dwa ringi** (poprawka z 2026-10-28): kontroler steruje dwoma ringami po mniej więcej 50 ledów, a segmenty 0–48 i 48–100 to właśnie one. Jeden ring oświetla tarczę, a drugi, bliżej ściany, robi poświatę na ścianie wokół niej. Oba grają ten sam efekt, każdy od swojego pierwszego leda. Patrząc od linii rzutu, ring ściany jest wewnętrzny, tuż przy tarczy, i świeci na ciemną ścianę, a ring tarczy jest zewnętrzny, bliżej gracza, i świeci na tarczę. Tak samo rysuje je symulator, z odstępem między ringami. Ustawienia „Rings”, „Lights the board” i „Second ring reversed” pozwalają dobrać podział (48 lub 50), który ring jest który i kierunek drugiego.
- **Momenty** z mapy poniżej, w grupach, z siłą, charakterem i dźwiękiem. Kliknięcie nazwy gra moment w wybranym zestawie, a przyciski Today, A, B, C grają go w konkretnym zestawie. Dźwięk to ten sam syntezator co w kiosku (`web/src/sound.ts`).
- **Zestawy:** Today (dzisiejsze presety, odtworzone tak wiernie, jak się da) oraz trzy propozycje: A, B i C (niżej).
- **Sekwencje** grają kawałek prawdziwego meczu z odstępami jak przy rzucaniu: tura T20 · 20 · T20, 180, bust, wygrany set i mecz, tura Cricketa, Killer. Widać w nich, jak często coś gra.
- **Sound check** (zakładka po prawej, otwiera się pierwsza): dźwięki bez ledów, w czterech grupach. Treble ladder to T15–T20, Strength ladder idzie od S do XL, Bad family zbiera wszystkie złe momenty, a Everything else to reszta bez zmian. Każdy wiersz ma „▶ Today” i „▶ Proposal” oraz wybór „Keep today” albo „Take the proposal”. Każda grupa ma „▶ All today in a row” i „▶ All proposals in a row”, żeby usłyszeć całą drabinkę albo rodzinę pod rząd, oraz notatkę. Propozycje są w `web/src/ledsim/sounds.ts`.
- **Dźwięki przy momentach:** „sounds today” albo „sound proposals” wybiera, co grają momenty i sekwencje w zakładce Moments and LEDs. Momenty bez propozycji grają dzisiejszy dźwięk.
- **Fade** mnoży czasy przejść w zestawach A–C: 0 to twarde przełączenie jak dziś, a 1 to propozycja.
- **Pause** i ½×, ¼× pozwalają obejrzeć przejście klatka po klatce.
- **Układ:** gdzie fizycznie jest pierwszy led każdego ringu i w którą stronę idą ledy. Na razie to zgadywanie: domyślnie na dole, zgodnie z zegarem, ring 0–48 oświetla tarczę.
- **Pick** i **Note** przy każdym momencie zapisują wybór w przeglądarce. „Copy picks” kopiuje tabelkę do schowka, żeby wkleić ją do rozmowy albo do issue.

**Zastrzeżenia:**
- Ekran to nie ledy. Biel monitora jest dużo słabsza od białych ledów, więc w rzeczywistości biel zjada kolor jeszcze mocniej niż w symulatorze.
- Flash, Fill, Run i tęcza liczą się jak w WLED. Pulse ma trochę inną krzywą, a Ripple, Burst i Dissolve są tylko przybliżone.
- Today pokazuje Pulse i Fill od losowego miejsca cyklu, bo tak startują na kontrolerze.

## Mapa momentów

**Moment** to chwila w grze, na którą może coś zagrać: dźwięk, ledy albo jedno i drugie (pytanie Q1 dotyczy nazwy). Siła: S, M, L i XL. Charakter: neutralny, dobry, zły albo zabawny.

| Grupa | Moment | Kiedy | Siła | Charakter | Jak często | Dźwięk dziś | Ledy dziś |
|---|---|---|---|---|---|---|---|
| Mecz | Game on | start meczu | L | neutralny | raz na mecz | Game on | Fill · biel |
| | Leg start | start kolejnego legu | S | neutralny | co leg | brak (caller: „game on”) | brak |
| | Next player | zmiana gracza | S | neutralny | co turę | marimba, na sztywno | brak |
| Lotka | Treble 15–19 | T15…T19 | S | dobry | kilka na leg | Treble 15–19 | Flash · biel |
| | Treble 20 | T20 | S | dobry | często w X01 | Treble 20 | Flash · pomarańcz |
| | Bullseye | 50 | M | dobry | czasem | Bull | Flash · pomarańcz, 1 s |
| Tura | Ton | 100–139 | M | dobry | kilka na leg | Ton | Pulse · biel |
| | Ton 40 | 140–179 | M | dobry | czasem | Ton 40 | Run · pomarańcz |
| | 180 | 180 | XL | dobry | rzadko | 180 | Burst · pomarańcz na bieli |
| | Clean 20s | trzy single 20 | S | dobry | czasem | Clean 20s | Run · biel |
| | Bed and breakfast | 1 · 5 · 20 | S | zabawny | często u początkujących | Bed and breakfast | Ripple · biel |
| | No score | 0 | S | zły | kilka na mecz | No score | Flash · czerwień |
| | Bust | bust | M | zły | kilka na mecz | Bust | Dissolve (preset 3) |
| Koniec legu | Checkout | wygrany leg i minigierka | L | dobry | co leg | Leg won | Rainbow Sweep |
| | Madhouse | checkout na D1 | L | zabawny | rzadko | Madhouse | Run · tęcza |
| | High finish | checkout 100–170 | L | dobry | rzadko | High finish | Fill · tęcza |
| | Big Fish | checkout 170 | XL | dobry | bardzo rzadko | Big fish | Burst · tęcza na bieli |
| | Set won | wygrany set | L | dobry | mecze na sety | Set won | Ripple · pomarańcz |
| | Match won | wygrany mecz | XL | dobry | raz na mecz | Match won | Burst · tęcza na bieli |
| Minigierki | Hit | lotka, która się liczy | S | dobry | co lotkę | kwinta w górę, na sztywno | brak |
| | Miss | lotka, która się nie liczy | S | zły | co lotkę | kwinta w dół, na sztywno | brak |
| | Sector closed | Cricket: zamknięty sektor | M | dobry | kilka na grę | brak | brak |
| | White Horse | trzy różne treble | L | dobry | bardzo rzadko | White Horse | Burst · biel |
| | Shanghai | Shanghai: S, D i T sektora rundy w jednej Turze | XL | dobry | rzadko | White Horse | jak White Horse |
| | Gotcha | Gotcha: rywal wraca do zera | L | zabawny | kilka na grę | Bed and breakfast | jak Bed and breakfast |
| | Goal | Football: double z piłką | M | dobry | kilka na grę | Ton | jak Ton |
| | Life lost | Killer, 121, Knockout: utrata życia | M | zły | kilka na grę | brak | brak |
| | Lowest visit | Knockout: najniższa Tura rundy do tej pory | M | zły | kilka na grę | No score | jak Life lost |
| | Became killer | Killer: gracz zostaje killerem | M | dobry | raz na gracza | brak | brak |
| | Attempt failed | 121: nieudane podejście | M | zły | kilka na grę | brak | brak |
| | Player out | eliminacja | L | zły | kilka na grę | Player out | Pulse · czerwień |
| | New record | rekord biura lub osobisty | L | dobry | rzadko | New record | Pulse · tęcza |
| Stany | Lobby, mecz | tło | | | | | Gameon (ciepła biel) |
| | Takeout | tło | | | | | brak (ruch trzyma takeout) |
| | Board offline | tło | M | zły | rzadko | | Pulse · czerwień |

Wyzwalacze „Sector cleared” (Full Board), „Target hit” (ATC) i „Marks in visit” (Cricket) są w kodzie, ale w praktyce pokrywa je Hit. Nie dałem im osobnych wierszy.

## Co widać w dźwiękach

Dźwięki są w większości dobre, a problemem jest spójność. Długość i bogactwo dźwięku nie idą za siłą momentu:

1. **Treble jest „większy” niż Ton.** Treble 15–20 (S) to cztery nuty marimby i dzwonek wybrzmiewający około 1,1 s. Ton (M) to trzy nuty bez dzwonka, 0,5 s. Clean 20s (S) też ma dzwonek. Dzwonek jest więc dziś przy małych momentach, a nie znakiem dużych.
2. **Za dużo naraz w X01.** Tura T20 · T20 · T20 to dwie iskry, potem 180 i jeszcze caller. Tura T19 · T20 · T18 to trzy iskry i Ton 40, czyli cztery dźwięki w 3 s plus caller. Treble to najczęstszy dźwięk w X01, a jest bogaty jak średni moment.
3. **„Źle” ma trzy języki.** Bust i No score to trójkątne tony w dół z niskim zjazdem. Player out to molowa marimba ze zjazdem. Miss to kwinta marimby w dół. Life lost i Attempt failed milczą.
4. **Set won brzmi prawie jak High finish:** ta sama kadencja G → C z dzwonkami, a Set won dokłada tylko dwie nuty. Większy moment nie brzmi więc jak większy.
5. **Kalimba jest tylko w Bed and breakfast.** Pasuje do żartu, ale żaden inny zabawny moment (Madhouse, Clean 20s) jej nie używa.
6. **Głośności na sztywno:** Next player gra na 0,75, a Hit i Miss na 0,56 poziomu efektów. Reguły grają na pełnym poziomie, każda ze swoim suwakiem.

## Co widać w ledach

Symulator powtarza oba problemy z ringu.

- **Biel zjada kolor.** Biały led świeci wszystkimi trzema diodami naraz, więc jest dwa–trzy razy jaśniejszy od czerwonego czy zielonego. Gdy kolor biegnie po ciepłej bieli (Run, Ripple, Burst „na bieli”), oko i światło na tarczy idą za bielą, a kolor zostaje cienką kreską. Najlepiej widać to w Ton 40 i 180 w zestawie Today. Ten sam pomarańcz na całym ringu (zestaw A) zmienia kolor całej tarczy.
- **„Za ostre” to twarde przełączenie.** Presety mają `transition: 0`, więc Flash i powrót do tła to skok w jednej klatce. WLED umie płynnie przejść (`transition` w stanie i w playliście), tylko dziś tego nie używamy. Suwak Fade w symulatorze pokazuje różnicę.
- **Losowy start:** Pulse i Fill startują w losowym miejscu cyklu, bo liczą czas od zegara kontrolera. Płynne przejście do jednolitego koloru tego problemu nie ma.

## Zestawy w symulatorze

| Zestaw | Pomysł | Ruch w trakcie tury | Jak zrobić na WLED |
|---|---|---|---|
| **Today** | dzisiejsze presety z LED labu | tak | już jest |
| **A · Colour wash** | Cały ring płynnie przechodzi w jeden kolor i wraca. Nic się nie rusza, nic nie miesza się z bielą. Siła to długość i liczba „oddechów”, charakter to kolor. Tylko XL (180, Big Fish, Match won, New record) dostaje płynącą tęczę. | nie | Preset Solid w kolorze i `transition`. „Oddechy” to playlista Solid kolor ↔ tło z przejściami, więc zawsze startują od początku. |
| **B · Tone on tone** | Małe momenty jak w A. Większe mają ruch, ale w dwóch odcieniach jednego koloru (pomarańcz na żarze, zieleń na morskim), nigdy na bieli. | tak, od M | Efekty WLED z kolorem 2 zamiast bieli i `transition`; ruch startuje w losowym miejscu cyklu. |
| **C · Few and big** | Ledy tylko na wyniki i rzadkie momenty (Game on, 180, Bust, koniec legu, set, mecz, White Horse, Player out, New record), w stylu A. Lotki, tury i minigierki mają sam dźwięk. | nie | jak A, tylko mniej presetów |
| **D · Split rings** | Ring tarczy tylko płynnie zmienia kolor jak w A, więc kamery dostają spokojne światło. Ruch w tym samym kolorze gra na ringu ściany, trochę dłużej. Koniec meczu może świętować na obu ringach. | ring ściany tak, ring tarczy nie | Jeden preset z dwoma segmentami o różnych efektach i `transition` |

Kolory w A–D:
- pomarańcz: dobrze w trakcie tury;
- złoto: treble (odpadło w Q8, zestawy grają treble na pomarańczowo);
- zieleń: koniec legu (checkout, finisz, set) i Bull;
- tęcza: XL;
- czerwień: źle;
- fiolet i magenta: zabawne;
- czysta biel: neutralne (Game on, Leg start).

Kolory są nasycone i bez przygaszania, zgodnie z wnioskami z LED labu.

## Odpowiedzi z rundy 1 (2026-10-28)

- **Kolejność:** najpierw postanawiamy dźwięki (Q10, Q11 i panel „Sound check” w symulatorze), dopiero potem ledy.
- **Q1:** tak, **Moment**.
- **Q2:** tak. Next player, Hit i Miss zostają Regułami bazowymi z własnymi Wyzwalaczami.
- **Q3:** skala zostaje, z dwiema zmianami: Set won to **L** (nie XL), a Clean 20s ma charakter **dobry** (nie zabawny).
- **Q4:** **(a)**. Mapa żyje w kodzie, a dokument opisuje zasady i odsyła do kodu.
- **Q5:** kolor i krótki ruch po lotce działają: mieniąca się tęcza na T20 nie przeszkadzała. Ruch w czasie takeoutu daje za to niekończący się takeout, bo kamery widzą ruch. Zasada:
  - po lotce wolno wszystko, co krótkie;
  - tło, do którego wraca efekt, i wszystko w czasie takeoutu jest statyczne.

  Wynika z tego, że ruchomy efekt po trzeciej lotce (np. 180) przedłuża takeout do swojego końca. Do sprawdzenia w rundzie 2, czy to przeszkadza.
- **Q6:** odpowiedź później.
- **Q7:** ocenimy na żywo, na ringu.
- **Q8:** złota na ledach nie ma, bo wygląda jak słaby żółty. Zostają:
  - pomarańcz: dobrze, w tym wszystkie treble;
  - zieleń: wygrany leg;
  - fiolet: zabawne;
  - tęcza: XL;
  - czerwień: źle;
  - biel: neutralne.
- **Q9:** Treble 15–19 to nadal wysokie treble, więc mają i dźwięk, i ledy, jak T20 i Bull.
- **Q10:** przyjęte, wszystkie propozycje z Sound check (Treble ladder i Strength ladder):
  - S to marimba bez dzwonka: Treble 15–20 to trzy szybkie nuty, nadal coraz wyżej od T15 do T20, a Clean 20s to trzy uderzenia;
  - M to bieg marimby i jeden dzwonek: Ton dostaje mały dzwonek;
  - L to akordy i dzwonki: Set won dostaje trzeci akord o stopień wyżej (G → C → C wyżej), żeby nie brzmiał jak High finish;
  - XL to najdłuższe dźwięki: 180, Big Fish i Match won zostają bez zmian.
- **Q11:** przyjęte. Jeden motyw „źle”: marimba w dół, a od M także niski zjazd. Miss zostaje bez zmian, No score i Bust przechodzą z tonów trójkątnych na marimbę, a Player out dostaje dłuższy zjazd.
- **Q12:** tak. Nowych dźwięków nie ma; Life lost i Attempt failed dostają dźwięk No score, a Sector closed dźwięk Hit.
- **Q13:** zamiast jednego ringu są dwa (opis w sekcji [Symulator ledów](#symulator-ledów)). Połówki idą w tę samą stronę. Sprawdzone przy tarczy 2026-10-29: ring tarczy to segment 0 (ledy 0–48), ściany segment 1 (48–100), podział czysto na 48. Oba ringi zaczynają na godzinie 1 i idą zgodnie ze wskazówkami zegara; symulator ma to domyślnie.

## Odpowiedzi z rundy 2 (2026-10-28)

- **R1:** **D**. Efekty po trzeciej lotce, także ruchome, są w porządku. Problem był tylko z animowanym stanem bazowym takeoutu: po wyjęciu lotek ring dalej się ruszał, więc takeout się nie kończył.
- **R2:**
  1. Kolor ringu tarczy po trzeciej lotce nie przeszkadza.
  2. Ruch na ringu ściany nie przeszkadza.
  3. Kolor na tarczy trwa najwyżej **2 s**. Dłużej grają tylko Match won i New record, bo po końcu gry nic nie jest wykrywane.
- **R3:** oba ringi grają **tyle samo** czasu.
- **R4–R10:** tak, jak w rekomendacjach. Ring tarczy zmienia kolor raz, a długość mówi o sile. Silnik to presety WLED. Presety tworzy kod ze stałymi numerami. Ledy są częścią Momentu. LED lab znika. Zestaw D to punkt startu. Stany bazowe zostają bez zmian.

## Przypisania

Stan po rundach 1 i 2 i po obejrzeniu na ringu (2026-10-29, [#10](https://github.com/jgoliszewski/ITDarts/issues/10)). Ledy są w `server/effects/leds.ts`.

Poprawki z ringu:
- tęcza na kontrolerze była jednym kolorem, bo efekt Rainbow miał paletę 2; teraz ma paletę 11;
- Dissolve na kontrolerze migał losowymi pikselami i nie przypominał symulatora, więc czerwone Momenty mają oba ringi w jednym kolorze, bez ruchu;
- Hit, Miss i czerwone Momenty minigierek były słabo widoczne: grają teraz na obu ringach, Hit i Miss przez 0,8 s;
- tarcza offline to stała czerwień zamiast Pulse do ciepłej bieli.

Tak poprawione ledy obejrzane w podglądzie z „Play on the ring”: działają. W meczu (detekcja, takeout, dźwięki w kiosku) jeszcze nie sprawdzone.
- **Ring tarczy** zawsze płynnie przechodzi w kolor i wraca: wejście 0,15 s, wyjście do 0,8 s.
- **Ring ściany** gra ruch tyle samo czasu co ring tarczy. „Żar” to ciemniejszy pomarańcz (255,40,0), a „morski” to ciemniejsza zieleń (0,200,120).
- **Pogrubiony dźwięk** jest nowy albo zmieniony.

| Moment | Dźwięk | Ring tarczy | Ring ściany | Czas |
|---|---|---|---|---|
| Game on | Game on | biel | Fill: biel na ciepłej bieli | 2 s |
| Leg start | brak (mówi caller) | biel | biel, jak ring tarczy (zestaw B) | 0,9 s |
| Next player | marimba | brak | brak | |
| Treble 15–19 | **trzy nuty bez dzwonka**, coraz wyżej | pomarańcz | Run: pomarańcz na żarze | 0,7 s |
| Treble 20 | **trzy nuty bez dzwonka**, najwyżej | pomarańcz | płynąca tęcza, szybka | 1 s |
| Bullseye | Bull | zieleń | Ripple: zieleń na morskim | 1,4 s |
| Ton | **bieg i mały dzwonek** | pomarańcz | Run: pomarańcz na żarze | 1,4 s |
| Ton 40 | Ton 40 | pomarańcz | Run, szybszy | 1,6 s |
| 180 | 180 | pomarańcz | białe iskry (Burst) na pomarańczu | 2 s |
| Clean 20s | **trzy uderzenia bez dzwonka** | pomarańcz | Run: pomarańcz na żarze | 0,8 s |
| Bed and breakfast | Bed and breakfast | magenta | Ripple: fiolet na magencie | 0,8 s |
| No score | **marimba w dół** | czerwień | czerwień, bez ruchu, jak Bust | 1,4 s |
| Bust | **marimba w dół i zjazd** | czerwień | czerwień, bez ruchu | 1,4 s |
| Checkout | Leg won | zieleń | Fill: zieleń na morskim | 2 s |
| Madhouse | Madhouse | fiolet | Ripple: fiolet na magencie | 2 s |
| High finish | High finish | zieleń | Ripple: zieleń na morskim | 2 s |
| Big Fish | Big fish | zieleń | płynąca tęcza | 2 s |
| Set won | **G → C → C wyżej, z dzwonkami** | zieleń | Run: zieleń na morskim | 2 s |
| Match won | Match won | płynąca tęcza | białe iskry na pomarańczu | 6 s |
| Hit | kwinta w górę | pomarańcz | pomarańcz, bez ruchu | 0,8 s |
| Miss | kwinta w dół | czerwień | czerwień, bez ruchu | 0,8 s |
| Sector closed | **Hit** | zieleń | Run: zieleń na morskim | 1,4 s |
| White Horse | White Horse | fiolet | Run: biel na fiolecie | 2 s |
| Shanghai | **White Horse** | fiolet | jak White Horse (preset 123) | 2 s |
| Gotcha | **Bed and breakfast** | magenta | jak Bed and breakfast (preset 111) | 0,8 s |
| Goal | **Ton** | pomarańcz | jak Ton | 1,4 s |
| Life lost | **No score** | czerwień | czerwień, bez ruchu | 1 s |
| Lowest visit | **No score** | czerwień | jak Life lost (preset 124) | 1 s |
| Became killer | brak | karmin | karmin, bez ruchu | 1,4 s |
| Attempt failed | **No score** | karmin | karmin, bez ruchu, jak Became killer | 1,4 s |
| Player out | **marimba w dół i dłuższy zjazd** | czerwień | czerwień, bez ruchu | 2 s |
| New record | New record | płynąca tęcza | Ripple: pomarańcz na żarze | 3 s |
| Stany: lobby, mecz | | ciepła biel (Gameon) | ciepła biel | stan |
| Stan: takeout | | bez zmiany | bez zmiany | |
| Stan: tarcza offline | | czerwień, bez ruchu | czerwień, bez ruchu | stan |

## Do zrobienia

- **Dźwięki i ledy w kodzie** (zrobione 2026-10-28): nowe dźwięki w `web/src/sound.ts`, nowe Reguły bazowe w `server/effects/builtin.ts`, ledy w `server/effects/leds.ts` z presetami 100–128 i skryptem `npm run leds:upload`. LED lab usunięty, a propozycje dźwięków wyleciały z symulatora. Opis jest w [EFEKTY.md](EFEKTY.md#presety-momentów-2026-10-28).
- **Sprawdzenie przy tarczy:** lista kroków jest w [#10](https://github.com/jgoliszewski/ITDarts/issues/10).
- **Strona Effects i konfigurator w aplikacji do przerobienia w całości** (prośba z 2026-10-28). Dzisiejsze zakładki Rules, Sounds, LEDs i Playback ([EFEKTY.md](EFEKTY.md#układ-strony)) nie pasują do mapy Momentów. Osobny grilling po rundzie z ledami. Na pewno w nim:
  - ~~grupowanie według Momentów i ich grup z mapy~~ (zrobione 2026-11-02: grupy Match, Darts, Visits, Leg end, Minigames i Board w Rules, Sounds, LEDs i pickerach, plan w `.scratch/fx-groups/PLAN.md`, opis w [EFEKTY.md](EFEKTY.md#układ-strony));
  - dźwięk i ledy Momentu w jednym wierszu;
  - miejsce na podgląd ringu z symulatora.

## Runda 1

Pytania niezależne od siebie, każde z rekomendacją. Najprościej odpowiadać numerami, np. „Q5: A, ale Ton 40 z B”.

❓ **Q1 - Nazwa: „akcja” czy co innego?** Issue mówi „akcja”, a [GLOSSARY.md](../GLOSSARY.md) ma „akcja” na liście Avoid przy Regule. Potrzebne jest słowo na chwilę w grze, na którą coś gra, szersze niż Reguła, bo obejmuje też Next player, Hit i Miss oraz stany.

➡️ **Moment** (w UI „Moment”). Reguła zostaje tym, czym jest: przypisaniem Wyzwalaczy do dźwięku i ledów. Każda Reguła bazowa to jeden Moment.

---

❓ **Q2 - Czy Next player, Hit i Miss mają zostać na sztywno?** Dziś są poza regułami, więc nie da się ich wyciszyć osobno, dać im ledów ani zmienić dźwięku, a ich głośność jest stałym ułamkiem.

➡️ Zrobić z nich Reguły bazowe z nowymi Wyzwalaczami („Next player”, „Hit”, „Miss”). Wtedy cała mapa jest w jednym miejscu, a przełącznik swoosha w Playback znika.

---

❓ **Q3 - Siła i charakter.** Czy skala S, M, L, XL i cztery charaktery (neutralny, dobry, zły, zabawny) wystarczą? Czy przypisania w tabeli się zgadzają? Wątpliwe miejsca:
- Bullseye jako M (dziś bliżej S);
- Set won jako XL obok 180;
- Madhouse jako zabawny L, a nie dobry;
- Clean 20s jako zabawny, a nie dobry.

➡️ Skala tak. Przypisania jak w tabeli; jedyna zmiana, którą bym rozważył, to Bull jako S+, czyli dłuższe S bez osobnego poziomu.

---

❓ **Q4 - Gdzie żyje mapa.** Opcje:
- **(a)** w kodzie: `BASE_RULES` dostaje siłę i charakter, a dokument opisuje zasady i odsyła do kodu;
- **(b)** w dokumencie, a kod przepisany ręcznie;
- **(c)** w `effects.json`.

➡️ **(a).** Lista jest już w kodzie. Test pilnuje, że każdy Moment ma siłę i charakter, a symulator i strona efektów czytają je z tego samego miejsca.

---

❓ **Q5 - Ledy w trakcie tury i kamery.** Ruch ledów trzyma tarczę w takeoucie. Nie wiemy, czy zmiana koloru całego ringu po lotce (bez ruchu) nie myli detekcji. Opcje:
- **(a)** jak dziś, wszystko wolno;
- **(b)** w trakcie tury tylko jednolity kolor bez ruchu (A), a ruch dopiero po trzeciej lotce i na koniec legu;
- **(c)** w trakcie tury żadnych ledów (C).

➡️ **(b)**, ale najpierw test na tarczy. Wystarczy pięć tur z Treble 20 w zestawie A. Jeśli kolor po lotce myli detekcję, przechodzimy na (c).

---

❓ **Q6 - Główny styl ledów.** Today, A, B, C albo mieszanka. Do obejrzenia w symulatorze, najlepiej sekwencje w każdym zestawie.

➡️ **A jako język całości:** pełny kolor, płynne przejścia, tęcza tylko dla XL. Do tego ewentualnie B dla dwóch–trzech momentów, w których ruch ma sens (Ton 40, Checkout, Set won). C zostawiłbym jako wynik Q5, gdyby kamery nie znosiły zmian koloru.

---

❓ **Q7 - Miękkość przejść.** W A–C wejście trwa 0,1–0,4 s, a wyjście 0,25–1,5 s, dłużej dla większych momentów. Suwak Fade to skaluje.

➡️ Fade ×1, czyli wejście szybkie (0,15 s, żeby było „od razu”), a powrót do tła wyraźnie wolniejszy (0,35 s w S, do 1 s w XL). Do oceny na żywo, bo na ledach przejścia wyglądają szybciej niż na ekranie.

---

❓ **Q8 - Znaczenie kolorów.** W LED labie ustaliliśmy: biel neutralnie, pomarańcz dobrze, tęcza największe, czerwień źle. Propozycja w A–C dokłada:
- zieleń: koniec legu i Bull;
- złoto: treble;
- fiolet: zabawne.

Więcej kolorów to więcej rozróżnień, ale trudniej je zapamiętać.

➡️ Dołożyć tylko zieleń jako „wygrany leg”, bo checkout na zielono jest czytelny dla każdego. Treble zostawić w pomarańczu, jak T20. Zabawne mogą być fioletowe, ale to najmniej ważne.

---

❓ **Q9 - Ograniczenie dźwięków w trakcie tury.** Czy Treble 15–19 mają grać w X01? To najczęstszy dźwięk, a razem z regułą tury i callerem daje cztery–pięć dźwięków na turę. Opcje:
- **(a)** jak dziś;
- **(b)** Treble 15–19 wyłączone domyślnie (reguły zostają, da się je włączyć), T20 i Bull grają;
- **(c)** bez dźwięku lotki w X01, tylko tura.

➡️ **(b).** T20 i Bull to momenty, na które ktoś czeka, a T15–T19 częściej są pudłem obok celu niż sukcesem.

---

❓ **Q10 - Drabinka bogactwa dźwięku.** Propozycja zasady:
- S: marimba bez dzwonka, krótko;
- M: bieg marimby i jeden dzwonek;
- L: akord „strum” i dzwonki;
- XL: do tego szum albo gong.

Zmiany, które z niej wynikają:
- Treble i Clean 20s tracą dzwonek i są krótsze;
- Ton dostaje mały dzwonek (dziś go nie ma);
- Set won dostaje coś więcej niż High finish, np. gong z Big Fish albo dłuższą kadencję.

➡️ Tak, z tymi czterema zmianami. Reszta dźwięków zostaje, jak jest.

---

❓ **Q11 - Jedna rodzina „źle”.** Bust, No score, Player out, Miss oraz milczące dziś Life lost i Attempt failed brzmią w trzech stylach.

➡️ Jeden motyw: marimba w dół i niski zjazd, z rozmiarem według siły:
- Miss: dwie nuty, bez zjazdu (jak dziś);
- No score: trzy nuty;
- Bust: trzy nuty i zjazd (jak dziś);
- Player out: molowo i dłuższy zjazd.

Life lost i Attempt failed dostają No score. Bust i No score przechodzą z tonu trójkątnego na marimbę.

---

❓ **Q12 - Nowe dźwięki.** Bez dźwięku są dziś Leg start, Sector closed, Became killer, Life lost i Attempt failed.

➡️ Żadnych nowych syntez. Life lost i Attempt failed dostają No score (Q11), a Sector closed dostaje Hit. Leg start i Became killer zostają ciche: przy Leg start mówi caller, a killera widać na ekranie.

---

❓ **Q13 - Układ ringu.** Gdzie fizycznie jest LED 0, w którą stronę liczą się ledy i czy połówki 0–48 i 48–100 idą w tę samą stronę? To wpływa na Fill, Run i każdy efekt „od dołu”.

➡️ Sprawdzić w pracy: zapalić LED 0 i LED 48 na czerwono (w aplikacji WLED albo jednym poleceniem `/json/state`) i ustawić to samo w symulatorze. Do tego czasu efekty kierunkowe są mniej ważne, bo A ich nie używa.

## Runda 2: ledy

Dźwięki są postanowione, a ledy i dźwięki wchodzą do aplikacji razem. Pytania zakładają odpowiedzi z rundy 1, zwłaszcza Q5 (ruch w czasie takeoutu blokuje takeout) i Q8 (kolory).

Dwa ringi zmieniają obraz. Kamery patrzą na tarczę, a tarczę oświetla tylko ring zewnętrzny. Ruch na ringu ściany może więc w ogóle nie obchodzić detekcji. Na tym stoi nowy zestaw **D · Split rings** w symulatorze.

❓ **R1 - Styl (dawne Q6).** Opcje:
- **A:** oba ringi płynnie zmieniają kolor;
- **D:** ring tarczy zmienia kolor jak w A, a ring ściany ma ruch w tym samym kolorze, trochę dłużej;
- **B:** ruch w dwóch odcieniach na obu ringach.

Problem z Q5 dotyczy efektów po trzeciej lotce: 180, Ton, Bust i checkout grają, gdy zaczyna się takeout, więc ruch na ringu tarczy przedłuża takeout.

➡️ **D**, jeśli test R2 pokaże, że ruch na ringu ściany nie trzyma takeoutu. W przeciwnym razie **A**: wtedy ruch zostaje tylko po pierwszej i drugiej lotce, jak mieniąca się tęcza na T20, i na koniec meczu.

---

❓ **R2 - Test przy tarczy** (jutro, razem z Q13). Trzy rzeczy do sprawdzenia, każda w kilku turach:
1. Czy płynna zmiana koloru ringu tarczy po trzeciej lotce (bez ruchu) przedłuża takeout albo myli detekcję?
2. Czy ruch na samym ringu ściany w czasie takeoutu trzyma takeout?
3. Czy czerwony i zielony kolor na tarczy psują rozpoznawanie lotek? Dziś grały tylko krótko, a w A i D trwają do 2,5 s.

Do tego test potrzebuje presetów, więc przygotuję je przed pójściem do tarczy.

➡️ Zgoda. Wyniki decydują o R1 i R3.

---

❓ **R3 - Jak długo ring tarczy może być kolorowy.** Po trzeciej lotce każda sekunda koloru na ringu tarczy może być sekundą dłuższego takeoutu. Ring ściany nie ma tego ograniczenia, jeśli R2 przejdzie.

➡️ Limity na ringu tarczy:
- S do 0,7 s;
- M do 1,6 s;
- L do 2,6 s;
- XL do 2,5 s, bo resztę gra ring ściany.

Ring ściany gra o pół sekundy do dwóch dłużej. Wyjątek to Match won: po meczu nic nie jest wykrywane, więc oba ringi świętują przez 6 s.

---

❓ **R4 - Jeden kolor zamiast „oddechów” na ringu tarczy.** W A i D niektóre momenty mają dwa lub trzy „oddechy” (Ton 40, High finish, Set won, Madhouse, White Horse, Player out). Na WLED to playlista kilku presetów, a każda zmiana presetu może zrestartować ruch na ringu ściany.

➡️ Ring tarczy ma jedną płynną zmianę koloru, a siłę mówi jej długość. „Oddechy” przechodzą na ring ściany (Pulse). Dzięki temu każdy Moment to jeden preset.

---

❓ **R5 - Silnik.** Opcje:
- **(a)** presety WLED: jeden preset na Moment, z dwoma segmentami o różnych efektach, a płynność daje `transition`;
- **(b)** klatki liczone przez serwer i wysyłane do WLED na żywo (DDP). Efekt byłby identyczny z symulatorem i zawsze zaczynałby się od początku, ale to dużo więcej kodu, a w trakcie efektu zależy od Wi-Fi.

➡️ **(a).** Symulator trzeba wtedy dopasować do efektów WLED, a nie odwrotnie. Flash, Fill, Run i tęcza już pasują, a Ripple, Burst i Dissolve sprawdzimy na ringu.

---

❓ **R6 - Kto tworzy presety i jakie mają numery.** Dziś numery leżą lokalnie w `data/led-lab-presets.json`, więc dom i praca mogą się rozjechać. Na kontrolerze są też stare presety: 2, 4–28, 36, 43 i 46–48.

➡️ Presety tworzy kod, z tej samej listy co symulator, jednym skryptem, z backupem `presets.json` przed zapisem.
- Numery są stałe, w kodzie, w zarezerwowanym zakresie, np. 100–149. Wtedy dom i praca mają te same numery.
- Skrypt usuwa jednorazowo wszystko spoza zakresu poza 1 (Gameon) i 3 (Bust). Bust i tak dostaje nowy preset.

---

❓ **R7 - Ledy jako część Momentu.** Dziś „Reset to default” nie rusza ledów, bo numer presetu zależał od kontrolera.

➡️ Przy stałych numerach (R6) ledy są w definicji Momentu w kodzie, obok dźwięku. „Reset to default” przywraca też ledy. Własny preset w regule dalej działa jako nadpisanie.

---

❓ **R8 - LED lab i symulator.**

➡️ LED lab znika, bo jego rolę przejmują symulator i skrypt z R6. Symulator zostaje narzędziem deweloperskim (`npm run led-sim`). O tym, czy wejdzie na stronę Effects, zdecyduje grilling przeróbki tej strony.

---

❓ **R9 - Przypisania.** Propozycja to tabela zestawu D w symulatorze (zakładka „Moments and LEDs”, przycisk D przy każdym Momencie), poprawiona o R3 i R4. Szczegóły jak czasy i jasność ocenimy na żywo (Q7).

➡️ Przyjąć D jako punkt startu. Poprawki robimy po teście przy tarczy, a nie teraz na ekranie.

---

❓ **R10 - Stany bazowe.** Dziś:
- lobby i mecz: Gameon, statyczna ciepła biel;
- takeout: bez stanu;
- tarcza offline: czerwony Pulse.

➡️ Bez zmian. W lobby kusi ruch na ringu ściany, ale Board Manager działa też w lobby i bull-offie, więc lepiej nie ryzykować.

## Następne rundy

- **Biblioteka dźwięków i efektów w UI:** część przeróbki strony Effects z sekcji [Do zrobienia](#do-zrobienia).
