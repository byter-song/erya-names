import type { FiveElement } from "./fiveElements";

export type FiveGridId = "heaven" | "person" | "earth" | "outer" | "total";

export interface FiveGridNumberMeaning {
  value: number;
  sourceLabel: string | null;
  sourceClassification: "auspicious" | "mixed" | "inauspicious" | "unverified";
  productClassification: "auspicious" | "mixed" | "inauspicious" | null;
  productPenalty: number | null;
  reviewStatus: "reviewed" | "research_only";
}

export function calculateFiveGrids(surname: number[], given: number[]) {
  if (
    ![1, 2].includes(surname.length) ||
    ![1, 2].includes(given.length) ||
    [...surname, ...given].some((n) => !Number.isInteger(n) || n < 1 || n > 64)
  )
    throw new Error("五格演算支持一至二字姓、一至二字名，每字笔画为 1–64 的整数");
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  const values = [
    {
      id: "heaven" as const,
      label: "天格",
      value: sum(surname) + (surname.length === 1 ? 1 : 0),
      formula: `姓氏笔画之和${surname.length === 1 ? " + 1（虚数）" : ""}`,
    },
    {
      id: "person" as const,
      label: "人格",
      value: surname.at(-1)! + given[0]!,
      formula: "姓的末字 + 名的首字",
    },
    {
      id: "earth" as const,
      label: "地格",
      value: sum(given) + (given.length === 1 ? 1 : 0),
      formula: `名字笔画之和${given.length === 1 ? " + 1（虚数）" : ""}`,
    },
    {
      id: "outer" as const,
      label: "外格",
      value:
        (surname.length === 1 ? 1 : surname[0]!) + (given.length === 1 ? 1 : given.at(-1)!),
      formula: "复姓首字（单姓取 1）+ 双字名末字（单字名取 1）",
    },
    {
      id: "total" as const,
      label: "总格",
      value: sum(surname) + sum(given),
      formula: "姓名所有笔画之和",
    },
  ];
  const elements: FiveElement[] = [
    "water",
    "wood",
    "wood",
    "fire",
    "fire",
    "earth",
    "earth",
    "metal",
    "metal",
    "water",
  ];
  return values.map((item) => ({ ...item, element: elements[item.value % 10]! }));
}

const generates: Record<FiveElement, FiveElement> = {
  wood: "fire",
  fire: "earth",
  earth: "metal",
  metal: "water",
  water: "wood",
};

const controls: Record<FiveElement, FiveElement> = {
  wood: "earth",
  fire: "metal",
  earth: "water",
  metal: "wood",
  water: "fire",
};

export function calculateThreeTalent(grids: ReturnType<typeof calculateFiveGrids>) {
  const byId = new Map(grids.map((grid) => [grid.id, grid]));
  const heaven = byId.get("heaven")!;
  const person = byId.get("person")!;
  const earth = byId.get("earth")!;
  return {
    elements: [heaven.element, person.element, earth.element] as const,
    relations: [
      directionalRelation(heaven.element, person.element),
      directionalRelation(person.element, earth.element),
    ],
  };
}

function directionalRelation(upper: FiveElement, lower: FiveElement) {
  if (upper === lower) return { id: "same_element" as const, deduction: 0 };
  if (generates[upper] === lower) return { id: "upper_generates_lower" as const, deduction: 0 };
  if (generates[lower] === upper) return { id: "lower_generates_upper" as const, deduction: 4 };
  if (controls[upper] === lower) return { id: "upper_controls_lower" as const, deduction: 10 };
  return { id: "lower_controls_upper" as const, deduction: 6 };
}

export function evaluateFiveGridScore(
  grids: ReturnType<typeof calculateFiveGrids>,
  meanings: readonly FiveGridNumberMeaning[],
) {
  const meaningByValue = new Map(meanings.map((meaning) => [meaning.value, meaning]));
  const gridMeanings = grids.map((grid) => ({
    ...grid,
    meaning: meaningByValue.get(grid.value),
  }));
  const missingValues = [
    ...new Set(
      gridMeanings
        .filter(
          ({ meaning }) =>
            !meaning || meaning.reviewStatus !== "reviewed" || meaning.productPenalty === null,
        )
        .map(({ value }) => value),
    ),
  ];
  const threeTalent = calculateThreeTalent(grids);
  if (missingValues.length)
    return {
      applicability: "source_unverified" as const,
      gridMeanings,
      threeTalent,
      missingValues,
    };
  const gridDeduction = gridMeanings.reduce(
    (total, { meaning }) => total + (meaning?.productPenalty ?? 0),
    0,
  );
  const threeTalentDeduction = threeTalent.relations.reduce(
    (total, relation) => total + relation.deduction,
    0,
  );
  return {
    applicability: "applied" as const,
    gridMeanings,
    threeTalent,
    missingValues: [],
    deduction: gridDeduction + threeTalentDeduction,
    score: Math.max(0, 100 - gridDeduction - threeTalentDeduction),
  };
}
