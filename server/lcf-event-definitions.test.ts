import { describe, expect, it } from "vitest";
import {
  LCF_EVENT_DEFINITIONS,
  getLcfEventByEdition,
  getLcfEventByYear,
  isLcfEventYear,
  resolveLcfEdition,
} from "../shared/lcfEventDefinitions";

describe("LCF trusted event definitions", () => {
  it("maps only edition 2 to the second-edition storage key", () => {
    expect(resolveLcfEdition(2)).toBe(2);
    expect(resolveLcfEdition("2")).toBe(2);
    expect(getLcfEventByEdition(2).eventYear).toBe("2026-02");
    expect(getLcfEventByEdition("2").venueName).toContain("浜松町館");
  });

  it("keeps omitted, malformed and unlisted public values on the legacy edition", () => {
    for (const value of [undefined, null, "", 1, "1", 3, "2026-02", "../../2"]) {
      expect(resolveLcfEdition(value)).toBe(1);
      expect(getLcfEventByEdition(value).eventYear).toBe("2026");
    }
  });

  it("recognizes only the two trusted storage keys", () => {
    expect(isLcfEventYear("2026")).toBe(true);
    expect(isLcfEventYear("2026-02")).toBe(true);
    expect(isLcfEventYear("2027")).toBe(false);
    expect(isLcfEventYear("2026-03")).toBe(false);
    expect(getLcfEventByYear("2026-02")).toBe(LCF_EVENT_DEFINITIONS[2]);
    expect(getLcfEventByYear("untrusted")).toBe(LCF_EVENT_DEFINITIONS[1]);
  });
});
