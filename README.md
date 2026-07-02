# Island Royale Multiplayer V62 — Audio Update

This version adds browser-generated audio.

## New Audio
- Quiet lobby background music
- Different small music patterns for emotes
- Hover sound effect for buttons / UI
- Click sound effect for buttons / UI
- Audio ON/OFF button

## Notes
- Browser audio starts after your first click or key press because browsers block autoplay.
- No extra audio files are needed.
- Sounds are made with Web Audio API inside the browser.
- Lobby music only plays in the lobby and stays quiet.

## Upload these files
Replace these in GitHub:
- `package.json`
- `server.js`
- `render.yaml`
- `public/index.html`
- `public/client.js`
- `public/style.css`

Then wait for Render and press **Ctrl + F5**.
