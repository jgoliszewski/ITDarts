# Lokalny serwer jako jedyne źródło prawdy o meczu

ITDarts to lokalny serwer na laptopie przy tarczy. Tylko on łączy się z Board Managerem i tylko on trzyma stan meczu (zapisywany w SQLite po każdej zmianie, by przetrwał restart, patrz [ADR 0004](0004-log-zdarzen-i-sqlite.md)). Przeglądarki to widoki: Ekran wyników albo Pilot (dokładnie jeden, przejmowany przyciskiem). Wysyłają komendy i dostają gotowy stan. Wybraliśmy to zamiast statycznego `index.html` (nie da się zsynchronizować dwóch ekranów) i zamiast Electrona (instalator i aktualizacje bez żadnego zysku).

## Consequences

- Wyłączony laptop oznacza brak gry. Akceptujemy to.
- Logika gier działa wyłącznie na serwerze.
- Dostęp z LAN jest bez logowania, bo biuro to zaufana sieć.
