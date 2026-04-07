// Copyright (c) 2026 Aistrateg Malmö AB. Licensed under BUSL-1.1.
function cloneValue<T>(value: T, seen: WeakMap<object, unknown>): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value as object)) {
    return seen.get(value as object) as T;
  }

  if (Array.isArray(value)) {
    const arr: unknown[] = [];
    seen.set(value, arr);
    for (const item of value) {
      arr.push(cloneValue(item, seen));
    }
    return arr as T;
  }

  const obj: Record<string, unknown> = {};
  seen.set(value as object, obj);
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    obj[k] = cloneValue(v, seen);
  }
  return obj as T;
}

function setByPath(target: unknown, path: string[]): void {
  if (target === null || typeof target !== 'object') {
    return;
  }

  let cursor: unknown = target;
  for (let i = 0; i < path.length - 1; i += 1) {
    if (cursor === null || typeof cursor !== 'object') {
      return;
    }

    const next = (cursor as Record<string, unknown>)[path[i]];
    if (next === null || typeof next !== 'object') {
      return;
    }
    cursor = next;
  }

  if (cursor !== null && typeof cursor === 'object') {
    const leaf = path[path.length - 1];
    if (Object.prototype.hasOwnProperty.call(cursor, leaf)) {
      (cursor as Record<string, unknown>)[leaf] = '[REDACTED]';
    }
  }
}

export function redactPaths(paths: string[]): (input: unknown) => unknown {
  const parsed = paths.map((path) => path.split('.').filter(Boolean)).filter((parts) => parts.length > 0);

  return (input: unknown): unknown => {
    if (input === null || input === undefined) {
      return input;
    }

    const cloned = cloneValue(input, new WeakMap<object, unknown>());
    for (const pathParts of parsed) {
      setByPath(cloned, pathParts);
    }
    return cloned;
  };
}
