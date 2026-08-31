import { AlertCircle, RefreshCw, ShieldCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getMicrophoneIssueCopy,
  type MicrophoneIssue,
  type MicrophonePermissionState,
  type RecordingLanguage,
} from "@shared/microphonePermission";

type MicrophoneRecoveryAlertProps = {
  issue: MicrophoneIssue;
  language: RecordingLanguage;
  permissionState: MicrophonePermissionState;
  retrying?: boolean;
  onRetry: () => void;
  onDismiss: () => void;
};

export function MicrophoneRecoveryAlert({
  issue,
  language,
  permissionState,
  retrying = false,
  onRetry,
  onDismiss,
}: MicrophoneRecoveryAlertProps) {
  const copy = getMicrophoneIssueCopy({ ...issue, permissionState }, language);

  return (
    <section
      role="alert"
      data-testid="microphone-recovery-alert"
      data-microphone-issue={issue.code}
      className="w-full rounded-2xl border border-red-200 bg-red-50 p-4 text-left text-red-950 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-red-100 p-2 text-red-700">
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-black text-red-900">{copy.title}</h3>
              <p className="mt-1 text-sm leading-6 text-red-800">
                {copy.summary}
              </p>
            </div>
            <button
              type="button"
              aria-label={copy.dismissLabel}
              onClick={onDismiss}
              className="rounded-full p-1 text-red-500 transition hover:bg-red-100 hover:text-red-800 active:scale-[0.97]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <ol className="mt-3 space-y-2 text-sm leading-6 text-red-900">
            {copy.steps.map((step, index) => (
              <li key={step} className="flex gap-2">
                <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-white text-xs font-black text-red-700 ring-1 ring-red-200">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-semibold text-red-800 ring-1 ring-red-200">
                <ShieldCheck className="h-3.5 w-3.5" />
                {copy.permissionLabel}
              </span>
              <code className="break-all rounded bg-red-100 px-2 py-1 font-mono text-[11px] text-red-700">
                {issue.diagnosticCode} · {issue.errorName}
              </code>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={onRetry}
              disabled={retrying}
              className="w-full bg-red-600 text-white hover:bg-red-700 sm:w-auto"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${retrying ? "animate-spin" : ""}`}
              />
              {copy.retryLabel}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
