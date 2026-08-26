import { describe, expect, it } from "vitest";
import { getSidebarDisplayName } from "../client/src/lib/sidebarIdentity";

describe("getSidebarDisplayName", () => {
  it("uses the current signed-in user's name", () => {
    expect(getSidebarDisplayName({ name: "京極琉", email: "ryuhairartist@gmail.com" })).toBe("京極琉");
  });

  it("falls back to the email name when the profile name is empty", () => {
    expect(getSidebarDisplayName({ name: "  ", email: "staff@example.com" })).toBe("staff");
  });

  it("never renders an empty or undefined label", () => {
    expect(getSidebarDisplayName(null)).toBe("ユーザー");
  });
});
