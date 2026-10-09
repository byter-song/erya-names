# Human review workspace

`queue/` is a reproducible, ignored machine output. It never enters the runtime bundle directly.

The queue contains both `characters.jsonl` and `allusions.jsonl`. `npm run data:review -- apply`
rebuilds both approved outputs from durable decisions before a production audit. Generated queue and
output files remain ignored; human decisions are the version-controlled source of truth.

Human decisions live under `decisions/` and must include reviewer identity, ISO review time, explicit source check, semantic note and risk note. Only reviewers with `kind: human` may submit `approve` or `edit-and-approve`. Agents and automation may prepare suggestions, disputes or source requests but cannot approve.

Supported decisions: `approve`, `edit-and-approve`, `dispute`, `retire`, `request-source`. Approved records remain traceable to the queue candidate, normalized source record and pinned source manifest.

Review progress is resumable: candidate IDs already present in a decision file are removed from the pending view, while the audit log is append-only.
