---
version: 2
name: cross-cutting-deserialization-failures-malformed-recor-9e93
description: "Input Deserialization via JSON.parse: Deserialization Failures Malformed Record Structures Captured"
metadata:
  actual:
    adr_id: 9e934c5d-33a1-4cbc-81bc-3b4d9e07b6a6
    status: accepted
    candidate_group_id: 532ecfdb-96e8-4756-a794-f0b5071de4e4
    evidence:
      source: deep
  scope:
    root: .
    paths:
      - RaceBand/**
---

# Input Deserialization via JSON.parse: Deserialization Failures Malformed Record Structures Captured

Scope: applies to `RaceBand/**`.

These rules are ALWAYS ACTIVE for handling and parsing of unvalidated raw string inputs and serialized payloads from external streams or runtime boundaries.

### Rules

- **R-DESER-001** SHOULD: Deserialization failures and malformed record structures SHOULD be captured and logged as diagnostic warnings or errors without terminating the application execution loop.
- **R-DESER-002** MANDATORY: Wrap all native parsing invocations within structured error boundaries and route failures to diagnostic logging.
- **R-DESER-003** MANDATORY: Perform sequential validation checks on input segments before deserialization to verify expected minimum field counts.
- **R-DESER-004** MANDATORY: Execute discovery of the project dependency manifest, build tool, and lock/resolution artifact to determine exact resolved versions before writing code using a versioned library.

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