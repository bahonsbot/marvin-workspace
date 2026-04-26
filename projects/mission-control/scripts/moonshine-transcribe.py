#!/usr/bin/env python3
"""Mission Control Lab Moonshine STT helper.

Reads a WAV file path and prints JSON: {ok, text, model, durationMs, lines}.
The Node API converts browser audio to 16k mono WAV before calling this script.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

TOOLS_ROOT = Path(os.environ.get("MISSION_CONTROL_MOONSHINE_PYTHONPATH", "/data/.openclaw/tools/moonshine-voice-python"))
CACHE_ROOT = Path(os.environ.get("MISSION_CONTROL_MOONSHINE_CACHE_DIR", "/data/.openclaw/tools/moonshine-voice-cache"))
if str(TOOLS_ROOT) not in sys.path:
    sys.path.insert(0, str(TOOLS_ROOT))

from moonshine_voice import ModelArch, Transcriber, get_model_for_language, get_model_path, load_wav_file  # noqa: E402

MODEL_ARCHES = {
    "tiny": ModelArch.TINY,
    "tiny-streaming": ModelArch.TINY_STREAMING,
    "tiny_streaming": ModelArch.TINY_STREAMING,
}


def emit(payload: dict, status: int = 0) -> None:
    print(json.dumps(payload, ensure_ascii=False))
    raise SystemExit(status)


def resolve_model(model_name: str) -> tuple[str, ModelArch, str]:
    normalized = (model_name or "tiny-streaming").strip().lower()
    arch = MODEL_ARCHES.get(normalized, ModelArch.TINY_STREAMING)

    # The package bundles tiny-en, but the downloaded cache path is more explicit
    # and lets us use the streaming tiny model as the default Lab experiment.
    if arch == ModelArch.TINY and normalized == "tiny-bundled":
        return str(get_model_path("tiny-en")), arch, "tiny-bundled"

    model_path, model_arch = get_model_for_language("en", arch, cache_root=CACHE_ROOT)
    label = "tiny-streaming" if model_arch == ModelArch.TINY_STREAMING else "tiny"
    return str(model_path), model_arch, label


def main() -> None:
    if len(sys.argv) != 2:
        emit({"ok": False, "error": "Usage: moonshine-transcribe.py <wav-path>"}, 2)

    wav_path = Path(sys.argv[1])
    if not wav_path.exists():
        emit({"ok": False, "error": f"Audio file not found: {wav_path}"}, 2)

    model_name = os.environ.get("MISSION_CONTROL_MOONSHINE_MODEL", "tiny-streaming")
    started = time.time()

    try:
        model_path, model_arch, model_label = resolve_model(model_name)
        transcriber = Transcriber(model_path=model_path, model_arch=model_arch)
        try:
            audio, sample_rate = load_wav_file(wav_path)
            transcript = transcriber.transcribe_without_streaming(audio, sample_rate)
        finally:
            transcriber.close()

        lines = [line.text.strip() for line in transcript.lines if line.text and line.text.strip()]
        text = " ".join(lines).strip()
        emit({
            "ok": True,
            "text": text,
            "model": f"moonshine-voice/{model_label}",
            "durationMs": round((time.time() - started) * 1000),
            "lines": lines,
        })
    except Exception as exc:  # noqa: BLE001 - returned to Node as provider details
        emit({"ok": False, "error": str(exc), "type": type(exc).__name__}, 1)


if __name__ == "__main__":
    main()
