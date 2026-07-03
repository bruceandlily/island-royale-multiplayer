# Island Royale Multiplayer V72 — Fortnite In-Game UI Rework

This version focuses on the **actual in-game HUD/UI**.

## Main changes
- Reworked the HUD to feel a lot closer to a Fortnite-style match screen
- Reduced overlap between the minimap, real teams panel, and match info panel
- Moved the teammate/party status into a cleaner top-left squad panel
- Restyled the bottom hotbar, ammo panel, and health/shield/material area
- Improved the visual style of the right-side rail (map + teams + match info)
- Fixed more `undefined` labels by converting bad names into `Player` or `Bot`
- Cleaned the feed text so `undefined` names do not show there either

## Replace these files
- `package.json`
- `public/style.css`
- `public/client.js`

Then redeploy and hard refresh with **Ctrl + F5**.
