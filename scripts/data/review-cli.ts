import { readFile } from "node:fs/promises";
import { applyCharacterReviewDecisions, applyReviewDecisions } from "./apply-review";
import { writeJsonl } from "./jsonl";
import { appendDecision, loadAllDecisions, loadJsonl } from "./reviewStore";
import type { AllusionReviewCandidate } from "./reviewSchema";
import type { CharacterReviewCandidate } from "./derive/characters";

const command = process.argv[2] ?? "status";
const [allusionQueue, characterQueue] = await Promise.all([
  loadJsonl<AllusionReviewCandidate>("data/review/queue/allusions.jsonl"),
  loadJsonl<CharacterReviewCandidate>("data/review/queue/characters.jsonl"),
]);
const decisions = await loadAllDecisions();
const allusions = applyReviewDecisions(allusionQueue, decisions);
const characters = applyCharacterReviewDecisions(characterQueue, decisions);

if (command === "status") {
  console.log(
    JSON.stringify(
      {
        total: allusionQueue.length + characterQueue.length,
        decided: decisions.length,
        characters: summarize(characters),
        allusions: summarize(allusions),
      },
      null,
      2,
    ),
  );
} else if (command === "next") {
  console.log(JSON.stringify(characters.pending[0] ?? allusions.pending[0] ?? null, null, 2));
} else if (command === "decide") {
  const decisionFile = process.argv[3];
  if (!decisionFile) throw new Error("Usage: npm run data:review -- decide <decision.json>");
  const decision: unknown = JSON.parse(await readFile(decisionFile, "utf8"));
  console.log(JSON.stringify(await appendDecision(decision), null, 2));
} else if (command === "apply") {
  await writeJsonl("data/review/output/approved-characters.jsonl", characters.approved);
  await writeJsonl("data/review/output/pending-characters.jsonl", characters.pending);
  await writeJsonl("data/review/output/disputed-characters.jsonl", characters.disputed);
  await writeJsonl("data/review/output/retired-characters.jsonl", characters.retired);
  await writeJsonl("data/review/output/approved-allusions.jsonl", allusions.approved);
  await writeJsonl("data/review/output/pending-allusions.jsonl", allusions.pending);
  await writeJsonl("data/review/output/disputed-allusions.jsonl", allusions.disputed);
  await writeJsonl("data/review/output/retired-allusions.jsonl", allusions.retired);
  await writeJsonl(
    "data/review/output/source-requested-allusions.jsonl",
    allusions.sourceRequested,
  );
  await writeJsonl(
    "data/review/output/source-requested-characters.jsonl",
    characters.sourceRequested,
  );
  await writeJsonl("data/review/output/audit-log.jsonl", [
    ...characters.auditLog,
    ...allusions.auditLog,
  ]);
  console.log(`applied ${decisions.length} decisions`);
} else {
  throw new Error(`Unknown review command: ${command}`);
}

function summarize(result: {
  approved: unknown[];
  pending: unknown[];
  disputed: unknown[];
  retired: unknown[];
  sourceRequested: unknown[];
}) {
  return {
    approved: result.approved.length,
    pending: result.pending.length,
    disputed: result.disputed.length,
    retired: result.retired.length,
    sourceRequested: result.sourceRequested.length,
  };
}
