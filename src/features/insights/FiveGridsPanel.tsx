import { Button } from "../../design-system/primitives/Button";
import { useState } from "react";
import { calculateFiveGrids } from "../../domain/folklore/fiveGrids";
import { elementLabels } from "../../domain/folklore/fiveElements";
export function FiveGridsPanel({
  surname,
  givenName,
  strokes,
}: {
  surname: string;
  givenName: string;
  strokes: Record<string, number>;
}) {
  const chars = [...surname, ...givenName];
  const [values, setValues] = useState(() => chars.map((char) => String(strokes[char] ?? "")));
  const [confirmed, setConfirmed] = useState(false);
  let grids;
  let error;
  if (confirmed)
    try {
      grids = calculateFiveGrids(
        values.slice(0, [...surname].length).map(Number),
        values.slice([...surname].length).map(Number),
      );
    } catch (reason) {
      error = reason instanceof Error ? reason.message : "请检查笔画";
    }
  return (
    <details className="five-grids">
      <summary>五格演算 · 查看笔画与公式</summary>
      <p>
        五格属于近现代姓名学流派，不是汉字规范。默认显示简体书写笔画；若采用康熙口径，请先逐字查证并修改，不能用简体笔画冒充康熙笔画。本工具仅演算数值，不给吉凶分。
      </p>
      <div className="stroke-inputs">
        {chars.map((char, i) => (
          <label key={`${char}:${i}`}>
            {char}
            <input
              aria-label={`${char}第${i + 1}字笔画`}
              type="number"
              min="1"
              max="64"
              value={values[i]}
              onChange={(event) => {
                setValues((current) =>
                  current.map((v, j) => (j === i ? event.target.value : v)),
                );
                setConfirmed(false);
              }}
            />
          </label>
        ))}
      </div>
      <Button type="button" onClick={() => setConfirmed(true)}>
        按以上笔画演算
      </Button>
      {error ? <p role="alert">{error}</p> : null}
      {grids ? (
        <div className="grid-results">
          {grids.map((grid) => (
            <p key={grid.label}>
              <strong>
                {grid.label} {grid.value} · {elementLabels[grid.element]}
              </strong>
              <small>{grid.formula}</small>
            </p>
          ))}
          <p>
            数理五行按尾数：1/2 木、3/4 火、5/6 土、7/8 金、9/0
            水；此为本演算采用的流派口径，不能替代字义五行或出生五行。
          </p>
        </div>
      ) : null}
    </details>
  );
}
