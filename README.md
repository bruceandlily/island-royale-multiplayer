# Island Royale Multiplayer V34

This is a real multiplayer browser-game starter using:

- HTML/CSS/JavaScript client
- Node.js server
- Socket.io real-time multiplayer
- Room codes
- Invite links
- Lobby player list
- Ready button
- Host Start Match
- Real-time movement
- Server-checked shooting
- Health, shield, kills
- Storm circle
- Match winner

## Install

You need Node.js installed.

In this folder, run:

```bash
npm install
```

## Start Server

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

## Test On Your Own Computer

1. Open `http://localhost:3000`
2. Type your name
3. Click **Create Room**
4. Click **Copy Invite**
5. Open a second browser tab
6. Paste the invite link
7. Type another name
8. Click **Join**
9. In the first tab, click **Start Match**

## Controls

```text
WASD = move
Mouse = aim
Left click = shoot
Esc = show lobby overlay
```

## Playing With Real Friends

Your friends cannot join `localhost` because localhost means your computer only.

To let friends join, host this project online using something like:

- Render
- Railway
- Replit
- Glitch
- Fly.io
- your own VPS

After hosting, share the public website link or the copied room invite link.

## Important

This is a multiplayer starter. It is not secure enough for a commercial game yet.
For a serious game, the server needs stronger anti-cheat, server-side movement validation,
better prediction, lag compensation, authentication, and real matchmaking.
