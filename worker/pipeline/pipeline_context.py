"""
Pipeline Context
=================
Shared state object passed through every pipeline step.

Each step reads inputs from the context and writes its outputs back.
This ensures steps are loosely coupled — they communicate only via
the context, never by importing each other.

Usage:
    ctx = PipelineContext(video_id="abc-123", video_path="/tmp/aitherhub/abc-123/source.mp4")
    ctx.scenes = [{"start": 0, "end": 4.3}, ...]
    ctx.transcript = [{"start": 0.1, "text": "この商品は"}, ...]
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional


@dataclass
class PipelineContext:
    """Shared state for the video processing pipeline."""

    # ── Identity ──
    video_id: str = ""
    video_path: str = ""          # Path to source video file
    audio_path: str = ""          # Path to extracted audio file

    # ── Step outputs ──
    scenes: list[dict] = field(default_factory=list)
    """Scene boundaries from scene detection.
    Format: [{"start": float, "end": float, "scene_index": int}, ...]
    """

    transcript: list[dict] = field(default_factory=list)
    """Raw speech-to-text output.
    Format: [{"start": float, "end": float, "text": str}, ...]
    """

    segments: list[dict] = field(default_factory=list)
    """Semantically segmented transcript blocks.
    Format: [{"start": float, "end": float, "text": str, "segment_index": int}, ...]
    """

    events: list[dict] = field(default_factory=list)
    """Detected events in the video.
    Format: [{"start": float, "end": float, "event_type": str, "confidence": float}, ...]
    """

    scene_classifications: list[dict] = field(default_factory=list)
    """V9: Scene type classifications for each segment.
    Format: [{"segment_index": int, "start": float, "end": float,
             "scene_type": str, "confidence": float, "priority": float}, ...]
    """

    sales_moments: list[dict] = field(default_factory=list)
    """Detected sales/product moments (high-quality candidates).
    Format: [{"start": float, "end": float, "score": float, "reason": str,
             "scene_type": str, "quality_score": float}, ...]
    """

    product_segments: list[dict] = field(default_factory=list)
    """V9: Detected product introduction segments.
    Format: [{"product_name": str, "start": float, "end": float,
             "duration": float, "confidence": float, "scene_types": list}, ...]
    """

    clips: list[dict] = field(default_factory=list)
    """Generated clip metadata.
    Format: [{"clip_id": str, "start": float, "end": float, "clip_url": str,
             "ml_model_version": str, "product_name": str}, ...]
    """

    # ── Metadata ──
    blob_url: str = ""            # Original blob URL of the video
    user_id: str = ""
    video_duration: float = 0.0   # Total video duration in seconds
    fps: float = 0.0              # Video frame rate

    # ── Step timing (populated by pipeline_runner) ──
    step_timings: dict[str, float] = field(default_factory=dict)
    """Timing for each pipeline step in seconds.
    Format: {"scene_detection": 3.2, "speech_extraction": 1.1, ...}
    """

    # ── Error tracking ──
    errors: dict[str, str] = field(default_factory=dict)
    """Errors encountered during pipeline execution.
    Format: {"step_name": "error message"}
    """

    # ── Arbitrary extra data ──
    extra: dict[str, Any] = field(default_factory=dict)
    """Arbitrary extra data that steps can store for downstream use."""

    def has_error(self) -> bool:
        """Check if any step has recorded an error."""
        return len(self.errors) > 0

    def summary(self) -> dict:
        """Return a summary of pipeline results."""
        return {
            "video_id": self.video_id,
            "scenes_count": len(self.scenes),
            "transcript_segments": len(self.transcript),
            "segments_count": len(self.segments),
            "events_count": len(self.events),
            "scene_classifications_count": len(self.scene_classifications),
            "sales_moments_count": len(self.sales_moments),
            "clips_count": len(self.clips),
            "clips_generated": sum(1 for c in self.clips if c.get("status") == "generated"),
            "clips_rejected": sum(1 for c in self.clips if c.get("status") == "rejected"),
            "product_segments_count": len(self.product_segments),
            "ml_model_version": self.extra.get("ml_model_version", ""),
            "errors": self.errors,
            "step_timings": self.step_timings,
            "total_time": sum(self.step_timings.values()),
            "v9": True,
        }
