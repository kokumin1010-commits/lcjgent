export type UiRenderErrorPresentation = {
  code: "ERR_LCJ_DOM_MUTATION_CONFLICT" | "ERR_LCJ_UI_RENDER";
  message: string;
};

export function getUiRenderErrorPresentation(error: unknown): UiRenderErrorPresentation {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error || "");
  const isDomMutationConflict = (
    name === "NotFoundError"
    && (message.includes("insertBefore") || message.includes("removeChild"))
  );

  if (isDomMutationConflict) {
    return {
      code: "ERR_LCJ_DOM_MUTATION_CONFLICT",
      message: "画面要素の更新競合を検出しました。画面を再読込してください。",
    };
  }

  return {
    code: "ERR_LCJ_UI_RENDER",
    message: "画面の描画中にエラーが発生しました。",
  };
}
