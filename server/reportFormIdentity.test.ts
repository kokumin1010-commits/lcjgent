import { describe, expect, it } from "vitest";
import {
  buildReportStaffOptions,
  isHistoricalReportStaffIdentity,
  resolveReportSubmissionStaffId,
  shouldSendReportStaffIdOnUpdate,
} from "../client/src/lib/reportFormIdentity";

describe("daily report form staff identity", () => {
  const activeSelf = {
    id: 11,
    name: "Current Staff",
    country: "日本",
    isActive: "active" as const,
  };
  const historical = {
    id: 88,
    name: "Historical Staff",
    country: "中国",
    isActive: "inactive" as const,
  };

  it("shows the original historical staff while editing an authorized legacy report", () => {
    expect(
      buildReportStaffOptions({
        writableStaff: [activeSelf],
        isEditMode: true,
        canEditExisting: true,
        existingReportStaffId: 88,
        existingReportStaff: historical,
      })
    ).toEqual([activeSelf, historical]);
  });

  it("does not expose historical staff as a selectable identity on new reports", () => {
    expect(
      buildReportStaffOptions({
        writableStaff: [activeSelf],
        isEditMode: false,
        canEditExisting: true,
        existingReportStaffId: 88,
        existingReportStaff: historical,
      })
    ).toEqual([activeSelf]);
  });

  it("does not expose a legacy identity when the current user cannot edit the report", () => {
    expect(
      buildReportStaffOptions({
        writableStaff: [],
        isEditMode: true,
        canEditExisting: false,
        existingReportStaffId: 88,
        existingReportStaff: historical,
      })
    ).toEqual([]);
  });

  it("falls back to the stored report staff id only in edit mode", () => {
    expect(
      resolveReportSubmissionStaffId({
        selectedReportStaffId: "",
        isEditMode: true,
        existingReportStaffId: 88,
      })
    ).toBe(88);
    expect(
      resolveReportSubmissionStaffId({
        selectedReportStaffId: "",
        isEditMode: false,
        existingReportStaffId: 88,
      })
    ).toBeNull();
    expect(
      resolveReportSubmissionStaffId({
        selectedReportStaffId: "",
        isEditMode: true,
        existingReportStaffId: null,
      })
    ).toBeNull();
  });

  it("marks a staff id outside the writable roster as historical only for edits", () => {
    expect(
      isHistoricalReportStaffIdentity({
        isEditMode: true,
        selectedReportStaffId: "88",
        writableStaffIds: [11],
      })
    ).toBe(true);
    expect(
      isHistoricalReportStaffIdentity({
        isEditMode: false,
        selectedReportStaffId: "88",
        writableStaffIds: [11],
      })
    ).toBe(false);
  });

  it("does not send an unchanged reportStaffId and only lets all-scope admins rebind it", () => {
    expect(
      shouldSendReportStaffIdOnUpdate({
        canViewAllReports: false,
        selectedReportStaffId: 11,
        existingReportStaffId: 88,
      })
    ).toBe(false);
    expect(
      shouldSendReportStaffIdOnUpdate({
        canViewAllReports: true,
        selectedReportStaffId: 88,
        existingReportStaffId: 88,
      })
    ).toBe(false);
    expect(
      shouldSendReportStaffIdOnUpdate({
        canViewAllReports: true,
        selectedReportStaffId: 11,
        existingReportStaffId: 88,
      })
    ).toBe(true);
  });
});
