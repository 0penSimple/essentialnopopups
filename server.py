"""
EssentialNoPopups — YouTube Download Server
Streams video/audio directly to the user's browser.
Deploy this on Railway.
"""

from flask import Flask, request, Response, jsonify
from flask_cors import CORS
import subprocess
import sys
import os

app = Flask(__name__)
CORS(app)


def ensure_yt_dlp():
    try:
        subprocess.run(["yt-dlp", "--version"], capture_output=True, check=True)
    except (FileNotFoundError, subprocess.CalledProcessError):
        subprocess.run([sys.executable, "-m", "pip", "install", "yt-dlp"], check=True)


@app.route("/")
def index():
    return jsonify({"status": "EssentialNoPopups server running"})


@app.route("/info")
def info():
    url = request.args.get("url", "").strip()
    if not url:
        return jsonify({"ok": False, "error": "No URL provided"}), 200

    try:
        result = subprocess.run(
            ["yt-dlp", "--dump-json", "--no-playlist", url],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode != 0:
            return jsonify({"ok": False, "error": "Could not fetch video info"}), 200

        import json
        info_data = json.loads(result.stdout)
        return jsonify({
            "ok": True,
            "data": {
                "title":      info_data.get("title", "Unknown"),
                "duration":   info_data.get("duration_string", "?"),
                "uploader":   info_data.get("uploader", "Unknown"),
                "thumbnail":  info_data.get("thumbnail", ""),
                "view_count": info_data.get("view_count", 0),
            }
        })
    except subprocess.TimeoutExpired:
        return jsonify({"ok": False, "error": "Request timed out"}), 504
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/download")
def download():
    url     = request.args.get("url", "").strip()
    fmt     = request.args.get("format", "mp4")
    quality = request.args.get("quality", "best")

    if not url:
        return jsonify({"ok": False, "error": "No URL provided"}), 200

    if fmt == "mp3":
        cmd = [
            "yt-dlp", "--no-playlist",
            "-x", "--audio-format", "mp3", "--audio-quality", "0",
            "-o", "-",
            url
        ]
        mimetype = "audio/mpeg"
        ext = "mp3"
    else:
        if quality == "1080":
            fmt_str = "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best"
        elif quality == "720":
            fmt_str = "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best"
        elif quality == "480":
            fmt_str = "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best"
        else:
            fmt_str = "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"

        cmd = [
            "yt-dlp", "--no-playlist",
            "-f", fmt_str,
            "--merge-output-format", "mp4",
            "-o", "-",
            url
        ]
        mimetype = "video/mp4"
        ext = "mp4"

    # Get clean filename
    try:
        title_result = subprocess.run(
            ["yt-dlp", "--no-playlist", "--print", "%(title)s", url],
            capture_output=True, text=True, timeout=15
        )
        raw_title = title_result.stdout.strip() or "video"
        safe_title = "".join(c for c in raw_title if c.isalnum() or c in " -_()").strip()
        safe_title = safe_title[:80] or "video"
        filename = f"{safe_title}.{ext}"
    except Exception:
        filename = f"video.{ext}"

    def generate():
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )
        try:
            while True:
                chunk = process.stdout.read(1024 * 64)
                if not chunk:
                    break
                yield chunk
        finally:
            process.stdout.close()
            process.wait()

    return Response(
        generate(),
        mimetype=mimetype,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        }
    )


if __name__ == "__main__":
    ensure_yt_dlp()
    port = int(os.environ.get("PORT", 8080))
    print(f"Server starting on port {port}")
    app.run(host="0.0.0.0", port=port)
