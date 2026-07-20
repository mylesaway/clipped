# Clipped ✂️

**HD clips that actually look good in a deck — and drag anywhere.**

A web tool that turns your own video into short, shareable clips. Everything runs in your browser — your video never leaves your device. No watermarks, no forced length caps.

## What works today

- Upload a video (drag & drop or file picker) — MP4, MOV, WEBM, M4V
- Scrub through it on a filmstrip timeline
- Trim: drag the handles (or press `I` / `O`) to set start and end
- Preview the trimmed clip on a loop
- Export your clip as an HD MP4, animated WebP, or high-quality GIF — made right in your browser and saved to your downloads
- Save several clips from one video with the ＋ button — each one exports as its own file
- Works on phones too

## Coming next (build order)

1. ~~Upload + timeline + trim~~ ✅
2. ~~Export the clip — HD MP4, WebP, and high-quality GIF~~ ✅
3. ~~Multiple clips: press ＋ to save a section, then pick more — each exports as its own file~~ ✅
4. Stitch several saved clips into one clip
5. Resolution / frame-rate picker
6. Accounts + export history (Supabase)
7. Server-side processing for big files
8. Polish: PWA, presets ("Slack", "Email", "Slide — HD")

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
