# Video Editing Structure Upgrade Notes

## Current State Analysis

### AI Video Generator (`ai_video_generator.py`)
- Script generation via GPT-4 already has structure: hook → product intro → usage → urgency → CTA
- BUT the generated video is just one continuous talking head with no actual video editing/cuts
- The script is read as one continuous piece - no segment reordering or highlight extraction
- **Problem**: The video is just a talking head reading a script - no editing, no cuts, no visual variety

### AI Clip Generator (`ai_clip_generator.py`)
- Takes existing live stream clips and applies effects (subtitles, zoom, silence cut, etc.)
- Has `_analyze_content_relevance()` which uses GPT to detect irrelevant segments to cut
- Has hook text generation (text overlay at start)
- Has CTA text generation (text overlay at end)
- Has selling points overlay
- **BUT**: No actual video segment reordering - it just cuts irrelevant parts and adds overlays
- **Problem**: The clip keeps original order, doesn't extract a "highlight" to put at the beginning

## What User Wants

### Structure for both systems:
1. **Opening (Hook)**: Extract the most exciting/compelling clip segment and put it at the start
2. **Middle (Body)**: Product introduction (selling points, effects, details, usage method)
3. **Ending (CTA)**: Guide users to purchase (optional)

### Subtitle Upgrade:
- Grammar correction in original language
- Accurate translation

## Implementation Plan

### For AI Clip Generator (Live Recording Clips):
1. After transcription, use GPT to identify the "highlight moment" (most compelling segment)
2. Physically reorder the video: move highlight segment to the beginning
3. Then arrange remaining segments in logical order: product intro → usage → CTA
4. Add a grammar correction step to subtitles before rendering

### For AI Video Generator:
1. The script already has good structure - the issue is the video is just a talking head
2. Need to add post-processing: after HeyGen generates the video, analyze it and add cuts/transitions
3. OR: Generate the script in segments and assemble them with transitions
4. Better approach: Improve the script prompt to be more structured with clear segment markers

### Subtitle Grammar Correction:
- Add a GPT pass to correct grammar in the original language captions
- This should happen after Whisper transcription, before rendering
