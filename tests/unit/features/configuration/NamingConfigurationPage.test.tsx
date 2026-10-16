import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  NAMING_CONFIGURATION_SECTIONS,
  NamingConfigurationPage,
} from "../../../../src/features/configuration/NamingConfigurationPage";

describe("NamingConfigurationPage", () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    window.requestAnimationFrame = (callback) => {
      callback(0);
      return 1;
    };
  });

  it("renders nine anchored sections in one configuration document with preset and save slots", () => {
    render(
      <NamingConfigurationPage
        title="宋氏 · 山水版"
        projectMeta={<span>配置版本 3</span>}
        presetArea={<button type="button">传统核心</button>}
        saveArea={<button type="button">保存全部配置</button>}
        sectionSlots={{
          basics: <label htmlFor="surname">姓氏</label>,
          scoring: <p>评分设置</p>,
        }}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "宋氏 · 山水版" })).toBeVisible();
    expect(screen.getByText("配置版本 3")).toBeVisible();
    expect(screen.getByRole("button", { name: "传统核心" })).toBeVisible();
    expect(screen.getByRole("button", { name: "保存全部配置" })).toBeVisible();

    const navigation = screen.getByRole("navigation", { name: "配置章节" });
    expect(within(navigation).getAllByRole("link")).toHaveLength(9);
    expect(NAMING_CONFIGURATION_SECTIONS).toHaveLength(9);
    for (const section of NAMING_CONFIGURATION_SECTIONS) {
      expect(
        within(navigation).getByRole("link", { name: section.shortLabel }),
      ).toHaveAttribute("href", `#configuration-${section.id}`);
      expect(document.getElementById(`configuration-${section.id}`)).toBeInstanceOf(
        HTMLDetailsElement,
      );
    }
  });

  it("uses native expandable section headings for the narrow-screen layout", async () => {
    const user = userEvent.setup();
    render(
      <NamingConfigurationPage
        title="统一配置"
        sectionSlots={{ basics: <p>基础设置内容</p> }}
      />,
    );

    const sectionHeading = screen.getByText("方案与表达").closest("summary");
    const section = sectionHeading?.closest("details");
    expect(section).toHaveAttribute("open");

    await user.click(sectionHeading!);
    await waitFor(() => expect(section).not.toHaveAttribute("open"));
    await user.click(sectionHeading!);
    await waitFor(() => expect(section).toHaveAttribute("open"));
  });

  it("opens the invalid section and focuses its field after validation", async () => {
    const scrollIntoView = vi.mocked(HTMLElement.prototype.scrollIntoView);
    const { rerender } = render(
      <NamingConfigurationPage
        title="统一配置"
        sectionSlots={{
          calendar: (
            <label htmlFor="birth-time">
              出生时间
              <input id="birth-time" />
            </label>
          ),
        }}
      />,
    );

    await userEvent.click(screen.getByText("出生与历法").closest("summary")!);
    expect(document.getElementById("configuration-calendar")).not.toHaveAttribute("open");

    rerender(
      <NamingConfigurationPage
        title="统一配置"
        sectionSlots={{
          calendar: (
            <label htmlFor="birth-time">
              出生时间
              <input id="birth-time" />
            </label>
          ),
        }}
        validationErrors={[
          { sectionId: "calendar", fieldId: "birth-time", message: "请选择出生日期" },
        ]}
        validationFocusKey={1}
      />,
    );

    await waitFor(() => expect(screen.getByLabelText("出生时间")).toHaveFocus());
    expect(document.getElementById("configuration-calendar")).toHaveAttribute("open");
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center", inline: "nearest" });
    expect(screen.getByRole("alert")).toHaveTextContent("请选择出生日期");
  });

  it("lets an error summary focus a section when no field id is available", async () => {
    const user = userEvent.setup();
    render(
      <NamingConfigurationPage
        title="统一配置"
        sectionSlots={{}}
        validationErrors={[{ sectionId: "scoring", message: "至少启用一个评分模块" }]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /至少启用一个评分模块/ }));
    expect(document.querySelector("#configuration-scoring summary")).toHaveFocus();
  });
});
