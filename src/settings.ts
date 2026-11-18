import { cleanTerms } from "./matcher.ts";

export const sites = ["youtube", "reddit", "x"] as const;
export type Site = typeof sites[number];
export type Toggle = Site | "enabled";

export interface Settings {
  enabled: boolean;
  youtube: boolean;
  reddit: boolean;
  x: boolean;
  terms: string[];
}

type ExtensionApi = Pick<typeof chrome, "storage" | "i18n">;
export const extension = (globalThis as { browser?: ExtensionApi }).browser ?? chrome;
const keys = ["enabled", ...sites, "terms"];

export function parseSettings(data: Record<string, unknown>): Settings {
  return {
    enabled: data.enabled !== false,
    youtube: data.youtube !== false,
    reddit: data.reddit !== false,
    x: data.x !== false,
    terms: cleanTerms(Array.isArray(data.terms)
      ? data.terms.filter((term): term is string => typeof term === "string")
      : []),
  };
}

export async function readSettings(): Promise<Settings> {
  return parseSettings(await extension.storage.local.get(keys));
}

export function watchSettings(update: (settings: Settings) => void): void {
  let version = 0;
  const refresh = async () => {
    const request = ++version;
    try {
      const settings = await readSettings();
      if (request === version) update(settings);
    } catch {
      if (request === version) update(parseSettings({}));
    }
  };
  extension.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && keys.some((key) => key in changes)) void refresh();
  });
  void refresh();
}

export function message(key: string): string {
  return extension.i18n.getMessage(key);
}
