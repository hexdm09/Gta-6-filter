import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { chromium, expect, test as base } from "@playwright/test";

const extensionPath = resolve("dist/chromium");
const test = base.extend({
  context: async ({}, use) => {
    const profile = await mkdtemp(resolve(tmpdir(), "gta6f-test-"));
    const context = await chromium.launchPersistentContext(profile, {
      channel: "chromium",
      headless: true,
      args: [
        "--disable-extensions-except=" + extensionPath,
        "--load-extension=" + extensionPath,
        "--lang=en-US",
        "--autoplay-policy=no-user-gesture-required",
      ],
      locale: "en-US",
    });
    try {
      await context.route("https://**", (route) => route.abort());
      await use(context);
    } finally {
      await context.close();
      await rm(profile, { recursive: true, force: true });
    }
  },
});

const panel = '[data-gta6f-ui="card"]';
const direct = '[data-gta6f-ui="direct"]';
const cover = "data-gta6f-direct";
const thumbnail = '<img alt="" width="80" height="45" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">';
const youtubeCard = (id, title) => '<ytd-video-renderer id="' + id + '"><a id="video-title" href="/watch?v=' + id + '">' + title + '</a>' + thumbnail + '</ytd-video-renderer>';
const tweet = (id, title, marker) => '<article id="' + marker + '" data-testid="tweet"><a href="/examples/status/' + id + '"><time>Today</time></a><div data-testid="tweetText">' + title + '</div>' + thumbnail + '</article>';
const redditPost = (id, title, community) => '<shreddit-post id="' + id + '" subreddit-name="' + community + '" thingid="t3_' + id + '" post-title="' + title + '"><h2 slot="title">' + title + '</h2>' + thumbnail + '</shreddit-post>';

async function serve(context, address, markup, script = "") {
  await context.route(address, (route) => route.fulfill({
    contentType: "text/html; charset=UTF-8",
    body: '<!doctype html><html><head><title>Example</title></head><body><main>' +
      markup + '</main><script>' + script + '</script></body></html>',
  }));
}

async function openSettings(context) {
  const page = await context.newPage();
  await page.goto("chrome://extensions/");
  const entry = page.locator("extensions-item").filter({ hasText: "GTA6 Filter" });
  await expect(entry).toBeVisible();
  const id = await entry.getAttribute("id");
  await page.goto("chrome-extension://" + id + "/popup.html");
  await expect(page.locator("#enabled")).toBeEnabled();
  return page;
}

test("hides YouTube titles and previews before the first frame and rescans inserted cards", async ({ context, page }) => {
  const url = "https://www.youtube.com/results?search_query=games";
  await serve(context, url, youtubeCard("spoiler", "GTA Ⅵ preview") + youtubeCard("safe", "GTA V retrospective"),
    "requestAnimationFrame(() => { window.firstFrame = getComputedStyle(document.querySelector('#spoiler')).display; });");
  await page.goto(url);
  await expect.poll(() => page.evaluate(() => window.firstFrame)).toBe("none");
  await expect(page.locator("#spoiler img")).toBeHidden();
  await expect(page.locator("#safe")).toBeVisible();
  await expect(page.getByRole("link", { name: "GTA Ⅵ preview" })).toHaveCount(0);
  await page.locator(panel).getByRole("button", { name: "Show once" }).click();
  await expect(page.locator("#spoiler img")).toBeVisible();

  const inserted = await page.evaluate((newCard) => {
    document.querySelector("main").insertAdjacentHTML("beforeend", newCard);
    return getComputedStyle(document.querySelector("#inserted")).display;
  }, youtubeCard("inserted", "グランド・セフト・オートⅥ"));
  expect(inserted).toBe("none");
  await expect(page.locator(panel)).toHaveCount(1);

  await page.evaluate(() => {
    const link = document.querySelector("#spoiler a");
    link.href = "/watch?v=recycled";
    link.textContent = "Another GTA 6 preview";
  });
  await expect(page.locator("#spoiler")).toBeHidden();
  await expect(page.locator(panel)).toHaveCount(2);

  await page.locator("#safe a").evaluate((link) => { link.href = "/watch?v=reused-safe"; });
  await expect(page.locator("#safe")).toBeHidden();
  await page.locator("#safe a").evaluate((link) => { link.textContent = "Another GTA VI preview"; });
  await expect(page.locator(panel)).toHaveCount(3);

  await page.reload();
  await expect(page.locator("#spoiler")).toBeHidden();
  await expect(page.locator("#safe")).toBeVisible();
});

test("unresolved feed items open after the wait and are checked when metadata arrives", async ({ context, page }) => {
  const url = "https://www.youtube.com/";
  await serve(context, url, '<ytd-rich-item-renderer id="late">' + thumbnail + '</ytd-rich-item-renderer>');
  await page.goto(url);
  await expect(page.locator("#late")).toBeHidden();
  await expect(page.locator("#late")).toBeVisible({ timeout: 4_000 });
  await page.locator("#late").evaluate((card) => {
    const title = document.createElement("h3");
    title.textContent = "Grand Theft Auto VI trailer";
    card.append(title);
  });
  await expect(page.locator("#late")).toBeHidden();
  await expect(page.locator(panel)).toHaveCount(1);
});

test("covers direct YouTube media and title until verification and resets reveal on a new video", async ({ context, page }) => {
  const url = "https://www.youtube.com/watch?v=first";
  await serve(context, url, '<ytd-watch-flexy video-id="first"><ytd-watch-metadata video-id="first"><h1>GTA VI preview</h1>' +
    '</ytd-watch-metadata><video muted></video></ytd-watch-flexy>',
    "requestAnimationFrame(() => { window.firstFrame = getComputedStyle(document.querySelector('main')).visibility; });");
  await page.goto(url);
  await expect.poll(() => page.evaluate(() => window.firstFrame)).toBe("hidden");
  await expect(page).toHaveTitle("GTA6 Filter");
  await expect(page.locator(direct)).toHaveAttribute("data-gta6f-phase", "blocked");
  await expect(page.locator("h1")).toBeHidden();
  // A page script cannot reveal a card on behalf of the user.
  await page.locator(direct + " button").evaluate((button) => button.click());
  await expect(page.locator(direct)).toBeVisible();
  await page.locator(direct).getByRole("button").click();
  await expect(page.locator("h1")).toBeVisible();
  await expect(page).toHaveTitle("Example");

  await page.evaluate(() => {
    history.pushState({}, "", "/watch?v=second");
    document.querySelector("ytd-watch-flexy").setAttribute("video-id", "second");
    document.querySelector("ytd-watch-metadata").setAttribute("video-id", "second");
    document.querySelector("h1").textContent = "Typewriter repairs";
  });
  await expect(page.locator("html")).not.toHaveAttribute(cover, "");
  await expect(page.getByRole("heading", { name: "Typewriter repairs" })).toBeVisible();

  await page.evaluate(() => {
    history.pushState({}, "", "/watch?v=third");
    document.querySelector("ytd-watch-flexy").setAttribute("video-id", "third");
    document.querySelector("ytd-watch-metadata").setAttribute("video-id", "third");
  });
  await expect(page.locator(direct)).toHaveAttribute("data-gta6f-phase", "pending");
  await expect(page.getByRole("heading", { name: "Typewriter repairs" })).toHaveCount(0);
  await page.locator("h1").evaluate((heading) => { heading.textContent = "GTA 6 update"; });
  await expect(page.locator(direct)).toHaveAttribute("data-gta6f-phase", "blocked");
});

test("checks the active Short and pauses playback on blocked direct routes", async ({ context, page }) => {
  const url = "https://www.youtube.com/shorts/a";
  await serve(context, url, '<ytd-reel-video-renderer is-active video-id="a"><h3>GTA VI news</h3><audio></audio></ytd-reel-video-renderer>' +
    '<ytd-reel-video-renderer video-id="b"><h3>Typewriter keys</h3></ytd-reel-video-renderer>');
  await page.goto(url);
  await expect(page.locator(direct)).toHaveAttribute("data-gta6f-phase", "blocked");
  await expect(page.locator("ytd-reel-video-renderer[is-active] h3")).toBeHidden();

  await page.locator("audio").evaluate((audio) => {
    const samples = new Uint8Array(8_000).fill(128);
    const header = new Uint8Array([
      82, 73, 70, 70, 100, 31, 0, 0, 87, 65, 86, 69, 102, 109, 116, 32,
      16, 0, 0, 0, 1, 0, 1, 0, 64, 31, 0, 0, 64, 31, 0, 0, 1, 0, 8, 0,
      100, 97, 116, 97, 64, 31, 0, 0,
    ]);
    audio.src = URL.createObjectURL(new Blob([header, samples], { type: "audio/wav" }));
    audio.loopsObserved = 0;
    audio.loop = true;
    audio.addEventListener("pause", () => { audio.loopsObserved++; });
    void audio.play().catch(() => {});
  });
  await expect.poll(() => page.locator("audio").evaluate((audio) => audio.loopsObserved)).toBeGreaterThan(0);
  await expect.poll(() => page.locator("audio").evaluate((audio) => audio.paused)).toBe(true);

  await page.evaluate(() => {
    history.pushState({}, "", "/shorts/b");
    document.querySelector('[video-id="a"]').removeAttribute("is-active");
    document.querySelector('[video-id="b"]').setAttribute("is-active", "");
  });
  await expect(page.getByRole("heading", { name: "Typewriter keys" })).toBeVisible();
});

test("filters thematic Reddit communities, search results and discussions", async ({ context, page }) => {
  const search = "https://www.reddit.com/search/?q=games";
  await serve(context, search, '<search-telemetry-tracker id="reddit-result"><a href="/r/games/comments/aa/news"><h2>GTA6 news</h2></a>' + thumbnail + '</search-telemetry-tracker>' +
    redditPost("bb", "Look at this", "GTAVI") + redditPost("cc", "GTA Online discussion", "games"));
  await page.goto(search);
  await expect(page.locator("#reddit-result")).toBeHidden();
  await expect(page.locator("#bb")).toBeHidden();
  await expect(page.locator("#cc")).toBeVisible();
  await expect(page.locator(panel)).toHaveCount(2);

  const thread = "https://www.reddit.com/r/games/comments/cc/discussion/";
  await serve(context, thread, redditPost("cc", "GTA Online discussion", "games") +
    '<shreddit-comment id="comment" thingid="t1_example"><div slot="comment">GTA 6 preview?</div></shreddit-comment>' +
    '<shreddit-comment id="clean"><div slot="comment">I play GTA Online</div></shreddit-comment>');
  await page.goto(thread);
  await expect(page.locator("#cc")).toBeVisible();
  await expect(page.locator("#comment")).toBeHidden();
  await expect(page.locator("#clean")).toBeVisible();
});

test("covers unverified X posts, rechecks late metadata and restores clean content", async ({ context, page }) => {
  const url = "https://x.com/examples/status/1";
  await serve(context, url, tweet(1, "", "target") + tweet(2, "Ordinary reply", "reply"));
  await page.goto(url);
  await expect(page.locator(direct)).toHaveAttribute("data-gta6f-phase", "pending");
  await expect(page.locator(direct).getByRole("button")).toBeHidden();
  await expect(page.locator(direct)).toHaveAttribute("data-gta6f-phase", "unverified", { timeout: 4_000 });
  await expect(page.locator(direct).getByRole("button")).toBeVisible();

  await page.locator("#target [data-testid='tweetText']").evaluate((element) => { element.textContent = "GTA6 update"; });
  await expect(page.locator(direct)).toHaveAttribute("data-gta6f-phase", "blocked");
  await expect(page.locator("#target")).toBeHidden();
  await page.locator(direct).getByRole("button").click();
  await expect(page.locator("#target")).toBeVisible();
  await expect(page.locator("#reply")).toBeVisible();

  await page.reload();
  await expect(page.locator(direct)).toBeVisible();
  await page.locator("#target [data-testid='tweetText']").evaluate((element) => { element.textContent = "An ordinary post"; });
  await expect(page.locator(direct)).toHaveCount(0);
  await expect(page.locator("#target")).toBeVisible();
});

test("applies local settings live and persists literal custom words and per-site exceptions", async ({ context, page }) => {
  const x = "https://x.com/search?q=games";
  const youtube = "https://www.youtube.com/results?search_query=games";
  await serve(context, x, tweet(1, "Custom [teaser].+", "custom") + tweet(2, "GTA VI news", "x-matched"));
  await serve(context, youtube, youtubeCard("yt-matched", "GTA VI trailer"));
  await page.goto(x);
  const other = await context.newPage();
  await other.goto(youtube);
  await expect(page.locator("#custom")).toBeVisible();
  await expect(page.locator("#x-matched")).toBeHidden();
  await expect(other.locator("#yt-matched")).toBeHidden();

  const settings = await openSettings(context);
  await settings.locator("#terms").fill("[teaser].+\n[TEASER].+");
  await settings.getByRole("button", { name: "Save phrases" }).click();
  await expect(settings.getByRole("status")).toHaveText("Phrases saved.");
  await expect(page.locator("#custom")).toBeHidden();

  await settings.locator("#x").uncheck();
  await expect(page.locator("#x-matched")).toBeVisible();
  await expect(page.locator("#custom")).toBeVisible();
  await expect(other.locator("#yt-matched")).toBeHidden();
  await page.reload();
  await expect(page.locator("#x-matched")).toBeVisible();

  await settings.locator("#enabled").uncheck();
  await expect(other.locator("#yt-matched")).toBeVisible();
  await settings.reload();
  await expect(settings.locator("#enabled")).not.toBeChecked();
  await expect(settings.locator("#x")).not.toBeChecked();
  await expect(settings.locator("#terms")).toHaveValue("[teaser].+");

  await settings.locator("#enabled").check();
  await expect(other.locator("#yt-matched")).toBeHidden();
  await settings.locator("#x").check();
  await expect(page.locator("#custom")).toBeHidden();
});
