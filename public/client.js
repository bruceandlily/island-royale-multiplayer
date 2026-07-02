const socket = io();

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const lobby = document.getElementById("lobby");
const hud = document.getElementById("hud");
const toast = document.getElementById("toast");

const serverStatus = document.getElementById("serverStatus");
const nameInput = document.getElementById("nameInput");
const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const copyInviteBtn = document.getElementById("copyInviteBtn");
const partyCopyInviteBtn = document.getElementById("partyCopyInviteBtn");
const readyBtn = document.getElementById("readyBtn");
const startMatchBtn = document.getElementById("startMatchBtn");
const roomCodeInput = document.getElementById("roomCodeInput");
const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const roomSub = document.getElementById("roomSub");
const partyList = document.getElementById("partyList");
const roomList = document.getElementById("roomList");
const refreshRoomsBtn = document.getElementById("refreshRoomsBtn");
const applyLockerBtn = document.getElementById("applyLockerBtn");
const resetQuestsBtn = document.getElementById("resetQuestsBtn");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const emoteBtn = document.getElementById("emoteBtn");
const modeSelect = document.getElementById("modeSelect");
const graphicsSelect = document.getElementById("graphicsSelect");
const volumeSlider = document.getElementById("volumeSlider");
const controlsSelect = document.getElementById("controlsSelect");
const selectedModeTitle = document.getElementById("selectedModeTitle");
const selectedModeDesc = document.getElementById("selectedModeDesc");

const playersLeftText = document.getElementById("playersLeft");
const killsText = document.getElementById("kills");
const hudRoom = document.getElementById("hudRoom");
const healthText = document.getElementById("healthText");
const shieldText = document.getElementById("shieldText");
const healthFill = document.getElementById("healthFill");
const shieldFill = document.getElementById("shieldFill");
const centerMessage = document.getElementById("centerMessage");
const controlsHud = document.getElementById("controlsHud");

let selfId = null;
let room = null;
let roomsCache = [];
let keys = {};
let mouse = { x: 0, y: 0 };
let camera = { x: 0, y: 0 };
let localPlayer = { x: 2100, y: 2100, angle: 0, speed: 4.6 };
let shots = [];
let selectedCosmetic = loadLocal("selectedCosmetic", {
  outfit: "Raider",
  color: "#2fb4ff",
  banner: "Blue"
});
let settings = loadLocal("settings", {
  graphics: "high",
  volume: 60,
  controls: "on",
  mode: "Solo"
});
let quests = loadLocal("quests", {
  eliminations: 0,
  matches: 0,
  party: 0
});

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
  socket.emit("shoot", { angle: localPlayer.angle });
});

function loadLocal(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function toastMessage(text) {
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => toast.classList.remove("show"), 1500);
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function playerPayload() {
  return {
    name: nameInput.value,
    color: selectedCosmetic.color,
    outfit: selectedCosmetic.outfit,
    banner: selectedCosmetic.banner,
    mode: settings.mode || "Solo"
  };
}

function switchTab(tabName) {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.tab === tabName);
  });
  document.querySelectorAll(".tabPanel").forEach(panel => {
    panel.classList.remove("activePanel");
  });
  document.getElementById(`${tabName}Panel`)?.classList.add("activePanel");

  if (tabName === "rooms") requestRoomList();
  if (tabName === "quests") updateQuestUI();
}

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => switchTab(tab.dataset.tab));
});

function enableRoomButtons() {
  copyInviteBtn.classList.remove("disabled");
  partyCopyInviteBtn.classList.remove("disabled");
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
  roomSub.textContent = `${room.players.length}/${room.maxPlayers || 16} player(s) • ${room.mode || "Solo"} • Share the invite link with friends`;
  hudRoom.textContent = room.code;
  modeSelect.value = room.mode || settings.mode || "Solo";

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
          <div class="partyName" style="color:${player.color}">${escapeHtml(player.name)}${isMe ? " (You)" : ""}</div>
          <div class="partyMeta">${host} • ${escapeHtml(player.outfit || "Raider")} • ${player.alive ? "Alive" : "Down"}</div>
        </div>
        <div class="readyBadge ${player.id === room.hostId ? "hostBadge" : readyClass}">${player.id === room.hostId ? "Host" : readyText}</div>
      </div>
    `;
  }).join("");
}

function updateRoomsUI(list = roomsCache) {
  roomsCache = list || [];
  if (!roomsCache.length) {
    roomList.innerHTML = '<div class="emptyParty">No open rooms yet. Create one from the Play tab.</div>';
    return;
  }

  roomList.innerHTML = roomsCache.map(item => {
    const joinable = item.phase === "lobby";
    return `
      <div class="roomListItem">
        <div>
          <div class="partyName">${escapeHtml(item.code)} — ${escapeHtml(item.mode || "Solo")}</div>
          <div class="partyMeta">Host: ${escapeHtml(item.hostName)} • ${item.players}/${item.maxPlayers} • ${item.phase}</div>
        </div>
        <button class="secondaryButton compact ${joinable ? "" : "disabled"}" onclick="joinListedRoom('${escapeHtml(item.code)}')">Join</button>
      </div>
    `;
  }).join("");
}

window.joinListedRoom = function(code) {
  roomCodeInput.value = code;
  joinRoomByCode(code);
};

function requestRoomList() {
  socket.emit("listRooms", response => {
    if (response?.ok) updateRoomsUI(response.rooms);
  });
}

function setQuestProgress() {
  quests.party = room ? 1 : quests.party;
  saveLocal("quests", quests);
  updateQuestUI();
}

function updateQuestUI() {
  const q1 = Math.min(quests.eliminations, 5);
  const q2 = Math.min(quests.matches, 3);
  const q3 = Math.min(quests.party, 1);

  document.getElementById("questElimsText").textContent = `${q1} / 5`;
  document.getElementById("questMatchesText").textContent = `${q2} / 3`;
  document.getElementById("questPartyText").textContent = `${q3} / 1`;

  document.getElementById("questElimsBar").style.width = `${q1 / 5 * 100}%`;
  document.getElementById("questMatchesBar").style.width = `${q2 / 3 * 100}%`;
  document.getElementById("questPartyBar").style.width = `${q3 / 1 * 100}%`;
}

function applySettingsToUI() {
  graphicsSelect.value = settings.graphics || "high";
  volumeSlider.value = settings.volume ?? 60;
  controlsSelect.value = settings.controls || "on";
  modeSelect.value = settings.mode || "Solo";
  controlsHud.classList.toggle("hidden", settings.controls === "off");
  selectedModeTitle.textContent = `${settings.mode || "Solo"} Battle Royale`;
}

function applyCosmeticPreview() {
  const body = document.querySelector(".bigCharacter .body");
  const cape = document.querySelector(".bigCharacter .cape");
  if (!body || !cape) return;

  body.style.background = `linear-gradient(180deg, ${selectedCosmetic.color}, #132d82)`;
  cape.style.background = selectedCosmetic.banner === "Gold"
    ? "linear-gradient(180deg,#ffcf4a,#a16207)"
    : selectedCosmetic.banner === "Purple"
      ? "linear-gradient(180deg,#8d4dff,#371b9a)"
      : "linear-gradient(180deg,#2fb4ff,#1958ff)";
}

function selectLockerItem(button) {
  document.querySelectorAll(".lockerItem").forEach(item => item.classList.remove("selected"));
  button.classList.add("selected");
  selectedCosmetic.outfit = button.dataset.outfit;
  selectedCosmetic.color = button.dataset.color;
  applyCosmeticPreview();
}

function selectBanner(button) {
  document.querySelectorAll(".bannerChoice").forEach(item => item.classList.remove("selected"));
  button.classList.add("selected");
  selectedCosmetic.banner = button.dataset.banner;
  applyCosmeticPreview();
}

document.querySelectorAll(".lockerItem").forEach(button => {
  button.addEventListener("click", () => selectLockerItem(button));
});

document.querySelectorAll(".bannerChoice").forEach(button => {
  button.addEventListener("click", () => selectBanner(button));
});

createRoomBtn.addEventListener("click", () => {
  socket.emit("createRoom", playerPayload(), response => {
    if (!response.ok) return toastMessage(response.error);
    room = response.room;
    selfId = response.selfId;
    enableRoomButtons();
    quests.party = 1;
    saveLocal("quests", quests);
    updateLobbyUI();
    updateQuestUI();
    switchTab("party");
    toastMessage(`Room ${room.code} created`);
  });
});

function joinRoomByCode(code) {
  const roomCode = normalizeRoomCode(code || roomCodeInput.value);
  socket.emit("joinRoom", { roomCode, ...playerPayload() }, response => {
    if (!response.ok) return toastMessage(response.error);
    room = response.room;
    selfId = response.selfId;
    enableRoomButtons();
    quests.party = 1;
    saveLocal("quests", quests);
    updateLobbyUI();
    updateQuestUI();
    switchTab("party");
    toastMessage(`Joined room ${room.code}`);
  });
}

joinRoomBtn.addEventListener("click", () => joinRoomByCode());

async function copyInvite() {
  if (!room) return toastMessage("Create or join a room first");
  const link = currentInviteLink();
  try {
    await navigator.clipboard.writeText(link);
    toastMessage("Invite link copied");
  } catch {
    prompt("Copy this invite link:", link);
  }
}

copyInviteBtn.addEventListener("click", copyInvite);
partyCopyInviteBtn.addEventListener("click", copyInvite);

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

refreshRoomsBtn.addEventListener("click", requestRoomList);

applyLockerBtn.addEventListener("click", () => {
  saveLocal("selectedCosmetic", selectedCosmetic);
  applyCosmeticPreview();

  if (room) {
    socket.emit("updateCosmetics", playerPayload(), response => {
      if (!response?.ok) return toastMessage(response?.error || "Locker saved locally");
      toastMessage("Locker applied to party");
    });
  } else {
    toastMessage("Locker saved");
  }
});

resetQuestsBtn.addEventListener("click", () => {
  quests = { eliminations: 0, matches: 0, party: 0 };
  saveLocal("quests", quests);
  updateQuestUI();
  toastMessage("Quests reset");
});

saveSettingsBtn.addEventListener("click", () => {
  settings = {
    graphics: graphicsSelect.value,
    volume: Number(volumeSlider.value),
    controls: controlsSelect.value,
    mode: modeSelect.value
  };
  saveLocal("settings", settings);
  applySettingsToUI();

  if (room) {
    socket.emit("setMode", { mode: settings.mode }, response => {
      if (!response?.ok) toastMessage(response?.error || "Settings saved locally");
      else toastMessage("Settings saved and mode updated");
    });
  } else {
    toastMessage("Settings saved");
  }
});

modeSelect.addEventListener("change", () => {
  settings.mode = modeSelect.value;
  applySettingsToUI();
});

emoteBtn.addEventListener("click", () => {
  const char = document.getElementById("lobbyCharacter");
  char.classList.add("dance");
  toastMessage("Emote: Victory Bounce");
  clearTimeout(window.__danceTimer);
  window.__danceTimer = setTimeout(() => char.classList.remove("dance"), 2500);
});

socket.on("connect", () => {
  serverStatus.textContent = "Online";
  serverStatus.style.color = "#55d66b";
  selfId = socket.id;

  const params = new URLSearchParams(location.search);
  const roomFromLink = params.get("room");
  if (roomFromLink) {
    roomCodeInput.value = roomFromLink.toUpperCase();
    switchTab("rooms");
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
  setQuestProgress();

  if (room.phase === "game") {
    lobby.classList.add("hidden");
    hud.classList.remove("hidden");
    centerMessage.textContent = "";
  }
});

socket.on("roomList", list => {
  updateRoomsUI(list);
});

socket.on("matchStarted", state => {
  room = state;
  quests.matches += 1;
  saveLocal("quests", quests);

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
  const oldKills = getMe()?.kills || 0;
  room = state;
  const newKills = getMe()?.kills || oldKills;
  quests.eliminations = Math.max(quests.eliminations, newKills);
  saveLocal("quests", quests);

  const winner = state.winner;
  centerMessage.textContent = winner ? `${winner.name} wins!` : "Match ended";
  updateLobbyUI();
  updateQuestUI();
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

  if (shot.shooterId === selfId && shot.damage) {
    quests.eliminations = Math.max(quests.eliminations, getMe()?.kills || quests.eliminations);
    saveLocal("quests", quests);
    updateQuestUI();
  }

  if (shot.hitId === selfId && shot.damage) {
    toastMessage(`${shot.damage} damage${shot.headshot ? " headshot" : ""}`);
  }
});

function updateLocalPlayer() {
  if (!room || room.phase !== "game") return;

  const me = getMe();
  if (!me || !me.alive) return;

  let dx = 0, dy = 0;
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

  const worldMouse = { x: mouse.x + camera.x, y: mouse.y + camera.y };
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
  controlsHud.classList.toggle("hidden", settings.controls === "off");

  if (me && !me.alive && room.phase === "game") centerMessage.textContent = "You are eliminated";
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
  drawRoad(840, 1800, 1850, 1400, 3100, 1780);

  if (settings.graphics !== "low") {
    for (let i = 0; i < 90; i++) {
      const x = ((i * 379) % (world.width - 260)) + 130;
      const y = ((i * 613) % (world.height - 260)) + 130;
      drawTree(x, y);
    }
  }

  for (let i = 0; i < 26; i++) {
    const x = ((i * 761) % (world.width - 500)) + 250;
    const y = ((i * 421) % (world.height - 500)) + 250;
    drawBuilding(x, y, 90 + (i % 3) * 22, 80 + (i % 4) * 18);
  }

  if (room?.storm) drawStorm(room.storm);
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
  for (const player of room.players) drawPlayer(player);
}

function drawPlayer(player) {
  const x = player.x - camera.x;
  const y = player.y - camera.y;

  if (!player.alive) ctx.globalAlpha = 0.35;

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

applySettingsToUI();
applyCosmeticPreview();
updateQuestUI();
requestRoomList();
gameLoop();
