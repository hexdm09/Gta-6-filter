import { fieldsFrom, linkUrl, onSurface, type Entry, type SiteAdapter } from "./shared.ts";

const cards = "article[data-testid='tweet']";
const statusKey = (id: string) => "x:status:" + id;
const ownStatusLinks = [
  "a[href*='/status/']:has(time)",
  "[data-testid='User-Name'] a[href*='/status/']",
].join(", ");

function statusId(path: string | undefined): string | undefined {
  return path?.match(/\/status\/(\d+)(?:\/|$)/)?.[1];
}

function readCard(element: Element, url: URL): Entry {
  const link = Array.from(element.querySelectorAll(ownStatusLinks))
    .find((anchor) => !anchor.closest("[data-testid='quoteTweet'], [data-testid='card.wrapper']")) ?? null;
  const path = linkUrl(link, url)?.pathname;
  const id = statusId(path);
  const fields = fieldsFrom(element, [
    "[data-testid='tweetText']", "[data-testid='card.wrapper']", "[data-testid='quoteTweet']",
  ].join(", "));
  const labels = fieldsFrom(element, "[data-testid='tweetPhoto'] img[alt], [data-testid='videoPlayer'] [aria-label]");
  const metadata = [...fields, ...labels];
  return { fields: metadata, ready: fields.length > 0, key: id ? statusKey(id) : null };
}

export const x: SiteAdapter = {
  site: "x",
  hosts: ["x.com", "www.x.com", "twitter.com", "www.twitter.com"],
  cards,
  readCard,
  directRoute(url) {
    const id = statusId(url.pathname);
    return id ? { id, key: statusKey(id), kind: "status" } : null;
  },
  readDirect(document, route, url) {
    for (const element of document.querySelectorAll(cards)) {
      if (!onSurface(element)) continue;
      const candidate = readCard(element, url);
      if (candidate.key === route.key) return { ...candidate, source: element };
    }
    return null;
  },
};
