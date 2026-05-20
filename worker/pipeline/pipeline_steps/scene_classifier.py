"""
Scene Classifier (V9)
======================
Classifies transcript segments into scene types for intelligent clip selection.

This is the core of V9's "product-demo-first" strategy. Instead of prioritizing
urgency/discount language (which produces low-quality "hard sell" clips), we
classify each segment by its content type and assign priority weights.

Input (from context):
    - ctx.segments: Semantically segmented transcript blocks
    - ctx.events: Detected events (for cross-referencing)

Output (to context):
    - ctx.scene_classifications: Per-segment scene type + confidence
      [{"segment_index": int, "start": float, "end": float,
        "scene_type": str, "confidence": float, "priority": float}, ...]

Scene Types (ordered by priority for clip selection):
    1. PRODUCT_DEMO       (1.0) — Showing/demonstrating product features
    2. TESTIMONIAL        (0.9) — Personal experience, before/after, results
    3. PRODUCT_EXPLAIN    (0.8) — Explaining ingredients, technology, benefits
    4. SOCIAL_PROOF       (0.6) — Reviews, rankings, awards, user counts
    5. COMPARISON         (0.5) — Comparing with other products
    6. DISCOUNT_PUSH      (0.1) — "Limited time!", "Only X left!", hard sell
    7. SMALL_TALK         (0.0) — Greetings, off-topic chat, filler

Strategy:
    1. Rule-based keyword classification (fast, always available)
    2. LLM-based classification (when OpenAI key available, more accurate)
    3. Cross-reference with event_detection results for validation
"""
import os
import sys
import re
import json
import logging
from pathlib import Path
from typing import Optional

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from worker.pipeline.pipeline_context import PipelineContext

logger = logging.getLogger("worker.pipeline.scene_classifier")


# =============================================================================
# Scene Type Definitions
# =============================================================================

class SceneType:
    """Scene type constants with priority weights."""
    PRODUCT_DEMO = "product_demo"
    TESTIMONIAL = "testimonial"
    PRODUCT_EXPLAIN = "product_explain"
    SOCIAL_PROOF = "social_proof"
    COMPARISON = "comparison"
    DISCOUNT_PUSH = "discount_push"
    SMALL_TALK = "small_talk"


# Priority weights: higher = more desirable for clip selection
SCENE_PRIORITY = {
    SceneType.PRODUCT_DEMO: 1.0,
    SceneType.TESTIMONIAL: 0.9,
    SceneType.PRODUCT_EXPLAIN: 0.8,
    SceneType.SOCIAL_PROOF: 0.6,
    SceneType.COMPARISON: 0.5,
    SceneType.DISCOUNT_PUSH: 0.1,
    SceneType.SMALL_TALK: 0.0,
}


# =============================================================================
# Rule-based Classification Patterns
# =============================================================================

# Each pattern list is checked against segment text.
# Patterns are ordered by specificity — more specific patterns first.

SCENE_PATTERNS: dict[str, list[str]] = {
    SceneType.PRODUCT_DEMO: [
        # Demonstrating product usage
        r"実際に.*(?:使って|つけて|塗って|やって)み",
        r"(?:見て|ご覧)ください.*(?:この|こう|こんな)",
        r"(?:手に|肌に|髪に).*(?:つけ|塗|のせ)",
        r"テクスチャー",
        r"(?:伸び|のび)が(?:いい|良い|すごい)",
        r"(?:香り|匂い|におい).*(?:いい|良い|すごい)",
        r"(?:触り|さわり)心地",
        r"(?:仕上がり|仕上げ)",
        r"ビフォー.*アフター",
        r"before.*after",
        r"(?:こう|こんな感じ)に(?:なり|でき)",
        r"(?:塗る|つける|使う)と.*(?:こう|こんな)",
        r"実演",
        r"デモ",
        r"やり方",
        r"(?:手順|ステップ|方法)",
        r"(?:まず|次に|最後に).*(?:して|します|する)",
    ],
    SceneType.TESTIMONIAL: [
        # Personal experience and results
        r"(?:私|僕|自分).*(?:使って|使い始め)",
        r"(?:\d+(?:日|週間|ヶ月|か月)).*(?:使って|続けて|経って)",
        r"(?:効果|変化|結果).*(?:出|感じ|実感)",
        r"(?:悩み|悩んで).*(?:解決|改善|なくなっ)",
        r"(?:リピート|リピ|何本|何個).*(?:目|買い)",
        r"(?:お気に入り|愛用|ヘビロテ)",
        r"(?:肌|髪|体).*(?:変わっ|良くなっ|改善)",
        r"体験談",
        r"(?:使用感|使い心地)",
        r"(?:感想|レビュー|口コミ)",
        r"(?:おすすめ|オススメ).*(?:理由|ポイント)",
    ],
    SceneType.PRODUCT_EXPLAIN: [
        # Explaining features, ingredients, technology
        r"(?:成分|配合|含ま)",
        r"(?:特徴|特長|ポイント).*(?:は|が)",
        r"(?:技術|テクノロジー|処方)",
        r"(?:効果|効能|作用)",
        r"(?:なぜ|どうして).*(?:いい|良い|効く)",
        r"(?:メリット|利点|強み)",
        r"(?:他と|普通と).*(?:違う|異なる)",
        r"(?:開発|研究|こだわ)",
        r"(?:品質|クオリティ)",
        r"(?:日本製|国産|オーガニック|天然)",
        r"(?:無添加|低刺激|敏感肌)",
        r"(?:容量|内容量|サイズ)",
        r"(?:使い方|用法|用量)",
        r"(?:保湿|補修|ケア).*(?:成分|力|効果)",
    ],
    SceneType.SOCIAL_PROOF: [
        # Reviews, rankings, awards
        r"(?:ランキング|ベストコスメ|受賞)",
        r"(?:口コミ|レビュー).*(?:\d+|高評価|星)",
        r"(?:売上|販売).*(?:No\.?1|ナンバーワン|1位)",
        r"(?:万個|万本|万人).*(?:突破|達成|売れ)",
        r"(?:芸能人|モデル|インフルエンサー).*(?:愛用|使用)",
        r"(?:雑誌|メディア).*(?:掲載|紹介)",
        r"(?:SNS|インスタ|TikTok).*(?:話題|バズ|人気)",
        r"(?:リピート率|満足度).*(?:\d+%|高い)",
        r"(?:プロ|専門家|美容師).*(?:推薦|おすすめ|認め)",
    ],
    SceneType.COMPARISON: [
        # Comparing with other products
        r"(?:比較|比べ|違い)",
        r"(?:他の|市販の|ドラッグストア)",
        r"(?:こっちの方|こちらの方).*(?:いい|良い)",
        r"(?:vs|VS|対)",
        r"(?:どっち|どちら).*(?:いい|おすすめ)",
        r"(?:コスパ|コストパフォーマンス)",
    ],
    SceneType.DISCOUNT_PUSH: [
        # Hard sell, urgency, limited time offers
        r"今だけ",
        r"限定(?:\d+|価格|セール)",
        r"(?:残り|あと)(?:\d+|わずか|少し)",
        r"(?:急い|お急ぎ|早く)",
        r"(?:なくなり|売り切れ|完売).*(?:次第|前に)",
        r"(?:タイムセール|フラッシュセール)",
        r"(?:半額|%OFF|%オフ|\d+割引)",
        r"(?:クーポン|割引コード).*(?:使って|入力)",
        r"(?:今|本日).*(?:限り|だけ|まで)",
        r"(?:特別|スペシャル).*(?:価格|オファー|セール)",
        r"(?:数量|期間|時間).*限定",
        r"(?:お見逃し|見逃さ).*(?:なく|ない)",
        r"(?:ラスト|最後).*(?:チャンス|1個|一つ)",
        r"(?:買わないと|買った方が).*(?:損|後悔)",
    ],
    SceneType.SMALL_TALK: [
        # Greetings, off-topic, filler
        r"(?:こんにちは|こんばんは|おはよう)",
        r"(?:始まりました|始めます|スタート)",
        r"(?:今日は|本日は).*(?:来て|見て).*(?:くれて|いただ)",
        r"(?:ありがとう|感謝)",
        r"(?:天気|暑い|寒い|季節)",
        r"(?:最近|この前|昨日).*(?:あった|行った|食べた)",
        r"(?:雑談|余談|話変わ)",
        r"(?:えーと|あのー|まあ|ちょっと待って)",
        r"(?:聞こえ|見え).*(?:ます|てる).*(?:か|？)",
        r"(?:コメント|チャット).*(?:読み|見)",
    ],
}


# =============================================================================
# Classification Logic
# =============================================================================

def _classify_segment_rule_based(text: str) -> tuple[str, float]:
    """Classify a single segment using keyword pattern matching.

    Returns (scene_type, confidence).
    Confidence is based on number of pattern matches.
    """
    if not text:
        return SceneType.SMALL_TALK, 0.5

    text_lower = text.lower()
    scores: dict[str, int] = {}

    for scene_type, patterns in SCENE_PATTERNS.items():
        match_count = 0
        for pattern in patterns:
            if re.search(pattern, text_lower, re.IGNORECASE):
                match_count += 1
        if match_count > 0:
            scores[scene_type] = match_count

    if not scores:
        # No patterns matched — default to small_talk with low confidence
        return SceneType.SMALL_TALK, 0.3

    # Pick the scene type with the most matches
    best_type = max(scores, key=scores.get)
    best_count = scores[best_type]

    # Confidence: 1 match = 0.5, 2 = 0.7, 3+ = 0.9
    confidence = min(0.3 + best_count * 0.2, 0.95)

    return best_type, round(confidence, 3)


def _classify_segments_llm(segments: list[dict]) -> Optional[list[dict]]:
    """Classify segments using LLM for higher accuracy.

    Returns list of {"segment_index": int, "scene_type": str, "confidence": float}
    or None if LLM is unavailable.
    """
    try:
        from openai import OpenAI
    except ImportError:
        return None

    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        return None

    # Build transcript for LLM (limit to 40 segments to stay within token limits)
    segments_to_classify = segments[:40]
    transcript_text = "\n".join(
        f"[Seg {seg.get('segment_index', i)}] [{seg.get('start', 0):.1f}s-{seg.get('end', 0):.1f}s] "
        f"{seg.get('text', '')[:150]}"
        for i, seg in enumerate(segments_to_classify)
    )

    if not transcript_text.strip():
        return None

    prompt = f"""あなたはライブコマース動画の分析エキスパートです。
以下のトランスクリプトセグメントを、それぞれ最も適切なシーンタイプに分類してください。

シーンタイプ:
- product_demo: 商品を実際に使用・実演している（テクスチャー、使い方の実演、ビフォーアフター）
- testimonial: 個人的な使用体験・感想・効果の報告
- product_explain: 成分・技術・特徴の説明（使い方の説明含む）
- social_proof: ランキング・受賞・口コミ数・有名人愛用などの社会的証明
- comparison: 他製品との比較
- discount_push: 値引き・限定・緊急性を煽る安売りトーク
- small_talk: 挨拶・雑談・フィラー・オフトピック

重要: 商品の魅力を伝えるシーン（demo/testimonial/explain）を最も正確に識別してください。
「安い」「お得」だけでなく「今だけ」「残りわずか」「急いで」等の緊急性煽りはdiscount_pushです。

セグメント:
{transcript_text}

JSON配列で回答してください:
[{{"segment_index": 0, "scene_type": "product_demo", "confidence": 0.9}}]"""

    try:
        client = OpenAI()
        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {"role": "system", "content": "You are a live commerce video analysis expert. Respond only with valid JSON array."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            max_tokens=4000,
        )

        content = response.choices[0].message.content.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        results = json.loads(content)

        if isinstance(results, list):
            valid_types = set(SCENE_PRIORITY.keys())
            cleaned = []
            for item in results:
                if isinstance(item, dict) and item.get("scene_type") in valid_types:
                    cleaned.append({
                        "segment_index": int(item.get("segment_index", 0)),
                        "scene_type": item["scene_type"],
                        "confidence": round(float(item.get("confidence", 0.7)), 3),
                    })
            return cleaned

    except Exception as e:
        logger.warning("[scene_classifier] LLM classification failed: %s", e)

    return None


def _cross_reference_events(
    classifications: list[dict],
    segments: list[dict],
    events: list[dict],
) -> list[dict]:
    """Cross-reference classifications with event detection results.

    If event_detection found a product_show event in the same time range,
    boost confidence for product_demo/product_explain classifications.
    """
    if not events:
        return classifications

    for cls in classifications:
        seg_idx = cls.get("segment_index", -1)
        if seg_idx < 0 or seg_idx >= len(segments):
            continue

        seg = segments[seg_idx]
        seg_start = seg.get("start", 0)
        seg_end = seg.get("end", 0)

        # Find events overlapping with this segment
        overlapping_events = [
            e for e in events
            if e.get("start", 0) <= seg_end + 2.0
            and e.get("end", 0) >= seg_start - 2.0
        ]

        event_types = {e.get("event_type", "") for e in overlapping_events}

        # Boost product-related classifications if product_show event exists
        if "product_show" in event_types:
            if cls["scene_type"] in (SceneType.PRODUCT_DEMO, SceneType.PRODUCT_EXPLAIN):
                cls["confidence"] = min(cls["confidence"] + 0.1, 1.0)
            elif cls["scene_type"] == SceneType.SMALL_TALK:
                # Override: if product_show event detected, it's probably not small talk
                cls["scene_type"] = SceneType.PRODUCT_EXPLAIN
                cls["confidence"] = 0.6

        # Penalize discount_push if no price_mention or call_to_action event
        if cls["scene_type"] == SceneType.DISCOUNT_PUSH:
            if "price_mention" not in event_types and "call_to_action" not in event_types:
                cls["confidence"] = max(cls["confidence"] - 0.2, 0.3)

    return classifications


# =============================================================================
# Main Pipeline Step
# =============================================================================

def run_scene_classification(ctx: PipelineContext) -> PipelineContext:
    """Pipeline step: Classify segments into scene types.

    Uses hybrid approach:
        1. Rule-based classification (always runs)
        2. LLM classification (if available, takes priority)
        3. Cross-reference with event detection

    Results are stored in ctx.scene_classifications and ctx.extra["scene_stats"].
    """
    if not ctx.segments:
        logger.info("[scene_classifier] No segments to classify for video %s", ctx.video_id)
        ctx.scene_classifications = []
        return ctx

    # Step 1: Rule-based classification
    rule_classifications = []
    for i, seg in enumerate(ctx.segments):
        scene_type, confidence = _classify_segment_rule_based(seg.get("text", ""))
        rule_classifications.append({
            "segment_index": i,
            "start": seg.get("start", 0),
            "end": seg.get("end", 0),
            "scene_type": scene_type,
            "confidence": confidence,
            "priority": SCENE_PRIORITY.get(scene_type, 0.0),
        })

    logger.info("[scene_classifier] Rule-based: classified %d segments", len(rule_classifications))

    # Step 2: LLM classification (overrides rule-based where available)
    llm_results = _classify_segments_llm(ctx.segments)
    if llm_results:
        logger.info("[scene_classifier] LLM: classified %d segments", len(llm_results))
        # Merge: LLM results override rule-based
        llm_map = {item["segment_index"]: item for item in llm_results}
        for cls in rule_classifications:
            idx = cls["segment_index"]
            if idx in llm_map:
                llm_item = llm_map[idx]
                cls["scene_type"] = llm_item["scene_type"]
                cls["confidence"] = llm_item["confidence"]
                cls["priority"] = SCENE_PRIORITY.get(llm_item["scene_type"], 0.0)
    else:
        logger.info("[scene_classifier] LLM unavailable, using rule-based only")

    # Step 3: Cross-reference with event detection
    classifications = _cross_reference_events(
        rule_classifications, ctx.segments, ctx.events
    )

    # Store results
    ctx.scene_classifications = classifications

    # Compute scene statistics
    type_counts = {}
    for cls in classifications:
        st = cls["scene_type"]
        type_counts[st] = type_counts.get(st, 0) + 1

    ctx.extra["scene_stats"] = type_counts
    ctx.extra["v9_scene_classifier"] = True

    # Log summary
    logger.info(
        "[scene_classifier] Classification complete for video %s: %s",
        ctx.video_id,
        ", ".join(f"{k}={v}" for k, v in sorted(type_counts.items(), key=lambda x: -x[1])),
    )

    # Save to DB
    try:
        from worker.pipeline.pipeline_db import save_scene_classifications
        save_scene_classifications(ctx.video_id, classifications)
    except Exception as e:
        logger.warning("[scene_classifier] DB save failed (non-critical): %s", e)

    return ctx
