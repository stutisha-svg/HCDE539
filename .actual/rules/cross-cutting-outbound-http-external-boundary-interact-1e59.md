---
version: 2
name: cross-cutting-outbound-http-external-boundary-interact-1e59
description: "requests HTTP Client Integration with Explicit Timeouts: Outbound Http External Boundary Interactions Use"
metadata:
  actual:
    adr_id: 1e5910d7-ae7d-46bc-a760-886f0becaa71
    status: accepted
    candidate_group_id: 09d33451-00f3-41ea-88b0-a91f38e0cc3d
    evidence:
      source: deep
  scope:
    root: .
    paths:
      - LCD Build4/**
---

# requests HTTP Client Integration with Explicit Timeouts: Outbound Http External Boundary Interactions Use

Scope: applies to `LCD Build4/**`.

These rules are ALWAYS ACTIVE for outbound HTTP network requests and client boundary integrations communicating over network protocols.

### Rules

- **R-HTTP-001** MUST: Outbound HTTP external boundary interactions MUST use requests.get with an explicit timeout parameter specified on every network call.

### Verify

```bash
# Discover and run project static analysis / linting suite for outbound HTTP calls lacking explicit timeout parameters
# Discover and run unit tests mocking external HTTP boundary responses to verify timeout and failure recovery behavior
```

**Accept when:**
- Static verification confirms all external HTTP invocations specify explicit timeout parameters.
- Test execution passes with full coverage of network failure and timeout paths without regressions.

<enforcement>
Claude Code MUST NOT skip or defer verification. Verified by automated static analysis checks in CI pipelines and peer code review.
</enforcement>