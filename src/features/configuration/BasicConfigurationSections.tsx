import type { ReactNode } from "react";
import type { NamingProfileDraft } from "../../domain/project/profile";

export type BasicConfigurationSectionId = "basics" | "family" | "inspiration" | "calendar";

type BasicConfigurationSectionsProps = {
  value: NamingProfileDraft;
  onChange: (value: NamingProfileDraft) => void;
  /**
   * Render only the controls for one page-owned section. In this mode the parent page owns
   * the section landmark, heading and `configuration-*` anchor.
   */
  section?: BasicConfigurationSectionId;
};

export type BasicConfigurationSectionSlots = Record<BasicConfigurationSectionId, ReactNode>;

type StringListProps = {
  addLabel: string;
  itemLabel: string;
  items: string[];
  maxLength?: number;
  onChange: (items: string[]) => void;
};

type RelativeAvoidance = NonNullable<
  NamingProfileDraft["family"]["relativeAvoidances"]
>[number];

const inspirationOptions = [
  ["poetry", "诗词典故"],
  ["modern", "现代组合"],
  ["historical", "历代人物与状元灵感"],
] as const;

const genderExpressionOptions = [
  ["unrestricted", "不限"],
  ["neutral", "中性"],
  ["masculine", "偏阳刚"],
  ["feminine", "偏柔美"],
] as const;

/**
 * The single controlled editor for every non-folklore-module field in a naming profile.
 * The page owns saving and validation; this component only emits complete immutable drafts.
 */
export function BasicConfigurationSections({
  value,
  onChange,
  section,
}: BasicConfigurationSectionsProps) {
  const patchBasics = (patch: Partial<NamingProfileDraft["basics"]>) =>
    onChange({ ...value, basics: { ...value.basics, ...patch } });
  const patchFamily = (patch: Partial<NamingProfileDraft["family"]>) =>
    onChange({ ...value, family: { ...value.family, ...patch } });
  const patchCalendar = (patch: Partial<NamingProfileDraft["calendar"]>) =>
    onChange({ ...value, calendar: { ...value.calendar, ...patch } });

  return (
    <>
      {!section || section === "basics" ? (
        <StandaloneSection section={section} id="basics" title="基础设置">
          <label>
            姓氏
            <input
              autoComplete="off"
              maxLength={4}
              value={value.basics.surname}
              onChange={(event) => patchBasics({ surname: event.target.value })}
            />
          </label>
          <label>
            姓氏读音（可选）
            <input
              autoComplete="off"
              maxLength={80}
              placeholder="例如 shàn；复姓用空格分隔"
              value={value.basics.surnamePinyin ?? ""}
              onChange={(event) => patchBasics({ surnamePinyin: event.target.value })}
            />
          </label>
          <label>
            姓氏结构
            <select
              value={value.basics.surnameType}
              onChange={(event) =>
                patchBasics({
                  surnameType: event.target
                    .value as NamingProfileDraft["basics"]["surnameType"],
                })
              }
            >
              <option value="single">单姓</option>
              <option value="compound">传统复姓</option>
              <option value="combined_parental">父母组合姓</option>
            </select>
          </label>
          <label>
            名字长度
            <select
              value={value.basics.givenNameLength}
              onChange={(event) =>
                patchBasics({ givenNameLength: Number(event.target.value) as 1 | 2 })
              }
            >
              <option value={1}>一字名</option>
              <option value={2}>二字名</option>
            </select>
          </label>
          <label>
            宝宝性别
            <select
              value={value.basics.childGender ?? "unknown"}
              onChange={(event) =>
                patchBasics({
                  childGender: event.target.value as NonNullable<
                    NamingProfileDraft["basics"]["childGender"]
                  >,
                })
              }
            >
              <option value="male">男孩</option>
              <option value="female">女孩</option>
              <option value="unknown">暂未确定</option>
            </select>
          </label>
          <label>
            性别表达
            <select
              value={value.basics.genderExpression}
              onChange={(event) =>
                patchBasics({
                  genderExpression: event.target
                    .value as NamingProfileDraft["basics"]["genderExpression"],
                })
              }
            >
              {genderExpressionOptions.map(([optionValue, label]) => (
                <option key={optionValue} value={optionValue}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <StringListEditor
            addLabel="添加风格"
            itemLabel="风格偏好"
            items={value.basics.styleTags}
            maxLength={30}
            onChange={(styleTags) => patchBasics({ styleTags })}
          />
          <label>
            书写复杂度
            <select
              value={value.basics.writingComplexity}
              onChange={(event) =>
                patchBasics({
                  writingComplexity: event.target
                    .value as NamingProfileDraft["basics"]["writingComplexity"],
                })
              }
            >
              <option value="simple">尽量简洁</option>
              <option value="balanced">笔画均衡</option>
              <option value="unrestricted">不限</option>
            </select>
          </label>
          <label>
            <input
              checked={value.basics.pinyinFriendly}
              type="checkbox"
              onChange={(event) => patchBasics({ pinyinFriendly: event.target.checked })}
            />
            重视拼音辨识
          </label>
          <label>
            家庭方言与叫名备注（可选）
            <textarea
              maxLength={500}
              value={value.basics.dialectNotes ?? ""}
              onChange={(event) => patchBasics({ dialectNotes: event.target.value })}
            />
          </label>
        </StandaloneSection>
      ) : null}

      {!section || section === "family" ? (
        <StandaloneSection section={section} id="family" title="家庭约束">
          <fieldset>
            <legend>必须遵守的字辈或避讳</legend>
            {[
              ["present", "有"],
              ["none", "没有"],
              ["unknown", "尚未核对"],
            ].map(([optionValue, label]) => (
              <label key={optionValue}>
                <input
                  checked={value.family.constraintKnowledge === optionValue}
                  name="constraint-knowledge"
                  type="radio"
                  value={optionValue}
                  onChange={() =>
                    patchFamily({
                      constraintKnowledge:
                        optionValue as NamingProfileDraft["family"]["constraintKnowledge"],
                    })
                  }
                />
                {label}
              </label>
            ))}
          </fieldset>
          <RequiredCharacterEditor
            items={value.family.requiredCharacters}
            onChange={(requiredCharacters) => patchFamily({ requiredCharacters })}
          />
          <StringListEditor
            addLabel="添加字辈字"
            itemLabel="字辈字"
            items={value.family.generationCharacters}
            maxLength={1}
            onChange={(generationCharacters) => patchFamily({ generationCharacters })}
          />
          <StringListEditor
            addLabel="添加避字"
            itemLabel="避字"
            items={value.family.avoidCharacters}
            maxLength={1}
            onChange={(avoidCharacters) => patchFamily({ avoidCharacters })}
          />
          <StringListEditor
            addLabel="添加亲属姓名"
            itemLabel="亲属姓名"
            items={value.family.relativeNames}
            maxLength={20}
            onChange={(relativeNames) => patchFamily({ relativeNames })}
          />
          <RelativeAvoidanceList
            items={value.family.relativeAvoidances ?? []}
            onChange={(relativeAvoidances) => patchFamily({ relativeAvoidances })}
          />
          <StringListEditor
            addLabel="添加禁用组合"
            itemLabel="禁用名字组合"
            items={value.family.forbiddenCombinations}
            maxLength={8}
            onChange={(forbiddenCombinations) => patchFamily({ forbiddenCombinations })}
          />
        </StandaloneSection>
      ) : null}

      {!section || section === "inspiration" ? (
        <StandaloneSection section={section} id="inspiration" title="灵感来源">
          <fieldset>
            <legend>用于生成名字的来源</legend>
            {inspirationOptions.map(([source, label]) => {
              const checked = value.inspiration.sources.includes(source);
              return (
                <label key={source}>
                  <input
                    checked={checked}
                    disabled={checked && value.inspiration.sources.length === 1}
                    type="checkbox"
                    onChange={(event) =>
                      onChange({
                        ...value,
                        inspiration: {
                          sources: event.target.checked
                            ? [...value.inspiration.sources, source]
                            : value.inspiration.sources.filter((item) => item !== source),
                        },
                      })
                    }
                  />
                  {label}
                </label>
              );
            })}
          </fieldset>
          <p>至少保留一个来源；历代人物与状元只作为借字灵感，不因身份加分。</p>
        </StandaloneSection>
      ) : null}

      {!section || section === "calendar" ? (
        <StandaloneSection section={section} id="calendar" title="历法口径">
          <label>
            <input
              checked={value.calendar.timeKnown}
              type="checkbox"
              onChange={(event) =>
                patchCalendar({
                  timeKnown: event.target.checked,
                  birthLocalDateTime: event.target.checked
                    ? undefined
                    : value.calendar.birthLocalDateTime?.slice(0, 10),
                })
              }
            />
            出生时辰已知
          </label>
          <label>
            {value.calendar.timeKnown ? "公历出生日期与时间" : "公历出生日期"}（可选）
            <input
              min="1900-01-01"
              max="2100-12-31T23:59"
              type={value.calendar.timeKnown ? "datetime-local" : "date"}
              value={value.calendar.birthLocalDateTime ?? ""}
              onChange={(event) => patchCalendar({ birthLocalDateTime: event.target.value })}
            />
          </label>
          <label>
            历法时区
            <input
              list="configuration-time-zone-options"
              value={value.calendar.timeZone}
              onChange={(event) => patchCalendar({ timeZone: event.target.value })}
            />
            <datalist id="configuration-time-zone-options">
              <option value="Asia/Shanghai" />
            </datalist>
          </label>
          <label>
            四柱换日口径
            <select
              value={value.calendar.dayBoundary}
              onChange={(event) =>
                patchCalendar({
                  dayBoundary: event.target
                    .value as NamingProfileDraft["calendar"]["dayBoundary"],
                })
              }
            >
              <option value="midnight">00:00 午夜换日</option>
              <option value="zi">23:00 晚子时换日</option>
            </select>
          </label>
          <label>
            生肖换年口径
            <select
              value={value.calendar.zodiacConvention}
              onChange={(event) =>
                patchCalendar({
                  zodiacConvention: event.target
                    .value as NamingProfileDraft["calendar"]["zodiacConvention"],
                })
              }
            >
              <option value="lunar">农历正月初一</option>
              <option value="pillar">立春交节（四柱年支）</option>
            </select>
          </label>
          <label>
            真太阳时修正
            <select disabled value={value.calendar.trueSolarTimeCorrection}>
              <option value="not_applied">未采用</option>
            </select>
          </label>
          <label>
            历史夏令时修正
            <select disabled value={value.calendar.historicalDstCorrection}>
              <option value="not_applied">未采用</option>
            </select>
          </label>
          <p>当前版本不会暗中应用真太阳时或历史夏令时修正。</p>
        </StandaloneSection>
      ) : null}
    </>
  );
}

/** Build the four non-folklore slots consumed by `NamingConfigurationPage`. */
export function createBasicConfigurationSlots(
  value: NamingProfileDraft,
  onChange: (value: NamingProfileDraft) => void,
): BasicConfigurationSectionSlots {
  return {
    basics: <BasicConfigurationSections section="basics" value={value} onChange={onChange} />,
    family: <BasicConfigurationSections section="family" value={value} onChange={onChange} />,
    inspiration: (
      <BasicConfigurationSections section="inspiration" value={value} onChange={onChange} />
    ),
    calendar: (
      <BasicConfigurationSections section="calendar" value={value} onChange={onChange} />
    ),
  };
}

function StandaloneSection({
  section,
  id,
  title,
  children,
}: {
  section: BasicConfigurationSectionId | undefined;
  id: BasicConfigurationSectionId;
  title: string;
  children: ReactNode;
}) {
  if (section) return <>{children}</>;

  const headingId = `configuration-${id}-heading`;
  return (
    <section aria-labelledby={headingId} id={`configuration-${id}`}>
      <h2 id={headingId}>{title}</h2>
      {children}
    </section>
  );
}

function StringListEditor({
  addLabel,
  itemLabel,
  items,
  maxLength,
  onChange,
}: StringListProps) {
  return (
    <fieldset>
      <legend>{itemLabel}</legend>
      {items.map((item, index) => (
        <div key={index}>
          <label>
            {itemLabel} {index + 1}
            <input
              maxLength={maxLength}
              value={item}
              onChange={(event) =>
                onChange(
                  items.map((current, itemIndex) =>
                    itemIndex === index ? event.target.value : current,
                  ),
                )
              }
            />
          </label>
          <button
            aria-label={`删除${itemLabel} ${index + 1}`}
            type="button"
            onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
          >
            删除
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, ""])}>
        {addLabel}
      </button>
    </fieldset>
  );
}

function RequiredCharacterEditor({
  items,
  onChange,
}: {
  items: NamingProfileDraft["family"]["requiredCharacters"];
  onChange: (items: NamingProfileDraft["family"]["requiredCharacters"]) => void;
}) {
  return (
    <fieldset>
      <legend>指定字</legend>
      {items.map((item, index) => (
        <div key={index}>
          <label>
            指定字 {index + 1}
            <input
              maxLength={1}
              value={item.char}
              onChange={(event) =>
                onChange(
                  items.map((current, itemIndex) =>
                    itemIndex === index ? { ...current, char: event.target.value } : current,
                  ),
                )
              }
            />
          </label>
          <label>
            指定字 {index + 1} 的位置
            <select
              value={item.position}
              onChange={(event) =>
                onChange(
                  items.map((current, itemIndex) =>
                    itemIndex === index
                      ? {
                          ...current,
                          position:
                            event.target.value === "any"
                              ? "any"
                              : (Number(event.target.value) as 1 | 2),
                        }
                      : current,
                  ),
                )
              }
            >
              <option value="any">任意位置</option>
              <option value={1}>名的第一位</option>
              <option value={2}>名的第二位</option>
            </select>
          </label>
          <button
            aria-label={`删除指定字 ${index + 1}`}
            type="button"
            onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
          >
            删除
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, { char: "", position: "any" }])}>
        添加指定字
      </button>
    </fieldset>
  );
}

function RelativeAvoidanceList({
  items,
  onChange,
}: {
  items: RelativeAvoidance[];
  onChange: (items: RelativeAvoidance[]) => void;
}) {
  const patchItem = (index: number, patch: Partial<RelativeAvoidance>) =>
    onChange(
      items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );

  return (
    <fieldset>
      <legend>逐亲属避讳规则</legend>
      {items.map((item, index) => (
        <fieldset key={index}>
          <legend>亲属避讳 {index + 1}</legend>
          <label>
            亲属完整姓名 {index + 1}
            <input
              maxLength={20}
              value={item.fullName}
              onChange={(event) => patchItem(index, { fullName: event.target.value })}
            />
          </label>
          <label>
            避讳方式 {index + 1}
            <select
              value={item.mode}
              onChange={(event) =>
                patchItem(index, { mode: event.target.value as RelativeAvoidance["mode"] })
              }
            >
              <option value="whole-name">避完整姓名</option>
              <option value="same-character">避名中同字</option>
              <option value="same-sound">避名中同音（不分声调）</option>
            </select>
          </label>
          {item.mode !== "whole-name" ? (
            <label>
              亲属的名 {index + 1}（不含姓）
              <input
                maxLength={4}
                value={item.givenName}
                onChange={(event) => patchItem(index, { givenName: event.target.value })}
              />
            </label>
          ) : null}
          {item.mode === "same-sound" ? (
            <fieldset>
              <legend>亲属名逐字读音 {index + 1}</legend>
              {item.pinyin.map((syllable, syllableIndex) => (
                <div key={syllableIndex}>
                  <label>
                    第 {syllableIndex + 1} 字读音
                    <input
                      maxLength={20}
                      value={syllable}
                      onChange={(event) =>
                        patchItem(index, {
                          pinyin: item.pinyin.map((current, pinyinIndex) =>
                            pinyinIndex === syllableIndex ? event.target.value : current,
                          ),
                        })
                      }
                    />
                  </label>
                  <button
                    aria-label={`删除亲属避讳 ${index + 1} 的读音 ${syllableIndex + 1}`}
                    type="button"
                    onClick={() =>
                      patchItem(index, {
                        pinyin: item.pinyin.filter(
                          (_, pinyinIndex) => pinyinIndex !== syllableIndex,
                        ),
                      })
                    }
                  >
                    删除
                  </button>
                </div>
              ))}
              <button
                disabled={item.pinyin.length >= 4}
                type="button"
                onClick={() => patchItem(index, { pinyin: [...item.pinyin, ""] })}
              >
                添加读音音节
              </button>
            </fieldset>
          ) : null}
          <button
            aria-label={`删除亲属避讳 ${index + 1}`}
            type="button"
            onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
          >
            删除此规则
          </button>
        </fieldset>
      ))}
      <button
        disabled={items.length >= 30}
        type="button"
        onClick={() =>
          onChange([...items, { fullName: "", givenName: "", mode: "whole-name", pinyin: [] }])
        }
      >
        添加亲属避讳
      </button>
    </fieldset>
  );
}
