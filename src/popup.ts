import { cleanTerms } from "./matcher.ts";
import { extension, message, readSettings, sites, type Toggle } from "./settings.ts";

document.documentElement.lang = message("@@ui_locale").replaceAll("_", "-") || "en";
document.documentElement.dir = message("@@bidi_dir") || "ltr";
for (const element of document.querySelectorAll<HTMLElement>("[data-i18n]")) {
  element.textContent = message(element.dataset.i18n!);
}

const form = document.querySelector("form")!;
const terms = form.querySelector("textarea")!;
const save = form.querySelector("button")!;
const status = document.querySelector<HTMLElement>("#status")!;
const names: Toggle[] = ["enabled", ...sites];

function showStatus(key: string, error = false): void {
  status.textContent = key ? message(key) : "";
  status.toggleAttribute("data-error", error);
}

for (const name of names) {
  const control = document.querySelector<HTMLInputElement>("#" + name)!;
  control.addEventListener("change", async () => {
    const value = control.checked;
    control.disabled = true;
    try {
      await extension.storage.local.set({ [name]: value });
      showStatus("");
    } catch {
      control.checked = !value;
      showStatus("storageError", true);
    } finally {
      control.disabled = false;
    }
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  save.disabled = true;
  const input = terms.value;
  const values = cleanTerms(input.split(/\r?\n/));
  try {
    await extension.storage.local.set({ terms: values });
    if (terms.value === input) {
      terms.value = values.join("\n");
      showStatus("saved");
    }
  } catch {
    showStatus("storageError", true);
  } finally {
    save.disabled = false;
  }
});

terms.addEventListener("input", () => showStatus(""));

try {
  const settings = await readSettings();
  for (const name of names) {
    const control = document.querySelector<HTMLInputElement>("#" + name)!;
    control.checked = settings[name];
    control.disabled = false;
  }
  terms.value = settings.terms.join("\n");
  terms.disabled = false;
  save.disabled = false;
} catch {
  showStatus("storageError", true);
}
