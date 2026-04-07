import { describe, expect, it } from 'vitest';
import { redactPaths } from '../src/redact.js';

describe('redactPaths', () => {
  it('redacts single nested path', () => {
    const input = { user: { ssn: '111', name: 'A' } };
    const out = redactPaths(['user.ssn'])(input) as { user: { ssn: string; name: string } };
    expect(out.user.ssn).toBe('[REDACTED]');
    expect(out.user.name).toBe('A');
  });

  it('redacts multiple paths', () => {
    const input = { a: { x: 1 }, b: { y: 2 } };
    const out = redactPaths(['a.x', 'b.y'])(input) as { a: { x: string }; b: { y: string } };
    expect(out.a.x).toBe('[REDACTED]');
    expect(out.b.y).toBe('[REDACTED]');
  });

  it('does not mutate original', () => {
    const input = { k: { s: 'secret' } };
    const out = redactPaths(['k.s'])(input) as { k: { s: string } };
    expect(out.k.s).toBe('[REDACTED]');
    expect(input.k.s).toBe('secret');
  });

  it('ignores missing paths', () => {
    const input = { a: 1 };
    const out = redactPaths(['x.y'])(input);
    expect(out).toEqual({ a: 1 });
  });

  it('handles null and undefined', () => {
    expect(redactPaths(['x'])(null)).toBeNull();
    expect(redactPaths(['x'])(undefined)).toBeUndefined();
  });

  it('handles primitive input', () => {
    expect(redactPaths(['x'])('hello')).toBe('hello');
    expect(redactPaths(['x'])(123)).toBe(123);
    expect(redactPaths(['x'])(true)).toBe(true);
  });

  it('handles arrays by index path', () => {
    const input = { items: [{ value: 'a' }, { value: 'b' }] };
    const out = redactPaths(['items.0.value'])(input) as { items: Array<{ value: string }> };
    expect(out.items[0].value).toBe('[REDACTED]');
    expect(out.items[1].value).toBe('b');
  });

  it('ignores impossible traversal safely', () => {
    const input = { a: 'x' };
    const out = redactPaths(['a.b.c'])(input);
    expect(out).toEqual({ a: 'x' });
  });

  it('ignores empty path segments', () => {
    const input = { a: { b: 'x' } };
    const out = redactPaths(['', '.', '..', 'a.b'])(input) as { a: { b: string } };
    expect(out.a.b).toBe('[REDACTED]');
  });

  it('supports unicode values', () => {
    const input = { profil: { namn: 'Åke', ssn: 'åäö' } };
    const out = redactPaths(['profil.ssn'])(input) as { profil: { namn: string; ssn: string } };
    expect(out.profil.ssn).toBe('[REDACTED]');
    expect(out.profil.namn).toBe('Åke');
  });

  it('handles circular self reference', () => {
    const obj: Record<string, unknown> = { secret: 'x' };
    obj.self = obj;
    const out = redactPaths(['secret'])(obj) as Record<string, unknown>;
    expect(out.secret).toBe('[REDACTED]');
    expect(out.self).toBe(out);
  });

  it('handles circular in nested branch', () => {
    const root: Record<string, unknown> = { a: { b: 'c' } };
    (root.a as Record<string, unknown>).loop = root;
    const out = redactPaths(['a.b'])(root) as Record<string, unknown>;
    expect((out.a as Record<string, unknown>).b).toBe('[REDACTED]');
  });

  it('preserves unrelated deep objects', () => {
    const input = { one: { two: { three: 'ok' } }, keep: { x: 1 } };
    const out = redactPaths(['one.two.three'])(input) as Record<string, unknown>;
    expect(((out.one as Record<string, unknown>).two as Record<string, unknown>).three).toBe('[REDACTED]');
    expect((out.keep as Record<string, unknown>).x).toBe(1);
  });

  it('handles large object graph', () => {
    const input: Record<string, unknown> = { data: {} };
    let cursor = input.data as Record<string, unknown>;
    for (let i = 0; i < 30; i += 1) {
      cursor.next = { value: i };
      cursor = cursor.next as Record<string, unknown>;
    }
    const out = redactPaths(['data.next.value'])(input) as Record<string, unknown>;
    expect(((out.data as Record<string, unknown>).next as Record<string, unknown>).value).toBe('[REDACTED]');
  });

  it('skips when leaf key does not exist', () => {
    const input = { user: { name: 'A' } };
    const out = redactPaths(['user.ssn'])(input) as { user: { name: string } };
    expect(out.user.name).toBe('A');
  });
});
