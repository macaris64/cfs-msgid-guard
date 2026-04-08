# Contributing to cFS MsgID Guard

Thank you for your interest in improving flight software safety. This guide covers everything you need to contribute to cfs-msgid-guard.

---

## Development Setup

### Prerequisites

- **Node.js 20+** (LTS recommended)
- **npm 9+**

### Getting Started

```bash
git clone https://github.com/YOUR_USERNAME/cfs-msgid-guard.git
cd cfs-msgid-guard
npm install
npm test
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm test` | Run all 177 tests with verbose output |
| `npm run test:coverage` | Run tests with 100% coverage enforcement |
| `npm run lint` | ESLint check on `src/` and `__tests__/` |
| `npm run typecheck` | TypeScript strict-mode type checking |
| `npm run build` | Compile to `dist/index.js` via `@vercel/ncc` |

---

## Architecture

The codebase follows a strict pipeline architecture. Each module has a single responsibility and is independently testable.

```
src/
  scanner.ts    File discovery (glob-based)
  parser.ts     #define extraction (regex-based)
  resolver.ts   Channel classification + MsgID computation
  detector.ts   Collision and near-miss detection
  reporter.ts   Job Summary, annotations, JSON artifact
  index.ts      Entry point — wires the pipeline + handles @actions/core I/O
  types.ts      Shared TypeScript interfaces and enums
```

### Data Flow

```
scanFiles() -> parseFiles() -> resolve() -> detect() -> report
     |              |              |             |           |
  ScanResult    ParseResult   ResolvedMsgId[] DetectionResult  Markdown/JSON
```

### Key Design Decisions

- **No C preprocessor emulation**: We parse resolved `DEFAULT_*_TOPICID` constants directly, not arbitrary `#define` chains. This keeps the parser simple and deterministic.
- **2-tier classification**: Tier 1 (header analysis) is authoritative; Tier 2 (naming heuristics) is the fallback. This ensures correctness for standard cFS layouts while still handling apps that lack `*_msgids.h` files.
- **4-channel model**: PLATFORM_CMD, PLATFORM_TLM, GLOBAL_CMD, GLOBAL_TLM. Collisions are detected independently per channel.

---

## Testing Conventions

### Coverage Requirement

The project enforces **100% code coverage** on all library modules (`src/*.ts` except `index.ts`). The threshold is configured in `jest.config.js` and will fail the test run if any metric drops below 100%.

### Test Structure

```
__tests__/
  parser.test.ts       Unit tests for parser.ts
  scanner.test.ts      Unit tests for scanner.ts
  resolver.test.ts     Unit tests for resolver.ts
  detector.test.ts     Unit tests for detector.ts
  reporter.test.ts     Unit tests for reporter.ts
  integration.test.ts  End-to-end pipeline tests
  fixtures/
    real/              Real NASA cFS Draco headers (9 files, 42 topic IDs)
    *.h                Synthetic test fixtures (collision pairs, edge cases)
```

### Writing Tests

- Place unit tests in `__tests__/<module>.test.ts`
- Use real cFS headers from `fixtures/real/` for integration-style assertions
- Create synthetic fixtures for edge cases and error scenarios
- Mock `@actions/core` when testing reporter or index functions
- Every new branch or function must have a corresponding test

### Adding Fixtures

If you need a new test fixture:

1. Create the header file in `__tests__/fixtures/`
2. Follow the `DEFAULT_<NAME>_TOPICID <value>` pattern
3. Add tests that parse and validate the fixture
4. For real cFS headers, place them in `__tests__/fixtures/real/`

---

## Adding Support for New cFS Versions

### New Topic ID Patterns

If a future cFS release changes the `DEFAULT_*_TOPICID` naming convention:

1. Update the `TOPICID_REGEX` in `src/parser.ts`
2. Add new fixture headers reflecting the new pattern
3. Add parser tests to validate extraction

### New Channel Classification Patterns

If new `TOPICID_TO_MIDV` macro styles are introduced:

1. Add new regex patterns in `src/resolver.ts`
2. Create fixture `*_msgids.h` and `*_msgid_values.h` files
3. Add resolver tests to validate classification

### EDS (Electronic Data Sheets) Support

cFS is transitioning toward EDS/CCSDS-based configurations. To add EDS support:

1. Create a new parser module (`src/eds-parser.ts`) that extracts topic IDs from XML/JSON EDS files
2. Extend `scanner.ts` to discover EDS definition files
3. Feed the parsed entries into the existing resolver/detector pipeline
4. Add a new input parameter to `action.yml` for EDS patterns

---

## Pull Request Process

1. **Fork** the repository and create a feature branch from `main`
2. **Write tests first** for any new functionality
3. Ensure `npm test`, `npm run lint`, and `npm run typecheck` all pass
4. Ensure `npm run test:coverage` reports 100% coverage
5. Run `npm run build` and commit the updated `dist/index.js`
6. Open a PR with a clear description of the change and its motivation

### Commit Messages

Use clear, imperative-tense commit messages:

```
Add near-miss detection for GLOBAL_TLM channel
Fix parser edge case with multi-line #define continuation
Update cFS Draco fixture headers to v7.0
```

### What We Review

- Correctness against real cFS header patterns
- Test coverage (must remain at 100%)
- No regressions in existing collision detection
- Clean TypeScript types (no `any` casts)
- Performance (parsing thousands of headers should remain under 1 second)

---

## Reporting Issues

See the [issue templates](https://github.com/YOUR_USERNAME/cfs-msgid-guard/issues/new/choose) for:

- **Bug reports**: Include your cFS version, the topic ID headers involved, and the Job Summary output
- **Feature requests**: Describe the use case and which cFS configurations are affected

---

## License

By contributing, you agree that your contributions will be licensed under the Apache-2.0 License.
