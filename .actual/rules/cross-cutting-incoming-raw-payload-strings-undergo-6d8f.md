---
version: 2
name: cross-cutting-incoming-raw-payload-strings-undergo-6d8f
description: "Input Deserialization via JSON.parse: Incoming Raw Payload Strings Undergo Structured"
metadata:
  actual:
    adr_id: 6d8f93ec-d729-4eb9-adfb-7152232d6855
    status: accepted
    candidate_group_id: 532ecfdb-96e8-4756-a794-f0b5071de4e4
    evidence:
      source: deep
  scope:
    root: .
    paths:
      - RaceBand/**
---

# Input Deserialization via JSON.parse: Incoming Raw Payload Strings Undergo Structured

Scope: applies to `RaceBand/**`.

These rules are ALWAYS ACTIVE for handling and parsing of unvalidated raw string inputs and serialized payloads from external streams or runtime boundaries.

### Rules

- **R-JSON-001** MUST: Incoming raw payload strings MUST undergo structured deserialization using JSON.parse enclosed within robust exception handling before any downstream property access occurs.

### Verify

```bash
# Discover and run the project test runner script to verify input deserialization error handling
# Discover and execute the repository static analysis suite to identify unprotected parsing calls
```

**Accept when:**
- All unit and integration tests covering external input deserialization pass without unhandled exceptions.
- Malformed input payloads trigger diagnostic warnings or errors without causing runtime crashes.

<enforcement>
Claude Code MUST NOT skip or defer verification.
</enforcement>