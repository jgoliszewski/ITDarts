// Avatars in the places that choose their colour, label and order (docs/UI.md, Awatary graczy).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../net.ts', () => ({ onFx: () => () => {}, send: async () => ({ ok: true }), useSnapshot: () => ({}) }));
import { cricket } from '../../../games/cricket.ts';
import { RematchLabel } from '../components/Avatar.tsx';
import { CompareTable } from '../components/Compare.tsx';
import { MiniHero } from './MiniBoard.tsx';

const tones = (html: string) => [...html.matchAll(/--tone:var\(--(p\d|off)\)/g)].map(x => x[1]);
const labels = (html: string) => [...html.matchAll(/aria-label="([^"]*)"/g)].map(x => x[1]);

describe('Rematch label', () => {
  const players = (names: string[], left: number[] = []) => names.map((name, i) => ({ name, left: left.includes(i) }));
  const render = (p: ReturnType<typeof players>) => renderToStaticMarkup(createElement('button', null, createElement(RematchLabel, { players: p })));

  it('names the players who stay, up to 3, when a withdrawn one leaves four', () => {
    expect(render(players(['Anna', 'Bob', 'Cy', 'Dee'], [1]))).toBe('<button>Rematch Anna vs Cy vs Dee</button>');
  });

  it('shows avatars from 4 staying players in the colours and order of the last match', () => {
    const html = render(players(['Anna', 'Bob', 'Cy', 'Dee', 'Eve'], [1]));
    expect(html).toContain('>Rematch<span class="av-row">');
    expect(tones(html)).toEqual(['p1', 'p3', 'p4', 'p1']);
    expect(labels(html)).toEqual(['Anna', 'Cy', 'Dee', 'Eve']);
  });
});

describe('Summary header from 3 players', () => {
  const html = renderToStaticMarkup(createElement(CompareTable, { names: ['Anna', 'Bob', 'Cy'], rows: [], left: [false, true, false] }));

  it('puts the avatar over the name, in the place colour', () => {
    expect(html).toContain('class="cmp-names avatars"');
    expect(html).toMatch(/class="avatar[^"]*"[^>]*>AN<\/span><span class="nm">Anna<\/span>/);
    expect(tones(html)[0]).toBe('p1');
    expect(tones(html)[2]).toBe('p3');
  });

  it('draws a withdrawn player grey with Left under the name', () => {
    expect(tones(html)[1]).toBe('off');
    expect(html).toContain('<span class="nm">Bob</span><small>Left</small>');
  });

  it('keeps two players as plain names', () => {
    expect(renderToStaticMarkup(createElement(CompareTable, { names: ['Anna', 'Bob'], rows: [] }))).not.toContain('avatar');
  });
});

describe('Cricket hero legend', () => {
  const o = cricket.defaults;
  const roster = ['Anna', 'Bob', 'Cy', 'Dee', 'Eve'].map(name => ({ name, playerId: null }));
  // Throwing order Cy, Anna, Bob, Eve, Dee: not the order of the roster.
  const m = { game: 'cricket', options: o, roster, record: null, view: { ...cricket.view([], 5, o), order: [2, 0, 1, 4, 3] } } as never;
  const html = renderToStaticMarkup(createElement(MiniHero, { m, flash: null, onDart: () => {}, canEdit: true }));
  const rows = [...html.matchAll(/<span class="n num">(\d)<\/span><span class="avatar[^"]*" style="--tone:var\(--(p\d)\)[^>]*>(\w+)<\/span><span class="who">(\w+)<\/span>/g)].map(x => x.slice(1));

  it('numbers by throwing order and colours by place in the roster', () => {
    expect(rows).toEqual([['1', 'p3', 'CY', 'Cy'], ['2', 'p1', 'AN', 'Anna'], ['3', 'p2', 'BO', 'Bob'], ['4', 'p1', 'EV', 'Eve'], ['5', 'p4', 'DE', 'Dee']]);
  });

  it('shows no legend for 3 players whose names fit', () => {
    const three = { ...(m as object), roster: roster.slice(0, 3), view: { ...cricket.view([], 3, o), order: [0, 1, 2] } } as never;
    expect(renderToStaticMarkup(createElement(MiniHero, { m: three, flash: null, onDart: () => {}, canEdit: true }))).not.toContain('class="legend"');
  });

  it('shows the legend without numbers when a name overflows', () => {
    const three = { ...(m as object), roster: roster.slice(0, 3), view: { ...cricket.view([], 3, o), order: [0, 1, 2] } } as never;
    const out = renderToStaticMarkup(createElement(MiniHero, { m: three, flash: null, onDart: () => {}, canEdit: true, overflow: true }));
    expect(out).toContain('class="legend"');
    expect(out).not.toContain('<span class="n num">');
  });
});
