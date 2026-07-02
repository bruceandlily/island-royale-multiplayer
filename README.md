# Island Royale Multiplayer V40 Balance + Smart AI

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
