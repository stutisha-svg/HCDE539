---
version: 2
name: cross-cutting-before-implementing-modifying-client-cal-860e
description: "Adoption of requests for Synchronous HTTP Client Communication: Before Implementing Modifying Client Calls Requests"
metadata:
  actual:
    adr_id: 860e1b98-e270-4b80-826c-1ed8e74fa45a
    status: accepted
    candidate_group_id: 28a98258-1e39-4e38-ba1d-3860837761ca
    evidence:
      source: deep
  scope:
    root: .
    paths:
      - LCD Build4/**
---

# Adoption of requests for Synchronous HTTP Client Communication: Before Implementing Modifying Client Calls Requests

Scope: applies to `LCD Build4/**`.

These rules are ALWAYS ACTIVE for all files matching the configured scope.

### Rules

- **R-REQ-001** MUST: Before implementing or modifying client calls using requests, consumers MUST discover the project dependency lock artifact and verify the exact resolved version against public documentation.

### Verify

```bash
# Discover and execute the project test runner to validate outbound HTTP client timeout behavior and mock endpoint interactions.
# Discover and run the project linter and static analyzer to verify that all invocations of requests.get specify an explicit timeout argument.
```

**Accept when:**
- All automated test suites pass with simulated external HTTP responses and verified timeout assertions.
- Static analysis confirms zero instances of unconstrained HTTP requests without configured timeouts.

<enforcement>
Claude Code MUST NOT skip or defer verification. Verification is mandatory.
</enforcement>