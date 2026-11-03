# Opona (surround) tarczy

Grafika opony wokół tarczy: napisy ITBoom i „we can do IT” na łukach, w tle cyfry binarne w grupach po 4, wygaszane przy napisach.

- `opona.svg`: plik do druku, wektor. Pierścień ma promień 500 jednostek, a otwór na tarczę 318, czyli tarcza 45 cm daje oponę ok. 71 cm.
- `opona.png`: podgląd 1000×1000.
- `makieta.png`, `makieta.html`: opona z tarczą na ścianie z panelami.
- `generate.cjs`: generator obu plików, `node generate.cjs`. Układ cyfr jest losowany z ustalonym ziarnem, więc wynik jest zawsze ten sam.

PNG robi się zrzutem z Edge w trybie headless:

```
msedge --headless=new --disable-gpu --hide-scrollbars --window-size=1000,1000 --screenshot=opona.png file:///<ścieżka>/opona.svg
```

Przed drukiem trzeba od drukarni: średnice opony i otworu, format pliku, spad, kolor pomarańczu (CMYK lub Pantone).
