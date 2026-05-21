"""
Product Segment Detector (V9)
===============================
Detects product introduction segments from transcript data.
This is the core V9 feature: "1 product introduction = 1 clip".

Strategy:
    1. Scan transcript segments for product name mentions (first appearance)
    2. Detect price mentions, CTA phrases, and product explanation keywords
    3. Identify segment boundaries: start = 3s before first product name mention
    4. Identify segment end: when next product starts, or CTA completes
    5. Validate segment length (target: 45-90s)
    6. Short segments get context padding, long segments get trimmed to best part

Input (from context):
    - ctx.segments: Semantically segmented transcript blocks
    - ctx.events: Detected events (product_show, price_mention, etc.)
    - ctx.scene_classifications: Scene type per segment (V9)
    - ctx.transcript: Raw transcript for fine-grained timing

Output (to context):
    - ctx.extra["product_segments"]: List of detected product segments
      [{"product_name": str, "start": float, "end": float,
        "confidence": float, "keywords_found": list,
        "scene_types": list, "segment_indices": list}, ...]

Product Name Detection:
    - Explicit product names (katakana sequences, brand patterns)
    - "この商品" / "こちらの商品" as implicit product references
    - Price + product pattern ("〇〇円の〇〇")
    - Context clues from scene_classifications (product_demo/explain)

Segment Boundary Rules:
    - Start: 3 seconds before the first mention of the product name
    - End: One of:
        a) Next product's first mention (minus 2s buffer)
        b) CTA completion (last CTA keyword + 5s)
        c) Scene type change from product_* to small_talk/discount_push
        d) Maximum 90 seconds from start
    - Minimum: 30 seconds (pad with surrounding context if shorter)
"""
import os
import sys
import re
import logging
from pathlib import Path
from typing import Optional

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from worker.pipeline.pipeline_context import PipelineContext

logger = logging.getLogger("worker.pipeline.product_segment_detector")

# ─── Detection Parameters ───
MIN_SEGMENT_DURATION = 30.0    # Minimum product segment duration (seconds)
TARGET_SEGMENT_DURATION = 60.0  # Ideal segment duration
MAX_SEGMENT_DURATION = 90.0    # Maximum segment duration
PRODUCT_START_PADDING = 3.0    # Seconds before first product mention
PRODUCT_END_PADDING = 5.0      # Seconds after last CTA/closing
NEXT_PRODUCT_BUFFER = 2.0      # Buffer before next product starts
MIN_CONFIDENCE = 0.3           # Minimum confidence to keep a segment

# ─── Product Name Detection Patterns ───
# Katakana product names (3+ chars)
KATAKANA_PRODUCT_RE = re.compile(r'[ァ-ヶー]{3,}')

# Explicit product introduction phrases
PRODUCT_INTRO_PATTERNS = [
    r"(?:この|こちらの|次の|今日の)(?:商品|アイテム|製品)",
    r"(?:紹介|ご紹介)(?:する|します|していき)",
    r"(?:こちら|これ)(?:が|は|を).*(?:商品|アイテム|製品)",
    r"(?:新商品|新製品|新作)",
    r"(?:人気|おすすめ|イチオシ).*(?:商品|アイテム)",
    r"(?:次|続いて|お次).*(?:紹介|見て|ご覧)",
]

# Price patterns (signals product boundary)
PRICE_PATTERNS = [
    r"\d[\d,]*円",
    r"¥\d[\d,]*",
    r"\$\d[\d,.]*",
    r"(?:税込|税抜|送料込).*\d+",
    r"(?:通常|定価|セット).*(?:価格|プライス)",
    r"\d+(?:,\d+)?(?:円|yen)",
]

# CTA patterns (signals segment end)
CTA_PATTERNS = [
    r"(?:リンク|URL).*(?:貼|載|概要欄)",
    r"(?:カート|購入|注文).*(?:ボタン|リンク|こちら)",
    r"(?:今すぐ|ぜひ).*(?:チェック|見て|試して)",
    r"(?:概要欄|プロフィール|コメント欄).*(?:から|に)",
    r"(?:クーポン|割引).*(?:コード|使って)",
    r"(?:ポチ|買って|購入して)",
]

# Product explanation keywords (boosts confidence)
PRODUCT_EXPLAIN_KEYWORDS = [
    r"(?:成分|配合|処方|技術)",
    r"(?:特徴|特長|ポイント|メリット)",
    r"(?:使い方|やり方|方法|手順)",
    r"(?:効果|効能|作用|実感)",
    r"(?:テクスチャー|質感|香り|使用感)",
    r"(?:容量|サイズ|内容量)",
    r"(?:おすすめ|推し).*(?:理由|ポイント)",
]

# Scene type transition signals (product segment end)
PRODUCT_SCENE_TYPES = {"product_demo", "product_explain", "testimonial", "comparison", "social_proof"}
NON_PRODUCT_SCENE_TYPES = {"small_talk", "discount_push"}


def _extract_product_names(text: str) -> list[str]:
    """Extract potential product names from text.

    Returns list of candidate product names found in the text.
    Uses katakana sequences and brand-like patterns.
    """
    names = []

    # Katakana sequences (likely product/brand names)
    katakana_matches = KATAKANA_PRODUCT_RE.findall(text)
    for match in katakana_matches:
        # Filter out common non-product katakana
        if match in ("テクスチャー", "ビフォー", "アフター", "コメント",
                     "フォロー", "チャンネル", "リンク", "クーポン",
                     "セール", "タイムセール", "フラッシュ", "インスタ",
                     "ランキング", "レビュー", "メリット", "デメリット",
                     "ポイント", "ステップ", "スタート", "ラスト",
                     "オーガニック", "コスパ", "プロフィール"):
            continue
        if len(match) >= 3:
            names.append(match)

    return names


def _find_product_mentions(
    segments: list[dict],
    events: list[dict],
) -> list[dict]:
    """Find all product mention points in the transcript.

    Returns list of product mention markers:
    [{"time": float, "type": str, "name": str, "segment_index": int}, ...]
    """
    mentions = []

    for i, seg in enumerate(segments):
        text = seg.get("text", "")
        seg_start = seg.get("start", 0)
        if not text:
            continue

        # Check for explicit product introduction phrases
        for pattern in PRODUCT_INTRO_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                # Extract product name if possible
                names = _extract_product_names(text)
                product_name = names[0] if names else f"商品_{i}"
                mentions.append({
                    "time": seg_start,
                    "type": "product_intro",
                    "name": product_name,
                    "segment_index": i,
                    "confidence": 0.8,
                })
                break

        # Check for katakana product names appearing for the first time
        names = _extract_product_names(text)
        for name in names:
            # Check if this name hasn't been mentioned before
            already_mentioned = any(
                m["name"] == name for m in mentions
            )
            if not already_mentioned:
                mentions.append({
                    "time": seg_start,
                    "type": "product_name",
                    "name": name,
                    "segment_index": i,
                    "confidence": 0.6,
                })

    # Also check events for product_show markers
    for event in events:
        if event.get("event_type") == "product_show":
            event_time = event.get("start", 0)
            # Find if there's already a mention near this time
            nearby = any(
                abs(m["time"] - event_time) < 10.0 for m in mentions
            )
            if not nearby:
                mentions.append({
                    "time": event_time,
                    "type": "product_show_event",
                    "name": f"商品_event_{int(event_time)}",
                    "segment_index": -1,
                    "confidence": 0.5,
                })

    # Sort by time
    mentions.sort(key=lambda x: x["time"])
    return mentions


def _find_segment_end(
    start_time: float,
    product_name: str,
    start_index: int,
    segments: list[dict],
    scene_classifications: list[dict],
    next_product_time: Optional[float],
) -> tuple[float, str]:
    """Find the end time of a product segment.

    Returns (end_time, end_reason).
    """
    # Maximum possible end
    max_end = start_time + MAX_SEGMENT_DURATION

    # If next product starts, that's a hard boundary
    if next_product_time is not None:
        max_end = min(max_end, next_product_time - NEXT_PRODUCT_BUFFER)

    # Scan segments from start_index forward
    last_product_time = start_time
    last_cta_time = None
    scene_transition_time = None

    for i in range(start_index, len(segments)):
        seg = segments[i]
        seg_start = seg.get("start", 0)
        seg_end = seg.get("end", 0)
        text = seg.get("text", "")

        # Beyond max_end, stop
        if seg_start > max_end:
            break

        # Track last product-related content
        has_product_content = False
        for pattern in PRODUCT_EXPLAIN_KEYWORDS:
            if re.search(pattern, text, re.IGNORECASE):
                has_product_content = True
                break
        if has_product_content:
            last_product_time = seg_end

        # Track CTA (signals end of product pitch)
        for pattern in CTA_PATTERNS:
            if re.search(pattern, text, re.IGNORECASE):
                last_cta_time = seg_end
                break

        # Check scene classification transition
        if scene_classifications and i < len(scene_classifications):
            cls = scene_classifications[i]
            scene_type = cls.get("scene_type", "unknown")
            if scene_type in NON_PRODUCT_SCENE_TYPES:
                # Scene transitioned away from product content
                if seg_start > start_time + MIN_SEGMENT_DURATION:
                    scene_transition_time = seg_start
                    break

    # Determine end time based on signals
    if last_cta_time and last_cta_time > start_time + MIN_SEGMENT_DURATION:
        # CTA found — end shortly after
        end_time = min(last_cta_time + PRODUCT_END_PADDING, max_end)
        return end_time, "cta_complete"

    if scene_transition_time:
        return scene_transition_time, "scene_transition"

    if next_product_time is not None and next_product_time - NEXT_PRODUCT_BUFFER > start_time + MIN_SEGMENT_DURATION:
        return next_product_time - NEXT_PRODUCT_BUFFER, "next_product"

    # Default: use last product content time + padding, or target duration
    if last_product_time > start_time + 10.0:
        end_time = min(last_product_time + PRODUCT_END_PADDING, max_end)
    else:
        end_time = min(start_time + TARGET_SEGMENT_DURATION, max_end)

    return end_time, "duration_target"


def _calculate_segment_confidence(
    segment: dict,
    segments: list[dict],
    scene_classifications: list[dict],
) -> float:
    """Calculate confidence score for a product segment.

    Based on:
    - Number of product explanation keywords found
    - Scene classification alignment
    - Presence of price mention
    - Duration appropriateness
    """
    start = segment["start"]
    end = segment["end"]
    duration = end - start
    confidence = segment.get("confidence", 0.5)

    # Duration bonus/penalty
    if MIN_SEGMENT_DURATION <= duration <= MAX_SEGMENT_DURATION:
        if abs(duration - TARGET_SEGMENT_DURATION) < 15:
            confidence += 0.1  # Near target duration
    elif duration < MIN_SEGMENT_DURATION:
        confidence -= 0.2  # Too short

    # Count product explanation keywords in segment
    keyword_count = 0
    price_found = False
    for seg in segments:
        seg_start = seg.get("start", 0)
        seg_end = seg.get("end", 0)
        if seg_start >= start and seg_end <= end:
            text = seg.get("text", "")
            for pattern in PRODUCT_EXPLAIN_KEYWORDS:
                if re.search(pattern, text, re.IGNORECASE):
                    keyword_count += 1
            for pattern in PRICE_PATTERNS:
                if re.search(pattern, text, re.IGNORECASE):
                    price_found = True

    # Keyword bonus
    confidence += min(keyword_count * 0.05, 0.2)

    # Price mention bonus
    if price_found:
        confidence += 0.05

    # Scene classification alignment
    if scene_classifications:
        product_scene_count = 0
        total_scenes = 0
        for cls in scene_classifications:
            cls_start = cls.get("start", 0)
            cls_end = cls.get("end", 0)
            if cls_start >= start and cls_end <= end:
                total_scenes += 1
                if cls.get("scene_type") in PRODUCT_SCENE_TYPES:
                    product_scene_count += 1
        if total_scenes > 0:
            alignment = product_scene_count / total_scenes
            confidence += alignment * 0.15

    return round(min(max(confidence, 0.0), 1.0), 3)


def _collect_segment_metadata(
    start: float,
    end: float,
    segments: list[dict],
    scene_classifications: list[dict],
) -> dict:
    """Collect metadata about a product segment (keywords, scene types, indices)."""
    keywords_found = []
    scene_types = []
    segment_indices = []

    for i, seg in enumerate(segments):
        seg_start = seg.get("start", 0)
        seg_end = seg.get("end", 0)
        if seg_start >= start and seg_end <= end:
            segment_indices.append(i)
            text = seg.get("text", "")
            for pattern in PRODUCT_EXPLAIN_KEYWORDS:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    keywords_found.append(match.group())

    for cls in scene_classifications:
        cls_start = cls.get("start", 0)
        cls_end = cls.get("end", 0)
        if cls_start >= start and cls_end <= end:
            st = cls.get("scene_type", "unknown")
            if st not in scene_types:
                scene_types.append(st)

    return {
        "keywords_found": keywords_found[:10],  # Limit to 10
        "scene_types": scene_types,
        "segment_indices": segment_indices,
    }


def _adjust_segment_duration(
    start: float,
    end: float,
    segments: list[dict],
    video_duration: float,
) -> tuple[float, float]:
    """Adjust segment to meet minimum duration requirement.

    If too short, pad with surrounding context.
    If too long, trim to the most content-dense portion.
    """
    duration = end - start

    if duration < MIN_SEGMENT_DURATION:
        # Pad equally before and after
        deficit = MIN_SEGMENT_DURATION - duration
        pad_before = min(deficit / 2, start)  # Don't go below 0
        pad_after = deficit - pad_before
        start = max(0, start - pad_before)
        end = end + pad_after
        if video_duration > 0:
            end = min(end, video_duration)

    elif duration > MAX_SEGMENT_DURATION:
        # Trim: keep the first MAX_SEGMENT_DURATION seconds
        # (product intro is at the start, so trimming from end is safer)
        end = start + MAX_SEGMENT_DURATION

    return round(start, 3), round(end, 3)


def run_product_segment_detection(ctx: PipelineContext) -> PipelineContext:
    """Pipeline step: Detect product introduction segments (V9 core feature).

    Identifies individual product introductions in the video and creates
    segment boundaries for each one. These segments are then used by
    clip_generator to create "1 product = 1 clip" clips.
    """
    if not ctx.segments and not ctx.events:
        logger.info(
            "[product_segment_detector] No segments/events for video %s",
            ctx.video_id,
        )
        ctx.extra["product_segments"] = []
        return ctx

    # Get scene classifications
    scene_classifications = getattr(ctx, "scene_classifications", [])
    if not scene_classifications:
        scene_classifications = ctx.extra.get("scene_classifications", [])

    logger.info(
        "[product_segment_detector] V9: Analyzing %d segments, %d events, "
        "%d scene_classifications for video %s",
        len(ctx.segments), len(ctx.events),
        len(scene_classifications), ctx.video_id,
    )

    # Step 1: Find all product mention points
    mentions = _find_product_mentions(ctx.segments, ctx.events)
    logger.info(
        "[product_segment_detector] Found %d product mentions", len(mentions),
    )

    if not mentions:
        # No explicit product mentions — fall back to scene-classification-based detection
        # Look for consecutive product_demo/product_explain scenes
        product_segments = _detect_from_scene_classifications(
            ctx.segments, scene_classifications, ctx.video_duration,
        )
        ctx.extra["product_segments"] = product_segments
        logger.info(
            "[product_segment_detector] Fallback: %d segments from scene classifications",
            len(product_segments),
        )
        return ctx

    # Step 2: Build product segments from mentions
    product_segments = []
    for i, mention in enumerate(mentions):
        # Determine start time (3s before mention)
        start_time = max(0, mention["time"] - PRODUCT_START_PADDING)

        # Determine next product time (for boundary)
        next_product_time = None
        if i + 1 < len(mentions):
            next_product_time = mentions[i + 1]["time"]

        # Find segment end
        end_time, end_reason = _find_segment_end(
            start_time=start_time,
            product_name=mention["name"],
            start_index=mention.get("segment_index", 0),
            segments=ctx.segments,
            scene_classifications=scene_classifications,
            next_product_time=next_product_time,
        )

        # Adjust duration
        start_time, end_time = _adjust_segment_duration(
            start_time, end_time, ctx.segments, ctx.video_duration,
        )

        # Collect metadata
        metadata = _collect_segment_metadata(
            start_time, end_time, ctx.segments, scene_classifications,
        )

        segment = {
            "product_name": mention["name"],
            "start": start_time,
            "end": end_time,
            "duration": round(end_time - start_time, 3),
            "confidence": mention.get("confidence", 0.5),
            "end_reason": end_reason,
            "mention_type": mention["type"],
            **metadata,
        }

        # Calculate confidence
        segment["confidence"] = _calculate_segment_confidence(
            segment, ctx.segments, scene_classifications,
        )

        product_segments.append(segment)

    # Filter by minimum confidence
    product_segments = [
        seg for seg in product_segments
        if seg["confidence"] >= MIN_CONFIDENCE
    ]

    # Remove overlapping segments (keep higher confidence)
    product_segments = _remove_overlaps(product_segments)

    # Store results
    ctx.extra["product_segments"] = product_segments

    # Log summary
    logger.info(
        "[product_segment_detector] V9 detected %d product segments for video %s",
        len(product_segments), ctx.video_id,
    )
    for i, seg in enumerate(product_segments[:5]):
        logger.info(
            "[product_segment_detector] #%d: '%s' %.1fs-%.1fs (%.1fs) "
            "conf=%.2f end=%s scenes=%s",
            i + 1, seg["product_name"], seg["start"], seg["end"],
            seg["duration"], seg["confidence"], seg["end_reason"],
            ",".join(seg.get("scene_types", [])),
        )

    # Save to DB (non-critical)
    try:
        _save_product_segments_to_db(ctx.video_id, product_segments)
    except Exception as e:
        logger.warning(
            "[product_segment_detector] DB save failed (non-critical): %s", e,
        )

    return ctx


def _detect_from_scene_classifications(
    segments: list[dict],
    scene_classifications: list[dict],
    video_duration: float,
) -> list[dict]:
    """Fallback: detect product segments from scene classifications alone.

    Groups consecutive product-related scenes into segments.
    """
    if not scene_classifications:
        return []

    product_segments = []
    current_segment = None

    for cls in scene_classifications:
        scene_type = cls.get("scene_type", "unknown")
        cls_start = cls.get("start", 0)
        cls_end = cls.get("end", 0)

        if scene_type in PRODUCT_SCENE_TYPES:
            if current_segment is None:
                current_segment = {
                    "product_name": f"商品_{int(cls_start)}s",
                    "start": max(0, cls_start - PRODUCT_START_PADDING),
                    "end": cls_end,
                    "confidence": 0.4,
                    "end_reason": "scene_group",
                    "mention_type": "scene_classification",
                    "keywords_found": [],
                    "scene_types": [scene_type],
                    "segment_indices": [],
                }
            else:
                # Extend current segment
                current_segment["end"] = cls_end
                if scene_type not in current_segment["scene_types"]:
                    current_segment["scene_types"].append(scene_type)
        else:
            # Non-product scene — close current segment if it exists
            if current_segment is not None:
                duration = current_segment["end"] - current_segment["start"]
                if duration >= MIN_SEGMENT_DURATION * 0.7:  # Slightly relaxed for fallback
                    current_segment["end"] = min(
                        current_segment["end"] + PRODUCT_END_PADDING,
                        video_duration if video_duration > 0 else float("inf"),
                    )
                    current_segment["duration"] = round(
                        current_segment["end"] - current_segment["start"], 3,
                    )
                    product_segments.append(current_segment)
                current_segment = None

    # Don't forget the last segment
    if current_segment is not None:
        duration = current_segment["end"] - current_segment["start"]
        if duration >= MIN_SEGMENT_DURATION * 0.7:
            current_segment["duration"] = round(
                current_segment["end"] - current_segment["start"], 3,
            )
            product_segments.append(current_segment)

    return product_segments


def _remove_overlaps(segments: list[dict]) -> list[dict]:
    """Remove overlapping segments, keeping higher confidence ones."""
    if not segments:
        return []

    # Sort by confidence descending
    sorted_segs = sorted(segments, key=lambda x: x["confidence"], reverse=True)
    kept = []

    for seg in sorted_segs:
        overlaps = False
        for existing in kept:
            # Check overlap
            if seg["start"] < existing["end"] and seg["end"] > existing["start"]:
                overlap = min(seg["end"], existing["end"]) - max(seg["start"], existing["start"])
                min_duration = min(seg["duration"], existing["duration"])
                if overlap / max(min_duration, 1) > 0.5:  # >50% overlap
                    overlaps = True
                    break
        if not overlaps:
            kept.append(seg)

    # Re-sort by start time
    kept.sort(key=lambda x: x["start"])
    return kept


def _save_product_segments_to_db(video_id: str, segments: list[dict]):
    """Save product segments to video_product_segments table."""
    if not segments:
        return

    try:
        from shared.db.session import get_session, run_sync
        from sqlalchemy import text
        import json

        async def _save():
            async with get_session() as session:
                # Create table if not exists
                await session.execute(text("""
                    CREATE TABLE IF NOT EXISTS video_product_segments (
                        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                        video_id UUID NOT NULL,
                        product_name TEXT NOT NULL,
                        start_time FLOAT NOT NULL,
                        end_time FLOAT NOT NULL,
                        duration FLOAT,
                        confidence FLOAT DEFAULT 0.5,
                        end_reason TEXT,
                        mention_type TEXT,
                        keywords_found JSONB DEFAULT '[]',
                        scene_types JSONB DEFAULT '[]',
                        source VARCHAR(20) DEFAULT 'pipeline_v9',
                        created_at TIMESTAMPTZ DEFAULT now()
                    )
                """))
                # Delete existing pipeline-generated segments for this video
                await session.execute(
                    text("DELETE FROM video_product_segments WHERE video_id = :vid AND source = 'pipeline_v9'"),
                    {"vid": video_id},
                )
                # Insert new segments
                for seg in segments:
                    await session.execute(
                        text("""
                            INSERT INTO video_product_segments
                                (video_id, product_name, start_time, end_time,
                                 duration, confidence, end_reason, mention_type,
                                 keywords_found, scene_types, source)
                            VALUES (:vid, :name, :start, :end,
                                    :dur, :conf, :reason, :mtype,
                                    CAST(:keywords AS jsonb), CAST(:scenes AS jsonb), 'pipeline_v9')
                        """),
                        {
                            "vid": video_id,
                            "name": seg["product_name"],
                            "start": seg["start"],
                            "end": seg["end"],
                            "dur": seg.get("duration", 0),
                            "conf": seg.get("confidence", 0.5),
                            "reason": seg.get("end_reason", ""),
                            "mtype": seg.get("mention_type", ""),
                            "keywords": json.dumps(seg.get("keywords_found", []), ensure_ascii=False),
                            "scenes": json.dumps(seg.get("scene_types", []), ensure_ascii=False),
                        },
                    )

        run_sync(_save())
        logger.info(
            "[product_segment_detector] Saved %d product segments for video %s",
            len(segments), video_id,
        )
    except Exception as e:
        logger.warning(
            "[product_segment_detector] DB save failed: %s", e,
        )
