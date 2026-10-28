# ITDarts: hosting w internecie (plan)

Postanowienia z grillingu z 2026-10-28. Nic z tego nie jest jeszcze zaimplementowane. To plan na moment, w którym zdecydujemy się zhostować aplikację. Pojęcia są w [GLOSSARY.md](../GLOSSARY.md).

## Cel

- Gracze sprawdzają swoje statystyki spoza biura.
- Przy tarczy nie trzeba stawiać serwera, wystarczy kiosk.

Zakres to jedno biuro i jedna tarcza. Kilka biur na jednej bazie i mecze między tarczami w różnych miejscach są poza zakresem. Projekt nie powinien ich blokować, ale ich nie planujemy.

## Dwa tryby

- **Tryb lokalny** zostaje bez zmian: laptop z serwerem w LAN i `npm run dev:fake` do developmentu. Działa bez internetu.
- **Tryb hosted** to ta sama baza kodu uruchomiona na serwerze w internecie.

O trybie decyduje `config.json`. Bazy obu trybów są osobne i niczego nie synchronizujemy.

## Podział ról

Board Manager i WLED mają prywatne adresy w LAN biura, więc serwer w internecie do nich nie sięgnie. Rolę przekaźnika przejmuje kiosk, bo przeglądarka i tak stoi w LAN.

| Kto | Co robi |
|---|---|
| Serwer (hosted) | Zasady gier, log zdarzeń, SQLite, `/stats`, `/effects`, Players, tokeny Pilota |
| Kiosk (Edge w biurze) | Ekran wyników; łączy się z Board Managerem (`ws://<board>/api/events` po rzuty, HTTP po takeout, reset i kalibrację); woła WLED (`fetch` na `/json/state`); gra dźwięki i callera jak dziś |
| Pilot (telefon) | Bez zmian, tylko łączy się z adresem hosted |

Kiosk przekazuje rzuty i zdarzenia tarczy do serwera przez websocket, który już ma. W drugą stronę serwer wysyła polecenia dla tarczy i efekty WLED. Dzisiaj robią to `server/board.ts` i `server/effects/wled.ts`, więc w trybie hosted ich wywołania przenoszą się do kiosku za wspólnym interfejsem.

Bez kiosku nie ma ekranu, więc nie gramy, i nic przez to nie tracimy.

### Przeglądarka a sieć lokalna

Strona HTTPS z internetu, która woła `http://192.168.x.x`, trafia w Edge na dwie blokady:

- **Local Network Access** (Edge od 143) pyta o zgodę na dostęp do LAN. W kiosku nie ma komu kliknąć, więc zgodę daje z góry polityka `LocalNetworkAccessAllowedForUrls` z originem naszej strony.
- **Mixed content.** Po zgodzie LNA `fetch` do prywatnego IP jest zwolniony z blokady, więc WLED działa. WebSocket nie jest jeszcze objęty LNA, więc `ws://` do Board Managera odblokowuje dopiero polityka `InsecureContentAllowedForUrls`.

Obie polityki ustawia `start.bat` w rejestrze `HKLM\SOFTWARE\Policies\Microsoft\Edge`. Wymaga to jednorazowego uruchomienia jako admin. Działanie sprawdzamy w `edge://policy`.

WLED odpowiada `Access-Control-Allow-Origin: *`, więc CORS nie przeszkadza. Tools for Autodarts woła go tak samo: `fetch` z `mode:"no-cors"` i ciałem `text/plain`, bez preflightu.

Źródła: [Edge Local Network Access](https://learn.microsoft.com/en-us/deployedge/ms-edge-local-network-access), [LocalNetworkAccessAllowedForUrls](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-policies/localnetworkaccessallowedforurls), [InsecureContentAllowedForUrls](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-policies/insecurecontentallowedforurls), [WLED CORS](https://github.com/wled/WLED/blob/main/wled00/wled_server.cpp), [Tools for Autodarts](https://github.com/creazy231/tools-for-autodarts/blob/HEAD/utils/wled-request.ts).

### Odrzucone

- **Chmura Autodarts** jako źródło rzutów:
  - oficjalnego API nie ma, a nieoficjalne już było przykręcane;
  - wymaga e-maila i hasła konta, przy starszym kliencie bez 2FA;
  - [regulamin](https://autodarts.com/terms) (§3.2, §6.1) zabrania zautomatyzowanego dostępu oprogramowaniem firm trzecich bez pisemnej zgody, a §6.2 grozi blokadą konta;
  - takeoutu i kalibracji przez chmurę i tak nie znaleźliśmy.
- **VPN albo tunel do LAN biura**: działa, ale wymaga instalacji i utrzymania czegoś w sieci biura.
- **Wystawienie Board Managera do internetu**: jego API nie ma uwierzytelnienia.
- **Plan B**, jeśli `ws://` z polityką nie przejdzie: mały agent Node na laptopie przy tarczy. Czyta lokalne API i łączy się z serwerem połączeniem wychodzącym.

## Dostęp

Bez kont i bez logowania, bo dane nie są wrażliwe.

- **Odczyt:** `/stats` i historia meczów są publiczne, tylko do odczytu.
- **Zmiany** (mecz, Pilot, `/effects`, Players, pobieranie zgłoszeń błędów) wymagają klucza kiosku albo tokenu Pilota.
- **Klucz kiosku** leży w lokalnym `config.json` laptopa, nie w repo. `start.bat` otwiera adres z tym kluczem. Serwer trzyma jeden aktywny kiosk naraz.
- **Token Pilota** jest krótkotrwały i siedzi w linku z kodu QR na Ekranie wyników. Kto stoi przy tarczy, ten steruje i może wejść na `/effects`. Z domu Pilota przejąć się nie da.
- **Ekran wyników na żywo** z zewnątrz na razie nie istnieje, widzi go tylko kiosk.

Konta osobowe dokładamy dopiero wtedy, gdy pojawi się „moje statystyki” albo potrzeba wiedzieć, kto co zmienił.

## Dane

- **Baza:** obecną bazę SQLite z laptopa kopiujemy na serwer raz. Mecze rozegrane później w trybie lokalnym, np. bez internetu, zostają w lokalnej bazie.
- **Efekty:** w trybie hosted żyją na dysku serwera obok bazy, a `/effects` zapisuje tam od razu. Repo `effects/` służy tylko jako stan startowy przy pierwszym uruchomieniu. Eksport do repo („Download effects”) dokładamy, gdy będzie potrzebny.
- **Zgłoszenia błędów** lądują w `data/bugs` na serwerze. Admin pobiera je endpointem i wrzuca do `bugs/` w repo przed naprawą.
- **Backup** zostaje jak dziś na tym samym dysku. Kopię poza serwerem dobieramy razem z dostawcą.

## Infrastruktura

- **Obraz Docker** i `docker-compose.yml` w repo: aplikacja z wolumenem na `data/` plus Caddy dla HTTPS.
- **Build:** GitHub Actions buduje obraz przy pushu na `main` i wypycha go do GHCR.
- **Aktualizacja** ręcznie na serwerze: `docker compose pull && docker compose up -d`. Automat dokładamy, gdy to zacznie przeszkadzać.
- **Brak internetu w biurze:** tryb hosted nie działa. Ręcznie przełączamy `start.bat` na tryb lokalny, bez automatycznego fallbacku.

### Dostawca (otwarte)

Wymagania:

- darmowy plan;
- Docker;
- trwały dysk dla SQLite;
- HTTPS, bo Edge pozwala na Local Network Access tylko ze strony w secure context.

Platformy z sieciowym albo ulotnym dyskiem i usypianiem aplikacji (App Service, free tier Render czy Koyeb) odpadają.

Kandydaci do sprawdzenia przy wdrożeniu, bo warunki się zmieniają:

- **Oracle Cloud Always Free:** VM ARM z dyskiem.
- **Google Cloud e2-micro Always Free:** tylko regiony USA, więc opóźnienie około 120 ms. Do rzutów wystarczy.
- **Azure B1s:** darmowy tylko przez 12 miesięcy na nowym koncie.

HTTPS bez kupowania domeny: Caddy z Let's Encrypt na darmowej subdomenie (DuckDNS, sslip.io).

## Kolejność prac

1. **Prototyp:** strona HTTPS w kiosku Edge z obiema politykami łączy się `ws://` z prawdziwym Board Managerem i `fetch` z WLED. Jeśli WebSocket nie przejdzie, wchodzi plan B (agent Node).
2. Szew w adapterze tarczy i WLED: serwer albo kiosk, wybór w `config.json`.
3. Klucz kiosku, tokeny Pilota w QR i blokada zmian bez nich.
4. Efekty i zgłoszenia błędów na dysku serwera.
5. Dockerfile, compose z Caddy, workflow do GHCR.
6. Wybór dostawcy, przeniesienie bazy, `start.bat` w trybie hosted.
