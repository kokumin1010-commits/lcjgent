export type RecordingLanguage = "ja-JP" | "zh-CN";

export type MicrophonePermissionState =
  | PermissionState
  | "unsupported"
  | "unknown";

export type MicrophoneIssueCode =
  | "permission_denied"
  | "insecure_context"
  | "device_not_found"
  | "device_busy"
  | "constraints_unsupported"
  | "request_aborted"
  | "recorder_unsupported"
  | "unknown";

export type MicrophoneIssue = {
  code: MicrophoneIssueCode;
  diagnosticCode: string;
  errorName: string;
  permissionState: MicrophonePermissionState;
};

export type MicrophoneIssueCopy = {
  title: string;
  summary: string;
  steps: string[];
  retryLabel: string;
  dismissLabel: string;
  permissionLabel: string;
};

const ISSUE_DIAGNOSTIC_CODE: Record<MicrophoneIssueCode, string> = {
  permission_denied: "MIC_PERMISSION_DENIED",
  insecure_context: "MIC_INSECURE_CONTEXT",
  device_not_found: "MIC_DEVICE_NOT_FOUND",
  device_busy: "MIC_DEVICE_BUSY",
  constraints_unsupported: "MIC_CONSTRAINTS_UNSUPPORTED",
  request_aborted: "MIC_REQUEST_ABORTED",
  recorder_unsupported: "MIC_RECORDER_UNSUPPORTED",
  unknown: "MIC_UNKNOWN",
};

function errorName(error: unknown): string {
  if (error && typeof error === "object" && "name" in error) {
    const value = String((error as { name?: unknown }).name || "").trim();
    if (value) return value;
  }
  return "UnknownError";
}

export function classifyMicrophoneIssue(
  error: unknown,
  permissionState: MicrophonePermissionState = "unknown"
): MicrophoneIssue {
  const name = errorName(error);
  const normalized = name.toLowerCase();

  let code: MicrophoneIssueCode = "unknown";
  if (normalized === "insecurecontexterror") {
    code = "insecure_context";
  } else if (
    normalized === "mediarecorderunsupportederror" ||
    normalized === "notsupportederror"
  ) {
    code = "recorder_unsupported";
  } else if (
    normalized === "notallowederror" ||
    normalized === "permissiondeniederror" ||
    normalized === "securityerror" ||
    permissionState === "denied"
  ) {
    code = "permission_denied";
  } else if (
    normalized === "notfounderror" ||
    normalized === "devicesnotfounderror"
  ) {
    code = "device_not_found";
  } else if (
    normalized === "notreadableerror" ||
    normalized === "trackstarterror" ||
    normalized === "sourceunavailableerror"
  ) {
    code = "device_busy";
  } else if (
    normalized === "overconstrainederror" ||
    normalized === "constraintnotsatisfiederror"
  ) {
    code = "constraints_unsupported";
  } else if (
    normalized === "aborterror" ||
    normalized === "invalidstateerror"
  ) {
    code = "request_aborted";
  }

  return {
    code,
    diagnosticCode: ISSUE_DIAGNOSTIC_CODE[code],
    errorName: name,
    permissionState,
  };
}

export function getMicrophoneIssueCopy(
  issue: MicrophoneIssue,
  language: RecordingLanguage
): MicrophoneIssueCopy {
  const isZh = language === "zh-CN";
  const retryLabel = isZh ? "重新检测并录音" : "再確認して録音";
  const dismissLabel = isZh ? "暂时关闭" : "閉じる";
  const permissionLabel = isZh
    ? `麦克风权限：${permissionStateLabel(issue.permissionState, language)}`
    : `マイク権限：${permissionStateLabel(issue.permissionState, language)}`;

  const copies: Record<
    MicrophoneIssueCode,
    Omit<MicrophoneIssueCopy, "retryLabel" | "dismissLabel" | "permissionLabel">
  > = {
    permission_denied: {
      title: isZh ? "麦克风权限被阻止" : "マイクの使用がブロックされています",
      summary: isZh
        ? "浏览器或系统没有允许LCJ MALL使用麦克风。修改权限后无需重新登录。"
        : "ブラウザまたは端末でLCJ MALLのマイク使用が許可されていません。権限変更後の再ログインは不要です。",
      steps: isZh
        ? [
            "点击地址栏旁的锁形或网站设置图标，将“麦克风”改为“允许”。",
            "如果仍失败，请在电脑或手机的系统设置中允许Chrome/Safari使用麦克风。",
            "回到此页面后，点击下方“重新检测并录音”。",
          ]
        : [
            "アドレスバー横の鍵またはサイト設定を開き、「マイク」を「許可」に変更します。",
            "改善しない場合は、端末の設定でChrome/Safariのマイク使用を許可します。",
            "このページに戻り、下の「再確認して録音」を押します。",
          ],
    },
    insecure_context: {
      title: isZh
        ? "当前页面不能安全使用麦克风"
        : "このページでは安全にマイクを使用できません",
      summary: isZh
        ? "录音功能只能在正式HTTPS页面中使用。"
        : "録音機能は正式なHTTPSページでのみ使用できます。",
      steps: isZh
        ? [
            "请重新打开 https://lcjmall.com/master/morning-meeting。",
            "不要在内嵌预览、无痕限制页或复制的HTTP地址中录音。",
          ]
        : [
            "https://lcjmall.com/master/morning-meeting を開き直してください。",
            "埋め込みプレビューやHTTPのコピーURLでは録音しないでください。",
          ],
    },
    device_not_found: {
      title: isZh ? "没有检测到麦克风" : "マイクが見つかりません",
      summary: isZh
        ? "浏览器没有找到可用的录音设备。"
        : "利用できる録音デバイスが見つかりませんでした。",
      steps: isZh
        ? [
            "连接或启用麦克风。",
            "确认蓝牙耳机或USB麦克风已连接。",
            "返回页面后重新检测。",
          ]
        : [
            "マイクを接続または有効にします。",
            "BluetoothまたはUSBマイクの接続を確認します。",
            "ページに戻って再確認します。",
          ],
    },
    device_busy: {
      title: isZh ? "麦克风暂时无法读取" : "マイクを読み取れません",
      summary: isZh
        ? "麦克风可能被会议软件占用，或系统麦克风权限尚未开放。"
        : "会議アプリがマイクを使用中、または端末側のマイク権限が未許可の可能性があります。",
      steps: isZh
        ? [
            "关闭正在使用麦克风的会议或录音软件。",
            "检查系统麦克风权限。",
            "重新连接设备后再次检测。",
          ]
        : [
            "マイクを使用中の会議・録音アプリを閉じます。",
            "端末のマイク権限を確認します。",
            "デバイスを再接続して再確認します。",
          ],
    },
    constraints_unsupported: {
      title: isZh ? "麦克风设置不兼容" : "マイク設定に対応していません",
      summary: isZh
        ? "设备不支持优化录音参数，系统已尝试切换为基础录音模式。"
        : "最適化した録音設定に未対応のため、基本録音モードを試しました。",
      steps: isZh
        ? ["重新连接麦克风后再试。", "仍无法录音时，请更换浏览器或设备。"]
        : [
            "マイクを再接続して再試行します。",
            "改善しない場合はブラウザまたは端末を変更します。",
          ],
    },
    request_aborted: {
      title: isZh ? "麦克风请求被中断" : "マイクの要求が中断されました",
      summary: isZh
        ? "浏览器或系统中断了本次请求。"
        : "ブラウザまたは端末が今回の要求を中断しました。",
      steps: isZh
        ? ["等待几秒后重新检测。", "如果持续发生，请刷新页面。"]
        : [
            "数秒待ってから再確認します。",
            "続く場合はページを再読み込みします。",
          ],
    },
    recorder_unsupported: {
      title: isZh
        ? "当前浏览器不支持录音"
        : "このブラウザは録音に対応していません",
      summary: isZh
        ? "浏览器缺少必要的录音功能。"
        : "録音に必要な機能がブラウザにありません。",
      steps: isZh
        ? ["请使用最新版Chrome、Edge或Safari。", "更新浏览器后重新打开页面。"]
        : [
            "最新版のChrome、Edge、Safariを使用してください。",
            "ブラウザ更新後にページを開き直します。",
          ],
    },
    unknown: {
      title: isZh ? "无法启动麦克风" : "マイクを開始できません",
      summary: isZh
        ? "发生了未识别的麦克风错误，请按诊断代码重试。"
        : "識別できないマイクエラーが発生しました。診断コードを確認して再試行してください。",
      steps: isZh
        ? ["确认浏览器和系统麦克风权限。", "刷新页面后重新检测。"]
        : [
            "ブラウザと端末のマイク権限を確認します。",
            "ページを再読み込みして再確認します。",
          ],
    },
  };

  return {
    ...copies[issue.code],
    retryLabel,
    dismissLabel,
    permissionLabel,
  };
}

export function permissionStateLabel(
  state: MicrophonePermissionState,
  language: RecordingLanguage
): string {
  const isZh = language === "zh-CN";
  switch (state) {
    case "granted":
      return isZh ? "已允许" : "許可済み";
    case "denied":
      return isZh ? "已阻止" : "ブロック中";
    case "prompt":
      return isZh ? "等待确认" : "確認待ち";
    case "unsupported":
      return isZh ? "浏览器不支持状态查询" : "状態確認に未対応";
    default:
      return isZh ? "尚未确认" : "未確認";
  }
}

export async function getMicrophonePermissionStatus(): Promise<PermissionStatus | null> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query)
    return null;
  try {
    return await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
  } catch {
    return null;
  }
}

function namedError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

export async function requestMicrophoneStream(): Promise<MediaStream> {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    throw namedError(
      "InsecureContextError",
      "Microphone requires a secure context"
    );
  }
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    throw namedError(
      "NotSupportedError",
      "MediaDevices.getUserMedia is unavailable"
    );
  }
  if (typeof MediaRecorder === "undefined") {
    throw namedError(
      "MediaRecorderUnsupportedError",
      "MediaRecorder is unavailable"
    );
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100,
      },
    });
  } catch (error) {
    const issue = classifyMicrophoneIssue(error);
    if (issue.code !== "constraints_unsupported") throw error;
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  }
}
