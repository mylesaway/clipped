# Clipped ✂️

**HD clips that actually look good in a deck — and drag anywhere.**

A web tool that turns your own video into short, shareable clips. Everything runs in your browser — your video never leaves your device. No watermarks, no forced length caps.

## What works today

- Upload a video (drag & drop or file picker) — MP4, MOV, WEBM, M4V
- Scrub through it on a filmstrip timeline
- Trim: drag the handles (or press `I` / `O`) to set start and end
- Preview the trimmed clip on a loop
- Works on phones too

## Coming next (build order)

1. ~~Upload + timeline + trim~~ ✅
2. Export the clip — HD MP4 first, then WebP, then high-quality GIF
3. Drag-to-use + Download + resolution/frame-rate picker
4. Multi-segment: pick several parts of one video and stitch them together
5. Accounts + export history (Supabase)
6. Server-side processing for big files
7. Polish: PWA, presets ("Slack", "Email", "Slide — HD")

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| Space | Play / pause |
| I | Set clip start at playhead |
| O | Set clip end at playhead |
| ← / → | Step one frame (hold Shift for 1 second) |

## Running it

It's plain HTML/CSS/JS — no build step. Open `index.html`, or serve the folder:

```
python3 -m http.server 8080
```

## Principles

- Modern formats over "just GIF" — HD MP4/WebP are the quality path; GIF is the "pastes anywhere" option
- Editing tool, not a downloader — upload-only, on purpose
- No watermarks, ever
