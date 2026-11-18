import type { Site } from "../settings.ts";

export interface Entry {
  key: string | null;
  fields: string[];
  ready: boolean;
  topical?: boolean;
  source?: Element;
}

export interface DirectRoute {
  key: string;
  id: string;
  kind: string;
}

export interface SiteAdapter {
  site: Site;
  hosts: string[];
  cards: string;
  readCard: (element: Element, url: URL) => Entry;
  directRoute: (url: URL) => DirectRoute | null;
  readDirect: (document: Document, route: DirectRoute, url: URL) => Entry | null;
}

export function fieldsFrom(root: Element, selector: string, boundary?: string): string[] {
  return Array.from(root.querySelectorAll(selector)).flatMap((entry) => {
    if (entry.closest("[data-gta6f-ui]")) return [];
    if (boundary && entry.closest(boundary) !== root) return [];
    return [entry.textContent, entry.getAttribute("title"), entry.getAttribute("aria-label"), entry.getAttribute("alt")]
      .filter((value): value is string => Boolean(value?.trim()));
  });
}

export function values(...fields: (string | null | undefined)[]): string[] {
  return fields.filter((value): value is string => Boolean(value?.trim()));
}

export function linkUrl(link: Element | null, base: URL): URL | null {
  const href = link?.getAttribute("href");
  if (!href) return null;
  try {
    const url = new URL(href, base);
    return url.protocol === "https:" && url.hostname === base.hostname ? url : null;
  } catch {
    return null;
  }
}

export function onSurface(element: Element): boolean {
  return !element.closest('[hidden], [aria-hidden="true"], [inert], [data-gta6f-ui]');
}

export function watchId(url: URL | null): string | null {
  if (!url) return null;
  const id = url.pathname === "/watch"
    ? url.searchParams.get("v")
    : url.pathname.match(/^\/shorts\/([\w-]+)\/?$/)?.[1];
  return id && /^[\w-]+$/.test(id) ? id : null;
}
