import type { FolkloreModuleId, NamingProfile } from "./profile";

export type ConfigurationPresetId = "basic" | "traditional-core" | "full-professional";

export interface ConfigurationPreset {
  id: ConfigurationPresetId;
  version: "1";
  label: string;
  weights: Readonly<Record<"basic" | FolkloreModuleId, number>>;
}

export const configurationPresets: readonly ConfigurationPreset[] = [
  preset("basic", "基础", [100, 0, 0, 0, 0, 0]),
  preset("traditional-core", "民俗核心（默认）", [40, 35, 10, 15, 0, 0]),
  preset("full-professional", "完整专业", [35, 25, 10, 10, 10, 10]),
];

export function applyConfigurationPreset(
  profile: NamingProfile,
  presetId: ConfigurationPresetId,
): NamingProfile {
  const selected = configurationPresets.find(({ id }) => id === presetId);
  if (!selected) throw new Error(`unknown-configuration-preset:${presetId}`);

  const modules = Object.fromEntries(
    (
      Object.entries(profile.modules) as Array<
        [FolkloreModuleId, NamingProfile["modules"][FolkloreModuleId]]
      >
    ).map(([moduleId, module]) => {
      const weight = selected.weights[moduleId];
      return [moduleId, { ...module, analysisEnabled: weight > 0, weight }];
    }),
  ) as NamingProfile["modules"];

  return {
    ...profile,
    modules,
    scoring: {
      presetId: selected.id,
      presetVersion: selected.version,
      basicWeight: selected.weights.basic,
    },
  };
}

function preset(
  id: ConfigurationPresetId,
  label: string,
  [basic, bazi_wuxing, zodiac, traditional, name_hexagram, five_grids]: readonly [
    number,
    number,
    number,
    number,
    number,
    number,
  ],
): ConfigurationPreset {
  return {
    id,
    version: "1",
    label,
    weights: { basic, bazi_wuxing, zodiac, traditional, name_hexagram, five_grids },
  };
}
