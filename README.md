# Island Royale Multiplayer V56

This build adds **Trios mode** and upgrades the **lobby player visuals** so real players look much better on the lobby stage and in the party panel.

## What's new in V56
- **Trios** added everywhere:
  - Solo
  - Duos
  - **Trios**
  - Squads
- Trios works with:
  - **No Fill**
  - **Fill**
  - party-size checks
  - ready checks
  - matchmaking
- **Lobby player visuals upgraded**
  - more realistic/stylized body shape
  - face details
  - outfit shading
  - gloves / boots / chest gear
  - better rifle pose
  - better party panel avatars
- Existing gameplay and lobby systems from V54 remain in place.

## Files to upload to GitHub / Render
Upload and replace these files:
- `package.json`
- `server.js`
- `render.yaml`
- `public/index.html`
- `public/style.css`
- `public/client.js`

## After uploading
1. Push / upload the changed files to your repo.
2. Let Render redeploy.
3. Open the site and press **Ctrl + F5**.
4. You should now see:
   - a **TRIOS** mode option
   - better-looking lobby characters

## Testing Trios
### Trios No Fill
- 1 to 3 real players can start
- bots fill the rest of the match

### Trios Fill
- set mode to **Trios**
- set fill to **Fill**
- click **Find Match**
- the server searches for up to **2 real teammates**

## Note
The player visuals are still browser-rendered HTML/CSS characters, not imported 3D game models, but they are much cleaner and more polished than the old placeholder look.
