# app/models/orm/ai_video_gen_job.py
"""
ORM model for ai_video_gen_jobs table.
Persists AI Video Generator jobs to the database so they survive
deployments and App Service restarts.
"""
from sqlalchemy import String, Text, Float, Integer, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from app.models.orm.base import Base
from typing import Optional
from datetime import datetime


class AiVideoGenJob(Base):
    __tablename__ = "ai_video_gen_jobs"

    # Primary key: the job_id (e.g., "avgen-xxxxxxxxxxxx")
    job_id: Mapped[str] = mapped_column(String(50), primary_key=True)

    # Pipeline state
    status: Mapped[str] = mapped_column(String(50), default="queued")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error_step: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Input parameters
    product_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    product_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    product_image_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    product_page_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    product_price: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    avatar_id: Mapped[str] = mapped_column(String(200))
    voice_id: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    tone: Mapped[str] = mapped_column(String(50), default="energetic")
    language: Mapped[str] = mapped_column(String(10), default="ja")
    duration_seconds: Mapped[int] = mapped_column(Integer, default=60)
    benefits: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    target_audience: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    custom_script: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Product showcase options (NEW)
    showcase_mode: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # overlay, split, fullscreen
    showcase_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # user text description

    # Person photo analysis (NEW)
    person_image_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    person_analysis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON analysis result

    # Generated data
    script: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    audio_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Result
    video_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    video_duration_sec: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
