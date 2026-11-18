import { normalize } from "../matcher.ts";
import { fieldsFrom, linkUrl, onSurface, values, type Entry, type SiteAdapter } from "./shared.ts";

const posts = "shreddit-post, faceplate-tracker[noun='post']:not(:has(shreddit-post), shreddit-post *)";
const comments = "shreddit-comment";
const searchResults = "search-telemetry-tracker:not(:has(shreddit-post, faceplate-tracker[noun='post']), shreddit-post *, faceplate-tracker[noun='post'] *)";
const cards = [posts, comments, searchResults].join(", ");
const communities = new Set(["gta6", "gtavi", "gta6leaks", "gtavileaks", "grandtheftauto6", "grandtheftautovi"]);

function communityName(name: string): string {
  return normalize(name).replace(/^\/?r\//, "").replace(/[^a-z0-9]/g, "");
}

function routeCommunity(path: string): string | undefined {
  return path.match(/^\/r\/([^/]+)/i)?.[1];
}

function permalinkId(path: string): string | undefined {
  return path.match(/\/comments\/([a-z0-9]+)(?:\/|$)/i)?.[1]?.toLowerCase();
}

const postKey = (id: string) => "reddit:post:" + id;

function readCard(element: Element, url: URL): Entry {
  if (element.matches(comments)) {
    const fields = fieldsFrom(element, "[slot='comment'], [slot='comment-content'], .md", comments);
    const id = element.getAttribute("thingid") ?? element.getAttribute("id");
    return {
      fields, ready: fields.length > 0, key: id ? "reddit:comment:" + id : null,
      topical: communities.has(communityName(routeCommunity(url.pathname) ?? "")),
    };
  }

  if (element.matches(searchResults) && !element.querySelector("a[href*='/comments/']")) {
    return { fields: [], ready: true, key: null };
  }

  const link = element.querySelector("a[slot='title'], a[data-testid='post-title'], a[href*='/comments/']");
  const path = element.getAttribute("permalink") ?? linkUrl(link, url)?.pathname ?? "";
  const community = element.getAttribute("subreddit-prefixed-name") ??
    element.getAttribute("subreddit-name") ?? routeCommunity(path) ??
    linkUrl(element.querySelector("a[href^='/r/']"), url)?.pathname.match(/^\/r\/([^/]+)/i)?.[1] ??
    routeCommunity(url.pathname);
  const id = permalinkId(path) ?? element.getAttribute("thingid")?.match(/^t3_([a-z0-9]+)$/i)?.[1];
  const headings = [
    ...values(element.getAttribute("post-title")),
    ...fieldsFrom(element, "[slot='title'], [data-testid='post-title'], h1, h2, h3"),
  ];
  const fields = [...headings, ...fieldsFrom(element,
    "[slot='text-body'], [slot='text-content'], [slot='post-media-container'] img[alt], [data-testid='post-content'], .md, img[alt]")];
  return {
    fields, ready: headings.length > 0 || fields.length > 0,
    topical: Boolean(community && communities.has(communityName(community))),
    key: id ? postKey(id) : null,
  };
}

export const reddit: SiteAdapter = {
  site: "reddit",
  hosts: ["www.reddit.com", "reddit.com"],
  cards,
  readCard,
  directRoute(url) {
    const id = permalinkId(url.pathname);
    return id ? { id, key: postKey(id), kind: "post" } : null;
  },
  readDirect(document, route, url) {
    for (const element of document.querySelectorAll(posts)) {
      if (!onSurface(element)) continue;
      const candidate = readCard(element, url);
      if (candidate.key === route.key) return { ...candidate, source: element };
    }
    const topical = communities.has(communityName(routeCommunity(url.pathname) ?? ""));
    return topical ? { key: route.key, fields: [], ready: false, topical } : null;
  },
};
