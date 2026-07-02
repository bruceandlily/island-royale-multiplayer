# Island Royale Multiplayer V64 — 100 Player Matches

Every match now targets **100 total players**.

## How it works
- Real players are added first
- Bots fill every missing slot
- 1 real player = 99 bots
- 2 real players = 98 bots
- 10 real players = 90 bots

## Solo
- Real solo players can match as enemies
- Bots fill the rest to 100

## Duos
- No Fill: 1 or 2 real players can start
- Fill: tries to find real teammates first
- If it cannot find them, bots fill the match to 100
- Example: 2 real teammates = 98 bots

## Trios
- No Fill: 1, 2, or 3 real players can start
- Fill: tries to find real teammates first
- Bots fill the rest to 100

## Squads
- No Fill: 1 to 4 real players can start
- Fill: tries to find real teammates first
- Bots fill the rest to 100

## Upload these files
Replace these in GitHub:
- `package.json`
- `server.js`
- `render.yaml`
- `public/index.html`
- `public/client.js`
- `public/style.css`

Then wait for Render and press **Ctrl + F5**.
