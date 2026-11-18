import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanTerms, createMatcher } from "../src/matcher.ts";

const matches = createMatcher([]);

test("finds titles, numerals and hashtags independently of the surrounding language", () => {
  const examples = [
    "GTA 6", "#GTA6", "GTA-VI", "Grand Theft Auto Ⅵ", "GＴＡ　６",
    "Grand.Theft.Auto.6", "#GTAVINews", "#GTA6Leaks", "GTA\u200B6",
    "новости по ГТА-6", "GTA السادس: GTA ٦", "جراند ثفت أوتو ۶",
    "ग्रैंड थेफ़्ट ऑटो ६", "GTA৬খবর", "侠盗猎车手６新预告", "俠盜獵車手VI資訊",
    "解説GTA6予告", "グランド・セフト・オートⅥ", "그랜드 테프트 오토 6 소식",
  ];
  for (const example of examples) {
    assert.equal(matches([example]), true, example);
  }
});

test("leaves other GTA titles and unrelated text visible", () => {
  for (const example of [
    "GTA V", "Grand Theft Auto 5", "GTA Online", "GTA 60", "GTA VII",
    "GTA Vice City", "MEGTA6", "file.gta61", "GTA", "six chapters", "6",
  ]) {
    assert.equal(matches([example]), false, example);
  }
  assert.equal(matches(["GTA", "6"]), false);
});

test("normalizes and deduplicates custom phrases without treating them as regexes", () => {
  assert.deepEqual(cleanTerms([" ", " [Draft].+ ", "[DRAFT].+", "新词", "\u200B"]), ["[Draft].+", "新词"]);
  const custom = createMatcher(["[Draft].+", "新词", "mÜnchen   news"]);
  for (const example of ["See ［DRAFT］.+ here", "测试新词可识别", "München news heute"]) {
    assert.equal(custom([example]), true, example);
  }
  assert.equal(custom(["Draft text plus"]), false);
});
