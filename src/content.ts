import { createMatcher } from "./matcher.ts";
import { message, watchSettings, type Settings } from "./settings.ts";
import { adapters } from "./sites/index.ts";
import type { DirectRoute, SiteAdapter } from "./sites/shared.ts";

const stateAttribute = "data-gta6f-state";
const offAttribute = "data-gta6f-off";
const directAttribute = "data-gta6f-direct";
const panelSelector = "[data-gta6f-ui]";
const waitForMetadata = 2_000;
const observedAttributes = [
  "href", "title", "aria-label", "alt", "video-id", "comment-id", "thingid",
  "post-title", "permalink", "subreddit-name", "subreddit-prefixed-name",
  "is-active", "active", "hidden", "aria-hidden", "inert", "id", "data-testid", "noun", "slot",
];

type Phase = "pending" | "blocked" | "unverified" | "open";
type CardState = {
  key: string | null;
  expires: number;
  phase: Phase;
  stamp: string;
  primary?: string;
  stalePrimary?: string;
  revealedStamp?: string;
  panel?: HTMLElement;
};
type DirectState = {
  route: DirectRoute;
  phase: Phase;
  expires: number;
  watchTitle?: string;
  staleWatchTitle?: string;
  source?: Element;
};

function createPanel(kind: "card" | "direct"): HTMLElement {
  const panel = document.createElement("section");
  panel.dataset.gta6fUi = kind;
  panel.dir = message("@@bidi_dir") || "ltr";
  const text = document.createElement("p");
  text.setAttribute("role", "status");
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = message("reveal");
  panel.append(text, button);
  return panel;
}

function updatePanel(panel: HTMLElement, phase: Phase): void {
  if (panel.dataset.gta6fPhase === phase) return;
  panel.dataset.gta6fPhase = phase;
  panel.querySelector("p")!.textContent = message(phase === "blocked" ? "hidden" : phase);
  panel.querySelector("button")!.hidden = phase === "pending";
}

function start(adapter: SiteAdapter): void {
  const cards = new Map<Element, CardState>();
  const pendingCards = new Set<Element>();
  const revealedKeys = new Set<string>();
  const pausedByGuard = new Set<HTMLMediaElement>();
  const neutralTitle = message("appName");
  let url = new URL(location.href);
  let navigation = pageKey(url);
  let enabled = true;
  let settingsReady = false;
  let matches = createMatcher([]);
  let direct = newDirect(adapter.directRoute(url));
  let directPanel: HTMLElement | undefined;
  let siteTitle: string | undefined;
  let deadlineTimer: number | undefined;

  function pageKey(current: URL): string {
    return adapter.directRoute(current)?.key ?? current.pathname + current.search;
  }

  function newDirect(route: DirectRoute | null, staleWatchTitle?: string): DirectState | null {
    return route ? { route, phase: "pending", expires: performance.now() + waitForMetadata, staleWatchTitle } : null;
  }

  function setPageCover(): void {
    const cover = Boolean(enabled && direct && direct.phase !== "open");
    document.documentElement?.toggleAttribute(offAttribute, !enabled);
    document.documentElement?.toggleAttribute(directAttribute, cover);
    if (cover && document.head && document.title !== neutralTitle) {
      siteTitle = document.title;
      document.title = neutralTitle;
    } else if (!cover && siteTitle !== undefined) {
      if (document.title === neutralTitle) document.title = siteTitle;
      siteTitle = undefined;
    }

    if (!cover || !document.body || !direct) {
      directPanel?.remove();
      return;
    }
    if (!directPanel) {
      directPanel = createPanel("direct");
      directPanel.querySelector("button")!.addEventListener("click", (event) => {
        if (!event.isTrusted || !direct || direct.phase === "pending") return;
        event.stopPropagation();
        revealedKeys.add(direct.route.key);
        scan();
      });
    }
    updatePanel(directPanel, direct.phase);
    if (directPanel.parentElement !== document.body) document.body.append(directPanel);
  }

  function allowPlayback(): void {
    for (const media of pausedByGuard) {
      if (!media.isConnected) continue;
      // Only restore playback that the pending route guard interrupted.
      void media.play()?.catch(() => {});
    }
    pausedByGuard.clear();
  }

  function reviewDirect(now: number): void {
    if (!enabled || !direct) {
      setPageCover();
      return;
    }
    if (!settingsReady) {
      setPageCover();
      return;
    }
    const { route } = direct;
    const revealed = revealedKeys.has(route.key);
    const candidate = revealed ? null : adapter.readDirect(document, route, url);
    direct.source = candidate?.source;
    const title = candidate?.fields[0];
    const freshMetadata = candidate?.ready &&
      (direct.staleWatchTitle === undefined || title !== direct.staleWatchTitle);
    const oldPhase = direct.phase;
    if (revealed) {
      direct.phase = "open";
    } else if (candidate?.topical || (candidate && matches(candidate.fields))) {
      direct.phase = "blocked";
    } else if (freshMetadata) {
      direct.phase = "open";
    } else {
      direct.phase = now < direct.expires ? "pending" : "unverified";
    }
    if (route.kind === "watch" && freshMetadata) {
      direct.watchTitle = title;
      direct.staleWatchTitle = undefined;
    }
    setPageCover();
    if (direct.phase === "open" && oldPhase !== "open" && !revealed) allowPlayback();
    if (direct.phase === "blocked" || revealed) pausedByGuard.clear();
    if (direct.phase !== "open") {
      for (const media of document.querySelectorAll<HTMLMediaElement>("video, audio")) guardPlayback(media);
    }
  }

  function clearCard(element: Element, card: CardState): void {
    element.removeAttribute(stateAttribute);
    card.panel?.remove();
    cards.delete(element);
    pendingCards.delete(element);
  }

  function showCardState(element: Element, card: CardState): void {
    const display = card.phase === "open" ? "open" : "closed";
    if (element.getAttribute(stateAttribute) !== display) element.setAttribute(stateAttribute, display);
    if (card.phase !== "blocked" || !element.parentElement) {
      card.panel?.remove();
      return;
    }
    if (!card.panel) {
      card.panel = createPanel("card");
      card.panel.querySelector("button")!.addEventListener("click", (event) => {
        if (!event.isTrusted || card.phase !== "blocked" || !element.isConnected) return;
        event.stopPropagation();
        if (card.key) revealedKeys.add(card.key);
        else card.revealedStamp = card.stamp;
        scan();
      });
    }
    updatePanel(card.panel, card.phase);
    if (card.panel.nextElementSibling !== element) element.before(card.panel);
    for (const media of element.querySelectorAll<HTMLMediaElement>("video, audio")) media.pause();
  }

  function reviewCard(element: Element, now: number): void {
    const previous = cards.get(element);
    if (!element.isConnected || !element.matches(adapter.cards)) {
      if (previous) clearCard(element, previous);
      return;
    }

    const entry = adapter.readCard(element, url);
    const card = previous ?? { key: entry.key, expires: now + waitForMetadata, phase: "pending", stamp: "" };
    if (card.key !== entry.key) {
      card.stalePrimary = card.primary;
      card.key = entry.key;
      card.expires = now + waitForMetadata;
      card.revealedStamp = undefined;
    }
    const freshMetadata = entry.ready && (card.stalePrimary === undefined || entry.fields[0] !== card.stalePrimary);
    if (freshMetadata) {
      card.primary = entry.fields[0];
      card.stalePrimary = undefined;
    }
    card.stamp = entry.key === null ? JSON.stringify(entry.fields) : "";
    const revealed = entry.key ? revealedKeys.has(entry.key) : card.revealedStamp === card.stamp;
    if (revealed) card.phase = "open";
    else if (entry.topical || matches(entry.fields)) card.phase = "blocked";
    else card.phase = freshMetadata || now >= card.expires ? "open" : "pending";

    cards.set(element, card);
    if (card.phase === "pending") pendingCards.add(element);
    else pendingCards.delete(element);
    showCardState(element, card);
  }

  function scheduleDeadline(): void {
    window.clearTimeout(deadlineTimer);
    let next = direct?.phase === "pending" ? direct.expires : Infinity;
    for (const element of pendingCards) next = Math.min(next, cards.get(element)!.expires);
    if (!Number.isFinite(next)) return;
    deadlineTimer = window.setTimeout(() => {
      const now = performance.now();
      update([...pendingCards].filter((element) => (cards.get(element)?.expires ?? Infinity) <= now));
    }, Math.max(1, Math.ceil(next - performance.now())));
  }

  function checkNavigation(): boolean {
    if (url.href === location.href) return false;
    url = new URL(location.href);
    const next = pageKey(url);
    const nextRoute = adapter.directRoute(url);
    if (next === navigation) return false;
    navigation = next;
    revealedKeys.clear();
    const staleWatchTitle = direct?.route.kind === "watch" ? direct.watchTitle ?? direct.staleWatchTitle : undefined;
    direct = newDirect(nextRoute, staleWatchTitle);
    for (const card of cards.values()) card.revealedStamp = undefined;
    pausedByGuard.clear();
    setPageCover();
    return true;
  }

  function update(changed: Iterable<Element>, full = false, directChanged = true): void {
    const navigated = checkNavigation();
    if (!enabled || !settingsReady) {
      setPageCover();
      return;
    }
    const now = performance.now();
    if (navigated || full || directChanged) reviewDirect(now);
    else setPageCover();
    if (navigated || full) {
      for (const [element, card] of cards) {
        if (!element.isConnected || !element.matches(adapter.cards)) clearCard(element, card);
      }
      changed = document.querySelectorAll(adapter.cards);
    }
    for (const element of changed) reviewCard(element, now);
    scheduleDeadline();
  }

  function scan(): void {
    update([], true);
  }

  function guardPlayback(media: HTMLMediaElement): void {
    if (!enabled || media.paused) return;
    if (direct && direct.phase !== "open") {
      if (direct.phase !== "blocked") pausedByGuard.add(media);
      media.pause();
    } else if (media.closest(adapter.cards)?.getAttribute(stateAttribute) === "closed") {
      media.pause();
    }
  }

  function mediaStarted(event: Event): void {
    if (url.href !== location.href) scan();
    if (event.target instanceof HTMLMediaElement) guardPlayback(event.target);
  }

  function collectAncestors(element: Element | null, changed: Set<Element>): void {
    for (let candidate = element?.closest(adapter.cards); candidate; candidate = candidate.parentElement?.closest(adapter.cards)) {
      changed.add(candidate);
    }
    if (element && cards.has(element)) changed.add(element);
  }

  function collectTree(node: Node, changed: Set<Element>): void {
    if (!(node instanceof Element) || node.matches(panelSelector)) return;
    if (node.matches(adapter.cards) || cards.has(node)) changed.add(node);
    for (const descendant of node.querySelectorAll(adapter.cards + ", [" + stateAttribute + "]")) {
      changed.add(descendant);
    }
  }

  const observer = new MutationObserver((mutations) => {
    if (!enabled || !settingsReady) {
      setPageCover();
      return;
    }
    const changed = new Set<Element>();
    let relevant = false;
    const source = direct?.source;
    let directChanged = !source?.isConnected;
    for (const mutation of mutations) {
      const element = mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
      if (element?.closest(panelSelector)) continue;
      if (mutation.type === "childList") {
        const children = [...mutation.addedNodes, ...mutation.removedNodes];
        if (children.length && children.every((node) => node instanceof Element && node.matches(panelSelector))) continue;
        for (const child of children) collectTree(child, changed);
      }
      relevant = true;
      if (source && element &&
          (source.contains(element) || (mutation.type === "attributes" && element.contains(source)))) {
        directChanged = true;
      }
      collectAncestors(element, changed);
    }
    if (relevant) update(changed, false, directChanged);
  });

  function applySettings(settings: Settings): void {
    settingsReady = true;
    const active = settings.enabled && settings[adapter.site];
    const wasEnabled = enabled;
    enabled = active;
    matches = createMatcher(settings.terms);
    if (!enabled) {
      for (const [element, card] of cards) clearCard(element, card);
      window.clearTimeout(deadlineTimer);
      pausedByGuard.clear();
    } else if (!wasEnabled) {
      direct = newDirect(adapter.directRoute(new URL(location.href)));
    }
    scan();
  }

  setPageCover();
  observer.observe(document, {
    subtree: true, childList: true, characterData: true,
    attributes: true, attributeFilter: observedAttributes,
  });
  document.addEventListener("play", mediaStarted, true);
  document.addEventListener("playing", mediaStarted, true);
  document.addEventListener("yt-navigate-finish", scan);
  window.addEventListener("popstate", scan);
  // The Navigation API also covers pushState/replaceState; mutations and popstate cover older Firefox.
  const navigationApi = (window as Window & { navigation?: EventTarget }).navigation;
  navigationApi?.addEventListener("currententrychange", scan);
  watchSettings(applySettings);
}

const adapter = adapters.find((candidate) => candidate.hosts.includes(location.hostname));
if (adapter) start(adapter);
