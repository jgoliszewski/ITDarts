import type { ClientState } from '../../../server/protocol.ts';
import type { MatchReport } from '../../../games/report.ts';
import { CompareTable, fmtDistance, gameRows, playerColor, x01Rows } from '../components/Compare.tsx';
import { Heatmap } from '../components/Heatmap.tsx';
import { Logo, act } from '../components/ui.tsx';

function rows(r: MatchReport) {
  return [
    ...(r.x01 ? x01Rows(r.x01) : r.totals ? gameRows(r.game, r.totals) : []),
    { label: 'Distance walked', values: r.distance.map(fmtDistance) },
  ];
}

/** Random Checkouts: one line per drawn number (docs/UI.md, Podsumowanie meczu). */
function Checkouts({ r }: { r: MatchReport }) {
  const rows = r.checkouts!;
  if (!rows.length) return null;
  return (
    <section className="checkouts">
      <h2>Checkouts</h2>
      <ol>
        {rows.map((c, i) => (
          <li key={i} className={c.closer === null ? 'open' : ''}>
            <span className="co-no">{i + 1}</span>
            <b className="co-num">{c.number}</b>
            <span className="co-who" style={c.closer === null ? undefined : { color: playerColor(c.closer) }}>{c.closer === null ? 'Not closed' : r.names[c.closer]}</span>
            <span className="co-stat">{c.closer !== null && <>{c.darts} {c.darts === 1 ? 'dart' : 'darts'} · </>}{c.visits} {c.visits === 1 ? 'visit' : 'visits'}{c.busts > 0 && <> · {c.busts} {c.busts === 1 ? 'bust' : 'busts'}</>}</span>
            <span className="co-finish">{c.finish}</span>
            {c.firstVisit && <em>1st visit</em>}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** After the match: who won, the players side by side and the heatmap (docs/UI.md, Podsumowanie meczu). */
export function Summary({ s, wide, onNew, onMenu }: { s: ClientState; wide: boolean; onNew: () => void; onMenu: () => void }) {
  const r = s.summary!;
  const pilot = s.you.isPilot;
  return (
    <div className={`summary ${wide ? 'wide' : ''}`}>
      <header className="summary-head">
        <Logo />
        <span className="muted">{r.description}</span>
        <button className="btn ghost" onClick={onMenu}>Menu</button>
      </header>
      <section className="summary-title">
        <div className="kicker">{r.kicker}</div>
        <h1>{r.title}</h1>
        {r.line && <div className="line">{r.line}</div>}
      </section>
      <main className="summary-body">
        <div className="summary-left">
          <CompareTable names={r.names} rows={rows(r)} left={r.left} />
          {r.checkouts && <Checkouts r={r} />}
        </div>
        <Heatmap players={r.names.map((name, i) => ({ name, color: playerColor(i), heat: r.heat[i] }))} />
      </main>
      {pilot ? (
        <footer className="summary-actions">
          <button className="btn primary" onClick={() => act({ type: 'rematch' })}>Rematch</button>
          <button className="btn" onClick={onNew}>New match</button>
          <button className="btn" onClick={() => act({ type: 'closeSummary' })}>Back to lobby</button>
        </footer>
      ) : <footer className="summary-actions muted">Rematch, new match or lobby: choose on the pilot.</footer>}
    </div>
  );
}
