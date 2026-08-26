#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE_PATH = ROOT / "client/src/pages/MorningMeeting.tsx"
OUTPUT_PATH = ROOT / "morning_meeting_culture_integrity.json"
source = SOURCE_PATH.read_text(encoding="utf-8")

ja_start = source.index('  "ja-JP": [')
zh_start = source.index('  "zh-CN": [', ja_start)
principles_end = source.index('\n  ],\n};', zh_start) + len('\n  ],')
ja_block = source[ja_start:zh_start]
zh_block = source[zh_start:principles_end]

checks = {
    "japanese_has_exactly_nine_principles": len(re.findall(r'\{ title:', ja_block)) == 9,
    "chinese_has_exactly_nine_principles": len(re.findall(r'\{ title:', zh_block)) == 9,
    "japanese_approved_opening_present": "やると決めたら、100％やり切る。" in ja_block,
    "japanese_approved_closing_present": "すべては、LCJの成功のために。" in ja_block,
    "chinese_original_opening_present": "做就做100%。做到过，就不许退步。" in zh_block,
    "chinese_original_closing_present": "一切为了LCJ成功。" in zh_block,
    "selected_language_drives_principles": "LCJ_CULTURE_PRINCIPLES[speechLang]" in source,
    "selected_language_drives_copy": "MORNING_MEETING_COPY[speechLang]" in source,
    "language_buttons_are_accessible": source.count("aria-pressed={speechLang") >= 6,
    "language_switch_updates_recognition": all(token in source for token in ["changeSpeechLanguage", "recognitionRef.current.lang = language", "recognitionRef.current.stop()"]),
    "recording_still_uses_selected_language": "recognition.lang = speechLang" in source,
    "summary_still_saves_selected_language": 'language: speechLang === "zh-CN" ? "zh" : "ja"' in source,
    "record_start_remains_connected": "onClick={startRecording}" in source,
    "record_stop_remains_connected": "onClick={stopRecording}" in source,
    "nine_principles_rendered_from_selected_list": "culturePrinciples.map((principle, index)" in source,
    "responsive_reading_layout_present": "lg:grid-cols-2" in source and "lg:col-span-2" in source,
    "closing_statement_rendered": "{copy.closing}" in source,
}

failed = [name for name, passed in checks.items() if not passed]
report = {
    "checked": len(checks),
    "passed": len(checks) - len(failed),
    "failed": failed,
    "checks": checks,
}
OUTPUT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, ensure_ascii=False, indent=2))
raise SystemExit(1 if failed else 0)
