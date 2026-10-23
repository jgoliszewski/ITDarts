# Stack wybrany pod pisanie przez AI

Aplikację pisze jedna osoba z pomocą AI, nie zespół. Dlatego wybór stacku kieruje się tym, co AI zna najlepiej i co najmocniej łapie jego błędy, a nie znajomością w zespole. Wybraliśmy TypeScript, React i Vite (SPA) na froncie oraz Node, Fastify, `@fastify/websocket` i `tsx` na serwerze. Całość żyje w jednym repo z jednym `package.json`. Odrzuciliśmy Next i SvelteKit, bo ich model serwera gryzie się z długo żyjącym połączeniem websocket do tarczy. Odrzuciliśmy też vanilla JS, bo przy animacjach i wielu widokach szybko się rozrasta.
