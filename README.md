# Video Download Helper MVP

A local-first video download helper made of two parts:

- `extension/`: a Chrome/Chromium Manifest V3 extension that detects media requests on the current tab.
- `service/`: a local Node.js service that receives download jobs and runs `yt-dlp`, which uses `ffmpeg` for merging and remuxing.

This MVP is designed for videos you have permission to save. It does not bypass DRM.

## Requirements

- Node.js 20 or newer
- `yt-dlp` available on your `PATH`
- `ffmpeg` available on your `PATH`
- Chrome, Chromium, Brave, or another Chromium browser that can load unpacked extensions

On macOS with Homebrew:

```bash
brew install yt-dlp ffmpeg
```

## Start The Local Service

```bash
npm start
```

The service listens on:

```text
http://127.0.0.1:17321
```

Downloads are saved by default to:

```text
~/Downloads/Video Download Helper
```

You can override paths:

```bash
DOWNLOAD_DIR="$HOME/Downloads/Videos" YT_DLP_PATH="/opt/homebrew/bin/yt-dlp" npm start
```

## Load The Extension

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select the `extension/` folder in this repo.
5. Open a page with media playback.
6. Play the video so the network request appears.
7. Open the extension popup and click Download.

## API

Health:

```bash
curl http://127.0.0.1:17321/api/health
```

List jobs:

```bash
curl http://127.0.0.1:17321/api/jobs
```

Create a download:

```bash
curl -X POST http://127.0.0.1:17321/api/downloads \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://example.com/master.m3u8",
    "tabTitle": "Example Video",
    "pageUrl": "https://example.com/watch",
    "headers": {
      "Referer": "https://example.com/watch",
      "User-Agent": "Mozilla/5.0",
      "Cookie": "sid=example"
    }
  }'
```

## What It Detects

- HLS manifests: `.m3u8`
- DASH manifests: `.mpd`
- Direct files: `.mp4`, `.webm`, `.mov`, `.m4v`, `.mkv`, `.mp3`, `.m4a`, `.aac`
- Matching response content types, when the URL does not expose a useful extension

The extension forwards:

- media URL
- page URL as `Referer`
- cookies visible to the browser for that media URL
- observed `User-Agent`
- observed `Authorization`, when the browser exposes it to the extension

## Known Limits

- Chrome Web Store distribution may require policy review and narrower host permissions.
- DRM-protected streams are intentionally unsupported.
- Some sites hide tokens in JavaScript, service workers, iframes, or short-lived signed URLs. Those may need site-specific handling.
- The in-memory job list resets when the local service restarts.
- This MVP queues downloads but does not yet provide pause, cancel, retry, or detailed progress UI.

## Development

Run tests:

```bash
npm test
```

Check JavaScript syntax:

```bash
npm run check
```
