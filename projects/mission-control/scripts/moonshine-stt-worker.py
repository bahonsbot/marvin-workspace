#!/usr/bin/env python3
"""Warm Moonshine STT worker for Mission Control Lab.

Local-only HTTP worker. Next.js converts browser audio to 16k mono WAV, then posts
{"wavPath":"/tmp/file.wav"} to /transcribe. Keeping the Transcriber loaded avoids
Python startup + model load on every voice input.
"""

from __future__ import annotations

import json
import os
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

TOOLS_ROOT = Path(os.environ.get("MISSION_CONTROL_MOONSHINE_PYTHONPATH", "/data/.openclaw/tools/moonshine-voice-python"))
CACHE_ROOT = Path(os.environ.get("MISSION_CONTROL_MOONSHINE_CACHE_DIR", "/data/.openclaw/tools/moonshine-voice-cache"))
if str(TOOLS_ROOT) not in sys.path:
    sys.path.insert(0, str(TOOLS_ROOT))

from moonshine_voice import ModelArch, Transcriber, get_model_for_language, get_model_path, load_wav_file  # noqa: E402

HOST = os.environ.get("MISSION_CONTROL_MOONSHINE_STT_HOST", "127.0.0.1")
PORT = int(os.environ.get("MISSION_CONTROL_MOONSHINE_STT_PORT", "3023"))
MODEL_NAME = os.environ.get("MISSION_CONTROL_MOONSHINE_MODEL", "tiny-streaming")

MODEL_ARCHES = {
    "tiny": ModelArch.TINY,
    "tiny-streaming": ModelArch.TINY_STREAMING,
    "tiny_streaming": ModelArch.TINY_STREAMING,
}

transcriber: Transcriber | None = None
model_label = ""
model_path = ""
loaded_at: float | None = None


def resolve_model(model_name: str) -> tuple[str, ModelArch, str]:
    normalized = (model_name or "tiny-streaming").strip().lower()
    arch = MODEL_ARCHES.get(normalized, ModelArch.TINY_STREAMING)

    if arch == ModelArch.TINY and normalized == "tiny-bundled":
        return str(get_model_path("tiny-en")), arch, "tiny-bundled"

    resolved_path, resolved_arch = get_model_for_language("en", arch, cache_root=CACHE_ROOT)
    label = "tiny-streaming" if resolved_arch == ModelArch.TINY_STREAMING else "tiny"
    return str(resolved_path), resolved_arch, label


def get_transcriber() -> tuple[Transcriber, str]:
    global transcriber, model_label, model_path, loaded_at
    if transcriber is None:
        started = time.time()
        model_path, model_arch, model_label = resolve_model(MODEL_NAME)
        transcriber = Transcriber(model_path=model_path, model_arch=model_arch)
        loaded_at = time.time()
        print(
            f"[moonshine-stt-worker] loaded moonshine-voice/{model_label} "
            f"in {round((loaded_at - started) * 1000)}ms path={model_path}",
            flush=True,
        )
    return transcriber, model_label


def transcribe_wav(wav_path: Path) -> dict[str, Any]:
    started = time.time()
    tx, label = get_transcriber()
    audio, sample_rate = load_wav_file(wav_path)
    transcript = tx.transcribe_without_streaming(audio, sample_rate)
    lines = [line.text.strip() for line in transcript.lines if line.text and line.text.strip()]
    text = " ".join(lines).strip()
    return {
        "ok": True,
        "text": text,
        "model": f"moonshine-voice/{label}",
        "durationMs": round((time.time() - started) * 1000),
        "lines": lines,
    }


def json_bytes(payload: dict[str, Any]) -> bytes:
    return json.dumps(payload, ensure_ascii=False).encode("utf-8")


class Handler(BaseHTTPRequestHandler):
    server_version = "MissionControlMoonshineSTT/0.1"

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[moonshine-stt-worker] {self.address_string()} {fmt % args}", flush=True)

    def send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json_bytes(payload)
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/healthz":
            self.send_json(200, {
                "ok": True,
                "provider": "moonshine",
                "model": f"moonshine-voice/{model_label or MODEL_NAME}",
                "loaded": transcriber is not None,
                "loadedAt": loaded_at,
            })
            return
        self.send_json(404, {"ok": False, "error": "Not found."})

    def do_POST(self) -> None:  # noqa: N802
        try:
            if self.path == "/warm":
                started = time.time()
                _, label = get_transcriber()
                self.send_json(200, {
                    "ok": True,
                    "provider": "moonshine",
                    "model": f"moonshine-voice/{label}",
                    "loadedMs": round((time.time() - started) * 1000),
                })
                return

            if self.path == "/transcribe":
                content_length = int(self.headers.get("content-length", "0") or "0")
                if content_length <= 0 or content_length > 64 * 1024:
                    self.send_json(400, {"ok": False, "error": "Invalid request body size."})
                    return
                payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
                wav_path = Path(str(payload.get("wavPath") or ""))
                if not wav_path.exists():
                    self.send_json(400, {"ok": False, "error": f"Audio file not found: {wav_path}"})
                    return
                self.send_json(200, transcribe_wav(wav_path))
                return

            self.send_json(404, {"ok": False, "error": "Not found."})
        except Exception as exc:  # noqa: BLE001 - returned as provider detail
            self.send_json(500, {"ok": False, "error": str(exc), "type": type(exc).__name__})


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"[moonshine-stt-worker] listening on http://{HOST}:{PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        if transcriber is not None:
            try:
                transcriber.close()
            except Exception:
                pass
        server.server_close()


if __name__ == "__main__":
    main()
