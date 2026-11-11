---
version: 2
name: cross-cutting-consumer-discover-project-dependency-loc-5117
description: "requests HTTP Client Integration with Explicit Timeouts: Consumer Discover Project Dependency Lock Artifact"
metadata:
  actual:
    adr_id: 5117eb19-ac0f-4cdb-add5-a07ede6f11d5
    status: accepted
    candidate_group_id: 09d33451-00f3-41ea-88b0-a91f38e0cc3d
    evidence:
      source: deep
  scope:
    root: .
    paths:
      - LCD Build4/**
---

# requests HTTP Client Integration with Explicit Timeouts: Consumer Discover Project Dependency Lock Artifact

Scope: applies to `LCD Build4/**`.

These rules are ALWAYS ACTIVE for outbound HTTP network requests dispatched to external service endpoints and client boundary integrations communicating over network protocols.

### Rules

- **R-REQ-001** MUST: The consumer MUST discover the project dependency lock artifact and verify the exact resolved version of requests prior to implementation.
- **R-REQ-002** MUST: Ensure every invocation of requests.get passes an explicit numeric timeout value to prevent infinite socket wait states.
- **R-REQ-003** MUST: Handle HTTP response parsing and network exceptions at the boundary prior to forwarding data to downstream components.

### Verify

```bash
# Discover and run the project static analysis and linting suite to detect any outbound HTTP calls lacking explicit timeout parameters.
# Discover and run unit tests that mock external HTTP boundary responses to verify timeout and failure recovery behavior.
```

**Accept when:**
- Static verification confirms all external HTTP invocations specify explicit timeout parameters.
- Test execution passes with full coverage of network failure and timeout paths without regressions.

<enforcement>
Claude Code MUST NOT skip or defer verification. Automated static analysis and peer code reviews enforce compliance.
</enforcement>