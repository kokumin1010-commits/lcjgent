import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isOfficialTikTokUrl, normalizeLcmTikTokUrl } from "../shared/lcmSocialUrls";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("LCM TikTok profile URL input", () => {
  it.each([
    ["@Ryu.Kyogoku", "https://www.tiktok.com/@Ryu.Kyogoku"],
    ["ryukyogoku", "https://www.tiktok.com/@ryukyogoku"],
    ["www.tiktok.com/@ryukyogoku?_t=abc&_r=1", "https://www.tiktok.com/@ryukyogoku"],
    ["https://www.tiktok.com/@ryukyogoku?lang=ja", "https://www.tiktok.com/@ryukyogoku"],
    ["ｈｔｔｐｓ：／／ｗｗｗ．ｔｉｋｔｏｋ．ｃｏｍ／＠ｒｙｕｋｙｏｇｏｋｕ", "https://www.tiktok.com/@ryukyogoku"],
    ["TikTokで動画を見る https://vt.tiktok.com/ZS123abc/ から共有", "https://vt.tiktok.com/ZS123abc/"],
    ["http://vm.tiktok.com/ZS987xyz/", "https://vm.tiktok.com/ZS987xyz/"],
  ])("normalizes %s", (input, expected) => {
    const normalized = normalizeLcmTikTokUrl(input);
    expect(normalized).toBe(expected);
    expect(isOfficialTikTokUrl(normalized)).toBe(true);
  });

  it.each([
    "https://example.com/@ryukyogoku",
    "https://tiktok.com.example.com/@ryukyogoku",
    "javascript:alert(1)",
    "not a valid account",
  ])("does not turn an unsafe value into an accepted TikTok URL: %s", (input) => {
    expect(isOfficialTikTokUrl(normalizeLcmTikTokUrl(input))).toBe(false);
  });

  it("uses the same normalizer in the browser and the server", () => {
    const workspace = read("client/src/components/lcm/LcmCreatorWorkspace.tsx");
    const router = read("server/lcmRouter.ts");
    expect(workspace).toContain("normalizeLcmTikTokUrl(tiktokUrl)");
    expect(workspace).toContain('type="text"');
    expect(workspace).toContain("onBlur={() => setTiktokUrl((value) => normalizeLcmTikTokUrl(value))}");
    expect(router).toContain(".transform(normalizeLcmTikTokUrl)");
    expect(router).toContain("isOfficialTikTokUrl(value)");
  });
});
