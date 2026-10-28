import { useEffect, useState } from 'react';
import type { GameId } from '../../../games/index.ts';
import { GAMES, GAME_IDS, isGameId } from '../../../games/index.ts';
import type { GameStatsResponse, H2HResponse, HeatResponse, PlayerListItem, PlayerStatsResponse, RecordTable, StatsWindow } from '../../../server/protocol.ts';
import type { Row } from '../components/Compare.tsx';
import { CompareTable, fmtKm, gameRows, gameStats, playerColor, x01Rows } from '../components/Compare.tsx';
import { Heatmap } from '../components/Heatmap.tsx';
import { Dropdown, Icon, Logo } from '../components/ui.tsx';
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
            <Stat l="60+" v={String(x.c60)} />
            <Stat l="80+" v={String(x.c80)} />
            <Stat l="100+" v={String(x.c100)} />
            <Stat l="Legs" v={`${x.legsWon}/${x.legs}`} s="won / played" />
            <Stat l="Winrate" v={data.results.winrate === null ? '–' : `${data.results.winrate}%`} s={`${data.results.won} of ${data.results.played} matches`} />
            <Stat l="Darts" v={String(x.darts)} />
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Winrate counts finished matches between registered players only. Matches with guests count for averages, not for wins.</p>
        </>
      )}
      <PlayerHeat ids={[id]} game="x01" w={w} />
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
              <span className={`res ${r.result === 'played' ? 'saved' : r.result}`}>{r.result === 'saved' ? 'ENDED' : r.result.toUpperCase()}</span>
              <div className="grow">vs {r.opponents}<small>{r.description.replace(/^X01 · /, '')} · {shortDate(r.endedAt)}</small></div>
              <span className="num" style={{ fontSize: 22 }}>{r.score}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const GAME_KEY = 'itdarts.statsGame';
const pct = (a: number | undefined, b: number | undefined) => (b ? `${Math.round(((a ?? 0) / b) * 1000) / 10}%` : '–');

function GameProfile({ id, game, w, setW }: { id: number; game: GameId; w: StatsWindow; setW: (w: StatsWindow) => void }) {
  const { data, error } = useJson<GameStatsResponse>(`/api/stats/players/${id}?game=${game}&window=${w}`);
  if (error) return <p className="muted">This player does not exist.</p>;
  if (!data) return <p className="muted">Loading…</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>{data.player.name}</h2>
      <WindowPicker value={w} onChange={setW} />
      {data.played === 0 ? <p className="muted" style={{ margin: 0 }}>No {GAMES[game].name} in this window.</p> : (
        <div className="stat-grid">
          {gameStats(game, data.totals).map(([l, v, sub], i) => <Stat key={l} l={l} v={v} s={sub} hl={i === 0} />)}
          <Stat l="Played" v={String(data.played)} />
          <Stat l="Won" v={String(data.won)} s={data.played ? pct(data.won, data.played) : undefined} />
        </div>
      )}
      <PlayerHeat ids={[id]} game={game} w={w} />
      {data.bests.length > 0 && (
        <div className="section">
          <div className="caps" style={{ fontSize: 13 }}>Personal bests · all time</div>
          {data.bests.map(b => (
            <div key={b.label} className="match-row"><div className="grow">{b.label}</div><span className="num" style={{ fontSize: 22 }}>{b.value}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Heatmap of one or more players in a game and window, with the distance walked under a single player's board. */
function PlayerHeat({ ids, game, w }: { ids: number[]; game: GameId; w: StatsWindow }) {
  const { data } = useJson<HeatResponse>(`/api/stats/heat?ids=${ids.join(',')}&game=${game}&window=${w}`);
  if (!data || data.length === 0 || data.every(p => p.heat.visits === 0)) return null;
  return (
    <div className="section">
      <div className="caps" style={{ fontSize: 13 }}>Heatmap</div>
      <Heatmap players={data.map((p, i) => ({ name: p.player.name, color: playerColor(i), heat: p.heat }))} />
      {data.length === 1 && <div className="stat-grid"><Stat l="Distance walked" v={fmtKm(data[0].distance)} /></div>}
    </div>
  );
}

const COMPARE_KEY = 'itdarts.compare';

/** Stats of two players side by side, rows as in the profile of the game (docs/STATYSTYKI.md, Prezentacja). */
function CompareData({ ids, game, w }: { ids: number[]; game: GameId; w: StatsWindow }) {
  const [data, setData] = useState<{ stats: (PlayerStatsResponse | GameStatsResponse)[]; heat: HeatResponse } | null>(null);
  const key = ids.join(',');
  useEffect(() => {
    let alive = true;
    const json = (url: string) => fetch(url).then(r => (r.ok ? r.json() : Promise.reject(r.status)));
    Promise.all([
      Promise.all(key.split(',').map(id => json(`/api/stats/players/${id}?window=${w}${game === 'x01' ? '' : `&game=${game}`}`))),
      json(`/api/stats/heat?ids=${key}&game=${game}&window=${w}`),
    ]).then(([stats, heat]) => alive && setData({ stats, heat })).catch(() => alive && setData(null));
    return () => { alive = false; };
  }, [key, game, w]);
  if (!data) return <p className="muted">Loading…</p>;
  const names = data.stats.map(d => d.player.name);
  const rows: Row[] = game === 'x01'
    ? (() => {
      const ps = data.stats as PlayerStatsResponse[];
      return [
        ...x01Rows(ps.map(p => p.x01)),
        { label: 'Winrate', values: ps.map(p => (p.results.winrate === null ? '–' : `${p.results.winrate}%`)), nums: ps.map(p => p.results.winrate), better: 'higher' as const },
      ];
    })()
    : (() => {
      const gs = data.stats as GameStatsResponse[];
      return [
        ...gameRows(game, gs.map(g => g.totals)),
        { label: 'Played', values: gs.map(g => String(g.played)) },
        { label: 'Won', values: gs.map(g => String(g.won)), nums: gs.map(g => g.won), better: 'higher' as const },
      ];
    })();
  rows.push({ label: 'Distance walked', values: data.heat.map(h => fmtKm(h.distance)) });
  return (
    <>
      <CompareTable names={names} rows={rows} />
      {data.heat.some(h => h.heat.visits > 0) && (
        <Heatmap players={data.heat.map((p, i) => ({ name: p.player.name, color: playerColor(i), heat: p.heat }))} />
      )}
    </>
  );
}

function ComparePage() {
  const { w, setW, game, setGame } = useStatsPrefs();
  const { data: list } = useJson<PlayerListItem[]>('/api/stats/players');
  const [ids, setIdsState] = useState<number[]>(() => (store.get(COMPARE_KEY) ?? '').split(',').map(Number).filter(n => n > 0).slice(0, 2));
  const setIds = (v: number[]) => { setIdsState(v); store.set(COMPARE_KEY, v.join(',')); };
  // Always two: the remembered pair, topped up with the first players on the list.
  const pair = list ? [...ids.filter(id => list.some(p => p.id === id)), ...list.map(p => p.id).filter(id => !ids.includes(id))].slice(0, 2) : [];
  const pick = (side: number, id: number) => setIds(side ? [pair[0], id] : [id, pair[1]]);
  const picker = (side: number) => (
    <Dropdown value={pair[side]} color={playerColor(side)} onChange={id => pick(side, id)}
      options={list!.filter(p => p.id !== pair[1 - side]).map(p => ({ value: p.id, label: p.name }))} />
  );
  return (
    <>
      <GamePicker game={game} setGame={setGame} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <WindowPicker value={w} onChange={setW} />
        {!list ? <p className="muted">Loading…</p> : pair.length < 2 ? <p className="muted" style={{ margin: 0 }}>Comparing needs two players.</p> : (
          <>
            <div className="heat-picks compare-picks">{picker(0)}<span className="vs">VS</span>{picker(1)}</div>
            <CompareData ids={pair} game={game} w={w} />
          </>
        )}
      </div>
    </>
  );
}

function Records({ game }: { game: GameId }) {
  const { data } = useJson<RecordTable[]>(`/api/stats/records?game=${game}`);
  if (!GAMES[game].record) return null;
  if (!data) return <p className="muted">Loading…</p>;
  if (data.length === 0) return <p className="muted">No records yet.</p>;
  return (
    <>
      {data.map(t => (
        <div key={t.key} className="section">
          <div className="caps" style={{ fontSize: 13 }}>Top 10 · {t.label}</div>
          <div className="record-table">
            {t.rows.map((r, i) => (
              <div key={i} className="row">
                <span className="muted">{i + 1}</span>
                <b style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.who}</b>
                <span className="muted" style={{ fontSize: 13 }}>{shortDate(r.at)}</span>
                <span className="num">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function useStatsPrefs() {
  const [w, setWState] = useState<StatsWindow>((store.get(WINDOW_KEY) as StatsWindow) || '30d');
  const setW = (v: StatsWindow) => { setWState(v); store.set(WINDOW_KEY, v); };
  const [game, setGameState] = useState<GameId>(() => (isGameId(store.get(GAME_KEY)) ? (store.get(GAME_KEY) as GameId) : 'x01'));
  const setGame = (g: GameId) => { setGameState(g); store.set(GAME_KEY, g); };
  return { w, setW, game, setGame };
}

function GamePicker({ game, setGame }: { game: GameId; setGame: (g: GameId) => void }) {
  return (
    <div className="stats-game" style={{ marginBottom: 16 }}>
      {GAME_IDS.map(g => <button key={g} className={`chip ${g === game ? 'on' : ''}`} onClick={() => setGame(g)}>{GAMES[g].name}</button>)}
    </div>
  );
}

/** One player's stats with the game and window pickers: on /stats and on the pilot's Players. */
export function PlayerStats({ id }: { id: number }) {
  const { w, setW, game, setGame } = useStatsPrefs();
  return (
    <>
      <GamePicker game={game} setGame={setGame} />
      {game === 'x01' ? <Profile key={id} id={id} w={w} setW={setW} /> : <GameProfile key={`${id}-${game}`} id={id} game={game} w={w} setW={setW} />}
    </>
  );
}

export function StatsPage({ path }: { path: string }) {
  const compare = path === '/stats/compare';
  const id = Number(path.split('/')[2]) || null;
  const { game, setGame } = useStatsPrefs();
  const { data: list } = useJson<PlayerListItem[]>('/api/stats/players');

  // Phones remember “this is me” and open straight on that profile, once per visit.
  useEffect(() => {
    if (autoOpened || !list) return;
    autoOpened = true;
    const me = store.get(ME_KEY);
    if (path === '/stats' && me && list.some(p => String(p.id) === me)) go(`/stats/${me}`);
  }, [path, list]);

  const x01 = game === 'x01';
  return (
    <div className="stats-page">
      <header className="stats-head">
        <button className="icon-btn" aria-label="Back" onClick={() => go(id || compare ? '/stats' : '/')}>{Icon.back(22)}</button>
        <h1>{compare ? 'Compare' : id ? 'Player' : 'Stats'}</h1>
        <Logo />
      </header>
      {compare ? <ComparePage /> : id ? <PlayerStats id={id} /> : (
        <>
        <GamePicker game={game} setGame={setGame} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!x01 && <Records game={game} />}
          {!list ? <p className="muted">Loading…</p> : list.length === 0 ? <p className="muted">No players yet. Create them on the pilot under Players.</p> : (
            <>
              <div className="option-row">
                <div className="caps" style={{ fontSize: 13 }}>{x01 ? 'Players · average last 30 days' : 'Players'}</div>
                {list.length > 1 && <button className="btn" onClick={() => go('/stats/compare')}>Compare</button>}
              </div>
              <div className="player-cards">
                {list.map(p => (
                  <button key={p.id} className="player-card" onClick={() => go(`/stats/${p.id}`)}>
                    <b>{p.name}</b>
                    {x01 && <span className="num" style={{ color: 'var(--text)' }}>{fmtAvg(p.avg)}</span>}
                    <span>{p.matches} {p.matches === 1 ? 'match' : 'matches'}{p.lastPlayed ? ` · last ${shortDate(p.lastPlayed)}` : ''}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        </>
      )}
    </div>
  );
}
