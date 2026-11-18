const decimalDigits = /\p{Nd}/gu;
const decimalDigit = /^\p{Nd}$/u;
const digitValues = new Map<string, string>();

function toAsciiDigit(digit: string): string {
  if (digit >= "0" && digit <= "9") return digit;
  const cached = digitValues.get(digit);
  if (cached !== undefined) return cached;

  const code = digit.codePointAt(0)!;
  let start = code;
  while (start > 0 && decimalDigit.test(String.fromCodePoint(start - 1))) start--;
  const value = String((code - start) % 10);
  digitValues.set(digit, value);
  return value;
}

export function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\p{Cf}\u0640\u064b-\u065f\u0670]/gu, "")
    .replace(decimalDigits, toAsciiDigit)
    .replace(/\s+/gu, " ")
    .trim();
}

const separator = "[\\s._·・\\p{Pd}]*";
const latinOrCyrillic = "[\\p{Script=Latin}\\p{Script=Cyrillic}\\p{Nd}]";
const standardTitle = new RegExp(
  "(?<!" + latinOrCyrillic + ")(?:gta|гта|grand" + separator + "theft" + separator +
    "auto)" + separator + "(?:6|vi)(?!" + latinOrCyrillic + ")",
  "u",
);
const topicalHashtag = /#(?:gta|гта|grandtheftauto)_?(?:6|vi)_?(?:(?:leaks?|spoilers?|gameplay|news|trailers?|updates?|rockstargames|утечк[аи]|спойлер[ыи]?))+(?![\p{Script=Latin}\p{Script=Cyrillic}\p{Nd}])/u;
const localizedNames = [
  "侠盗猎车手", "俠盜獵車手", "俠盜獵車", "侠盗猎车", "横行霸道", "橫行霸道",
  "グランド セフト オート", "グラセフ", "그랜드 테프트 오토", "지티에이",
  "جراند ثفت أوتو", "جراند ثفت اوتو", "غراند ثفت أوتو", "غراند ثفت اوتو",
  "جي تي إيه", "جي تي اي", "जीटीए", "ग्रैंड थेफ्ट ऑटो", "ग्रैंड थेफ़्ट ऑटो",
];
const localizedTitle = new RegExp(
  "(?:" + localizedNames.map((name) => normalize(name).split(" ").join(separator)).join("|") +
    ")" + separator + "(?:6|vi)(?!" + latinOrCyrillic + ")",
  "u",
);

export function cleanTerms(terms: readonly string[]): string[] {
  const unique = new Map<string, string>();
  for (const term of terms) {
    const normalized = normalize(term);
    if (normalized && !unique.has(normalized)) unique.set(normalized, term.trim());
  }
  return [...unique.values()];
}

export function createMatcher(terms: readonly string[]): (fields: readonly string[]) => boolean {
  const customTerms = cleanTerms(terms).map(normalize);
  return (fields) => fields.some((field) => {
    const text = normalize(field);
    return standardTitle.test(text) || topicalHashtag.test(text) || localizedTitle.test(text) ||
      customTerms.some((term) => text.includes(term));
  });
}
