---
version: 2
name: cross-cutting-external-client-integrations-not-execute-93b8
description: "requests HTTP Client Integration with Explicit Timeouts: External Client Integrations Not Execute Blocking"
metadata:
  actual:
    adr_id: 93b80b07-c4b9-4c22-a8b6-e348f723f65c
    status: accepted
    candidate_group_id: 09d33451-00f3-41ea-88b0-a91f38e0cc3d
    evidence:
      source: deep
  scope:
    root: .
    paths:
      - LCD Build4/**
---

# requests HTTP Client Integration with Explicit Timeouts: External Client Integrations Not Execute Blocking

Scope: applies to `LCD Build4/**`.

These rules are ALWAYS ACTIVE for all files matching the configured scope.

### Rules

- **R-EXT-001** MUST_NOT: External client integrations MUST_NOT execute blocking HTTP requests without specifying an explicit timeout value.

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