---
version: 2
name: cross-cutting-before-implementing-image-processing-com-37bb
description: "PIL Library Adoption: Before Implementing Image Processing Components That"
metadata:
  actual:
    adr_id: 37bb4e63-c9e9-486e-bcf7-d6d8ab84570e
    status: accepted
    candidate_group_id: f59fdeca-6ba7-45a4-8c55-52afcd3ee0cd
    evidence:
      source: deep
  scope:
    root: .
    paths:
      - LCD Build4/**
---

# PIL Library Adoption: Before Implementing Image Processing Components That

Scope: applies to `LCD Build4/**`.

These rules are ALWAYS ACTIVE for components responsible for ingesting remote image assets and transforming raw bytes into display-compatible matrices.

### Rules

- **R-PIL-001** MUST: Before implementing image processing components that rely on versioned imaging libraries, developers MUST inspect the repository dependency manifest and lock artifacts to resolve the exact locked version and verify API compatibility against authoritative public references.
- **R-PIL-002** MANDATORY: Execute lock-version grounding (find manifest, identify build tool, inspect lock artifact for resolved version, look up official documentation for that exact version, confirm APIs exist, and re-run per dependency at point of use) before writing code that uses a versioned library.
- **R-PIL-003** MANDATORY: Ensure that incoming network response content is passed as raw bytes to the in-memory stream container rather than decoded text strings.
- **R-PIL-004** MANDATORY: Perform color mode conversions immediately after image initialization to establish a consistent data structure before pixel-level iteration.

### Verify

```bash
# Discover the project verification script from the repository manifest and execute the test suite
# Inspect the project dependency configuration to verify imaging library dependencies
```

**Accept when:**
- Image transformation routines decode byte streams and output normalized RGBA pixel arrays without raising exceptions.
- Automated test suites pass without referencing temporary filesystem paths for graphical asset processing.

<enforcement>
Claude Code MUST NOT skip or defer verification. Automated test suites validating in-memory image conversion contracts and peer code reviews enforce compliance; pull requests introducing direct disk writes or undeclared imaging utilities are blocked until remediated.
</enforcement>