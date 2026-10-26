// Effects (docs/EFEKTY.md): turns trigger changes into one Reguła (sound and LEDs) and one built-in animation.
// Sound plays in the kiosk browser, LEDs go to WLED from here.
import type { Change, Trigger } from '../../games/effects.ts';
import { pickRule } from '../../games/effects.ts';
import type { BaseState, EffectsStore, Rule, RuleInput } from './store.ts';
import { Wled } from './wled.ts';

/** Animations on the scoreboard, hard-coded. */
export type Anim = '180' | '140' | 'bust' | 'confetti' | 'tile';

/** What the kiosk browser plays; `gain` already includes the effects volume. */
export interface Fx {
  sound: { url: string; gain: number } | null;
  anim: Anim | null;
}

const ANIMS: { id: number; enabled: true; anim: Anim; triggers: Trigger[] }[] = [
  { id: 1, enabled: true, anim: 'confetti', triggers: [{ kind: 'matchWon' }] },
  { id: 2, enabled: true, anim: '180', triggers: [{ kind: 'total', total: 180, checkout: 'any' }] },
  { id: 3, enabled: true, anim: '140', triggers: [{ kind: 'range', min: 140, max: 179, checkout: 'any' }] },
  { id: 4, enabled: true, anim: 'bust', triggers: [{ kind: 'bust' }] },
  { id: 5, enabled: true, anim: 'tile', triggers: [{ kind: 'dart', dart: { n: 20, m: 3 } }, { kind: 'dart', dart: { n: 25, m: 2 } }] },
];

export class Effects {
  readonly wled: Wled;
  private base: BaseState | null = null;
  /** When the running LED effect ends; a base change waits for it instead of cutting it short. */
  private ledUntil = 0;
  private baseTimer: NodeJS.Timeout | null = null;

  constructor(readonly store: EffectsStore, private send: (fx: Fx) => void) {
    this.wled = new Wled(() => this.store.settings().wled.address);
  }

  /** Changes from one log event or one hub event. */
  fire(cs: Change[]) {
    if (cs.length === 0) return;
    const rule = pickRule(this.store.rules(), cs);
    const anim = pickRule(ANIMS, cs)?.anim ?? null;
    const s = this.store.settings();
    this.play(rule, anim, s.sounds, s.leds);
  }

  /** “Test whole rule”: plays what the editor shows, saved or not, even with the pilot switches off. */
  test(rule: RuleInput) {
    this.play({ ...rule, id: 'test' }, null, true, true);
  }

  /** “Try” on the effects page: one preset for a while, then back to the base, even with the LEDs switch off. */
  previewLed(preset: number, seconds: number) {
    this.wled.effect(preset, seconds, this.basePreset());
    this.ledUntil = Date.now() + seconds * 1000;
    // With the switch off the lights go dark again afterwards, as the switch says.
    if (this.baseTimer) clearTimeout(this.baseTimer);
    this.baseTimer = this.store.settings().leds ? null : setTimeout(() => this.wled.off(), seconds * 1000);
  }

  private play(rule: Rule | null, anim: Anim | null, sounds: boolean, leds: boolean) {
    const sound = rule && sounds ? this.pickSound(rule) : null;
    if (sound || anim) this.send({ sound, anim });
    if (rule?.led && leds) {
      this.wled.effect(rule.led.preset, rule.led.seconds, this.basePreset());
      this.ledUntil = Date.now() + rule.led.seconds * 1000;
    }
  }

  private pickSound(rule: Rule): Fx['sound'] {
    const lib = this.store.sounds();
    const options = rule.sounds.map(id => lib.find(s => s.id === id)).filter(s => !!s);
    if (options.length === 0) return null;
    const s = options[Math.floor(Math.random() * options.length)];
    return { url: `/sounds/${s.file}`, gain: (this.store.settings().volume / 100) * (s.volume / 100) };
  }

  private basePreset(): number | null {
    return this.base ? this.store.settings().wled.base[this.base] : null;
  }

  /** Stan bazowy changed (or may have): light its preset, after a running effect. */
  setBase(base: BaseState) {
    if (base === this.base) return;
    this.base = base;
    this.applyBase();
  }

  /** Re-applies the base, e.g. after the LEDs switch or the presets changed. */
  applyBase() {
    if (this.baseTimer) clearTimeout(this.baseTimer);
    this.baseTimer = null;
    const s = this.store.settings();
    if (!s.leds) return this.wled.off();
    const wait = this.ledUntil - Date.now();
    if (wait > 0) {
      this.baseTimer = setTimeout(() => this.applyBase(), wait);
      return;
    }
    const preset = this.basePreset();
    if (preset !== null) this.wled.preset(preset);
  }
}
