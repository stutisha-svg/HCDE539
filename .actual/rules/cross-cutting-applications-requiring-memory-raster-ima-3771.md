---
version: 2
name: cross-cutting-applications-requiring-memory-raster-ima-3771
description: "PIL Library Adoption: Applications Requiring Memory Raster Image Transformation"
metadata:
  actual:
    adr_id: 3771b773-aaf2-4889-a01c-612fa7027b22
    status: accepted
    candidate_group_id: f59fdeca-6ba7-45a4-8c55-52afcd3ee0cd
    evidence:
      source: deep
  scope:
    root: .
    paths:
      - LCD Build4/**
---

# PIL Library Adoption: Applications Requiring Memory Raster Image Transformation

Scope: applies to `LCD Build4/**`.

These rules are ALWAYS ACTIVE for components responsible for ingesting remote image assets and transforming raw bytes into display-compatible matrices.

### Rules

- **R-PIL-001** MUST: Applications requiring in-memory raster image transformation MUST adopt PIL as the standard imaging library for decoding raw binary streams and standardizing pixel channel layouts.
- **R-PIL-002** MUST: Incoming network response content MUST be passed as raw bytes to the in-memory stream container rather than decoded text strings.
- **R-PIL-003** MUST: Color mode conversions MUST be performed immediately after image initialization to establish a consistent data structure before pixel-level iteration.

### Verify

```bash
# Discover the project verification script from the repository manifest and execute tests
# Inspect the project dependency configuration to verify imaging library dependency is declared and locked
```

**Accept when:**
- Image transformation routines decode byte streams and output normalized RGBA pixel arrays without raising exceptions.
- Automated test suites pass without referencing temporary filesystem paths for graphical asset processing.

<enforcement>
Claude Code MUST NOT skip or defer verification.
</enforcement>