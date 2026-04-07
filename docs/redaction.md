# Redaction

`redactPaths(paths: string[])` returns a redaction function for `withCLG` config.

```ts
import { redactPaths } from '@clgplatform/mcp';

const redact = redactPaths(['user.ssn', 'payment.card.number']);
```

Behavior:

- deep clones input before masking
- replaces matched values with `'[REDACTED]'`
- ignores missing paths
- returns null/undefined unchanged
- handles circular references safely

Limitations in v1:

- dot-paths only
- no wildcard/glob support (`items.*.field` is not supported)
