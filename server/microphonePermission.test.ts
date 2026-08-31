import fs from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  classifyMicrophoneIssue,
  getMicrophoneIssueCopy,
  permissionStateLabel,
  requestMicrophoneStream,
  type MicrophonePermissionState,
} from "../shared/microphonePermission";

function namedError(name: string, message = name): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

function fakeStream() {
  return {
    getTracks: vi.fn(() => []),
  } as unknown as MediaStream;
}

function stubBrowser(
  getUserMedia: ReturnType<typeof vi.fn>,
  secure = true,
  recorder = true
) {
  vi.stubGlobal("window", { isSecureContext: secure });
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  if (recorder) {
    vi.stubGlobal("MediaRecorder", class MediaRecorderMock {});
  } else {
    vi.stubGlobal("MediaRecorder", undefined);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("microphone error classification", () => {
  const cases: Array<[string, MicrophonePermissionState, string, string]> = [
    ["NotAllowedError", "denied", "permission_denied", "MIC_PERMISSION_DENIED"],
    [
      "PermissionDeniedError",
      "unsupported",
      "permission_denied",
      "MIC_PERMISSION_DENIED",
    ],
    ["NotFoundError", "prompt", "device_not_found", "MIC_DEVICE_NOT_FOUND"],
    ["NotReadableError", "granted", "device_busy", "MIC_DEVICE_BUSY"],
    [
      "OverconstrainedError",
      "prompt",
      "constraints_unsupported",
      "MIC_CONSTRAINTS_UNSUPPORTED",
    ],
    ["AbortError", "prompt", "request_aborted", "MIC_REQUEST_ABORTED"],
    [
      "InsecureContextError",
      "unknown",
      "insecure_context",
      "MIC_INSECURE_CONTEXT",
    ],
    [
      "MediaRecorderUnsupportedError",
      "unknown",
      "recorder_unsupported",
      "MIC_RECORDER_UNSUPPORTED",
    ],
  ];

  it.each(cases)(
    "maps %s to %s",
    (errorName, permissionState, code, diagnosticCode) => {
      const issue = classifyMicrophoneIssue(
        namedError(errorName),
        permissionState
      );
      expect(issue.code).toBe(code);
      expect(issue.diagnosticCode).toBe(diagnosticCode);
      expect(issue.errorName).toBe(errorName);
    }
  );

  it("uses a denied permission state as evidence even when the browser error name is vague", () => {
    expect(
      classifyMicrophoneIssue(namedError("UnknownError"), "denied").code
    ).toBe("permission_denied");
  });
});

describe("microphone recovery copy", () => {
  const denied = classifyMicrophoneIssue(
    namedError("NotAllowedError"),
    "denied"
  );

  it("provides actionable Chinese steps without exposing the raw browser message", () => {
    const copy = getMicrophoneIssueCopy(denied, "zh-CN");
    expect(copy.title).toContain("麦克风权限被阻止");
    expect(copy.steps.join(" ")).toContain("网站设置");
    expect(copy.steps.join(" ")).toContain("系统设置");
    expect(copy.retryLabel).toBe("重新检测并录音");
    expect(JSON.stringify(copy)).not.toContain("Permission denied");
  });

  it("provides the same recovery flow in Japanese", () => {
    const copy = getMicrophoneIssueCopy(denied, "ja-JP");
    expect(copy.title).toContain("マイクの使用がブロック");
    expect(copy.steps.join(" ")).toContain("サイト設定");
    expect(copy.retryLabel).toBe("再確認して録音");
  });

  it("labels all permission states without treating unsupported queries as denied", () => {
    expect(permissionStateLabel("granted", "zh-CN")).toBe("已允许");
    expect(permissionStateLabel("denied", "ja-JP")).toBe("ブロック中");
    expect(permissionStateLabel("unsupported", "zh-CN")).toContain("不支持");
  });
});

describe("microphone request", () => {
  it("requests optimized audio once when the browser accepts it", async () => {
    const stream = fakeStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    stubBrowser(getUserMedia);

    await expect(requestMicrophoneStream()).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100,
      },
    });
  });

  it("falls back once to basic audio only for unsupported constraints", async () => {
    const stream = fakeStream();
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(namedError("OverconstrainedError"))
      .mockResolvedValueOnce(stream);
    stubBrowser(getUserMedia);

    await expect(requestMicrophoneStream()).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(getUserMedia).toHaveBeenLastCalledWith({ audio: true });
  });

  it("does not loop or reprompt automatically after permission denial", async () => {
    const denial = namedError("NotAllowedError", "Permission denied");
    const getUserMedia = vi.fn().mockRejectedValue(denial);
    stubBrowser(getUserMedia);

    await expect(requestMicrophoneStream()).rejects.toBe(denial);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("fails before requesting hardware in an insecure context", async () => {
    const getUserMedia = vi.fn();
    stubBrowser(getUserMedia, false);

    await expect(requestMicrophoneStream()).rejects.toMatchObject({
      name: "InsecureContextError",
    });
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("fails before requesting hardware when MediaRecorder is unavailable", async () => {
    const getUserMedia = vi.fn();
    stubBrowser(getUserMedia, true, false);

    await expect(requestMicrophoneStream()).rejects.toMatchObject({
      name: "MediaRecorderUnsupportedError",
    });
    expect(getUserMedia).not.toHaveBeenCalled();
  });
});

describe("morning meeting integration", () => {
  const pageSource = fs.readFileSync(
    path.resolve(process.cwd(), "client/src/pages/MorningMeeting.tsx"),
    "utf8"
  );
  const alertSource = fs.readFileSync(
    path.resolve(
      process.cwd(),
      "client/src/components/morningMeeting/MicrophoneRecoveryAlert.tsx"
    ),
    "utf8"
  );

  it("routes both personal and team microphone requests through the shared helper", () => {
    expect(pageSource.match(/requestMicrophoneStream\(\)/g)).toHaveLength(2);
    expect(pageSource).not.toContain("navigator.mediaDevices.getUserMedia");
    expect(pageSource).toContain('captureMicrophoneIssue(err, "personal")');
    expect(pageSource).toContain('captureMicrophoneIssue(err, "team")');
  });

  it("renders actionable recovery alerts for both recording flows", () => {
    expect(pageSource.match(/<MicrophoneRecoveryAlert/g)).toHaveLength(2);
    expect(pageSource).toContain('data-testid="personal-record-button"');
    expect(pageSource).toContain('data-testid="team-record-button"');
    expect(alertSource).toContain('data-testid="microphone-recovery-alert"');
    expect(alertSource).toContain("issue.diagnosticCode");
  });
});
