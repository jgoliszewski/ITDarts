import { useEffect, useRef, useState } from 'react';
import type { GameId } from '../../../games/index.ts';
import { GAMES, GAME_GROUPS, isGameId } from '../../../games/index.ts';
import type { GameStatsResponse, H2HResponse, HeatResponse, PlayerListItem, PlayerStatsResponse, RecordTable, StatsWindow } from '../../../server/protocol.ts';
import type { Row } from '../components/Compare.tsx';
import { CompareTable, fmtDistance, gameCompareRows, playerColor, x01CompareRows } from '../components/Compare.tsx';
import { GameIcon } from '../components/GameIcon.tsx';
import { Heatmap } from '../components/Heatmap.tsx';
import { Stat, DeltaTag, TrendChart } from '../components/StatParts.tsx';
import { Dropdown, Icon, Logo } from '../components/ui.tsx';
import { MIN_TREND, X01_METRICS, delta, doubleName, fmtPct, percent, previousLabel, profileMetrics, visitShare, winTile, x01Delta } from '../stats.ts';
import { getJson, useAsync, useJson } from '../useJson.ts';
import { fmtAvg, fmtNum, shortDate, store } from '../util.ts';

const ME_KEY = 'itdarts.me';
const WINDOW_KEY = 'itdarts.statsWindow';
const TIME: [StatsWindow, string][] = [['7d', '7D'], ['30d', '30D'], ['90d', '3M'], ['365d', '1Y'], ['all', 'All']];
const LEGS: [StatsWindow, string][] = [['l10', 'Last 10 legs'], ['l100', 'Last 100 legs']];
let autoOpened = false;

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

/** The Average chart, in its own section; nothing below 3 matches. */
function TrendChartBox({ points, avg }: { points: number[]; avg: number | null }) {
  if (points.length < MIN_TREND) return null;
  return (
    <div className="section">
      <div className="caps" style={{ fontSize: 13 }}>Average · match by match</div>
      <TrendChart points={points} avg={avg} />
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>The dashed line is the average of the whole window.</p>
    </div>
  );
}

/** How well each double is hit, most thrown first; the bull is a double like the rest (docs/STATYSTYKI.md). */
function DoubleTable({ rows }: { rows: PlayerStatsResponse['x01']['doubles'] }) {
  if (rows.length === 0) return null;
  return (
    <div className="section">
      <div className="caps" style={{ fontSize: 13 }}>Doubles</div>
      <div className="dbl head"><span>Double</span><span /><span>Hit</span><span>Attempts</span><span>%</span></div>
      {rows.map(r => {
        const share = percent(r.hits, r.attempts) ?? 0;
        return (
          <div key={r.double} className="dbl">
            <b>{doubleName(r.double)}</b>
            <div className="bar"><i style={{ width: `${share}%` }} /></div>
            <span className="num">{r.hits}</span>
            <span className="num">{r.attempts}</span>
            <span className="num">{share}%</span>
          </div>
        );
      })}
    </div>
  );
}

/** Small tiles at the bottom of a profile: darts thrown (when known) and the distance walked in the window. */
function FunFacts({ distance, darts }: { distance?: number; darts?: number }) {
  if (darts === undefined && !distance) return null;
  return (
    <div className="section fun">
      <div className="caps" style={{ fontSize: 13 }}>Fun facts</div>
      <div className="stat-grid">
        {darts !== undefined && <Stat l="Darts" v={String(darts)} />}
        {distance ? <Stat l="Distance walked" v={fmtDistance(distance)} /> : null}
      </div>
    </div>
  );
}

function Profile({ id, w, setW }: { id: number; w: StatsWindow; setW: (w: StatsWindow) => void }) {
  const { data, error } = useJson<PlayerStatsResponse>(`/api/stats/players/${id}?window=${w}`);
  const { data: heat } = useJson<HeatResponse>(`/api/stats/heat?ids=${id}&game=x01&window=${w}`);
  const [me, setMe] = useState(store.get(ME_KEY));
  const [vs, setVs] = useState<number | null>(null);
  // The name stays while the next Okno loads, so the header does not jump.
  const name = useRef('');
  if (data) name.current = data.player.name;
  const isMe = me === String(id);
  const toggleMe = () => {
    const v = isMe ? null : String(id);
    store.set(ME_KEY, v);
    setMe(v);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="option-row" style={{ flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>{name.current}</h2>
        <button className={`chip ${isMe ? 'on' : ''}`} onClick={toggleMe}>{isMe ? 'This is me ✓' : 'This is me'}</button>
      </div>
      <WindowPicker value={w} onChange={setW} />
      {error ? <p className="muted">This player does not exist.</p> : !data ? <p className="muted">Loading…</p> : <ProfileBody id={id} w={w} data={data} heat={heat} vs={vs} setVs={setVs} />}
    </div>
  );
}

/** The statistics of an X01 profile, below the header and the Okno picker, which stay while it loads. */
function ProfileBody({ id, w, data, heat, vs, setVs }: { id: number; w: StatsWindow; data: PlayerStatsResponse; heat: HeatResponse | null; vs: number | null; setVs: (v: number | null) => void }) {
  const x = data.x01;
  const prev = data.previous;
  const since = previousLabel(w);
  const empty = x.darts === 0 && data.results.played === 0;
  return (
    <>
      {empty ? (
        <p className="muted" style={{ margin: 0 }}>No darts in this window.</p>
      ) : (
        <>
          <div className="stat-grid main">
            <Stat main hl l={X01_METRICS.avg.label} v={fmtAvg(x.avg)} delta={x01Delta('avg', x, prev)} vs={since} />
            <Stat main l={X01_METRICS.first9.label} v={fmtAvg(x.first9)} delta={x01Delta('first9', x, prev)} vs={since} />
            <Stat main l={X01_METRICS.checkoutPct.label} v={X01_METRICS.checkoutPct.plain(x.checkoutPct)} s={`${x.checkoutHits} / ${x.checkoutAttempts} darts`}
              delta={x01Delta('checkoutPct', x, prev)} vs={since} />
          </div>
          <TrendChartBox points={data.trend.map(t => t.avg)} avg={x.avg} />
          <div className="stat-grid">
            <Stat l="Legs" v={`${x.legsWon}/${x.legs}`} s="won / played" />
            <Stat l="Bust rate" v={fmtPct(x.bustRate)} s={`${x.busts} of ${x.visits} visits`} />
            <Stat l="Highest visit" v={fmtNum(x.highestVisit)} />
            <Stat l="Highest checkout" v={fmtNum(x.highestCheckout)} />
            <Stat l="Best leg" v={fmtNum(x.bestLeg)} s={<span className="nobreak">{x.bestLegStart === null ? 'darts' : `darts · ${x.bestLegStart}`}</span>} />
            <Stat l="60+" v={fmtPct(visitShare(x.c60, x))} s={`${x.c60} visits`} />
            <Stat l="80+" v={fmtPct(visitShare(x.c80, x))} s={`${x.c80} visits`} />
            <Stat l="100+" v={fmtPct(visitShare(x.c100, x))} s={`${x.c100} visits`} />
            <Stat l="Winrate" v={data.results.winrate === null ? '–' : `${data.results.winrate}%`} s={`${data.results.won} of ${data.results.played} matches`} />
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Winrate counts finished matches between registered players only. Matches with guests count for averages, not for wins.</p>
          <DoubleTable rows={x.doubles} />
        </>
      )}
      <PlayerHeat data={heat} />
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
              <div className="grow">{r.opponents === null ? 'Solo' : `vs ${r.opponents}`}<small>{r.description.replace(/^X01 · /, '')} · {shortDate(r.endedAt)}</small></div>
              <span className="num" style={{ fontSize: 22 }}>{r.score}</span>
            </div>
          ))}
        </div>
      )}
      {!empty && <FunFacts distance={heat?.[0]?.distance} darts={x.darts} />}
    </>
  );
}

const GAME_KEY = 'itdarts.statsGame';

function GameProfile({ id, game, w, setW }: { id: number; game: GameId; w: StatsWindow; setW: (w: StatsWindow) => void }) {
  const { data, error } = useJson<GameStatsResponse>(`/api/stats/players/${id}?game=${game}&window=${w}`);
  const { data: heat } = useJson<HeatResponse>(`/api/stats/heat?ids=${id}&game=${game}&window=${w}`);
  const name = useRef('');
  if (data) name.current = data.player.name;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>{name.current}</h2>
      <WindowPicker value={w} onChange={setW} />
      {error ? <p className="muted">This player does not exist.</p> : !data ? <p className="muted">Loading…</p> : <GameBody game={game} w={w} data={data} heat={heat} />}
    </div>
  );
}

function GameBody({ game, w, data, heat }: { game: GameId; w: StatsWindow; data: GameStatsResponse; heat: HeatResponse | null }) {
  const shown = profileMetrics(game, data);
  const win = winTile(data);
  return (
    <>
      {data.played === 0 ? <p className="muted" style={{ margin: 0 }}>No {GAMES[game].name} in this window.</p> : (
        <>
          <div className="stat-grid main">
            {shown.filter(m => m.main).map(m => <Stat key={m.label} main hl l={m.label} v={m.value} s={m.sub} delta={m.delta} vs={previousLabel(w, 'matches')} />)}
            <Stat main l={win.label} v={win.value} s={win.sub} />
          </div>
          <div className="stat-grid">
            {shown.filter(m => !m.main).map(m => <Stat key={m.label} l={m.label} v={m.value} s={m.sub} />)}
          </div>
        </>
      )}
      <PlayerHeat data={heat} />
      {data.bests.length > 0 && (
        <div className="section">
          <div className="caps" style={{ fontSize: 13 }}>Personal bests · all time</div>
          {data.bests.map(b => (
            <div key={b.label} className="match-row"><div className="grow">{b.label}</div><span className="num" style={{ fontSize: 22 }}>{b.value}</span></div>
          ))}
        </div>
      )}
      {data.played > 0 && <FunFacts distance={heat?.[0]?.distance} darts={data.totals.darts} />}
    </>
  );
}

/** Heatmap of one player in a game and window (the profile fetches it once, Fun facts reads the distance from it). */
function PlayerHeat({ data }: { data: HeatResponse | null }) {
  if (!data || data.length === 0 || data.every(p => p.heat.visits === 0)) return null;
  return (
    <div className="section">
      <div className="caps" style={{ fontSize: 13 }}>Heatmap</div>
      <Heatmap players={data.map((p, i) => ({ name: p.player.name, color: playerColor(i), heat: p.heat }))} />
    </div>
  );
}

const COMPARE_KEY = 'itdarts.compare';

/** Stats of two players side by side, rows as in the profile of the game (docs/STATYSTYKI.md, Prezentacja). */
function CompareData({ ids, game, w }: { ids: number[]; game: GameId; w: StatsWindow }) {
  const key = ids.join(',');
  // Keyed by everything the rows depend on: after a switch of game the old response is never rendered under the new game.
  const { data } = useAsync(`${key}|${game}|${w}`, () => Promise.all([
    Promise.all(ids.map(id => getJson<PlayerStatsResponse | GameStatsResponse>(`/api/stats/players/${id}?window=${w}${game === 'x01' ? '' : `&game=${game}`}`))),
    getJson<HeatResponse>(`/api/stats/heat?ids=${key}&game=${game}&window=${w}`),
  ]).then(([stats, heat]) => ({ stats, heat })));
  if (!data) return <p className="muted">Loading…</p>;
  const names = data.stats.map(d => d.player.name);
  const rows: Row[] = game === 'x01'
    ? (() => {
      const ps = data.stats as PlayerStatsResponse[];
      const winrate = ps.map(p => p.results.winrate);
      return x01CompareRows(ps.map(p => p.x01), [{ label: 'Winrate', values: winrate.map(fmtPct), nums: winrate, better: 'higher' as const }]);
    })()
    : gameCompareRows(game, data.stats as GameStatsResponse[]);
  rows.push({ label: 'Distance walked', values: data.heat.map(h => fmtDistance(h.distance)) });
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
  if (game !== 'x01' && !GAMES[game].record) return null;
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
    <div className="stats-groups">
      {GAME_GROUPS.map(({ group, title, ids }) => (
        <div key={group} className="stats-group">
          <h3 className="caps">{title}</h3>
          <div className="stats-game">
            {ids.map(g => <button key={g} className={`chip ${g === game ? 'on' : ''}`} aria-pressed={g === game} onClick={() => setGame(g)}><GameIcon game={g} size={16} className="chip-icon" />{GAMES[g].name}</button>)}
          </div>
        </div>
      ))}
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
          <Records game={game} />
          {!list ? <p className="muted">Loading…</p> : list.length === 0 ? <p className="muted">No players yet. Create them under Players.</p> : (
            <>
              <div className="option-row">
                <div className="caps" style={{ fontSize: 13 }}>{x01 ? 'Players · average last 30 days' : 'Players'}</div>
                {list.length > 1 && <button className="btn" onClick={() => go('/stats/compare')}>Compare</button>}
              </div>
              <div className="player-cards">
                {list.map(p => (
                  <button key={p.id} className="player-card" onClick={() => go(`/stats/${p.id}`)}>
                    <b>{p.name}</b>
                    {x01 && <span className="vrow"><span className="num" style={{ color: 'var(--text)' }}>{fmtAvg(p.avg)}</span><DeltaTag d={delta(p.avg, p.avgPrev, 'higher')} /></span>}
                    <span>{p.matches} {p.matches === 1 ? 'match' : 'matches'} · 30 days{p.lastPlayed ? ` · last ${shortDate(p.lastPlayed)}` : ''}</span>
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
