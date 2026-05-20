"""
Clip Generator (V9)
====================
Generates high-quality vertical clips from detected product moments.

V9 Changes:
    - Target clip duration: 45-90 seconds (was 5-60s)
    - Quality scoring system for each clip
    - Auto-reject: clips below quality threshold are marked as rejected
    - Product explanation completeness check
    - Scene type awareness: product_demo clips get extended boundaries
    - Intelligent boundary detection: tries to start/end at natural pauses

Input (from context):
    - ctx.video_path: Path to the source video file
    - ctx.sales_moments: Detected product moments with start/end times
    - ctx.video_id: Video identifier
    - ctx.segments: Transcript segments (for completeness check)
    - ctx.scene_classifications: Scene type info (V9)

Output (to context):
    - ctx.clips: Generated clip metadata with quality scores
      [{"clip_id": str, "start": float, "end": float, "output_path": str,
        "status": str, "quality_score": float, "scene_type": str,
        "reject_reason": str}, ...]

Quality Score Components:
    - Duration score (0.0-0.3): Optimal at 45-75s
    - Content density (0.0-0.3): Based on transcript word count
    - Scene type bonus (0.0-0.2): product_demo/testimonial get bonus
    - Completeness (0.0-0.2): Does the clip contain a complete thought?
"""
import os
import sys
import uuid
import logging
import subprocess
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from worker.pipeline.pipeline_context import PipelineContext

logger = logging.getLogger("worker.pipeline.clip_generator")

# ─── V9 Clip generation settings ───
CLIP_PADDING_BEFORE = 3.0    # Seconds of padding before the moment (increased)
CLIP_PADDING_AFTER = 5.0     # Seconds of padding after the moment (increased)
MIN_CLIP_DURATION = 30.0     # ★ V9: Minimum 30s (was 5s) — short clips lack context
TARGET_CLIP_DURATION = 60.0  # ★ V9: Target 60s — ideal for product explanation
MAX_CLIP_DURATION = 90.0     # ★ V9: Maximum 90s (was 60s) — allow longer demos
MAX_CLIPS = 5                # Maximum number of clips to generate per video

# ─── V9 Quality thresholds ───
QUALITY_REJECT_THRESHOLD = 0.30   # Clips below this score are auto-rejected
QUALITY_WARN_THRESHOLD = 0.50     # Clips below this get a warning flag

# ─── V9 Scene type duration preferences ───
SCENE_DURATION_PREFS = {
    "product_demo": {"min": 40, "target": 70, "max": 90},
    "testimonial": {"min": 30, "target": 60, "max": 80},
    "product_explain": {"min": 35, "target": 65, "max": 85},
    "social_proof": {"min": 25, "target": 45, "max": 60},
    "comparison": {"min": 30, "target": 50, "max": 70},
    "discount_push": {"min": 20, "target": 30, "max": 45},
    "small_talk": {"min": 15, "target": 25, "max": 40},
}

# FFmpeg encoding settings for vertical clips
OUTPUT_WIDTH = 1080
OUTPUT_HEIGHT = 1920
VIDEO_BITRATE = "4M"
AUDIO_BITRATE = "128k"
CRF = 23


def _get_video_dimensions(video_path: str) -> tuple[int, int]:
    """Get video width and height using ffprobe."""
    try:
        cmd = [
            "ffprobe", "-v", "quiet",
            "-show_entries", "stream=width,height",
            "-select_streams", "v:0",
            "-of", "json",
            video_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        import json
        data = json.loads(result.stdout)
        stream = data.get("streams", [{}])[0]
        return int(stream.get("width", 1920)), int(stream.get("height", 1080))
    except Exception:
        return 1920, 1080


def _build_crop_filter(src_width: int, src_height: int) -> str:
    """Build FFmpeg crop filter for 9:16 vertical output.

    Strategy:
        - If source is already vertical (9:16), no crop needed
        - If source is horizontal (16:9), crop center to 9:16
        - Scale to 1080x1920 output
    """
    src_ratio = src_width / src_height if src_height > 0 else 1.78
    target_ratio = 9 / 16  # 0.5625

    if src_ratio <= target_ratio + 0.05:
        # Already vertical or close — just scale
        return f"scale={OUTPUT_WIDTH}:{OUTPUT_HEIGHT}:force_original_aspect_ratio=decrease,pad={OUTPUT_WIDTH}:{OUTPUT_HEIGHT}:(ow-iw)/2:(oh-ih)/2"
    else:
        # Horizontal source — crop center to 9:16 ratio
        crop_width = int(src_height * target_ratio)
        crop_x = (src_width - crop_width) // 2
        return (
            f"crop={crop_width}:{src_height}:{crop_x}:0,"
            f"scale={OUTPUT_WIDTH}:{OUTPUT_HEIGHT}"
        )


def _find_natural_boundary(
    target_time: float,
    segments: list[dict],
    direction: str = "before",
    search_range: float = 5.0,
) -> float:
    """Find a natural pause/boundary near the target time.

    Looks for gaps between segments (pauses in speech) within search_range.
    Returns the best boundary time, or the original target_time if none found.
    """
    if not segments:
        return target_time

    best_boundary = target_time
    best_gap = 0.0

    for i in range(len(segments) - 1):
        seg_end = segments[i].get("end", 0)
        next_start = segments[i + 1].get("start", 0)
        gap = next_start - seg_end

        if gap < 0.3:  # Not a meaningful pause
            continue

        # Check if this gap is within search range of target
        gap_center = (seg_end + next_start) / 2

        if direction == "before":
            # Looking for a boundary before target_time
            if target_time - search_range <= gap_center <= target_time:
                if gap > best_gap:
                    best_gap = gap
                    best_boundary = seg_end
        else:
            # Looking for a boundary after target_time
            if target_time <= gap_center <= target_time + search_range:
                if gap > best_gap:
                    best_gap = gap
                    best_boundary = next_start

    return best_boundary


def _calculate_quality_score(
    start: float,
    end: float,
    moment: dict,
    segments: list[dict],
    scene_classifications: list[dict],
) -> tuple[float, str]:
    """V9: Calculate quality score for a clip.

    Returns (quality_score, quality_notes).
    Score ranges from 0.0 to 1.0.
    """
    duration = end - start
    scene_type = moment.get("scene_type", "unknown")
    notes = []

    # ── 1. Duration score (0.0 - 0.3) ──
    prefs = SCENE_DURATION_PREFS.get(scene_type, {"min": 30, "target": 60, "max": 90})
    target = prefs["target"]

    if duration < prefs["min"]:
        duration_score = 0.05  # Too short
        notes.append(f"too_short({duration:.0f}s<{prefs['min']}s)")
    elif duration > prefs["max"]:
        duration_score = 0.15  # Too long
        notes.append(f"too_long({duration:.0f}s>{prefs['max']}s)")
    else:
        # Optimal range: score peaks at target duration
        distance_from_target = abs(duration - target) / target
        duration_score = 0.3 * (1.0 - min(distance_from_target, 1.0))

    # ── 2. Content density (0.0 - 0.3) ──
    # Count words in transcript within clip boundaries
    clip_text = ""
    for seg in segments:
        seg_start = seg.get("start", 0)
        seg_end = seg.get("end", 0)
        if seg_start >= start - 1.0 and seg_end <= end + 1.0:
            clip_text += " " + seg.get("text", "")

    word_count = len(clip_text.strip())
    # Ideal: ~5-10 chars per second for Japanese
    chars_per_second = word_count / max(duration, 1.0)

    if chars_per_second < 2.0:
        content_score = 0.05  # Very sparse content
        notes.append("sparse_content")
    elif chars_per_second < 4.0:
        content_score = 0.15  # Light content
    elif chars_per_second > 15.0:
        content_score = 0.20  # Too dense (might be garbled)
        notes.append("very_dense")
    else:
        content_score = 0.30  # Good density

    # ── 3. Scene type bonus (0.0 - 0.2) ──
    scene_bonuses = {
        "product_demo": 0.20,
        "testimonial": 0.18,
        "product_explain": 0.15,
        "social_proof": 0.10,
        "comparison": 0.08,
        "discount_push": 0.0,
        "small_talk": 0.0,
    }
    scene_score = scene_bonuses.get(scene_type, 0.05)

    # ── 4. Completeness check (0.0 - 0.2) ──
    # Check if the clip starts and ends at natural boundaries
    completeness_score = 0.10  # Base

    # Check if clip contains complete sentences (ends with period/。)
    if clip_text.strip():
        sentences = [s for s in clip_text.split("。") if len(s.strip()) > 5]
        if len(sentences) >= 2:
            completeness_score = 0.20  # Multiple complete sentences
        elif len(sentences) >= 1:
            completeness_score = 0.15  # At least one complete sentence

    # Penalty if clip seems to start mid-sentence
    if clip_text.strip() and not any(
        clip_text.strip().startswith(p) for p in ["この", "それ", "こちら", "今", "次", "まず", "では"]
    ):
        # Doesn't start with a typical sentence opener — might be mid-thought
        completeness_score = max(completeness_score - 0.05, 0.0)

    # ── Total quality score ──
    total = duration_score + content_score + scene_score + completeness_score
    total = round(min(max(total, 0.0), 1.0), 3)

    quality_notes = ", ".join(notes) if notes else "good"

    return total, quality_notes


def _generate_clip(
    video_path: str,
    output_path: str,
    start_time: float,
    end_time: float,
    crop_filter: str,
) -> bool:
    """Generate a single clip using FFmpeg.

    Args:
        video_path: Source video path.
        output_path: Output clip path.
        start_time: Clip start time in seconds.
        end_time: Clip end time in seconds.
        crop_filter: FFmpeg video filter string.

    Returns:
        True if generation succeeded.
    """
    duration = end_time - start_time

    cmd = [
        "ffmpeg", "-y",
        "-ss", str(start_time),
        "-i", video_path,
        "-t", str(duration),
        "-vf", crop_filter,
        "-c:v", "libx264",
        "-crf", str(CRF),
        "-preset", "medium",
        "-b:v", VIDEO_BITRATE,
        "-c:a", "aac",
        "-b:a", AUDIO_BITRATE,
        "-movflags", "+faststart",
        output_path,
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,  # 5 min per clip
        )

        if result.returncode != 0:
            logger.error(
                "[clip_generator] FFmpeg failed (exit=%d): %s",
                result.returncode, result.stderr[-300:] if result.stderr else "",
            )
            return False

        output = Path(output_path)
        if not output.exists() or output.stat().st_size == 0:
            logger.error("[clip_generator] Output file is empty or missing")
            return False

        size_mb = output.stat().st_size / (1024 * 1024)
        logger.info(
            "[clip_generator] Clip generated: %.1fMB, %.1fs",
            size_mb, duration,
        )
        return True

    except subprocess.TimeoutExpired:
        logger.error("[clip_generator] FFmpeg timed out")
        return False
    except Exception as e:
        logger.error("[clip_generator] Error: %s", e)
        return False


def run_clip_generation(ctx: PipelineContext) -> PipelineContext:
    """Pipeline step: Generate vertical clips from product moments (V9).

    V9 improvements:
        - Intelligent clip boundaries (natural pauses)
        - Scene-type-aware duration preferences
        - Quality scoring for each clip
        - Auto-reject low-quality clips
        - Extended padding for product demos

    For each product moment (up to MAX_CLIPS), generates a vertical
    clip trimmed from the source video with quality assessment.
    """
    if not ctx.sales_moments:
        logger.info("[clip_generator] No sales moments for video %s", ctx.video_id)
        ctx.clips = []
        return ctx

    video_path = ctx.video_path
    if not video_path or not Path(video_path).exists():
        raise FileNotFoundError(f"Video file not found: {video_path}")

    # Get video dimensions for crop filter
    src_width, src_height = _get_video_dimensions(video_path)
    crop_filter = _build_crop_filter(src_width, src_height)
    logger.info(
        "[clip_generator] V9: Source %dx%d, crop_filter: %s",
        src_width, src_height, crop_filter,
    )

    # Get scene classifications for quality scoring
    scene_classifications = getattr(ctx, "scene_classifications", [])
    if not scene_classifications:
        scene_classifications = ctx.extra.get("scene_classifications", [])

    # Sort sales moments by score (best first), skip discount_push
    moments = sorted(ctx.sales_moments, key=lambda x: x.get("score", 0), reverse=True)

    # Filter: prefer non-discount moments
    preferred_moments = [m for m in moments if m.get("scene_type") != "discount_push"]
    if not preferred_moments:
        preferred_moments = moments  # Fallback if all are discount

    moments = preferred_moments[:MAX_CLIPS]

    # Output directory
    output_dir = Path(video_path).parent / "clips"
    output_dir.mkdir(parents=True, exist_ok=True)

    clips = []
    for i, moment in enumerate(moments):
        clip_id = str(uuid.uuid4())[:8]
        scene_type = moment.get("scene_type", "unknown")

        # Get duration preferences for this scene type
        prefs = SCENE_DURATION_PREFS.get(scene_type, {"min": 30, "target": 60, "max": 90})

        # Calculate initial boundaries with padding
        raw_start = max(0, moment["start"] - CLIP_PADDING_BEFORE)
        raw_end = moment["end"] + CLIP_PADDING_AFTER

        # Try to find natural boundaries (speech pauses)
        start = _find_natural_boundary(raw_start, ctx.segments, "before", 3.0)
        end = _find_natural_boundary(raw_end, ctx.segments, "after", 3.0)

        # Enforce duration limits based on scene type
        duration = end - start
        if duration < prefs["min"]:
            # Extend to minimum duration
            deficit = prefs["min"] - duration
            start = max(0, start - deficit / 2)
            end = end + deficit / 2
        elif duration > prefs["max"]:
            # Trim to maximum duration (keep the best part centered)
            excess = duration - prefs["max"]
            start = start + excess / 3  # Trim less from start
            end = end - excess * 2 / 3  # Trim more from end

        # Final safety: absolute limits
        duration = end - start
        if duration < MIN_CLIP_DURATION:
            pad = (MIN_CLIP_DURATION - duration) / 2
            start = max(0, start - pad)
            end = end + pad
        elif duration > MAX_CLIP_DURATION:
            end = start + MAX_CLIP_DURATION

        # ── V9: Quality scoring ──
        quality_score, quality_notes = _calculate_quality_score(
            start, end, moment, ctx.segments, scene_classifications
        )

        # ── V9: Auto-reject decision ──
        status = "pending"
        reject_reason = ""

        if quality_score < QUALITY_REJECT_THRESHOLD:
            status = "rejected"
            reject_reason = f"quality_too_low({quality_score:.2f}<{QUALITY_REJECT_THRESHOLD}): {quality_notes}"
            logger.info(
                "[clip_generator] V9 AUTO-REJECT clip %s: score=%.3f, reason=%s",
                clip_id, quality_score, reject_reason,
            )
        elif scene_type == "discount_push":
            status = "rejected"
            reject_reason = "discount_push_scene"
            logger.info(
                "[clip_generator] V9 AUTO-REJECT clip %s: discount_push scene",
                clip_id,
            )

        # Generate clip (skip if rejected)
        output_path = str(output_dir / f"clip_{clip_id}.mp4")

        if status != "rejected":
            logger.info(
                "[clip_generator] V9 generating clip %d/%d: %s (%.1fs-%.1fs, "
                "score=%.3f, quality=%.3f, scene=%s)",
                i + 1, len(moments), clip_id, start, end,
                moment.get("score", 0), quality_score, scene_type,
            )

            success = _generate_clip(video_path, output_path, start, end, crop_filter)
            status = "generated" if success else "failed"
        else:
            output_path = ""

        clip_info = {
            "clip_id": clip_id,
            "start": round(start, 3),
            "end": round(end, 3),
            "duration": round(end - start, 3),
            "score": moment.get("score", 0),
            "quality_score": quality_score,
            "quality_notes": quality_notes,
            "scene_type": scene_type,
            "reason": moment.get("reason", ""),
            "output_path": output_path if status == "generated" else "",
            "status": status,
            "reject_reason": reject_reason,
        }
        clips.append(clip_info)

    ctx.clips = clips

    # Log summary
    generated = sum(1 for c in clips if c["status"] == "generated")
    rejected = sum(1 for c in clips if c["status"] == "rejected")
    failed = sum(1 for c in clips if c["status"] == "failed")

    logger.info(
        "[clip_generator] V9 Summary for video %s: "
        "generated=%d, rejected=%d, failed=%d (total=%d)",
        ctx.video_id, generated, rejected, failed, len(clips),
    )

    # Store V9 metadata
    ctx.extra["v9_clip_generator"] = True
    ctx.extra["clip_quality_stats"] = {
        "generated": generated,
        "rejected": rejected,
        "failed": failed,
        "avg_quality": round(
            sum(c["quality_score"] for c in clips) / max(len(clips), 1), 3
        ),
    }

    return ctx
