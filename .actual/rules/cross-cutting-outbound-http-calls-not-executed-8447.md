---
version: 2
name: cross-cutting-outbound-http-calls-not-executed-8447
description: "Adoption of requests for Synchronous HTTP Client Communication: Outbound Http Calls Not Executed Without"
metadata:
  actual:
    adr_id: 8447976c-ccad-4475-af97-3a3a75c5bcc0
    status: accepted
    candidate_group_id: 28a98258-1e39-4e38-ba1d-3860837761ca
    evidence:
      source: deep
  scope:
    root: .
    paths:
      - LCD Build4/**
---

# Adoption of requests for Synchronous HTTP Client Communication: Outbound Http Calls Not Executed Without

Scope: applies to `LCD Build4/**`.

These rules are ALWAYS ACTIVE for all files matching the configured scope.

### Rules

- **R-HTTP-001** MUST: Outbound HTTP calls MUST NOT be executed without exception handling around network transport errors and request timeouts.

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