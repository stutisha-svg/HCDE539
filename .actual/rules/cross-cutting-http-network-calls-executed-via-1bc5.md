---
version: 2
name: cross-cutting-http-network-calls-executed-via-1bc5
description: "Adoption of requests for Synchronous HTTP Client Communication: Http Network Calls Executed Via Requests"
metadata:
  actual:
    adr_id: 1bc592a7-2ae2-45f4-a34e-3f776d6ff56a
    status: accepted
    candidate_group_id: 28a98258-1e39-4e38-ba1d-3860837761ca
    evidence:
      source: deep
  scope:
    root: .
    paths:
      - LCD Build4/**
---

# Adoption of requests for Synchronous HTTP Client Communication: Http Network Calls Executed Via Requests

Scope: applies to `LCD Build4/**`.

These rules are ALWAYS ACTIVE for all files matching the configured scope.

### Rules

- **R-HTTP-001** MUST: All HTTP network calls executed via requests.get MUST explicitly provide a timeout parameter to prevent indefinite thread blocking.

### Verify

```bash
# Discover and execute the project test runner to validate outbound HTTP client timeout behavior and mock endpoint interactions.
# Discover and run the project linter and static analyzer to verify that all invocations of requests.get specify an explicit timeout argument.
```

**Accept when:**
- All automated test suites pass with simulated external HTTP responses and verified timeout assertions.
- Static analysis confirms zero instances of unconstrained HTTP requests without configured timeouts.

<enforcement>
Claude Code MUST NOT skip or defer verification.
</enforcement>