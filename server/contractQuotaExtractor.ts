/**
 * contractQuotaExtractor.ts
 * 
 * ブランド契約のテキスト条件（KG老師直播条件、达人直播条件、短視頻条件）と
 * 契約期間ラベルからLLMで数値を自動抽出するモジュール。
 */

import { invokeLLM } from "./_core/llm";

export interface ExtractedQuota {
  // KG老師直播
  kgLiveHoursQuota: number | null;       // 月間合計分数
  kgLiveFrequency: number | null;         // 月間回数
  kgLiveMinutesPerSession: number | null; // 1回あたり分数
  
  // 达人直播
  liverLiveHoursQuota: number | null;     // 月間合計分数
  liverLiveAssignments: Array<{ liverName: string; minutesPerMonth: number }> | null;
  
  // 短視頻
  shortVideoCountQuota: number | null;    // 月間本数
  shortVideoAssignments: Array<{ liverName: string; countPerMonth: number }> | null;
  
  // 契約期間
  contractPeriodLabel: string | null;     // 例: "半年矩阵", "3个月"
}

/**
 * テキスト条件からノルマ数値を抽出する
 */
export async function extractQuotaFromConditions(params: {
  kgLiveCondition?: string | null;
  liverLiveCondition?: string | null;
  shortVideoCondition?: string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  memo?: string | null;
}): Promise<ExtractedQuota> {
  const { kgLiveCondition, liverLiveCondition, shortVideoCondition, startDate, endDate, memo } = params;
  
  // テキストが全て空なら抽出不要
  const hasText = [kgLiveCondition, liverLiveCondition, shortVideoCondition, memo].some(t => t && t.trim());
  if (!hasText && !startDate && !endDate) {
    return {
      kgLiveHoursQuota: null,
      kgLiveFrequency: null,
      kgLiveMinutesPerSession: null,
      liverLiveHoursQuota: null,
      liverLiveAssignments: null,
      shortVideoCountQuota: null,
      shortVideoAssignments: null,
      contractPeriodLabel: null,
    };
  }

  // 日付情報を文字列化
  let dateInfo = "";
  if (startDate || endDate) {
    const s = startDate ? new Date(startDate).toISOString().split("T")[0] : "不明";
    const e = endDate ? new Date(endDate).toISOString().split("T")[0] : "不明";
    dateInfo = `契約期間: ${s} ～ ${e}`;
  }

  const prompt = `あなたはライブコマース契約のノルマ条件を解析するアシスタントです。
以下のテキスト情報から、数値データを抽出してJSONで返してください。

【入力テキスト】
KG老師直播条件: ${kgLiveCondition || "なし"}
达人直播条件: ${liverLiveCondition || "なし"}
短視頻条件: ${shortVideoCondition || "なし"}
メモ: ${memo || "なし"}
${dateInfo}

【抽出ルール】
1. 時間の単位は全て「分」に変換する（1小时=60分, 1時間=60分, 1h=60分, 30分钟=30分）
2. 「每月1小时专场直播」→ kgLiveFrequency=1, kgLiveMinutesPerSession=60, kgLiveHoursQuota=60
3. 「30分钟 1h/月」→ kgLiveMinutesPerSession=30, kgLiveHoursQuota=60（1h/月が月間合計）
4. 达人の条件で名前が出てきたら liverLiveAssignments に入れる
   例: 「nana每月2小时」→ [{liverName:"nana", minutesPerMonth:120}]
   例: 「yae每月5小时」→ [{liverName:"yae", minutesPerMonth:300}]
   例: 「旗下 KOL：毎月合計 20小时」→ liverLiveHoursQuota=1200（個別名なし）
5. 短視頻の条件で本数を抽出する
   例: 「30条视频/月」→ shortVideoCountQuota=30
   例: 「每月1条种草视频」→ shortVideoCountQuota=1
6. 契約期間ラベルは日付の差から推定する
   - 6ヶ月前後 → "半年框" or "半年矩阵"
   - 3ヶ月前後 → "3个月"
   - 1ヶ月以内 → "単発"
   - テキストに明示的なラベルがあればそれを優先
7. 値が不明・該当なしの場合はnullにする
8. 「不低于20小时」のような表現は最低値を採用（20小时=1200分）

【重要】
- 必ず以下のJSON形式のみで返してください。説明文は不要です。`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "あなたはJSONのみを出力するアシスタントです。説明文は一切出力しないでください。" },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "contract_quota",
          strict: true,
          schema: {
            type: "object",
            properties: {
              kgLiveHoursQuota: { type: ["integer", "null"], description: "KG老師の月間配信ノルマ（分単位）" },
              kgLiveFrequency: { type: ["integer", "null"], description: "KG月間配信回数" },
              kgLiveMinutesPerSession: { type: ["integer", "null"], description: "KG 1回あたりの配信時間（分）" },
              liverLiveHoursQuota: { type: ["integer", "null"], description: "达人の月間配信ノルマ合計（分単位）" },
              liverLiveAssignments: {
                type: ["array", "null"],
                items: {
                  type: "object",
                  properties: {
                    liverName: { type: "string" },
                    minutesPerMonth: { type: "integer" },
                  },
                  required: ["liverName", "minutesPerMonth"],
                  additionalProperties: false,
                },
                description: "达人別ノルマ配列",
              },
              shortVideoCountQuota: { type: ["integer", "null"], description: "短視頻の月間本数ノルマ" },
              shortVideoAssignments: {
                type: ["array", "null"],
                items: {
                  type: "object",
                  properties: {
                    liverName: { type: "string" },
                    countPerMonth: { type: "integer" },
                  },
                  required: ["liverName", "countPerMonth"],
                  additionalProperties: false,
                },
                description: "达人別短視頻ノルマ配列",
              },
              contractPeriodLabel: { type: ["string", "null"], description: "契約期間ラベル（例: 半年框, 3个月, 単発）" },
            },
            required: [
              "kgLiveHoursQuota",
              "kgLiveFrequency",
              "kgLiveMinutesPerSession",
              "liverLiveHoursQuota",
              "liverLiveAssignments",
              "shortVideoCountQuota",
              "shortVideoAssignments",
              "contractPeriodLabel",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      console.error("[contractQuotaExtractor] LLM returned empty content");
      return getEmptyQuota();
    }

    const parsed = JSON.parse(content) as ExtractedQuota;
    console.log("[contractQuotaExtractor] Extracted:", JSON.stringify(parsed));
    return parsed;
  } catch (error) {
    console.error("[contractQuotaExtractor] Error:", error);
    return getEmptyQuota();
  }
}

function getEmptyQuota(): ExtractedQuota {
  return {
    kgLiveHoursQuota: null,
    kgLiveFrequency: null,
    kgLiveMinutesPerSession: null,
    liverLiveHoursQuota: null,
    liverLiveAssignments: null,
    shortVideoCountQuota: null,
    shortVideoAssignments: null,
    contractPeriodLabel: null,
  };
}

/**
 * 複数の契約からノルマ数値を一括抽出する（バッチ処理用）
 */
export async function extractQuotaBatch(contracts: Array<{
  id: number;
  kgLiveCondition?: string | null;
  liverLiveCondition?: string | null;
  shortVideoCondition?: string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  memo?: string | null;
}>): Promise<Array<{ id: number; quota: ExtractedQuota }>> {
  const results: Array<{ id: number; quota: ExtractedQuota }> = [];
  
  for (const contract of contracts) {
    try {
      const quota = await extractQuotaFromConditions({
        kgLiveCondition: contract.kgLiveCondition,
        liverLiveCondition: contract.liverLiveCondition,
        shortVideoCondition: contract.shortVideoCondition,
        startDate: contract.startDate,
        endDate: contract.endDate,
        memo: contract.memo,
      });
      results.push({ id: contract.id, quota });
      // Rate limiting: 500ms delay between LLM calls
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`[contractQuotaExtractor] Batch error for contract ${contract.id}:`, error);
      results.push({ id: contract.id, quota: getEmptyQuota() });
    }
  }
  
  return results;
}
