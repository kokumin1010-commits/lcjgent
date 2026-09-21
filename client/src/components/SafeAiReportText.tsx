import React from "react";

type SafeAiReportTextProps = {
  content: string | null | undefined;
  emptyText?: string;
};

export function SafeAiReportText({ content, emptyText = "分析内容はありません" }: SafeAiReportTextProps) {
  return (
    <div className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-700">
      {content || emptyText}
    </div>
  );
}
