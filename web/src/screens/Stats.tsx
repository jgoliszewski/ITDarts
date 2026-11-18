import { useEffect, useState } from 'react';
import type { GameId } from '../../../games/index.ts';
import { GAMES, GAME_GROUPS, isGameId } from '../../../games/index.ts';
import type { GameStatsResponse, H2HResponse, HeatResponse, PlayerListItem, PlayerStatsResponse, RecentMatch, RecordTable, StatsWindow } from '../../../server/protocol.ts';
import type { Row } from '../components/Compare.tsx';
import { CompareTable, fmtDistance, gameCompareRows, playerColor, x01CompareRows } from '../components/Compare.tsx';
import { GameIcon } from '../components/GameIcon.tsx';
import { Heatmap } from '../components/Heatmap.tsx';
import { Stat, DeltaTag, TrendChart } from '../components/StatParts.tsx';
import { Dropdown, EmptyState, Icon, Logo } from '../components/ui.tsx';
import {
  MIN_TREND, WINDOWS, X01_METRICS, delta, doubleName, fmtPct, noTrendNote, percent, previousLabel, profileMetrics, visitShare,
  windowLabel, windowPhrase, windowsShown, winTile, x01Delta,
} from '../stats.ts';
import { getJson, useAsync, useJson } from '../useJson.ts';
import { fmtAvg, fmtNum, shortDate, store } from '../util.ts';

const ME_KEY = 'itdarts.me';
const WINDOW_KEY = 'itdarts.statsWindow';
/** Doubles thrown fewer times than this say little: their bar and % are muted. */
const FEW_ATTEMPTS = 5;
let autoOpened = false;

function go(path: string) {
  history.pushState(null, '', path);
  dispatchEvent(new PopStateEvent('popstate'));
}

/** One switch: the four everyday Okna, the rest under More (docs/STATYSTYKI.md, Okna). Scrolls sideways on a phone. */
function WindowPicker({ value, onChange, unit = 'legs' }: { value: StatsWindow; onChange: (w: StatsWindow) => void; unit?: 'legs' | 'matches' }) {
  const [more, setMore] = useState(false);
  const shown = windowsShown(more, value);
  return (
    <div className="windows">
      <div className="seg" role="group" aria-label="Window">
        {shown.map(w => <button key={w} aria-pressed={value === w} onClick={() => onChange(w)}>{windowLabel(w, unit)}</button>)}
        {shown.length < WINDOWS.length && <button className="more" onClick={() => setMore(true)}>More</button>}
      </div>
    </div>
  );
}

function H2H({ a, b, w }: { a: number; b: number; w: StatsWindow }) {
  const { data } = useJson<H2HResponse>(`/api/stats/h2h?a=${a}&b=${b}&window=${w}`);
  if (!data) return null;
  return (
    <div className="box">
      <div className="caps">Head to head{w.startsWith('l') ? ' · last meetings' : ''}</div>
      <div className="h2h">
        <div><b>{data.players[0].name}</b><div className="num">{data.wins[0]}</div><span className="muted">avg {fmtAvg(data.avg[0])}</span></div>
        <span className="muted">{data.played} {data.played === 1 ? 'match' : 'matches'}</span>
        <div><b>{data.players[1].name}</b><div className="num">{data.wins[1]}</div><span className="muted">avg {fmtAvg(data.avg[1])}</span></div>
      </div>
    </div>
  );
}

/** The Average chart, in its own section; nothing below 3 matches. */
function TrendChartBox({ trend, avg }: { trend: PlayerStatsResponse['trend']; avg: number | null }) {
  if (trend.length < MIN_TREND) return null;
  return (
    <div className="section">
      <div className="caps">Average · match by match</div>
      <TrendChart points={trend.map(t => t.avg)} dates={trend.map(t => t.endedAt)} avg={avg} />
      <p className="muted note">The dashed line is the average of the whole window.</p>
    </div>
  );
}

/** How well each double is hit, most thrown first; the bull is a double like the rest (docs/STATYSTYKI.md). */
function DoubleTable({ rows }: { rows: PlayerStatsResponse['x01']['doubles'] }) {
  if (rows.length === 0) return null;
  return (
    <div className="section">
      <div className="caps">Doubles</div>
      <div className="dbl head"><span>Double</span><span /><span>Hit</span><span>Attempts</span><span>%</span></div>
      {rows.map(r => {
        const share = percent(r.hits, r.attempts) ?? 0;
        return (
          <div key={r.double} className={`dbl ${r.attempts < FEW_ATTEMPTS ? 'few' : ''}`}>
            <b>{doubleName(r.double)}</b>
            <div className="bar"><i style={{ width: `${share}%` }} /></div>
            <span className="num">{r.hits}</span>
            <span className="num">{r.attempts}</span>
            <span className="num pct">{share}%</span>
          </div>
        );
      })}
    </div>
  );
}

/** Small tiles at the bottom of a profile: darts thrown (when not shown above) and the distance walked in the window. */
function FunFacts({ distance, darts }: { distance?: number; darts?: number }) {
  if (darts === undefined && !distance) return null;
  return (
    <div className="section fun">
      <div className="caps">Fun facts</div>
      <div className="stat-grid">
        {darts !== undefined && <Stat l="Darts" v={String(darts)} />}
        {distance ? <Stat l="Distance walked" v={fmtDistance(distance)} /> : null}
      </div>
    </div>
  );
}

/** The player's last matches of this game in the Okno, the result from their side. */
function RecentMatches({ rows, game }: { rows: RecentMatch[]; game: GameId }) {
  if (rows.length === 0) return null;
  const prefix = `${GAMES[game].name} · `;
  return (
    <div className="section">
      <div className="caps">Recent matches</div>
      {rows.map(r => (
        <div key={r.id} className="match-row">
          <span className={`res ${r.result === 'played' ? 'saved' : r.result}`}>{r.result === 'saved' ? 'ENDED' : r.result.toUpperCase()}</span>
          <div className="grow">{r.opponents === null ? 'Solo' : `vs ${r.opponents}`}<small>{r.description.startsWith(prefix) ? r.description.slice(prefix.length) : r.description} · {shortDate(r.endedAt)}</small></div>
          {/* A bare “Won” only repeats the result on the left. */}
          {r.score && r.score !== 'Won' && <span className="num">{r.score}</span>}
        </div>
      ))}
    </div>
  );
}

/**
 * Nothing to show: a player who never played this game, or nothing in this time Okno with a way out
 * (DESIGN.md, EmptyState; one pattern for X01 and minigames).
 */
function NoData({ name, game, w, setW }: { name: string; game: GameId; w: StatsWindow; setW: (w: StatsWindow) => void }) {
  const phrase = windowPhrase(w);
  const what = game === 'x01' ? '' : ` ${GAMES[game].name}`;
  if (!phrase) return <div className="box"><EmptyState title={`${name} hasn't played${what} yet`} text={`Pick ${name} in New match.`} /></div>;
  return (
    <div className="box">
      <EmptyState title={`Nothing in ${phrase}`} text={`No${what || ' X01'} for ${name} in this window.`}
        action={<button className="btn" onClick={() => setW('all')}>Show all time</button>} />
    </div>
  );
}

function Profile({ id, name, w, setW }: { id: number; name: string; w: StatsWindow; setW: (w: StatsWindow) => void }) {
  const { data, error } = useJson<PlayerStatsResponse>(`/api/stats/players/${id}?window=${w}`);
  const { data: heat } = useJson<HeatResponse>(`/api/stats/heat?ids=${id}&game=x01&window=${w}`);
  const [vs, setVs] = useState<number | null>(null);
  const never = !!data && data.x01.darts === 0 && data.results.played === 0 && !windowPhrase(w);
  return (
    <div className="profile">
      {!never && <WindowPicker value={w} onChange={setW} />}
      {error ? <p className="muted">This player does not exist.</p> : !data ? <p className="muted">Loading…</p>
        : <ProfileBody id={id} name={name} w={w} setW={setW} data={data} heat={heat} vs={vs} setVs={setVs} />}
    </div>
  );
}

/** The statistics of an X01 profile, below the Okno picker, which stays while it loads. */
function ProfileBody({ id, name, w, setW, data, heat, vs, setVs }: {
  id: number; name: string; w: StatsWindow; setW: (w: StatsWindow) => void; data: PlayerStatsResponse; heat: HeatResponse | null;
  vs: number | null; setVs: (v: number | null) => void;
}) {
  const x = data.x01;
  const prev = data.previous;
  const since = previousLabel(w);
  const empty = x.darts === 0 && data.results.played === 0;
  const none = noTrendNote(w);
  if (empty) return <NoData name={name || data.player.name} game="x01" w={w} setW={setW} />;
  return (
    <>
      <div className="stat-grid main">
        <Stat main hl l={X01_METRICS.avg.label} v={fmtAvg(x.avg)} delta={x01Delta('avg', x, prev)} vs={since} noTrend={none} />
        <Stat main l={X01_METRICS.first9.label} v={fmtAvg(x.first9)} delta={x01Delta('first9', x, prev)} vs={since} noTrend={none} />
        <Stat main l={X01_METRICS.checkoutPct.label} v={X01_METRICS.checkoutPct.plain(x.checkoutPct)} s={`${x.checkoutHits} / ${x.checkoutAttempts} darts`}
          delta={x01Delta('checkoutPct', x, prev)} vs={since}
          noTrend={w !== 'all' && x.checkoutAttempts < 10 ? 'No trend · fewer than 10 attempts' : none} />
      </div>
      <TrendChartBox trend={data.trend} avg={x.avg} />
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
      <p className="muted note">Winrate counts finished matches between registered players only. Matches with guests count for averages, not for wins.</p>
      <DoubleTable rows={x.doubles} />
      <PlayerHeat data={heat} />
      {data.opponents.length > 0 && (
        <div className="section">
          <div className="caps">Opponents</div>
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
      <RecentMatches rows={data.recent} game="x01" />
      <FunFacts distance={heat?.[0]?.distance} darts={x.darts} />
    </>
  );
}

const GAME_KEY = 'itdarts.statsGame';

function GameProfile({ id, name, game, w, setW }: { id: number; name: string; game: GameId; w: StatsWindow; setW: (w: StatsWindow) => void }) {
  const { data, error } = useJson<GameStatsResponse>(`/api/stats/players/${id}?game=${game}&window=${w}`);
  const { data: heat } = useJson<HeatResponse>(`/api/stats/heat?ids=${id}&game=${game}&window=${w}`);
  const never = !!data && data.played === 0 && !windowPhrase(w);
  return (
    <div className="profile">
      {!never && <WindowPicker value={w} onChange={setW} unit="matches" />}
      {error ? <p className="muted">This player does not exist.</p> : !data ? <p className="muted">Loading…</p>
        : <GameBody name={name || data.player.name} game={game} w={w} setW={setW} data={data} heat={heat} />}
    </div>
  );
}

function GameBody({ name, game, w, setW, data, heat }: { name: string; game: GameId; w: StatsWindow; setW: (w: StatsWindow) => void; data: GameStatsResponse; heat: HeatResponse | null }) {
  const shown = profileMetrics(game, data);
  const win = winTile(data);
  if (data.played === 0) return <NoData name={name} game={game} w={w} setW={setW} />;
  return (
    <>
      <div className="stat-grid main">
        {shown.filter(m => m.main).map(m => (
          <Stat key={m.label} main hl l={m.label} v={m.value} s={m.sub} delta={m.delta} vs={previousLabel(w, 'matches')} noTrend={noTrendNote(w, 'matches')} />
        ))}
        <Stat main l={win.label} v={win.value} s={win.sub} />
      </div>
      {shown.some(m => !m.main) && (
        <div className="stat-grid">
          {shown.filter(m => !m.main).map(m => <Stat key={m.label} l={m.label} v={m.value} s={m.sub} />)}
        </div>
      )}
      <PlayerHeat data={heat} />
      {data.bests.length > 0 && (
        <div className="section">
          <div className="caps">Personal bests · all time</div>
          {data.bests.map(b => (
            <div key={b.label} className="match-row"><div className="grow">{b.label}</div><span className="num">{b.value}</span></div>
          ))}
        </div>
      )}
      <RecentMatches rows={data.recent} game={game} />
      {/* Darts only when the game's own figures do not show them already. */}
      <FunFacts distance={heat?.[0]?.distance} darts={shown.some(m => m.label === 'Darts') ? undefined : data.totals.darts} />
    </>
  );
}

/** Heatmap of one player in a game and window (the profile fetches it once, Fun facts reads the distance from it). */
function PlayerHeat({ data }: { data: HeatResponse | null }) {
  if (!data || data.length === 0 || data.every(p => p.heat.visits === 0)) return null;
  return (
    <div className="section">
      <div className="caps">Heatmap</div>
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
  // A player without data is not a player with zeros: say so above the table.
  const missing = data.stats.filter(d => ('x01' in d ? d.x01.darts === 0 && d.results.played === 0 : d.played === 0)).map(d => d.player.name);
  return (
    <div className="compare-body">
      <div className="compare-table">
        {missing.map(n => <p key={n} className="cmp-note">{n} has no {GAMES[game].name} in this window.</p>)}
        <CompareTable names={names} rows={rows} hideNames />
      </div>
      {data.heat.some(h => h.heat.visits > 0) && (
        <Heatmap players={data.heat.map((p, i) => ({ name: p.player.name, color: playerColor(i), heat: p.heat }))} />
      )}
    </div>
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
      <div className="profile">
        <WindowPicker value={w} onChange={setW} unit={game === 'x01' ? 'legs' : 'matches'} />
        {!list ? <p className="muted">Loading…</p> : pair.length < 2 ? <div className="box"><EmptyState title="Comparing needs two players" text="Create another player under Players." /></div> : (
          <>
            <div className="heat-picks compare-picks">{picker(0)}<span className="vs">VS</span>{picker(1)}</div>
            <CompareData ids={pair} game={game} w={w} />
          </>
        )}
      </div>
    </>
  );
}

/** One record table: the top 5, the rest behind “Show top 10”. */
function RecordBox({ t }: { t: RecordTable }) {
  const [all, setAll] = useState(false);
  const rows = all ? t.rows : t.rows.slice(0, 5);
  return (
    <div className="section record-box">
      <div className="caps">{t.rows.length >= 10 ? `Top 10 · ${t.label}` : t.label}</div>
      <div className="record-table">
        {rows.map((r, i) => (
          <div key={i} className="row">
            <span className="muted">{i + 1}</span>
            <b className="who" title={r.who}>{r.who}</b>
            <span className="muted when">{shortDate(r.at)}</span>
            <span className="num">{r.value}</span>
          </div>
        ))}
      </div>
      {t.rows.length > 5 && <button className="btn ghost" onClick={() => setAll(!all)}>{all ? 'Show top 5' : `Show top ${t.rows.length}`}</button>}
    </div>
  );
}

function Records({ game }: { game: GameId }) {
  const { data } = useJson<RecordTable[]>(`/api/stats/records?game=${game}`);
  if (game !== 'x01' && !GAMES[game].record) return null;
  if (!data) return <p className="muted">Loading…</p>;
  if (data.length === 0) return <p className="muted">No records yet.</p>;
  return (
    <div className="section">
      <div className="caps">Records · all time</div>
      <div className="record-grid">{data.map(t => <RecordBox key={t.key} t={t} />)}</div>
    </div>
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

/**
 * One player's stats with the game and window pickers: on /stats and on the pilot's Players. The name and “This is me”
 * sit above the game picker, once, for every game; `embedded` leaves the name to the screen's own header (Players).
 */
export function PlayerStats({ id, embedded = false }: { id: number; embedded?: boolean }) {
  const { w, setW, game, setGame } = useStatsPrefs();
  const { data: list } = useJson<PlayerListItem[]>('/api/stats/players');
  const player = list?.find(p => p.id === id);
  // An archived player is not on the list: the name comes from the profile instead.
  const { data: other } = useJson<PlayerStatsResponse>(list && !player ? `/api/stats/players/${id}?window=all` : null);
  const name = player?.name ?? other?.player.name ?? '';
  // Never played anything: no pickers, just the way in (AUDIT C#9).
  const never = player?.lastPlayed === null;
  const [me, setMe] = useState(store.get(ME_KEY));
  const isMe = me === String(id);
  const toggleMe = () => {
    const v = isMe ? null : String(id);
    store.set(ME_KEY, v);
    setMe(v);
  };
  return (
    <>
      <div className="profile-head">
        {!embedded && <h2 className="profile-name">{name}</h2>}
        <button className={`chip ${isMe ? 'on' : ''}`} aria-pressed={isMe} onClick={toggleMe}>{isMe ? 'This is me ✓' : 'This is me'}</button>
      </div>
      {never ? <div className="box"><EmptyState title={`${name} hasn't played yet`} text={`Pick ${name} in New match.`} /></div> : <>
      <GamePicker game={game} setGame={setGame} />
      <div key={game} className="game-fade">
        {game === 'x01' ? <Profile key={id} id={id} name={name} w={w} setW={setW} /> : <GameProfile key={`${id}-${game}`} id={id} name={name} game={game} w={w} setW={setW} />}
      </div>
      </>}
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
          <div key={game} className="profile game-fade">
            {/* Players first: the list is where /stats starts; the records follow (AUDIT C#7). */}
            {!list ? <p className="muted">Loading…</p> : list.length === 0
              ? <div className="box"><EmptyState title="No players yet" text="Create them under Players, then pick them in New match." /></div> : (
              <div className="section">
                <div className="option-row">
                  <div className="caps grow">{x01 ? 'Players · average last 30 days' : 'Players'}</div>
                  {list.length > 1 && <button className="btn" onClick={() => go('/stats/compare')}>Compare</button>}
                </div>
                <div className="player-cards">
                  {list.map(p => (
                    <button key={p.id} className="player-card" onClick={() => go(`/stats/${p.id}`)}>
                      <b>{p.name}</b>
                      {x01 && <span className="vrow"><span className="num">{fmtAvg(p.avg)}</span><DeltaTag d={delta(p.avg, p.avgPrev, 'higher')} /></span>}
                      <span>{p.matches} {p.matches === 1 ? 'match' : 'matches'} · 30 days{p.lastPlayed ? ` · last ${shortDate(p.lastPlayed)}` : ''}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Records game={game} />
          </div>
        </>
      )}
    </div>
  );
}
