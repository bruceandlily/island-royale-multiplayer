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
const fillToggleBtn = document.getElementById("fillToggleBtn");

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
let localPlayer = { x: 2100, y: 2100, angle: 0, speed: 2.35, gliderOpen: false, dropHeight: 0 };
let shots = [];
let lastKnownPhase = "lobby";
let justJumpedFromBus = false;
let eliminatedReturning = false;
let eliminatedReturnedToLobby = false;
let eliminationReturnTimer = null;
let particles = [];
let walkAnim = new Map();
let buildMode = false;
let buildType = "wall";
let buildMaterial = "wood";
let lastShootAt = 0;
let selectedCosmetic = loadLocal("selectedCosmetic", { outfit: "Raider", color: "#2fb4ff", banner: "Blue" });
let settings = loadLocal("settings", { graphics: "high", volume: 60, controls: "on", mode: "Solo", fill: false });
if (settings.fill === undefined) settings.fill = false;
let quests = loadLocal("quests", { eliminations: 0, matches: 0, party: 0 });
let progression = loadLocal("progression", {
  xp: 0,
  matches: 0,
  wins: 0,
  eliminations: 0,
  highestTier: 1
});
let activeMatchKey = null;
let matchAwarded = false;

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
  if (document.activeElement?.id === "partyChatInput") return;
  keys[event.key.toLowerCase()] = true;

  if (event.key === "Escape" && room?.phase === "game") {
    lobby.classList.remove("hidden");
    hud.classList.add("hidden");
    return;
  }

  if (room?.phase === "game") {
    if (event.code === "Space" && getMe()?.phase === "bus") {
      clientSideJumpFromBus();
      return;
    }
    if (event.key.toLowerCase() === "e") socket.emit("interact");
    if (event.key.toLowerCase() === "b" && room?.phase === "game") {
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

function beginEliminationReturn() {
  if (eliminatedReturning || eliminatedReturnedToLobby) return;

  eliminatedReturning = true;
  centerMessage.innerHTML = "You are eliminated<br><span style='font-size:28px;color:#ffcf4a;'>Returning to lobby...</span>";
  awardMatchXP("Eliminated");
  toastMessage("Returning to lobby...");

  clearTimeout(eliminationReturnTimer);
  eliminationReturnTimer = setTimeout(() => {
    eliminatedReturnedToLobby = true;
    eliminatedReturning = false;

    hud.classList.add("hidden");
    lobby.classList.remove("hidden");
    switchTab("play");

    centerMessage.textContent = "";
    toastMessage("Returned to lobby");

    updateLobbyUI();
  }, 2600);
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

function syncLocalToServerPlayer(me, force = false) {
  if (!me) return;

  const farAway = Math.hypot((localPlayer.x || 0) - me.x, (localPlayer.y || 0) - me.y) > 600;
  const phaseChanged = lastKnownPhase !== me.phase;

  if (force || farAway || phaseChanged || me.phase === "bus") {
    localPlayer.x = me.x;
    localPlayer.y = me.y;
    localPlayer.angle = me.angle || localPlayer.angle || 0;
    localPlayer.dropHeight = me.dropHeight || 0;
    localPlayer.gliderOpen = !!me.gliderOpen;
  }

  lastKnownPhase = me.phase || lastKnownPhase;
}

function clientSideJumpFromBus() {
  const me = getMe();
  if (!me || me.phase !== "bus") return;

  justJumpedFromBus = true;
  me.phase = "drop";
  me.dropHeight = 1650;
  me.gliderOpen = false;

  localPlayer.x = me.x;
  localPlayer.y = me.y;
  localPlayer.angle = me.angle || localPlayer.angle || 0;
  localPlayer.dropHeight = 1650;
  localPlayer.gliderOpen = false;

  centerMessage.textContent = "Dropping...";
  toastMessage("Dropping — use WASD to steer");
  socket.emit("jumpFromBus");
}

function modeRequiredPlayers(mode) {
  if (mode === "Squads") return 4;
  if (mode === "Trios") return 3;
  if (mode === "Duos") return 2;
  return 1;
}

function realPlayerCount() {
  if (!room) return 1;
  return room.players.filter(p => !p.isBot).length;
}

function currentModeName() {
  return room?.mode || settings.mode || "Solo";
}

function modeTeamSize(mode = currentModeName()) {
  if (mode === "Squads") return 4;
  if (mode === "Trios") return 3;
  if (mode === "Duos") return 2;
  return 1;
}

function currentFillEnabled() {
  return !!(room ? room.fill : settings.fill);
}

function syncFillButton(fill = currentFillEnabled()) {
  if (!fillToggleBtn) return;
  fillToggleBtn.textContent = fill ? "FILL" : "NO FILL";
  fillToggleBtn.classList.toggle("fillOn", !!fill);
  fillToggleBtn.classList.toggle("locked", !!room && !isRoomHost());
}

function modeRequirementMessage(mode = currentModeName(), count = realPlayerCount()) {
  const teamSize = modeTeamSize(mode);
  const fill = currentFillEnabled();

  if (mode === "Solo") {
    return `Solo needs exactly 1 real player. You have ${count}.`;
  }

  if (fill) {
    const missing = Math.max(0, teamSize - count);
    return missing > 0
      ? `${mode} Fill: waiting for ${missing} real teammate(s).`
      : `${mode} Fill team is full.`;
  }

  return `${mode} No Fill allows 1 to ${teamSize} real player(s). You have ${count}.`;
}

function canStartForMode(mode = currentModeName(), count = realPlayerCount()) {
  const teamSize = modeTeamSize(mode);
  if (mode === "Solo") return count === 1;
  return count >= 1 && count <= teamSize;
}

function allRealPlayersReady() {
  if (!room) return false;
  if (partyChatStatus) partyChatStatus.textContent = "Press / to chat";
  const humans = room.players.filter(p => !p.isBot);
  return humans.length > 0 && humans.every(p => p.ready);
}

function notReadyNames() {
  if (!room) return [];
  return room.players.filter(p => !p.isBot && !p.ready).map(p => p.name || "Player");
}


function isRoomHost() {
  return !!room && room.hostId === selfId;
}

function syncModeButtons(mode = currentModeName()) {
  document.querySelectorAll(".modePickButton").forEach(button => {
    button.classList.toggle("active", button.dataset.mode === mode);
    button.classList.toggle("locked", !!room && !isRoomHost());
  });

  if (selectedModeTitle) selectedModeTitle.textContent = `${String(mode).toUpperCase()} BATTLE ROYALE`;
  syncFillButton();
}

function setModeEverywhere(mode, showToast = true) {
  if (!["Solo", "Duos", "Trios", "Squads"].includes(mode)) mode = "Solo";

  // If you are in someone else's room, only the host can change it.
  if (room && !isRoomHost()) {
    const oldMode = room.mode || settings.mode || "Solo";
    modeSelect.value = oldMode;
    syncModeButtons(oldMode);
    if (showToast) toastMessage("Only the host can change mode");
    return;
  }

  settings.mode = mode;
  saveLocal("settings", settings);

  if (modeSelect && modeSelect.value !== mode) modeSelect.value = mode;
  syncModeButtons(mode);

  if (room && isRoomHost()) {
    // Optimistic local update so the dropdown/buttons do not snap back.
    room.mode = mode;
    updateLobbyUI();

    socket.emit("setMode", { mode }, response => {
      if (!response?.ok) {
        toastMessage(response?.error || "Could not change mode");
        return;
      }
      if (showToast) toastMessage(`${mode} selected`);
    });
  } else {
    updateLobbyUI();
    if (showToast) {
      toastMessage(mode === "Solo" ? "Solo selected" : `${mode} selected — invite exactly ${modeRequiredPlayers(mode)} players`);
    }
  }
}


function setFillEverywhere(fill, showToast = true) {
  fill = !!fill;

  if (room && !isRoomHost()) {
    syncFillButton(room.fill);
    if (showToast) toastMessage("Only the host can change Fill");
    return;
  }

  settings.fill = fill;
  saveLocal("settings", settings);
  syncFillButton(fill);

  if (room && isRoomHost()) {
    room.fill = fill;
    updateLobbyUI();

    socket.emit("setFill", { fill }, response => {
      if (!response?.ok) {
        toastMessage(response?.error || "Could not change Fill");
        return;
      }
      if (showToast) toastMessage(fill ? "Fill ON" : "No Fill");
    });
  } else {
    updateLobbyUI();
    if (showToast) toastMessage(fill ? "Fill ON" : "No Fill");
  }
}


function playerPayload() {
  const safeName = nameInput && nameInput.value ? nameInput.value : "Player";
  return {
    name: safeName,
    color: selectedCosmetic.color,
    outfit: selectedCosmetic.outfit,
    banner: selectedCosmetic.banner,
    mode: settings.mode || "Solo",
    fill: !!settings.fill
  };
}
function switchTab(tabName) {
  document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.tab === tabName));
  document.querySelectorAll(".tabPanel").forEach(panel => panel.classList.remove("activePanel"));
  document.getElementById(`${tabName}Panel`)?.classList.add("activePanel");
  if (tabName === "rooms") requestRoomList();
  if (tabName === "quests") updateQuestUI();
  if (tabName === "itemshop") renderShop();
  if (tabName === "profile") renderProfile();
  if (tabName === "leaderboards") renderLeaderboard();
  if (tabName === "battlepass") renderBattlePass();
  renderStageParty();
}
document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => switchTab(tab.dataset.tab)));

function enableRoomButtons() {
  copyInviteBtn.classList.remove("disabled");
  partyCopyInviteBtn.classList.remove("disabled");
  readyBtn.classList.remove("disabled");
  startMatchBtn.classList.remove("disabled");
}
function updateLobbyUI() {
  const mainNameTag = document.getElementById("mainNameTag");
  if (mainNameTag) mainNameTag.textContent = (nameInput && nameInput.value) ? nameInput.value : "Player";
  const topPartyCount = document.getElementById("topPartyCount");
  const stageRoomText = document.getElementById("stageRoomText");

  if (!room) {
    roomCodeDisplay.textContent = "No Room";
    roomSub.textContent = settings.fill && (settings.mode || "Solo") !== "Solo"
      ? "Fill is ON. Click FIND MATCH to search for real teammates."
      : "No Fill can start with your current party size and bots will fill the rest.";
    partyList.innerHTML = '<div class="emptyParty">No players yet.</div>';
    const mode = settings.mode || "Solo";
    startMatchBtn.textContent = settings.fill && mode !== "Solo" ? "FIND MATCH" : "QUICK TEST";
    startMatchBtn.classList.remove("disabled");
    syncFillButton(settings.fill);
    const mainReadyText = document.getElementById("mainReadyText");
    if (mainReadyText) {
      mainReadyText.textContent = "Not Ready";
      mainReadyText.style.color = "#ff5667";
    }
    if (topPartyCount) topPartyCount.textContent = "1";
    if (partyChatStatus) partyChatStatus.textContent = "Create/join a room to chat";
    if (stageRoomText) stageRoomText.textContent = settings.fill && (settings.mode || "Solo") !== "Solo"
      ? `${settings.mode} Fill selected. Find Match will search for real teammates.`
      : `${settings.mode || "Solo"} No Fill selected. You can start with your party size.`;
    renderFunctionalPanels();
    return;
  }
  const humans = room.players.filter(p => !p.isBot);
  roomCodeDisplay.textContent = room.code;
  const requiredForMode = modeTeamSize(room.mode || "Solo");
  const modeOkForRoom = canStartForMode(room.mode || "Solo", humans.length);
  const fillOn = !!room.fill;
  const readyOkForRoom = room.players.filter(p => !p.isBot).every(p => p.ready);
  roomSub.textContent = room.matchmakingQueued
    ? (room.matchmakingMessage || "Searching for players...")
    : modeOkForRoom
      ? (readyOkForRoom
        ? `${humans.length}/${room.maxPlayers || 16} real player(s) • ${room.mode || "Solo"} • ${fillOn ? "Fill" : "No Fill"}`
        : `Correct mode, but everyone must ready up first. Waiting on: ${notReadyNames().join(", ")}`)
      : `${modeRequirementMessage(room.mode || "Solo", humans.length)} Change mode or invite/remove players.`;
  hudRoom.textContent = room.code;
  if (document.activeElement !== modeSelect) {
    modeSelect.value = room.mode || settings.mode || "Solo";
  }
  syncModeButtons(room.mode || settings.mode || "Solo");
  syncFillButton(!!room.fill);

  const me = getMe();
  const isHost = room.hostId === selfId;
  readyBtn.textContent = me?.ready ? "Unready" : "Ready";
  const modeOk = canStartForMode(room.mode || "Solo", humans.length);
  const readyOk = allRealPlayersReady();
  startMatchBtn.textContent = room
    ? (isHost
      ? (room.matchmakingQueued ? "SEARCHING..." : (modeOk ? (readyOk ? ((room.fill && room.mode !== "Solo" && humans.length < modeTeamSize(room.mode)) ? "FIND FILL" : "START MATCH") : "READY UP") : "WRONG MODE"))
      : "WAITING HOST")
    : "QUICK TEST";
  startMatchBtn.classList.toggle("disabled", room ? (!isHost || !modeOk || !readyOk || room.matchmakingQueued) : false);

  partyList.innerHTML = humans.map(player => {
    const isMe = player.id === selfId;
    const host = player.id === room.hostId ? "Host" : "Party";
    const readyClass = player.ready ? "ready" : "";
    const readyText = player.ready ? "Ready" : "Not Ready";
    return `
      <div class="partyPlayer">
        <div class="partyIdentity">
          <div class="partyAvatarWrap">
            ${renderAvatarMarkup(player)}
          </div>
          <div class="partyInfo">
            <div class="partyName" style="color:${player.color}">${escapeHtml(player.name)}${isMe ? " (You)" : ""}</div>
            <div class="partyMeta">${host} • ${escapeHtml(player.outfit || "Raider")} • ${player.alive ? "Alive" : "Down"}</div>
          </div>
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
  updateProgressionUI();
}


const XP_PER_LEVEL = 1000;
const MAX_BATTLEPASS_TIERS = 50;

const BATTLE_PASS_REWARDS = [
  "Banner", "100 XP", "Raider Blue", "Emote", "V-Bucks",
  "Scout Green", "Spray", "Music", "Striker Red", "Glider",
  "Pickaxe", "Shadow Purple", "Loading Screen", "Wrap", "Gold Banner",
  "Neon Outfit", "Back Bling", "Contrail", "Inferno", "Legendary Style"
];

function getPlayerLevel() {
  return Math.floor((progression.xp || 0) / XP_PER_LEVEL) + 1;
}

function getXpIntoLevel() {
  return (progression.xp || 0) % XP_PER_LEVEL;
}

function getUnlockedTier() {
  return Math.min(MAX_BATTLEPASS_TIERS, getPlayerLevel());
}

function saveProgression() {
  progression.highestTier = Math.max(progression.highestTier || 1, getUnlockedTier());
  saveLocal("progression", progression);
}

function showLevelUpToast(oldLevel, newLevel) {
  if (newLevel <= oldLevel) return;
  const el = document.createElement("div");
  el.className = "levelUpToast";
  el.textContent = `Level Up! ${oldLevel} → ${newLevel}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2300);
}

function addXP(amount, reason = "XP earned") {
  amount = Math.max(0, Math.round(amount || 0));
  if (!amount) return;

  const oldLevel = getPlayerLevel();
  progression.xp = (progression.xp || 0) + amount;
  const newLevel = getPlayerLevel();

  saveProgression();
  updateProgressionUI();
  renderBattlePass();
  renderProfile();

  toastMessage(`+${amount} XP — ${reason}`);
  showLevelUpToast(oldLevel, newLevel);
}

function currentMatchKey() {
  if (!room) return null;
  return `${room.code || "room"}_${room.startedAt || "match"}`;
}

function awardMatchXP(reason = "Match Complete") {
  const key = currentMatchKey();
  if (!key || matchAwarded) return;
  matchAwarded = true;

  const me = getMe();
  const kills = me?.kills || 0;
  const won = room?.winner && me && room.winner.teamId && me.teamId && room.winner.teamId === me.teamId;
  const aliveBonus = me?.alive ? 50 : 0;

  let xp = 120;
  xp += kills * 140;
  xp += aliveBonus;
  if (won) xp += 500;

  progression.matches = (progression.matches || 0) + 1;
  progression.eliminations = Math.max(progression.eliminations || 0, kills);
  if (won) progression.wins = (progression.wins || 0) + 1;

  addXP(xp, reason);
}

function updateProgressionUI() {
  const level = getPlayerLevel();
  const xp = getXpIntoLevel();
  const tier = getUnlockedTier();

  const seasonLevelText = document.getElementById("seasonLevelText");
  const seasonXpText = document.getElementById("seasonXpText");
  const seasonXpFill = document.getElementById("seasonXpFill");
  const battlePassSummary = document.getElementById("battlePassSummary");
  const freePassTierText = document.getElementById("freePassTierText");
  const tierProgressText = document.getElementById("tierProgressText");

  if (seasonLevelText) seasonLevelText.textContent = level;
  if (seasonXpText) seasonXpText.textContent = `${xp} / ${XP_PER_LEVEL} XP`;
  if (seasonXpFill) seasonXpFill.style.width = `${Math.min(100, (xp / XP_PER_LEVEL) * 100)}%`;
  if (battlePassSummary) battlePassSummary.textContent = `Level ${level} • Tier ${tier} unlocked`;
  if (freePassTierText) freePassTierText.textContent = `TIER ${tier}`;
  if (tierProgressText) tierProgressText.textContent = `${tier} / ${MAX_BATTLEPASS_TIERS}`;
}

const SHOP_ITEMS = [
  { outfit: "Raider", color: "#2fb4ff", banner: "Blue", rarity: "Default" },
  { outfit: "Striker", color: "#ff5b67", banner: "Gold", rarity: "Rare" },
  { outfit: "Scout", color: "#55d66b", banner: "Blue", rarity: "Uncommon" },
  { outfit: "Shadow", color: "#b65cff", banner: "Purple", rarity: "Epic" },
  { outfit: "Sunburst", color: "#ffcf4a", banner: "Gold", rarity: "Legendary" },
  { outfit: "Neon", color: "#00e5ff", banner: "Purple", rarity: "Epic" },
  { outfit: "Inferno", color: "#ff7a00", banner: "Gold", rarity: "Rare" },
  { outfit: "Tactical", color: "#8dff55", banner: "Blue", rarity: "Uncommon" }
];


function colorFromName(input, fallback = "#2fb4ff") {
  const text = String(input || "");
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  const palette = ["#ffd9bb", "#efc09f", "#dca27f", "#b6795c"];
  return palette[Math.abs(hash) % palette.length] || fallback;
}

function shadeHex(hex, amount = -18) {
  const safe = String(hex || "#2fb4ff").replace("#", "");
  const value = safe.length === 3 ? safe.split("").map(c => c + c).join("") : safe.padEnd(6, "0").slice(0, 6);
  const num = parseInt(value, 16);
  let r = (num >> 16) + amount;
  let g = ((num >> 8) & 0xff) + amount;
  let b = (num & 0xff) + amount;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
}

function getCharacterLook(player = {}) {
  const accent = player.color || selectedCosmetic.color || "#2fb4ff";
  const outfit = String(player.outfit || "Raider").toLowerCase();
  const seed = `${player.id || ""}_${player.name || ""}_${player.outfit || ""}`;
  const skin = colorFromName(seed + "_skin", "#ffd9bb");
  const hairChoices = ["#23140e", "#6d4220", "#c08a43", "#0f172a"];
  const hair = hairChoices[Math.abs((seed.length * 7) % hairChoices.length)];
  const cape = (player.banner || "Blue") === "Gold"
    ? "linear-gradient(180deg,#ffcf4a,#a16207)"
    : (player.banner || "Blue") === "Purple"
      ? "linear-gradient(180deg,#9f67ff,#371b9a)"
      : "linear-gradient(180deg,#56c8ff,#1958ff)";

  let vest = "#27364a";
  let pants = "#1b2238";
  let boots = "#09101b";
  let glove = "#111827";

  if (outfit.includes("striker")) {
    vest = "#35203b";
    pants = "#221631";
  } else if (outfit.includes("scout")) {
    vest = "#214034";
    pants = "#17271f";
  } else if (outfit.includes("shadow")) {
    vest = "#2b213d";
    pants = "#19152a";
  }

  return {
    skin,
    hair,
    accent,
    accentDark: shadeHex(accent, -34),
    vest,
    pants,
    boots,
    glove,
    cape
  };
}

function renderAvatarMarkup(player = {}) {
  const look = getCharacterLook(player);
  const style = [
    `--skin:${look.skin}`,
    `--hair:${look.hair}`,
    `--accent:${look.accent}`,
    `--accentDark:${look.accentDark}`,
    `--vest:${look.vest}`,
    `--pants:${look.pants}`,
    `--boots:${look.boots}`,
    `--glove:${look.glove}`,
    `--cape:${look.cape}`
  ].join(";");

  return `
    <div class="fortCharacter bigCharacter v56Avatar" style="${style}">
      <div class="cape"></div>
      <div class="neck"></div>
      <div class="head">
        <span class="brow left"></span>
        <span class="brow right"></span>
        <span class="eye left"></span>
        <span class="eye right"></span>
        <span class="mouth"></span>
      </div>
      <div class="hair"></div>
      <div class="body"></div>
      <div class="torsoVest"></div>
      <div class="chestPlate"></div>
      <div class="strap"></div>
      <div class="belt"></div>
      <div class="beltBuckle"></div>
      <div class="arm left upper"></div>
      <div class="arm left fore"></div>
      <div class="arm right upper"></div>
      <div class="arm right fore"></div>
      <div class="glove left"></div>
      <div class="glove right"></div>
      <div class="thigh left"></div>
      <div class="thigh right"></div>
      <div class="shin left"></div>
      <div class="shin right"></div>
      <div class="boot left"></div>
      <div class="boot right"></div>
      <div class="gun"></div>
    </div>
  `;
}

function renderCharacterHtml(player, index) {
  const ready = player.ready ? "Ready" : "Not Ready";
  const readyClass = player.ready ? "ready" : "notReady";

  return `
    <div class="dynamicHero hero${index + 1}">
      <div class="nameTag">
        <span class="controllerBubble">${index === 0 ? "A" : "✓"}</span>
        <b>${escapeHtml(player.name || "Player")}</b>
        <small class="${readyClass}">${ready}</small>
      </div>
      <div class="lightBeam ${index > 0 ? "smallBeam" : ""}"></div>
      <div class="glowDisc ${index > 0 ? "smallDisc" : ""}"></div>
      ${renderAvatarMarkup(player)}
    </div>
  `;
}


function renderStageParty() {
  const stage = document.getElementById("stagePartyMembers");
  if (!stage) return;

  let players = room ? room.players.filter(p => !p.isBot).slice(0, 4) : [];
  if (!players.length) {
    players = [{
      id: selfId || "local",
      name: (nameInput && nameInput.value) ? nameInput.value : "Player",
      ready: false,
      color: selectedCosmetic.color,
      banner: selectedCosmetic.banner,
      outfit: selectedCosmetic.outfit
    }];
  }

  stage.innerHTML = players.map((player, index) => renderCharacterHtml(player, index)).join("");

  const leftInvite = document.getElementById("stageInviteLeft");
  const rightInvite = document.getElementById("stageInviteRight");
  const openSlots = Math.max(0, 4 - players.length);

  if (leftInvite) leftInvite.style.display = openSlots >= 1 ? "grid" : "none";
  if (rightInvite) rightInvite.style.display = openSlots >= 2 ? "grid" : "none";
}

async function inviteFromStage() {
  if (!room) {
    toastMessage("Create a room first, then invite friends");
    switchTab("play");
    return;
  }
  await copyInvite();
}

function renderShop() {
  const grid = document.getElementById("shopGrid");
  if (!grid) return;

  grid.innerHTML = SHOP_ITEMS.map(item => {
    const equipped = selectedCosmetic.outfit === item.outfit;
    return `
      <div class="shopItem ${equipped ? "equipped" : ""}">
        <div class="shopPreview" style="background:linear-gradient(135deg, ${item.color}, #111827);"></div>
        <b>${escapeHtml(item.outfit)}</b>
        <span>${escapeHtml(item.rarity)} Outfit • Free test item</span>
        <button onclick="equipShopItem('${escapeHtml(item.outfit)}')">${equipped ? "EQUIPPED" : "EQUIP"}</button>
      </div>
    `;
  }).join("");
}

window.equipShopItem = function(outfit) {
  const item = SHOP_ITEMS.find(x => x.outfit === outfit);
  if (!item) return;

  selectedCosmetic = {
    outfit: item.outfit,
    color: item.color,
    banner: item.banner
  };

  saveLocal("selectedCosmetic", selectedCosmetic);
  applyCosmeticPreview();
  renderShop();
  renderStageParty();

  if (room) {
    socket.emit("updateCosmetics", playerPayload(), () => {});
  }

  toastMessage(`${item.outfit} equipped`);
};

function renderProfile() {
  const box = document.getElementById("profileStats");
  if (!box) return;

  const me = getMe();
  const name = (nameInput && nameInput.value) ? nameInput.value : me?.name || "Player";
  const roomPlayers = room ? room.players.filter(p => !p.isBot).length : 0;
  const kills = Math.max(me?.kills || 0, progression.eliminations || 0);
  const level = getPlayerLevel();
  const tier = getUnlockedTier();

  box.innerHTML = `
    <div class="profileCard"><span>Name</span><b style="font-size:26px">${escapeHtml(name)}</b></div>
    <div class="profileCard"><span>Level</span><b>${level}</b></div>
    <div class="profileCard"><span>Battle Pass Tier</span><b>${tier}</b></div>
    <div class="profileCard"><span>Total XP</span><b style="font-size:30px">${progression.xp || 0}</b></div>
    <div class="profileCard"><span>Matches</span><b>${progression.matches || quests.matches || 0}</b></div>
    <div class="profileCard"><span>Wins</span><b>${progression.wins || 0}</b></div>
    <div class="profileCard"><span>Eliminations</span><b>${kills}</b></div>
    <div class="profileCard"><span>Current Party</span><b>${roomPlayers || 1}</b></div>
    <div class="profileCard"><span>Mode</span><b style="font-size:28px">${escapeHtml(settings.mode || "Solo")}</b></div>
    <div class="profileCard"><span>Outfit</span><b style="font-size:26px">${escapeHtml(selectedCosmetic.outfit || "Raider")}</b></div>
    <div class="profileCard"><span>Status</span><b style="font-size:28px">${room ? "In Room" : "Lobby"}</b></div>
    <div class="profileCard"><span>Next Level</span><b style="font-size:26px">${getXpIntoLevel()} / ${XP_PER_LEVEL}</b></div>
  `;
}

function renderLeaderboard() {
  const box = document.getElementById("leaderboardList");
  if (!box) return;

  if (!room || !room.players?.length) {
    box.innerHTML = '<div class="emptyParty">No room yet. Create a room or start Quick Test to see real leaderboard data.</div>';
    return;
  }

  const sorted = [...room.players].sort((a, b) => (b.kills || 0) - (a.kills || 0) || (b.alive ? 1 : 0) - (a.alive ? 1 : 0));

  box.innerHTML = `
    <div class="leaderRow header">
      <span>Rank</span><span>Player</span><span>Kills</span><span>Status</span><span>Type</span>
    </div>
    ${sorted.map((p, i) => `
      <div class="leaderRow">
        <span class="leaderRank">#${i + 1}</span>
        <span style="color:${p.color || "#fff"}">${escapeHtml(p.name || "Player")}</span>
        <span>${p.kills || 0}</span>
        <span>${p.alive ? "Alive" : "Out"}</span>
        <span>${p.isBot ? "Bot" : "Real"}</span>
      </div>
    `).join("")}
  `;
}

function renderBattlePass() {
  const box = document.getElementById("battlePassRoad");
  if (!box) return;

  const unlockedTier = getUnlockedTier();
  const startTier = Math.max(1, Math.min(MAX_BATTLEPASS_TIERS - 11, Math.floor((unlockedTier - 1) / 12) * 12 + 1));
  const tiers = Array.from({ length: 12 }, (_, i) => startTier + i).filter(t => t <= MAX_BATTLEPASS_TIERS);

  box.innerHTML = tiers.map(tier => {
    const unlocked = tier <= unlockedTier;
    const current = tier === unlockedTier;
    const reward = BATTLE_PASS_REWARDS[(tier - 1) % BATTLE_PASS_REWARDS.length];

    return `
      <div class="bpTier ${unlocked ? "unlocked" : "locked"} ${current ? "current" : ""}">
        <div class="tierRewardIcon">${unlocked ? "★" : "🔒"}</div>
        <b>Tier ${tier}</b>
        <span>${escapeHtml(reward)}</span>
        <small class="${unlocked ? "claimText" : ""}">${unlocked ? "Unlocked" : `Reach Level ${tier}`}</small>
      </div>
    `;
  }).join("");

  updateProgressionUI();
}

function renderFunctionalPanels() {
  renderStageParty();
  renderShop();
  renderProfile();
  renderLeaderboard();
  renderBattlePass();
}

function applySettingsToUI() {
  graphicsSelect.value = settings.graphics || "high";
  volumeSlider.value = settings.volume ?? 60;
  controlsSelect.value = settings.controls || "on";
  modeSelect.value = settings.mode || "Solo";
  controlsHud?.classList.toggle("hidden", settings.controls === "off");
  syncModeButtons(settings.mode || "Solo");
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

const stageInviteLeft = document.getElementById("stageInviteLeft");
const stageInviteRight = document.getElementById("stageInviteRight");
if (stageInviteLeft) stageInviteLeft.addEventListener("click", inviteFromStage);
if (stageInviteRight) stageInviteRight.addEventListener("click", inviteFromStage);
readyBtn.addEventListener("click", () => socket.emit("toggleReady", response => {
  if (!response?.ok) return toastMessage(response?.error || "Could not ready");
  toastMessage(response.ready ? "You are ready" : "You are not ready");
}));

function startQuickTestMatch() {
  const mode = settings.mode || "Solo";
  const fill = !!settings.fill;

  eliminatedReturning = false;
  eliminatedReturnedToLobby = false;
  clearTimeout(eliminationReturnTimer);

  if (fill && mode !== "Solo") {
    toastMessage(`${mode} Fill: searching for real teammates...`);
    socket.emit("findMatch", playerPayload(), response => {
      if (!response?.ok) return toastMessage(response?.error || "Could not find match");
      room = response.room;
      selfId = response.selfId || selfId;
      enableRoomButtons();
      updateLobbyUI();
      toastMessage(response.message || "Searching for players...");
    });
    return;
  }

  toastMessage(`Starting ${mode} No Fill test...`);
  socket.emit("createRoom", playerPayload(), response => {
    if (!response.ok) return toastMessage(response.error);
    room = response.room;
    selfId = response.selfId;
    enableRoomButtons();
    updateLobbyUI();

    socket.emit("startMatch", { quickTest: true }, startResponse => {
      if (!startResponse?.ok) toastMessage(startResponse?.error || "Could not start test");
    });
  });
}

startMatchBtn.addEventListener("click", () => {
  if (!room) return startQuickTestMatch();

  const humans = room.players.filter(p => !p.isBot).length;
  const mode = room.mode || settings.mode || "Solo";

  if (!canStartForMode(mode, humans)) {
    toastMessage(modeRequirementMessage(mode, humans));
    return;
  }

  if (!allRealPlayersReady()) {
    const names = notReadyNames().join(", ");
    toastMessage(`Everyone must ready up first${names ? ": " + names : ""}`);
    return;
  }

  eliminatedReturning = false;
  eliminatedReturnedToLobby = false;
  clearTimeout(eliminationReturnTimer);

  if (room.fill && mode !== "Solo" && humans < modeTeamSize(mode)) {
    toastMessage(`${mode} Fill: searching for teammates...`);
    socket.emit("findMatch", { ...playerPayload(), mode, fill: true }, response => {
      if (!response?.ok) return toastMessage(response?.error || "Could not find match");
      room = response.room;
      selfId = response.selfId || selfId;
      updateLobbyUI();
      toastMessage(response.message || "Searching for players...");
    });
    return;
  }

  socket.emit("startMatch", response => {
    if (!response?.ok) toastMessage(response?.error || "Could not start");
  });
});
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
  settings.graphics = graphicsSelect.value;
  settings.volume = Number(volumeSlider.value);
  settings.controls = controlsSelect.value;
  settings.mode = modeSelect.value || settings.mode || "Solo";
  settings.fill = currentFillEnabled();
  saveLocal("settings", settings);
  applySettingsToUI();
  setModeEverywhere(settings.mode, true);
});
modeSelect.addEventListener("change", () => {
  setModeEverywhere(modeSelect.value, true);
});
fillToggleBtn?.addEventListener("click", () => {
  setFillEverywhere(!currentFillEnabled(), true);
});
emoteBtn.addEventListener("click", () => window.openLobbyEmoteWheel ? window.openLobbyEmoteWheel(true) : toastMessage("Emote wheel loading"));

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
  const wasAlive = previousMe ? previousMe.alive : true;

  room = state;
  const me = getMe();

  if (me && room.phase === "game") {
    const phaseChanged = previousMe && previousMe.phase !== me.phase;
    syncLocalToServerPlayer(me, phaseChanged || me.phase === "bus" || justJumpedFromBus);
    if (me.phase === "drop") justJumpedFromBus = false;
  }

  updateLobbyUI();
  renderFunctionalPanels();
  updateHud();
  updatePrompt();
  updateMinimap();

  if (room.phase === "game") {
    if (me && wasAlive && !me.alive) {
      beginEliminationReturn();
    }

    if (!eliminatedReturnedToLobby) {
      lobby.classList.add("hidden");
      hud.classList.remove("hidden");
    } else {
      hud.classList.add("hidden");
      lobby.classList.remove("hidden");
    }

    if (previousMe && me && me.kills > previousMe.kills) {
      quests.eliminations = Math.max(quests.eliminations, me.kills);
      saveLocal("quests", quests);
      updateQuestUI();
    }
  }
});
socket.on("roomList", list => updateRoomsUI(list));
socket.on("matchStarted", state => {
  eliminatedReturning = false;
  eliminatedReturnedToLobby = false;
  justJumpedFromBus = false;
  lastKnownPhase = "bus";
  clearTimeout(eliminationReturnTimer);
  room = state;
  activeMatchKey = currentMatchKey();
  matchAwarded = false;
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
  awardMatchXP(winner && getMe() && winner.teamId === getMe().teamId ? "Victory Royale" : "Match Complete");
  centerMessage.textContent = winner ? `${winner.name} wins!` : "Match ended";
  updateLobbyUI(); updateQuestUI();
});
socket.on("shot", shot => {
  shots.push({ ...shot, life: shot.blockedByBuild ? 10 : 18 });
  if (shot.blockedByBuild) {
    toastMessage("Build blocked the shot");
  }
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

  const baseSpeed = me.phase === "drop" ? (localPlayer.gliderOpen ? 5.2 : 4.4) : 2.35;
  localPlayer.x = clamp(localPlayer.x + dx * baseSpeed, 20, room.world.width - 20);
  localPlayer.y = clamp(localPlayer.y + dy * baseSpeed, 20, room.world.height - 20);

  const worldMouse = screenToWorld(mouse.x, mouse.y);
  localPlayer.angle = Math.atan2(worldMouse.y - localPlayer.y, worldMouse.x - localPlayer.x);

  if (me.phase === "drop") {
    // Holding Space opens the glider, but WASD movement always works while falling.
    localPlayer.gliderOpen = localPlayer.gliderOpen || keys[" "];
    localPlayer.dropHeight = Math.max(0, me.dropHeight || localPlayer.dropHeight || 0);
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
  if (me && me.alive && me.phase === "ground" && centerMessage.textContent === "Dropping...") {
    centerMessage.textContent = "";
  }
  if (me && !me.alive && room.phase === "game" && !eliminatedReturning && !eliminatedReturnedToLobby) {
    centerMessage.textContent = "You are eliminated";
  }
}
function updatePrompt() {
  const me = getMe();
  if (!me) return;
  if (me.phase === "bus") phasePrompt.textContent = "SPACE Jump from Bus";
  else if (me.phase === "drop") phasePrompt.textContent = "WASD Steer Drop • Hold SPACE Glider";
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
  if (me.phase === "drop") focus = { x: localPlayer.x, y: localPlayer.y };
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

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

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
  if (!player.alive) return;
  if (player.phase === "bus") return;

  const cache = walkAnim.get(player.id) || { x: player.x, y: player.y, phase: 0 };
  const moved = Math.hypot(player.x - cache.x, player.y - cache.y);
  cache.phase += Math.min(0.45, moved * 0.13);
  cache.x = player.x;
  cache.y = player.y;
  walkAnim.set(player.id, cache);

  const walk = moved > 0.08 ? Math.sin(cache.phase) : 0;
  const armSwing = walk * 7;
  const legSwing = walk * 6;

  const x = player.x - camera.x;
  const y = player.y - camera.y - (player.phase === "drop" ? Math.min(120, player.dropHeight * 0.05) : 0);

  if (player.phase === "drop" && player.gliderOpen) drawGlider(x, y - 46);

  ctx.save();
  ctx.translate(x, y);

  // shadow
  ctx.beginPath();
  ctx.ellipse(0, 20, 16, 7, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,.24)";
  ctx.fill();

  // legs with walking animation
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-5, 12);
  ctx.lineTo(-7 + legSwing, 25);
  ctx.moveTo(5, 12);
  ctx.lineTo(7 - legSwing, 25);
  ctx.stroke();

  // body
  ctx.fillStyle = player.color || "#2fb4ff";
  roundRect(ctx, -10, -7, 20, 22, 5);
  ctx.fill();

  // head + hair
  ctx.beginPath();
  ctx.arc(0, -15, 8, 0, Math.PI * 2);
  ctx.fillStyle = "#ffd7b6";
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(0, -21, 8, 4, 0, Math.PI, Math.PI * 2);
  ctx.fillStyle = "#21120e";
  ctx.fill();

  // arms with walking animation
  ctx.strokeStyle = "#ffd7b6";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-7, 1);
  ctx.lineTo(-13 - armSwing * 0.35, 12 + armSwing * 0.25);
  ctx.moveTo(7, 1);
  ctx.lineTo(Math.cos(player.angle) * 16, Math.sin(player.angle) * 16 + 2);
  ctx.stroke();

  drawGun(player.angle, currentWeaponFor(player));

  if (player.id === selfId) {
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.strokeRect(-13, -10, 26, 34);
  }

  ctx.restore();

  const me = getMe();
  const teammate = me && player.teamId && me.teamId && player.teamId === me.teamId && player.id !== selfId;
  ctx.fillStyle = teammate ? "#55d66b" : player.isBot ? "#ffcf4a" : "white";
  ctx.font = "bold 13px Arial";
  ctx.textAlign = "center";
  const label = teammate ? `${player.name} • TEAM` : player.name;
  ctx.fillText(label, x, y - 38);

  if (player.health < 100 || player.shield < 100) {
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(x - 23, y - 32, 46, 5);
    ctx.fillStyle = "#55d66b";
    ctx.fillRect(x - 23, y - 32, 46 * (player.health / 100), 5);
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
    ctx.strokeStyle = shot.blockedByBuild ? "#ff8a3d" : (shot.headshot ? "#ffcf4a" : "#f8fafc");
    ctx.lineWidth = shot.blockedByBuild ? 3 : (shot.headshot ? 4 : 2);
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
    const me = getMe();
    const teammate = me && p.teamId && me.teamId && p.teamId === me.teamId && p.id !== selfId;
    mini.fillStyle = p.id === selfId ? "#ffffff" : teammate ? "#55d66b" : p.isBot ? "#ffcf4a" : "#2fb4ff"; mini.fill();
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
updateProgressionUI();
updateQuestUI();
requestRoomList();
renderFunctionalPanels();
gameLoop();


// V43: keep the center player name live while typing.
if (typeof nameInput !== "undefined" && nameInput) {
  nameInput.addEventListener("input", () => {
    const mainNameTag = document.getElementById("mainNameTag");
    if (mainNameTag) mainNameTag.textContent = (nameInput && nameInput.value) ? nameInput.value : "Player";
  });
}


// V44 button safety: make sure the redesigned lobby buttons always call the real multiplayer actions.
console.log("V44 button safety loaded");

document.addEventListener("DOMContentLoaded", () => {
  const nameBox = document.getElementById("nameInput");
  const tag = document.getElementById("mainNameTag");
  if (nameBox && tag) {
    tag.textContent = nameBox.value || "Player";
    renderFunctionalPanels();
    nameBox.addEventListener("input", () => {
      tag.textContent = nameBox.value || "Player";
    });
  }
});


// V48 mode picker buttons.
document.querySelectorAll(".modePickButton").forEach(button => {
  button.addEventListener("click", () => {
    setModeEverywhere(button.dataset.mode, true);
  });
});










// V59 safe lobby-only emote wheel. This does NOT run until after the whole page loads.
(function setupSafeLobbyEmoteWheel() {
  const LOBBY_EMOTES = ["dance", "wave", "laugh", "clap", "dab", "salute", "floss", "heart", "point", "sit"];
  let wheelOpen = false;
  let holdTimer = null;
  let startedInLobby = false;

  function overlay() {
    return document.getElementById("emoteWheelOverlay");
  }

  function lobbyIsOpen() {
    return lobby && !lobby.classList.contains("hidden") && (!room || room.phase !== "game");
  }

  function localId() {
    return selfId || "local";
  }

  function avatarFor(id = localId()) {
    const player = room?.players?.find(p => p.id === id);
    const heroes = Array.from(document.querySelectorAll("#stagePartyMembers .dynamicHero"));

    if (player) {
      for (const hero of heroes) {
        const name = hero.querySelector(".nameTag b")?.textContent || "";
        if (name === player.name) return hero.querySelector(".v56Avatar") || hero.querySelector(".fortCharacter");
      }
    }

    return document.querySelector("#stagePartyMembers .hero1 .v56Avatar") ||
      document.querySelector("#stagePartyMembers .hero1 .fortCharacter") ||
      document.querySelector("#stagePartyMembers .v56Avatar") ||
      document.querySelector("#stagePartyMembers .fortCharacter");
  }

  function clearEmotes(el) {
    if (!el) return;
    for (const emote of LOBBY_EMOTES) el.classList.remove(`emote-${emote}`);
  }

  function playEmote(emote, playerId = localId(), show = true) {
    if (!LOBBY_EMOTES.includes(emote)) return;
    const el = avatarFor(playerId);
    if (!el) return;

    clearEmotes(el);
    el.classList.add(`emote-${emote}`);

    if (show) toastMessage(`Emote: ${emote.toUpperCase()}`);

    clearTimeout(el.__emoteTimer);
    el.__emoteTimer = setTimeout(() => clearEmotes(el), 4500);
  }

  function closeWheel() {
    wheelOpen = false;
    const box = overlay();
    box?.classList.add("hidden");
    box?.querySelectorAll(".emoteOption").forEach(btn => btn.classList.remove("selected"));
  }

  function choose(emote) {
    if (!lobbyIsOpen()) {
      closeWheel();
      return;
    }

    playEmote(emote, localId(), true);

    if (room && room.phase === "lobby") {
      socket.emit("lobbyEmote", { emote }, () => {});
    }

    closeWheel();
  }

  function installWheelButtons() {
    const box = overlay();
    if (!box || box.dataset.installed === "1") return;
    box.dataset.installed = "1";

    box.querySelectorAll(".emoteOption").forEach(btn => {
      btn.addEventListener("mouseenter", () => {
        box.querySelectorAll(".emoteOption").forEach(other => other.classList.remove("selected"));
        btn.classList.add("selected");
      });

      btn.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        choose(btn.dataset.emote);
      });
    });

    box.addEventListener("click", event => {
      if (event.target === box || event.target.classList.contains("emoteWheelBackdrop")) closeWheel();
    });
  }

  function openWheel(fromButton = false) {
    if (!lobbyIsOpen()) {
      if (fromButton) toastMessage("Emotes only work in the lobby");
      return;
    }

    installWheelButtons();

    const box = overlay();
    if (!box) {
      toastMessage("Emote wheel missing");
      return;
    }

    wheelOpen = true;
    box.classList.remove("hidden");
  }

  window.openLobbyEmoteWheel = openWheel;

  window.addEventListener("keydown", event => {
    const tag = document.activeElement?.tagName?.toLowerCase();
    const typing = tag === "input" || tag === "textarea" || tag === "select";
    if (typing) return;

    if (event.key?.toLowerCase() === "b" && lobbyIsOpen()) {
      startedInLobby = true;
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => {
        if (startedInLobby && lobbyIsOpen()) openWheel(false);
      }, 120);
    }

    if (event.key === "Escape" && wheelOpen) {
      event.preventDefault();
      closeWheel();
    }
  }, true);

  window.addEventListener("keyup", event => {
    if (event.key?.toLowerCase() !== "b") return;
    clearTimeout(holdTimer);
    startedInLobby = false;
  }, true);

  socket.on("lobbyEmote", data => {
    if (!data || data.playerId === selfId) return;
    playEmote(data.emote, data.playerId, true);
  });

  setTimeout(() => {
    installWheelButtons();
    if (emoteBtn) {
      emoteBtn.onclick = () => openWheel(true);
    }
  }, 250);
})();

// V53 PARTY CHAT - fixed because chat HTML now loads before this file,
// and this code also fetches elements lazily so it cannot miss them.
function chatEl(id) {
  return document.getElementById(id);
}

function partyChatBoxEl() { return chatEl("partyChatBox"); }
function partyChatHeaderEl() { return chatEl("partyChatHeader"); }
function partyChatInputEl() { return chatEl("partyChatInput"); }
function partyChatMessagesEl() { return chatEl("partyChatMessages"); }
function partyChatSendBtnEl() { return chatEl("partyChatSendBtn"); }
function partyChatStatusEl() { return chatEl("partyChatStatus"); }
function partyChatMinBtnEl() { return chatEl("partyChatMinBtn"); }

function setPartyChatOpen(open, focusInput = false) {
  const box = partyChatBoxEl();
  const input = partyChatInputEl();
  const status = partyChatStatusEl();

  if (!box) return;

  box.classList.toggle("collapsed", !open);

  if (status) status.textContent = open ? "Enter sends • Esc closes" : "Click or press /";

  if (open && focusInput && input) {
    setTimeout(() => input.focus(), 20);
  }
}

function addPartyChatLine(chat, system = false, important = false) {
  const messages = partyChatMessagesEl();
  if (!messages) return;

  const line = document.createElement("div");

  if (system) {
    line.className = `chatSystem ${important ? "important" : ""}`;
    line.textContent = chat;
  } else {
    line.className = `chatLine ${chat.fromId === selfId ? "mine" : ""}`;

    const name = document.createElement("b");
    name.textContent = chat.name || "Player";
    name.style.color = chat.fromId === selfId ? "#ffe822" : (chat.color || "#55d66b");

    const msg = document.createElement("span");
    msg.textContent = `: ${chat.message || ""}`;

    line.appendChild(name);
    line.appendChild(msg);
  }

  messages.appendChild(line);
  while (messages.children.length > 80) messages.removeChild(messages.firstChild);
  messages.scrollTop = messages.scrollHeight;
}

function sendPartyChatCore(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  const input = partyChatInputEl();
  if (!input) {
    toastMessage("Chat input not found");
    return;
  }

  const message = input.value.trim();

  if (!message) {
    setPartyChatOpen(true, true);
    return;
  }

  if (!room) {
    addPartyChatLine("Create or join a room first. Party chat sends only to players in your room.", true, true);
    toastMessage("Create or join a room first");
    input.value = "";
    setPartyChatOpen(true, true);
    return;
  }

  socket.emit("partyChat", { message }, response => {
    if (!response?.ok) {
      addPartyChatLine(response?.error || "Could not send chat.", true, true);
      toastMessage(response?.error || "Could not send chat");
      setPartyChatOpen(true, true);
      return;
    }

    input.value = "";
    setPartyChatOpen(true, true);
  });
}

function togglePartyChatCore(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const box = partyChatBoxEl();
  const isCollapsed = box?.classList.contains("collapsed");
  setPartyChatOpen(!!isCollapsed, !!isCollapsed);
}

window.sendPartyChatNow = sendPartyChatCore;
window.togglePartyChatBox = togglePartyChatCore;

function installPartyChatHandlers() {
  const sendBtn = partyChatSendBtnEl();
  const minBtn = partyChatMinBtnEl();
  const header = partyChatHeaderEl();
  const box = partyChatBoxEl();
  const input = partyChatInputEl();

  if (sendBtn && !sendBtn.dataset.chatInstalled) {
    sendBtn.dataset.chatInstalled = "1";
    sendBtn.onclick = sendPartyChatCore;
    sendBtn.addEventListener("click", sendPartyChatCore);
  }

  if (minBtn && !minBtn.dataset.chatInstalled) {
    minBtn.dataset.chatInstalled = "1";
    minBtn.onclick = togglePartyChatCore;
    minBtn.addEventListener("click", togglePartyChatCore);
  }

  if (header && !header.dataset.chatInstalled) {
    header.dataset.chatInstalled = "1";
    header.addEventListener("click", event => {
      if (event.target === minBtn) return;
      setPartyChatOpen(true, true);
    });
  }

  if (box && !box.dataset.chatInstalled) {
    box.dataset.chatInstalled = "1";
    box.addEventListener("click", event => {
      if (event.target === minBtn || event.target === sendBtn || event.target === input) return;
      if (box.classList.contains("collapsed")) setPartyChatOpen(true, true);
    });
  }

  if (input && !input.dataset.chatInstalled) {
    input.dataset.chatInstalled = "1";
    input.addEventListener("keydown", event => {
      event.stopPropagation();

      if (event.key === "Enter") sendPartyChatCore(event);

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        input.blur();
        setPartyChatOpen(false, false);
      }
    });
  }
}

function openChatShortcut(event) {
  const tag = document.activeElement?.tagName?.toLowerCase();
  const typingSomewhere = tag === "input" || tag === "textarea" || tag === "select";

  if (!typingSomewhere && (event.key === "/" || event.code === "Slash" || event.key.toLowerCase() === "t")) {
    event.preventDefault();
    event.stopPropagation();
    installPartyChatHandlers();
    setPartyChatOpen(true, true);
  }
}

window.addEventListener("keydown", openChatShortcut, true);
document.addEventListener("keydown", openChatShortcut, true);

socket.on("partyChat", chat => {
  installPartyChatHandlers();
  addPartyChatLine(chat);
  setPartyChatOpen(true, false);
});

installPartyChatHandlers();
setPartyChatOpen(false, false);
addPartyChatLine("Chat fixed. Press / or T to open, then Enter or SEND.", true, true);


// V60 stable emote click backup.
// Uses event delegation so clicking emote buttons works even if old listeners fail.
(function setupStableEmoteBackup() {
  const allowed = new Set(["dance", "wave", "laugh", "clap", "dab", "salute", "floss", "heart", "point", "sit"]);

  function box() {
    return document.getElementById("emoteWheelOverlay");
  }

  function closeBox() {
    box()?.classList.add("hidden");
  }

  function lobbyOpen() {
    return lobby && !lobby.classList.contains("hidden") && (!room || room.phase !== "game");
  }

  function clear(el) {
    if (!el) return;
    for (const name of allowed) el.classList.remove(`emote-${name}`);
  }

  function avatar() {
    return document.querySelector("#stagePartyMembers .hero1 .v56Avatar") ||
      document.querySelector("#stagePartyMembers .v56Avatar") ||
      document.querySelector("#stagePartyMembers .fortCharacter");
  }

  function play(emote) {
    if (!allowed.has(emote) || !lobbyOpen()) return;
    const av = avatar();
    if (!av) return toastMessage("No lobby character found");
    clear(av);
    av.classList.add(`emote-${emote}`);
    toastMessage(`Emote: ${emote.toUpperCase()}`);
    clearTimeout(av.__v60emoteTimer);
    av.__v60emoteTimer = setTimeout(() => clear(av), 4500);
    if (room && room.phase === "lobby") socket.emit("lobbyEmote", { emote }, () => {});
  }

  setTimeout(() => {
    const overlay = box();
    if (!overlay || overlay.dataset.v60installed === "1") return;
    overlay.dataset.v60installed = "1";

    overlay.addEventListener("click", event => {
      const btn = event.target.closest?.(".emoteOption");
      if (btn && allowed.has(btn.dataset.emote)) {
        event.preventDefault();
        event.stopPropagation();
        play(btn.dataset.emote);
        closeBox();
        return;
      }

      if (event.target === overlay || event.target.classList.contains("emoteWheelBackdrop")) {
        closeBox();
      }
    }, true);

    overlay.addEventListener("mouseover", event => {
      const btn = event.target.closest?.(".emoteOption");
      if (!btn) return;
      overlay.querySelectorAll(".emoteOption").forEach(x => x.classList.remove("selected"));
      btn.classList.add("selected");
    }, true);
  }, 300);
})();
