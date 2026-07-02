# Island Royale Multiplayer V67 — No Fill Enemy Matchmaking

This fixes No Fill behavior.

## What No Fill means now
No Fill means:
- you do **not** get random teammates
- your party/team stays by itself
- the server still searches for real enemy players/teams
- bots fill the rest to 100

## Solo No Fill
- Searches for other real Solo players as enemies
- Bots fill the rest to 100

## Duos No Fill
- If you are alone, you can solo-duo
- If your friend is invited, both of you stay on the same team
- Other Duos players/parties can join as enemy teams
- Bots fill the rest to 100

Example:
- You are solo in Duos No Fill
- Another real team of 2 is searching Duos
- Match can become: you vs 2 real teammates vs 97 bots

## Trios No Fill
- Your party stays alone
- Other Trios players/parties can join as enemy teams
- Bots fill to 100

## Squads No Fill
- Your party stays alone
- Other Squads players/parties can join as enemy teams
- Bots fill to 100

## Fill still works
Fill still means:
- tries to find real teammates for your team
- also searches for real enemy teams
- bots fill the rest to 100

## Upload these files
Replace these in GitHub:
- `package.json`
- `server.js`
- `render.yaml`
- `public/index.html`
- `public/client.js`
- `public/style.css`

Then wait for Render and press **Ctrl + F5**.
