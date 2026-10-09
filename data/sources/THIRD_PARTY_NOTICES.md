# Third-party data notices

Production data may be built only from the pinned, verified source contracts in `sources/*.yaml`.

- `pinyin-data` - MIT, copyright mozillazg.
- `phrase-pinyin-data` - MIT, copyright mozillazg.
- `OpenCC` - Apache-2.0, copyright OpenCC contributors.
- `chinese-poetry` - MIT, copyright JackeyGao and contributors.
- `Chinese Wikisource` pinned excerpt snapshots - CC BY-SA 4.0, attributed to
  Chinese Wikisource contributors. Exact page revision URLs and local snapshot
  checksums are recorded in `sources/wikisource-*.yaml`; Simplified Chinese
  normalization and editorial interpretation are adaptations distributed under
  the same license.
- `Wikidata` bounded historical-person snapshot - CC0 1.0; only a reviewed QID
  allowlist is stored, and historical identity never contributes to name score.
- `Chinese Wikipedia` pinned Qing palace-exam list excerpts - CC BY-SA 4.0,
  attributed to Chinese Wikipedia contributors. Each record links to the exact
  page revision used to verify its year, examination and palace-exam rank.
- `manual-imperial-exam-curation` - project-authored factual record structure
  under CC0 1.0; linked evidence pages retain their own terms and are not copied.
- `erya-character-elements-20260930` - project-authored semantic-imagery
  classification under CC0 1.0; traditional folklore reference, not a unique authoritative table.
- `standard-hanzi-2013` - official public document used as the normative character reference.
- `lunar-typescript` 1.8.6 - MIT, used locally for four-pillar and five-element calculation.

Exact commits or page revisions, license-file hashes and selected input hashes are recorded in each YAML contract. Raw Git caches are not redistributed; pinned Wikisource excerpts are committed for offline verification. Reviewed derived records retain source IDs and locations.
