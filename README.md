# Island Royale Multiplayer V53 Chat Load Order Fixed

This version keeps the lobby concept from V36 and focuses on gameplay.

V38 changes:
- Solo / Duos / Squads now changes match rules
- Duos and Squads assign teams
- Friends in the same room become teammates
- Friendly fire is disabled
- Win condition is last team alive in Duos/Squads
- Quick Test lets you start immediately without manually creating a room

Gameplay included:
- Battle bus phase
- Player drop/glider phase
- Bots fill the match
- Bigger island
- Towns, buildings, roads, trees, rocks
- Chests
- Ground loot
- Weapon inventory
- Pistol, SMG, rifle, shotgun, sniper
- Ammo types
- Reload-by-firing when mag is empty
- Health and shield items
- Materials
- Harvesting trees/rocks
- Building walls/ramps
- Storm damage and shrinking zone
- Minimap
- Kill feed
- Damage numbers
- Server-side shooting and hit checks
- Bot AI movement, shooting, looting, healing, storm rotation

## Update Render

Upload/replace:

```text
package.json
server.js
render.yaml
public/index.html
public/client.js
public/style.css
```

Then commit to GitHub. Render should redeploy automatically.

If not, in Render click:

```text
Manual Deploy → Deploy latest commit
```

## Controls

```text
WASD = move / glide
Mouse = aim
Left click = shoot / place build
Space = jump from bus / open glider
E = chest / pickup
B = build mode
X = switch wall/ramp
Q = switch material
H = harvest nearby tree/rock
1-5 = weapon slots
5 = medkit
6 = shield item
Esc = show lobby overlay
```


## Quick Test

You do not have to create a room just to test anymore.

1. Open Settings
2. Pick Solo, Duos, or Squads
3. Click Save
4. Go to Play
5. Click Quick Test

It automatically creates a temporary room and starts the match with bots.

## Mode Rules

Solo:
- Everyone is against everyone.

Duos:
- Real players in your room are on your party team.
- Bots are split into teams of 2.
- Friendly fire is disabled.
- Last team alive wins.

Squads:
- Real players in your room are on your party team.
- Bots are split into teams of 4.
- Friendly fire is disabled.
- Last team alive wins.


## V39 Auto Lobby Change

When you die:
1. The game shows `You are eliminated`
2. It shows `Returning to lobby...`
3. After about 2.6 seconds, it automatically brings you back to the lobby

You do not have to press Esc after dying anymore.


## V40 Balance / AI / Animation Changes

Fixed:
- Player movement is much slower and easier to control
- Added a real walking animation for players and bots
- Dead bots no longer stay on the map as faded/invisible bodies
- Bots now disappear shortly after dying
- Gun damage is reduced a lot so bots do not delete you instantly
- Headshot multiplier is lower
- Bot aim is less perfect
- Bots are smarter with looting, chests, storm rotation, healing, distance control, and occasional defensive builds
- Bots move smarter, but are less unfair


## V41 Drop Movement Fix

Fixed:
- Jumping from the Battle Bus now immediately puts you into a controllable drop
- WASD works while falling
- Holding Space opens the glider
- Drop/glider steering is faster than walking so it actually feels controllable
- Camera follows your drop immediately instead of feeling stuck at the bus
- Ground walking speed is still slow/balanced from V40


## V42 Build Bullet Blocking

Fixed:
- Players cannot shoot through builds
- Bots cannot shoot through builds
- Walls and ramps block bullets on the server
- The closest build blocks the shot before a player can be hit
- Builds take damage when they block bullets
- Builds can be destroyed by repeated shots
- This works with rotated wall/ramp placement, not just straight boxes


## V43 Lobby Redesign

This update changes the lobby layout to match the classic battle royale lobby reference much more closely.

Changed:
- Big top navigation bar
- LOBBY / BATTLE PASS / CHALLENGES / LOCKER / ITEM SHOP / PROFILE / LEADERBOARDS / STORE tabs
- Left Season panel
- Level banner
- Battle Pass reward bars
- Daily challenge list
- Center party stage
- Player standing on a glowing platform
- Extra party slot and invite slot
- Right game mode panel
- Yellow READY / QUICK TEST styling
- Room code panel
- Bottom party chat bar

Gameplay from V42 is kept.


## V44 Fix

Fixed the V43 lobby buttons:
- Create Room works again
- Quick Test works again
- Added the missing player name input back into the classic lobby
- Added safety code so the buttons do not break if the name field is missing


## V45 Functional Lobby

This version fixes the fake lobby elements.

Changed:
- The fake teammate on the lobby stage is removed
- Real players now show on the lobby stage when they join your room
- Party slots update based on the real room player count
- Plus/invite slots now copy your real invite link when you have a room
- Battle Pass tab now uses your actual local progress
- Item Shop tab now actually equips outfits/colors
- Profile tab now shows real local/player stats
- Leaderboards tab now shows real current room/match players sorted by kills
- Lobby stage updates player names, ready status, cosmetics, and party count
- Existing gameplay from V42/V44 is kept


## V46 Mode Lock

This fixes mode/player-count rules.

Rules:
- Solo requires exactly 1 real player
- Duos requires exactly 2 real players
- Squads requires exactly 4 real players

Examples:
- If you are alone and select Duos/Squads, Quick Test will not start
- If 2 people are in the room but mode is Solo, the match will not start
- If 4 people are in the room but mode is Duos, the match will not start
- If 4 people are in the room and mode is Squads, the match starts
- Bots still fill the actual match after the real player count is correct


## V47 Ready + Mode Lock Fix

This fixes the issue where a friend could still start the wrong mode.

Server-enforced rules:
- Solo requires exactly 1 real player
- Duos requires exactly 2 real players
- Squads requires exactly 4 real players
- Normal room starts require every real player to be ready
- Host must be ready too
- Friends must be ready too
- Quick Test still works only when you are alone in Solo

Examples:
- 2 players in Solo will not start
- 2 players in Squads will not start
- 4 players in Duos will not start
- 2 players in Duos still will not start unless both are ready
- 4 players in Squads still will not start unless all 4 are ready


## V48 Mode Picker Fix

Fixed:
- Solo / Duos / Squads dropdown no longer gets stuck
- Added big SOLO / DUOS / SQUADS buttons under the dropdown
- Mode changes save immediately
- If you are in a room, only the host can change the mode
- The mode no longer snaps back because of server room updates
- The mode title updates instantly
- Mode lock from V47 still works


## V49 Real Leveling + Battle Pass

Fixed:
- Level is no longer fake/hard-coded at 18
- XP is saved in browser localStorage
- Playing matches gives XP
- Eliminations give XP
- Winning gives bonus XP
- Your level updates automatically
- XP bar updates automatically
- Battle Pass tier equals your real level progress
- Battle Pass tiers unlock as you level up
- Profile tab shows real level, XP, tier, wins, matches, and eliminations

XP rewards:
- Match played: 120 XP
- Each elimination: 140 XP
- Survival bonus: 50 XP
- Victory bonus: 500 XP

Battle Pass:
- 1 level = 1 Battle Pass tier
- Max displayed system supports 50 tiers


## V50 Party Chat

Added real party chat:
- Press `/` to open chat
- Type your message
- Press `Enter` to send
- Press `Esc` to close
- Click SEND also works
- Only players in the same room/party see the messages
- Chat works in the lobby and while in-game
- Bots cannot send chat
- Messages are limited to 140 characters


## V51 Chat Fix

Fixed party chat not opening:
- Chat is open by default now
- You can click the chat box
- You can click the input directly
- `/` still opens chat
- `T` also opens chat as a backup
- Enter sends
- Esc closes/minimizes
- Header can be clicked to reopen it
- Only players in the same room/party see the messages


## V52 Chat Actually Fixed

Fixed:
- SEND button now has a direct backup click handler
- Minimize button now works
- Chat starts minimized so it does not block Daily Challenges
- Chat moved lower on screen
- Click PARTY CHAT to open it
- Press `/` or `T` to open it
- Enter sends
- Esc minimizes
- If you are not in a room, it now shows a clear message instead of doing nothing
- Messages still only go to players in your room/party


## V53 Chat Load Order Fix

This fixes the real cause of the chat bug:
- The chat HTML was loading after client.js
- client.js could not find the SEND/minimize/input elements
- Now the chat HTML loads before client.js
- The chat code also grabs elements safely/lazily
- SEND works
- Minimize works
- `/` and `T` open chat
- Enter sends
- Esc minimizes
- Chat stays room/party-only
