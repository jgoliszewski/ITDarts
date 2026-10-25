import { useEffect, useState } from 'react';
import type { H2HResponse, PlayerListItem, PlayerStatsResponse, StatsWindow } from '../../../server/protocol.ts';
import { Icon, Logo } from '../components/ui.tsx';
import { fmtAvg, fmtNum, shortDate, store } from '../util.ts';

const ME_KEY = 'itdarts.me';
const WINDOW_KEY = 'itdarts.statsWindow';
const TIME: [StatsWindow, string][] = [['7d', '7D'], ['30d', '30D'], ['90d', '3M'], ['365d', '1Y'], ['all', 'All']];
const LEGS: [StatsWindow, string][] = [['l10', 'Last 10 legs'], ['l100', 'Last 100 legs']];
let autoOpened = false;

function useJson<T>(url: string | null): { data: T | null; error: boolean } {
  const [state, setState] = useState<{ data: T | null; error: boolean }>({ data: null, error: false });
  useEffect(() => {
    if (!url) return;
    let alive = true;
    setState(s => ({ data: s.data, error: false }));
    fetch(url)
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(data => alive && setState({ data, error: false }))
      .catch(() => alive && setState({ data: null, error: true }));
    return () => { alive = false; };
  }, [url]);
  return state;
}

function go(path: string) {
  history.pushState(null, '', path);
  dispatchEvent(new PopStateEvent('popstate'));
}

function WindowPicker({ value, onChange }: { value: StatsWindow; onChange: (w: StatsWindow) => void }) {
  return (
    <div className="windows">
      <div className="seg">{TIME.map(([w, l]) => <button key={w} aria-pressed={value === w} onClick={() => onChange(w)}>{l}</button>)}</div>
      <div className="seg">{LEGS.map(([w, l]) => <button key={w} aria-pressed={value === w} onClick={() => onChange(w)}>{l}</button>)}</div>
    </div>
  );
}

function Stat({ l, v, s, hl }: { l: string; v: string; s?: string; hl?: boolean }) {
  return <div className={`stat ${hl ? 'hl' : ''}`}><span className="l">{l}</span><span className="num">{v}</span>{s && <span className="s">{s}</span>}</div>;
}

function H2H({ a, b, w }: { a: number; b: number; w: StatsWindow }) {
  const { data } = useJson<H2HResponse>(`/api/stats/h2h?a=${a}&b=${b}&window=${w}`);
  if (!data) return null;
  return (
    <div className="box">
      <div className="caps" style={{ fontSize: 13 }}>Head to head{w.startsWith('l') ? ' · last meetings' : ''}</div>
      <div className="h2h">
        <div><b>{data.players[0].name}</b><div className="num" style={{ color: 'var(--accent)' }}>{data.wins[0]}</div><span className="muted">avg {fmtAvg(data.avg[0])}</span></div>
        <span className="muted">{data.played} {data.played === 1 ? 'match' : 'matches'}</span>
        <div><b>{data.players[1].name}</b><div className="num">{data.wins[1]}</div><span className="muted">avg {fmtAvg(data.avg[1])}</span></div>
      </div>
    </div>
  );
}

function Profile({ id, w, setW }: { id: number; w: StatsWindow; setW: (w: StatsWindow) => void }) {
  const { data, error } = useJson<PlayerStatsResponse>(`/api/stats/players/${id}?window=${w}`);
  const [me, setMe] = useState(store.get(ME_KEY));
  const [vs, setVs] = useState<number | null>(null);
  if (error) return <p className="muted">This player does not exist.</p>;
  if (!data) return <p className="muted">Loading…</p>;
  const x = data.x01;
  const isMe = me === String(id);
  const toggleMe = () => {
    const v = isMe ? null : String(id);
    store.set(ME_KEY, v);
    setMe(v);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="option-row" style={{ flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>{data.player.name}</h2>
        <button className={`chip ${isMe ? 'on' : ''}`} onClick={toggleMe}>{isMe ? 'This is me ✓' : 'This is me'}</button>
      </div>
      <WindowPicker value={w} onChange={setW} />
      {x.darts === 0 && data.results.played === 0 ? (
        <p className="muted" style={{ margin: 0 }}>No darts in this window.</p>
      ) : (
        <>
          <div className="stat-grid">
            <Stat l="Average" v={fmtAvg(x.avg)} hl />
            <Stat l="First 9" v={fmtAvg(x.first9)} />
            <Stat l="Until 170" v={fmtAvg(x.until170)} />
            <Stat l="Checkout %" v={x.checkoutPct === null ? '–' : `${x.checkoutPct}`} s={`${x.checkoutHits} / ${x.checkoutAttempts} darts`} />
            <Stat l="Highest checkout" v={fmtNum(x.highestCheckout)} />
            <Stat l="Best leg" v={fmtNum(x.bestLeg)} s="darts" />
            <Stat l="100+" v={String(x.c100)} />
            <Stat l="140+" v={String(x.c140)} />
            <Stat l="180" v={String(x.c180)} />
            <Stat l="Legs" v={`${x.legsWon}/${x.legs}`} s="won / played" />
            <Stat l="Winrate" v={data.results.winrate === null ? '–' : `${data.results.winrate}%`} s={`${data.results.won} of ${data.results.played} matches`} />
            <Stat l="Darts" v={String(x.darts)} />
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Winrate counts finished matches between registered players only. Matches with guests count for averages, not for wins.</p>
        </>
      )}
      {data.opponents.length > 0 && (
        <div className="section">
          <div className="caps" style={{ fontSize: 13 }}>Opponents</div>
          <div className="chip-row">
            {data.opponents.map(o => (
              <button key={o.id} className={`chip ${vs === o.id ? 'on' : ''}`} onClick={() => setVs(vs === o.id ? null : o.id)}>
                {o.name} · {o.won}–{o.played - o.won}
              </button>
            ))}
          </div>
          {vs !== null && <H2H a={id} b={vs} w={w} />}
        </div>
      )}
      {data.recent.length > 0 && (
        <div className="section">
          <div className="caps" style={{ fontSize: 13 }}>Recent matches</div>
          {data.recent.map(r => (
            <div key={r.id} className="match-row">
              <span className={`res ${r.result}`}>{r.result === 'saved' ? 'ENDED' : r.result.toUpperCase()}</span>
              <div className="grow">vs {r.opponents}<small>{r.description.replace(/^X01 · /, '')} · {shortDate(r.endedAt)}</small></div>
              <span className="num" style={{ fontSize: 22 }}>{r.score}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function StatsPage({ path }: { path: string }) {
  const id = Number(path.split('/')[2]) || null;
  const [w, setWState] = useState<StatsWindow>((store.get(WINDOW_KEY) as StatsWindow) || '30d');
  const setW = (v: StatsWindow) => { setWState(v); store.set(WINDOW_KEY, v); };
  const { data: list } = useJson<PlayerListItem[]>('/api/stats/players');

  // Phones remember “this is me” and open straight on that profile, once per visit.
  useEffect(() => {
    if (autoOpened || !list) return;
    autoOpened = true;
    const me = store.get(ME_KEY);
    if (path === '/stats' && me && list.some(p => String(p.id) === me)) go(`/stats/${me}`);
  }, [path, list]);

  return (
    <div className="stats-page">
      <header className="stats-head">
        <button className="icon-btn" aria-label="Back" onClick={() => go(id ? '/stats' : '/')}>{Icon.back(22)}</button>
        <h1>{id ? 'Player' : 'Stats'}</h1>
        <Logo />
      </header>
      {id ? (
        <Profile key={id} id={id} w={w} setW={setW} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!list ? <p className="muted">Loading…</p> : list.length === 0 ? <p className="muted">No players yet. Create them on the pilot under Players.</p> : (
            <>
              <div className="caps" style={{ fontSize: 13 }}>Players · average last 30 days</div>
              <div className="player-cards">
                {list.map(p => (
                  <button key={p.id} className="player-card" onClick={() => go(`/stats/${p.id}`)}>
                    <b>{p.name}</b>
                    <span className="num" style={{ color: 'var(--text)' }}>{fmtAvg(p.avg)}</span>
                    <span>{p.matches} {p.matches === 1 ? 'match' : 'matches'}{p.lastPlayed ? ` · last ${shortDate(p.lastPlayed)}` : ''}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
