# Island Royale Multiplayer V36

This is the new host-ready multiplayer version with a cleaner, functional lobby.

New lobby features:
- Functional top tabs: Play, Party, Rooms, Locker, Quests, Settings
- Create room
- Join by room code
- Browse open rooms
- Copy invite link
- Ready/unready
- Host start match
- Change mode as host
- Locker cosmetics that sync to room
- Quests saved in browser
- Settings saved in browser
- Cleaner Fortnite-style layout

## Host on Render

Use the same setup as before.

Build Command:

```bash
npm install
```

Start Command:

```bash
npm start
```

## Updating your existing Render game

Upload/replace these files in your GitHub repo:

```text
package.json
server.js
render.yaml
public/index.html
public/client.js
public/style.css
```

Then commit changes. Render should redeploy automatically.

If it does not, go to Render and click:

```text
Manual Deploy → Deploy latest commit
```
