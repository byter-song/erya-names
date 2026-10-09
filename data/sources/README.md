# Data Sources

This directory records source metadata for Erya Names V1 data preparation.

## Policy

- Only public-domain, official open data, or clearly redistributable sources may enter the release bundle.
- Raw upstream snapshots are stored in local cache directories, not committed.
- Curated release data must keep source, license, version, checksum, review status, and review notes.
- Research-only and rejected sources may guide manual review but must not be bundled into the app.
- Curated personal allusion TSV/JSON pairs and `snapshots/` are version-controlled source-of-truth
  inputs. Runtime builds consume these selected records directly; they do not regenerate selected
  two-character names from raw caches.
- `personal/standard-character-pinyin.json` is the committed 8,105-character pinyin SSOT. Use
  `npm run data:build-standard-pinyin` to derive the runtime copy; only
  `--refresh-source` intentionally rereads the fixed upstream cache.
- `personal/traditional-to-simplified.json` is the committed OpenCC-derived character mapping.
  The original source snapshot may remain traditional, while selected names and every product-facing
  field are converted to Simplified Chinese before validation and display.

## Executable source contract

Executable sources are defined one per file in `sources/*.yaml`. Git contracts pin a repository
commit; snapshot contracts pin committed evidence, upstream revision URLs, licenses and hashes.
`releaseEligible` and `personalEligible` are separate gates, so source-checked personal material
cannot be mistaken for production-reviewed content.

```bash
npm run data:fetch -- pinyin-data phrase-pinyin-data opencc chinese-poetry
npm run data:verify-sources
```

`data:fetch` is idempotent. Git sources are cloned into a sibling temporary directory and promoted
only after commit/hash verification. Committed snapshot sources are verified in place and never
rewritten during a normal build. `data:verify-sources -- --remote` is an explicit maintenance check
for pinned upstream revisions; it is not a build dependency.

For `chinese-poetry`, only the files listed in its YAML contract are accepted as review input. The MIT raw corpus does not make automatically extracted name fragments reviewed; each released allusion still requires context, semantic and risk decisions.

## Included Source Decisions

| Source                               | Decision    | Reason                                                                       |
| ------------------------------------ | ----------- | ---------------------------------------------------------------------------- |
| `standard-hanzi-2013`                | accepted    | Official standard used for L1 character checks                               |
| `pinyin-data`                        | accepted    | MIT pinyin data candidate                                                    |
| `phrase-pinyin-data`                 | accepted    | MIT phrase pinyin data candidate                                             |
| `opencc`                             | accepted    | Apache-2.0 conversion tool candidate                                         |
| `chinese-poetry`                     | accepted    | MIT source for raw cache; curated excerpts still need review                 |
| `wikidata-person-usage`              | accepted    | CC0 candidate for person usage evidence                                      |
| `wikipedia-imperial-exam`            | accepted    | Pinned CC BY-SA revisions for exact Qing exam year and palace-exam rank      |
| `manual-imperial-exam-curation`      | accepted    | Small manually sourced records; each rank is explicit                        |
| `cbdb-research-only`                 | quarantined | Academic/non-commercial and mainland commercial restrictions                 |
| `yaozeyuan-name-generator-reference` | quarantined | Useful design reference; bundled resources require independent source review |
| `unknown-modern-name-datasets`       | rejected    | Source and redistribution rights are not clear                               |

The legacy `source-manifest.json` is retained as the research decision inventory. The executable release truth is `sources/*.yaml`.
