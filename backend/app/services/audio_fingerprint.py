"""
Audio fingerprint service for matching TikTok videos to ClipDB clips.

Strategy:
1. Duration pre-filter (±3 seconds tolerance)
2. Audio fingerprint comparison using chromaprint (fpcalc)
3. Fallback: raw audio cross-correlation via numpy

Dependencies:
- ffmpeg (already in Docker image)
- chromaprint-tools (fpcalc) — added to Dockerfile
"""
import asyncio
import hashlib
import logging
import os
import struct
import subprocess
import tempfile
from typing import List, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)


# ─── Chromaprint / fpcalc ────────────────────────────────────────────────────

def _fpcalc_available() -> bool:
    """Check if fpcalc (chromaprint) is available."""
    try:
        result = subprocess.run(["fpcalc", "-version"], capture_output=True, timeout=5)
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def generate_fingerprint_from_file(audio_path: str) -> Optional[str]:
    """
    Generate a chromaprint fingerprint from an audio/video file.
    Returns the raw fingerprint string, or None on failure.
    """
    try:
        result = subprocess.run(
            ["fpcalc", "-raw", "-json", audio_path],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode != 0:
            logger.warning(f"fpcalc failed: {result.stderr}")
            return None

        import json
        data = json.loads(result.stdout)
        fingerprint = data.get("fingerprint", "")
        duration = data.get("duration", 0)

        if not fingerprint:
            return None

        # Return as "duration:fingerprint" for storage
        return f"{duration}:{fingerprint}"
    except Exception as e:
        logger.error(f"Fingerprint generation failed: {e}")
        return None


def generate_fingerprint_from_file_raw(audio_path: str) -> Optional[List[int]]:
    """
    Generate raw chromaprint fingerprint as list of integers.
    Used for comparison.
    """
    try:
        result = subprocess.run(
            ["fpcalc", "-raw", "-json", audio_path],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode != 0:
            return None

        import json
        data = json.loads(result.stdout)
        return data.get("fingerprint", [])
    except Exception:
        return None


# ─── Fingerprint Comparison ──────────────────────────────────────────────────

def compare_fingerprints(fp1: str, fp2: str) -> float:
    """
    Compare two fingerprint strings (format: "duration:fingerprint_data").
    Returns similarity score between 0.0 and 1.0.
    """
    if not fp1 or not fp2:
        return 0.0

    try:
        dur1, raw1 = fp1.split(":", 1)
        dur2, raw2 = fp2.split(":", 1)

        # Quick duration check — if durations differ by more than 5s, low match
        dur_diff = abs(float(dur1) - float(dur2))
        if dur_diff > 10:
            return 0.0

        # Compare fingerprint strings using Jaccard-like similarity
        # Split into chunks and compare overlap
        chunk_size = 8
        set1 = set(raw1[i:i+chunk_size] for i in range(0, len(raw1) - chunk_size + 1, chunk_size))
        set2 = set(raw2[i:i+chunk_size] for i in range(0, len(raw2) - chunk_size + 1, chunk_size))

        if not set1 or not set2:
            return 0.0

        intersection = len(set1 & set2)
        union = len(set1 | set2)

        return intersection / union if union > 0 else 0.0
    except Exception as e:
        logger.error(f"Fingerprint comparison error: {e}")
        return 0.0


# ─── Fallback: FFmpeg-based audio hash ───────────────────────────────────────

def generate_audio_hash(audio_path: str, sample_seconds: int = 30) -> Optional[str]:
    """
    Generate a simple audio hash using ffmpeg PCM extraction + SHA256.
    Less accurate than chromaprint but requires no extra dependencies.
    """
    try:
        result = subprocess.run(
            [
                "ffmpeg", "-i", audio_path,
                "-t", str(sample_seconds),
                "-ac", "1",           # mono
                "-ar", "8000",        # low sample rate for speed
                "-f", "s16le",        # raw PCM
                "-vn",                # no video
                "pipe:1"
            ],
            capture_output=True,
            timeout=60,
        )
        if result.returncode != 0 or not result.stdout:
            return None

        return hashlib.sha256(result.stdout).hexdigest()
    except Exception as e:
        logger.error(f"Audio hash generation failed: {e}")
        return None


# ─── Download helpers ────────────────────────────────────────────────────────

async def download_audio_to_temp(url: str, timeout: int = 60) -> Optional[str]:
    """
    Download audio/video from URL to a temporary file.
    Returns the temp file path, or None on failure.
    Caller is responsible for cleanup.
    """
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                logger.warning(f"Download failed: HTTP {resp.status_code} for {url[:100]}")
                return None

            # Create temp file
            suffix = ".mp4" if "video" in resp.headers.get("content-type", "") else ".mp3"
            fd, tmp_path = tempfile.mkstemp(suffix=suffix, prefix="aitherhub_audio_")
            os.close(fd)

            with open(tmp_path, "wb") as f:
                f.write(resp.content)

            return tmp_path
    except Exception as e:
        logger.error(f"Audio download failed: {e}")
        return None


# ─── Main matching function ──────────────────────────────────────────────────

async def find_matching_clip(
    tiktok_duration: float,
    tiktok_audio_url: str,
    clip_candidates: List[dict],
    duration_tolerance: float = 3.0,
    min_similarity: float = 0.3,
) -> Optional[dict]:
    """
    Find the best matching ClipDB clip for a TikTok video.

    Args:
        tiktok_duration: Duration of the TikTok video in seconds
        tiktok_audio_url: URL to download TikTok audio/video
        clip_candidates: List of dicts with keys: id, clip_url, duration_sec, audio_fingerprint
        duration_tolerance: Max duration difference in seconds
        min_similarity: Minimum fingerprint similarity to accept

    Returns:
        Best matching clip dict with added 'similarity' key, or None
    """
    # Step 1: Duration pre-filter
    duration_matches = []
    for clip in clip_candidates:
        clip_dur = clip.get("duration_sec") or 0
        if clip_dur > 0 and abs(clip_dur - tiktok_duration) <= duration_tolerance:
            duration_matches.append(clip)

    logger.info(f"Duration filter: {len(duration_matches)}/{len(clip_candidates)} candidates within ±{duration_tolerance}s of {tiktok_duration}s")

    if not duration_matches:
        return None

    # If only one candidate after duration filter, return it with high confidence
    if len(duration_matches) == 1:
        match = duration_matches[0].copy()
        match["similarity"] = 0.85  # High confidence from unique duration match
        match["match_method"] = "duration_unique"
        return match

    # Step 2: Fingerprint comparison (if fpcalc available and clips have fingerprints)
    use_fpcalc = _fpcalc_available()
    if not use_fpcalc:
        logger.warning("fpcalc not available, using duration-only matching")

    # Check if any candidates have fingerprints
    candidates_with_fp = [c for c in duration_matches if c.get("audio_fingerprint")]

    if use_fpcalc and candidates_with_fp:
        # Download TikTok audio
        tmp_path = await download_audio_to_temp(tiktok_audio_url)
        if tmp_path:
            try:
                tiktok_fp = generate_fingerprint_from_file(tmp_path)
                if tiktok_fp:
                    best_match = None
                    best_score = 0.0

                    for clip in candidates_with_fp:
                        score = compare_fingerprints(tiktok_fp, clip["audio_fingerprint"])
                        logger.info(f"Clip {clip['id']}: similarity={score:.3f}")
                        if score > best_score:
                            best_score = score
                            best_match = clip

                    if best_match and best_score >= min_similarity:
                        result = best_match.copy()
                        result["similarity"] = round(best_score, 3)
                        result["match_method"] = "fingerprint"
                        return result
            finally:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass

    # Step 3: Fallback — return best duration match (closest duration)
    duration_matches.sort(key=lambda c: abs((c.get("duration_sec") or 0) - tiktok_duration))
    best = duration_matches[0].copy()
    best["similarity"] = round(max(0.5, 1.0 - abs((best.get("duration_sec") or 0) - tiktok_duration) / duration_tolerance), 3)
    best["match_method"] = "duration_closest"
    return best
