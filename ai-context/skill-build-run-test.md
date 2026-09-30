---
name: erya-names-skill-build-run-test
description: Erya Names local format, typecheck, lint, build, and test preflight contract
version: 0.1.0
status: experimental
owner: personal
last-verified: 2026-09-18
upstream-repo: erya_names

preflight:
  format:
    - cmd: "npm run format:check"
      budget_seconds: 120
      optional: false
  typecheck:
    - cmd: "npm run typecheck"
      budget_seconds: 120
      optional: false
  lint:
    - cmd: "npm run lint"
      budget_seconds: 120
      optional: false
  build:
    - cmd: "npm run build"
      budget_seconds: 300
      optional: false
  test:
    - cmd: "npm test -- --run"
      budget_seconds: 300
      optional: false

success_markers:
  build:
    - "dist/index.html"
  test:
    - "Test Files"
---

# Erya Names Build and Test

This file is the executable preflight contract for `erya_names`. The repository is not a
permanent `lookalike_ai_workbench` repo, so `make preflight` runs the same local buckets
directly instead of depending on temporary workbench registration.

## Verification Buckets

- **format**: `npm run format:check`
- **typecheck**: `npm run typecheck`
- **lint**: `npm run lint`
- **build**: `npm run build`, expected to produce `dist/index.html`
- **test**: `npm test -- --run`, expected to print Vitest test summary
- **browser**: `npm run test:e2e`; Edge is an explicit `npm run test:e2e:edge` gate
- **security**: `npm run quality:security`
- **accessibility**: `npm run test:accessibility` and `npm run quality:lighthouse`
- **performance**: `npm run quality:performance`
- **release artifact**: `npm run release:prepare`, writes `output/release/release-manifest.json`

## Notes

- The repository is a personal project and is not registered in `lookalike_ai_workbench/repos.yaml`.
- `make release-check` runs the local release-quality gates; production corpus and hosted preview gates remain separate because they require human review and external deployment state.
- Generated artifacts such as `dist/`, coverage output, raw corpus cache, and normalized data should not be committed.
