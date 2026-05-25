"""
magic_cut.py — Magic Cut: AI提示词剪辑エンドポイント
====================================================
ユーザーが素材を選択し、自然言語プロンプトで剪辑指示を出すと、
AIが最適なクリップを選定・カット・合成して成片を生成する。

Phase 1 機能:
  - 素材一覧取得（直播回放 / クリップDB）
  - プロンプト→剪辑指令変換（GPT）
  - 剪辑実行（FFmpeg）
  - 結果プレビュー / ダウンロード
  - 履歴管理

Endpoints:
  GET  /magic-cut/materials       - 利用可能素材一覧
  POST /magic-cut/generate        - プロンプトベース剪辑ジョブ開始
  GET  /magic-cut/jobs/{job_id}   - ジョブ進捗確認
  GET  /magic-cut/jobs            - 全ジョブ一覧
  POST /magic-cut/refine/{job_id} - 追加プロンプトで微調整
  GET  /magic-cut/history         - 履歴一覧
"""
import uuid
import json
import os
import re
import logging
import tempfile
import asyncio
import subprocess
import time
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query, Header, BackgroundTasks, UploadFile, File, Form
from pydantic import BaseModel, Field
from sqlalchemy import text
from app.core.db import AsyncSessionLocal

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/magic-cut", tags=["Magic Cut"])

# ─── Configuration ────────────────────────────────────────────────────────────
ADMIN_KEY = os.getenv("ADMIN_API_KEY", "aither:hub")
_SEMAPHORE = asyncio.Semaphore(2)  # Max 2 concurrent Magic Cut jobs

def verify_admin(key: Optional[str]):
    if key != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="Unauthorized")

# ─── DB Session Helper ────────────────────────────────────────────────────────
from contextlib import asynccontextmanager

@asynccontextmanager
async def get_session():
    async with AsyncSessionLocal() as session:
        async with session.begin():
            yield session

# ─── In-memory job store (file-backed for persistence) ────────────────────────
_JOB_DIR = "/tmp/magic_cut_jobs"
os.makedirs(_JOB_DIR, exist_ok=True)

def _save_job_file(job_id: str, data: dict):
    with open(os.path.join(_JOB_DIR, f"{job_id}.json"), "w") as f:
        json.dump(data, f, ensure_ascii=False, default=str)

def _load_job_file(job_id: str) -> Optional[dict]:
    path = os.path.join(_JOB_DIR, f"{job_id}.json")
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return None

async def _save_job_db(job_id: str, data: dict):
    try:
        async with get_session() as session:
            await session.execute(text("""
                INSERT INTO magic_cut_jobs (job_id, status, prompt, config, results, error, created_at, updated_at)
                VALUES (:job_id, :status, :prompt, CAST(:config AS jsonb), CAST(:results AS jsonb), :error, :created_at, :updated_at)
                ON CONFLICT (job_id) DO UPDATE SET
                    status = EXCLUDED.status,
                    results = EXCLUDED.results,
                    error = EXCLUDED.error,
                    updated_at = EXCLUDED.updated_at
            """), {
                "job_id": job_id,
                "status": data.get("status", "queued"),
                "prompt": data.get("prompt", ""),
                "config": json.dumps(data.get("config", {}), ensure_ascii=False),
                "results": json.dumps(data.get("results", []), ensure_ascii=False),
                "error": data.get("error"),
                "created_at": data.get("created_at", datetime.now(timezone.utc).isoformat()),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
    except Exception as e:
        logger.warning(f"[magic-cut] DB save failed: {e}")

async def _update_job(job_id: str, **kwargs):
    data = _load_job_file(job_id) or {}
    data.update(kwargs)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    _save_job_file(job_id, data)

# ─── Models ───────────────────────────────────────────────────────────────────
class MagicCutRequest(BaseModel):
    """Magic Cut生成リクエスト"""
    prompt: str = Field(..., description="自然言語の剪辑指示（例: 'この洗面奶の3つの卖点を30秒ずつ切り出して'）")
    material_ids: List[str] = Field(default=[], description="素材ID一覧（video_id or clip_id）。空の場合はAIが自動選定")
    material_type: str = Field("auto", description="素材タイプ: auto/video/clip")
    brand_id: Optional[str] = Field(None, description="ブランドID（絞り込み用）")
    # 出力設定（省略可 - AIが自動判断）
    output_count: Optional[int] = Field(None, ge=1, le=10, description="出力本数（省略時AIが判断）")
    max_duration: Optional[float] = Field(None, description="最大尺（秒）")
    orientation: Optional[str] = Field(None, description="縦横: vertical/horizontal/auto")
    enable_subtitles: bool = Field(True, description="字幕を付けるか")
    subtitle_language: str = Field("auto", description="字幕言語")
    enable_bgm: bool = Field(False, description="BGMを付けるか")
    enable_effects: bool = Field(True, description="エフェクト（ズーム・フラッシュ等）を付けるか")

class RefineRequest(BaseModel):
    """追加調整リクエスト"""
    prompt: str = Field(..., description="調整指示（例: '第一条の開頭をもっと短くして'）")
    target_index: Optional[int] = Field(None, description="対象の結果インデックス（省略時は全体）")

# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/materials")
async def list_materials(
    brand_id: Optional[str] = Query(None),
    material_type: str = Query("all", description="video/clip/all"),
    search: Optional[str] = Query(None, description="キーワード検索"),
    limit: int = Query(30, ge=1, le=100),
    x_admin_key: Optional[str] = Header(None),
):
    """利用可能な素材一覧を取得"""
    verify_admin(x_admin_key)
    materials = []

    # Videos (直播回放)
    if material_type in ("all", "video"):
        conditions = ["v.status = 'completed'", "v.duration IS NOT NULL"]
        params = {"limit": limit}
        if brand_id:
            conditions.append("v.brand_client_id = :brand_id")
            params["brand_id"] = brand_id
        if search:
            conditions.append("(v.original_filename ILIKE :search OR v.top_products ILIKE :search)")
            params["search"] = f"%{search}%"
        where = " AND ".join(conditions)
        async with get_session() as session:
            result = await session.execute(text(f"""
                SELECT v.id, v.original_filename, v.duration, v.created_at,
                       v.top_products, v.brand_client_id, v.compressed_blob_url,
                       COALESCE(c.clip_count, 0) as clip_count
                FROM videos v
                LEFT JOIN (
                    SELECT video_id, COUNT(*) as clip_count
                    FROM video_clips WHERE status = 'completed'
                    GROUP BY video_id
                ) c ON v.id = c.video_id
                WHERE {where}
                ORDER BY v.created_at DESC
                LIMIT :limit
            """), params)
            rows = result.fetchall()
            for r in rows:
                materials.append({
                    "id": str(r.id),
                    "type": "video",
                    "name": r.original_filename or "直播回放",
                    "duration_sec": r.duration,
                    "created_at": str(r.created_at) if r.created_at else None,
                    "top_products": r.top_products,
                    "brand_id": r.brand_client_id,
                    "preview_url": r.compressed_blob_url,
                    "clip_count": r.clip_count,
                })

    # Clips (切り出し済みクリップ)
    if material_type in ("all", "clip"):
        conditions = ["vc.status = 'completed'", "vc.clip_url IS NOT NULL"]
        params = {"limit": limit}
        if brand_id:
            conditions.append("""
                vc.id::text IN (
                    SELECT wca.clip_id FROM widget_clip_assignments wca
                    WHERE wca.client_id = :brand_id AND wca.is_active = TRUE
                )
            """)
            params["brand_id"] = brand_id
        if search:
            conditions.append("(vc.transcript_text ILIKE :search OR vc.product_name ILIKE :search)")
            params["search"] = f"%{search}%"
        where = " AND ".join(conditions)
        async with get_session() as session:
            result = await session.execute(text(f"""
                SELECT vc.id as clip_id, vc.video_id, vc.duration_sec,
                       vc.transcript_text, vc.product_name, vc.thumbnail_url,
                       vc.cta_score, vc.importance_score, vc.liver_name,
                       vc.created_at
                FROM video_clips vc
                WHERE {where}
                ORDER BY vc.created_at DESC
                LIMIT :limit
            """), params)
            rows = result.fetchall()
            for r in rows:
                materials.append({
                    "id": str(r.clip_id),
                    "type": "clip",
                    "name": r.product_name or r.transcript_text[:30] if r.transcript_text else "クリップ",
                    "duration_sec": r.duration_sec,
                    "created_at": str(r.created_at) if r.created_at else None,
                    "transcript": r.transcript_text[:100] if r.transcript_text else None,
                    "product_name": r.product_name,
                    "thumbnail_url": r.thumbnail_url,
                    "cta_score": r.cta_score,
                    "importance_score": r.importance_score,
                    "liver_name": r.liver_name,
                })

    return {"materials": materials, "total": len(materials)}


@router.post("/generate")
async def generate_magic_cut(
    req: MagicCutRequest,
    background_tasks: BackgroundTasks,
    x_admin_key: Optional[str] = Header(None),
):
    """プロンプトベースのAI剪辑ジョブを開始"""
    verify_admin(x_admin_key)
    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    job_data = {
        "job_id": job_id,
        "status": "queued",
        "prompt": req.prompt,
        "progress_pct": 0,
        "current_step": "準備中...",
        "results": [],
        "error": None,
        "created_at": now,
        "updated_at": now,
        "config": req.dict(),
    }
    _save_job_file(job_id, job_data)
    background_tasks.add_task(_run_magic_cut, job_id, req)
    return {"job_id": job_id, "status": "queued", "message": "Magic Cut ジョブを開始しました"}


@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str, x_admin_key: Optional[str] = Header(None)):
    """ジョブ進捗を確認"""
    verify_admin(x_admin_key)
    job = _load_job_file(job_id)
    if not job:
        # Try DB
        async with get_session() as session:
            result = await session.execute(text(
                "SELECT * FROM magic_cut_jobs WHERE job_id = :job_id"
            ), {"job_id": job_id})
            row = result.fetchone()
            if row:
                job = {
                    "job_id": row.job_id,
                    "status": row.status,
                    "prompt": row.prompt,
                    "results": row.results or [],
                    "error": row.error,
                    "created_at": str(row.created_at),
                    "updated_at": str(row.updated_at),
                }
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/jobs")
async def list_jobs(
    limit: int = Query(20, ge=1, le=100),
    x_admin_key: Optional[str] = Header(None),
):
    """全ジョブ一覧"""
    verify_admin(x_admin_key)
    jobs = []
    async with get_session() as session:
        result = await session.execute(text("""
            SELECT job_id, status, prompt, results, error, created_at, updated_at
            FROM magic_cut_jobs
            ORDER BY created_at DESC
            LIMIT :limit
        """), {"limit": limit})
        rows = result.fetchall()
        for r in rows:
            jobs.append({
                "job_id": r.job_id,
                "status": r.status,
                "prompt": r.prompt,
                "results": r.results or [],
                "error": r.error,
                "created_at": str(r.created_at),
                "updated_at": str(r.updated_at),
            })
    # Also include file-based in-progress jobs
    for fname in os.listdir(_JOB_DIR):
        if fname.endswith(".json"):
            fdata = _load_job_file(fname.replace(".json", ""))
            if fdata and fdata.get("job_id") not in [j["job_id"] for j in jobs]:
                jobs.append(fdata)
    jobs.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return {"jobs": jobs[:limit], "total": len(jobs)}


@router.post("/refine/{job_id}")
async def refine_magic_cut(
    job_id: str,
    req: RefineRequest,
    background_tasks: BackgroundTasks,
    x_admin_key: Optional[str] = Header(None),
):
    """既存の結果に対して追加プロンプトで微調整"""
    verify_admin(x_admin_key)
    job = _load_job_file(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.get("status") != "done":
        raise HTTPException(status_code=400, detail="ジョブが完了していません")
    # Create a new refinement job linked to the original
    new_job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    new_job_data = {
        "job_id": new_job_id,
        "parent_job_id": job_id,
        "status": "queued",
        "prompt": req.prompt,
        "progress_pct": 0,
        "current_step": "調整準備中...",
        "results": [],
        "error": None,
        "created_at": now,
        "updated_at": now,
        "config": {**job.get("config", {}), "refine_prompt": req.prompt, "target_index": req.target_index},
        "parent_results": job.get("results", []),
    }
    _save_job_file(new_job_id, new_job_data)
    background_tasks.add_task(_run_magic_cut_refine, new_job_id, req, job)
    return {"job_id": new_job_id, "status": "queued", "message": "調整ジョブを開始しました"}


@router.get("/history")
async def get_history(
    limit: int = Query(20, ge=1, le=100),
    x_admin_key: Optional[str] = Header(None),
):
    """履歴一覧（完了済みジョブのみ）"""
    verify_admin(x_admin_key)
    async with get_session() as session:
        result = await session.execute(text("""
            SELECT job_id, status, prompt, results, created_at, updated_at,
                   config->>'output_count' as output_count,
                   config->>'brand_id' as brand_id
            FROM magic_cut_jobs
            WHERE status = 'done'
            ORDER BY created_at DESC
            LIMIT :limit
        """), {"limit": limit})
        rows = result.fetchall()
    return {
        "history": [
            {
                "job_id": r.job_id,
                "prompt": r.prompt,
                "results": r.results or [],
                "created_at": str(r.created_at),
                "output_count": r.output_count,
                "brand_id": r.brand_id,
            }
            for r in rows
        ]
    }


# ─── Background Processing ───────────────────────────────────────────────────

async def _run_magic_cut(job_id: str, req: MagicCutRequest):
    """メインの Magic Cut 処理パイプライン"""
    try:
        async with _SEMAPHORE:
            await _run_magic_cut_inner(job_id, req)
    except Exception as e:
        logger.error(f"[magic-cut {job_id}] Fatal error: {e}", exc_info=True)
        await _update_job(job_id, status="failed", error=str(e)[:500])
        await _save_job_db(job_id, _load_job_file(job_id) or {})


async def _run_magic_cut_inner(job_id: str, req: MagicCutRequest):
    """
    Magic Cut パイプライン:
    1. プロンプト解析（GPT）→ 剪辑指令に変換
    2. 素材選定（指定 or AI自動選定）
    3. 各クリップの時間範囲を決定
    4. FFmpegで剪辑・合成
    5. アップロード
    """
    import httpx
    await _update_job(job_id, status="analyzing", progress_pct=5, current_step="プロンプトを解析中...")

    # ── Step 1: GPTでプロンプトを剪辑指令に変換 ──
    edit_instructions = await _parse_prompt_to_instructions(req.prompt, req)
    if not edit_instructions:
        await _update_job(job_id, status="failed", error="プロンプトの解析に失敗しました")
        await _save_job_db(job_id, _load_job_file(job_id) or {})
        return

    await _update_job(job_id, progress_pct=15, current_step=f"剪辑プラン: {edit_instructions.get('summary', '')}...")
    logger.info(f"[magic-cut {job_id}] Instructions: {json.dumps(edit_instructions, ensure_ascii=False)[:500]}")

    # ── Step 2: 素材選定 ──
    await _update_job(job_id, progress_pct=20, current_step="素材を選定中...")
    clips = await _select_materials(req, edit_instructions)
    if not clips:
        await _update_job(job_id, status="failed", error="条件に合う素材が見つかりませんでした")
        await _save_job_db(job_id, _load_job_file(job_id) or {})
        return

    output_count = edit_instructions.get("output_count", req.output_count or 1)
    await _update_job(job_id, progress_pct=25,
                      current_step=f"{len(clips)}件の素材から{output_count}本の動画を生成します")

    # ── Step 3: 各出力動画を処理 ──
    results = []
    for i in range(output_count):
        pct = 30 + int((i / output_count) * 60)
        await _update_job(job_id, progress_pct=pct,
                          current_step=f"動画 {i+1}/{output_count} を生成中...")
        try:
            result = await _process_single_output(
                job_id, i, output_count, clips, edit_instructions, req
            )
            if result:
                results.append(result)
        except Exception as e:
            logger.error(f"[magic-cut {job_id}] Output {i+1} failed: {e}", exc_info=True)
            results.append({
                "index": i,
                "status": "error",
                "error": str(e)[:200],
            })

    # ── Step 4: 完了 ──
    final_status = "done" if any(r.get("status") == "done" for r in results) else "failed"
    await _update_job(job_id, status=final_status, progress_pct=100,
                      current_step="完了", results=results)
    await _save_job_db(job_id, _load_job_file(job_id) or {})
    logger.info(f"[magic-cut {job_id}] Completed: {len(results)} outputs, status={final_status}")


async def _parse_prompt_to_instructions(prompt: str, req: MagicCutRequest) -> Optional[dict]:
    """GPTでプロンプトを構造化された剪辑指令に変換"""
    try:
        import openai
        azure_key = os.getenv("AZURE_OPENAI_KEY", "")
        azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "")
        azure_model = os.getenv("GPT5_MODEL") or os.getenv("GPT5_DEPLOYMENT") or "gpt-4.1-mini"

        if not azure_key or not azure_endpoint:
            # Fallback: simple parsing
            return _fallback_parse_prompt(prompt, req)

        from urllib.parse import urlparse as _urlparse
        _parsed = _urlparse(azure_endpoint)
        clean_endpoint = f"{_parsed.scheme}://{_parsed.netloc}/"

        client = openai.AzureOpenAI(
            api_key=azure_key,
            azure_endpoint=clean_endpoint,
            api_version=os.getenv("GPT5_API_VERSION", "2025-04-01-preview"),
        )

        system_prompt = """あなたは動画剪辑AIアシスタントです。ユーザーの自然言語プロンプトを構造化された剪辑指令JSONに変換してください。

出力JSON形式:
{
  "summary": "剪辑プランの要約（1行）",
  "output_count": 出力本数（整数）,
  "target_duration_sec": 各動画の目標尺（秒、null=自動）,
  "orientation": "vertical" or "horizontal" or "auto",
  "content_focus": "剪辑で重視する内容（商品名、テーマ等）",
  "style": "fast_pace" or "normal" or "slow" or "dramatic",
  "segments": [
    {
      "description": "このセグメントの内容説明",
      "keywords": ["検索キーワード"],
      "duration_sec": セグメント尺（秒、null=自動）,
      "type": "highlight" or "product_demo" or "talking" or "transition"
    }
  ],
  "effects": {
    "subtitles": true/false,
    "subtitle_language": "ja" or "zh" or "en" or "auto",
    "bgm": true/false,
    "transitions": true/false,
    "zoom_pulse": true/false,
    "flash_intro": true/false
  },
  "post_instructions": "追加の後処理指示（あれば）"
}

ルール:
- output_countが明示されていない場合は1
- target_duration_secが明示されていない場合はnull（素材の長さに依存）
- segmentsはプロンプトから推測される各パートの構成
- keywordsは素材検索に使うキーワード（日本語・中国語OK）
- 必ず有効なJSONのみ出力（説明文不要）"""

        user_msg = f"""プロンプト: {prompt}

追加コンテキスト:
- ブランドID: {req.brand_id or '指定なし'}
- 指定素材数: {len(req.material_ids)}件
- 字幕: {'あり' if req.enable_subtitles else 'なし'}
- BGM: {'あり' if req.enable_bgm else 'なし'}
- エフェクト: {'あり' if req.enable_effects else 'なし'}
- 出力本数指定: {req.output_count or '自動'}
- 最大尺指定: {req.max_duration or '自動'}秒
- 向き: {req.orientation or '自動'}"""

        response = client.responses.create(
            model=azure_model,
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_msg},
            ],
            max_output_tokens=1000,
        )

        result_text = ""
        if hasattr(response, "output_text") and response.output_text:
            result_text = response.output_text.strip()
        elif hasattr(response, "output") and response.output:
            for item in response.output:
                if hasattr(item, "content"):
                    for part in item.content:
                        if hasattr(part, "text"):
                            result_text += part.text
            result_text = result_text.strip()

        # Extract JSON from response
        json_match = re.search(r'\{[\s\S]*\}', result_text)
        if json_match:
            instructions = json.loads(json_match.group())
            return instructions
        else:
            logger.warning(f"[magic-cut] GPT response not valid JSON: {result_text[:200]}")
            return _fallback_parse_prompt(prompt, req)

    except Exception as e:
        logger.warning(f"[magic-cut] GPT prompt parsing failed: {e}")
        return _fallback_parse_prompt(prompt, req)


def _fallback_parse_prompt(prompt: str, req: MagicCutRequest) -> dict:
    """GPTが使えない場合のフォールバック解析"""
    # Simple keyword-based parsing
    output_count = req.output_count or 1
    duration = req.max_duration

    # Try to extract numbers from prompt
    count_match = re.search(r'(\d+)\s*[条本個件]', prompt)
    if count_match:
        output_count = min(int(count_match.group(1)), 10)

    dur_match = re.search(r'(\d+)\s*秒', prompt)
    if dur_match:
        duration = float(dur_match.group(1))

    return {
        "summary": f"プロンプトに基づき{output_count}本の動画を生成",
        "output_count": output_count,
        "target_duration_sec": duration,
        "orientation": req.orientation or "vertical",
        "content_focus": prompt[:50],
        "style": "normal",
        "segments": [{"description": prompt, "keywords": [], "duration_sec": duration, "type": "highlight"}],
        "effects": {
            "subtitles": req.enable_subtitles,
            "subtitle_language": req.subtitle_language,
            "bgm": req.enable_bgm,
            "transitions": req.enable_effects,
            "zoom_pulse": req.enable_effects,
            "flash_intro": req.enable_effects,
        },
        "post_instructions": None,
    }


async def _select_materials(req: MagicCutRequest, instructions: dict) -> list:
    """素材を選定する（指定 or AI自動選定）"""
    clips = []

    if req.material_ids:
        # ユーザーが指定した素材を取得
        for mid in req.material_ids:
            async with get_session() as session:
                # Try as clip first
                result = await session.execute(text("""
                    SELECT vc.id as clip_id, vc.video_id, vc.duration_sec,
                           vc.clip_url, vc.transcript_text, vc.product_name,
                           vc.captions, vc.thumbnail_url, vc.liver_name,
                           vc.time_start, vc.time_end
                    FROM video_clips vc
                    WHERE vc.id = CAST(:id AS uuid) AND vc.status = 'completed' AND vc.clip_url IS NOT NULL
                """), {"id": mid})
                row = result.fetchone()
                if row:
                    clips.append({
                        "clip_id": str(row.clip_id),
                        "video_id": str(row.video_id),
                        "duration_sec": row.duration_sec,
                        "clip_url": row.clip_url,
                        "transcript_text": row.transcript_text,
                        "product_name": row.product_name,
                        "captions": row.captions,
                        "thumbnail_url": row.thumbnail_url,
                        "liver_name": row.liver_name,
                        "time_start": row.time_start,
                        "time_end": row.time_end,
                    })
                else:
                    # Try as video - get all clips from that video
                    result2 = await session.execute(text("""
                        SELECT vc.id as clip_id, vc.video_id, vc.duration_sec,
                               vc.clip_url, vc.transcript_text, vc.product_name,
                               vc.captions, vc.thumbnail_url, vc.liver_name,
                               vc.time_start, vc.time_end
                        FROM video_clips vc
                        WHERE vc.video_id = CAST(:id AS uuid)
                          AND vc.status = 'completed' AND vc.clip_url IS NOT NULL
                        ORDER BY vc.time_start ASC
                    """), {"id": mid})
                    rows2 = result2.fetchall()
                    for r in rows2:
                        clips.append({
                            "clip_id": str(r.clip_id),
                            "video_id": str(r.video_id),
                            "duration_sec": r.duration_sec,
                            "clip_url": r.clip_url,
                            "transcript_text": r.transcript_text,
                            "product_name": r.product_name,
                            "captions": r.captions,
                            "thumbnail_url": r.thumbnail_url,
                            "liver_name": r.liver_name,
                            "time_start": r.time_start,
                            "time_end": r.time_end,
                        })
    else:
        # AI自動選定: content_focusとkeywordsで検索
        keywords = []
        for seg in instructions.get("segments", []):
            keywords.extend(seg.get("keywords", []))
        content_focus = instructions.get("content_focus", "")

        conditions = ["vc.status = 'completed'", "vc.clip_url IS NOT NULL",
                      "COALESCE(vc.is_unusable, FALSE) = FALSE"]
        params = {"limit": 30}

        if req.brand_id:
            conditions.append("""
                vc.id::text IN (
                    SELECT wca.clip_id FROM widget_clip_assignments wca
                    WHERE wca.client_id = :brand_id AND wca.is_active = TRUE
                )
            """)
            params["brand_id"] = req.brand_id

        # Keyword search in transcript
        if keywords or content_focus:
            search_terms = keywords + ([content_focus] if content_focus else [])
            search_conditions = []
            for i, term in enumerate(search_terms[:5]):
                param_key = f"kw_{i}"
                search_conditions.append(f"(vc.transcript_text ILIKE :{param_key} OR vc.product_name ILIKE :{param_key})")
                params[param_key] = f"%{term}%"
            if search_conditions:
                conditions.append(f"({' OR '.join(search_conditions)})")

        where = " AND ".join(conditions)
        async with get_session() as session:
            result = await session.execute(text(f"""
                SELECT vc.id as clip_id, vc.video_id, vc.duration_sec,
                       vc.clip_url, vc.transcript_text, vc.product_name,
                       vc.captions, vc.thumbnail_url, vc.liver_name,
                       vc.time_start, vc.time_end,
                       vc.cta_score, vc.importance_score
                FROM video_clips vc
                WHERE {where}
                ORDER BY COALESCE(vc.importance_score, 0) DESC,
                         COALESCE(vc.cta_score, 0) DESC
                LIMIT :limit
            """), params)
            rows = result.fetchall()
            for r in rows:
                clips.append({
                    "clip_id": str(r.clip_id),
                    "video_id": str(r.video_id),
                    "duration_sec": r.duration_sec,
                    "clip_url": r.clip_url,
                    "transcript_text": r.transcript_text,
                    "product_name": r.product_name,
                    "captions": r.captions,
                    "thumbnail_url": r.thumbnail_url,
                    "liver_name": r.liver_name,
                    "time_start": r.time_start,
                    "time_end": r.time_end,
                })

    return clips


async def _process_single_output(job_id: str, index: int, total: int,
                                  clips: list, instructions: dict,
                                  req: MagicCutRequest) -> dict:
    """1本の出力動画を生成"""
    import httpx
    from app.services.storage_service import generate_read_sas_from_url

    tmp_dir = tempfile.mkdtemp(prefix=f"magic_cut_{job_id[:8]}_{index}_")
    try:
        target_duration = instructions.get("target_duration_sec") or req.max_duration
        segments = instructions.get("segments", [])

        # Select clips for this output
        # If multiple outputs, distribute clips evenly
        if total > 1 and len(clips) >= total:
            chunk_size = max(1, len(clips) // total)
            selected_clips = clips[index * chunk_size:(index + 1) * chunk_size]
        else:
            selected_clips = clips

        if not selected_clips:
            return {"index": index, "status": "error", "error": "素材が不足しています"}

        # Download clips
        downloaded_paths = []
        for ci, clip in enumerate(selected_clips[:5]):  # Max 5 clips per output
            clip_url = clip["clip_url"]
            # Generate SAS if needed
            if "blob.core.windows.net" in clip_url and ("?" not in clip_url or "sig=" not in clip_url):
                try:
                    sas_url = generate_read_sas_from_url(clip_url, expires_hours=2)
                    if sas_url:
                        clip_url = sas_url
                except Exception:
                    pass

            dl_path = os.path.join(tmp_dir, f"clip_{ci}.mp4")
            try:
                async with httpx.AsyncClient(timeout=120.0) as client:
                    async with client.stream("GET", clip_url) as resp:
                        resp.raise_for_status()
                        with open(dl_path, "wb") as f:
                            async for chunk in resp.aiter_bytes(chunk_size=65536):
                                f.write(chunk)
                downloaded_paths.append(dl_path)
            except Exception as e:
                logger.warning(f"[magic-cut {job_id}] Failed to download clip {ci}: {e}")
                continue

        if not downloaded_paths:
            return {"index": index, "status": "error", "error": "素材のダウンロードに失敗しました"}

        # ── FFmpeg processing ──
        output_path = os.path.join(tmp_dir, "output.mp4")

        if len(downloaded_paths) == 1:
            # Single clip: trim if needed
            input_path = downloaded_paths[0]
            ffmpeg_cmd = ["ffmpeg", "-y", "-i", input_path]

            if target_duration:
                ffmpeg_cmd += ["-t", str(target_duration)]

            ffmpeg_cmd += [
                "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                "-c:a", "aac", "-b:a", "128k",
                "-movflags", "+faststart",
                "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2",
                output_path,
            ]
        else:
            # Multiple clips: concatenate
            concat_file = os.path.join(tmp_dir, "concat.txt")
            with open(concat_file, "w") as f:
                for dp in downloaded_paths:
                    f.write(f"file '{dp}'\n")

            # First normalize all clips to same resolution
            normalized_paths = []
            for ci, dp in enumerate(downloaded_paths):
                norm_path = os.path.join(tmp_dir, f"norm_{ci}.mp4")
                norm_cmd = [
                    "ffmpeg", "-y", "-i", dp,
                    "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1",
                    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
                    "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
                    "-movflags", "+faststart",
                ]
                if target_duration and total > 1:
                    per_clip_dur = target_duration / len(downloaded_paths)
                    norm_cmd += ["-t", str(per_clip_dur)]
                norm_cmd.append(norm_path)

                proc = await asyncio.create_subprocess_exec(
                    *norm_cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
                )
                await asyncio.wait_for(proc.communicate(), timeout=120)
                if proc.returncode == 0 and os.path.exists(norm_path):
                    normalized_paths.append(norm_path)

            if not normalized_paths:
                return {"index": index, "status": "error", "error": "動画の正規化に失敗しました"}

            # Write concat file with normalized paths
            concat_file2 = os.path.join(tmp_dir, "concat2.txt")
            with open(concat_file2, "w") as f:
                for np in normalized_paths:
                    f.write(f"file '{np}'\n")

            ffmpeg_cmd = [
                "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", concat_file2,
                "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                "-c:a", "aac", "-b:a", "128k",
                "-movflags", "+faststart",
            ]
            if target_duration:
                ffmpeg_cmd += ["-t", str(target_duration)]
            ffmpeg_cmd.append(output_path)

        proc = await asyncio.create_subprocess_exec(
            *ffmpeg_cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=300)
        if proc.returncode != 0:
            err_msg = stderr.decode()[-300:] if stderr else "Unknown"
            return {"index": index, "status": "error", "error": f"FFmpegエラー: {err_msg}"}

        if not os.path.exists(output_path):
            return {"index": index, "status": "error", "error": "出力ファイルが生成されませんでした"}

        # Get output info
        probe_cmd = ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", output_path]
        probe_result = subprocess.run(probe_cmd, capture_output=True, text=True, timeout=30)
        duration_sec = 0
        if probe_result.returncode == 0:
            probe_data = json.loads(probe_result.stdout)
            duration_sec = float(probe_data.get("format", {}).get("duration", 0))

        file_size = os.path.getsize(output_path)

        # Upload to Azure Blob
        from azure.storage.blob import BlobServiceClient, ContentSettings
        from app.services.storage_service import (
            CONNECTION_STRING, ACCOUNT_NAME, CONTAINER_NAME,
        )
        if not CONNECTION_STRING:
            return {"index": index, "status": "error", "error": "Azure Storage not configured"}

        blob_name = f"magic-cut/{job_id}/{uuid.uuid4().hex[:8]}.mp4"
        svc = BlobServiceClient.from_connection_string(CONNECTION_STRING)
        bc = svc.get_blob_client(container=CONTAINER_NAME, blob=blob_name)

        def _upload():
            with open(output_path, "rb") as data:
                bc.upload_blob(
                    data, overwrite=True,
                    content_settings=ContentSettings(content_type="video/mp4")
                )

        await asyncio.get_event_loop().run_in_executor(None, _upload)

        blob_url = f"https://{ACCOUNT_NAME}.blob.core.windows.net/{CONTAINER_NAME}/{blob_name}"
        try:
            disposition = f'attachment; filename="magic_cut_{index+1}.mp4"'
            download_url = generate_read_sas_from_url(blob_url, expires_hours=72, content_disposition=disposition)
            if not download_url:
                download_url = blob_url
        except Exception:
            download_url = blob_url

        # CDN replacement
        cdn_host = os.getenv("CDN_HOST", "https://cdn.aitherhub.com")
        blob_host = f"https://{ACCOUNT_NAME}.blob.core.windows.net"
        if cdn_host and blob_host in blob_url:
            blob_url = blob_url.replace(blob_host, cdn_host)

        return {
            "index": index,
            "status": "done",
            "download_url": download_url,
            "blob_url": blob_url,
            "duration_sec": round(duration_sec, 1),
            "file_size": file_size,
            "clips_used": len(downloaded_paths),
            "prompt_summary": instructions.get("summary", ""),
        }

    except Exception as e:
        logger.error(f"[magic-cut {job_id}] Process output {index} error: {e}", exc_info=True)
        return {"index": index, "status": "error", "error": str(e)[:200]}
    finally:
        import shutil
        shutil.rmtree(tmp_dir, ignore_errors=True)


async def _run_magic_cut_refine(job_id: str, req: RefineRequest, parent_job: dict):
    """調整ジョブの実行（Phase 2用 - 基本的なリトライ）"""
    try:
        async with _SEMAPHORE:
            await _update_job(job_id, status="refining", progress_pct=10,
                              current_step="調整プロンプトを解析中...")
            # For now, re-run with the refined prompt using parent's config
            parent_config = parent_job.get("config", {})
            new_req = MagicCutRequest(
                prompt=f"{parent_config.get('prompt', '')}。追加指示: {req.prompt}",
                material_ids=parent_config.get("material_ids", []),
                material_type=parent_config.get("material_type", "auto"),
                brand_id=parent_config.get("brand_id"),
                output_count=parent_config.get("output_count"),
                max_duration=parent_config.get("max_duration"),
                orientation=parent_config.get("orientation"),
                enable_subtitles=parent_config.get("enable_subtitles", True),
                subtitle_language=parent_config.get("subtitle_language", "auto"),
                enable_bgm=parent_config.get("enable_bgm", False),
                enable_effects=parent_config.get("enable_effects", True),
            )
            await _run_magic_cut_inner(job_id, new_req)
    except Exception as e:
        logger.error(f"[magic-cut {job_id}] Refine error: {e}", exc_info=True)
        await _update_job(job_id, status="failed", error=str(e)[:500])
        await _save_job_db(job_id, _load_job_file(job_id) or {})
