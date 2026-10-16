import "fake-indexeddb/auto";
import { afterEach, describe, expect, expectTypeOf, it } from "vitest";
import { ExcludeCandidate } from "../../src/application/use-cases/ExcludeCandidate";
import { MoveCandidateDecision } from "../../src/application/use-cases/MoveCandidateDecision";
import { RestoreExcludedCandidate } from "../../src/application/use-cases/RestoreExcludedCandidate";
import { UndoCandidateDecision } from "../../src/application/use-cases/UndoCandidateDecision";
import type {
  ActiveCandidatePool,
  CandidateDecision,
} from "../../src/domain/candidate/decision";
import type { CandidateMoveDirection } from "../../src/domain/candidate/decisionState";
import { SessionUndoStack } from "../../src/domain/candidate/sessionUndo";
import { EryaDatabase } from "../../src/infrastructure/database/EryaDatabase";
import { DexieDecisionRepository } from "../../src/infrastructure/repositories/DexieDecisionRepository";

const databaseNames = new Set<string>();
const initialTime = "2026-10-16T00:00:00.000Z";
const changedTime = "2026-10-16T00:01:00.000Z";
const restoredTime = "2026-10-16T00:02:00.000Z";

type MoveInput = Parameters<MoveCandidateDecision["execute"]>[0];
type AcceptsArbitraryTargetPool = "targetPool" extends keyof MoveInput ? true : false;

afterEach(async () => {
  await Promise.all([...databaseNames].map((name) => EryaDatabase.delete(name)));
  databaseNames.clear();
});

function createDatabase(): EryaDatabase {
  const name = `erya-decision-${crypto.randomUUID()}`;
  databaseNames.add(name);
  return new EryaDatabase(name);
}

async function seedDecision(
  database: EryaDatabase,
  pool: CandidateDecision["pool"],
  candidateId = "c1",
): Promise<void> {
  await database.candidateDecisions.add(
    pool === "excluded"
      ? {
          projectId: "p1",
          candidateId,
          pool,
          lastActivePool: "candidate",
          exclusionReason: "暂不考虑",
          excludedAt: initialTime,
          updatedAt: initialTime,
        }
      : {
          projectId: "p1",
          candidateId,
          pool,
          updatedAt: initialTime,
        },
  );
}

function createMove(database: EryaDatabase, now = changedTime) {
  return new MoveCandidateDecision(new DexieDecisionRepository(database), {
    now: () => now,
  });
}

describe("MoveCandidateDecision", () => {
  it("does not expose an arbitrary targetPool input", () => {
    expectTypeOf<AcceptsArbitraryTargetPool>().toEqualTypeOf<false>();
  });

  it.each<{
    from: ActiveCandidatePool;
    direction: CandidateMoveDirection;
    to: ActiveCandidatePool;
  }>([
    { from: "inspiration", direction: "forward", to: "candidate" },
    { from: "candidate", direction: "forward", to: "selected" },
    { from: "candidate", direction: "backward", to: "inspiration" },
    { from: "selected", direction: "backward", to: "candidate" },
  ])("persists the adjacent $from -> $to move and history", async ({ from, direction, to }) => {
    const database = createDatabase();
    await seedDecision(database, from);

    const result = await createMove(database).execute({
      projectId: "p1",
      candidateId: "c1",
      direction,
      expectedUpdatedAt: initialTime,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        projectId: "p1",
        candidateId: "c1",
        pool: to,
        updatedAt: changedTime,
      },
    });
    await expect(database.candidateDecisions.get("c1")).resolves.toMatchObject({
      pool: to,
      updatedAt: changedTime,
    });
    await expect(database.decisionHistory.toArray()).resolves.toEqual([
      expect.objectContaining({
        projectId: "p1",
        candidateId: "c1",
        from,
        to,
        action: direction,
        changedAt: changedTime,
      }),
    ]);
    database.close();
  });

  it.each<{
    from: CandidateDecision["pool"];
    direction: CandidateMoveDirection;
  }>([
    { from: "inspiration", direction: "backward" },
    { from: "selected", direction: "forward" },
    { from: "excluded", direction: "forward" },
    { from: "excluded", direction: "backward" },
  ])(
    "rejects the illegal $from + $direction move without history",
    async ({ from, direction }) => {
      const database = createDatabase();
      await seedDecision(database, from);

      const result = await createMove(database).execute({
        projectId: "p1",
        candidateId: "c1",
        direction,
        expectedUpdatedAt: initialTime,
      });

      expect(result).toEqual({ ok: false, error: "invalid-transition" });
      await expect(database.candidateDecisions.get("c1")).resolves.toMatchObject({
        pool: from,
        updatedAt: initialTime,
      });
      await expect(database.decisionHistory.count()).resolves.toBe(0);
      database.close();
    },
  );

  it("lets exactly one concurrent command win for the same expectedUpdatedAt", async () => {
    const database = createDatabase();
    await seedDecision(database, "candidate");
    const move = createMove(database);

    const results = await Promise.all([
      move.execute({
        projectId: "p1",
        candidateId: "c1",
        direction: "forward",
        expectedUpdatedAt: initialTime,
      }),
      move.execute({
        projectId: "p1",
        candidateId: "c1",
        direction: "backward",
        expectedUpdatedAt: initialTime,
      }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([
      { ok: false, error: "candidate-stale" },
    ]);
    const stored = await database.candidateDecisions.get("c1");
    expect(["inspiration", "selected"]).toContain(stored?.pool);
    expect(stored?.updatedAt).toBe(changedTime);
    await expect(database.decisionHistory.count()).resolves.toBe(1);
    database.close();
  });

  it("rejects a stale expectedUpdatedAt without moving or writing history", async () => {
    const database = createDatabase();
    await seedDecision(database, "candidate");

    const result = await createMove(database).execute({
      projectId: "p1",
      candidateId: "c1",
      direction: "forward",
      expectedUpdatedAt: "2026-10-15T23:59:59.000Z",
    });

    expect(result).toEqual({ ok: false, error: "candidate-stale" });
    await expect(database.candidateDecisions.get("c1")).resolves.toMatchObject({
      pool: "candidate",
      updatedAt: initialTime,
    });
    await expect(database.decisionHistory.count()).resolves.toBe(0);
    database.close();
  });

  it("undoes the latest in-session move through the inverse direction", async () => {
    const database = createDatabase();
    await seedDecision(database, "inspiration");
    const repository = new DexieDecisionRepository(database);
    const undoStack = new SessionUndoStack();
    const move = new MoveCandidateDecision(repository, {
      now: () => changedTime,
      undoStack,
    });
    await move.execute({
      projectId: "p1",
      candidateId: "c1",
      direction: "forward",
      expectedUpdatedAt: initialTime,
    });

    const undone = await new UndoCandidateDecision(repository, {
      now: () => restoredTime,
      undoStack,
    }).execute({ projectId: "p1" });

    expect(undone).toEqual({ ok: true, value: { hasMore: false } });
    await expect(database.candidateDecisions.get("c1")).resolves.toMatchObject({
      pool: "inspiration",
      updatedAt: restoredTime,
    });
    database.close();
  });
});

describe("exclude and restore", () => {
  it.each<ActiveCandidatePool>(["inspiration", "candidate", "selected"])(
    "restores an excluded %s candidate to its recorded original pool",
    async (originalPool) => {
      const database = createDatabase();
      await seedDecision(database, originalPool);
      const repository = new DexieDecisionRepository(database);

      const excluded = await new ExcludeCandidate(repository, {
        now: () => changedTime,
      }).execute({
        projectId: "p1",
        candidateId: "c1",
        expectedUpdatedAt: initialTime,
        reason: "  家庭讨论后再看  ",
      });

      expect(excluded).toEqual({
        ok: true,
        value: {
          projectId: "p1",
          candidateId: "c1",
          pool: "excluded",
          lastActivePool: originalPool,
          exclusionReason: "家庭讨论后再看",
          excludedAt: changedTime,
          updatedAt: changedTime,
        },
      });

      const restored = await new RestoreExcludedCandidate(repository, {
        now: () => restoredTime,
      }).execute({
        projectId: "p1",
        candidateId: "c1",
        expectedUpdatedAt: changedTime,
      });

      expect(restored).toEqual({
        ok: true,
        value: {
          projectId: "p1",
          candidateId: "c1",
          pool: originalPool,
          updatedAt: restoredTime,
        },
      });
      await expect(database.decisionHistory.toArray()).resolves.toEqual([
        expect.objectContaining({
          from: originalPool,
          to: "excluded",
          action: "exclude",
          exclusionReason: "家庭讨论后再看",
        }),
        expect.objectContaining({
          from: "excluded",
          to: originalPool,
          action: "restore",
          exclusionReason: "家庭讨论后再看",
        }),
      ]);
      database.close();
    },
  );

  it("rejects stale exclusion and stale restoration without changing the current pool", async () => {
    const database = createDatabase();
    await seedDecision(database, "candidate");
    const repository = new DexieDecisionRepository(database);
    const exclude = new ExcludeCandidate(repository, { now: () => changedTime });

    await expect(
      exclude.execute({
        projectId: "p1",
        candidateId: "c1",
        expectedUpdatedAt: "stale",
      }),
    ).resolves.toEqual({ ok: false, error: "candidate-stale" });
    await expect(database.candidateDecisions.get("c1")).resolves.toMatchObject({
      pool: "candidate",
    });

    await exclude.execute({
      projectId: "p1",
      candidateId: "c1",
      expectedUpdatedAt: initialTime,
    });
    await expect(
      new RestoreExcludedCandidate(repository, { now: () => restoredTime }).execute({
        projectId: "p1",
        candidateId: "c1",
        expectedUpdatedAt: initialTime,
      }),
    ).resolves.toEqual({ ok: false, error: "candidate-stale" });
    await expect(database.candidateDecisions.get("c1")).resolves.toMatchObject({
      pool: "excluded",
      lastActivePool: "candidate",
      updatedAt: changedTime,
    });
    database.close();
  });

  it("rejects excluding an excluded candidate and restoring an active candidate", async () => {
    const database = createDatabase();
    await seedDecision(database, "excluded", "excluded-candidate");
    await seedDecision(database, "selected", "active-candidate");
    const repository = new DexieDecisionRepository(database);

    await expect(
      new ExcludeCandidate(repository, { now: () => changedTime }).execute({
        projectId: "p1",
        candidateId: "excluded-candidate",
        expectedUpdatedAt: initialTime,
      }),
    ).resolves.toEqual({ ok: false, error: "invalid-transition" });
    await expect(
      new RestoreExcludedCandidate(repository, { now: () => restoredTime }).execute({
        projectId: "p1",
        candidateId: "active-candidate",
        expectedUpdatedAt: initialTime,
      }),
    ).resolves.toEqual({ ok: false, error: "candidate-not-excluded" });
    await expect(database.decisionHistory.count()).resolves.toBe(0);
    database.close();
  });
});
