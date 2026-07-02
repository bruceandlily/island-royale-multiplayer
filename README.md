# Island Royale Multiplayer V58 — Emote Wheel Fixed

This fixes the lobby-only emote wheel not opening.

## Fixed
- Hold **B** in the lobby now opens the emote wheel
- The **EMOTE** button also opens the wheel as a backup
- Emote wheel HTML loads before client.js
- The JS uses safe/lazy lookup, so it does not miss the wheel
- Emotes still only work in the lobby
- **B still works as build mode in the actual game**

## Emotes
- Dance
- Wave
- Laugh
- Clap
- Dab
- Salute
- Floss
- Heart
- Point
- Sit

## Upload these files
Replace these in GitHub:
- `package.json`
- `server.js`
- `render.yaml`
- `public/index.html`
- `public/style.css`
- `public/client.js`

Then wait for Render and press **Ctrl + F5**.
