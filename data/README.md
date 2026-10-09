# Data workspace

This directory contains the build-time corpus workspace. Application runtime data remains under
`src/data/`, and the pipeline implementation remains under `scripts/data/`.

## Directory roles

- `sources/`: version-controlled source contracts, licenses, checksums, pinned evidence snapshots,
  and curated personal inputs. `sources/personal/*-allusions.tsv` and matching evidence JSON are
  durable selected-name inputs; normal builds read them directly and do not re-extract names from
  the upstream corpus.
- `cache/`: ignored upstream snapshots produced by `npm run data:fetch`.
- `normalized/`: ignored normalized corpus produced by `npm run data:build-review-queue`.
- `review/`: review schemas and human decisions; generated `queue/` and `output/` are ignored.
- `audit/`: ignored release and generation audit reports.

Source contracts and human review decisions are durable inputs. Cached, normalized, queued, output,
and audit data are reproducible intermediates and must not be committed.
