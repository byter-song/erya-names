import { appendFile, mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { reviewDecisionSchema, type ReviewDecision } from "./reviewSchema";

export async function loadJsonl<Value>(target: string): Promise<Value[]> {
  try {
    const input = await readFile(target, "utf8");
    return input
      .split(/\r?\n/u)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Value);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function loadAllDecisions(
  directory = "data/review/decisions",
): Promise<ReviewDecision[]> {
  try {
    const files = (await readdir(directory)).filter((file) => file.endsWith(".jsonl")).sort();
    const decisions = (
      await Promise.all(files.map((file) => loadJsonl<unknown>(path.join(directory, file))))
    ).flat();
    return decisions.map((decision) => reviewDecisionSchema.parse(decision));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function appendDecision(
  input: unknown,
  directory = "data/review/decisions",
): Promise<ReviewDecision> {
  const decision = reviewDecisionSchema.parse(input);
  const current = await loadAllDecisions(directory);
  if (
    current.some(
      (item) =>
        item.candidateId === decision.candidateId && item.reviewStage === decision.reviewStage,
    )
  )
    throw new Error(
      `Candidate already has a ${decision.reviewStage} decision: ${decision.candidateId}`,
    );
  await mkdir(directory, { recursive: true });
  const date = decision.reviewedAt.slice(0, 10);
  await appendFile(
    path.join(directory, `${date}.jsonl`),
    `${JSON.stringify(decision)}\n`,
    "utf8",
  );
  return decision;
}
