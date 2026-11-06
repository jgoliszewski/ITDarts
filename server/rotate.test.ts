import { describe, expect, it } from 'vitest';
import { rotateBoardDue } from './rotate.ts';

const now = new Date('2026-11-30T12:00:00Z');
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

describe('rotateBoardDue', () => {
  it('is due when the board was never rotated', () => expect(rotateBoardDue(null, now)).toBe(true));
  it('is not due after 29 days', () => expect(rotateBoardDue(ago(29), now)).toBe(false));
  it('is due after 30 days', () => expect(rotateBoardDue(ago(30), now)).toBe(true));
  it('is not due right after rotating', () => expect(rotateBoardDue(now.toISOString(), now)).toBe(false));
  it('is due when the stored value is garbage', () => expect(rotateBoardDue('nope', now)).toBe(true));
});
