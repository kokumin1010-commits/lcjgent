"""
TikTok Video Performance Tracking API
- Register TikTok video URLs for tracking
- Fetch performance data from RapidAPI TikWM
- Auto-match TikTok videos to ClipDB clips via audio fingerprint
- Scheduled job to update all tracked videos
- Batch fingerprint generation for existing clips
"""
import os
import re
import httpx
import logging
import urllib.parse
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query, Header, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import text
from app.core.db import AsyncSessionLocal

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tiktok-tracking", tags=["TikTok Tracking"])

RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY", "")
RAPIDAPI_HOST = "tiktok-scraper7.p.rapidapi.com"


# ─── DB Session Helper ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def get_session():
    async with AsyncSessionLocal() as session:
        yield session
        await session.commit()


# ─── Auth Helper ──────────────────────────────────────────────────────────────────────

def verify_admin(x_admin_key: Optional[str] = Header(None)):
    expected = os.getenv("ADMIN_API_KEY", "aither:hub")
    if x_admin_key != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


# ─── Models ───────────────────────────────────────────────────────────────────

class RegisterVideoRequest(BaseModel):
    tiktok_url: str
    clip_db_id: Optional[str] = None
    label: Optional[str] = None
    auto_match: bool = True  # Enable auto-matching by default


# ─── Helpers ──────────────────────────────────────────────────────────────────────────

def extract_video_id_from_url(url: str) -> Optional[str]:
    """Extract TikTok video ID from various URL formats."""
    match = re.search(r'/video/(\d+)', url)
    if match:
        return match.group(1)
    return None


async def fetch_video_data_from_rapidapi(tiktok_url: str) -> dict:
    """Fetch video performance data from RapidAPI TikWM."""
    api_key = RAPIDAPI_KEY or os.getenv("RAPIDAPI_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="RAPIDAPI_KEY not configured")

    headers = {
        "Content-Type": "application/json",
        "x-rapidapi-host": RAPIDAPI_HOST,
        "x-rapidapi-key": api_key,
    }
    # URL must be manually encoded - httpx params encoding doesn't work with TikWM API
    encoded_url = urllib.parse.quote(tiktok_url, safe='')
    full_url = f"https://{RAPIDAPI_HOST}/?url={encoded_url}&hd=1"

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(full_url, headers=headers)
        data = resp.json()

    if data.get("code") != 0:
        raise HTTPException(
            status_code=502,
            detail=f"TikWM API error: {data.get('msg', 'Unknown error')}"
        )

    return data.get("data", {})


async def auto_match_clip(
    tiktok_duration: float,
    tiktok_play_url: str,
    tiktok_music_url: str,
) -> Optional[dict]:
    """
    Auto-match a TikTok video to a ClipDB clip using:
    1. Duration pre-filter (±3s tolerance)
    2. Audio fingerprint comparison (if available)
    """
    try:
        from app.services.audio_fingerprint import find_matching_clip, download_audio_to_temp, generate_fingerprint_from_file

        async with get_session() as session:
            # Get all completed clips with duration
            result = await session.execute(
                text("""
                    SELECT id, clip_url, duration_sec, audio_fingerprint
                    FROM video_clips
                    WHERE status = 'completed'
                      AND clip_url IS NOT NULL
                      AND duration_sec IS NOT NULL
                      AND duration_sec > 0
                """)
            )
            rows = result.fetchall()
            columns = result.keys()
            candidates = [dict(zip(columns, r)) for r in rows]

        if not candidates:
            logger.info("No ClipDB candidates found for auto-matching")
            return None

        # Use the video play URL for fingerprint matching (has original audio)
        audio_url = tiktok_play_url or tiktok_music_url
        if not audio_url:
            logger.warning("No audio URL available for matching")
            return None

        match = await find_matching_clip(
            tiktok_duration=tiktok_duration,
            tiktok_audio_url=audio_url,
            clip_candidates=candidates,
            duration_tolerance=3.0,
            min_similarity=0.3,
        )

        if match:
            logger.info(
                f"Auto-matched TikTok video to clip {match['id']} "
                f"(similarity={match.get('similarity', 0):.3f}, method={match.get('match_method', 'unknown')})"
            )
        return match

    except Exception as e:
        logger.error(f"Auto-match failed: {e}", exc_info=True)
        return None


# ─── Endpoints ────────────────────────────────────────────────────────────────────────

@router.post("/register")
async def register_video(req: RegisterVideoRequest, x_admin_key: Optional[str] = Header(None)):
    """Register a TikTok video URL for performance tracking with optional auto-matching."""
    verify_admin(x_admin_key)

    video_id = extract_video_id_from_url(req.tiktok_url)
    if not video_id:
        raise HTTPException(status_code=400, detail="Invalid TikTok URL. Expected format: https://www.tiktok.com/@user/video/1234567890")

    try:
        video_data = await fetch_video_data_from_rapidapi(req.tiktok_url)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch video data: {e}")
        raise HTTPException(status_code=502, detail=f"Failed to fetch video data: {str(e)}")

    account_name = video_data.get("author", {}).get("unique_id", "")
    title = video_data.get("title", "")
    cover_url = video_data.get("cover", "") or video_data.get("origin_cover", "")
    duration = video_data.get("duration", 0)

    # Auto-match to ClipDB if no clip_db_id provided and auto_match enabled
    auto_match_result = None
    clip_db_id = req.clip_db_id

    if not clip_db_id and req.auto_match and duration > 0:
        play_url = video_data.get("play", "")
        music_url = video_data.get("music", "")
        auto_match_result = await auto_match_clip(
            tiktok_duration=float(duration),
            tiktok_play_url=play_url,
            tiktok_music_url=music_url,
        )
        if auto_match_result:
            clip_db_id = str(auto_match_result["id"])

    async with get_session() as session:
        # Check if already registered
        result = await session.execute(
            text("SELECT id, status FROM tiktok_tracked_videos WHERE tiktok_video_id = :vid"),
            {"vid": video_id}
        )
        existing = result.fetchone()

        if existing:
            if existing[1] == "stopped":
                await session.execute(
                    text("UPDATE tiktok_tracked_videos SET status = 'active', updated_at = NOW() WHERE id = :id"),
                    {"id": existing[0]}
                )
                return {
                    "id": existing[0], "tiktok_url": req.tiktok_url,
                    "tiktok_video_id": video_id, "account_name": account_name,
                    "label": req.label, "status": "active", "message": "Tracking resumed"
                }
            raise HTTPException(status_code=409, detail="This video is already being tracked")

        label_val = req.label or (title[:100] if title else None)
        result = await session.execute(
            text("""
                INSERT INTO tiktok_tracked_videos
                    (tiktok_url, tiktok_video_id, account_name, title, cover_url, clip_db_id, label, status)
                VALUES (:url, :vid, :account, :title, :cover, :clip_db_id, :label, 'active')
                RETURNING id
            """),
            {
                "url": req.tiktok_url, "vid": video_id, "account": account_name,
                "title": title, "cover": cover_url, "clip_db_id": clip_db_id,
                "label": label_val,
            }
        )
        new_id = result.scalar()

        play_count = video_data.get("play_count", 0)
        digg_count = video_data.get("digg_count", 0)
        comment_count = video_data.get("comment_count", 0)
        share_count = video_data.get("share_count", 0)
        collect_count = video_data.get("collect_count", 0)

        await session.execute(
            text("""
                INSERT INTO tiktok_performance_snapshots
                    (tracked_video_id, play_count, digg_count, comment_count, share_count, collect_count)
                VALUES (:tid, :play, :digg, :comment, :share, :collect)
            """),
            {
                "tid": new_id, "play": play_count, "digg": digg_count,
                "comment": comment_count, "share": share_count, "collect": collect_count,
            }
        )

        await session.execute(
            text("UPDATE tiktok_tracked_videos SET last_fetched_at = NOW() WHERE id = :id"),
            {"id": new_id}
        )

        response = {
            "id": new_id, "tiktok_url": req.tiktok_url,
            "tiktok_video_id": video_id, "account_name": account_name,
            "label": label_val, "status": "active",
            "duration": duration,
            "initial_snapshot": {
                "play_count": play_count, "digg_count": digg_count,
                "comment_count": comment_count, "share_count": share_count,
                "collect_count": collect_count,
            }
        }

        # Include auto-match info
        if auto_match_result:
            response["auto_match"] = {
                "clip_db_id": auto_match_result["id"],
                "similarity": auto_match_result.get("similarity", 0),
                "match_method": auto_match_result.get("match_method", "unknown"),
                "clip_duration": auto_match_result.get("duration_sec"),
            }
        elif not req.clip_db_id and req.auto_match:
            response["auto_match"] = None  # Tried but no match found

        return response


@router.get("/videos")
async def list_tracked_videos(
    x_admin_key: Optional[str] = Header(None),
    status: Optional[str] = Query("active"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List all tracked TikTok videos with latest snapshot."""
    verify_admin(x_admin_key)

    async with get_session() as session:
        if status == "all":
            result = await session.execute(
                text("""
                    SELECT tv.*,
                        (SELECT json_build_object(
                            'play_count', ps.play_count,
                            'digg_count', ps.digg_count,
                            'comment_count', ps.comment_count,
                            'share_count', ps.share_count,
                            'collect_count', ps.collect_count,
                            'fetched_at', ps.fetched_at
                        ) FROM tiktok_performance_snapshots ps
                        WHERE ps.tracked_video_id = tv.id
                        ORDER BY ps.fetched_at DESC LIMIT 1) as latest_snapshot
                    FROM tiktok_tracked_videos tv
                    ORDER BY tv.created_at DESC
                    LIMIT :limit OFFSET :offset
                """),
                {"limit": limit, "offset": offset}
            )
        else:
            result = await session.execute(
                text("""
                    SELECT tv.*,
                        (SELECT json_build_object(
                            'play_count', ps.play_count,
                            'digg_count', ps.digg_count,
                            'comment_count', ps.comment_count,
                            'share_count', ps.share_count,
                            'collect_count', ps.collect_count,
                            'fetched_at', ps.fetched_at
                        ) FROM tiktok_performance_snapshots ps
                        WHERE ps.tracked_video_id = tv.id
                        ORDER BY ps.fetched_at DESC LIMIT 1) as latest_snapshot
                    FROM tiktok_tracked_videos tv
                    WHERE tv.status = :status
                    ORDER BY tv.created_at DESC
                    LIMIT :limit OFFSET :offset
                """),
                {"status": status, "limit": limit, "offset": offset}
            )

        rows = result.fetchall()
        columns = result.keys()
        return [dict(zip(columns, row)) for row in rows]


@router.get("/videos/{video_id}/snapshots")
async def get_video_snapshots(
    video_id: int,
    x_admin_key: Optional[str] = Header(None),
    days: int = Query(30, ge=1, le=365),
):
    """Get performance snapshots for a tracked video (time series data)."""
    verify_admin(x_admin_key)

    async with get_session() as session:
        result = await session.execute(
            text("SELECT id, tiktok_url, label FROM tiktok_tracked_videos WHERE id = :id"),
            {"id": video_id}
        )
        video = result.fetchone()
        if not video:
            raise HTTPException(status_code=404, detail="Tracked video not found")

        since = datetime.utcnow() - timedelta(days=days)
        result = await session.execute(
            text("""
                SELECT id, play_count, digg_count, comment_count, share_count, collect_count, fetched_at
                FROM tiktok_performance_snapshots
                WHERE tracked_video_id = :vid AND fetched_at >= :since
                ORDER BY fetched_at ASC
            """),
            {"vid": video_id, "since": since}
        )
        rows = result.fetchall()
        columns = result.keys()

        return {
            "video": {"id": video[0], "tiktok_url": video[1], "label": video[2]},
            "snapshots": [dict(zip(columns, row)) for row in rows],
        }


@router.post("/videos/{video_id}/fetch-now")
async def fetch_now(video_id: int, x_admin_key: Optional[str] = Header(None)):
    """Manually trigger a fetch for a specific tracked video."""
    verify_admin(x_admin_key)

    async with get_session() as session:
        result = await session.execute(
            text("SELECT id, tiktok_url FROM tiktok_tracked_videos WHERE id = :id"),
            {"id": video_id}
        )
        video = result.fetchone()
        if not video:
            raise HTTPException(status_code=404, detail="Tracked video not found")

        video_data = await fetch_video_data_from_rapidapi(video[1])

        play_count = video_data.get("play_count", 0)
        digg_count = video_data.get("digg_count", 0)
        comment_count = video_data.get("comment_count", 0)
        share_count = video_data.get("share_count", 0)
        collect_count = video_data.get("collect_count", 0)

        await session.execute(
            text("""
                INSERT INTO tiktok_performance_snapshots
                    (tracked_video_id, play_count, digg_count, comment_count, share_count, collect_count)
                VALUES (:tid, :play, :digg, :comment, :share, :collect)
            """),
            {
                "tid": video_id, "play": play_count, "digg": digg_count,
                "comment": comment_count, "share": share_count, "collect": collect_count,
            }
        )

        await session.execute(
            text("UPDATE tiktok_tracked_videos SET last_fetched_at = NOW(), updated_at = NOW() WHERE id = :id"),
            {"id": video_id}
        )

        return {
            "success": True,
            "data": {
                "play_count": play_count, "digg_count": digg_count,
                "comment_count": comment_count, "share_count": share_count,
                "collect_count": collect_count,
            }
        }


@router.patch("/videos/{video_id}/stop")
async def stop_tracking(video_id: int, x_admin_key: Optional[str] = Header(None)):
    """Stop tracking a video."""
    verify_admin(x_admin_key)
    async with get_session() as session:
        result = await session.execute(
            text("UPDATE tiktok_tracked_videos SET status = 'stopped', updated_at = NOW() WHERE id = :id RETURNING id"),
            {"id": video_id}
        )
        if not result.fetchone():
            raise HTTPException(status_code=404, detail="Tracked video not found")
        return {"success": True, "message": "Tracking stopped"}


@router.patch("/videos/{video_id}/resume")
async def resume_tracking(video_id: int, x_admin_key: Optional[str] = Header(None)):
    """Resume tracking a stopped video."""
    verify_admin(x_admin_key)
    async with get_session() as session:
        result = await session.execute(
            text("UPDATE tiktok_tracked_videos SET status = 'active', updated_at = NOW() WHERE id = :id RETURNING id"),
            {"id": video_id}
        )
        if not result.fetchone():
            raise HTTPException(status_code=404, detail="Tracked video not found")
        return {"success": True, "message": "Tracking resumed"}


@router.delete("/videos/{video_id}")
async def delete_tracked_video(video_id: int, x_admin_key: Optional[str] = Header(None)):
    """Delete a tracked video and all its snapshots."""
    verify_admin(x_admin_key)
    async with get_session() as session:
        await session.execute(
            text("DELETE FROM tiktok_performance_snapshots WHERE tracked_video_id = :id"),
            {"id": video_id}
        )
        result = await session.execute(
            text("DELETE FROM tiktok_tracked_videos WHERE id = :id RETURNING id"),
            {"id": video_id}
        )
        if not result.fetchone():
            raise HTTPException(status_code=404, detail="Tracked video not found")
        return {"success": True, "message": "Video and snapshots deleted"}


# ─── Audio Fingerprint Endpoints ──────────────────────────────────────────────

@router.post("/fingerprints/generate-batch")
async def generate_fingerprints_batch(
    x_admin_key: Optional[str] = Header(None),
    limit: int = Query(50, ge=1, le=500),
):
    """
    Generate audio fingerprints for ClipDB clips that don't have one yet.
    Processes clips in batches. Call repeatedly until all clips are processed.
    """
    verify_admin(x_admin_key)

    try:
        from app.services.audio_fingerprint import download_audio_to_temp, generate_fingerprint_from_file
        from app.services.storage_service import generate_read_sas_from_url
    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"Missing dependency: {e}")

    results = {"processed": 0, "success": 0, "failed": 0, "remaining": 0}

    async with get_session() as session:
        # Get clips without fingerprints
        result = await session.execute(
            text("""
                SELECT id, clip_url, sas_token, sas_expireddate
                FROM video_clips
                WHERE status = 'completed'
                  AND clip_url IS NOT NULL
                  AND audio_fingerprint IS NULL
                ORDER BY id DESC
                LIMIT :limit
            """),
            {"limit": limit}
        )
        clips = result.fetchall()

        # Count remaining
        count_result = await session.execute(
            text("""
                SELECT COUNT(*) FROM video_clips
                WHERE status = 'completed'
                  AND clip_url IS NOT NULL
                  AND audio_fingerprint IS NULL
            """)
        )
        results["remaining"] = count_result.scalar() or 0

        for clip in clips:
            clip_id, clip_url, sas_token, sas_expireddate = clip
            results["processed"] += 1

            try:
                # Get accessible URL (SAS token or generate new one)
                download_url = None
                if sas_token and sas_expireddate:
                    from datetime import timezone
                    expiry = sas_expireddate
                    if hasattr(expiry, 'replace'):
                        expiry = expiry.replace(tzinfo=None)
                    if expiry > datetime.utcnow():
                        download_url = sas_token

                if not download_url:
                    try:
                        sas_url = generate_read_sas_from_url(clip_url)
                        download_url = sas_url if sas_url else clip_url
                    except Exception:
                        download_url = clip_url

                # Download audio
                tmp_path = await download_audio_to_temp(download_url, timeout=120)
                if not tmp_path:
                    logger.warning(f"Failed to download clip {clip_id}")
                    results["failed"] += 1
                    continue

                try:
                    # Generate fingerprint
                    fp = generate_fingerprint_from_file(tmp_path)
                    if fp:
                        await session.execute(
                            text("UPDATE video_clips SET audio_fingerprint = :fp WHERE id = :id"),
                            {"fp": fp, "id": clip_id}
                        )
                        results["success"] += 1
                        logger.info(f"Generated fingerprint for clip {clip_id}")
                    else:
                        results["failed"] += 1
                        logger.warning(f"Fingerprint generation returned None for clip {clip_id}")
                finally:
                    import os as _os
                    try:
                        _os.unlink(tmp_path)
                    except OSError:
                        pass

            except Exception as e:
                logger.error(f"Failed to process clip {clip_id}: {e}")
                results["failed"] += 1

    results["remaining"] = max(0, results["remaining"] - results["processed"])
    return results


@router.get("/fingerprints/status")
async def fingerprint_status(x_admin_key: Optional[str] = Header(None)):
    """Get fingerprint generation status for ClipDB clips."""
    verify_admin(x_admin_key)

    async with get_session() as session:
        result = await session.execute(
            text("""
                SELECT
                    COUNT(*) FILTER (WHERE status = 'completed' AND clip_url IS NOT NULL) as total_clips,
                    COUNT(*) FILTER (WHERE status = 'completed' AND clip_url IS NOT NULL AND audio_fingerprint IS NOT NULL) as with_fingerprint,
                    COUNT(*) FILTER (WHERE status = 'completed' AND clip_url IS NOT NULL AND audio_fingerprint IS NULL) as without_fingerprint
                FROM video_clips
            """)
        )
        row = result.fetchone()
        return {
            "total_clips": row[0],
            "with_fingerprint": row[1],
            "without_fingerprint": row[2],
            "coverage_pct": round(row[1] / row[0] * 100, 1) if row[0] > 0 else 0,
        }


# ─── Scheduled Job Endpoint ───────────────────────────────────────────────────

@router.post("/cron/fetch-all")
async def cron_fetch_all(x_admin_key: Optional[str] = Header(None)):
    """
    Scheduled job: Fetch performance data for all active tracked videos.
    Frequency logic:
    - Posted 1-3 days ago: fetch every run (daily)
    - Posted 4-7 days ago: fetch every 2nd run (every 2 days)
    - Posted 8-30 days ago: fetch every 7th run (weekly)
    - Posted 31+ days ago: stop automatically
    """
    verify_admin(x_admin_key)

    results = {"fetched": 0, "skipped": 0, "errors": 0, "stopped": 0}

    async with get_session() as session:
        result = await session.execute(
            text("""
                SELECT id, tiktok_url, created_at, last_fetched_at
                FROM tiktok_tracked_videos
                WHERE status = 'active'
                ORDER BY created_at DESC
            """)
        )
        videos = result.fetchall()

        now = datetime.utcnow()

        for video in videos:
            vid_id, tiktok_url, created_at, last_fetched = video
            days_since_created = (now - created_at.replace(tzinfo=None)).days if created_at else 0
            last_fetched_naive = last_fetched.replace(tzinfo=None) if last_fetched else None

            should_fetch = False

            if days_since_created <= 3:
                should_fetch = True
            elif days_since_created <= 7:
                if not last_fetched_naive or (now - last_fetched_naive).total_seconds() >= 47 * 3600:
                    should_fetch = True
            elif days_since_created <= 30:
                if not last_fetched_naive or (now - last_fetched_naive).total_seconds() >= 6.5 * 24 * 3600:
                    should_fetch = True
            else:
                # Auto-stop after 31 days
                await session.execute(
                    text("UPDATE tiktok_tracked_videos SET status = 'stopped', updated_at = NOW() WHERE id = :id"),
                    {"id": vid_id}
                )
                results["stopped"] += 1
                continue

            if not should_fetch:
                results["skipped"] += 1
                continue

            try:
                video_data = await fetch_video_data_from_rapidapi(tiktok_url)
                play_count = video_data.get("play_count", 0)
                digg_count = video_data.get("digg_count", 0)
                comment_count = video_data.get("comment_count", 0)
                share_count = video_data.get("share_count", 0)
                collect_count = video_data.get("collect_count", 0)

                await session.execute(
                    text("""
                        INSERT INTO tiktok_performance_snapshots
                            (tracked_video_id, play_count, digg_count, comment_count, share_count, collect_count)
                        VALUES (:tid, :play, :digg, :comment, :share, :collect)
                    """),
                    {
                        "tid": vid_id, "play": play_count, "digg": digg_count,
                        "comment": comment_count, "share": share_count, "collect": collect_count,
                    }
                )

                await session.execute(
                    text("UPDATE tiktok_tracked_videos SET last_fetched_at = NOW(), updated_at = NOW() WHERE id = :id"),
                    {"id": vid_id}
                )
                results["fetched"] += 1
            except Exception as e:
                logger.error(f"Failed to fetch video {vid_id}: {e}")
                results["errors"] += 1

    return results
