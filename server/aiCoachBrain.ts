/**
 * AI Coach Brain - 3層構造の自律型コーチング脳
 * 
 * Layer 1: Master Brain (全ライバーの集合知) - 週1回自動再生成
 * Layer 2: Liver Memory (ライバー個別カルテ) - 毎コーチング後に自動更新
 * Layer 3: Session History (既存の20件チャット履歴)
 * 
 * このモジュールは以下を提供:
 * - updateLiverMemory(): コーチング後にライバーメモリを更新
 * - generateMasterKnowledge(): 全データからマスター知識を生成
 * - getLiverMemory(): ライバーの個別メモリを取得
 * - getMasterKnowledge(): アクティブなマスター知識を取得
 * - buildBrainContext(): 3層の知識をsystem promptに統合
 */

import { invokeLLM } from "./_core/llm";
import { eq, desc, and, sql as sqlTag, isNull, count, gte, asc } from "drizzle-orm";
import { getDb } from "./db";
import { aiCoachMasterKnowledge, aiCoachLiverMemory, aiCoachBrainLogs, aiCoachMessages, livers, brandLivestreams, brands, livestreamSets, livestreamSetItems } from "../drizzle/schema";

// ============================================================
// Layer 2: Liver Memory - ライバー個別カルテの自動更新
// ============================================================

/**
 * コーチングセッション後にライバーメモリを自動更新
 * LLMに「このセッションから何を学んだか」を要約させ、既存メモリとマージする
 */
export async function updateLiverMemory(liverId: number, sessionMessages: { role: string; content: string }[], livestreamContext?: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    // 既存のメモリを取得
    const [existingMemory] = await db
      .select()
      .from(aiCoachLiverMemory)
      .where(eq(aiCoachLiverMemory.liverId, liverId))
      .limit(1);

    // ライバー情報を取得
    const [liver] = await db
      .select({ id: livers.id, name: livers.name })
      .from(livers)
      .where(eq(livers.id, liverId))
      .limit(1);
    const liverName = liver?.name || 'ライバー';

    // 直近のセッションメッセージ（最大10件）を文字列化
    const recentSession = sessionMessages.slice(-10).map(m => 
      `${m.role === 'ai' ? 'コーチ' : liverName}: ${m.content}`
    ).join('\n');

    // LLMにメモリ更新を依頼
    const prompt = existingMemory
      ? `あなたはAIコーチングシステムの「記憶管理AI」です。以下の情報から、ライバー「${liverName}」のカルテ（個人記憶）を更新してください。

【現在のカルテ】
サマリー: ${existingMemory.summary}
強み: ${existingMemory.strengths || '未記録'}
弱み: ${existingMemory.weaknesses || '未記録'}
現在の目標: ${existingMemory.currentGoals || '未設定'}
過去のアドバイス結果: ${existingMemory.pastAdviceResults || '未記録'}
コミュニケーションスタイル: ${existingMemory.communicationStyle || '未分析'}
成長フェーズ: ${existingMemory.growthPhase}
コーチング回数: ${existingMemory.coachingCount}

【今回のセッション】
${recentSession}

${livestreamContext ? `【今回の配信データ】\n${livestreamContext}` : ''}

【タスク】
上記の情報を統合して、カルテを更新してください。以下のJSON形式で出力：`
      : `あなたはAIコーチングシステムの「記憶管理AI」です。ライバー「${liverName}」の初回カルテを作成してください。

【今回のセッション】
${recentSession}

${livestreamContext ? `【今回の配信データ】\n${livestreamContext}` : ''}

【タスク】
初回のカルテを作成してください。以下のJSON形式で出力：`;

    const response = await invokeLLM({
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `JSON形式で出力してください。余計な説明は不要です。` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "liver_memory_update",
          strict: true,
          schema: {
            type: "object",
            properties: {
              summary: { type: "string", description: "ライバーの総合的なサマリー（200文字以内）" },
              strengths: { type: "string", description: "強み（箇条書き）" },
              weaknesses: { type: "string", description: "弱み・改善点（箇条書き）" },
              currentGoals: { type: "string", description: "現在の目標（具体的に）" },
              pastAdviceResults: { type: "string", description: "過去のアドバイスとその結果（最新5件程度）" },
              communicationStyle: { type: "string", description: "コミュニケーションスタイルの特徴" },
              growthPhase: { type: "string", description: "成長フェーズ: new/developing/intermediate/advanced/expert" },
            },
            required: ["summary", "strengths", "weaknesses", "currentGoals", "pastAdviceResults", "communicationStyle", "growthPhase"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== 'string') return;

    let parsed: any;
    try {
      parsed = JSON.parse(content as string);
    } catch {
      console.error("[AI Brain] Failed to parse liver memory update response");
      return;
    }

    // 成長フェーズのバリデーション
    const validPhases = ['new', 'developing', 'intermediate', 'advanced', 'expert'] as const;
    const growthPhase = validPhases.includes(parsed.growthPhase) ? parsed.growthPhase : (existingMemory?.growthPhase || 'new');

    if (existingMemory) {
      // 既存メモリを更新
      await db.update(aiCoachLiverMemory)
        .set({
          summary: parsed.summary || existingMemory.summary,
          strengths: parsed.strengths || existingMemory.strengths,
          weaknesses: parsed.weaknesses || existingMemory.weaknesses,
          currentGoals: parsed.currentGoals || existingMemory.currentGoals,
          pastAdviceResults: parsed.pastAdviceResults || existingMemory.pastAdviceResults,
          communicationStyle: parsed.communicationStyle || existingMemory.communicationStyle,
          growthPhase: growthPhase,
          coachingCount: existingMemory.coachingCount + 1,
          lastCoachingAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(aiCoachLiverMemory.id, existingMemory.id));
    } else {
      // 新規メモリを作成
      await db.insert(aiCoachLiverMemory).values({
        liverId,
        summary: parsed.summary || `${liverName}の初回カルテ`,
        strengths: parsed.strengths,
        weaknesses: parsed.weaknesses,
        currentGoals: parsed.currentGoals,
        pastAdviceResults: parsed.pastAdviceResults,
        communicationStyle: parsed.communicationStyle,
        growthPhase: growthPhase,
        coachingCount: 1,
        lastCoachingAt: new Date(),
      });
    }

    // ログ記録
    await db.insert(aiCoachBrainLogs).values({
      action: 'update_memory',
      targetType: 'liver_memory',
      targetId: liverId,
      details: `Updated memory for ${liverName} (phase: ${growthPhase}, session msgs: ${sessionMessages.length})`,
    });

    console.log(`[AI Brain] Updated liver memory for ${liverName} (liverId: ${liverId})`);
  } catch (error: any) {
    console.error(`[AI Brain] Error updating liver memory for liverId ${liverId}:`, error.message);
  }
}

// ============================================================
// Layer 1: Master Brain - 全ライバーの集合知の自動生成
// ============================================================

/**
 * 全ライバーのデータからマスター知識を生成
 * カテゴリ別に知識を生成し、古いバージョンをアーカイブ
 */
export async function generateMasterKnowledge(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  console.log("[AI Brain] Starting master knowledge generation...");

  try {
    // 全ライバーの配信データを集約
    const allLivestreams = await db
      .select({
        id: brandLivestreams.id,
        liverId: brandLivestreams.liverId,
        salesAmount: brandLivestreams.salesAmount,
        gmv: brandLivestreams.gmv,
        duration: brandLivestreams.duration,
        viewerCount: brandLivestreams.viewerCount,
        orderCount: brandLivestreams.orderCount,
        livestreamDate: brandLivestreams.livestreamDate,
        brandName: brands.name,
      })
      .from(brandLivestreams)
      .leftJoin(brands, eq(brandLivestreams.brandId, brands.id))
      .where(isNull(brandLivestreams.deletedAt))
      .orderBy(desc(brandLivestreams.livestreamDate))
      .limit(1000); // 直近1000件

    // 全セットデータを取得
    const allSets = await db
      .select({
        id: livestreamSets.id,
        livestreamId: livestreamSets.livestreamId,
        setName: livestreamSets.setName,
        setPrice: livestreamSets.setPrice,
        quantitySold: livestreamSets.quantitySold,
        totalRevenue: livestreamSets.totalRevenue,
        discountRate: livestreamSets.discountRate,
        totalOriginalPrice: livestreamSets.totalOriginalPrice,
      })
      .from(livestreamSets)
      .orderBy(desc(livestreamSets.id))
      .limit(2000);

    // ライバーメモリ（既存のもの）を取得
    const allMemories = await db
      .select()
      .from(aiCoachLiverMemory);

    // 全ライバー情報
    const allLivers = await db
      .select({ id: livers.id, name: livers.name })
      .from(livers);
    const liverMap = new Map(allLivers.map(l => [l.id, l.name]));

    // データを集約して統計を作成
    const totalStreams = allLivestreams.length;
    const totalSales = allLivestreams.reduce((sum, s) => sum + Number(s.salesAmount || s.gmv || 0), 0);
    const avgSalesPerStream = totalStreams > 0 ? Math.round(totalSales / totalStreams) : 0;
    const totalSets = allSets.length;
    const avgSetPrice = totalSets > 0 ? Math.round(allSets.reduce((sum, s) => sum + Number(s.setPrice || 0), 0) / totalSets) : 0;
    const topSets = [...allSets].sort((a, b) => Number(b.totalRevenue || 0) - Number(a.totalRevenue || 0)).slice(0, 20);
    
    // 価格帯別の成功パターン
    const priceRanges = [
      { label: '〜¥5,000', min: 0, max: 5000 },
      { label: '¥5,001〜¥10,000', min: 5001, max: 10000 },
      { label: '¥10,001〜¥20,000', min: 10001, max: 20000 },
      { label: '¥20,001〜¥50,000', min: 20001, max: 50000 },
      { label: '¥50,001〜', min: 50001, max: Infinity },
    ];
    const priceAnalysis = priceRanges.map(range => {
      const rangeSets = allSets.filter(s => Number(s.setPrice) >= range.min && Number(s.setPrice) <= range.max);
      const totalRev = rangeSets.reduce((sum, s) => sum + Number(s.totalRevenue || 0), 0);
      const totalQty = rangeSets.reduce((sum, s) => sum + Number(s.quantitySold || 0), 0);
      const avgDiscount = rangeSets.filter(s => s.discountRate).length > 0
        ? Math.round(rangeSets.filter(s => s.discountRate).reduce((sum, s) => sum + Number(s.discountRate || 0), 0) / rangeSets.filter(s => s.discountRate).length)
        : 0;
      return { ...range, count: rangeSets.length, totalRev, totalQty, avgDiscount };
    });

    // ライバー別の成功パターン
    const liverStats = new Map<number, { sales: number; streams: number; name: string }>();
    allLivestreams.forEach(s => {
      const existing = liverStats.get(s.liverId) || { sales: 0, streams: 0, name: liverMap.get(s.liverId) || '' };
      existing.sales += Number(s.salesAmount || s.gmv || 0);
      existing.streams += 1;
      liverStats.set(s.liverId, existing);
    });
    const topLivers = Array.from(liverStats.entries())
      .map(([id, stats]) => ({ id, ...stats, hourlyRate: 0 }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);

    // カテゴリ別にマスター知識を生成
    const categories = [
      {
        category: 'pricing_strategy',
        prompt: `以下のデータから「セット価格戦略」に関する知識を生成してください。

【全体統計】
総配信数: ${totalStreams}回 / 総売上: ¥${totalSales.toLocaleString()} / 平均売上/配信: ¥${avgSalesPerStream.toLocaleString()}
総セット数: ${totalSets}種類 / 平均セット価格: ¥${avgSetPrice.toLocaleString()}

【価格帯別分析】
${priceAnalysis.map(p => `${p.label}: ${p.count}種類 / 売上¥${p.totalRev.toLocaleString()} / ${p.totalQty}セット販売 / 平均割引${p.avgDiscount}%`).join('\n')}

【売上TOP10セット】
${topSets.slice(0, 10).map((s, i) => `${i + 1}. ${s.setName}: ¥${Number(s.setPrice).toLocaleString()} × ${s.quantitySold} = ¥${Number(s.totalRevenue || 0).toLocaleString()} (割引${s.discountRate || 0}%)`).join('\n')}

この情報から、新人ライバーに教えるべき「価格設定の鉄則」を5つ以内で簡潔にまとめてください。`,
      },
      {
        category: 'set_composition',
        prompt: `以下のデータから「セット組み（商品構成）」に関する知識を生成してください。

【売上TOP20セット】
${topSets.map((s, i) => `${i + 1}. ${s.setName}: ¥${Number(s.setPrice).toLocaleString()} × ${s.quantitySold} = ¥${Number(s.totalRevenue || 0).toLocaleString()} (元値¥${Number(s.totalOriginalPrice || 0).toLocaleString()}, 割引${s.discountRate || 0}%)`).join('\n')}

この情報から、売れるセット組みの法則を5つ以内で簡潔にまとめてください。`,
      },
      {
        category: 'growth_patterns',
        prompt: `以下のデータから「ライバーの成長パターン」に関する知識を生成してください。

【トップライバー（売上順）】
${topLivers.map((l, i) => `${i + 1}. ${l.name}: 総売上¥${l.sales.toLocaleString()} / ${l.streams}回配信`).join('\n')}

【ライバーメモリから得た成長パターン】
${allMemories.map(m => `- ${liverMap.get(m.liverId) || 'Unknown'} (${m.growthPhase}): ${m.summary?.substring(0, 100)}`).join('\n') || '(まだメモリなし)'}

この情報から、新人→中堅→上級への成長パターンと、各ステージで重要なことを簡潔にまとめてください。`,
      },
      {
        category: 'coaching_tips',
        prompt: `以下のデータから「コーチングのコツ」に関する知識を生成してください。

【ライバーのコミュニケーションスタイル】
${allMemories.map(m => `- ${liverMap.get(m.liverId) || 'Unknown'}: ${m.communicationStyle || '未分析'}`).join('\n') || '(まだデータなし)'}

【成功したアドバイスの例】
${allMemories.filter(m => m.pastAdviceResults).map(m => `- ${liverMap.get(m.liverId) || 'Unknown'}: ${m.pastAdviceResults?.substring(0, 150)}`).join('\n') || '(まだデータなし)'}

この情報から、効果的なコーチングのコツを5つ以内で簡潔にまとめてください。
データが少ない場合は、ライブコマースのコーチングにおける一般的なベストプラクティスも含めてください。`,
      },
    ];

    // 現在のバージョンを取得
    const [latestVersion] = await db
      .select({ version: aiCoachMasterKnowledge.version })
      .from(aiCoachMasterKnowledge)
      .orderBy(desc(aiCoachMasterKnowledge.version))
      .limit(1);
    const newVersion = (latestVersion?.version || 0) + 1;

    // 古いバージョンをアーカイブ
    await db.update(aiCoachMasterKnowledge)
      .set({ isActive: 0 })
      .where(eq(aiCoachMasterKnowledge.isActive, 1));

    // 各カテゴリの知識を生成
    for (const cat of categories) {
      try {
        const response = await invokeLLM({
          messages: [
            { role: 'system', content: 'あなたはライブコマースの専門家AIです。データに基づいて、コーチングに使える実践的な知識を簡潔にまとめてください。箇条書きで、各項目は50文字以内。全体で500文字以内。' },
            { role: 'user', content: cat.prompt },
          ],
        });

        const knowledge = response.choices[0]?.message?.content;
        if (knowledge && typeof knowledge === 'string') {
          await db.insert(aiCoachMasterKnowledge).values({
            category: cat.category,
            content: knowledge as string,
            version: newVersion,
            isActive: 1,
            metadata: {
              totalStreams,
              totalSales,
              totalSets,
              liverCount: liverStats.size,
              generatedAt: new Date().toISOString(),
            },
          });
        }
      } catch (error: any) {
        console.error(`[AI Brain] Error generating knowledge for ${cat.category}:`, error.message);
      }
    }

    // ログ記録
    await db.insert(aiCoachBrainLogs).values({
      action: 'generate_master',
      targetType: 'master_knowledge',
      targetId: newVersion,
      details: `Generated v${newVersion} master knowledge (${categories.length} categories, ${totalStreams} streams, ${totalSets} sets, ${liverStats.size} livers)`,
    });

    console.log(`[AI Brain] Master knowledge v${newVersion} generated successfully`);
  } catch (error: any) {
    console.error("[AI Brain] Error generating master knowledge:", error.message);
  }
}

// ============================================================
// 知識の取得ヘルパー
// ============================================================

/**
 * ライバーの個別メモリを取得
 */
export async function getLiverMemory(liverId: number) {
  const db = await getDb();
  if (!db) return null;

  const [memory] = await db
    .select()
    .from(aiCoachLiverMemory)
    .where(eq(aiCoachLiverMemory.liverId, liverId))
    .limit(1);

  return memory || null;
}

/**
 * アクティブなマスター知識を全カテゴリ取得
 */
export async function getMasterKnowledge() {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(aiCoachMasterKnowledge)
    .where(eq(aiCoachMasterKnowledge.isActive, 1))
    .orderBy(asc(aiCoachMasterKnowledge.category));
}

/**
 * 3層の知識をsystem promptに統合するためのコンテキストを構築
 */
export async function buildBrainContext(liverId: number): Promise<string> {
  const [masterKnowledge, liverMemory] = await Promise.all([
    getMasterKnowledge(),
    getLiverMemory(liverId),
  ]);

  let brainContext = '';

  // Layer 1: マスターブレイン（全体知識）
  if (masterKnowledge.length > 0) {
    brainContext += '\n\n【🧠 マスターブレイン（全ライバーの集合知）】\n';
    masterKnowledge.forEach(k => {
      const categoryLabel: Record<string, string> = {
        pricing_strategy: '💰 価格戦略',
        set_composition: '📦 セット組みの法則',
        growth_patterns: '📈 成長パターン',
        coaching_tips: '🎯 コーチングのコツ',
      };
      brainContext += `\n${categoryLabel[k.category] || k.category}:\n${k.content}\n`;
    });
  }

  // Layer 2: ライバー個別メモリ
  if (liverMemory) {
    brainContext += '\n\n【📋 このライバーのカルテ（個人記憶）】\n';
    brainContext += `サマリー: ${liverMemory.summary}\n`;
    if (liverMemory.strengths) brainContext += `強み: ${liverMemory.strengths}\n`;
    if (liverMemory.weaknesses) brainContext += `弱み: ${liverMemory.weaknesses}\n`;
    if (liverMemory.currentGoals) brainContext += `現在の目標: ${liverMemory.currentGoals}\n`;
    if (liverMemory.pastAdviceResults) brainContext += `過去のアドバイス結果: ${liverMemory.pastAdviceResults}\n`;
    if (liverMemory.communicationStyle) brainContext += `コミュニケーションスタイル: ${liverMemory.communicationStyle}\n`;
    brainContext += `成長フェーズ: ${liverMemory.growthPhase} / コーチング回数: ${liverMemory.coachingCount}回\n`;
  } else {
    brainContext += '\n\n【📋 このライバーのカルテ】\n初回コーチング - まだカルテがありません。今回のセッション後に自動作成されます。\n';
  }

  return brainContext;
}

/**
 * ブレインのステータス情報を取得（管理画面用）
 */
export async function getBrainStatus() {
  const db = await getDb();
  if (!db) return null;

  const [latestKnowledge] = await db
    .select({
      version: aiCoachMasterKnowledge.version,
      generatedAt: aiCoachMasterKnowledge.generatedAt,
    })
    .from(aiCoachMasterKnowledge)
    .where(eq(aiCoachMasterKnowledge.isActive, 1))
    .orderBy(desc(aiCoachMasterKnowledge.generatedAt))
    .limit(1);

  const [memoryCount] = await db
    .select({ count: count(aiCoachLiverMemory.id) })
    .from(aiCoachLiverMemory);

  const [logCount] = await db
    .select({ count: count(aiCoachBrainLogs.id) })
    .from(aiCoachBrainLogs);

  const recentLogs = await db
    .select()
    .from(aiCoachBrainLogs)
    .orderBy(desc(aiCoachBrainLogs.createdAt))
    .limit(20);

  const allMemories = await db
    .select({
      id: aiCoachLiverMemory.id,
      liverId: aiCoachLiverMemory.liverId,
      summary: aiCoachLiverMemory.summary,
      growthPhase: aiCoachLiverMemory.growthPhase,
      coachingCount: aiCoachLiverMemory.coachingCount,
      lastCoachingAt: aiCoachLiverMemory.lastCoachingAt,
      updatedAt: aiCoachLiverMemory.updatedAt,
    })
    .from(aiCoachLiverMemory)
    .orderBy(desc(aiCoachLiverMemory.updatedAt));

  const masterKnowledge = await getMasterKnowledge();

  return {
    masterBrain: {
      version: latestKnowledge?.version || 0,
      lastGeneratedAt: latestKnowledge?.generatedAt || null,
      categories: masterKnowledge,
    },
    liverMemories: {
      count: memoryCount?.count || 0,
      memories: allMemories,
    },
    logs: {
      totalCount: logCount?.count || 0,
      recent: recentLogs,
    },
  };
}
