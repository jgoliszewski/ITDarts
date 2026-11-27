// The scoreboard of the games with a board (docs/UI.md, Ekran wyników): the player, the board card, the list.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../net.ts', () => ({ onFx: () => () => {}, send: async () => ({ ok: true }), useSnapshot: () => ({}) }));
import { killer } from '../../../games/killer.ts';
import { atc } from '../../../games/race.ts';
import { MiniHero, MiniList, MiniSide } from './MiniBoard.tsx';

const roster = ['Maximilian', 'Bob', 'Cy'].map(name => ({ name, playerId: null }));
const record = { label: 'Darts', value: '41', raw: 41, by: 'Cy', at: 1, better: 'lower', coop: false, personal: [null, null, null], team: null, top: [] };
const atcMatch = (rec: object | null) => {
  const o = { ...atc.defaults, order: 'numeric' as const };
  return { game: 'atc', options: o, roster, record: rec, view: atc.view([{ t: 'dart', dart: { n: 1, m: 1 }, at: 1 }], 3, o) } as never;
};
const hero = (m: never) => renderToStaticMarkup(createElement(MiniHero, { m, flash: null, onDart: () => {}, canEdit: true }));
/** The markup of the element with this class, up to its closing tag (no nesting of the same tag inside). */
const part = (html: string, cls: string) => html.slice(html.indexOf(`class="${cls}`), html.indexOf('</section>', html.indexOf(`class="${cls}`)));

describe('board games: three columns', () => {
  it('puts the player in the left section and the board, darts and record pills in the board card', () => {
    const html = hero(atcMatch(record));
    const left = part(html, 'hero board-hero'), card = part(html, 'board-card');
    expect(left).toContain('Maximilian');
    expect(left).toContain('hero-stats');
    expect(left).not.toContain('target-board');
    expect(card).toContain('target-board');
    expect(card).toContain('hero-darts');
    expect(card).toContain('class="rpills"');
    expect(left).not.toContain('rpills');
  });

  it('shows no record pills in a game without a record', () => {
    expect(hero(atcMatch(null))).not.toContain('rpills');
  });

  it('keeps the darts tappable to fix', () => {
    expect(hero(atcMatch(null))).toContain('aria-label="Fix dart 1: S1"');
  });

  it('moves this match\'s numbers to the left column: no card under the list', () => {
    expect(renderToStaticMarkup(createElement(MiniSide, { m: atcMatch(null) }))).toBe('');
  });

  it('draws a progress bar per row, filled with the targets cleared', () => {
    const html = renderToStaticMarkup(createElement(MiniList, { m: atcMatch(null) }));
    expect(html.match(/class="pbar"/g)).toHaveLength(3);
    expect(html).toContain(`width:${((1 / 21) * 100).toFixed(1)}%`);
  });
});

describe('Killer: the name stays visible next to five hearts', () => {
  const o = { ...killer.defaults, lives: 5 };
  const m = { game: 'killer', options: o, roster, record: null, view: killer.view([{ t: 'numbers', numbers: [14, 5, 17] }], 3, o) } as never;

  it('puts the hearts under the name, not in the name row', () => {
    // The name row closes right after the name; the hearts follow as their own row.
    expect(hero(m)).toContain('Maximilian</div></div><div class="hearts" aria-label="5 of 5 lives">');
  });

  it('drops the line about the double to hit', () => {
    expect(hero(m)).not.toContain('Hit your double');
  });
});
