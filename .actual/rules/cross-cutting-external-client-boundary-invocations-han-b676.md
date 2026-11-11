---
version: 2
name: cross-cutting-external-client-boundary-invocations-han-b676
description: "requests HTTP Client Integration with Explicit Timeouts: External Client Boundary Invocations Handle Network"
metadata:
  actual:
    adr_id: b676738e-8032-4ad8-9778-2a8d6271ce3f
    status: accepted
    candidate_group_id: 09d33451-00f3-41ea-88b0-a91f38e0cc3d
    evidence:
      source: deep
  scope:
    root: .
    paths:
      - LCD Build4/**
---

# requests HTTP Client Integration with Explicit Timeouts: External Client Boundary Invocations Handle Network

Scope: applies to `LCD Build4/**`.

These rules are ALWAYS ACTIVE for all files matching the configured scope.

### Rules

- **R-HTTP-001** SHOULD: External client boundary invocations SHOULD handle network timeout and connection exceptions locally to prevent unhandled process termination.

### Verify

```bash
# Discover and run the project static analysis and linting suite to detect any outbound HTTP calls lacking explicit timeout parameters.
# Discover and run unit tests that mock external HTTP boundary responses to verify timeout and failure recovery behavior.
```

**Accept when:**
- Static verification confirms all external HTTP invocations specify explicit timeout parameters.
- Test execution passes with full coverage of network failure and timeout paths without regressions.

<enforcement>
Claude Code MUST NOT skip or defer verification.
</enforcement>