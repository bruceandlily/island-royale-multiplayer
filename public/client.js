const socket = io();

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const lobby = document.getElementById("lobby");
const hud = document.getElementById("hud");

const serverStatus = document.getElementById("serverStatus");
const nameInput = document.getElementById("nameInput");
const roomCodeInput = document.getElementById("roomCodeInput");
const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const copyInviteBtn = document.getElementById("copyInviteBtn");
const readyBtn = document.getElementById("readyBtn");
const startMatchBtn = document.getElementById("startMatchBtn");
const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const roomSub = document.getElementById("roomSub");
const partyList = document.getElementById("partyList");

const playersLeftText = document.getElementById("playersLeft");
const killsText = document.getElementById("kills");
const hudRoom = document.getElementById("hudRoom");
const healthText = document.getElementById("healthText");
const shieldText = document.getElementById("shieldText");
const healthFill = document.getElementById("healthFill");
const shieldFill = document.getElementById("shieldFill");
const centerMessage = document.getElementById("centerMessage");
const toast = document.getElementById("toast");

let selfId = null;
let room = null;
let keys = {};
let mouse = { x: 0, y: 0 };
let camera = { x: 0, y: 0 };
let localPlayer = {
  x: 2100,
  y: 2100,
  angle: 0,
  speed: 4.6
};
let shots = [];

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

document.addEventListener("keydown", event => {
  keys[event.key.toLowerCase()] = true;

  if (event.key === "Escape" && room?.phase === "game") {
    lobby.classList.remove("hidden");
    hud.classList.add("hidden");
  }
});

document.addEventListener("keyup", event => {
  keys[event.key.toLowerCase()] = false;
});

canvas.addEventListener("mousemove", event => {
  mouse.x = event.clientX;
  mouse.y = event.clientY;
});

canvas.addEventListener("mousedown", () => {
  if (!room || room.phase !== "game") return;

  const me = getMe();
  if (!me || !me.alive) return;

  socket.emit("shoot", {
    angle: localPlayer.angle
  });
});

function toastMessage(text) {
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => toast.classList.remove("show"), 1400);
}

function normalizeRoomCode(code) {
  return String(code || "").trim().toUpperCase();
}

function currentInviteLink() {
  if (!room) return location.href;
  const url = new URL(location.href);
  url.searchParams.set("room", room.code);
  return url.toString();
}

function getMe() {
  if (!room) return null;
  return room.players.find(player => player.id === selfId);
}

function enableRoomButtons() {
  copyInviteBtn.classList.remove("disabled");
  readyBtn.classList.remove("disabled");
  startMatchBtn.classList.remove("disabled");
}

function updateLobbyUI() {
  if (!room) {
    roomCodeDisplay.textContent = "No Room";
    roomSub.textContent = "Create or join a room to invite friends.";
    partyList.innerHTML = '<div class="emptyParty">No players yet.</div>';
    return;
  }

  roomCodeDisplay.textContent = room.code;
  roomSub.textContent = `${room.players.length} player(s) in room • Share the invite link with friends`;
  hudRoom.textContent = room.code;

  const me = getMe();
  const isHost = room.hostId === selfId;

  readyBtn.textContent = me?.ready ? "Unready" : "Ready";
  startMatchBtn.textContent = isHost ? "Start Match" : "Waiting Host";
  startMatchBtn.classList.toggle("disabled", !isHost || room.players.length < 2);

  partyList.innerHTML = room.players.map(player => {
    const isMe = player.id === selfId;
    const host = player.id === room.hostId ? "Host" : "Party";
    const readyClass = player.ready ? "ready" : "";
    const readyText = player.ready ? "Ready" : "Not Ready";

    return `
      <div class="partyPlayer">
        <div>
          <div class="partyName">${escapeHtml(player.name)}${isMe ? " (You)" : ""}</div>
          <div class="partyMeta">${host} • ${player.alive ? "Alive" : "Down"}</div>
        </div>
        <div class="readyBadge ${readyClass}">${readyText}</div>
      </div>
    `;
  }).join("");
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

createRoomBtn.addEventListener("click", () => {
  socket.emit("createRoom", { name: nameInput.value }, response => {
    if (!response.ok) return toastMessage(response.error);
    room = response.room;
    selfId = response.selfId;
    enableRoomButtons();
    updateLobbyUI();
    toastMessage(`Room ${room.code} created`);
  });
});

joinRoomBtn.addEventListener("click", () => {
  const code = normalizeRoomCode(roomCodeInput.value);
  socket.emit("joinRoom", { roomCode: code, name: nameInput.value }, response => {
    if (!response.ok) return toastMessage(response.error);
    room = response.room;
    selfId = response.selfId;
    enableRoomButtons();
    updateLobbyUI();
    toastMessage(`Joined room ${room.code}`);
  });
});

copyInviteBtn.addEventListener("click", async () => {
  if (!room) return;
  const link = currentInviteLink();

  try {
    await navigator.clipboard.writeText(link);
    toastMessage("Invite link copied");
  } catch {
    prompt("Copy this invite link:", link);
  }
});

readyBtn.addEventListener("click", () => {
  socket.emit("toggleReady", response => {
    if (!response?.ok) toastMessage(response?.error || "Could not ready");
  });
});

startMatchBtn.addEventListener("click", () => {
  socket.emit("startMatch", response => {
    if (!response?.ok) toastMessage(response?.error || "Could not start");
  });
});

socket.on("connect", () => {
  serverStatus.textContent = "Online";
  serverStatus.style.color = "#55d66b";
  selfId = socket.id;

  const params = new URLSearchParams(location.search);
  const roomFromLink = params.get("room");

  if (roomFromLink) {
    roomCodeInput.value = roomFromLink.toUpperCase();
    toastMessage("Invite detected. Enter name and click Join.");
  }
});

socket.on("disconnect", () => {
  serverStatus.textContent = "Offline";
  serverStatus.style.color = "#ff5b67";
});

socket.on("roomState", state => {
  room = state;
  updateLobbyUI();
  updateHud();

  if (room.phase === "game") {
    lobby.classList.add("hidden");
    hud.classList.remove("hidden");
    centerMessage.textContent = "";
  }
});

socket.on("matchStarted", state => {
  room = state;
  const me = getMe();
  if (me) {
    localPlayer.x = me.x;
    localPlayer.y = me.y;
    localPlayer.angle = me.angle;
  }
  lobby.classList.add("hidden");
  hud.classList.remove("hidden");
  toastMessage("Match started");
});

socket.on("matchEnded", state => {
  room = state;
  const winner = state.winner;
  centerMessage.textContent = winner ? `${winner.name} wins!` : "Match ended";
  updateLobbyUI();
});

socket.on("shot", shot => {
  shots.push({
    x: shot.x,
    y: shot.y,
    angle: shot.angle,
    life: 18,
    hitId: shot.hitId,
    damage: shot.damage,
    headshot: shot.headshot
  });

  if (shot.hitId === selfId && shot.damage) {
    toastMessage(`${shot.damage} damage${shot.headshot ? " headshot" : ""}`);
  }
});

function updateLocalPlayer() {
  if (!room || room.phase !== "game") return;

  const me = getMe();
  if (!me || !me.alive) return;

  let dx = 0;
  let dy = 0;

  if (keys["w"]) dy -= 1;
  if (keys["s"]) dy += 1;
  if (keys["a"]) dx -= 1;
  if (keys["d"]) dx += 1;

  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  dx /= len;
  dy /= len;

  localPlayer.x += dx * localPlayer.speed;
  localPlayer.y += dy * localPlayer.speed;

  localPlayer.x = clamp(localPlayer.x, 20, room.world.width - 20);
  localPlayer.y = clamp(localPlayer.y, 20, room.world.height - 20);

  const worldMouse = {
    x: mouse.x + camera.x,
    y: mouse.y + camera.y
  };

  localPlayer.angle = Math.atan2(worldMouse.y - localPlayer.y, worldMouse.x - localPlayer.x);

  socket.emit("updatePlayer", {
    x: localPlayer.x,
    y: localPlayer.y,
    angle: localPlayer.angle
  });

  me.x = localPlayer.x;
  me.y = localPlayer.y;
  me.angle = localPlayer.angle;
}

function updateHud() {
  if (!room) return;

  const alive = room.players.filter(player => player.alive).length;
  const me = getMe();

  playersLeftText.textContent = alive;
  killsText.textContent = me?.kills || 0;
  hudRoom.textContent = room.code || "----";

  healthText.textContent = Math.ceil(me?.health || 0);
  shieldText.textContent = Math.ceil(me?.shield || 0);
  healthFill.style.width = `${clamp(me?.health || 0, 0, 100)}%`;
  shieldFill.style.width = `${clamp(me?.shield || 0, 0, 100)}%`;

  if (me && !me.alive && room.phase === "game") {
    centerMessage.textContent = "You are eliminated";
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function drawWorld() {
  const world = room?.world || { width: 4200, height: 4200 };

  ctx.fillStyle = "#55b947";
  ctx.fillRect(-camera.x, -camera.y, world.width, world.height);

  ctx.fillStyle = "#2f8fdd";
  ctx.fillRect(-camera.x, -camera.y, world.width, 90);
  ctx.fillRect(-camera.x, world.height - camera.y - 90, world.width, 90);
  ctx.fillRect(-camera.x, -camera.y, 90, world.height);
  ctx.fillRect(world.width - camera.x - 90, -camera.y, 90, world.height);

  drawRoad(260, 780, 1780, 2050, 3900, 2920);
  drawRoad(620, 3300, 2050, 2050, 3550, 980);

  for (let i = 0; i < 90; i++) {
    const x = ((i * 379) % (world.width - 260)) + 130;
    const y = ((i * 613) % (world.height - 260)) + 130;
    drawTree(x, y);
  }

  for (let i = 0; i < 22; i++) {
    const x = ((i * 761) % (world.width - 500)) + 250;
    const y = ((i * 421) % (world.height - 500)) + 250;
    drawBuilding(x, y, 90 + (i % 3) * 22, 80 + (i % 4) * 18);
  }

  if (room?.storm) {
    drawStorm(room.storm);
  }
}

function drawRoad(...points) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(70,70,70,.92)";
  ctx.lineWidth = 24;
  ctx.beginPath();
  ctx.moveTo(points[0] - camera.x, points[1] - camera.y);
  for (let i = 2; i < points.length; i += 2) {
    ctx.lineTo(points[i] - camera.x, points[i + 1] - camera.y);
  }
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,221,126,.7)";
  ctx.lineWidth = 3;
  ctx.setLineDash([16, 16]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawTree(x, y) {
  ctx.beginPath();
  ctx.arc(x - camera.x, y - camera.y, 22, 0, Math.PI * 2);
  ctx.fillStyle = "#1d6b25";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x - camera.x - 5, y - camera.y - 6, 15, 0, Math.PI * 2);
  ctx.fillStyle = "#34a53f";
  ctx.fill();
}

function drawBuilding(x, y, w, h) {
  ctx.fillStyle = "#657181";
  ctx.fillRect(x - camera.x, y - camera.y, w, h);
  ctx.fillStyle = "#38404a";
  ctx.fillRect(x - camera.x + 6, y - camera.y + 6, w - 12, 14);
  ctx.strokeStyle = "rgba(0,0,0,.26)";
  ctx.lineWidth = 3;
  ctx.strokeRect(x - camera.x, y - camera.y, w, h);
}

function drawStorm(storm) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, canvas.width, canvas.height);
  ctx.arc(storm.x - camera.x, storm.y - camera.y, storm.radius, 0, Math.PI * 2, true);
  ctx.fillStyle = "rgba(120,0,255,.22)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(storm.x - camera.x, storm.y - camera.y, storm.radius, 0, Math.PI * 2);
  ctx.strokeStyle = "#c271ff";
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.restore();
}

function drawPlayers() {
  if (!room) return;

  for (const player of room.players) {
    drawPlayer(player);
  }
}

function drawPlayer(player) {
  const x = player.x - camera.x;
  const y = player.y - camera.y;

  if (!player.alive) {
    ctx.globalAlpha = 0.35;
  }

  ctx.save();
  ctx.translate(x, y);

  ctx.beginPath();
  ctx.ellipse(0, 18, 15, 6, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,.24)";
  ctx.fill();

  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-4, 12);
  ctx.lineTo(-6, 23);
  ctx.moveTo(4, 12);
  ctx.lineTo(6, 23);
  ctx.stroke();

  ctx.fillStyle = player.color || "#2fb4ff";
  ctx.fillRect(-9, -5, 18, 20);

  ctx.beginPath();
  ctx.arc(0, -13, 7, 0, Math.PI * 2);
  ctx.fillStyle = "#ffd7b6";
  ctx.fill();

  ctx.strokeStyle = "#ffd7b6";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-5, 2);
  ctx.lineTo(Math.cos(player.angle) * 13, Math.sin(player.angle) * 13 + 2);
  ctx.moveTo(5, 2);
  ctx.lineTo(Math.cos(player.angle) * 15, Math.sin(player.angle) * 15 + 2);
  ctx.stroke();

  drawGun(player.angle);

  if (player.id === selfId) {
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.strokeRect(-12, -8, 24, 28);
  }

  ctx.restore();

  ctx.globalAlpha = 1;

  ctx.fillStyle = "white";
  ctx.font = "bold 13px Arial";
  ctx.textAlign = "center";
  ctx.fillText(player.name, x, y - 34);
}

function drawGun(angle) {
  ctx.save();
  ctx.rotate(angle);
  ctx.fillStyle = "#111827";
  ctx.fillRect(8, -3, 26, 6);
  ctx.fillRect(17, 2, 4, 10);
  ctx.fillStyle = "#ffcf4a";
  ctx.fillRect(30, -1, 8, 2);
  ctx.restore();
}

function drawShots() {
  for (const shot of shots) {
    const sx = shot.x - camera.x + Math.cos(shot.angle) * 24;
    const sy = shot.y - camera.y + Math.sin(shot.angle) * 24;
    const ex = shot.x - camera.x + Math.cos(shot.angle) * 640;
    const ey = shot.y - camera.y + Math.sin(shot.angle) * 640;

    ctx.globalAlpha = shot.life / 18;
    ctx.strokeStyle = shot.headshot ? "#ffcf4a" : "#f8fafc";
    ctx.lineWidth = shot.headshot ? 4 : 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.globalAlpha = 1;

    shot.life--;
  }

  shots = shots.filter(shot => shot.life > 0);
}

function updateCamera() {
  if (!room || room.phase !== "game") return;

  const me = getMe();
  if (!me) return;

  camera.x = clamp(me.x - canvas.width / 2, 0, room.world.width - canvas.width);
  camera.y = clamp(me.y - canvas.height / 2, 0, room.world.height - canvas.height);
}

function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (room?.phase === "game") {
    updateLocalPlayer();
    updateCamera();
    drawWorld();
    drawShots();
    drawPlayers();
    updateHud();
  } else {
    ctx.fillStyle = "#07111f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  requestAnimationFrame(gameLoop);
}

gameLoop();
