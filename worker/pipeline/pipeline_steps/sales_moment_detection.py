"""
Sales Moment Detection (V9)
=============================
Detects high-quality "product moments" — the exact moments in a
live commerce video where products are best demonstrated and explained.

V9 Changes:
    - Urgency/discount language is now PENALIZED (not rewarded)
    - Product demo and explanation scenes are PRIORITIZED
    - Scene classification scores are integrated into scoring
    - LLM prompt updated to focus on product quality, not hard sell
    - Window size increased to 20s for better context capture

Input (from context):
    - ctx.segments: Transcript segments
    - ctx.events: Detected events
    - ctx.scenes: Scene boundaries
    - ctx.scene_classifications: V9 scene type classifications

Output (to context):
    - ctx.sales_moments: Ranked list of product moment candidates
      [{"start": 42, "end": 50, "score": 0.91, "reason": "...",
        "scene_type": "product_demo", "events": [...], "quality_score": 0.85}, ...]

Scoring (V9):
    - Base score from event density (0.0 - 0.4)
    - Scene type priority bonus (up to +0.4)
    - Combo bonus for product_show + engagement (up to +0.2)
    - Discount/urgency PENALTY (up to -0.3)
    - Product quality bonus (up to +0.15)
    - LLM adjustment (up to +0.2)
    - Final score capped at 1.0
"""
import os
import sys
import re
import json
import logging
from pathlib import Path
from collections import defaultdict

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from worker.pipeline.pipeline_context import PipelineContext

logger = logging.getLogger("worker.pipeline.sales_moment_detection")

# ─── V9 Detection parameters ───
WINDOW_SIZE = 20.0         # Sliding window size (increased from 15s for better context)
WINDOW_STEP = 5.0          # Step size for sliding window
MIN_SCORE = 0.35           # Minimum score to qualify (slightly higher threshold)
MAX_MOMENTS = 10           # Maximum number of moments to return
MERGE_THRESHOLD = 15.0     # Merge moments within this distance (seconds)

# ─── V9 Event type weights (PRODUCT-FIRST) ───
EVENT_WEIGHTS = {
    "product_show": 0.40,       # ★ Highest weight — product demonstration
    "price_mention": 0.15,      # ↓ Reduced — price alone is not valuable
    "call_to_action": 0.10,     # ↓↓ Heavily reduced — CTA often = hard sell
    "comment_reaction": 0.15,   # ↑ Slightly increased — engagement signal
}

# ─── V9 Combo bonuses (product-focused combos) ───
COMBO_BONUSES = {
    frozenset({"product_show", "comment_reaction"}): 0.10,    # Demo + engagement
    frozenset({"product_show", "price_mention"}): 0.05,       # Demo + price (neutral)
    frozenset({"price_mention", "call_to_action"}): -0.05,    # ★ PENALTY: price + CTA = hard sell
    frozenset({"product_show", "price_mention", "call_to_action"}): 0.0,  # Neutral (was +0.25)
}

# ─── V9 Scene type priority multipliers ───
SCENE_PRIORITY_MULTIPLIER = {
    "product_demo": 1.0,        # Full boost
    "testimonial": 0.9,         # Strong boost
    "product_explain": 0.8,     # Good boost
    "social_proof": 0.5,        # Moderate
    "comparison": 0.4,          # Low-moderate
    "discount_push": -0.3,      # ★ PENALTY
    "small_talk": -0.2,         # ★ PENALTY
}

# ─── V9 Discount/urgency PENALTY patterns ───
DISCOUNT_PENALTY_PATTERNS = [
    r"今だけ", r"限定", r"お早めに", r"残り.*(?:わずか|\d+個|\d+点)",
    r"ラスト", r"急い", r"なくなり", r"売り切れ",
    r"タイムセール", r"フラッシュ", r"半額",
    r"(?:\d+%|割).*(?:OFF|オフ|引き)",
    r"今.*(?:買わないと|しないと)", r"見逃.*(?:なく|ない)",
]

# ─── V9 Product quality BONUS patterns ───
PRODUCT_QUALITY_PATTERNS = [
    r"(?:テクスチャー|質感|手触り|肌触り)",
    r"(?:使い方|やり方|方法|手順)",
    r"(?:成分|配合|処方)",
    r"(?:効果|変化|実感|改善)",
    r"(?:ビフォー|アフター|before|after)",
    r"(?:実際に|リアルに|本当に).*(?:使|試|やっ)",
    r"(?:見て|ご覧).*(?:この|こう|こんな)",
    r"(?:おすすめ|推し).*(?:ポイント|理由|点)",
]


def _score_window_v9(
    window_start: float,
    window_end: float,
    events: list[dict],
    segments: list[dict],
    scene_classifications: list[dict],
) -> tuple[float, str, list[dict], str]:
    """V9: Score a time window for product moment potential.

    Returns (score, reason, matching_events, dominant_scene_type).
    """
    # Find events in this window
    window_events = [
        e for e in events
        if e["start"] >= window_start - 2.0 and e["end"] <= window_end + 2.0
    ]

    # Find scene classifications in this window
    window_scenes = [
        sc for sc in scene_classifications
        if sc.get("start", 0) >= window_start - 2.0
        and sc.get("end", 0) <= window_end + 2.0
    ]

    if not window_events and not window_scenes:
        return 0.0, "", [], "unknown"

    # ── 1. Base score from event density ──
    event_types = set()
    type_counts = defaultdict(int)
    for e in window_events:
        etype = e.get("event_type", "")
        event_types.add(etype)
        type_counts[etype] += 1

    base_score = 0.0
    for etype, count in type_counts.items():
        weight = EVENT_WEIGHTS.get(etype, 0.05)
        base_score += weight * min(count, 3)
    base_score = min(base_score, 0.4)

    # ── 2. Scene type priority bonus/penalty ──
    scene_bonus = 0.0
    dominant_scene = "unknown"
    if window_scenes:
        # Find dominant scene type (highest priority)
        best_scene = max(window_scenes, key=lambda x: x.get("priority", 0))
        dominant_scene = best_scene.get("scene_type", "unknown")
        scene_multiplier = SCENE_PRIORITY_MULTIPLIER.get(dominant_scene, 0.0)
        scene_bonus = scene_multiplier * 0.4  # Max ±0.4 from scene type

    # ── 3. Combo bonus/penalty ──
    combo_bonus = 0.0
    for combo, bonus in COMBO_BONUSES.items():
        if combo.issubset(event_types):
            combo_bonus += bonus
    combo_bonus = max(min(combo_bonus, 0.2), -0.1)

    # ── 4. Transcript analysis: product quality vs discount penalty ──
    window_text = ""
    for seg in segments:
        if seg.get("start", 0) >= window_start and seg.get("end", 0) <= window_end:
            window_text += " " + seg.get("text", "")

    product_bonus = 0.0
    discount_penalty = 0.0

    if window_text:
        # Product quality bonus
        quality_count = sum(
            1 for p in PRODUCT_QUALITY_PATTERNS
            if re.search(p, window_text, re.IGNORECASE)
        )
        product_bonus = min(quality_count * 0.05, 0.15)

        # Discount/urgency PENALTY (V9 core change!)
        discount_count = sum(
            1 for p in DISCOUNT_PENALTY_PATTERNS
            if re.search(p, window_text, re.IGNORECASE)
        )
        discount_penalty = min(discount_count * 0.08, 0.30)

    # ── Final score ──
    total_score = base_score + scene_bonus + combo_bonus + product_bonus - discount_penalty
    total_score = max(min(total_score, 1.0), 0.0)

    # Build reason
    reasons = []
    for etype in sorted(event_types):
        reasons.append(f"{etype}({type_counts[etype]})")
    if scene_bonus != 0:
        reasons.append(f"scene:{dominant_scene}({scene_bonus:+.2f})")
    if combo_bonus != 0:
        reasons.append(f"combo({combo_bonus:+.2f})")
    if product_bonus > 0:
        reasons.append(f"quality+{product_bonus:.2f}")
    if discount_penalty > 0:
        reasons.append(f"discount_penalty-{discount_penalty:.2f}")

    reason = ", ".join(reasons)

    return round(total_score, 3), reason, window_events, dominant_scene


def _detect_moments_sliding_window_v9(
    events: list[dict],
    segments: list[dict],
    scene_classifications: list[dict],
    video_duration: float,
) -> list[dict]:
    """V9: Detect product moments using scene-aware sliding window."""
    if not events and not scene_classifications:
        return []

    # Determine scan range
    max_time = video_duration if video_duration > 0 else max(
        (e.get("end", 0) for e in events), default=300.0
    )

    candidates = []
    t = 0.0
    while t < max_time:
        window_end = t + WINDOW_SIZE
        score, reason, window_events, scene_type = _score_window_v9(
            t, window_end, events, segments, scene_classifications
        )

        if score >= MIN_SCORE:
            candidates.append({
                "start": round(t, 3),
                "end": round(window_end, 3),
                "score": score,
                "reason": reason,
                "scene_type": scene_type,
                "events": [
                    {"event_type": e["event_type"], "start": e["start"]}
                    for e in window_events
                ],
            })

        t += WINDOW_STEP

    # Sort by score descending
    candidates.sort(key=lambda x: x["score"], reverse=True)

    # Merge overlapping candidates
    merged = []
    for cand in candidates:
        overlaps = False
        for selected in merged:
            if abs(cand["start"] - selected["start"]) < MERGE_THRESHOLD:
                if cand["score"] > selected["score"]:
                    selected.update(cand)
                overlaps = True
                break

        if not overlaps:
            merged.append(cand)

        if len(merged) >= MAX_MOMENTS:
            break

    # Re-sort by start time
    merged.sort(key=lambda x: x["start"])

    return merged


def _refine_with_llm_v9(
    candidates: list[dict],
    segments: list[dict],
) -> list[dict]:
    """V9: Refine scores using LLM with product-quality-focused prompt.

    Key change from V8: LLM is now instructed to PENALIZE hard sell
    and REWARD product demonstrations and explanations.
    """
    if not candidates:
        return candidates

    try:
        from openai import OpenAI
    except ImportError:
        return candidates

    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        return candidates

    # Build context for LLM
    moments_text = ""
    for i, cand in enumerate(candidates[:5]):
        nearby_text = " ".join(
            seg.get("text", "")
            for seg in segments
            if seg.get("start", 0) >= cand["start"] - 5
            and seg.get("end", 0) <= cand["end"] + 5
        )
        moments_text += f"\nMoment {i+1} [{cand['start']:.1f}s - {cand['end']:.1f}s] "
        moments_text += f"(score={cand['score']}, scene={cand.get('scene_type', 'unknown')}):\n"
        moments_text += f"  Events: {cand['reason']}\n"
        moments_text += f"  Transcript: {nearby_text[:250]}\n"

    prompt = f"""あなたはライブコマース動画の品質評価エキスパートです。
以下の候補から「商品の魅力が最も伝わるシーン」を評価してください。

★ 重要な評価基準（V9）:
【高スコア】
- 商品を実際に使用・実演している（テクスチャー、使い心地の実演）
- 商品の効果や変化を見せている（ビフォーアフター）
- 成分や技術を分かりやすく説明している
- 個人的な体験談・使用感を語っている
- 視聴者の質問に商品について丁寧に答えている

【低スコア（ペナルティ）】
- 「今だけ」「残りわずか」「急いで」等の緊急性煽り
- 値引き・クーポン・セール情報が主体のトーク
- 「買わないと損」「見逃さないで」等の圧迫販売
- 挨拶・雑談・フィラーが多い

候補:
{moments_text}

JSON配列で回答してください:
[{{"index": 0, "adjusted_score": 0.85, "reason": "商品デモが充実"}}]

注意: 安売り煽りが含まれる候補は必ずスコアを下げてください。"""

    try:
        client = OpenAI()
        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {"role": "system", "content": "You are a live commerce quality evaluator. Focus on product demonstration quality, NOT sales pressure. Respond only with valid JSON."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            max_tokens=2000,
        )

        content = response.choices[0].message.content.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        adjustments = json.loads(content)

        if isinstance(adjustments, list):
            for adj in adjustments:
                idx = adj.get("index", -1)
                if 0 <= idx < len(candidates):
                    new_score = float(adj.get("adjusted_score", candidates[idx]["score"]))
                    candidates[idx]["score"] = round(min(max(new_score, 0.0), 1.0), 3)
                    if adj.get("reason"):
                        candidates[idx]["reason"] += f" | LLM: {adj['reason']}"

    except Exception as e:
        logger.warning("[sales_moment_detection] LLM refinement failed: %s", e)

    return candidates


def run_sales_moment_detection(ctx: PipelineContext) -> PipelineContext:
    """Pipeline step: Detect product moments in the video (V9).

    V9 combines scene classification with event clustering and LLM scoring
    to identify the best product demonstration moments.
    Discount/urgency scenes are penalized, not rewarded.

    Saves results to both ctx.sales_moments and the database.
    """
    if not ctx.events and not ctx.segments:
        logger.info("[sales_moment_detection] No events/segments for video %s", ctx.video_id)
        ctx.sales_moments = []
        return ctx

    # Get scene classifications (V9 feature)
    scene_classifications = getattr(ctx, "scene_classifications", [])
    if not scene_classifications:
        scene_classifications = ctx.extra.get("scene_classifications", [])

    logger.info(
        "[sales_moment_detection] V9 mode: %d events, %d segments, %d scene_classifications",
        len(ctx.events), len(ctx.segments), len(scene_classifications),
    )

    # Detect candidates using V9 scene-aware sliding window
    candidates = _detect_moments_sliding_window_v9(
        ctx.events, ctx.segments, scene_classifications, ctx.video_duration,
    )
    logger.info("[sales_moment_detection] V9 found %d candidates", len(candidates))

    # Refine with LLM (V9 product-quality-focused prompt)
    if candidates:
        candidates = _refine_with_llm_v9(candidates, ctx.segments)
        # Re-sort by score after LLM adjustment
        candidates.sort(key=lambda x: x["score"], reverse=True)

    # Filter out discount_push scenes that still scored above threshold
    # (extra safety: even if they somehow scored high, deprioritize them)
    final_candidates = []
    discount_demoted = []
    for cand in candidates:
        if cand.get("scene_type") == "discount_push":
            cand["score"] = min(cand["score"], 0.3)  # Cap at 0.3
            discount_demoted.append(cand)
        else:
            final_candidates.append(cand)

    # Add demoted discount scenes at the end (they might still be useful as last resort)
    final_candidates.extend(discount_demoted)

    ctx.sales_moments = final_candidates

    for i, sm in enumerate(final_candidates[:5]):
        logger.info(
            "[sales_moment_detection] V9 #%d: %.1fs-%.1fs score=%.3f scene=%s reason=%s",
            i + 1, sm["start"], sm["end"], sm["score"],
            sm.get("scene_type", "?"), sm["reason"],
        )

    # Save to DB
    try:
        from worker.pipeline.pipeline_db import save_sales_moments
        save_sales_moments(ctx.video_id, final_candidates)
    except Exception as e:
        logger.warning("[sales_moment_detection] DB save failed (non-critical): %s", e)

    return ctx
