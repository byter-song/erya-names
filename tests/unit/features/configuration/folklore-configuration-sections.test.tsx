import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { FolkloreRulePackManifest } from "../../../../src/data/folklore/loadRulePacks";
import { FolkloreConfigurationSections } from "../../../../src/features/configuration/FolkloreConfigurationSections";
import {
  namingProfileSchema,
  type FolkloreModuleId,
  type NamingProfileDraft,
} from "../../../../src/domain/project/profile";
import { namingProfileFixture } from "../../../fixtures/namingProfile";

const manifests: FolkloreRulePackManifest[] = [
  manifest("bazi_wuxing", "reviewed-bazi", "2.0.0", "reviewed", "dayMaster"),
  manifest("bazi_wuxing", "research-bazi", "1.0.0", "research_only", "dayMaster"),
  manifest(
    "zodiac",
    "zodiac-radical-hints-v1",
    "1.0.0",
    "research_only",
    "givenNameCharacters",
  ),
  manifest(
    "traditional",
    "zuozhuan-naming-principles-v1",
    "1.0.0",
    "research_only",
    "fullName",
  ),
  manifest(
    "name_hexagram",
    "meihua-name-stroke-erya-v1",
    "1.0.0",
    "research_only",
    "surnameKangxiStrokes",
  ),
  manifest(
    "five_grids",
    "kumasaki-five-grid-1930-ndl-v1",
    "1.0.0",
    "research_only",
    "surnameStructure",
  ),
];

describe("FolkloreConfigurationSections", () => {
  it("provides independent analysis and detail switches for every folklore module", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(<Harness initial={draftWithReviewedBazi()} onChange={changed} />);

    expect(screen.getAllByRole("checkbox", { name: "启用分析" })).toHaveLength(5);
    expect(screen.getAllByRole("checkbox", { name: "详情显示" })).toHaveLength(5);

    const bazi = screen.getByRole("group", { name: "八字、五行与用神" });
    await user.click(within(bazi).getByRole("checkbox", { name: "启用分析" }));

    expect(changed).toHaveBeenLastCalledWith(
      expect.objectContaining({
        modules: expect.objectContaining({
          bazi_wuxing: expect.objectContaining({
            analysisEnabled: true,
            detailsVisible: false,
            weight: 5,
          }),
        }),
      }),
    );

    await user.click(within(bazi).getByRole("checkbox", { name: "详情显示" }));
    expect(within(bazi).getByRole("checkbox", { name: "启用分析" })).toBeChecked();
    expect(within(bazi).getByRole("checkbox", { name: "详情显示" })).toBeChecked();
  });

  it("labels research-only material and prevents it from being enabled for scoring", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(<Harness initial={draftWithReviewedBazi()} onChange={changed} />);

    const zodiac = screen.getByRole("group", { name: "生肖选字提示" });
    expect(within(zodiac).getByText(/研究性参考，当前不计分/)).toBeInTheDocument();
    expect(within(zodiac).getByText(/不会纳入综合分/)).toBeInTheDocument();
    expect(within(zodiac).getByRole("checkbox", { name: "启用分析" })).toBeDisabled();

    await user.click(within(zodiac).getByRole("checkbox", { name: "详情显示" }));
    expect(within(zodiac).getByRole("checkbox", { name: "详情显示" })).toBeChecked();
    expect(within(zodiac).getByRole("checkbox", { name: "启用分析" })).not.toBeChecked();
  });

  it("supports weight, school and version changes while clearing analysis for unreviewed packs", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    const initial = draftWithReviewedBazi();
    initial.modules.bazi_wuxing = {
      ...initial.modules.bazi_wuxing,
      analysisEnabled: true,
      weight: 20,
    };
    render(<Harness initial={initial} onChange={changed} />);

    const bazi = screen.getByRole("group", { name: "八字、五行与用神" });
    await user.clear(within(bazi).getByRole("spinbutton", { name: "八字、五行与用神权重" }));
    await user.type(
      within(bazi).getByRole("spinbutton", { name: "八字、五行与用神权重" }),
      "25",
    );
    expect(changed).toHaveBeenCalled();

    await user.selectOptions(
      within(bazi).getByRole("combobox", { name: "八字、五行与用神流派" }),
      "research-bazi",
    );

    expect(within(bazi).getByRole("checkbox", { name: "启用分析" })).not.toBeChecked();
    expect(within(bazi).getByText(/研究性参考，当前不计分/)).toBeInTheDocument();
    expect(changed).toHaveBeenLastCalledWith(
      expect.objectContaining({
        modules: expect.objectContaining({
          bazi_wuxing: expect.objectContaining({
            analysisEnabled: false,
            schoolId: "research-bazi",
            ruleVersion: "1.0.0",
          }),
        }),
      }),
    );
  });

  it("can render a single slot without adding a competing page anchor", () => {
    render(
      <FolkloreConfigurationSections
        onChange={vi.fn()}
        rulePacks={manifests}
        section="name-systems"
        value={draftWithReviewedBazi()}
      />,
    );

    expect(screen.getByRole("group", { name: "姓名卦象" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "五格与三才" })).toBeInTheDocument();
    expect(document.querySelector("[id^='configuration-']")).toBeNull();
  });
});

function Harness({
  initial,
  onChange,
}: {
  initial: NamingProfileDraft;
  onChange: (value: NamingProfileDraft) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <FolkloreConfigurationSections
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      rulePacks={manifests}
      value={value}
    />
  );
}

function draftWithReviewedBazi(): NamingProfileDraft {
  const profile = namingProfileSchema.parse(namingProfileFixture());
  return {
    basics: profile.basics,
    family: profile.family,
    inspiration: profile.inspiration,
    calendar: profile.calendar,
    scoring: profile.scoring,
    ...(profile.usefulGodDecision ? { usefulGodDecision: profile.usefulGodDecision } : {}),
    modules: {
      ...profile.modules,
      bazi_wuxing: {
        ...profile.modules.bazi_wuxing,
        schoolId: "reviewed-bazi",
        ruleVersion: "2.0.0",
      },
      zodiac: {
        ...profile.modules.zodiac,
        schoolId: "zodiac-radical-hints-v1",
        ruleVersion: "1.0.0",
      },
      traditional: {
        ...profile.modules.traditional,
        schoolId: "zuozhuan-naming-principles-v1",
        ruleVersion: "1.0.0",
      },
      name_hexagram: {
        ...profile.modules.name_hexagram,
        schoolId: "meihua-name-stroke-erya-v1",
        ruleVersion: "1.0.0",
      },
      five_grids: {
        ...profile.modules.five_grids,
        schoolId: "kumasaki-five-grid-1930-ndl-v1",
        ruleVersion: "1.0.0",
      },
    },
  };
}

function manifest(
  moduleId: FolkloreModuleId,
  schoolId: string,
  ruleVersion: string,
  reviewStatus: FolkloreRulePackManifest["reviewStatus"],
  analysisInput: string,
): FolkloreRulePackManifest {
  return {
    moduleId,
    schoolId,
    ruleVersion,
    reviewStatus,
    checksum: `sha256:${"a".repeat(64)}`,
    sourceIds: ["source-a"],
    applicableInputs: [analysisInput],
  };
}
