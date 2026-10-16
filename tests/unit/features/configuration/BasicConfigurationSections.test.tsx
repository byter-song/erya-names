import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { NamingProfile, NamingProfileDraft } from "../../../../src/domain/project/profile";
import {
  BasicConfigurationSections,
  createBasicConfigurationSlots,
} from "../../../../src/features/configuration/BasicConfigurationSections";
import { NamingConfigurationPage } from "../../../../src/features/configuration/NamingConfigurationPage";
import { namingProfileFixture } from "../../../fixtures/namingProfile";

describe("BasicConfigurationSections", () => {
  it("exposes one accessible centralized entry for every basic and calendar field", () => {
    render(<Harness initial={configurationFixture()} />);

    expect(screen.getByRole("region", { name: "基础设置" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "家庭约束" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "灵感来源" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "历法口径" })).toBeInTheDocument();

    [
      "姓氏",
      "姓氏读音（可选）",
      "姓氏结构",
      "名字长度",
      "宝宝性别",
      "性别表达",
      "书写复杂度",
      "重视拼音辨识",
      "家庭方言与叫名备注（可选）",
      "出生时辰已知",
      "公历出生日期与时间（可选）",
      "历法时区",
      "四柱换日口径",
      "生肖换年口径",
      "真太阳时修正",
      "历史夏令时修正",
    ].forEach((label) => expect(screen.getAllByLabelText(label)).toHaveLength(1));

    expect(screen.getByLabelText("真太阳时修正")).toBeDisabled();
    expect(screen.getByLabelText("历史夏令时修正")).toBeDisabled();
  });

  it("composes four page slots without duplicate fields or configuration anchors", () => {
    render(<SlottedHarness initial={configurationFixture()} />);

    [
      "姓氏",
      "姓氏读音（可选）",
      "姓氏结构",
      "名字长度",
      "宝宝性别",
      "性别表达",
      "家庭方言与叫名备注（可选）",
      "出生时辰已知",
      "公历出生日期与时间（可选）",
      "历法时区",
      "四柱换日口径",
      "生肖换年口径",
    ].forEach((label) => expect(screen.getAllByLabelText(label)).toHaveLength(1));

    for (const id of ["basics", "family", "inspiration", "calendar"]) {
      expect(document.querySelectorAll(`#configuration-${id}`)).toHaveLength(1);
      expect(document.querySelector(`#configuration-${id} section`)).not.toBeInTheDocument();
    }

    const configurationIds = [
      ...document.querySelectorAll<HTMLElement>("[id^='configuration-']"),
    ]
      .map((element) => element.id)
      .filter(Boolean);
    expect(new Set(configurationIds).size).toBe(configurationIds.length);
  });

  it("edits basic preferences and all three inspiration sources as a controlled draft", async () => {
    const user = userEvent.setup();
    render(<Harness initial={configurationFixture()} />);

    const surname = screen.getByLabelText("姓氏");
    await user.clear(surname);
    await user.type(surname, "欧阳");
    await user.selectOptions(screen.getByLabelText("姓氏结构"), "compound");
    await user.selectOptions(screen.getByLabelText("名字长度"), "1");
    await user.selectOptions(screen.getByLabelText("性别表达"), "neutral");
    await user.selectOptions(screen.getByLabelText("书写复杂度"), "simple");
    await user.click(screen.getByLabelText("重视拼音辨识"));
    await user.click(screen.getByRole("button", { name: "添加风格" }));
    await user.type(screen.getByLabelText("风格偏好 2"), "清朗自然");
    await user.click(screen.getByLabelText("现代组合"));
    await user.click(screen.getByLabelText("历代人物与状元灵感"));

    const current = readDraft();
    expect(current.basics).toMatchObject({
      surname: "欧阳",
      surnameType: "compound",
      givenNameLength: 1,
      genderExpression: "neutral",
      writingComplexity: "simple",
      pinyinFriendly: true,
      styleTags: ["文雅书卷", "清朗自然"],
    });
    expect(current.inspiration.sources).toEqual(["poetry", "historical"]);
  });

  it("edits family rules without flattening their position or per-relative semantics", async () => {
    const user = userEvent.setup();
    render(<Harness initial={configurationFixture()} />);

    await user.click(screen.getByLabelText("有"));
    await user.clear(screen.getByLabelText("指定字 1"));
    await user.type(screen.getByLabelText("指定字 1"), "承");
    await user.selectOptions(screen.getByLabelText("指定字 1 的位置"), "1");
    await user.click(screen.getByRole("button", { name: "添加字辈字" }));
    await user.type(screen.getByLabelText("字辈字 2"), "远");
    await user.clear(screen.getByLabelText("避字 1"));
    await user.type(screen.getByLabelText("避字 1"), "病");
    await user.clear(screen.getByLabelText("亲属姓名 1"));
    await user.type(screen.getByLabelText("亲属姓名 1"), "宋清和");
    await user.clear(screen.getByLabelText("禁用名字组合 1"));
    await user.type(screen.getByLabelText("禁用名字组合 1"), "子轩");
    await user.selectOptions(screen.getByLabelText("避讳方式 1"), "same-sound");
    await user.click(screen.getByRole("button", { name: "添加读音音节" }));
    await user.type(screen.getByLabelText("第 2 字读音"), "he");

    expect(readDraft().family).toMatchObject({
      constraintKnowledge: "present",
      requiredCharacters: [{ char: "承", position: 1 }],
      generationCharacters: ["知", "远"],
      avoidCharacters: ["病"],
      relativeNames: ["宋清和"],
      forbiddenCombinations: ["子轩"],
      relativeAvoidances: [
        {
          fullName: "宋清和",
          givenName: "清和",
          mode: "same-sound",
          pinyin: ["qing", "he"],
        },
      ],
    });
  });

  it("updates birth-time precision, time zone, day boundary and zodiac convention", async () => {
    const user = userEvent.setup();
    render(<Harness initial={configurationFixture()} />);

    await user.clear(screen.getByLabelText("历法时区"));
    await user.type(screen.getByLabelText("历法时区"), "Asia/Hong_Kong");
    await user.selectOptions(screen.getByLabelText("四柱换日口径"), "zi");
    await user.selectOptions(screen.getByLabelText("生肖换年口径"), "pillar");
    await user.click(screen.getByLabelText("出生时辰已知"));

    expect(screen.getByLabelText("公历出生日期（可选）")).toHaveValue("2024-01-02");
    expect(readDraft().calendar).toMatchObject({
      birthLocalDateTime: "2024-01-02",
      timeKnown: false,
      timeZone: "Asia/Hong_Kong",
      dayBoundary: "zi",
      zodiacConvention: "pillar",
      trueSolarTimeCorrection: "not_applied",
      historicalDstCorrection: "not_applied",
    });
  });
});

function Harness({ initial }: { initial: NamingProfileDraft }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <BasicConfigurationSections value={value} onChange={setValue} />
      <output data-testid="configuration-draft">{JSON.stringify(value)}</output>
    </>
  );
}

function SlottedHarness({ initial }: { initial: NamingProfileDraft }) {
  const [value, setValue] = useState(initial);
  return (
    <NamingConfigurationPage
      title="统一配置"
      sectionSlots={createBasicConfigurationSlots(value, setValue)}
    />
  );
}

function readDraft(): NamingProfileDraft {
  return JSON.parse(
    screen.getByTestId("configuration-draft").textContent ?? "{}",
  ) as NamingProfileDraft;
}

function configurationFixture(): NamingProfileDraft {
  const profile: NamingProfile = {
    ...namingProfileFixture(),
    basics: {
      ...namingProfileFixture().basics,
      surnamePinyin: "sòng",
      childGender: "unknown",
      styleTags: ["文雅书卷"],
      dialectNotes: "吴语试读",
    },
    family: {
      constraintKnowledge: "unknown",
      requiredCharacters: [{ char: "知", position: "any" }],
      generationCharacters: ["知"],
      avoidCharacters: ["疾"],
      relativeNames: ["宋清远"],
      relativeAvoidances: [
        {
          fullName: "宋清和",
          givenName: "清和",
          mode: "same-character",
          pinyin: ["qing"],
        },
      ],
      forbiddenCombinations: ["明明"],
    },
    inspiration: { sources: ["poetry", "modern"] },
    calendar: {
      ...namingProfileFixture().calendar,
      birthLocalDateTime: "2024-01-02T08:30",
      timeKnown: true,
    },
  };
  return {
    basics: profile.basics,
    family: profile.family,
    inspiration: profile.inspiration,
    calendar: profile.calendar,
    modules: profile.modules,
    scoring: profile.scoring,
  };
}
