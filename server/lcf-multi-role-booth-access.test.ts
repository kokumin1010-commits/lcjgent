import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hasFestivalBoothAccess } from "./festivalAuthRouter";

const read = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("LCF same-email multi-role booth access", () => {
  const authRouter = read("server/festivalAuthRouter.ts");
  const festivalRouter = read("server/festivalRouter.ts");
  const boothRouter = read("server/boothReservationRouter.ts");
  const mypage = read("client/src/pages/LcfMypage.tsx");
  const reservationPage = read("client/src/pages/LcfBoothReservation.tsx");
  const checkinPage = read("client/src/pages/LcfBoothCheckin.tsx");

  it("keeps primary liver accounts eligible and grants eligibility to another primary type with an active liver application", () => {
    expect(hasFestivalBoothAccess("liver", false)).toBe(true);
    expect(hasFestivalBoothAccess("general", true)).toBe(true);
    expect(hasFestivalBoothAccess("company", true)).toBe(true);
    expect(hasFestivalBoothAccess("general", false)).toBe(false);
    expect(hasFestivalBoothAccess("company", false)).toBe(false);
    expect(hasFestivalBoothAccess("admin", true)).toBe(false);
  });

  it("derives the capability from a current 2026 liver application instead of rewriting the primary account type", () => {
    expect(authRouter).toContain("canAccountReserveBooth");
    expect(authRouter).toContain("festivalLiverApplications.eventYear, \"2026\"");
    expect(authRouter).toContain('inArray(festivalLiverApplications.status, ["new", "confirmed"])');
    expect(authRouter).toContain("canReserveBooth");
    expect(authRouter).not.toContain('set({ accountType: "liver"');
  });

  it("returns all same-email admission tickets without relying on the primary account type", () => {
    const start = festivalRouter.indexOf("getMyTickets: festivalUserProcedure");
    const end = festivalRouter.indexOf("getMyTicket: publicProcedure", start);
    const getMyTickets = festivalRouter.slice(start, end);
    expect(getMyTickets).toContain("WHERE LOWER(applicantEmail) = ?");
    expect(getMyTickets).not.toContain("applicantType = ?");
  });

  it("rechecks the active liver application while holding the account transaction lock before creating a reservation", () => {
    const start = boothRouter.indexOf("createReservation: festivalUserProcedure");
    const end = boothRouter.indexOf("getReservation: festivalUserProcedure", start);
    const createReservation = boothRouter.slice(start, end);
    expect(createReservation).toContain("FROM festival_accounts");
    expect(createReservation).toContain("FROM festival_liver_applications");
    expect(createReservation).toContain("status IN ('new', 'confirmed')");
    expect(createReservation).toContain("FOR UPDATE");
    expect(createReservation).not.toContain('account.account_type !== "liver" ||');
  });

  it("uses the capability consistently on mypage, the standalone reservation page and booth QR check-in", () => {
    expect(mypage).toContain("{me.canReserveBooth && (");
    expect(mypage).toContain("一般参加・ライバー");
    expect(reservationPage).toContain("enabled: !!me?.canReserveBooth");
    expect(reservationPage).toContain("if (!me.canReserveBooth)");
    expect(checkinPage).toContain("meQuery.data?.canReserveBooth");
    expect(checkinPage).toContain("if (!meQuery.data.canReserveBooth)");
  });

  it("does not add a database migration, dependency or new environment variable for the capability", () => {
    expect(authRouter).not.toContain("ALTER TABLE festival_accounts ADD COLUMN can_reserve_booth");
    expect(boothRouter).not.toContain("LCF_MULTI_ROLE");
  });
});
