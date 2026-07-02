# Island Royale Multiplayer V37 Gameplay Upgrade

This version keeps the lobby concept from V36 and focuses on gameplay.

Gameplay added:
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
