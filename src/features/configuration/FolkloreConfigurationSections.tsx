import { useEffect, useState, type ReactNode } from "react";
import {
  listFolkloreRulePacks,
  type FolkloreRulePackManifest,
} from "../../data/folklore/loadRulePacks";
import type { FolkloreModuleId, NamingProfileDraft } from "../../domain/project/profile";

export type FolkloreConfigurationSectionId =
  "bazi" | "zodiac" | "tradition" | "name-systems" | "scoring";

interface FolkloreConfigurationSectionsProps {
  value: NamingProfileDraft;
  onChange: (value: NamingProfileDraft) => void;
  /** Used by tests and callers that already loaded the versioned manifest registry. */
  rulePacks?: readonly FolkloreRulePackManifest[];
  /** Omit to render the five pieces together, or select one piece for a page section slot. */
  section?: FolkloreConfigurationSectionId;
}

const modules: Readonly<
  Record<
    FolkloreModuleId,
    {
      label: string;
      description: string;
      analysisInput: string;
    }
  >
> = {
  bazi_wuxing: {
    label: "八字、五行与用神",
    description: "四条用神路径分别保留证据与反证；只有家人确认采用的五行才匹配姓名字义。",
    analysisInput: "dayMaster",
  },
  zodiac: {
    label: "生肖选字提示",
    description: "字根宜忌只作可关闭的提示，不过滤名字，也不产生硬冲突。",
    analysisInput: "givenNameCharacters",
  },
  traditional: {
    label: "传统命名原则",
    description: "五原则用于取意标签，六禁忌按明确字面规则提示，并保留礼制语境。",
    analysisInput: "fullName",
  },
  name_hexagram: {
    label: "姓名卦象",
    description: "按已声明的产品公式演算体用关系，公式与古籍来源分开说明。",
    analysisInput: "surnameKangxiStrokes",
  },
  five_grids: {
    label: "五格与三才",
    description: "康熙笔画、五格公式、81 数标签和产品扣分表分别记录复核状态。",
    analysisInput: "surnameStructure",
  },
};

const sectionModules: Readonly<
  Record<Exclude<FolkloreConfigurationSectionId, "scoring">, readonly FolkloreModuleId[]>
> = {
  bazi: ["bazi_wuxing"],
  zodiac: ["zodiac"],
  tradition: ["traditional"],
  "name-systems": ["name_hexagram", "five_grids"],
};

/**
 * Controlled editor for the five folklore modules. It can be mounted once or split across
 * NamingConfigurationPage slots with the `section` prop; it never creates competing anchors.
 */
export function FolkloreConfigurationSections({
  value,
  onChange,
  rulePacks,
  section,
}: FolkloreConfigurationSectionsProps) {
  const registry = useRulePackRegistry(rulePacks);
  const patchModule = (
    moduleId: FolkloreModuleId,
    patch: Partial<NamingProfileDraft["modules"][FolkloreModuleId]>,
  ) =>
    onChange({
      ...value,
      modules: {
        ...value.modules,
        [moduleId]: { ...value.modules[moduleId], ...patch },
      },
    });

  const moduleEditor = (moduleId: FolkloreModuleId) => (
    <ModuleEditor
      key={moduleId}
      moduleId={moduleId}
      packs={selectAnalysisRulePacks(moduleId, registry.packs)}
      value={value.modules[moduleId]}
      loadError={registry.error}
      loading={registry.loading}
      onChange={(patch) => patchModule(moduleId, patch)}
    />
  );

  if (section === "scoring") return <ScoringEditor value={value} onChange={onChange} />;

  if (section) return <>{sectionModules[section].map(moduleEditor)}</>;

  return (
    <div className="folklore-configuration-sections">
      {(
        Object.keys(sectionModules) as Array<Exclude<FolkloreConfigurationSectionId, "scoring">>
      ).map((sectionId) => (
        <div className="folklore-configuration-sections__group" key={sectionId}>
          {sectionModules[sectionId].map(moduleEditor)}
        </div>
      ))}
      <ScoringEditor value={value} onChange={onChange} />
    </div>
  );
}

function ModuleEditor({
  moduleId,
  packs,
  value,
  loading,
  loadError,
  onChange,
}: {
  moduleId: FolkloreModuleId;
  packs: readonly FolkloreRulePackManifest[];
  value: NamingProfileDraft["modules"][FolkloreModuleId];
  loading: boolean;
  loadError: string;
  onChange: (patch: Partial<NamingProfileDraft["modules"][FolkloreModuleId]>) => void;
}) {
  const definition = modules[moduleId];
  const schools = unique(packs.map(({ schoolId }) => schoolId));
  const schoolPacks = packs.filter(({ schoolId }) => schoolId === value.schoolId);
  const selectedPack = schoolPacks.find(({ ruleVersion }) => ruleVersion === value.ruleVersion);
  const reviewed = selectedPack?.reviewStatus === "reviewed";
  const statusId = `folklore-${moduleId}-review-status`;

  const selectPack = (pack: FolkloreRulePackManifest) =>
    onChange({
      schoolId: pack.schoolId,
      ruleVersion: pack.ruleVersion,
      ...(pack.reviewStatus === "reviewed" ? {} : { analysisEnabled: false }),
    });

  const selectSchool = (schoolId: string) => {
    const next = packs.find((pack) => pack.schoolId === schoolId);
    if (next) selectPack(next);
  };

  return (
    <fieldset className="folklore-module" data-module-id={moduleId}>
      <legend>{definition.label}</legend>
      <p>{definition.description}</p>

      <div className="folklore-module__switches">
        <label>
          <input
            aria-describedby={statusId}
            checked={value.analysisEnabled}
            disabled={!reviewed && !value.analysisEnabled}
            type="checkbox"
            onChange={(event) => {
              if (event.target.checked && !reviewed) return;
              onChange({
                analysisEnabled: event.target.checked,
                ...(event.target.checked && value.weight === 0 ? { weight: 5 } : {}),
              });
            }}
          />
          启用分析
        </label>
        <small>启用后默认纳入综合分。</small>
        <label>
          <input
            checked={value.detailsVisible}
            type="checkbox"
            onChange={(event) => onChange({ detailsVisible: event.target.checked })}
          />
          详情显示
        </label>
        <small>只控制详情呈现，不改变分数。</small>
      </div>

      <label>
        权重
        <input
          aria-label={`${definition.label}权重`}
          min={0}
          max={100}
          step={0.5}
          type="number"
          value={value.weight}
          onChange={(event) => onChange({ weight: Number(event.target.value) })}
        />
      </label>
      <label>
        流派
        <select
          aria-label={`${definition.label}流派`}
          disabled={loading || schools.length === 0}
          value={value.schoolId}
          onChange={(event) => selectSchool(event.target.value)}
        >
          {!schools.includes(value.schoolId) ? (
            <option value={value.schoolId}>{value.schoolId}（当前配置，规则包未找到）</option>
          ) : null}
          {schools.map((schoolId) => (
            <option key={schoolId} value={schoolId}>
              {schoolId}
            </option>
          ))}
        </select>
      </label>
      <label>
        规则版本
        <select
          aria-label={`${definition.label}规则版本`}
          disabled={loading || schoolPacks.length === 0}
          value={value.ruleVersion}
          onChange={(event) => {
            const next = schoolPacks.find(
              ({ ruleVersion }) => ruleVersion === event.target.value,
            );
            if (next) selectPack(next);
          }}
        >
          {!schoolPacks.some(({ ruleVersion }) => ruleVersion === value.ruleVersion) ? (
            <option value={value.ruleVersion}>
              {value.ruleVersion}（当前配置，版本未找到）
            </option>
          ) : null}
          {schoolPacks.map((pack) => (
            <option key={pack.ruleVersion} value={pack.ruleVersion}>
              {pack.ruleVersion}
            </option>
          ))}
        </select>
      </label>

      <ReviewStatus id={statusId} error={loadError} loading={loading} pack={selectedPack} />
    </fieldset>
  );
}

function ReviewStatus({
  id,
  pack,
  loading,
  error,
}: {
  id: string;
  pack: FolkloreRulePackManifest | undefined;
  loading: boolean;
  error: string;
}) {
  if (loading)
    return (
      <p id={id} role="status">
        正在读取规则包复核状态…
      </p>
    );
  if (error)
    return (
      <p id={id} role="alert">
        {error}。当前规则包不能启用分析或纳入综合分。
      </p>
    );
  if (pack?.reviewStatus === "reviewed")
    return (
      <div id={id} className="folklore-module__review-status">
        <p>
          <strong>已核验，可参与评分</strong>。公式、输入边界与例题已经通过产品复核；
          民俗解释仍按所选流派呈现。
        </p>
        <details>
          <summary>方法、分歧与来源</summary>
          <p>
            结论性质：{epistemicLabel(pack.epistemicStatus)}。
            {pack.uncertainty ? ` ${pack.uncertainty}` : ""}
          </p>
          <p>
            方法版本：{pack.schoolId} · {pack.ruleVersion}；来源：
            {pack.sourceIds.join("、")}。
          </p>
        </details>
      </div>
    );
  if (pack?.reviewStatus === "research_only")
    return (
      <div id={id} className="folklore-module__review-status">
        <p>
          <strong>研究性参考，当前不计分</strong>
          。可以显示分析详情，完成产品复核前不会纳入综合分。
        </p>
        <details>
          <summary>方法与来源</summary>
          <p>
            方法版本：{pack.schoolId} · {pack.ruleVersion}；来源：
            {pack.sourceIds.join("、")}。
          </p>
        </details>
      </div>
    );
  return (
    <div id={id} className="folklore-module__review-status">
      <p>
        <strong>规则版本待核验</strong>。当前版本不能启用分析或纳入综合分。
      </p>
    </div>
  );
}

function epistemicLabel(status: FolkloreRulePackManifest["epistemicStatus"]): string {
  if (status === "calculation_convention") return "约定公式";
  if (status === "research_model") return "低置信度研究模型";
  if (status === "school_specific") return "流派特定解释";
  if (status === "historical_context") return "历史礼俗语境";
  if (status === "source_gap") return "仍有资料缺口";
  return "未标注";
}

function ScoringEditor({
  value,
  onChange,
}: {
  value: NamingProfileDraft;
  onChange: (value: NamingProfileDraft) => void;
}) {
  const enabledModules = (Object.keys(modules) as FolkloreModuleId[]).filter(
    (moduleId) => value.modules[moduleId].analysisEnabled,
  );

  return (
    <div className="folklore-scoring-configuration">
      <label>
        基础规范权重
        <input
          min={0}
          max={100}
          step={0.5}
          type="number"
          value={value.scoring.basicWeight}
          onChange={(event) =>
            onChange({
              ...value,
              scoring: {
                ...value.scoring,
                presetId: "custom",
                basicWeight: Number(event.target.value),
              },
            })
          }
        />
      </label>
      <p>当前启用 {enabledModules.length} 个民俗模块；综合分会归一化已启用且证据适用的维度。</p>
      <dl>
        {(Object.keys(modules) as FolkloreModuleId[]).map((moduleId) => (
          <div key={moduleId}>
            <dt>{modules[moduleId].label}</dt>
            <dd>
              {value.modules[moduleId].analysisEnabled ? "纳入评分" : "不纳入评分"} · 权重
              {value.modules[moduleId].weight}
            </dd>
          </div>
        ))}
      </dl>
      <p>
        综合分按所选传统体系、流派和资料完整度计算；尚处研究阶段的规则只展示详情，不进入评分。
      </p>
    </div>
  );
}

function useRulePackRegistry(provided: readonly FolkloreRulePackManifest[] | undefined): {
  packs: readonly FolkloreRulePackManifest[];
  loading: boolean;
  error: string;
} {
  const [state, setState] = useState<{
    packs: readonly FolkloreRulePackManifest[];
    loading: boolean;
    error: string;
  }>(() => ({ packs: provided ?? [], loading: provided === undefined, error: "" }));

  useEffect(() => {
    if (provided) {
      setState({ packs: provided, loading: false, error: "" });
      return;
    }

    let active = true;
    void listFolkloreRulePacks()
      .then((packs) => {
        if (active) setState({ packs, loading: false, error: "" });
      })
      .catch(() => {
        if (active) setState({ packs: [], loading: false, error: "规则包复核状态读取失败" });
      });
    return () => {
      active = false;
    };
  }, [provided]);

  return state;
}

/** Auxiliary calendar and stroke inventories are evidence inputs, not selectable score rules. */
function selectAnalysisRulePacks(
  moduleId: FolkloreModuleId,
  packs: readonly FolkloreRulePackManifest[],
): FolkloreRulePackManifest[] {
  return packs.filter(
    (pack) =>
      pack.moduleId === moduleId &&
      pack.applicableInputs.includes(modules[moduleId].analysisInput),
  );
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export function createFolkloreConfigurationSlots(
  props: Omit<FolkloreConfigurationSectionsProps, "section">,
): Record<FolkloreConfigurationSectionId, ReactNode> {
  return {
    bazi: <FolkloreConfigurationSections {...props} section="bazi" />,
    zodiac: <FolkloreConfigurationSections {...props} section="zodiac" />,
    tradition: <FolkloreConfigurationSections {...props} section="tradition" />,
    "name-systems": <FolkloreConfigurationSections {...props} section="name-systems" />,
    scoring: <FolkloreConfigurationSections {...props} section="scoring" />,
  };
}
