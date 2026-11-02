// Groups of the Effects page: the sounds and presets in the groups of the map (games/effects.ts, FX_GROUPS), and
// the files in groups their owner typed (docs/EFEKTY.md, Układ strony).
import { FX_GROUPS } from '../../../../games/effects.ts';
import { LEDS, PRESET_RANGE } from '../../../../server/effects/leds.ts';
import type { WledPreset } from '../../../../server/effects/wled.ts';

export interface Section<T> {
  id: string;
  title: string;
  items: T[];
}

const OTHER = 'Other';

/** The groups of the map in their order, with their items; a group without items is left out. */
function byMapGroup<T>(items: T[], groupOf: (i: T) => string | undefined): Section<T>[] {
  const known = FX_GROUPS.map(([id, title]) => ({ id: id as string, title, items: items.filter(i => groupOf(i) === id) }));
  const rest = items.filter(i => !FX_GROUPS.some(([id]) => id === groupOf(i)));
  return [...known, { id: 'other', title: OTHER, items: rest }].filter(s => s.items.length > 0);
}

/** Built-in sounds in the groups of the map. */
export const builtinSections = <T extends { group: string }>(sounds: T[]) => byMapGroup(sounds, s => s.group);

/** Files in the groups they were given, alphabetical, without a group last in “Other”. The caller keeps the file order. */
export function fileSections<T extends { group: string }>(files: T[]): Section<T>[] {
  const map = new Map<string, Section<T>>();
  for (const f of files) {
    // A group typed as “Other” is the same as none.
    const key = f.group.toLowerCase() === OTHER.toLowerCase() ? '' : f.group.toLowerCase();
    const s = map.get(key) ?? { id: key, title: f.group, items: [] };
    s.items.push(f);
    map.set(key, s);
  }
  const [none, named] = [map.get('') ?? null, [...map.values()].filter(s => s.id !== '')];
  named.sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }));
  return none ? [...named, { ...none, title: OTHER, id: '' }] : named;
}

const ITDARTS_GROUP = new Map(Object.values(LEDS).map(l => [l.preset, l.group]));
const itdarts = (p: WledPreset) => p.id >= PRESET_RANGE[0] && p.id <= PRESET_RANGE[1];

/** The controller's presets: the user's own, flat, and the ones ITDarts uploaded, in the groups of the map. */
export function presetSections(list: WledPreset[]): { mine: WledPreset[]; itdarts: Section<WledPreset>[] } {
  return { mine: list.filter(p => !itdarts(p)), itdarts: byMapGroup(list.filter(itdarts), p => ITDARTS_GROUP.get(p.id)) };
}
