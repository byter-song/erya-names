import type { FiveElement } from "./fiveElements";
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
      label: "天格",
      value: sum(surname) + (surname.length === 1 ? 1 : 0),
      formula: `姓氏笔画之和${surname.length === 1 ? " + 1（虚数）" : ""}`,
    },
    { label: "人格", value: surname.at(-1)! + given[0]!, formula: "姓的末字 + 名的首字" },
    {
      label: "地格",
      value: sum(given) + (given.length === 1 ? 1 : 0),
      formula: `名字笔画之和${given.length === 1 ? " + 1（虚数）" : ""}`,
    },
    {
      label: "外格",
      value:
        (surname.length === 1 ? 1 : surname[0]!) + (given.length === 1 ? 1 : given.at(-1)!),
      formula: "复姓首字（单姓取 1）+ 双字名末字（单字名取 1）",
    },
    { label: "总格", value: sum(surname) + sum(given), formula: "姓名所有笔画之和" },
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
