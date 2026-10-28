// Fake WLED controller for development without the real LEDs.
// Run: npm run fake-wled, set the address to localhost:3190 on /effects, open http://localhost:3190 to watch.
import Fastify from 'fastify';

const PORT = Number(process.argv[2] ?? 3190);
const app = Fastify();

const PRESETS: Record<number, { n: string; color: string }> = {
  1: { n: 'Lobby glow', color: '#F58224' },
  2: { n: 'Match white', color: '#E8E8E8' },
  3: { n: 'Takeout amber', color: '#F5B83D' },
  4: { n: 'Offline red', color: '#B8322F' },
  10: { n: '180 rainbow', color: '#A050F0' },
  11: { n: 'Checkout green', color: '#1F8A52' },
  12: { n: 'Bust flash', color: '#FF3030' },
};

let on = true;
let preset: number | null = null;
let until: number | null = null;
let restore: number | null = null;
const log: string[] = [];

function note(text: string) {
  log.unshift(`${new Date().toLocaleTimeString()} ${text}`);
  log.length = Math.min(log.length, 30);
  console.log(`[wled] ${text}`);
}

// A playlist ends by itself: apply its "end" preset (255 = what was on before).
function tick() {
  if (until !== null && Date.now() >= until) {
    until = null;
    preset = restore;
    note(`playlist ended → ${preset === null ? 'nothing' : PRESETS[preset]?.n ?? preset}`);
  }
}
setInterval(tick, 50);

app.get('/json/info', async () => ({ name: 'Fake WLED', ver: '0.15.0-fake' }));
// Like the real file: name plus segments with [r, g, b] colours. The playlist (20) has no colour.
const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
app.get('/presets.json', async () => ({
  0: {},
  ...Object.fromEntries(Object.entries(PRESETS).map(([id, p]) => [id, { n: p.n, on: true, seg: [{ id: 0, col: [rgb(p.color), [0, 0, 0], [0, 0, 0]], fx: 0 }] }])),
  20: { n: 'Party playlist', playlist: { ps: [10, 11], dur: [50, 50] } },
}));
// Like the real /upload with /presets.json (npm run leds:upload): the presets are replaced by the file's.
app.addContentTypeParser('multipart/form-data', { parseAs: 'string' }, (_req, body, done) => done(null, body));
app.post<{ Body: string }>('/upload', async req => {
  const file = JSON.parse(req.body.slice(req.body.indexOf('{'), req.body.lastIndexOf('}') + 1)) as Record<string, { n?: string; seg?: { col?: number[][] }[] }>;
  for (const id of Object.keys(PRESETS)) delete PRESETS[Number(id)];
  for (const [id, p] of Object.entries(file)) {
    const c = p.seg?.[0]?.col?.[0];
    if (Number(id) > 0) PRESETS[Number(id)] = { n: p.n ?? `Preset ${id}`, color: c ? `#${c.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('')}` : '#888888' };
  }
  note(`presets uploaded: ${Object.keys(PRESETS).length}`);
  return 'OK';
});
app.post<{ Body: { on?: boolean; ps?: number; playlist?: { ps: number[]; dur: number[]; end?: number } } }>('/json/state', async req => {
  const b = req.body ?? {};
  if (typeof b.on === 'boolean') on = b.on;
  if (b.playlist) {
    const before = preset;
    preset = b.playlist.ps[0];
    until = Date.now() + (b.playlist.dur[0] ?? 10) * 100;
    restore = b.playlist.end === undefined || b.playlist.end === 255 ? before : b.playlist.end;
    note(`effect ${PRESETS[preset]?.n ?? preset} for ${(b.playlist.dur[0] ?? 10) / 10} s, then ${restore === null ? 'nothing' : PRESETS[restore]?.n ?? restore}`);
  } else if (typeof b.ps === 'number') {
    preset = b.ps;
    until = null;
    note(`preset ${PRESETS[preset]?.n ?? preset}`);
  } else if (b.on === false) note('off');
  return { success: true };
});
app.get('/state', async () => ({ on, preset, name: preset === null ? null : PRESETS[preset]?.n ?? `Preset ${preset}`, color: preset === null ? '#000' : PRESETS[preset]?.color ?? '#888', log }));

app.get('/', async (_req, reply) => reply.type('text/html').send(`<!doctype html><meta name=viewport content="width=device-width">
<title>Fake WLED</title>
<body style="font:16px system-ui;background:#111;color:#eee;padding:16px;margin:0">
<h2 style="margin:0 0 12px">Fake WLED :${PORT}</h2>
<div id=strip style="height:80px;border-radius:16px;transition:background .15s"></div>
<p id=name style="font-weight:700"></p>
<pre id=log style="color:#aaa;font-size:13px"></pre>
<script>
setInterval(async () => {
  const s = await fetch('/state').then(r => r.json());
  document.getElementById('strip').style.background = s.on ? s.color : '#000';
  document.getElementById('name').textContent = s.on ? (s.name ?? 'No preset') : 'Off';
  document.getElementById('log').textContent = s.log.join('\\n');
}, 150);
</script>`));

await app.listen({ port: PORT, host: '0.0.0.0' });
console.log(`Fake WLED on http://localhost:${PORT}/`);
