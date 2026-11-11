---
version: 2
name: cross-cutting-image-representations-ingested-external-7460
description: "PIL Library Adoption: Image Representations Ingested External Network Sources"
metadata:
  actual:
    adr_id: 7460ed98-67b6-4a9a-b09e-edcc207eff3f
    status: accepted
    candidate_group_id: f59fdeca-6ba7-45a4-8c55-52afcd3ee0cd
    evidence:
      source: deep
  scope:
    root: .
    paths:
      - LCD Build4/**
---

# PIL Library Adoption: Image Representations Ingested External Network Sources

Scope: applies to `LCD Build4/**`.

These rules are ALWAYS ACTIVE for components responsible for ingesting remote image assets and transforming raw bytes into display-compatible matrices.

### Rules

- **R-PIL-001** SHOULD: Image representations ingested from external network sources SHOULD be normalized using convert with RGBA color mode before downstream pixel sampling or character matrix transformation.
- **R-PIL-002** MANDATORY: Incoming network response content MUST be passed as raw bytes to the in-memory stream container rather than decoded text strings.
- **R-PIL-003** MANDATORY: Perform color mode conversions immediately after image initialization to establish a consistent data structure before pixel-level iteration.

### Verify

```bash
# Discover the project verification script from the repository manifest and execute the test suite to validate image conversion routines.
# Inspect the project dependency configuration to verify that the imaging library dependency is declared and locked.
```

**Accept when:**
- Image transformation routines decode byte streams and output normalized RGBA pixel arrays without raising exceptions.
- Automated test suites pass without referencing temporary filesystem paths for graphical asset processing.

<enforcement>
Claude Code MUST NOT skip or defer verification.
</enforcement>