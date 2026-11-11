---
version: 2
name: cross-cutting-network-call-responses-retrieved-through-ad7b
description: "Adoption of requests for Synchronous HTTP Client Communication: Network Call Responses Retrieved Through Requests"
metadata:
  actual:
    adr_id: ad7b80fe-1835-4134-a4ff-9998f587f8b9
    status: accepted
    candidate_group_id: 28a98258-1e39-4e38-ba1d-3860837761ca
    evidence:
      source: deep
  scope:
    root: .
    paths:
      - LCD Build4/**
---

# Adoption of requests for Synchronous HTTP Client Communication: Network Call Responses Retrieved Through Requests

Scope: applies to `LCD Build4/**`.

These rules are ALWAYS ACTIVE for all files matching the configured scope.

### Rules

- **R-REQ-001** MUST: Network call responses retrieved through requests MUST be validated for status codes and payload integrity prior to downstream processing.

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