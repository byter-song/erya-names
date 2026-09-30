import { readFile } from "node:fs/promises";
import { applyReviewDecisions } from "./apply-review";
import { writeJsonl } from "./jsonl";
import { appendDecision, loadAllDecisions, loadJsonl } from "./reviewStore";
import type { AllusionReviewCandidate } from "./reviewSchema";

const command = process.argv[2] ?? "status";
const queue = await loadJsonl<AllusionReviewCandidate>("data/review/queue/allusions.jsonl");
const decisions = await loadAllDecisions();
const result = applyReviewDecisions(queue, decisions);

if (command === "status") {
  console.log(
    JSON.stringify(
      {
        total: queue.length,
        decided: decisions.length,
        approved: result.approved.length,
        pending: result.pending.length,
        disputed: result.disputed.length,
        retired: result.retired.length,
        sourceRequested: result.sourceRequested.length,
      },
      null,
      2,
    ),
  );
} else if (command === "next") {
  console.log(JSON.stringify(result.pending[0] ?? null, null, 2));
} else if (command === "decide") {
  const decisionFile = process.argv[3];
  if (!decisionFile) throw new Error("Usage: npm run data:review -- decide <decision.json>");
  const decision: unknown = JSON.parse(await readFile(decisionFile, "utf8"));
  console.log(JSON.stringify(await appendDecision(decision), null, 2));
} else if (command === "apply") {
  await writeJsonl("data/review/output/approved-allusions.jsonl", result.approved);
  await writeJsonl("data/review/output/pending-allusions.jsonl", result.pending);
  await writeJsonl("data/review/output/disputed-allusions.jsonl", result.disputed);
  await writeJsonl("data/review/output/retired-allusions.jsonl", result.retired);
  await writeJsonl(
    "data/review/output/source-requested-allusions.jsonl",
    result.sourceRequested,
  );
  await writeJsonl("data/review/output/audit-log.jsonl", result.auditLog);
  console.log(`applied ${decisions.length} decisions`);
} else {
  throw new Error(`Unknown review command: ${command}`);
}
