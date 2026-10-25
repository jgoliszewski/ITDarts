# Mecz jako log zdarzeń, historia w SQLite

Bieżący mecz to lista zdarzeń, do której tylko dopisujemy: start z ustawieniami, rzut, rzut dopisany ręcznie, poprawka, undo, takeout, koniec legu. Wynik, kolejkę i statystyki wylicza czysty silnik gry, odtwarzając ten log. Po zakończeniu meczu log jest kompaktowany: w historii zostają tylko obowiązujące lotki (bez oryginalnej detekcji, poprawek i cofniętych rzutów) z pełnym kontekstem meczu. Wszystko, łącznie z bieżącym meczem, trzymamy w jednym pliku SQLite na laptopie zamiast w pliku JSON. Odrzuciliśmy zapis gotowego stanu meczu, bo poprawki i undo trzeba by wtedy obsługiwać w dwóch miejscach, a nowych statystyk nie dałoby się policzyć wstecz.

## Consequences

- Każdą nową statystykę liczymy wstecz dla wszystkich zapisanych meczów. Dotyczy to też rankingu ([#6](https://github.com/jgoliszewski/ITDarts/issues/6)).
- Nie da się zmierzyć, jak często Board Manager się myli. Świadomie z tego rezygnujemy.
- Silnik gry nie robi I/O: dostaje zdarzenia i zwraca stan. To też szew pod ewentualną wersję hostowaną.
- Statystyki liczymy na żądanie zapytaniami SQL, bez cache. Przy jednej tarczy to tysiące wierszy, nie miliony.
- Migracje schematu to skrypty numerowane wersją.
