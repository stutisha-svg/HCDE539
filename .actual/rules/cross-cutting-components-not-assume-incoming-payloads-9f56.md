---
version: 2
name: cross-cutting-components-not-assume-incoming-payloads-9f56
description: "Input Deserialization via JSON.parse: Components Not Assume Incoming Payloads Are"
metadata:
  actual:
    adr_id: 9f56378f-d84d-450b-914f-96edf02592f7
    status: accepted
    candidate_group_id: 532ecfdb-96e8-4756-a794-f0b5071de4e4
    evidence:
      source: deep
  scope:
    root: .
    paths:
      - RaceBand/**
---

# Input Deserialization via JSON.parse: Components Not Assume Incoming Payloads Are

Scope: applies to `RaceBand/**`.

These rules are ALWAYS ACTIVE for handling and parsing of unvalidated raw string inputs and serialized payloads from external streams or runtime boundaries.

### Rules

- **R-IDP-001** MUST_NOT: Components MUST_NOT assume incoming payloads are structurally valid without verifying expected field counts and boundary constraints.

### Verify

```bash
# Discover and run the project test runner script to verify input deserialization error handling.
# Discover and execute the repository static analysis suite to identify unprotected parsing calls.
```

**Accept when:**
- All unit and integration tests covering external input deserialization pass without unhandled exceptions.
- Malformed input payloads trigger diagnostic warnings or errors without causing runtime crashes.

<enforcement>
Claude Code MUST NOT skip or defer verification.
</enforcement>