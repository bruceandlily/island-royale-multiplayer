const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

const WORLD = { width: 4200, height: 4200 };
const TICK_RATE = 20;
const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const rooms = new Map();

const COLOR_PRESETS = ["#2fb4ff", "#ff5b67", "#55d66b", "#b65cff", "#ffcf4a", "#ff7a00", "#00e5ff", "#8dff55"];

function randomRoomCode() {
  let code = "";
  for (let i = 0; i < 4; i++) code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  return rooms.has(code) ? randomRoomCode() : code;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
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

function makeSpawn(index, count) {
  const centerX = WORLD.width / 2;
  const centerY = WORLD.height / 2;
  const radius = 260 + count * 16;
  const angle = (Math.PI * 2 * index) / Math.max(1, count);
  return { x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius };
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
    kills: 0,
    ready: false,
    color: sanitizeColor(data.color),
    outfit: sanitizeOutfit(data.outfit),
    banner: data.banner === "Gold" ? "Gold" : data.banner === "Purple" ? "Purple" : "Blue",
    lastShotAt: 0,
    roomCode: null
  };
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
    kills: player.kills,
    ready: player.ready,
    color: player.color,
    outfit: player.outfit,
    banner: player.banner
  };
}

function publicRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    world: WORLD,
    storm: room.storm,
    players: Array.from(room.players.values()).map(publicPlayer),
    startedAt: room.startedAt,
    winner: room.winner,
    mode: room.mode || "Solo",
    maxPlayers: room.maxPlayers || 16
  };
}

function publicRoomList() {
  return Array.from(rooms.values()).map(room => ({
    code: room.code,
    hostName: room.players.get(room.hostId)?.name || "Host",
    players: room.players.size,
    maxPlayers: room.maxPlayers || 16,
    phase: room.phase,
    mode: room.mode || "Solo"
  }));
}

function createRoom(hostSocket, data = {}) {
  const code = randomRoomCode();
  const player = createPlayer(hostSocket, data);
  player.roomCode = code;

  const room = {
    code,
    hostId: hostSocket.id,
    phase: "lobby",
    mode: data.mode === "Squads" ? "Squads" : data.mode === "Duos" ? "Duos" : "Solo",
    maxPlayers: 16,
    players: new Map([[hostSocket.id, player]]),
    storm: {
      x: WORLD.width / 2,
      y: WORLD.height / 2,
      radius: 1850,
      damage: 2,
      phase: 1
    },
    startedAt: null,
    winner: null
  };

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
  if (room.players.size >= room.maxPlayers) throw new Error("Room is full");

  const player = createPlayer(socket, data);
  player.roomCode = normalized;
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

function resetRoomForMatch(room) {
  room.phase = "game";
  room.startedAt = Date.now();
  room.winner = null;
  room.storm = {
    x: WORLD.width / 2,
    y: WORLD.height / 2,
    radius: 1850,
    damage: 2,
    phase: 1
  };

  const players = Array.from(room.players.values());
  players.forEach((player, index) => {
    const spawn = makeSpawn(index, players.length);
    player.x = spawn.x;
    player.y = spawn.y;
    player.angle = 0;
    player.health = 100;
    player.shield = 50;
    player.alive = true;
    player.kills = 0;
    player.ready = false;
    player.lastShotAt = 0;
  });
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

function applyDamage(target, amount, attacker) {
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
    if (attacker && attacker.id !== target.id) attacker.kills += 1;
  }
}

function handleShoot(socket, data) {
  const room = rooms.get(socket.data.roomCode);
  if (!room || room.phase !== "game") return;

  const shooter = room.players.get(socket.id);
  if (!shooter || !shooter.alive) return;

  const now = Date.now();
  if (now - shooter.lastShotAt < 140) return;
  shooter.lastShotAt = now;

  const angle = Number(data?.angle) || shooter.angle || 0;
  shooter.angle = angle;

  const range = 760;
  const startX = shooter.x + Math.cos(angle) * 24;
  const startY = shooter.y + Math.sin(angle) * 24;
  const endX = shooter.x + Math.cos(angle) * range;
  const endY = shooter.y + Math.sin(angle) * range;

  let hit = null;
  let hitDistance = Infinity;

  for (const target of room.players.values()) {
    if (target.id === shooter.id || !target.alive) continue;
    const d = linePointDistance(target.x, target.y, startX, startY, endX, endY);
    const along = distance(shooter, target);
    if (d < 26 && along < hitDistance && along <= range) {
      hit = target;
      hitDistance = along;
    }
  }

  const shotEvent = {
    shooterId: shooter.id,
    x: shooter.x,
    y: shooter.y,
    angle,
    hitId: hit ? hit.id : null
  };

  if (hit) {
    const headshot = Math.random() < 0.18;
    const damage = headshot ? 48 : 26;
    applyDamage(hit, damage, shooter);
    shotEvent.damage = damage;
    shotEvent.headshot = headshot;
  }

  io.to(room.code).emit("shot", shotEvent);
  broadcastRoom(room);
  checkWin(room);
}

function updatePlayerInput(socket, data) {
  const room = rooms.get(socket.data.roomCode);
  if (!room || room.phase !== "game") return;

  const player = room.players.get(socket.id);
  if (!player || !player.alive) return;

  const x = Number(data?.x);
  const y = Number(data?.y);
  const angle = Number(data?.angle);

  if (Number.isFinite(x)) player.x = clamp(x, 20, WORLD.width - 20);
  if (Number.isFinite(y)) player.y = clamp(y, 20, WORLD.height - 20);
  if (Number.isFinite(angle)) player.angle = angle;
}

function checkWin(room) {
  if (room.phase !== "game") return;
  const alive = Array.from(room.players.values()).filter(player => player.alive);

  if (alive.length <= 1 && room.players.size > 1) {
    room.phase = "ended";
    room.winner = alive[0] ? publicPlayer(alive[0]) : null;
    io.to(room.code).emit("matchEnded", publicRoom(room));
  }
}

function tickRoom(room) {
  if (room.phase !== "game") return;

  const now = Date.now();
  const elapsed = (now - room.startedAt) / 1000;

  room.storm.radius = Math.max(260, 1850 - elapsed * 8);
  room.storm.phase = Math.min(8, Math.floor(elapsed / 45) + 1);
  room.storm.damage = 2 + Math.floor(elapsed / 60);

  for (const player of room.players.values()) {
    if (!player.alive) continue;
    const dist = distance(player, room.storm);
    if (dist > room.storm.radius) {
      player._stormTicks = (player._stormTicks || 0) + 1;
      if (player._stormTicks >= TICK_RATE) {
        player._stormTicks = 0;
        applyDamage(player, room.storm.damage, null);
      }
    } else {
      player._stormTicks = 0;
    }
  }

  checkWin(room);
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
    room.mode = mode === "Squads" ? "Squads" : mode === "Duos" ? "Duos" : "Solo";
    callback?.({ ok: true });
    broadcastRoom(room);
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

  socket.on("startMatch", callback => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return callback?.({ ok: false, error: "Not in a room" });
    if (room.hostId !== socket.id) return callback?.({ ok: false, error: "Only host can start" });
    if (room.players.size < 2) return callback?.({ ok: false, error: "Need at least 2 players" });

    resetRoomForMatch(room);
    callback?.({ ok: true });
    io.to(room.code).emit("matchStarted", publicRoom(room));
    broadcastRoom(room);
  });

  socket.on("updatePlayer", data => updatePlayerInput(socket, data));
  socket.on("shoot", data => handleShoot(socket, data));

  socket.on("returnToLobby", callback => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return callback?.({ ok: false, error: "Not in a room" });
    if (room.hostId !== socket.id) return callback?.({ ok: false, error: "Only host can return to lobby" });

    room.phase = "lobby";
    room.winner = null;
    for (const player of room.players.values()) {
      player.ready = false;
      player.health = 100;
      player.shield = 50;
      player.alive = true;
    }
    callback?.({ ok: true });
    broadcastRoom(room);
  });

  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room) return;

    room.players.delete(socket.id);
    if (room.players.size === 0) {
      rooms.delete(code);
      io.emit("roomList", publicRoomList());
      return;
    }

    if (room.hostId === socket.id) room.hostId = room.players.keys().next().value;

    broadcastRoom(room);
    checkWin(room);
  });
});

setInterval(() => {
  for (const room of rooms.values()) {
    tickRoom(room);
    broadcastRoom(room);
  }
}, 1000 / TICK_RATE);

server.listen(PORT, () => {
  console.log(`Island Royale V36 running on http://localhost:${PORT}`);
});
