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

const playersLeftText = document.getElementById("playersLeft");
const killsText = document.getElementById("kills");
const stormPhaseText = document.getElementById("stormPhase");
const hudRoom = document.getElementById("hudRoom");
const healthText = document.getElementById("healthText");
const shieldText = document.getElementById("shieldText");
const healthFill = document.getElementById("healthFill");
const shieldFill = document.getElementById("shieldFill");
const controlsHud = document.getElementById("controlsHud");
const phasePrompt = document.getElementById("phasePrompt");
const weaponName = document.getElementById("weaponName");
const ammoInMag = document.getElementById("ammoInMag");
const ammoReserve = document.getElementById("ammoReserve");
const weaponHint = document.getElementById("weaponHint");
const woodText = document.getElementById("woodText");
const brickText = document.getElementById("brickText");
const metalText = document.getElementById("metalText");
const inventorySlots = document.getElementById("inventorySlots");
const medkitBtn = document.getElementById("medkitBtn");
const miniBtn = document.getElementById("miniBtn");
const medkitCount = document.getElementById("medkitCount");
const miniCount = document.getElementById("miniCount");
const interactPrompt = document.getElementById("interactPrompt");
const buildPrompt = document.getElementById("buildPrompt");
const feedBox = document.getElementById("feedBox");
const centerMessage = document.getElementById("centerMessage");
const minimap = document.getElementById("minimap");
const mini = minimap?.getContext("2d");
const miniZone = document.getElementById("miniZone");

let selfId = null;
let room = null;
let roomsCache = [];
let keys = {};
let mouse = { x: 0, y: 0 };
let camera = { x: 0, y: 0 };
let localPlayer = { x: 2100, y: 2100, angle: 0, speed: 4.8, gliderOpen: false, dropHeight: 0 };
let shots = [];
let particles = [];
let buildMode = false;
let buildType = "wall";
let buildMaterial = "wood";
let lastShootAt = 0;
let selectedCosmetic = loadLocal("selectedCosmetic", { outfit: "Raider", color: "#2fb4ff", banner: "Blue" });
let settings = loadLocal("settings", { graphics: "high", volume: 60, controls: "on", mode: "Solo" });
let quests = loadLocal("quests", { eliminations: 0, matches: 0, party: 0 });

const WEAPONS = {
  pistol:  { name: "Pistol",  fireMs: 230, ammoType: "light" },
  smg:     { name: "SMG",     fireMs: 90,  ammoType: "light" },
  rifle:   { name: "Rifle",   fireMs: 145, ammoType: "medium" },
  shotgun: { name: "Shotgun", fireMs: 780, ammoType: "shells" },
  sniper:  { name: "Sniper",  fireMs: 1000,ammoType: "heavy" }
};

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
    return;
  }

  if (room?.phase === "game") {
    if (event.code === "Space" && getMe()?.phase === "bus") {
      socket.emit("jumpFromBus");
      return;
    }
    if (event.key.toLowerCase() === "e") socket.emit("interact");
    if (event.key.toLowerCase() === "b") {
      buildMode = !buildMode;
      toastMessage(buildMode ? "Build mode on" : "Build mode off");
    }
    if (event.key.toLowerCase() === "x") buildType = buildType === "wall" ? "ramp" : "wall";
    if (event.key.toLowerCase() === "q") cycleMaterial();
    if (event.key.toLowerCase() === "h") harvestClosest();
    if (event.key === "5") socket.emit("useHeal", { item: "medkit" });
    if (event.key === "6") socket.emit("useHeal", { item: "mini" });
    const slot = Number(event.key) - 1;
    if (slot >= 0 && slot < 5) socket.emit("selectSlot", { slot });
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

  if (buildMode && me.phase === "ground") {
    placeBuild();
    return;
  }

  if (me.phase !== "ground") return;

  const weapon = currentWeapon();
  const fireMs = WEAPONS[weapon?.type || "pistol"].fireMs;
  const now = performance.now();
  if (now - lastShootAt < fireMs * 0.72) return;
  lastShootAt = now;

  socket.emit("shoot", { angle: localPlayer.angle, clientId: `shot_${Date.now()}` });
});

medkitBtn?.addEventListener("click", () => socket.emit("useHeal", { item: "medkit" }));
miniBtn?.addEventListener("click", () => socket.emit("useHeal", { item: "mini" }));

function loadLocal(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
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
  return String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function normalizeRoomCode(code) { return String(code || "").trim().toUpperCase(); }
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
function currentWeapon() {
  const me = getMe();
  if (!me) return null;
  return me.inventory?.slots?.[me.inventory.selected] || me.inventory?.slots?.find(Boolean);
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
  document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.tab === tabName));
  document.querySelectorAll(".tabPanel").forEach(panel => panel.classList.remove("activePanel"));
  document.getElementById(`${tabName}Panel`)?.classList.add("activePanel");
  if (tabName === "rooms") requestRoomList();
  if (tabName === "quests") updateQuestUI();
}
document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => switchTab(tab.dataset.tab)));

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
  const humans = room.players.filter(p => !p.isBot);
  roomCodeDisplay.textContent = room.code;
  roomSub.textContent = `${humans.length}/${room.maxPlayers || 16} real player(s) • ${room.mode || "Solo"} • Bots fill the match`;
  hudRoom.textContent = room.code;
  modeSelect.value = room.mode || settings.mode || "Solo";

  const me = getMe();
  const isHost = room.hostId === selfId;
  readyBtn.textContent = me?.ready ? "Unready" : "Ready";
  startMatchBtn.textContent = isHost ? "Start Match" : "Waiting Host";
  startMatchBtn.classList.toggle("disabled", !isHost || humans.length < 1);

  partyList.innerHTML = humans.map(player => {
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
  socket.emit("listRooms", response => { if (response?.ok) updateRoomsUI(response.rooms); });
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
  controlsHud?.classList.toggle("hidden", settings.controls === "off");
  if (selectedModeTitle) selectedModeTitle.textContent = `${settings.mode || "Solo"} Battle Royale`;
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
document.querySelectorAll(".lockerItem").forEach(button => button.addEventListener("click", () => selectLockerItem(button)));
document.querySelectorAll(".bannerChoice").forEach(button => button.addEventListener("click", () => selectBanner(button)));

createRoomBtn.addEventListener("click", () => {
  socket.emit("createRoom", playerPayload(), response => {
    if (!response.ok) return toastMessage(response.error);
    room = response.room; selfId = response.selfId; enableRoomButtons();
    quests.party = 1; saveLocal("quests", quests);
    updateLobbyUI(); updateQuestUI(); switchTab("party");
    toastMessage(`Room ${room.code} created`);
  });
});
function joinRoomByCode(code) {
  const roomCode = normalizeRoomCode(code || roomCodeInput.value);
  socket.emit("joinRoom", { roomCode, ...playerPayload() }, response => {
    if (!response.ok) return toastMessage(response.error);
    room = response.room; selfId = response.selfId; enableRoomButtons();
    quests.party = 1; saveLocal("quests", quests);
    updateLobbyUI(); updateQuestUI(); switchTab("party");
    toastMessage(`Joined room ${room.code}`);
  });
}
joinRoomBtn.addEventListener("click", () => joinRoomByCode());
async function copyInvite() {
  if (!room) return toastMessage("Create or join a room first");
  const link = currentInviteLink();
  try { await navigator.clipboard.writeText(link); toastMessage("Invite link copied"); }
  catch { prompt("Copy this invite link:", link); }
}
copyInviteBtn.addEventListener("click", copyInvite);
partyCopyInviteBtn.addEventListener("click", copyInvite);
readyBtn.addEventListener("click", () => socket.emit("toggleReady", response => { if (!response?.ok) toastMessage(response?.error || "Could not ready"); }));
startMatchBtn.addEventListener("click", () => socket.emit("startMatch", response => { if (!response?.ok) toastMessage(response?.error || "Could not start"); }));
refreshRoomsBtn.addEventListener("click", requestRoomList);
applyLockerBtn.addEventListener("click", () => {
  saveLocal("selectedCosmetic", selectedCosmetic); applyCosmeticPreview();
  if (room) socket.emit("updateCosmetics", playerPayload(), response => {
    if (!response?.ok) return toastMessage(response?.error || "Locker saved locally");
    toastMessage("Locker applied to party");
  });
  else toastMessage("Locker saved");
});
resetQuestsBtn.addEventListener("click", () => {
  quests = { eliminations: 0, matches: 0, party: 0 };
  saveLocal("quests", quests); updateQuestUI(); toastMessage("Quests reset");
});
saveSettingsBtn.addEventListener("click", () => {
  settings = { graphics: graphicsSelect.value, volume: Number(volumeSlider.value), controls: controlsSelect.value, mode: modeSelect.value };
  saveLocal("settings", settings); applySettingsToUI();
  if (room) socket.emit("setMode", { mode: settings.mode }, response => {
    if (!response?.ok) toastMessage(response?.error || "Settings saved locally");
    else toastMessage("Settings saved and mode updated");
  });
  else toastMessage("Settings saved");
});
modeSelect.addEventListener("change", () => { settings.mode = modeSelect.value; applySettingsToUI(); });
emoteBtn.addEventListener("click", () => {
  const char = document.getElementById("lobbyCharacter");
  char.classList.add("dance");
  toastMessage("Emote: Victory Bounce");
  clearTimeout(window.__danceTimer);
  window.__danceTimer = setTimeout(() => char.classList.remove("dance"), 2500);
});

socket.on("connect", () => {
  serverStatus.textContent = "Online"; serverStatus.style.color = "#55d66b"; selfId = socket.id;
  const params = new URLSearchParams(location.search);
  const roomFromLink = params.get("room");
  if (roomFromLink) {
    roomCodeInput.value = roomFromLink.toUpperCase();
    switchTab("rooms");
    toastMessage("Invite detected. Enter name and click Join.");
  }
});
socket.on("disconnect", () => { serverStatus.textContent = "Offline"; serverStatus.style.color = "#ff5b67"; });
socket.on("roomState", state => {
  const previousMe = getMe();
  room = state;
  updateLobbyUI(); updateHud(); updatePrompt(); updateMinimap();
  if (room.phase === "game") {
    lobby.classList.add("hidden"); hud.classList.remove("hidden");
    if (previousMe && getMe() && getMe().kills > previousMe.kills) {
      quests.eliminations = Math.max(quests.eliminations, getMe().kills);
      saveLocal("quests", quests); updateQuestUI();
    }
  }
});
socket.on("roomList", list => updateRoomsUI(list));
socket.on("matchStarted", state => {
  room = state;
  quests.matches += 1; saveLocal("quests", quests);
  const me = getMe();
  if (me) {
    localPlayer.x = me.x; localPlayer.y = me.y; localPlayer.angle = me.angle;
    localPlayer.dropHeight = me.dropHeight; localPlayer.gliderOpen = me.gliderOpen;
  }
  lobby.classList.add("hidden"); hud.classList.remove("hidden"); centerMessage.textContent = "";
  toastMessage("Match started — Battle Bus");
});
socket.on("matchEnded", state => {
  room = state;
  const winner = state.winner;
  centerMessage.textContent = winner ? `${winner.name} wins!` : "Match ended";
  updateLobbyUI(); updateQuestUI();
});
socket.on("shot", shot => {
  shots.push({ ...shot, life: 18 });
  if (shot.damage) spawnDamage(shot.hitId, shot.damage, shot.headshot);
});
socket.on("actionResult", data => toastMessage(data.message || data.type || "Action"));

function spawnDamage(playerId, damage, headshot) {
  const player = room?.players.find(p => p.id === playerId);
  if (!player) return;
  const s = worldToScreen(player.x, player.y - 42);
  const el = document.createElement("div");
  el.className = `damageNumber ${headshot ? "headshot" : ""}`;
  el.textContent = damage;
  el.style.left = `${s.x}px`;
  el.style.top = `${s.y}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 800);
}

function cycleMaterial() {
  buildMaterial = buildMaterial === "wood" ? "brick" : buildMaterial === "brick" ? "metal" : "wood";
  toastMessage(`Material: ${buildMaterial}`);
}
function placeBuild() {
  const me = getMe();
  if (!me) return;
  const world = screenToWorld(mouse.x, mouse.y);
  socket.emit("build", { x: world.x, y: world.y, angle: localPlayer.angle, type: buildType, material: buildMaterial });
}
function harvestClosest() {
  const me = getMe();
  if (!me) return;
  const resources = [...(room?.trees || []), ...(room?.rocks || [])];
  let closest = null, closestD = Infinity;
  for (const obj of resources) {
    const d = distance(me, obj);
    if (d < closestD) { closest = obj; closestD = d; }
  }
  if (closest && closestD < 90) socket.emit("harvest", { targetId: closest.id });
}

function updateLocalPlayer() {
  if (!room || room.phase !== "game") return;
  const me = getMe();
  if (!me || !me.alive) return;

  if (me.phase === "bus") {
    localPlayer.x = me.x; localPlayer.y = me.y; localPlayer.angle = me.angle;
    return;
  }

  let dx = 0, dy = 0;
  if (keys["w"]) dy -= 1;
  if (keys["s"]) dy += 1;
  if (keys["a"]) dx -= 1;
  if (keys["d"]) dx += 1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  dx /= len; dy /= len;

  const baseSpeed = me.phase === "drop" ? (localPlayer.gliderOpen ? 5.2 : 3.8) : 4.8;
  localPlayer.x = clamp(localPlayer.x + dx * baseSpeed, 20, room.world.width - 20);
  localPlayer.y = clamp(localPlayer.y + dy * baseSpeed, 20, room.world.height - 20);

  const worldMouse = screenToWorld(mouse.x, mouse.y);
  localPlayer.angle = Math.atan2(worldMouse.y - localPlayer.y, worldMouse.x - localPlayer.x);

  if (me.phase === "drop") {
    localPlayer.gliderOpen = localPlayer.gliderOpen || keys[" "];
  }

  socket.emit("updatePlayer", {
    x: localPlayer.x,
    y: localPlayer.y,
    angle: localPlayer.angle,
    gliderOpen: localPlayer.gliderOpen
  });

  me.x = localPlayer.x; me.y = localPlayer.y; me.angle = localPlayer.angle;
}
function updateHud() {
  if (!room) return;
  const alive = room.players.filter(player => player.alive).length;
  const me = getMe();
  const inv = me?.inventory;
  playersLeftText.textContent = alive;
  killsText.textContent = me?.kills || 0;
  stormPhaseText.textContent = room.storm?.phase || 1;
  hudRoom.textContent = room.code || "----";
  miniZone.textContent = `Zone ${room.storm?.phase || 1}`;
  healthText.textContent = Math.ceil(me?.health || 0);
  shieldText.textContent = Math.ceil(me?.shield || 0);
  healthFill.style.width = `${clamp(me?.health || 0, 0, 100)}%`;
  shieldFill.style.width = `${clamp(me?.shield || 0, 0, 100)}%`;
  controlsHud.classList.toggle("hidden", settings.controls === "off");
  woodText.textContent = inv?.materials?.wood || 0;
  brickText.textContent = inv?.materials?.brick || 0;
  metalText.textContent = inv?.materials?.metal || 0;
  medkitCount.textContent = inv?.heals?.medkit || 0;
  miniCount.textContent = inv?.heals?.mini || 0;

  const weapon = currentWeapon();
  weaponName.textContent = weapon?.name || "No Weapon";
  ammoInMag.textContent = weapon?.ammoInMag ?? 0;
  ammoReserve.textContent = weapon ? (inv?.ammo?.[weapon.ammoType] || 0) : 0;
  weaponHint.textContent = buildMode ? `Build: ${buildType} / ${buildMaterial}` : "Click shoot • E loot";

  inventorySlots.innerHTML = (inv?.slots || [null,null,null,null,null]).map((slot, i) => {
    const selected = i === inv.selected ? "selected" : "";
    if (!slot) return `<div class="invSlot ${selected}"><div></div><span>${i+1} Empty</span></div>`;
    return `<div class="invSlot ${selected} rarity-${slot.rarity || "common"}"><div class="invIcon"></div><span>${i+1} ${slot.name}</span></div>`;
  }).join("");

  feedBox.innerHTML = (room.feed || []).slice(-5).reverse().map(item => `<div class="feedItem">${escapeHtml(item.text)}</div>`).join("");
  if (me && !me.alive && room.phase === "game") centerMessage.textContent = "You are eliminated";
}
function updatePrompt() {
  const me = getMe();
  if (!me) return;
  if (me.phase === "bus") phasePrompt.textContent = "SPACE Jump from Bus";
  else if (me.phase === "drop") phasePrompt.textContent = "WASD Glide • SPACE Glider";
  else phasePrompt.textContent = "WASD Move";

  let nearText = "";
  if (me.phase === "ground") {
    const chest = room.chests?.find(c => !c.opened && distance(c, me) < 85);
    const loot = room.loot?.find(item => distance(item, me) < 75);
    if (chest) nearText = "Press E to open chest";
    else if (loot) nearText = "Press E to pick up";
  }
  interactPrompt.textContent = nearText;
  interactPrompt.classList.toggle("hidden", !nearText);
  buildPrompt.textContent = buildMode ? `Build Mode: ${buildType} • ${buildMaterial} • Q material • X piece` : "";
  buildPrompt.classList.toggle("hidden", !buildMode);
}
function updateCamera() {
  if (!room || room.phase !== "game") return;
  const me = getMe();
  if (!me) return;
  let focus = { x: me.x, y: me.y };
  if (me.phase === "bus" && room.bus) focus = busPosition();
  camera.x = clamp(focus.x - canvas.width / 2, 0, room.world.width - canvas.width);
  camera.y = clamp(focus.y - canvas.height / 2, 0, room.world.height - canvas.height);
}
function busPosition() {
  const bus = room?.bus;
  if (!bus) return { x: room.world.width / 2, y: room.world.height / 2 };
  const t = clamp(bus.t, 0, 1);
  return { x: bus.startX + (bus.endX - bus.startX) * t, y: bus.startY + (bus.endY - bus.startY) * t };
}
function worldToScreen(x, y) { return { x: x - camera.x, y: y - camera.y }; }
function screenToWorld(x, y) { return { x: x + camera.x, y: y + camera.y }; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function drawWorld() {
  if (!room) return;
  const world = room.world || { width: 5200, height: 5200 };
  ctx.fillStyle = "#55b947";
  ctx.fillRect(-camera.x, -camera.y, world.width, world.height);

  ctx.fillStyle = "#2f8fdd";
  ctx.fillRect(-camera.x, -camera.y, world.width, 110);
  ctx.fillRect(-camera.x, world.height - camera.y - 110, world.width, 110);
  ctx.fillRect(-camera.x, -camera.y, 110, world.height);
  ctx.fillRect(world.width - camera.x - 110, -camera.y, 110, world.height);

  drawRoad([[260, 780], [1780, 2050], [3900, 2920]]);
  drawRoad([[620, 3300], [2050, 2050], [3550, 980]]);
  drawRoad([[840, 1800], [1850, 1400], [3100, 1780]]);

  for (const b of room.buildings || []) drawBuilding(b);
  for (const t of room.trees || []) drawTree(t);
  for (const r of room.rocks || []) drawRock(r);
  for (const chest of room.chests || []) drawChest(chest);
  for (const item of room.loot || []) drawLoot(item);
  for (const build of room.builds || []) drawBuild(build);

  if (room.storm) drawStorm(room.storm);
  if (room.matchPhase === "bus" && room.bus) drawBattleBus();
}
function drawRoad(points) {
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(62,67,72,.95)"; ctx.lineWidth = 30;
  ctx.beginPath();
  ctx.moveTo(points[0][0] - camera.x, points[0][1] - camera.y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0] - camera.x, points[i][1] - camera.y);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,221,126,.72)"; ctx.lineWidth = 4; ctx.setLineDash([18, 18]);
  ctx.stroke(); ctx.setLineDash([]);
}
function drawBuilding(b) {
  const x = b.x - camera.x, y = b.y - camera.y;
  ctx.fillStyle = "#657181"; ctx.fillRect(x, y, b.w, b.h);
  ctx.fillStyle = "#38404a"; ctx.fillRect(x + 8, y + 8, b.w - 16, 16);
  ctx.strokeStyle = "rgba(0,0,0,.28)"; ctx.lineWidth = 3; ctx.strokeRect(x, y, b.w, b.h);
}
function drawTree(t) {
  const x = t.x - camera.x, y = t.y - camera.y;
  ctx.fillStyle = "#7a4b2a"; ctx.fillRect(x - 5, y + 8, 10, 22);
  ctx.beginPath(); ctx.arc(x, y, 24, 0, Math.PI * 2); ctx.fillStyle = "#1d6b25"; ctx.fill();
  ctx.beginPath(); ctx.arc(x - 6, y - 7, 16, 0, Math.PI * 2); ctx.fillStyle = "#34a53f"; ctx.fill();
}
function drawRock(r) {
  const x = r.x - camera.x, y = r.y - camera.y;
  ctx.beginPath(); ctx.ellipse(x, y, 26, 19, -0.3, 0, Math.PI * 2); ctx.fillStyle = "#7f8995"; ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,.22)"; ctx.lineWidth = 3; ctx.stroke();
}
function drawChest(c) {
  if (c.opened) return;
  const x = c.x - camera.x, y = c.y - camera.y;
  ctx.fillStyle = "#ffbf21"; ctx.fillRect(x - 22, y - 14, 44, 28);
  ctx.fillStyle = "#7a421c"; ctx.fillRect(x - 18, y - 8, 36, 18);
  ctx.fillStyle = "#fff1a8"; ctx.fillRect(x - 4, y - 3, 8, 8);
}
function drawLoot(item) {
  const x = item.x - camera.x, y = item.y - camera.y;
  const color = item.type === "weapon" ? "#2fb4ff" : item.type === "shield" ? "#42d9ff" : item.type === "heal" ? "#55d66b" : item.type === "material" ? "#ffcf4a" : "#ffffff";
  ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = "white"; ctx.font = "bold 10px Arial"; ctx.textAlign = "center";
  const label = item.weapon || item.ammoType || item.item || item.material || "loot";
  ctx.fillText(label.slice(0, 8), x, y - 18);
}
function drawBuild(build) {
  const x = build.x - camera.x, y = build.y - camera.y;
  ctx.save(); ctx.translate(x, y); ctx.rotate(build.angle || 0);
  ctx.globalAlpha = 0.86;
  ctx.fillStyle = build.material === "wood" ? "#a66a3a" : build.material === "brick" ? "#a04e46" : "#8fa3b8";
  if (build.type === "ramp") {
    ctx.beginPath(); ctx.moveTo(-55, 45); ctx.lineTo(55, 45); ctx.lineTo(55, -45); ctx.closePath(); ctx.fill();
  } else {
    ctx.fillRect(-60, -13, 120, 26);
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.lineWidth = 2; ctx.strokeRect(-60, -13, 120, 26);
  ctx.restore();
}
function drawStorm(storm) {
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, canvas.width, canvas.height);
  ctx.arc(storm.x - camera.x, storm.y - camera.y, storm.radius, 0, Math.PI * 2, true);
  ctx.fillStyle = "rgba(120,0,255,.20)"; ctx.fill();
  ctx.beginPath(); ctx.arc(storm.x - camera.x, storm.y - camera.y, storm.radius, 0, Math.PI * 2);
  ctx.strokeStyle = "#c271ff"; ctx.lineWidth = 5; ctx.stroke();
  ctx.restore();
}
function drawBattleBus() {
  const pos = busPosition();
  const s = worldToScreen(pos.x, pos.y);
  const bus = room.bus;
  const angle = Math.atan2(bus.endY - bus.startY, bus.endX - bus.startX);
  const start = worldToScreen(bus.startX, bus.startY), end = worldToScreen(bus.endX, bus.endY);
  ctx.save();
  ctx.strokeStyle = "rgba(255,207,74,.95)"; ctx.lineWidth = 8; ctx.setLineDash([24, 16]);
  ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke(); ctx.setLineDash([]);
  ctx.translate(s.x, s.y); ctx.rotate(angle);
  ctx.beginPath(); ctx.arc(0, -120, 56, 0, Math.PI * 2); ctx.fillStyle = "#7bd9ff"; ctx.fill(); ctx.strokeStyle = "#e5fbff"; ctx.lineWidth = 5; ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,.82)"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-44, -25); ctx.lineTo(-24, -85); ctx.moveTo(44, -25); ctx.lineTo(24, -85); ctx.moveTo(-10, -25); ctx.lineTo(-6, -82); ctx.moveTo(10, -25); ctx.lineTo(6, -82); ctx.stroke();
  ctx.fillStyle = "#1398ff"; ctx.fillRect(-88, -26, 176, 52);
  ctx.fillStyle = "#ffcf4a"; ctx.fillRect(-94, -1, 188, 10);
  ctx.fillStyle = "#fff"; ctx.font = "bold 16px Arial"; ctx.textAlign = "center"; ctx.fillText("BATTLE BUS", 0, 52);
  ctx.restore();
}
function drawPlayers() {
  if (!room) return;
  for (const player of room.players) drawPlayer(player);
}
function drawPlayer(player) {
  const x = player.x - camera.x;
  const y = player.y - camera.y - (player.phase === "drop" ? Math.min(120, player.dropHeight * 0.05) : 0);
  if (!player.alive) ctx.globalAlpha = 0.35;
  if (player.phase === "bus") return;

  if (player.phase === "drop" && player.gliderOpen) drawGlider(x, y - 46);

  ctx.save(); ctx.translate(x, y);
  ctx.beginPath(); ctx.ellipse(0, 18, 15, 6, 0, 0, Math.PI * 2); ctx.fillStyle = "rgba(0,0,0,.24)"; ctx.fill();
  ctx.strokeStyle = "#111827"; ctx.lineWidth = 5; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-4, 12); ctx.lineTo(-6, 23); ctx.moveTo(4, 12); ctx.lineTo(6, 23); ctx.stroke();
  ctx.fillStyle = player.color || "#2fb4ff"; ctx.fillRect(-9, -5, 18, 20);
  ctx.beginPath(); ctx.arc(0, -13, 7, 0, Math.PI * 2); ctx.fillStyle = "#ffd7b6"; ctx.fill();
  ctx.strokeStyle = "#ffd7b6"; ctx.lineWidth = 4; ctx.beginPath();
  ctx.moveTo(-5, 2); ctx.lineTo(Math.cos(player.angle) * 13, Math.sin(player.angle) * 13 + 2);
  ctx.moveTo(5, 2); ctx.lineTo(Math.cos(player.angle) * 15, Math.sin(player.angle) * 15 + 2);
  ctx.stroke();
  drawGun(player.angle, currentWeaponFor(player));
  if (player.id === selfId) { ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.strokeRect(-12, -8, 24, 28); }
  ctx.restore(); ctx.globalAlpha = 1;
  ctx.fillStyle = player.isBot ? "#ffcf4a" : "white"; ctx.font = "bold 13px Arial"; ctx.textAlign = "center"; ctx.fillText(player.name, x, y - 34);
  if (player.health < 100 || player.shield < 100) {
    ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(x - 22, y - 30, 44, 5);
    ctx.fillStyle = "#55d66b"; ctx.fillRect(x - 22, y - 30, 44 * (player.health / 100), 5);
  }
}
function currentWeaponFor(player) {
  return player.inventory?.slots?.[player.inventory.selected] || player.inventory?.slots?.find(Boolean);
}
function drawGlider(x, y) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = "#ffcf4a"; ctx.beginPath(); ctx.moveTo(-54, 0); ctx.quadraticCurveTo(0, -32, 54, 0); ctx.quadraticCurveTo(0, 20, -54, 0); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-30, 5); ctx.lineTo(-8, 42); ctx.moveTo(30, 5); ctx.lineTo(8, 42); ctx.stroke();
  ctx.restore();
}
function drawGun(angle, weapon) {
  ctx.save(); ctx.rotate(angle);
  const len = weapon?.type === "sniper" ? 40 : weapon?.type === "shotgun" ? 34 : 28;
  ctx.fillStyle = "#111827"; ctx.fillRect(8, -3, len, 6); ctx.fillRect(17, 2, 4, 10);
  ctx.fillStyle = "#ffcf4a"; ctx.fillRect(8 + len - 3, -1, 8, 2);
  ctx.restore();
}
function drawShots() {
  for (const shot of shots) {
    const range = shot.weapon === "shotgun" ? 360 : shot.weapon === "sniper" ? 1100 : 680;
    const sx = shot.x - camera.x + Math.cos(shot.angle) * 24;
    const sy = shot.y - camera.y + Math.sin(shot.angle) * 24;
    const ex = shot.x - camera.x + Math.cos(shot.angle) * range;
    const ey = shot.y - camera.y + Math.sin(shot.angle) * range;
    ctx.globalAlpha = shot.life / 18;
    ctx.strokeStyle = shot.headshot ? "#ffcf4a" : "#f8fafc";
    ctx.lineWidth = shot.headshot ? 4 : 2;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.globalAlpha = 1; shot.life--;
  }
  shots = shots.filter(shot => shot.life > 0);
}
function updateMinimap() {
  if (!mini || !room) return;
  const w = minimap.width, h = minimap.height;
  mini.clearRect(0, 0, w, h);
  mini.fillStyle = "#55b947"; mini.fillRect(0, 0, w, h);
  mini.fillStyle = "#2f8fdd"; mini.fillRect(0, 0, w, 8); mini.fillRect(0, h-8, w, 8); mini.fillRect(0, 0, 8, h); mini.fillRect(w-8, 0, 8, h);
  if (room.storm) {
    mini.beginPath(); mini.arc(room.storm.x / room.world.width * w, room.storm.y / room.world.height * h, room.storm.radius / room.world.width * w, 0, Math.PI * 2);
    mini.strokeStyle = "#c271ff"; mini.lineWidth = 3; mini.stroke();
  }
  if (room.bus && room.matchPhase === "bus") {
    mini.strokeStyle = "#ffcf4a"; mini.lineWidth = 2; mini.setLineDash([5,4]);
    mini.beginPath(); mini.moveTo(room.bus.startX / room.world.width * w, room.bus.startY / room.world.height * h);
    mini.lineTo(room.bus.endX / room.world.width * w, room.bus.endY / room.world.height * h); mini.stroke(); mini.setLineDash([]);
  }
  for (const p of room.players) {
    if (!p.alive) continue;
    mini.beginPath(); mini.arc(p.x / room.world.width * w, p.y / room.world.height * h, p.id === selfId ? 5 : p.isBot ? 2.4 : 3.5, 0, Math.PI * 2);
    mini.fillStyle = p.id === selfId ? "#ffffff" : p.isBot ? "#ffcf4a" : "#2fb4ff"; mini.fill();
  }
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
    updatePrompt();
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
