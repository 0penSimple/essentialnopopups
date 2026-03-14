# YouTube Downloader — Setup Guide

## What's in this folder?
- `index.html` — The visual interface you open in your browser
- `server.py`  — The background engine that does the actual downloading

Think of it like a TV remote (HTML page) and the TV itself (Python server).
Both need to be running for it to work.

---

## One-time Setup (you only do this once)

### Step 1 — Make sure Python is installed
Open a terminal (or Command Prompt on Windows) and type:
```
python3 --version
```
If you see a version number, you're good. If not, download Python from https://python.org

### Step 2 — Install yt-dlp (the download engine)
In your terminal, type:
```
pip install yt-dlp
```
(The server.py will also try to do this automatically for you.)

---

## Every time you want to use it

### Step 1 — Start the server
Open a terminal in the folder where you saved these files, then run:
```
python3 server.py
```
You'll see a message saying the server is running. **Keep this window open.**

### Step 2 — Open the HTML page
Double-click `index.html` to open it in your browser.
You should see a green dot saying "Server running · yt-dlp ready"

### Step 3 — Download!
1. Paste a YouTube URL
2. Click **Preview** to confirm it's the right video (optional)
3. Choose format (Video or Audio-only) and quality
4. Click **Download**

Files are saved to: `~/Downloads/YT-Downloads/`

---

## Troubleshooting

**Red dot / "Server offline"**
→ Make sure server.py is running in a terminal window

**"yt-dlp not found"**
→ Run `pip install yt-dlp` in your terminal

**Download failed / error message**
→ The video might be age-restricted or region-blocked
→ Try updating yt-dlp: `pip install -U yt-dlp`
