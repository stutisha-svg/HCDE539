---
version: 2
name: cross-cutting-before-introducing-external-dependencies-1987
description: "Input Deserialization via JSON.parse: Before Introducing External Dependencies Payload Validation"
metadata:
  actual:
    adr_id: 198741a7-5cf5-427d-9272-236ddad3f87e
    status: accepted
    candidate_group_id: 532ecfdb-96e8-4756-a794-f0b5071de4e4
    evidence:
      source: deep
  scope:
    root: .
    paths:
      - RaceBand/**
---

# Input Deserialization via JSON.parse: Before Introducing External Dependencies Payload Validation

Scope: applies to `RaceBand/**`.

These rules are ALWAYS ACTIVE for handling and parsing of unvalidated raw string inputs and serialized payloads from external streams or runtime boundaries.

### Rules

- **R-INPUT-001** MUST: Before introducing external dependencies for payload validation, developers MUST discover the project dependency manifest and resolve the exact locked versions through the repository lock artifact.
- **R-INPUT-002** MUST: Wrap all native parsing invocations within structured error boundaries and route failures to diagnostic logging.
- **R-INPUT-003** MUST: Perform sequential validation checks on input segments before deserialization to verify expected minimum field counts.

### Verify

```bash
# Discover and run the project test runner script to verify input deserialization error handling
# Discover and execute the repository static analysis suite to identify unprotected parsing calls
```

**Accept when:**
- All unit and integration tests covering external input deserialization pass without unhandled exceptions.
- Malformed input payloads trigger diagnostic warnings or errors without causing runtime crashes.

<enforcement>
Claude Code MUST NOT skip or defer verification. Verification is mandatory.
</enforcement>