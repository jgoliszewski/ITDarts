// The Effects page (docs/EFEKTY.md, Układ strony): tabs on top on the phone, on the side on the laptop.
import { Dialog, Icon, Logo } from '../../components/ui.tsx';
import { useMedia } from '../../util.ts';
import type { EffectsData, Tab } from './api.ts';
import { TABS, discardAnswer, go, parseRoute, useEffectsData, useNav } from './api.ts';
import { LedsTab } from './Leds.tsx';
import { PlaybackTab } from './Playback.tsx';
import { RuleEditor, RuleList, firstRule } from './Rules.tsx';
import { SoundsTab } from './Sounds.tsx';

/** Green when sounds and LEDs are on and WLED answers; amber otherwise. */
function status(d: EffectsData): { ok: boolean; text: string } {
  const s = d.settings;
  const wledDown = !!s.wled.address && !!d.presets.error;
  if (!s.sounds && !s.leds) return { ok: false, text: 'Sounds and LEDs off' };
  if (!s.sounds) return { ok: false, text: 'Sounds off' };
  if (!s.leds) return { ok: false, text: 'LEDs off' };
  if (wledDown) return { ok: false, text: 'LEDs not answering' };
  return { ok: true, text: 'Sounds · LEDs on' };
}

/** Sounds counts the files; the built-in ones are always there. */
function count(d: EffectsData, t: Tab): string {
  if (t === 'rules') return String(d.rules.length);
  if (t === 'sounds') return String(d.sounds.filter(x => !x.builtin).length);
  if (t === 'leds') return d.presets.list ? `${d.presets.list.length} presets` : '';
  return '';
}

function Content({ d, tab, rule, wide }: { d: EffectsData; tab: Tab; rule: string | null; wide: boolean }) {
  if (tab === 'sounds') return <SoundsTab d={d} wide={wide} />;
  if (tab === 'leds') return <LedsTab d={d} wide={wide} />;
  if (tab === 'playback') return <PlaybackTab d={d} wide={wide} />;
  const found = d.rules.find(r => r.id === rule) ?? null;
  if (!wide) {
    if (rule === 'new') return <RuleEditor key="new" d={d} rule={null} wide={false} />;
    if (found) return <RuleEditor key={found.id} d={d} rule={found} wide={false} />;
    return <RuleList d={d} selected={null} wide={false} />;
  }
  // Laptop: the list and, next to it, the chosen rule; the first one when none is chosen, a new one when there are none.
  const shown = rule === 'new' ? null : found ?? firstRule(d.rules);
  return (
    <div className="fx-split">
      <RuleList d={d} selected={rule === 'new' ? 'new' : shown?.id ?? 'new'} wide />
      <div className="fx-pane"><RuleEditor key={shown?.id ?? 'new'} d={d} rule={shown} wide /></div>
    </div>
  );
}

export function EffectsPage() {
  const d = useEffectsData();
  const { path, asking } = useNav();
  const wide = useMedia('(min-width: 1100px)');
  const { tab, rule } = parseRoute(path);
  const st = d && status(d);
  const pill = st && (
    <button className="fx-status" onClick={() => go('/effects/playback')}><span className={`dot ${st.ok ? 'green' : 'amber'}`} />{st.text}</button>
  );
  // A broken effects file (e.g. git conflict markers after a pull): the last good version stays in use.
  const fileError = d?.file.error && (
    <div className="banner" role="alert">{d.file.path} has an error, so ITDarts keeps the last good version. {d.file.error}</div>
  );
  const discard = asking && (
    <Dialog title="Discard changes?" onClose={() => discardAnswer(false)} actions={<>
      <button className="btn" onClick={() => discardAnswer(false)}>Keep editing</button>
      <button className="btn danger" onClick={() => discardAnswer(true)}>Discard</button>
    </>}>
      <p>This rule has changes that are not saved.</p>
    </Dialog>
  );
  const toLobby = () => go('/');

  if (!d) return <div className="center-msg" style={{ height: '100%' }}><Logo /><p>Loading…</p></div>;

  if (wide) {
    return (
      <div className="fx-wide">
        <nav className="fx-side" aria-label="Effects sections">
          <button className="btn ghost" style={{ justifyContent: 'flex-start' }} onClick={toLobby}>{Icon.back(20)}Back to ITDarts</button>
          <h1>Effects</h1>
          {TABS.map(([t, label]) => (
            <button key={t} className={`fx-side-tab ${t === tab ? 'on' : ''}`} aria-current={t === tab ? 'page' : undefined} onClick={() => go(`/effects/${t}`)}>
              <span className="grow">{label}</span><span className="n">{count(d, t)}</span>
            </button>
          ))}
          <div className="spacer" />
          {pill}
        </nav>
        <main className={`fx-main ${tab === 'rules' ? '' : 'narrow'}`}>{fileError}<Content d={d} tab={tab} rule={rule} wide /></main>
        {discard}
      </div>
    );
  }

  // Phone: the rule editor takes the whole screen, with its own Cancel and Save.
  if (tab === 'rules' && rule !== null) return <div className="fx-phone">{fileError}<Content d={d} tab={tab} rule={rule} wide={false} />{discard}</div>;
  return (
    <div className="fx-phone">
      <header className="fx-head">
        <button className="icon-btn" aria-label="Back to ITDarts" onClick={toLobby}>{Icon.back(22)}</button>
        <h1>Effects</h1>
        {pill}
      </header>
      <nav className="seg fx-tabs" aria-label="Effects sections">
        {TABS.map(([t, label]) => <button key={t} aria-pressed={t === tab} onClick={() => go(`/effects/${t}`)}>{label}</button>)}
      </nav>
      <main className="fx-body">{fileError}<Content d={d} tab={tab} rule={rule} wide={false} /></main>
      {tab === 'rules' && (
        <div className="fx-bottom">
          <button className="btn primary block" onClick={() => go('/effects/rules/new')}>{Icon.plus()}New rule</button>
        </div>
      )}
      {discard}
    </div>
  );
}
