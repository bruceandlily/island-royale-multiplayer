# Island Royale Multiplayer V68 — Match Info Counter

This adds a match info counter for every mode.

## Shows
- Real players
- Bots
- Total players
- Teams
- Team size
- Mode
- Fill / No Fill

## Works for
- Solo
- Duos
- Trios
- Squads
- Fill
- No Fill

## Examples
### Solo
- 100 players = 100 teams of 1

### Duos
- 100 players = 50 teams of 2

### Trios
- 100 players = 34 team slots of 3
- The last slot may not be full because 100 does not divide evenly by 3

### Squads
- 100 players = 25 teams of 4

## Where it shows
- In the lobby
- In the in-game HUD
- Updates after real players/bots are added

## Upload these files
Replace these in GitHub:
- `package.json`
- `server.js`
- `render.yaml`
- `public/index.html`
- `public/client.js`
- `public/style.css`

Then wait for Render and press **Ctrl + F5**.
