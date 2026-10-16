import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import "./configuration.css";

export const NAMING_CONFIGURATION_SECTIONS = [
  {
    id: "calendar",
    label: "出生与历法",
    shortLabel: "出生历法",
    description: "出生日期、时辰、时区、交节与换日口径。",
  },
  {
    id: "bazi",
    label: "八字五行",
    shortLabel: "八字五行",
    description: "四柱、五行分布和用神多路径建议。",
  },
  {
    id: "zodiac",
    label: "生肖提示",
    shortLabel: "生肖",
    description: "按具名规则来源展示生肖宜忌提示，不作为硬过滤。",
  },
  {
    id: "tradition",
    label: "传统命名",
    shortLabel: "传统",
    description: "申繻五原则、传统避讳与文化取向。",
  },
  {
    id: "name-systems",
    label: "卦象与五格",
    shortLabel: "卦象五格",
    description: "姓名卦象、康熙笔画与五格三才流派设置。",
  },
  {
    id: "family",
    label: "家庭约定",
    shortLabel: "家庭",
    description: "字辈、指定字、亲属避讳与家庭方言备注。",
  },
  {
    id: "inspiration",
    label: "灵感来源",
    shortLabel: "灵感",
    description: "诗词、现代风格与历代状元等灵感来源。",
  },
  {
    id: "basics",
    label: "方案与表达",
    shortLabel: "基础表达",
    description: "姓氏、名字长度、书写与整体表达偏好。",
  },
  {
    id: "scoring",
    label: "综合评分",
    shortLabel: "评分",
    description: "模块权重、计分范围与高级评分选项。",
  },
] as const;

export type NamingConfigurationSectionId = (typeof NAMING_CONFIGURATION_SECTIONS)[number]["id"];

export type NamingConfigurationSectionSlots = Partial<
  Record<NamingConfigurationSectionId, ReactNode>
>;

export interface ConfigurationValidationError {
  readonly sectionId: NamingConfigurationSectionId;
  readonly message: string;
  /** The id of a focusable form control. The section heading is used when it is omitted. */
  readonly fieldId?: string;
}

export interface NamingConfigurationPageProps {
  readonly title: string;
  readonly description?: ReactNode;
  readonly projectMeta?: ReactNode;
  readonly sectionSlots: NamingConfigurationSectionSlots;
  readonly presetArea?: ReactNode;
  readonly readinessArea?: ReactNode;
  readonly saveArea?: ReactNode;
  readonly validationErrors?: readonly ConfigurationValidationError[];
  /** Change this value to focus the same validation error after another save attempt. */
  readonly validationFocusKey?: string | number;
}

const sectionAnchor = (id: NamingConfigurationSectionId) => `configuration-${id}`;

export function NamingConfigurationPage({
  title,
  description = "所有起名条件集中在这一页。启用的分析会参与综合评分，详情显示只控制结果是否展开。",
  projectMeta,
  sectionSlots,
  presetArea,
  readinessArea,
  saveArea,
  validationErrors = [],
  validationFocusKey,
}: NamingConfigurationPageProps) {
  const pageRef = useRef<HTMLElement>(null);
  const [activeSection, setActiveSection] = useState<NamingConfigurationSectionId>("calendar");
  const [expandedSections, setExpandedSections] = useState<
    Readonly<Record<NamingConfigurationSectionId, boolean>>
  >(
    () =>
      Object.fromEntries(NAMING_CONFIGURATION_SECTIONS.map(({ id }) => [id, true])) as Record<
        NamingConfigurationSectionId,
        boolean
      >,
  );
  const validationSignature = useMemo(
    () =>
      validationErrors
        .map(({ sectionId, fieldId, message }) => `${sectionId}:${fieldId ?? ""}:${message}`)
        .join("|"),
    [validationErrors],
  );

  const revealAndFocus = (error: ConfigurationValidationError) => {
    setActiveSection(error.sectionId);
    setExpandedSections((current) => ({ ...current, [error.sectionId]: true }));

    const focusTarget = () => {
      const page = pageRef.current;
      if (!page) return;
      const field = error.fieldId ? document.getElementById(error.fieldId) : null;
      const target =
        field instanceof HTMLElement && page.contains(field)
          ? field
          : page.querySelector<HTMLElement>(`#${sectionAnchor(error.sectionId)} summary`);
      target?.focus({ preventScroll: true });
      target?.scrollIntoView?.({ block: "center", inline: "nearest" });
    };

    window.requestAnimationFrame(focusTarget);
  };

  useEffect(() => {
    const firstError = validationErrors[0];
    if (firstError) revealAndFocus(firstError);
    // The stable signature prevents an inline errors array from creating a focus loop.
    // validationFocusKey lets a caller intentionally repeat the same failed save attempt.
  }, [validationSignature, validationFocusKey]);

  return (
    <main className="naming-configuration" ref={pageRef}>
      <header className="naming-configuration__header">
        <div>
          <p className="naming-configuration__kicker">统一配置 · 一页完成</p>
          <h1>{title}</h1>
          <div className="naming-configuration__description">{description}</div>
        </div>
        {projectMeta ? <div className="naming-configuration__meta">{projectMeta}</div> : null}
      </header>

      {readinessArea ? (
        <section
          className="configuration-readiness paper-card"
          aria-labelledby="readiness-heading"
        >
          <div>
            <p className="naming-configuration__kicker">先补资料，再看结论</p>
            <h2 id="readiness-heading">民俗分析准备度</h2>
          </div>
          <div className="configuration-readiness__content">{readinessArea}</div>
        </section>
      ) : null}

      {presetArea ? (
        <section className="configuration-presets paper-card" aria-labelledby="preset-heading">
          <div className="configuration-presets__heading">
            <p className="naming-configuration__kicker">快速起步</p>
            <h2 id="preset-heading">配置预设</h2>
            <p>一键建立起点，应用后仍可逐项调整。</p>
          </div>
          <div className="configuration-presets__content">{presetArea}</div>
        </section>
      ) : null}

      {validationErrors.length > 0 ? (
        <section
          className="configuration-errors"
          role="alert"
          aria-labelledby="configuration-errors-heading"
        >
          <h2 id="configuration-errors-heading">还有内容需要检查</h2>
          <p>已保留当前填写内容，请从以下位置继续。</p>
          <ul>
            {validationErrors.map((error, index) => {
              const section = NAMING_CONFIGURATION_SECTIONS.find(
                ({ id }) => id === error.sectionId,
              );
              return (
                <li key={`${error.sectionId}-${error.fieldId ?? "section"}-${index}`}>
                  <button type="button" onClick={() => revealAndFocus(error)}>
                    <strong>{section?.label}</strong>
                    <span>{error.message}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <div className="naming-configuration__layout">
        <nav className="configuration-nav" aria-label="配置章节">
          <p>九项配置</p>
          <ol>
            {NAMING_CONFIGURATION_SECTIONS.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#${sectionAnchor(section.id)}`}
                  aria-current={activeSection === section.id ? "location" : undefined}
                  onClick={() => {
                    setActiveSection(section.id);
                    setExpandedSections((current) => ({ ...current, [section.id]: true }));
                  }}
                >
                  <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  {section.shortLabel}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="configuration-sections">
          {NAMING_CONFIGURATION_SECTIONS.map((section, index) => (
            <details
              className="configuration-section paper-card"
              id={sectionAnchor(section.id)}
              key={section.id}
              open={expandedSections[section.id]}
              onToggle={(event) => {
                const open = event.currentTarget.open;
                setExpandedSections((current) =>
                  current[section.id] === open ? current : { ...current, [section.id]: open },
                );
                if (open) setActiveSection(section.id);
              }}
            >
              <summary>
                <span className="configuration-section__number" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="configuration-section__heading">
                  <strong>{section.label}</strong>
                  <small>{section.description}</small>
                </span>
                <span className="configuration-section__toggle" aria-hidden="true" />
              </summary>
              <div className="configuration-section__content">
                {sectionSlots[section.id] ?? null}
              </div>
            </details>
          ))}
        </div>
      </div>

      {saveArea ? (
        <footer className="configuration-save" aria-label="保存配置">
          {saveArea}
        </footer>
      ) : null}
    </main>
  );
}
