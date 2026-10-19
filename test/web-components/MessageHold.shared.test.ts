import { MessageHold } from '../../src/web-components/MessageHold';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

describe('MessageHold', () => {
  let t: number;
  let shown: string[];
  let hold: MessageHold;

  beforeEach(() => {
    vi.useFakeTimers();
    t = 0;
    shown = [];
    hold = new MessageHold(
      (text) => shown.push(text),
      3000,
      () => t
    );
  });
  afterEach(() => vi.useRealTimers());

  const advance = (ms: number) => {
    t += ms;
    vi.advanceTimersByTime(ms);
  };

  test('shows messages immediately when nothing is held', () => {
    hold.show('a');
    hold.show('b');
    expect(shown).toEqual(['a', 'b']);
  });

  test('a held message is not replaced before the minimum time', () => {
    hold.show('Low confidence', { hold: true });
    advance(500);
    hold.show('Scanning');
    expect(shown).toEqual(['Low confidence']);
    advance(2400);
    expect(shown).toEqual(['Low confidence']);
    advance(200);
    expect(shown).toEqual(['Low confidence', 'Scanning']);
  });

  test('only the latest waiting message is shown', () => {
    hold.show('Low confidence', { hold: true });
    hold.show('b');
    hold.show('c');
    advance(3001);
    expect(shown).toEqual(['Low confidence', 'c']);
  });

  test('a waiting message that equals the held one is dropped', () => {
    hold.show('Low confidence', { hold: true });
    hold.show('Scanning');
    hold.show('Low confidence', { hold: true });
    advance(3001);
    expect(shown).toEqual(['Low confidence']);
  });

  test('re-showing the held message does not extend the hold', () => {
    hold.show('Low confidence', { hold: true });
    advance(2000);
    hold.show('Low confidence', { hold: true });
    advance(1100);
    hold.show('Scanning');
    expect(shown.at(-1)).toBe('Scanning');
  });

  test('a waiting held message gets its own full hold', () => {
    hold.show('A', { hold: true });
    hold.show('B', { hold: true });
    advance(3001);
    expect(shown).toEqual(['A', 'B']);
    hold.show('C');
    expect(shown).toEqual(['A', 'B']);
    advance(3001);
    expect(shown).toEqual(['A', 'B', 'C']);
  });

  test('immediate drops the hold and the waiting message', () => {
    hold.show('Low confidence', { hold: true });
    hold.show('Scanning');
    hold.show('Issue', { immediate: true });
    advance(5000);
    expect(shown).toEqual(['Low confidence', 'Issue']);
  });

  test('release lets the next message through', () => {
    hold.show('Low confidence', { hold: true });
    hold.release();
    hold.show('Scanning');
    expect(shown).toEqual(['Low confidence', 'Scanning']);
  });

  test('passes force through, also for waiting messages', () => {
    const calls: Array<[string, boolean]> = [];
    const h = new MessageHold(
      (text, force) => calls.push([text, force]),
      3000,
      () => t
    );
    h.show('A', { hold: true });
    h.show('B', { force: true });
    advance(3001);
    expect(calls).toEqual([
      ['A', false],
      ['B', true],
    ]);
  });
});
