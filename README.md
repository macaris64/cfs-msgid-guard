# cFS MsgID Guard (`cfs-msgid-guard`)

Prevent **silent runtime failures** caused by cFS **MsgID collisions**.

[![CI](https://github.com/macaris64/cfs-msgid-guard/actions/workflows/ci.yml/badge.svg)](https://github.com/macaris64/cfs-msgid-guard/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)](https://github.com/macaris64/cfs-msgid-guard)
[![npm](https://img.shields.io/npm/v/cfs-msgid-guard)](https://www.npmjs.com/package/cfs-msgid-guard)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)
[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-cFS%20MsgID%20Guard-blue?logo=github)](https://github.com/marketplace/actions/cfs-msgid-guard)

cFS apps define numeric **Topic IDs** across many `*_topicids.h` headers. If two apps reuse the same Topic ID **in the same channel**, the computed MsgIDs collide and the Software Bus can misroute messages **with no compile-time error**. `cfs-msgid-guard` scans your mission, computes MsgIDs, and reports collisions as **PR annotations** and a **Job Summary**.

---

## Quick start (30 seconds)

### Run locally (no install)

```bash
npx cfs-msgid-guard --scan-path .
```

### Install (dev dependency)

```bash
npm i -D cfs-msgid-guard
npx cfs-msgid-guard --scan-path .
```

### Run in CI (GitHub Actions)

Add `.github/workflows/msgid-check.yml`:

```yaml
name: MsgID collision check
on: [push, pull_request]

jobs:
  msgid-guard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: true

      - uses: macaris64/cfs-msgid-guard@v1
        with:
          fail-on-collision: 'true'
          near-miss-gap: '2'
```

---

## Usage

### CLI examples

```bash
# Basic scan
npx cfs-msgid-guard --scan-path .

# If your headers live under specific subtrees
npx cfs-msgid-guard --scan-path apps --topicid-pattern '**/fsw/inc/*_topicids.h'

# Add near-miss warnings (IDs within N of each other, per channel)
npx cfs-msgid-guard --scan-path . --near-miss-gap 3

# Machine-readable output
npx cfs-msgid-guard --scan-path . --format json

# CI-friendly (no ANSI), but still return success even if collisions exist
npx cfs-msgid-guard --scan-path . --no-color --no-fail-on-collision
```

### GitHub Actions examples

#### Typical cFS mission repo

```yaml
- uses: macaris64/cfs-msgid-guard@v1
  with:
    scan-paths: '.'
    topicid-pattern: '**/*_topicids.h'
    msgid-pattern: '**/*_msgids.h'
    fail-on-collision: 'true'
    near-miss-gap: '0'
    report-format: 'both'
```

#### Consume JSON output (`allocation-map`)

```yaml
- uses: macaris64/cfs-msgid-guard@v1
  id: guard
  with:
    report-format: 'json'
    fail-on-collision: 'false'

- name: Print summary
  run: |
    echo '${{ steps.guard.outputs.allocation-map }}' | jq '.summary'
```

---

## Configuration: how it finds headers (and what it expects)

### 1) What gets scanned

- **Root(s)**:
  - **CLI**: `--scan-path <path>` (single root)
  - **Action**: `scan-paths` (comma-separated roots)
- **Topic ID headers**:
  - **CLI**: `--topicid-pattern` (default `**/*_topicids.h`)
  - **Action**: `topicid-pattern` (default `**/*_topicids.h`)
  - The parser looks for:

```c
#define DEFAULT_<NAME>_TOPICID <hex_or_decimal>
```

- **MsgID headers (Tier-1 channel classification)**:
  - **CLI**: `--msgid-pattern` (default `**/*_msgids.h`)
  - **Action**: `msgid-pattern` (default `**/*_msgids.h`)
  - From `msgid-pattern`, the scanner also derives a sibling pattern for `*_msgid_values.h`.

### 2) How MsgIDs are computed

`cfs-msgid-guard` computes:

```
Final MsgID = Base | TopicID
```

Topic IDs are collision-checked **within each of the four channels**.

### 3) Where base addresses come from

Base addresses come from (highest priority first):

1. **Explicit overrides** (CLI flags / Action inputs): `cmd-base`, `tlm-base`, `global-cmd-base`, `global-tlm-base`
2. **Auto-detected mapping header**: `default_cfe_core_api_msgid_mapping.h` (if present anywhere under your scan roots)
3. **Built-in defaults**:
   - `PLATFORM_CMD`: `0x1800`
   - `PLATFORM_TLM`: `0x0800`
   - `GLOBAL_CMD`: `0x1860`
   - `GLOBAL_TLM`: `0x0860`

### 4) Expected project structure (minimal)

You don’t need a special layout—just ensure the scan root(s) include your headers:

```text
<mission_root>/
  apps/
    <app>/
      fsw/inc/<app>_topicids.h
  ...
  cfe/
    ... *_msgids.h
    ... *_msgid_values.h
  ...
```

---

## Visual feedback

### Terminal example (collision detected)

Representative CLI output:

```text
cfs-msgid-guard — Message ID Collision Detector

[1/5] Scanning .
      Found: 12 topic ID files, 18 msgid files, 9 msgid_values files
      Base mapping: default_cfe_core_api_msgid_mapping.h
[2/5] Parsing topic ID definitions...
      84 definitions from 12 files
[3/5] Resolving channels and computing MsgIDs...
      84 resolved (70 header, 14 heuristic)
[4/5] Detecting collisions (near-miss gap: 2)...
      1 COLLISION(S)
[5/5] Report

  COLLISIONS
  PLATFORM_CMD  TopicID=0x0082  MsgID=0x1882
    → APP_A (APP_A_MISSION_CMD) at app_a_topicids.h:42
    → APP_B (APP_B_MISSION_CMD) at app_b_topicids.h:17

  Result: FAIL — 1 collision(s) in 84 topics
```

### PR annotation example (GitHub Actions)

On pull requests, the Action emits file/line annotations similar to:

```text
MsgID Collision (error)
MsgID collision on Platform Command channel: topic ID 0x0082 -> MsgID 0x1882 is claimed by APP_A, APP_B
at apps/app_a/fsw/inc/app_a_topicids.h:42
```

---

## GitHub Action inputs / outputs

### Inputs

| Input | Description | Default |
|---|---|---|
| `scan-paths` | Root directories to scan (comma-separated) | `.` |
| `topicid-pattern` | Glob pattern(s) for topic ID headers (comma-separated) | `**/*_topicids.h` |
| `msgid-pattern` | Glob pattern(s) for MsgID headers (comma-separated) | `**/*_msgids.h` |
| `cmd-base` | Platform command MsgID base address | `0x1800` |
| `tlm-base` | Platform telemetry MsgID base address | `0x0800` |
| `global-cmd-base` | Global command MsgID base address | `0x1860` |
| `global-tlm-base` | Global telemetry MsgID base address | `0x0860` |
| `fail-on-collision` | Fail the workflow if a collision is detected | `true` |
| `near-miss-gap` | Warn about topic IDs within N of each other (0 to disable) | `0` |
| `report-format` | Output format: `summary`, `json`, or `both` | `both` |

### Outputs

| Output | Description |
|---|---|
| `collision-count` | Number of collisions found |
| `has-collisions` | `true` if any collisions were found |
| `allocation-map` | JSON string containing summary + full allocation map |

---

## Troubleshooting

- **No topic ID files found**
  - Check you’re scanning the right root (`--scan-path` / `scan-paths`).
  - Tighten or loosen `--topicid-pattern` / `topicid-pattern`.

- **Lots of heuristic (Tier-2) classification**
  - Ensure your `*_msgids.h` headers are included by `--msgid-pattern` / `msgid-pattern`.
  - If your repo uses different filenames, set a custom `msgid-pattern`.

- **Different base addresses than the defaults**
  - Prefer committing a correct `default_cfe_core_api_msgid_mapping.h` under the scan roots.
  - Or override bases via CLI flags / Action inputs.

---

## Developer / contributor docs

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for development setup, testing, building `dist/`, and release details.

---

## License

Apache-2.0. See [LICENSE](LICENSE) for details.
