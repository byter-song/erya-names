import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AssessmentRun } from "../../../domain/rules/assessmentRun";
import { calculateBasicFiveElements } from "../../../domain/folklore/calendarAdapter";
import { analyzeUsefulGod } from "../../../domain/folklore/usefulGod";
import {
  applyConfigurationPreset,
  configurationPresets,
  type ConfigurationPresetId,
} from "../../../domain/project/configurationPresets";
import type {
  FolkloreModuleId,
  NamingProfile,
  NamingProfileDraft,
} from "../../../domain/project/profile";
import { familyRulesArePending } from "../../../domain/project/profile";
import type { FolkloreRulePackManifest } from "../../../data/folklore/loadRulePacks";
import { listFolkloreRulePacks } from "../../../data/folklore/loadRulePacks";
import { BasicConfigurationSections } from "../../../features/configuration/BasicConfigurationSections";
import { createFolkloreConfigurationSlots } from "../../../features/configuration/FolkloreConfigurationSections";
import {
  NamingConfigurationPage,
  type ConfigurationValidationError,
} from "../../../features/configuration/NamingConfigurationPage";
import { SaveImpactPanel } from "../../../features/configuration/SaveImpactPanel";
import { UsefulGodDecisionPanel } from "../../../features/configuration/UsefulGodDecisionPanel";
import type { ConfigurationImpactSummary } from "../../../application/use-cases/SaveNamingConfiguration";
import { useApplicationContainer } from "../../providers";
import { configurationRoute } from "./$projectId.config";

export function ConfigurationRoute() {
  const { projectId } = configurationRoute.useParams();
  const container = useApplicationContainer();
  const [profile, setProfile] = useState<NamingProfile>();
  const [title, setTitle] = useState("");
  const [draft, setDraft] = useState<NamingProfileDraft>();
  const [impact, setImpact] = useState<ConfigurationImpactSummary>();
  const [run, setRun] = useState<AssessmentRun>();
  const [rulePacks, setRulePacks] = useState<FolkloreRulePackManifest[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [validationFocusKey, setValidationFocusKey] = useState(0);
  const previewSequence = useRef(0);

  const load = useCallback(async () => {
    const result = await container.getProjectWorkspace?.execute(projectId);
    if (!result?.ok) throw new Error("未找到起名方案，请返回方案中心重新选择。");
    setProfile(result.value.profile);
    setDraft(toDraft(result.value.profile));
    setTitle(result.value.project.title);
    const latestRun = await container.getAssessmentRun?.execute(projectId);
    setRun(latestRun);
  }, [container, projectId]);

  useEffect(() => {
    void load().catch((reason) =>
      setError(reason instanceof Error ? reason.message : "读取配置失败"),
    );
    void listFolkloreRulePacks()
      .then(setRulePacks)
      .catch(() => setRulePacks([]));
  }, [load]);

  useEffect(() => {
    if (!profile || !draft || !container.saveNamingConfiguration) return;
    const sequence = ++previewSequence.current;
    const timer = window.setTimeout(() => {
      void container.saveNamingConfiguration
        ?.preview({
          projectId,
          expectedRevision: profile.configRevision,
          configuration: draft,
        })
        .then((result) => {
          if (sequence !== previewSequence.current) return;
          if (result.ok) {
            setImpact(result.value);
            setError("");
          } else {
            setImpact(undefined);
          }
        });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [container.saveNamingConfiguration, draft, profile, projectId]);

  useEffect(() => {
    if (!run || run.status !== "running" || !container.getAssessmentRun) return;
    const timer = window.setInterval(() => {
      void container.getAssessmentRun?.execute(projectId).then((latest) => {
        if (latest) setRun(latest);
      });
    }, 120);
    return () => window.clearInterval(timer);
  }, [container.getAssessmentRun, projectId, run]);

  const usefulGod = useMemo(() => (draft ? usefulGodAnalysis(draft) : undefined), [draft]);
  const validationErrors: ConfigurationValidationError[] = error
    ? [{ sectionId: "basics", message: error }]
    : [];

  if (!profile || !draft)
    return (
      <main className="naming-configuration">
        <h1>{error ? "无法打开统一配置" : "正在读取统一配置…"}</h1>
        {error ? <p role="alert">{error}</p> : <p role="status">请稍候。</p>}
      </main>
    );

  const folkloreSlots = createFolkloreConfigurationSlots({
    value: draft,
    onChange: setDraft,
    rulePacks,
  });
  const enabledCoreModules = ["bazi_wuxing", "zodiac", "traditional"].filter(
    (moduleId) => draft.modules[moduleId as FolkloreModuleId].analysisEnabled,
  ).length;
  const needsBirth =
    (draft.modules.bazi_wuxing.analysisEnabled || draft.modules.zodiac.analysisEnabled) &&
    !draft.calendar.birthLocalDateTime;
  const needsFamilyReview = familyRulesArePending(draft.family);
  const needsUsefulGodDecision =
    draft.modules.bazi_wuxing.analysisEnabled &&
    Boolean(draft.calendar.birthLocalDateTime) &&
    !draft.usefulGodDecision;

  const save = async () => {
    if (!container.saveNamingConfiguration || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const saved = await container.saveNamingConfiguration.execute({
        projectId,
        expectedRevision: profile.configRevision,
        configuration: draft,
      });
      if (!saved.ok) {
        setError(saved.error);
        setValidationFocusKey((value) => value + 1);
        return;
      }
      setProfile(saved.value.profile);
      setDraft(toDraft(saved.value.profile));
      setImpact(saved.value.impact);
      if (saved.value.runId) {
        setRun({
          projectId,
          runId: saved.value.runId,
          configRevision: saved.value.profile.configRevision,
          status: "running",
          completed: 0,
          total: saved.value.impact.affectedCandidateCount,
        });
        setNotice("配置已保存，名字分析正在后台更新。");
      } else setNotice("配置已保存；本次只调整详情显示，无需重新评分。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <NamingConfigurationPage
      title={title}
      validationErrors={validationErrors}
      validationFocusKey={validationFocusKey}
      projectMeta={
        <>
          <span>配置版本 {profile.configRevision}</span>
          <a href={`/projects/${encodeURIComponent(projectId)}/names`}>进入名字长卷</a>
        </>
      }
      readinessArea={
        <>
          <p>
            民俗核心已启用 {enabledCoreModules}/3 项；当前基础权重 {draft.scoring.basicWeight}
            %、 民俗权重{" "}
            {Object.values(draft.modules).reduce((sum, item) => sum + item.weight, 0)}%。
          </p>
          <ul>
            <li>
              <a href="#configuration-calendar">
                {needsBirth ? "待补：出生日期与时辰" : "✓ 出生历法已填写"}
              </a>
            </li>
            <li>
              <a href="#configuration-bazi">
                {needsUsefulGodDecision
                  ? "待确认：采用的五行建议"
                  : needsBirth
                    ? "用神建议将在补充出生资料后生成"
                    : "✓ 用神采用项已确认"}
              </a>
            </li>
            <li>
              <a href="#configuration-family">
                {needsFamilyReview ? "待核对：字辈与亲属避讳" : "✓ 家庭约定已核对"}
              </a>
            </li>
          </ul>
        </>
      }
      presetArea={
        <div className="configuration-preset-actions">
          {configurationPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                const next = applyReviewedPreset(
                  { ...draft, projectId, configRevision: profile.configRevision },
                  preset.id,
                  rulePacks,
                );
                setDraft(toDraft(next));
                setNotice(
                  preset.id === "basic"
                    ? "已应用基础预设。"
                    : "已应用民俗预设；已核验规则参与评分，研究性规则保留详情但不计分。",
                );
              }}
            >
              {preset.label}
            </button>
          ))}
          {notice ? <p role="status">{notice}</p> : null}
        </div>
      }
      saveArea={
        <SaveImpactPanel
          {...(impact ? { impact } : {})}
          {...(run ? { run } : {})}
          saving={saving}
          onSave={save}
        />
      }
      sectionSlots={{
        basics: (
          <BasicConfigurationSections section="basics" value={draft} onChange={setDraft} />
        ),
        family: (
          <BasicConfigurationSections section="family" value={draft} onChange={setDraft} />
        ),
        inspiration: (
          <BasicConfigurationSections section="inspiration" value={draft} onChange={setDraft} />
        ),
        calendar: (
          <BasicConfigurationSections section="calendar" value={draft} onChange={setDraft} />
        ),
        bazi: (
          <>
            {folkloreSlots.bazi}
            <UsefulGodDecisionPanel
              {...(usefulGod ? { analysis: usefulGod } : {})}
              {...(draft.usefulGodDecision ? { value: draft.usefulGodDecision } : {})}
              onChange={(usefulGodDecision) =>
                setDraft((current) => {
                  if (!current) return current;
                  if (usefulGodDecision) return { ...current, usefulGodDecision };
                  return Object.fromEntries(
                    Object.entries(current).filter(([key]) => key !== "usefulGodDecision"),
                  ) as NamingProfileDraft;
                })
              }
            />
          </>
        ),
        zodiac: folkloreSlots.zodiac,
        tradition: folkloreSlots.tradition,
        "name-systems": folkloreSlots["name-systems"],
        scoring: folkloreSlots.scoring,
      }}
    />
  );
}

function toDraft(profile: NamingProfile): NamingProfileDraft {
  return Object.fromEntries(
    Object.entries(profile).filter(([key]) => key !== "projectId" && key !== "configRevision"),
  ) as NamingProfileDraft;
}

function applyReviewedPreset(
  profile: NamingProfile,
  presetId: ConfigurationPresetId,
  packs: readonly FolkloreRulePackManifest[],
): NamingProfile {
  const applied = applyConfigurationPreset(profile, presetId);
  const modules = Object.fromEntries(
    (
      Object.entries(applied.modules) as Array<
        [FolkloreModuleId, NamingProfile["modules"][FolkloreModuleId]]
      >
    ).map(([moduleId, module]) => {
      const reviewed = packs.some(
        (pack) =>
          pack.moduleId === moduleId &&
          pack.schoolId === module.schoolId &&
          pack.ruleVersion === module.ruleVersion &&
          pack.reviewStatus === "reviewed",
      );
      return [
        moduleId,
        module.analysisEnabled && !reviewed
          ? { ...module, analysisEnabled: false, weight: 0 }
          : module,
      ];
    }),
  ) as NamingProfile["modules"];
  const enabledWeight = Object.values(modules).reduce(
    (total, module) => total + module.weight,
    0,
  );
  return {
    ...applied,
    modules,
    scoring: {
      ...applied.scoring,
      basicWeight: enabledWeight ? 100 - enabledWeight : 100,
    },
  };
}

function usefulGodAnalysis(draft: NamingProfileDraft) {
  if (!draft.calendar.birthLocalDateTime) return undefined;
  try {
    const calendar = calculateBasicFiveElements({
      localDateTime: draft.calendar.birthLocalDateTime,
      timeZone: draft.calendar.timeZone,
      dayBoundary: draft.calendar.dayBoundary,
      timeKnown: draft.calendar.timeKnown,
    });
    return analyzeUsefulGod({
      pillars: calendar.pillars,
      dayMasterElement: calendar.dayMasterElement,
      distribution: calendar.distribution,
      monthBranch: calendar.pillars[1]?.[1] ?? "",
      ...(draft.usefulGodDecision
        ? { confirmedElements: draft.usefulGodDecision.confirmedElements }
        : {}),
    });
  } catch {
    return undefined;
  }
}
