
function sanitizeChatMessage(text) {
  return String(text || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, "public")));

const WORLD = { width: 5200, height: 5200 };
const TICK_RATE = 20;
const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const rooms = new Map();
const matchmakingQueue = new Set();
const MATCH_TARGET_PLAYERS = 100;
const MATCHMAKING_SEARCH_MS = 7000;

const COLOR_PRESETS = ["#2fb4ff", "#ff5b67", "#55d66b", "#b65cff", "#ffcf4a", "#ff7a00", "#00e5ff", "#8dff55"];

const WEAPONS = {
  pistol:  { name: "Pistol",  rarity: "common",    damage: 12, fireMs: 260, range: 610, spread: 0.045, mag: 12, ammoType: "light",  pellets: 1 },
  smg:     { name: "SMG",     rarity: "uncommon",  damage: 8,  fireMs: 110, range: 480, spread: 0.090, mag: 28, ammoType: "light",  pellets: 1 },
  rifle:   { name: "Rifle",   rarity: "rare",      damage: 16, fireMs: 175, range: 760, spread: 0.038, mag: 30, ammoType: "medium", pellets: 1 },
  shotgun: { name: "Shotgun", rarity: "rare",      damage: 7,  fireMs: 880, range: 300, spread: 0.22,  mag: 6,  ammoType: "shells", pellets: 7 },
  sniper:  { name: "Sniper",  rarity: "epic",      damage: 42, fireMs: 1250,range: 1120,spread: 0.018, mag: 4,  ammoType: "heavy",  pellets: 1 }
};

const ITEM_POOL = [
  { type: "weapon", weapon: "pistol", weight: 18 },
  { type: "weapon", weapon: "smg", weight: 13 },
  { type: "weapon", weapon: "rifle", weight: 15 },
  { type: "weapon", weapon: "shotgun", weight: 10 },
  { type: "weapon", weapon: "sniper", weight: 5 },
  { type: "ammo", ammoType: "light", amount: 30, weight: 16 },
  { type: "ammo", ammoType: "medium", amount: 30, weight: 16 },
  { type: "ammo", ammoType: "shells", amount: 10, weight: 9 },
  { type: "ammo", ammoType: "heavy", amount: 6, weight: 5 },
  { type: "heal", item: "medkit", amount: 35, weight: 8 },
  { type: "shield", item: "mini", amount: 25, weight: 10 },
  { type: "material", material: "wood", amount: 60, weight: 12 },
  { type: "material", material: "brick", amount: 40, weight: 8 },
  { type: "material", material: "metal", amount: 25, weight: 6 }
];

const BOT_NAMES = ["StormAI", "ZeroBot", "LuckyAI", "RapidBot", "BlueBot", "SweatBot", "BuildBot", "ShadowAI", "RiftAI", "KnightBot", "ZoneAI", "LootBot"];

function randomRoomCode() {
  let code = "";
  for (let i = 0; i < 4; i++) code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  return rooms.has(code) ? randomRoomCode() : code;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function dist(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function randint(min, max) {
  return Math.floor(rand(min, max + 1));
}

function sanitizeName(name) {
  if (typeof name !== "string") return "Player";
  const cleaned = name.replace(/[^\w\s-]/g, "").trim().slice(0, 18);
  return cleaned || "Player";
}

function sanitizeColor(color) {
  if (typeof color !== "string") return COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)];
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  return COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)];
}

function sanitizeOutfit(outfit) {
  if (typeof outfit !== "string") return "Raider";
  return outfit.replace(/[^\w\s-]/g, "").trim().slice(0, 16) || "Raider";
}

function chooseWeighted(pool = ITEM_POOL) {
  const total = pool.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of pool) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return pool[0];
}

function itemFromPool(x, y) {
  const item = { ...chooseWeighted(), id: makeId("loot"), x, y };
  if (item.type === "weapon") {
    item.ammoInMag = WEAPONS[item.weapon].mag;
  }
  return item;
}

function makeId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

function createDefaultInventory() {
  return {
    slots: [
      createWeaponInstance("pistol"),
      null,
      null,
      null,
      null
    ],
    selected: 0,
    ammo: { light: 48, medium: 30, shells: 8, heavy: 4 },
    materials: { wood: 120, brick: 60, metal: 30 },
    heals: { medkit: 1, mini: 2 }
  };
}

function createWeaponInstance(type) {
  const base = WEAPONS[type] || WEAPONS.pistol;
  return {
    id: makeId("wep"),
    type,
    name: base.name,
    rarity: base.rarity,
    ammoInMag: base.mag,
    mag: base.mag,
    ammoType: base.ammoType
  };
}

function publicWeapon(weapon) {
  if (!weapon) return null;
  return {
    id: weapon.id,
    type: weapon.type,
    name: weapon.name,
    rarity: weapon.rarity,
    ammoInMag: weapon.ammoInMag,
    mag: weapon.mag,
    ammoType: weapon.ammoType
  };
}

function publicInventory(inv) {
  return {
    slots: inv.slots.map(publicWeapon),
    selected: inv.selected,
    ammo: inv.ammo,
    materials: inv.materials,
    heals: inv.heals
  };
}


function normalizeMode(mode) {
  if (mode === "Squads") return "Squads";
  if (mode === "Trios") return "Trios";
  if (mode === "Duos") return "Duos";
  return "Solo";
}

function modeTeamSize(mode) {
  if (mode === "Squads") return 4;
  if (mode === "Trios") return 3;
  if (mode === "Duos") return 2;
  return 1;
}

function modeRequiredPlayers(mode) {
  if (mode === "Squads") return 4;
  if (mode === "Trios") return 3;
  if (mode === "Duos") return 2;
  return 1;
}

function humanPlayers(room) {
  return Array.from(room.players.values()).filter(p => !p.isBot);
}

function validateModePlayerCount(room) {
  const mode = room.mode || "Solo";
  const teamSize = modeTeamSize(mode);
  const humans = humanPlayers(room).length;

  if (mode === "Solo") {
    if (humans < 1 || humans > MATCH_TARGET_PLAYERS) {
      return { ok: false, message: `Solo needs 1 to ${MATCH_TARGET_PLAYERS} real player(s). You have ${humans}.` };
    }
    return { ok: true };
  }

  if (humans < 1 || humans > teamSize) {
    return {
      ok: false,
      message: `${mode} allows 1 to ${teamSize} real player(s) in your party. Bots fill the rest to 100. You have ${humans}.`
    };
  }

  return { ok: true };
}

function validateReadyPlayers(room) {
  const humans = humanPlayers(room);
  const notReady = humans.filter(p => !p.ready);

  if (notReady.length > 0) {
    return {
      ok: false,
      message: `Everyone must ready up first. Not ready: ${notReady.map(p => p.name).join(", ")}`
    };
  }

  return { ok: true };
}

function markHumansReady(room) {
  for (const player of humanPlayers(room)) player.ready = true;
}

function getAliveTeamIds(room) {
  const teams = new Set();
  for (const player of room.players.values()) {
    if (player.alive && player.phase !== "dead") teams.add(player.teamId || player.id);
  }
  return teams;
}

function isSameTeam(a, b) {
  return a && b && a.teamId && b.teamId && a.teamId === b.teamId;
}

function assignTeams(room) {
  const teamSize = modeTeamSize(room.mode || "Solo");
  const humans = Array.from(room.players.values()).filter(p => !p.isBot);
  const bots = Array.from(room.players.values()).filter(p => p.isBot);

  if (room.mode === "Solo") {
    for (const p of room.players.values()) {
      p.teamId = p.id;
      p.teamIndex = 1;
      p.teamSize = 1;
    }
    return;
  }

  const partyGroups = new Map();
  for (const p of humans) {
    const partyId = p.partyId || p.roomCode || p.id;
    p.partyId = partyId;
    if (!partyGroups.has(partyId)) partyGroups.set(partyId, []);
    partyGroups.get(partyId).push(p);
  }

  let teamNumber = 1;
  for (const [partyId, players] of partyGroups.entries()) {
    const teamId = `team_real_${teamNumber}`;
    players.forEach((p, idx) => {
      p.teamId = teamId;
      p.teamIndex = idx + 1;
      p.teamSize = teamSize;
    });
    teamNumber++;
  }

  bots.forEach((p, idx) => {
    const botTeamNumber = Math.floor(idx / teamSize) + teamNumber;
    p.teamId = `team_${botTeamNumber}`;
    p.teamIndex = (idx % teamSize) + 1;
    p.teamSize = teamSize;
    p.partyId = p.teamId;
  });
}

function targetTotalPlayersForMode(mode, humanCount) {
  return MATCH_TARGET_PLAYERS;
}

function createPlayer(socket, data = {}) {
  return {
    id: socket.id,
    name: sanitizeName(data.name),
    x: WORLD.width / 2,
    y: WORLD.height / 2,
    angle: 0,
    health: 100,
    shield: 50,
    alive: true,
    deathTime: 0,
    kills: 0,
    ready: false,
    color: sanitizeColor(data.color),
    outfit: sanitizeOutfit(data.outfit),
    banner: data.banner === "Gold" ? "Gold" : data.banner === "Purple" ? "Purple" : "Blue",
    lastShotAt: 0,
    lastInteractAt: 0,
    lastBuildAt: 0,
    lastHealAt: 0,
    roomCode: null,
    isBot: false,
    partyId: null,
    teamId: null,
    teamIndex: 1,
    teamSize: 1,
    inventory: createDefaultInventory(),
    phase: "lobby",
    dropHeight: 0,
    gliderOpen: false
  };
}

function createBot(index) {
  const player = {
    id: `bot_${index}_${Math.random().toString(36).slice(2, 7)}`,
    name: BOT_NAMES[index % BOT_NAMES.length],
    x: rand(600, WORLD.width - 600),
    y: rand(600, WORLD.height - 600),
    angle: rand(-Math.PI, Math.PI),
    health: 100,
    shield: randint(0, 50),
    alive: true,
    deathTime: 0,
    kills: 0,
    ready: true,
    color: COLOR_PRESETS[index % COLOR_PRESETS.length],
    outfit: "Bot",
    banner: "Blue",
    lastShotAt: 0,
    lastInteractAt: 0,
    lastBuildAt: 0,
    lastHealAt: 0,
    isBot: true,
    partyId: null,
    teamId: null,
    teamIndex: 1,
    teamSize: 1,
    inventory: createDefaultInventory(),
    phase: "ground",
    dropHeight: 0,
    gliderOpen: false,
    ai: {
      targetId: null,
      nextDecision: 0,
      moveX: 0,
      moveY: 0,
      lootId: null,
      bravery: rand(0.4, 1.0)
    }
  };
  const better = ["rifle", "smg", "shotgun", "sniper"][index % 4];
  botGiveWeapon(player, better);
  return player;
}

function botGiveWeapon(bot, type) {
  const weapon = createWeaponInstance(type);
  bot.inventory.slots[1] = weapon;
  bot.inventory.selected = 1;
  bot.inventory.ammo[weapon.ammoType] += weapon.mag * 2;
}

function publicPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    x: player.x,
    y: player.y,
    angle: player.angle,
    health: player.health,
    shield: player.shield,
    alive: player.alive,
    deathTime: player.deathTime || 0,
    kills: player.kills,
    ready: player.ready,
    color: player.color,
    outfit: player.outfit,
    banner: player.banner,
    isBot: player.isBot,
    partyId: player.partyId || null,
    teamId: player.teamId,
    teamIndex: player.teamIndex,
    teamSize: player.teamSize,
    inventory: publicInventory(player.inventory),
    phase: player.phase,
    dropHeight: player.dropHeight,
    gliderOpen: player.gliderOpen
  };
}


function matchTeamSize(mode) {
  return modeTeamSize(mode || "Solo");
}

function publicMatchStats(room) {
  const players = Array.from(room.players.values());
  const realPlayers = players.filter(p => !p.isBot).length;
  const bots = players.filter(p => p.isBot).length;
  const total = players.length;
  const mode = room.mode || "Solo";
  const teamSize = matchTeamSize(mode);
  const expectedTotal = MATCH_TARGET_PLAYERS || 100;

  const teamIds = new Set(players.map(p => p.teamId || p.id));
  const actualTeams = teamIds.size || Math.ceil((total || expectedTotal) / teamSize);
  const expectedTeams = Math.ceil(expectedTotal / teamSize);

  return {
    mode,
    fill: !!room.fill,
    realPlayers,
    bots,
    totalPlayers: total,
    expectedTotal,
    teamSize,
    actualTeams,
    expectedTeams,
    teamLabel: mode === "Solo" ? "teams of 1" : `teams of ${teamSize}`
  };
}


function publicBuild(build) {
  return {
    id: build.id,
    x: build.x,
    y: build.y,
    angle: build.angle,
    type: build.type,
    material: build.material,
    hp: build.hp,
    maxHp: build.maxHp,
    ownerId: build.ownerId
  };
}

function publicRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    matchPhase: room.matchPhase,
    world: WORLD,
    storm: room.storm,
    bus: room.bus,
    players: Array.from(room.players.values()).map(publicPlayer),
    matchStats: publicMatchStats(room),
    startedAt: room.startedAt,
    winner: room.winner,
    mode: room.mode || "Solo",
    fill: !!room.fill,
    matchStats: publicMatchStats(room),
    matchmakingQueued: !!room.matchmakingQueued,
    matchmakingMessage: room.matchmakingMessage || "",
    maxPlayers: room.maxPlayers || MATCH_TARGET_PLAYERS,
    requiredPlayers: modeRequiredPlayers(room.mode || "Solo"),
    loot: room.loot,
    chests: room.chests,
    builds: room.builds.map(publicBuild),
    trees: room.trees,
    rocks: room.rocks,
    buildings: room.buildings,
    feed: room.feed.slice(-6)
  };
}

function publicRoomList() {
  return Array.from(rooms.values()).map(room => ({
    code: room.code,
    hostName: room.players.get(room.hostId)?.name || "Host",
    players: Array.from(room.players.values()).filter(p => !p.isBot).length,
    maxPlayers: room.maxPlayers || MATCH_TARGET_PLAYERS,
    requiredPlayers: modeRequiredPlayers(room.mode || "Solo"),
    phase: room.phase,
    mode: room.mode || "Solo",
    fill: !!room.fill,
    matchmakingQueued: !!room.matchmakingQueued,
    matchmakingMessage: room.matchmakingMessage || ""
  }));
}

function createWorldObjects(room) {
  room.trees = [];
  room.rocks = [];
  room.buildings = [];
  room.chests = [];
  room.loot = [];
  room.builds = [];

  const towns = [
    { name: "Green Grove", x: 900, y: 1050 },
    { name: "Dusty Docks", x: 3850, y: 980 },
    { name: "Tilted Tiny", x: 2600, y: 2500 },
    { name: "Retail Ridge", x: 1200, y: 3800 },
    { name: "Lake Labs", x: 3900, y: 3600 }
  ];
  room.towns = towns;

  for (const town of towns) {
    for (let i = 0; i < 9; i++) {
      const bx = town.x + randint(-260, 260);
      const by = town.y + randint(-220, 220);
      const w = randint(80, 150);
      const h = randint(70, 130);
      room.buildings.push({ id: makeId("house"), x: bx, y: by, w, h });
      if (Math.random() < 0.8) room.chests.push({ id: makeId("chest"), x: bx + w / 2, y: by + h / 2, opened: false });
    }
  }

  for (let i = 0; i < 135; i++) {
    room.trees.push({
      id: makeId("tree"),
      x: randint(160, WORLD.width - 160),
      y: randint(160, WORLD.height - 160),
      hp: 65,
      material: "wood",
      amount: 22
    });
  }

  for (let i = 0; i < 50; i++) {
    room.rocks.push({
      id: makeId("rock"),
      x: randint(200, WORLD.width - 200),
      y: randint(200, WORLD.height - 200),
      hp: 90,
      material: "brick",
      amount: 26
    });
  }

  for (let i = 0; i < 65; i++) {
    room.loot.push(itemFromPool(randint(160, WORLD.width - 160), randint(160, WORLD.height - 160)));
  }
}


function removeFromMatchmaking(roomOrCode) {
  const code = typeof roomOrCode === "string" ? roomOrCode : roomOrCode?.code;
  if (!code) return;
  matchmakingQueue.delete(code);
  const room = rooms.get(code);
  if (room) {
    room.matchmakingQueued = false;
    room.matchmakingMessage = "";
    if (room.matchmakingTimer) {
      clearTimeout(room.matchmakingTimer);
      room.matchmakingTimer = null;
    }
  }
}

function partyIds(room) {
  return [...new Set(humanPlayers(room).map(p => p.partyId || p.roomCode || p.id))];
}

function partySize(room, partyId) {
  return humanPlayers(room).filter(p => (p.partyId || p.roomCode || p.id) === partyId).length;
}

function humanCount(room) {
  return humanPlayers(room).length;
}

function moveHumansToRoom(source, target, options = {}) {
  const samePartyId = options.samePartyId || null;
  const moving = humanPlayers(source);

  for (const player of moving) {
    source.players.delete(player.id);
    player.roomCode = target.code;
    if (samePartyId) player.partyId = samePartyId;
    else player.partyId = player.partyId || source.code;
    player.ready = true;
    target.players.set(player.id, player);

    const s = io.sockets.sockets.get(player.id);
    if (s) {
      s.leave(source.code);
      s.join(target.code);
      s.data.roomCode = target.code;
    }
  }

  removeFromMatchmaking(source);
  rooms.delete(source.code);
}

function findQueuedRoom(mode, predicate) {
  for (const code of Array.from(matchmakingQueue)) {
    const room = rooms.get(code);
    if (!room || room.phase !== "lobby" || room.mode !== mode) {
      matchmakingQueue.delete(code);
      continue;
    }
    if (predicate(room)) return room;
  }
  return null;
}


function mergeQueuedRealOpponentsBeforeStart(room) {
  // Before starting, pull in any queued real players/parties in the same mode as enemies.
  // This is important for Solo Fill, because every real solo player should become an enemy
  // inside the same 100-player match instead of instantly starting separate 99-bot matches.
  const mode = room.mode || "Solo";

  for (const code of Array.from(matchmakingQueue)) {
    const other = rooms.get(code);
    if (!other || other.code === room.code) continue;
    if (other.phase !== "lobby" || other.mode !== mode) continue;
    if (humanCount(room) + humanCount(other) > MATCH_TARGET_PLAYERS) continue;

    // For Fill team modes, don't steal unfinished teammate-searching parties as enemies.
    if (mode !== "Solo" && other.fill && partySize(other, other.code) < modeTeamSize(mode)) continue;

    moveHumansToRoom(other, room);
  }
}

function startMatchmadeRoom(room, reason = "Matchmaking found a match") {
  mergeQueuedRealOpponentsBeforeStart(room);
  removeFromMatchmaking(room);
  markHumansReady(room);
  addFeed(room, reason);
  resetRoomForMatch(room);
  io.to(room.code).emit("matchStarted", publicRoom(room));
  broadcastRoom(room);
}

function queueRoomForMatchmaking(room, message, timeoutMs = 0) {
  room.matchmakingQueued = true;
  room.matchmakingMessage = message;
  matchmakingQueue.add(room.code);
  addFeed(room, message);
  broadcastRoom(room);

  if (timeoutMs > 0) {
    if (room.matchmakingTimer) clearTimeout(room.matchmakingTimer);
    room.matchmakingTimer = setTimeout(() => {
      const fresh = rooms.get(room.code);
      if (!fresh || fresh.phase !== "lobby" || !fresh.matchmakingQueued) return;
      startMatchmadeRoom(fresh, "Starting 100-player match, bots filled missing players");
    }, timeoutMs);
  }
}

function tryFillTeam(room) {
  const mode = room.mode || "Solo";
  const teamSize = modeTeamSize(mode);
  if (mode === "Solo" || !room.fill) return true;

  const mainPartyId = room.code;
  for (const p of humanPlayers(room)) {
    if (!p.partyId) p.partyId = mainPartyId;
  }

  let currentSize = partySize(room, mainPartyId);

  while (currentSize < teamSize) {
    const candidate = findQueuedRoom(mode, other => {
      if (other.code === room.code || !other.fill) return false;
      const otherHumans = humanCount(other);
      return otherHumans > 0 && currentSize + otherHumans <= teamSize;
    });

    if (!candidate) break;

    moveHumansToRoom(candidate, room, { samePartyId: mainPartyId });
    currentSize = partySize(room, mainPartyId);
  }

  return currentSize >= teamSize;
}

function mergeQueuedOpponents(room) {
  const mode = room.mode || "Solo";
  const teamSize = modeTeamSize(mode);

  for (const code of Array.from(matchmakingQueue)) {
    const other = rooms.get(code);
    if (!other || other.code === room.code || other.phase !== "lobby" || other.mode !== mode) continue;

    // Do not pull an unfinished Fill team as enemies.
    if (other.fill && mode !== "Solo" && partySize(other, other.code) < teamSize) continue;

    if (humanCount(room) + humanCount(other) > (room.maxPlayers || 16)) continue;

    moveHumansToRoom(other, room);
  }
}

function requestMatchmaking(socket, data = {}, callback) {
  let room = rooms.get(socket.data.roomCode);
  const mode = normalizeMode(data.mode);
  const fill = !!data.fill;

  try {
    if (!room) {
      room = createRoom(socket, { ...data, mode, fill });
      const player = room.players.get(socket.id);
      if (player) player.ready = true;
    } else {
      if (room.hostId !== socket.id) return callback?.({ ok: false, error: "Only host can start matchmaking" });
      if (room.phase !== "lobby") return callback?.({ ok: false, error: "Match already started" });
      room.mode = mode;
      room.fill = fill;

      const modeCheck = validateModePlayerCount(room);
      if (!modeCheck.ok) return callback?.({ ok: false, error: modeCheck.message });

      const readyCheck = validateReadyPlayers(room);
      if (!readyCheck.ok) return callback?.({ ok: false, error: readyCheck.message });
    }

    removeFromMatchmaking(room);

    const teamSize = modeTeamSize(mode);

    if (mode === "Solo") {
      // Solo Fill waits to find other real solo players as enemies.
      // Solo No Fill starts faster but still gives a short enemy-search window.
      queueRoomForMatchmaking(
        room,
        fill
          ? `Solo Fill: searching for real solo players, then bots fill to 100...`
          : `Solo No Fill: searching for real solo enemies, then bots fill to 100...`,
        MATCHMAKING_SEARCH_MS
      );
      return callback?.({ ok: true, queued: true, room: publicRoom(room), selfId: socket.id, message: room.matchmakingMessage });
    }

    if (fill && mode !== "Solo") {
      const fullTeam = tryFillTeam(room);
      if (!fullTeam) {
        queueRoomForMatchmaking(
          room,
          `${mode} Fill: searching for ${teamSize - partySize(room, room.code)} real teammate(s), then bots fill to 100...`,
          MATCHMAKING_SEARCH_MS
        );
        return callback?.({ ok: true, queued: true, room: publicRoom(room), selfId: socket.id, message: room.matchmakingMessage });
      }
    }

    mergeQueuedOpponents(room);

    if (!fill) {
      // No Fill waits a short moment so another real No Fill party can become an enemy team.
      queueRoomForMatchmaking(room, `${mode} No Fill: keeping your party alone, searching for real enemy teams, then bots fill to 100...`, MATCHMAKING_SEARCH_MS);
      return callback?.({ ok: true, queued: true, room: publicRoom(room), selfId: socket.id, message: room.matchmakingMessage });
    }

    // Fill team is already full. Still wait briefly so real enemy teams can join before bots fill.
    queueRoomForMatchmaking(room, `${mode} Fill team ready: searching for real enemies, then bots fill to 100...`, 3500);
    return callback?.({ ok: true, queued: true, room: publicRoom(room), selfId: socket.id, message: room.matchmakingMessage });
  } catch (error) {
    return callback?.({ ok: false, error: error.message });
  }
}


function createRoom(hostSocket, data = {}) {
  const code = randomRoomCode();
  const player = createPlayer(hostSocket, data);
  player.roomCode = code;
  player.partyId = code;

  const room = {
    code,
    hostId: hostSocket.id,
    phase: "lobby",
    matchPhase: "lobby",
    mode: normalizeMode(data.mode),
    fill: !!data.fill,
    matchmakingQueued: false,
    matchmakingMessage: "",
    maxPlayers: MATCH_TARGET_PLAYERS,
    players: new Map([[hostSocket.id, player]]),
    storm: {
      x: WORLD.width / 2,
      y: WORLD.height / 2,
      radius: 2200,
      damage: 1,
      phase: 1
    },
    bus: null,
    loot: [],
    chests: [],
    builds: [],
    trees: [],
    rocks: [],
    buildings: [],
    towns: [],
    startedAt: null,
    winner: null,
    feed: []
  };

  createWorldObjects(room);
  rooms.set(code, room);
  hostSocket.join(code);
  hostSocket.data.roomCode = code;
  return room;
}

function joinRoom(socket, code, data = {}) {
  const normalized = String(code || "").trim().toUpperCase();
  const room = rooms.get(normalized);
  if (!room) throw new Error("Room not found");
  if (room.phase !== "lobby") throw new Error("Match already started");
  if (Array.from(room.players.values()).filter(p => !p.isBot).length >= room.maxPlayers) throw new Error("Room is full");

  const player = createPlayer(socket, data);
  player.roomCode = normalized;
  player.partyId = normalized;
  room.players.set(socket.id, player);
  socket.join(normalized);
  socket.data.roomCode = normalized;
  return room;
}

function updatePlayerCosmetics(socket, data = {}) {
  const room = rooms.get(socket.data.roomCode);
  if (!room) return null;
  const player = room.players.get(socket.id);
  if (!player) return null;

  player.name = sanitizeName(data.name ?? player.name);
  player.color = sanitizeColor(data.color ?? player.color);
  player.outfit = sanitizeOutfit(data.outfit ?? player.outfit);
  player.banner = data.banner === "Gold" ? "Gold" : data.banner === "Purple" ? "Purple" : "Blue";
  return room;
}


function ensureBotFillToTarget(room) {
  for (const [id, player] of Array.from(room.players.entries())) {
    if (player.isBot) room.players.delete(id);
  }

  const humans = Array.from(room.players.values()).filter(p => !p.isBot).length;
  const neededBots = Math.max(0, MATCH_TARGET_PLAYERS - humans);

  for (let i = 0; i < neededBots; i++) {
    const bot = createBot(room, i);
    room.players.set(bot.id, bot);
  }
}

function resetRoomForMatch(room) {
  room.phase = "game";
  room.matchPhase = "bus";
  room.startedAt = Date.now();
  room.winner = null;
  room.feed = [];
  createWorldObjects(room);

  room.storm = {
    x: WORLD.width / 2 + randint(-350, 350),
    y: WORLD.height / 2 + randint(-350, 350),
    radius: 2200,
    damage: 1,
    phase: 1
  };

  room.bus = {
    startX: 450,
    startY: randint(900, WORLD.height - 900),
    endX: WORLD.width - 450,
    endY: randint(900, WORLD.height - 900),
    t: 0,
    speed: 0.0022
  };

  for (const player of room.players.values()) {
    if (player.isBot) continue;
    player.health = 100;
    player.shield = 50;
    player.alive = true;
    player.deathTime = 0;
    player.kills = 0;
    player.ready = false;
    player.inventory = createDefaultInventory();
    player.phase = "bus";
    player.dropHeight = 0;
    player.gliderOpen = false;
    player.x = room.bus.startX;
    player.y = room.bus.startY;
    player.angle = Math.atan2(room.bus.endY - room.bus.startY, room.bus.endX - room.bus.startX);
  }

  const humanCount = Array.from(room.players.values()).filter(p => !p.isBot).length;
  const targetTotal = targetTotalPlayersForMode(room.mode || "Solo", humanCount);
  let botIndex = 0;
  for (const [id, p] of Array.from(room.players.entries())) {
    if (p.isBot) room.players.delete(id);
  }
  while (Array.from(room.players.values()).length < targetTotal) {
    const bot = createBot(botIndex++);
    bot.roomCode = room.code;
    room.players.set(bot.id, bot);
  }

  ensureBotFillToTarget(room);
  assignTeams(room);
  addFeed(room, `${room.mode || "Solo"} 100-player match starting`);
  addFeed(room, "Battle Bus launching");
}

function addFeed(room, text) {
  room.feed.push({ id: makeId("feed"), text, time: Date.now() });
  if (room.feed.length > 8) room.feed.shift();
}

function getBusPosition(room) {
  if (!room.bus) return { x: WORLD.width / 2, y: WORLD.height / 2 };
  const t = clamp(room.bus.t, 0, 1);
  return {
    x: room.bus.startX + (room.bus.endX - room.bus.startX) * t,
    y: room.bus.startY + (room.bus.endY - room.bus.startY) * t
  };
}

function startDrop(room, player) {
  if (!player.alive || player.phase !== "bus") return;
  const pos = getBusPosition(room);
  player.x = pos.x;
  player.y = pos.y;
  player.phase = "drop";
  player.dropHeight = 1650;
  player.gliderOpen = false;
  addFeed(room, `${player.name} jumped`);
}

function landPlayer(player) {
  player.phase = "ground";
  player.dropHeight = 0;
  player.gliderOpen = false;
}

function weaponInHand(player) {
  const slot = player.inventory.slots[player.inventory.selected] || player.inventory.slots.find(Boolean);
  if (slot) {
    player.inventory.selected = player.inventory.slots.indexOf(slot);
    return slot;
  }
  return null;
}

function linePointDistance(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay;
  const apx = px - ax, apy = py - ay;
  const abLen2 = abx * abx + aby * aby || 1;
  const t = clamp((apx * abx + apy * aby) / abLen2, 0, 1);
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
}

function rectLineHit(rect, ax, ay, bx, by) {
  const hit = segmentAabbHitDistance(rect, ax, ay, bx, by);
  return hit !== null;
}

function buildAsRect(build) {
  if (build.type === "ramp") return { x: build.x - 54, y: build.y - 48, w: 108, h: 96 };
  return { x: build.x - 64, y: build.y - 16, w: 128, h: 32 };
}

function buildCorners(build) {
  const width = build.type === "ramp" ? 118 : 132;
  const height = build.type === "ramp" ? 100 : 34;
  const hw = width / 2;
  const hh = height / 2;
  const angle = Number(build.angle) || 0;
  const c = Math.cos(angle);
  const s = Math.sin(angle);

  const points = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh }
  ];

  return points.map(p => ({
    x: build.x + p.x * c - p.y * s,
    y: build.y + p.x * s + p.y * c
  }));
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < (xj - xi) * (point.y - yi) / ((yj - yi) || 0.00001) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function segmentIntersectT(ax, ay, bx, by, cx, cy, dx, dy) {
  const rX = bx - ax;
  const rY = by - ay;
  const sX = dx - cx;
  const sY = dy - cy;
  const denom = rX * sY - rY * sX;
  if (Math.abs(denom) < 0.00001) return null;

  const qpx = cx - ax;
  const qpy = cy - ay;
  const t = (qpx * sY - qpy * sX) / denom;
  const u = (qpx * rY - qpy * rX) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return t;
  return null;
}

function segmentAabbHitDistance(rect, ax, ay, bx, by) {
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x + rect.w, y: rect.y + rect.h },
    { x: rect.x, y: rect.y + rect.h }
  ];

  if (ax >= rect.x && ax <= rect.x + rect.w && ay >= rect.y && ay <= rect.y + rect.h) return 0;

  let bestT = null;
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    const t = segmentIntersectT(ax, ay, bx, by, a.x, a.y, b.x, b.y);
    if (t !== null && (bestT === null || t < bestT)) bestT = t;
  }

  if (bestT === null) return null;
  return Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2) * bestT;
}

function buildHitDistance(build, ax, ay, bx, by) {
  const corners = buildCorners(build);
  if (pointInPolygon({ x: ax, y: ay }, corners)) return 0;

  let bestT = null;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    const t = segmentIntersectT(ax, ay, bx, by, a.x, a.y, b.x, b.y);
    if (t !== null && (bestT === null || t < bestT)) bestT = t;
  }

  if (bestT === null) return null;
  return Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2) * bestT;
}

function applyDamage(target, amount, attacker, room) {
  if (!target.alive) return;

  let remaining = amount;
  if (target.shield > 0) {
    const shieldDamage = Math.min(target.shield, remaining);
    target.shield -= shieldDamage;
    remaining -= shieldDamage;
  }

  target.health -= remaining;
  if (target.health <= 0) {
    target.health = 0;
    target.alive = false;
    target.deathTime = Date.now();
    target.phase = "dead";
    if (attacker && attacker.id !== target.id) {
      attacker.kills += 1;
      addFeed(room, `${attacker.name} eliminated ${target.name}`);
    } else {
      addFeed(room, `${target.name} was eliminated`);
    }

    // Drop some loot on elimination.
    const weapon = target.inventory.slots.find(Boolean);
    if (weapon) {
      room.loot.push({
        id: makeId("loot"),
        type: "weapon",
        weapon: weapon.type,
        ammoInMag: weapon.ammoInMag,
        x: target.x + randint(-25, 25),
        y: target.y + randint(-25, 25)
      });
    }
  }
}

function fireShot(room, shooter, angle, clientId = null) {
  if (!room || room.phase !== "game" || shooter.phase !== "ground") return null;
  if (!shooter || !shooter.alive) return null;

  const weapon = weaponInHand(shooter);
  if (!weapon) return null;

  const base = WEAPONS[weapon.type] || WEAPONS.pistol;
  const now = Date.now();
  if (now - shooter.lastShotAt < base.fireMs) return null;
  shooter.lastShotAt = now;

  if (weapon.ammoInMag <= 0) {
    const ammoAvailable = shooter.inventory.ammo[base.ammoType] || 0;
    if (ammoAvailable <= 0) return { dry: true, shooterId: shooter.id };
    const needed = base.mag;
    const loaded = Math.min(needed, ammoAvailable);
    shooter.inventory.ammo[base.ammoType] -= loaded;
    weapon.ammoInMag = loaded;
    return { reload: true, shooterId: shooter.id };
  }

  weapon.ammoInMag -= 1;
  shooter.angle = angle;

  const shotEvents = [];
  for (let pellet = 0; pellet < base.pellets; pellet++) {
    const pelletAngle = angle + rand(-base.spread, base.spread);
    const startX = shooter.x + Math.cos(pelletAngle) * 24;
    const startY = shooter.y + Math.sin(pelletAngle) * 24;
    const endX = shooter.x + Math.cos(pelletAngle) * base.range;
    const endY = shooter.y + Math.sin(pelletAngle) * base.range;

    let closestBuild = null;
    let closestBuildDistance = Infinity;

    for (const build of room.builds) {
      const hitD = buildHitDistance(build, startX, startY, endX, endY);
      if (hitD !== null && hitD < closestBuildDistance) {
        closestBuild = build;
        closestBuildDistance = hitD;
      }
    }

    let hit = null;
    let hitDistance = Infinity;

    for (const target of room.players.values()) {
      if (target.id === shooter.id || !target.alive || target.phase !== "ground") continue;
      if (isSameTeam(shooter, target)) continue;

      const d = linePointDistance(target.x, target.y, startX, startY, endX, endY);
      const along = dist(shooter, target);
      if (d < 25 && along < hitDistance && along <= base.range) {
        hit = target;
        hitDistance = along;
      }
    }

    // Builds block bullets for both real players and bots.
    // If a wall/ramp is closer than the player along the bullet path, the build absorbs the shot.
    let blockedByBuild = closestBuild && closestBuildDistance <= Math.min(hitDistance, base.range);

    if (blockedByBuild) {
      closestBuild.hp -= Math.max(6, Math.round(base.damage * 1.15));
      if (closestBuild.hp <= 0) {
        room.builds = room.builds.filter(b => b.id !== closestBuild.id);
        addFeed(room, "Build destroyed");
      }
      hit = null;
    }

    const event = {
      id: clientId || makeId("shot"),
      shooterId: shooter.id,
      x: shooter.x,
      y: shooter.y,
      angle: pelletAngle,
      weapon: weapon.type,
      hitId: hit ? hit.id : null,
      blockedByBuild: !!blockedByBuild,
      buildId: blockedByBuild && closestBuild ? closestBuild.id : null
    };

    if (hit) {
      const headshot = Math.random() < (weapon.type === "sniper" ? 0.35 : 0.18);
      const damage = Math.round(base.damage * (headshot ? 1.45 : 1));
      applyDamage(hit, damage, shooter, room);
      event.damage = damage;
      event.headshot = headshot;
    }

    shotEvents.push(event);
  }

  return { shots: shotEvents, shooterId: shooter.id };
}

function handleShoot(socket, data) {
  const room = rooms.get(socket.data.roomCode);
  if (!room) return;
  const shooter = room.players.get(socket.id);
  if (!shooter) return;

  const angle = Number(data?.angle) || shooter.angle || 0;
  const result = fireShot(room, shooter, angle, data?.clientId);

  if (!result) return;
  if (result.dry) {
    socket.emit("actionResult", { type: "dry", message: "No ammo" });
    return;
  }
  if (result.reload) {
    socket.emit("actionResult", { type: "reload", message: "Reloaded" });
    broadcastRoom(room);
    return;
  }

  for (const event of result.shots || []) io.to(room.code).emit("shot", event);
  broadcastRoom(room);
  for (const [id, player] of Array.from(room.players.entries())) {
    if (player.isBot && !player.alive && player.deathTime && Date.now() - player.deathTime > 1800) {
      room.players.delete(id);
    }
  }

  checkWin(room);
}

function updatePlayerInput(socket, data) {
  const room = rooms.get(socket.data.roomCode);
  if (!room || room.phase !== "game") return;
  const player = room.players.get(socket.id);
  if (!player || !player.alive) return;

  const angle = Number(data?.angle);
  if (Number.isFinite(angle)) player.angle = angle;

  if (player.phase === "bus") return;

  const x = Number(data?.x);
  const y = Number(data?.y);
  const gliderOpen = !!data?.gliderOpen;

  if (player.phase === "drop") {
    if (Number.isFinite(x)) player.x = clamp(x, 20, WORLD.width - 20);
    if (Number.isFinite(y)) player.y = clamp(y, 20, WORLD.height - 20);
    player.gliderOpen = gliderOpen;
    player.dropHeight = Math.max(0, player.dropHeight - (player.gliderOpen ? 2.8 : 5.2));
    if (player.dropHeight <= 0) landPlayer(player);
    return;
  }

  if (player.phase === "ground") {
    if (Number.isFinite(x)) player.x = clamp(x, 20, WORLD.width - 20);
    if (Number.isFinite(y)) player.y = clamp(y, 20, WORLD.height - 20);
  }
}

function setSelectedSlot(socket, data) {
  const room = rooms.get(socket.data.roomCode);
  const player = room?.players.get(socket.id);
  if (!player) return;
  const slot = Number(data?.slot);
  if (Number.isInteger(slot) && slot >= 0 && slot < 5) {
    player.inventory.selected = slot;
    broadcastRoom(room);
  }
}

function interact(socket) {
  const room = rooms.get(socket.data.roomCode);
  const player = room?.players.get(socket.id);
  if (!room || !player || !player.alive || player.phase !== "ground") return;

  const now = Date.now();
  if (now - player.lastInteractAt < 250) return;
  player.lastInteractAt = now;

  // Chests
  let chest = room.chests.find(c => !c.opened && dist(c, player) < 85);
  if (chest) {
    chest.opened = true;
    for (let i = 0; i < 4; i++) room.loot.push(itemFromPool(chest.x + randint(-45, 45), chest.y + randint(-45, 45)));
    addFeed(room, `${player.name} opened a chest`);
    broadcastRoom(room);
    return;
  }

  // Loot
  let closest = null;
  let closestD = Infinity;
  for (const item of room.loot) {
    const d = dist(item, player);
    if (d < 78 && d < closestD) {
      closest = item;
      closestD = d;
    }
  }
  if (!closest) return;

  pickupItem(room, player, closest);
  room.loot = room.loot.filter(item => item.id !== closest.id);
  broadcastRoom(room);
}

function pickupItem(room, player, item) {
  if (item.type === "weapon") {
    const weapon = createWeaponInstance(item.weapon);
    weapon.ammoInMag = item.ammoInMag || WEAPONS[item.weapon].mag;
    let idx = player.inventory.slots.findIndex(slot => !slot);
    if (idx === -1) idx = player.inventory.selected;
    const old = player.inventory.slots[idx];
    if (old) {
      room.loot.push({ id: makeId("loot"), type: "weapon", weapon: old.type, ammoInMag: old.ammoInMag, x: player.x + 22, y: player.y + 22 });
    }
    player.inventory.slots[idx] = weapon;
    player.inventory.selected = idx;
    addFeed(room, `${player.name} picked up ${weapon.name}`);
  } else if (item.type === "ammo") {
    player.inventory.ammo[item.ammoType] = (player.inventory.ammo[item.ammoType] || 0) + item.amount;
  } else if (item.type === "material") {
    player.inventory.materials[item.material] = (player.inventory.materials[item.material] || 0) + item.amount;
  } else if (item.type === "heal") {
    player.inventory.heals.medkit = (player.inventory.heals.medkit || 0) + 1;
  } else if (item.type === "shield") {
    player.inventory.heals.mini = (player.inventory.heals.mini || 0) + 1;
  }
}

function useHeal(socket, data) {
  const room = rooms.get(socket.data.roomCode);
  const player = room?.players.get(socket.id);
  if (!player || !player.alive || player.phase !== "ground") return;

  const now = Date.now();
  if (now - player.lastHealAt < 1200) return;
  player.lastHealAt = now;

  const item = data?.item;
  if (item === "medkit" && player.inventory.heals.medkit > 0 && player.health < 100) {
    player.inventory.heals.medkit -= 1;
    player.health = clamp(player.health + 35, 0, 100);
    addFeed(room, `${player.name} used a medkit`);
  } else if (item === "mini" && player.inventory.heals.mini > 0 && player.shield < 100) {
    player.inventory.heals.mini -= 1;
    player.shield = clamp(player.shield + 25, 0, 100);
    addFeed(room, `${player.name} used a shield`);
  }
  broadcastRoom(room);
}

function buildPiece(socket, data) {
  const room = rooms.get(socket.data.roomCode);
  const player = room?.players.get(socket.id);
  if (!room || !player || !player.alive || player.phase !== "ground") return;

  const now = Date.now();
  if (now - player.lastBuildAt < 180) return;
  player.lastBuildAt = now;

  const material = ["wood", "brick", "metal"].includes(data?.material) ? data.material : "wood";
  const type = data?.type === "ramp" ? "ramp" : "wall";
  const cost = type === "ramp" ? 15 : 10;
  if ((player.inventory.materials[material] || 0) < cost) return;

  const x = clamp(Number(data?.x) || player.x, 50, WORLD.width - 50);
  const y = clamp(Number(data?.y) || player.y, 50, WORLD.height - 50);
  if (dist(player, { x, y }) > 210) return;

  player.inventory.materials[material] -= cost;
  const hpMap = { wood: 90, brick: 135, metal: 190 };
  room.builds.push({
    id: makeId("build"),
    ownerId: player.id,
    x,
    y,
    angle: Number(data?.angle) || 0,
    type,
    material,
    hp: hpMap[material],
    maxHp: hpMap[material],
    createdAt: Date.now()
  });
  broadcastRoom(room);
}

function harvest(socket, data) {
  const room = rooms.get(socket.data.roomCode);
  const player = room?.players.get(socket.id);
  if (!room || !player || !player.alive || player.phase !== "ground") return;

  const targetId = data?.targetId;
  const collections = [room.trees, room.rocks];
  for (const list of collections) {
    const target = list.find(obj => obj.id === targetId || dist(obj, player) < 75);
    if (!target) continue;
    target.hp -= 28;
    player.inventory.materials[target.material] = (player.inventory.materials[target.material] || 0) + 6;
    if (target.hp <= 0) {
      player.inventory.materials[target.material] += target.amount;
      const idx = list.indexOf(target);
      if (idx >= 0) list.splice(idx, 1);
    }
    broadcastRoom(room);
    return;
  }
}

function playerJump(socket) {
  const room = rooms.get(socket.data.roomCode);
  const player = room?.players.get(socket.id);
  if (!room || !player) return;
  if (room.matchPhase === "bus" && player.phase === "bus") {
    startDrop(room, player);
    broadcastRoom(room);
  }
}

function updateBots(room) {
  if (room.phase !== "game" || room.matchPhase === "bus") return;

  const now = Date.now();

  for (const bot of room.players.values()) {
    if (!bot.isBot || !bot.alive || bot.phase !== "ground") continue;

    const currentWeapon = weaponInHand(bot);
    const hasGoodWeapon = currentWeapon && currentWeapon.type !== "pistol";
    const stormDist = dist(bot, room.storm);
    const outsideStorm = stormDist > room.storm.radius * 0.88;

    if (now > bot.ai.nextDecision) {
      bot.ai.nextDecision = now + randint(450, 1050);

      let bestTarget = null;
      let bestTargetD = Infinity;

      for (const p of room.players.values()) {
        if (p.id === bot.id || !p.alive || p.phase !== "ground") continue;
        if (isSameTeam(bot, p)) continue;

        const d = dist(bot, p);
        if (d < bestTargetD) {
          bestTarget = p;
          bestTargetD = d;
        }
      }

      let bestLoot = null;
      let bestLootD = Infinity;
      for (const item of room.loot) {
        const d = dist(bot, item);
        const usefulWeapon = item.type === "weapon" && (!hasGoodWeapon || item.weapon === "rifle" || item.weapon === "shotgun");
        const usefulHeal = (item.type === "heal" && bot.health < 75) || (item.type === "shield" && bot.shield < 65);
        const usefulAmmo = item.type === "ammo";
        if ((usefulWeapon || usefulHeal || usefulAmmo) && d < bestLootD && d < 900) {
          bestLoot = item;
          bestLootD = d;
        }
      }

      let bestChest = null;
      let bestChestD = Infinity;
      for (const chest of room.chests) {
        if (chest.opened) continue;
        const d = dist(bot, chest);
        if (d < bestChestD && d < 850) {
          bestChest = chest;
          bestChestD = d;
        }
      }

      bot.ai.targetId = bestTarget && bestTargetD < 920 ? bestTarget.id : null;
      bot.ai.lootId = bestLoot ? bestLoot.id : null;
      bot.ai.chestId = bestChest ? bestChest.id : null;

      if (outsideStorm) {
        bot.ai.moveX = room.storm.x - bot.x;
        bot.ai.moveY = room.storm.y - bot.y;
      } else if (bot.health < 45 && bestTarget && bestTargetD < 500) {
        // Retreat and heal instead of deleting the player instantly.
        bot.ai.moveX = bot.x - bestTarget.x;
        bot.ai.moveY = bot.y - bestTarget.y;
      } else if (bestLoot && (!hasGoodWeapon || bot.health < 80 || bot.shield < 70)) {
        bot.ai.moveX = bestLoot.x - bot.x;
        bot.ai.moveY = bestLoot.y - bot.y;
      } else if (bestChest && !hasGoodWeapon) {
        bot.ai.moveX = bestChest.x - bot.x;
        bot.ai.moveY = bestChest.y - bot.y;
      } else if (bestTarget && bestTargetD < 920) {
        const preferred = currentWeapon?.type === "shotgun" ? 190 : currentWeapon?.type === "sniper" ? 620 : 410;
        if (bestTargetD > preferred + 90) {
          bot.ai.moveX = bestTarget.x - bot.x;
          bot.ai.moveY = bestTarget.y - bot.y;
        } else if (bestTargetD < preferred - 80) {
          bot.ai.moveX = bot.x - bestTarget.x;
          bot.ai.moveY = bot.y - bestTarget.y;
        } else {
          // Strafe instead of standing still.
          const ang = Math.atan2(bestTarget.y - bot.y, bestTarget.x - bot.x) + (Math.random() < 0.5 ? Math.PI/2 : -Math.PI/2);
          bot.ai.moveX = Math.cos(ang);
          bot.ai.moveY = Math.sin(ang);
        }
      } else {
        bot.ai.moveX = rand(-1, 1);
        bot.ai.moveY = rand(-1, 1);
      }

      // Smart healing, but slow enough to feel fair.
      if (bot.health < 55 && bot.inventory.heals.medkit > 0 && Math.random() < 0.6) {
        bot.inventory.heals.medkit -= 1;
        bot.health = clamp(bot.health + 28, 0, 100);
      }
      if (bot.shield < 45 && bot.inventory.heals.mini > 0 && Math.random() < 0.65) {
        bot.inventory.heals.mini -= 1;
        bot.shield = clamp(bot.shield + 20, 0, 100);
      }
    }

    const len = Math.sqrt(bot.ai.moveX ** 2 + bot.ai.moveY ** 2) || 1;
    const speed = outsideStorm ? 2.25 : 1.75;
    bot.x = clamp(bot.x + (bot.ai.moveX / len) * speed, 20, WORLD.width - 20);
    bot.y = clamp(bot.y + (bot.ai.moveY / len) * speed, 20, WORLD.height - 20);

    const target = room.players.get(bot.ai.targetId);
    if (target && target.alive && target.phase === "ground" && !isSameTeam(bot, target)) {
      bot.angle = Math.atan2(target.y - bot.y, target.x - bot.x);
      const d = dist(bot, target);
      const weapon = weaponInHand(bot);
      const range = weapon?.type === "shotgun" ? 280 : weapon?.type === "sniper" ? 850 : 610;

      // Bots are smarter with movement but intentionally less accurate/lethal.
      const clearShotChance = weapon?.type === "sniper" ? 0.025 : weapon?.type === "smg" ? 0.045 : 0.035;
      if (d < range && Math.random() < clearShotChance) {
        const aimError = weapon?.type === "shotgun" ? rand(-0.16, 0.16) : weapon?.type === "sniper" ? rand(-0.06, 0.06) : rand(-0.09, 0.09);
        const result = fireShot(room, bot, bot.angle + aimError);
        if (result?.shots) for (const event of result.shots) io.to(room.code).emit("shot", event);
      }

      // Defensive build sometimes when weak, so they look smarter.
      if (bot.health < 55 && now - bot.lastBuildAt > 2200 && (bot.inventory.materials.wood || 0) >= 10 && d < 520 && Math.random() < 0.05) {
        bot.lastBuildAt = now;
        bot.inventory.materials.wood -= 10;
        room.builds.push({
          id: makeId("build"),
          ownerId: bot.id,
          x: bot.x + Math.cos(bot.angle) * 60,
          y: bot.y + Math.sin(bot.angle) * 60,
          angle: bot.angle + Math.PI / 2,
          type: "wall",
          material: "wood",
          hp: 90,
          maxHp: 90,
          createdAt: Date.now()
        });
      }
    }

    // Bot loot pickup and chest opening.
    const loot = room.loot.find(item => dist(item, bot) < 55);
    if (loot && Math.random() < 0.12) {
      pickupItem(room, bot, loot);
      room.loot = room.loot.filter(item => item.id !== loot.id);
    }

    const chest = room.chests.find(c => !c.opened && dist(c, bot) < 65);
    if (chest && Math.random() < 0.06) {
      chest.opened = true;
      for (let i = 0; i < 3; i++) room.loot.push(itemFromPool(chest.x + randint(-45, 45), chest.y + randint(-45, 45)));
    }
  }
}

function updateMatch(room) {
  if (room.phase !== "game") return;

  if (room.matchPhase === "bus") {
    room.bus.t += room.bus.speed;
    const pos = getBusPosition(room);
    for (const player of room.players.values()) {
      if (!player.isBot && player.alive && player.phase === "bus") {
        player.x = pos.x;
        player.y = pos.y;
        player.angle = Math.atan2(room.bus.endY - room.bus.startY, room.bus.endX - room.bus.startX);
      }
    }
    if (room.bus.t >= 1) {
      for (const player of room.players.values()) {
        if (!player.isBot && player.alive && player.phase === "bus") startDrop(room, player);
      }
      room.matchPhase = "fight";
      addFeed(room, "All players dropped");
    }
  } else if (room.matchPhase === "fight") {
    updateBots(room);
  }

  const now = Date.now();
  const elapsed = (now - room.startedAt) / 1000;
  room.storm.radius = Math.max(260, 2200 - elapsed * 7.5);
  room.storm.phase = Math.min(8, Math.floor(elapsed / 45) + 1);
  room.storm.damage = 1 + Math.floor(elapsed / 70);

  for (const player of room.players.values()) {
    if (!player.alive || player.phase !== "ground") continue;
    const stormDist = dist(player, room.storm);
    if (stormDist > room.storm.radius) {
      player._stormTicks = (player._stormTicks || 0) + 1;
      if (player._stormTicks >= TICK_RATE) {
        player._stormTicks = 0;
        applyDamage(player, room.storm.damage, null, room);
      }
    } else {
      player._stormTicks = 0;
    }
  }

  checkWin(room);
}

function checkWin(room) {
  if (room.phase !== "game") return;

  const alive = Array.from(room.players.values()).filter(player => player.alive);
  const aliveTeams = getAliveTeamIds(room);

  if (aliveTeams.size <= 1 && room.players.size > 1) {
    room.phase = "ended";
    room.matchPhase = "ended";

    const winningTeamId = Array.from(aliveTeams)[0] || null;
    const winner = alive.find(p => p.teamId === winningTeamId) || alive[0] || null;
    room.winner = winner ? publicPlayer(winner) : null;

    const teamText = room.mode === "Solo" ? (room.winner ? `${room.winner.name} wins the match` : "Match ended") : `Team ${winningTeamId || ""} wins the match`;
    addFeed(room, teamText);
    io.to(room.code).emit("matchEnded", publicRoom(room));
  }
}

function broadcastRoom(room) {
  io.to(room.code).emit("roomState", publicRoom(room));
  io.emit("roomList", publicRoomList());
}

io.on("connection", socket => {
  socket.emit("connected", { id: socket.id });
  socket.emit("roomList", publicRoomList());

  socket.on("createRoom", (data = {}, callback) => {
    try {
      const room = createRoom(socket, data);
      callback?.({ ok: true, room: publicRoom(room), selfId: socket.id });
      broadcastRoom(room);
    } catch (error) {
      callback?.({ ok: false, error: error.message });
    }
  });

  socket.on("joinRoom", ({ roomCode, ...data } = {}, callback) => {
    try {
      const room = joinRoom(socket, roomCode, data);
      callback?.({ ok: true, room: publicRoom(room), selfId: socket.id });
      broadcastRoom(room);
    } catch (error) {
      callback?.({ ok: false, error: error.message });
    }
  });

  socket.on("listRooms", callback => {
    callback?.({ ok: true, rooms: publicRoomList() });
    socket.emit("roomList", publicRoomList());
  });

  socket.on("updateCosmetics", (data = {}, callback) => {
    const room = updatePlayerCosmetics(socket, data);
    if (!room) return callback?.({ ok: false, error: "Join or create a room first" });
    callback?.({ ok: true });
    broadcastRoom(room);
  });

  socket.on("setMode", ({ mode } = {}, callback) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return callback?.({ ok: false, error: "Not in a room" });
    if (room.hostId !== socket.id) return callback?.({ ok: false, error: "Only host can change mode" });
    if (room.phase !== "lobby") return callback?.({ ok: false, error: "Match already started" });
    removeFromMatchmaking(room);
    room.mode = normalizeMode(mode);
    callback?.({ ok: true });
    broadcastRoom(room);
  });

  socket.on("setFill", ({ fill } = {}, callback) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return callback?.({ ok: false, error: "Not in a room" });
    if (room.hostId !== socket.id) return callback?.({ ok: false, error: "Only host can change fill" });
    if (room.phase !== "lobby") return callback?.({ ok: false, error: "Match already started" });
    removeFromMatchmaking(room);
    room.fill = !!fill;
    callback?.({ ok: true, fill: room.fill });
    broadcastRoom(room);
  });

  socket.on("findMatch", (data = {}, callback) => {
    requestMatchmaking(socket, data, callback);
  });

  socket.on("toggleReady", callback => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return callback?.({ ok: false, error: "Not in a room" });
    const player = room.players.get(socket.id);
    if (!player) return callback?.({ ok: false, error: "Player not found" });
    player.ready = !player.ready;
    callback?.({ ok: true, ready: player.ready });
    broadcastRoom(room);
  });

  socket.on("startMatch", (payload, callback) => {
    if (typeof payload === "function") {
      callback = payload;
      payload = {};
    }

    const room = rooms.get(socket.data.roomCode);
    if (!room) return callback?.({ ok: false, error: "Not in a room" });
    if (room.hostId !== socket.id) return callback?.({ ok: false, error: "Only host can start" });
    if (room.phase !== "lobby") return callback?.({ ok: false, error: "Match already started" });

    removeFromMatchmaking(room);

    const modeCheck = validateModePlayerCount(room);
    if (!modeCheck.ok) return callback?.({ ok: false, error: modeCheck.message });

    const quickTest = !!payload?.quickTest;

    if (quickTest) {
      // V67: Quick Test also uses matchmaking.
      // Fill searches teammates/enemies.
      // No Fill searches enemies only, then bots fill to 100.
      markHumansReady(room);
      return requestMatchmaking(socket, { mode: room.mode, fill: !!room.fill }, callback);
    } else {
      const readyCheck = validateReadyPlayers(room);
      if (!readyCheck.ok) return callback?.({ ok: false, error: readyCheck.message });

      // V67 FIX:
      // Start Match always goes through matchmaking first.
      // Fill = searches teammates/enemy teams.
      // No Fill = keeps your party alone but searches real enemy players/teams.
      return requestMatchmaking(socket, { mode: room.mode, fill: !!room.fill }, callback);
    }

    // Quick Test / fallback path. Even No Fill quick tests should briefly search
    // for real enemy players before bots fill the match to 100.
    return requestMatchmaking(socket, { mode: room.mode, fill: !!room.fill }, callback);
    callback?.({ ok: true });
    io.to(room.code).emit("matchStarted", publicRoom(room));
    broadcastRoom(room);
  });

  socket.on("jumpFromBus", () => playerJump(socket));
  socket.on("updatePlayer", data => updatePlayerInput(socket, data));
  socket.on("shoot", data => handleShoot(socket, data));
  socket.on("selectSlot", data => setSelectedSlot(socket, data));
  socket.on("interact", () => interact(socket));
  socket.on("useHeal", data => useHeal(socket, data));
  socket.on("build", data => buildPiece(socket, data));
  socket.on("harvest", data => harvest(socket, data));

  socket.on("returnToLobby", callback => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return callback?.({ ok: false, error: "Not in a room" });
    if (room.hostId !== socket.id) return callback?.({ ok: false, error: "Only host can return to lobby" });
    removeFromMatchmaking(room);
    room.phase = "lobby";
    room.matchPhase = "lobby";
    room.winner = null;
    for (const [id, player] of Array.from(room.players.entries())) {
      if (player.isBot) room.players.delete(id);
      else {
        player.ready = false;
        player.health = 100;
        player.shield = 50;
        player.alive = true;
        player.deathTime = 0;
        player.phase = "lobby";
      }
    }
    callback?.({ ok: true });
    broadcastRoom(room);
  });


  socket.on("partyChat", (payload, callback) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return callback?.({ ok: false, error: "Create or join a room first" });

    const player = room.players.get(socket.id);
    if (!player || player.isBot) return callback?.({ ok: false, error: "Only real players can chat" });

    const message = sanitizeChatMessage(payload?.message);
    if (!message) return callback?.({ ok: false, error: "Type a message first" });

    const chat = {
      id: makeId("chat"),
      fromId: player.id,
      name: player.name || "Player",
      color: player.color || "#55d66b",
      message,
      time: Date.now()
    };

    io.to(room.code).emit("partyChat", chat);
    callback?.({ ok: true });
  });


  socket.on("lobbyEmote", ({ emote } = {}, callback) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return callback?.({ ok: false, error: "Not in a room" });
    if (room.phase !== "lobby") return callback?.({ ok: false, error: "Emotes only work in the lobby" });

    const player = room.players.get(socket.id);
    if (!player || player.isBot) return callback?.({ ok: false, error: "Player not found" });

    const allowed = new Set(["dance", "wave", "laugh", "clap", "dab", "salute", "floss", "heart", "point", "sit"]);
    if (!allowed.has(emote)) return callback?.({ ok: false, error: "Invalid emote" });

    io.to(room.code).emit("lobbyEmote", {
      playerId: player.id,
      name: player.name || "Player",
      emote,
      time: Date.now()
    });

    callback?.({ ok: true });
  });

  socket.on("disconnect", () => {
    const queuedRoom = rooms.get(socket.data.roomCode);
    if (queuedRoom) removeFromMatchmaking(queuedRoom);
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room) return;

    room.players.delete(socket.id);
    const humans = Array.from(room.players.values()).filter(p => !p.isBot);
    if (humans.length === 0) {
      rooms.delete(code);
      io.emit("roomList", publicRoomList());
      return;
    }

    if (room.hostId === socket.id) room.hostId = humans[0].id;
    broadcastRoom(room);
    checkWin(room);
  });
});

setInterval(() => {
  for (const room of rooms.values()) {
    updateMatch(room);
    broadcastRoom(room);
  }
}, 1000 / TICK_RATE);

server.listen(PORT, () => {
  console.log(`Island Royale V37 gameplay running on http://localhost:${PORT}`);
});
