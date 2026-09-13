import { z } from "zod";
import { invokeLLM } from "./_core/llm";

const jstDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const screenshotResultSchema = z.object({
  readable: z.boolean(),
  timeReadable: z.boolean(),
  liveStartedAtJst: z.string().regex(jstDateTimePattern).nullable(),
  liveEndedAtJst: z.string().regex(jstDateTimePattern).nullable(),
  timeEvidence: z.string().max(400),
  totalGmv: z.number().int().min(0),
  streamMinutes: z.number().int().min(0),
  products: z.array(z.object({
    productName: z.string().min(1).max(255),
    gmv: z.number().int().min(0),
    isBrandProduct: z.boolean(),
    confidenceBasisPoints: z.number().int().min(0).max(10_000),
  })).max(100),
  notes: z.array(z.string().max(300)).max(20),
}).superRefine((value, context) => {
  if (value.timeReadable && (!value.liveStartedAtJst || !value.liveEndedAtJst)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Readable time requires both start and end." });
  }
});

const responseFormat = {
  type: "json_schema" as const,
  json_schema: {
    name: "tiktok_live_result",
    strict: true,
    schema: {
      type: "object",
      properties: {
        readable: { type: "boolean" },
        timeReadable: { type: "boolean" },
        liveStartedAtJst: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}$" },
        liveEndedAtJst: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}$" },
        timeEvidence: { type: "string", maxLength: 400 },
        totalGmv: { type: "integer", minimum: 0 },
        streamMinutes: { type: "integer", minimum: 0 },
        products: { type: "array", maxItems: 100, items: { type: "object", properties: { productName: { type: "string" }, gmv: { type: "integer", minimum: 0 }, isBrandProduct: { type: "boolean" }, confidenceBasisPoints: { type: "integer", minimum: 0, maximum: 10000 } }, required: ["productName", "gmv", "isBrandProduct", "confidenceBasisPoints"], additionalProperties: false } },
        notes: { type: "array", maxItems: 20, items: { type: "string", maxLength: 300 } },
      },
      required: ["readable", "timeReadable", "liveStartedAtJst", "liveEndedAtJst", "timeEvidence", "totalGmv", "streamMinutes", "products", "notes"],
      additionalProperties: false,
    },
  },
};

export type ScreenshotRecognitionFailureCode = "AI_CREDITS_UNAVAILABLE" | "AI_IMAGE_UNAVAILABLE" | "AI_RESPONSE_INVALID" | "AI_SERVICE_UNAVAILABLE";

export function classifyScreenshotRecognitionError(error: unknown): ScreenshotRecognitionFailureCode {
  const message = error instanceof Error ? error.message : String(error);
  if (/\b(402|412|429)\b|usage exhausted|quota|credit/i.test(message)) return "AI_CREDITS_UNAVAILABLE";
  if (/JSON|schema|structured|parse|content/i.test(message)) return "AI_RESPONSE_INVALID";
  if (/image|signed|url|fetch|download|403|404/i.test(message)) return "AI_IMAGE_UNAVAILABLE";
  return "AI_SERVICE_UNAVAILABLE";
}

export function screenshotRecognitionErrorMessage(code: ScreenshotRecognitionFailureCode) {
  if (code === "AI_CREDITS_UNAVAILABLE") return "AIの利用上限により自動読み取りを完了できませんでした。日時エラーではありません。原画像を確認して人工入力してください。";
  if (code === "AI_IMAGE_UNAVAILABLE") return "AIが原画像を取得できませんでした。日時エラーではありません。画像を再選択するか、人工入力してください。";
  if (code === "AI_RESPONSE_INVALID") return "AIの読み取り結果を安全に確認できませんでした。日時エラーではありません。原画像を確認して人工入力してください。";
  return "AIサービスに接続できませんでした。日時エラーではありません。原画像を確認して人工入力してください。";
}

function recognitionQuality(result: z.infer<typeof screenshotResultSchema>) {
  const productGmvSum = result.products.reduce((sum, product) => sum + product.gmv, 0);
  const metricsConsistent = !result.readable || result.totalGmv >= productGmvSum;
  let timeConsistent = !result.timeReadable;
  if (result.timeReadable && result.liveStartedAtJst && result.liveEndedAtJst) {
    const startedAt = Date.parse(`${result.liveStartedAtJst}:00+09:00`);
    const endedAt = Date.parse(`${result.liveEndedAtJst}:00+09:00`);
    const timestampMinutes = Number.isFinite(startedAt) && Number.isFinite(endedAt) && endedAt > startedAt ? Math.floor((endedAt - startedAt) / 60_000) : -1;
    timeConsistent = timestampMinutes >= 0 && Math.abs(timestampMinutes - result.streamMinutes) <= 5;
  }
  const score = Number(result.readable) * 4 + Number(result.timeReadable) * 3 + Number(metricsConsistent) * 2 + Number(timeConsistent);
  return { productGmvSum, metricsConsistent, timeConsistent, score };
}

export type BrandDayRecognitionContext = {
  selectedDay: number;
  eventYear: number;
  eventTitle: string;
  brandKeywords: string[];
  timezone?: string;
};

export async function recognizeBrandDayScreenshot(signedImageUrl: string, context: BrandDayRecognitionContext) {
  const models = ["claude-haiku-4-5", "gpt-5-mini"] as const;
  const failures: ScreenshotRecognitionFailureCode[] = [];
  let best: (z.infer<typeof screenshotResultSchema> & { model: string }) | null = null;

  for (const model of models) {
    try {
      const response = await invokeLLM({
        model,
        ...(model.startsWith("gpt-") ? {} : { max_tokens: 4096 }),
        messages: [
          { role: "system", content: `You extract TikTok Shop LIVE analytics from screenshots. Never guess text or timestamps that are not visibly supported. The event is ${context.eventTitle}; event year is ${context.eventYear}; displayed times use ${context.timezone || "Asia/Tokyo"}. Brand products are items whose visible brand or product text matches one of these keywords: ${context.brandKeywords.join(", ") || "none provided"}. totalGmv MUST be the large overall GMV value in the top summary area; never use one product amount, brand-product subtotal, or checked-product sum as totalGmv. Cross-check totalGmv is not lower than the visible product GMV sum. Return strict JSON only.` },
          { role: "user", content: [
            { type: "text", text: `The uploader selected DAY ${context.selectedDay}. Read the screenshot and extract: the OVERALL total GMV from the large top summary card, displayed streaming duration in minutes, every visible product with GMV, and the LIVE session start/end date-time when visibly shown. The overall total GMV is not the selected brand subtotal and not any one product row. Resolve visible month/day values to year ${context.eventYear}. Do not infer start/end merely from DAY ${context.selectedDay} or duration. timeReadable=true only when both timestamps are visibly supported; otherwise return null timestamps and explain what is missing in timeEvidence. readable describes whether GMV/duration/product metrics are sufficiently readable. Use 0 only for unreadable metrics and explain in notes.` },
            { type: "image_url", image_url: { url: signedImageUrl, detail: "high" } },
          ] },
        ],
        response_format: responseFormat,
      });
      if (!Array.isArray(response.choices) || !response.choices.length) {
        const errorValue = (response as unknown as { error?: unknown }).error;
        const errorSummary = JSON.stringify(errorValue ?? null).replace(/https?:\/\/\S+/g, "[URL]").slice(0, 500);
        throw new Error(`AI response missing choices; keys=${Object.keys(response as object).join(",")}; error=${errorSummary}`);
      }
      const content = response.choices[0]?.message.content;
      if (typeof content !== "string") throw new Error("AI returned no structured content");
      const parsed = screenshotResultSchema.parse(JSON.parse(content));
      const result = { ...parsed, model: response.model || model };
      const quality = recognitionQuality(result);
      if (!best || quality.score > recognitionQuality(best).score || (quality.score === recognitionQuality(best).score && result.totalGmv > best.totalGmv)) best = result;
      if (result.readable && result.timeReadable && quality.metricsConsistent && quality.timeConsistent) return result;
      console.warn("[BrandDay TikTok Recognition Quality]", JSON.stringify({ model, metricsConsistent: quality.metricsConsistent, timeConsistent: quality.timeConsistent, totalGmv: result.totalGmv, productGmvSum: quality.productGmvSum, streamMinutes: result.streamMinutes }));
    } catch (error) {
      const code = classifyScreenshotRecognitionError(error);
      failures.push(code);
      const safeMessage = (error instanceof Error ? error.message : String(error)).replace(/https?:\/\/\S+/g, "[URL]").slice(0, 500);
      console.error("[BrandDay TikTok Recognition Model]", JSON.stringify({ model, code, message: safeMessage }));
    }
  }

  if (best) {
    const quality = recognitionQuality(best);
    return {
      ...best,
      readable: best.readable && quality.metricsConsistent,
      timeReadable: best.timeReadable && quality.timeConsistent,
      liveStartedAtJst: best.timeReadable && quality.timeConsistent ? best.liveStartedAtJst : null,
      liveEndedAtJst: best.timeReadable && quality.timeConsistent ? best.liveEndedAtJst : null,
      notes: [
        ...best.notes,
        ...(!quality.metricsConsistent ? ["AI quality check: total GMV is lower than the visible product GMV sum; manual confirmation is required."] : []),
        ...(!quality.timeConsistent ? ["AI quality check: displayed timestamps and duration are inconsistent; manual confirmation is required."] : []),
      ],
    };
  }
  const primaryFailure = failures[0] ?? "AI_SERVICE_UNAVAILABLE";
  throw new Error(primaryFailure);
}

export async function recognizeTikTokScreenshot(signedImageUrl: string, selectedDay: number) {
  return recognizeBrandDayScreenshot(signedImageUrl, {
    selectedDay,
    eventYear: 2026,
    eventTitle: "KYOGOKU BRAND DAY 2026",
    brandKeywords: ["KYOGOKU", "KG"],
    timezone: "Asia/Tokyo",
  });
}
