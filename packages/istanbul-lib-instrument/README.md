# @vitest/istanbul-lib-instrument

[![Build Status](https://img.shields.io/github/actions/workflow/status/vitest-dev/istanbuljs/ci.yml?label=CI&logo=GitHub)](https://github.com/vitest-dev/istanbuljs/actions/workflows/ci.yml)

Istanbul instrumenter library. The code is parsed with [OXC](https://oxc.rs) (via `rolldown`) and
coverage counters are inserted into the original code with `magic-string`, so the output keeps the
original formatting, comments and line numbers.

```ts
import { createInstrumenter } from "@vitest/istanbul-lib-instrument";

const instrumenter = createInstrumenter({ esModules: true, produceSourceMap: true });
const code = instrumenter.instrumentSync(source, filename, inputSourceMap);
const coverage = instrumenter.lastFileCoverage();
const map = instrumenter.lastSourceMap();
```
