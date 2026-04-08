---
name: Bug Report
about: Report incorrect collision detection, missed collisions, or action failures
title: "[BUG] "
labels: bug
assignees: ''
---

## Description

A clear description of the bug.

## Environment

- **cFS version/branch**: (e.g., Draco, Caelum, custom fork)
- **cfs-msgid-guard version**: (e.g., v1.0.0)
- **Runner OS**: (e.g., ubuntu-latest)

## Steps to Reproduce

1. Workflow configuration (paste your `uses:` step with inputs)
2. Relevant topic ID headers (paste the `#define` lines involved)

## Expected Behavior

What you expected the action to report.

## Actual Behavior

What the action actually reported. Include:

- Job Summary output (if available)
- PR annotation text
- Error messages from the workflow log

## Topic ID Headers

Paste the relevant `*_topicids.h` content:

```c
/* Example */
#define DEFAULT_MY_APP_MISSION_CMD_TOPICID 0x82
```

## Additional Context

Any other information that might help diagnose the issue (custom base addresses, non-standard directory layout, etc.).
