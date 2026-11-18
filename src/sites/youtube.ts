import { fieldsFrom, linkUrl, onSurface, values, watchId, type Entry, type SiteAdapter } from "./shared.ts";

const videoContainers = [
  "ytd-rich-item-renderer", "ytd-video-renderer", "ytd-compact-video-renderer",
  "ytd-grid-video-renderer", "ytd-reel-item-renderer", "ytd-reel-video-renderer",
].join(", ");
const cards = [
  videoContainers,
  "yt-lockup-view-model:not(:is(" + videoContainers + ") *)",
  "ytm-shorts-lockup-view-model:not(:is(" + videoContainers + ") *)",
  "ytd-comment-view-model",
  "ytd-comment-renderer:not(ytd-comment-view-model *)",
].join(", ");

const titles = [
  "#video-title", "#video-title-link", "h3", ".yt-lockup-metadata-view-model__heading",
  ".shortsLockupViewModelHostMetadataTitle", "#reel-video-title", "yt-reel-metapanel-view-model h2",
].join(", ");
const supplemental = [
  "#description-text", "#description-inline-expander", ".metadata-snippet-text",
  "a[href^='/hashtag/']", "img[alt]", "video[aria-label]",
].join(", ");
const commentSelector = "ytd-comment-view-model, ytd-comment-renderer";
const videoKey = (id: string) => "youtube:video:" + id;

function cardId(element: Element, url: URL): string | null {
  const explicit = element.getAttribute("video-id");
  if (explicit && /^[\w-]+$/.test(explicit)) return explicit;
  const link = element.querySelector("a[href^='/watch?'], a[href^='/shorts/']");
  return watchId(linkUrl(link, url));
}

function readCard(element: Element, url: URL): Entry {
  if (element.matches(commentSelector)) {
    const fields = fieldsFrom(element, "#content-text, #content, .yt-core-attributed-string", commentSelector);
    const id = element.getAttribute("comment-id") ?? element.getAttribute("id");
    return { fields, ready: fields.length > 0, key: id ? "youtube:comment:" + id : null };
  }
  const id = cardId(element, url);
  const headings = fieldsFrom(element, titles);
  const fields = [...headings, ...fieldsFrom(element, supplemental)];
  return { fields, ready: headings.length > 0, key: id ? videoKey(id) : null };
}

export const youtube: SiteAdapter = {
  site: "youtube",
  hosts: ["www.youtube.com", "youtube.com"],
  cards,
  readCard,
  directRoute(url) {
    const id = watchId(url);
    return id ? { id, key: videoKey(id), kind: url.pathname === "/watch" ? "watch" : "shorts" } : null;
  },
  readDirect(document, route, url) {
    if (route.kind === "shorts") {
      const shorts = document.querySelectorAll("ytd-reel-video-renderer[is-active], ytd-reel-video-renderer[active]");
      const active = Array.from(shorts).find((element) => onSurface(element) && cardId(element, url) === route.id);
      return active ? { ...readCard(active, url), source: active } : null;
    }

    const watch = Array.from(document.querySelectorAll("ytd-watch-flexy")).find(onSurface);
    if (!watch) return null;
    const heading = watch.querySelector("ytd-watch-metadata #title h1, ytd-watch-metadata h1, #primary #title h1");
    const metadataId = heading?.closest("ytd-watch-metadata")?.getAttribute("video-id");
    const id = metadataId ?? watch.getAttribute("video-id");
    if (id !== route.id) return null;

    const title = values(heading?.textContent, heading?.getAttribute("title"));
    const fields = [...title, ...fieldsFrom(watch, "ytd-watch-metadata #description-inline-expander, ytd-watch-metadata #description, ytd-watch-metadata a[href^='/hashtag/']")];
    return { fields, ready: title.length > 0, key: route.key, source: watch };
  },
};
