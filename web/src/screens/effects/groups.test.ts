import { describe, expect, it } from 'vitest';
import { LEDS } from '../../../../server/effects/leds.ts';
import { builtinSections, fileSections, presetSections } from './groups.ts';

const file = (name: string, group = '') => ({ id: `${name}.mp3`, name, group });
const ids = (s: { items: { name: string }[] }[]) => s.map(x => x.items.map(i => i.name));

describe('sound groups', () => {
  it('sorts the groups of files alphabetically with Other last, and the files by their order', () => {
    const s = fileSections([file('Zed'), file('Roar', 'Crowd'), file('Boo', 'crowd'), file('Joke', 'Jokes'), file('Alpha')]);
    expect(s.map(x => x.title)).toEqual(['Crowd', 'Jokes', 'Other']);
    expect(ids(s)).toEqual([['Roar', 'Boo'], ['Joke'], ['Zed', 'Alpha']]);
  });
  it('treats a group typed as Other like none', () => {
    expect(fileSections([file('A', 'other'), file('B')]).map(x => x.title)).toEqual(['Other']);
  });
  it('has no sections for no files', () => {
    expect(fileSections([])).toEqual([]);
  });
  it('lists built-in sounds in the groups of the map, leaving empty groups out', () => {
    const s = builtinSections([{ name: 'Bust', group: 'visits' }, { name: 'Bull', group: 'darts' }, { name: 'Hit', group: 'minigames' }, { name: 'Ton', group: 'visits' }]);
    expect(s.map(x => x.title)).toEqual(['Darts', 'Visits', 'Minigames']);
    expect(ids(s)).toEqual([['Bull'], ['Bust', 'Ton'], ['Hit']]);
  });
});

describe('preset groups', () => {
  const p = (id: number, name = `P${id}`) => ({ id, name, color: null });
  it('puts presets outside 100–149 in Your presets and 100–149 in the groups of LEDS', () => {
    const r = presetSections([p(1), p(99), p(150), LEDS.bull.preset, LEDS.bust.preset, LEDS.base.preset].map(x => (typeof x === 'number' ? p(x) : x)));
    expect(r.mine.map(x => x.id)).toEqual([1, 99, 150]);
    expect(r.itdarts.map(x => x.title)).toEqual(['Match', 'Darts', 'Visits']);
    expect(r.itdarts[1].items.map(x => x.id)).toEqual([LEDS.bull.preset]);
  });
  it('puts a preset of the range that is not in LEDS in Other, at the end', () => {
    const r = presetSections([p(140), p(LEDS.offline.preset)]);
    expect(r.itdarts.map(x => x.title)).toEqual(['Board', 'Other']);
    expect(r.itdarts[1].items.map(x => x.id)).toEqual([140]);
  });
});
