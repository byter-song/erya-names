# Data Sources

This directory records source metadata for Erya Names V1 data preparation.

## Policy

- Only public-domain, official open data, or clearly redistributable sources may enter the release bundle.
- Raw upstream snapshots are stored in local cache directories, not committed.
- Curated release data must keep source, license, version, checksum, review status, and review notes.
- Research-only and rejected sources may guide manual review but must not be bundled into the app.

## Executable source contract

Release-eligible sources are defined one per file in `sources/*.yaml`. Each contract pins the repository commit, SPDX license, license checksum, selected file checksums, allowed uses and review status.

```bash
npm run data:fetch -- pinyin-data phrase-pinyin-data opencc chinese-poetry
npm run data:verify-sources
```

`data:fetch` is idempotent. It clones into a sibling temporary directory, verifies the pinned commit and every checksum, then replaces the ignored `data/cache/<sourceId>/` directory. A failed verification never promotes the temporary cache. Sources without `releaseEligible: true`, verified status and a known license cannot be fetched by this release pipeline.

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
| `manual-zhuangyuan-curation`         | accepted    | Manual curated records only                                                  |
| `cbdb-research-only`                 | quarantined | Academic/non-commercial and mainland commercial restrictions                 |
| `yaozeyuan-name-generator-reference` | quarantined | Useful design reference; bundled resources require independent source review |
| `unknown-modern-name-datasets`       | rejected    | Source and redistribution rights are not clear                               |

The legacy `source-manifest.json` is retained as the research decision inventory. The executable release truth is `sources/*.yaml`.
