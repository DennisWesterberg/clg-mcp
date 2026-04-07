import { describe, expect, it } from 'vitest';
import { redactPaths } from '../src/index.js';
import { TYPES_MODULE_VERSION } from '../src/types.js';

describe('index exports', () => {
  it('exports redactPaths', () => {
    const fn = redactPaths(['a.b']);
    expect(typeof fn).toBe('function');
  });

  it('exposes runtime type module constant', () => {
    expect(TYPES_MODULE_VERSION).toBe('1.0.0-beta.1');
  });
});
