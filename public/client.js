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



// V58 lobby-only emote wheel fixed.
// It uses lazy DOM lookup, so it works even if the HTML loads later.
const LOBBY_EMOTES = ["dance", "wave", "laugh", "clap", "dab", "salute", "floss", "heart", "point", "sit"];
let emoteWheelOpen = false;
let emoteHoldTimer = null;
let bKeyStartedInLobby = false;
let emoteHandlersInstalled = false;

function emoteWheelEl() {
  return document.getElementById("emoteWheelOverlay");
}

function isLobbyVisible() {
  return lobby && !lobby.classList.contains("hidden") && (!room || room.phase !== "game");
}

function localLobbyPlayerId() {
  return selfId || "local";
}

function clearAvatarEmotes(avatar) {
  if (!avatar) return;
  for (const emote of LOBBY_EMOTES) avatar.classList.remove(`emote-${emote}`);
}

function avatarForPlayerId(playerId = localLobbyPlayerId()) {
  const avatars = Array.from(document.querySelectorAll("#stagePartyMembers .dynamicHero"));
  const player = room?.players?.find(p => p.id === playerId);

  if (player) {
    for (const hero of avatars) {
      const label = hero.querySelector(".nameTag b")?.textContent || "";
      if (label === player.name) return hero.querySelector(".v56Avatar") || hero.querySelector(".fortCharacter");
    }
  }

  if (playerId === localLobbyPlayerId()) {
    return document.querySelector("#stagePartyMembers .hero1 .v56Avatar") ||
      document.querySelector("#stagePartyMembers .hero1 .fortCharacter") ||
      document.querySelector("#stagePartyMembers .v56Avatar") ||
      document.querySelector("#stagePartyMembers .fortCharacter");
  }

  return document.querySelector("#stagePartyMembers .v56Avatar") || document.querySelector("#stagePartyMembers .fortCharacter");
}

function playLobbyEmote(emote, playerId = localLobbyPlayerId(), showText = true) {
  if (!LOBBY_EMOTES.includes(emote)) return;
  const avatar = avatarForPlayerId(playerId);
  if (!avatar) {
    if (showText) toastMessage("No lobby character found");
    return;
  }

  clearAvatarEmotes(avatar);
  avatar.classList.add(`emote-${emote}`);

  if (showText) toastMessage(`Emote: ${emote.toUpperCase()}`);

  clearTimeout(avatar.__emoteTimer);
  avatar.__emoteTimer = setTimeout(() => clearAvatarEmotes(avatar), 4500);
}

function installEmoteWheelHandlers() {
  if (emoteHandlersInstalled) return;
  const overlay = emoteWheelEl();
  if (!overlay) return;

  overlay.querySelectorAll(".emoteOption").forEach(option => {
    option.addEventListener("mouseenter", () => {
      overlay.querySelectorAll(".emoteOption").forEach(btn => btn.classList.remove("selected"));
      option.classList.add("selected");
    });

    option.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      chooseEmote(option.dataset.emote);
    });
  });

  overlay.addEventListener("click", event => {
    if (event.target === overlay || event.target.classList.contains("emoteWheelBackdrop")) closeEmoteWheel();
  });

  emoteHandlersInstalled = true;
}

function openEmoteWheel(fromButton = false) {
  if (!isLobbyVisible()) {
    if (fromButton) toastMessage("Emotes only work in the lobby");
    return;
  }

  installEmoteWheelHandlers();
  const overlay = emoteWheelEl();

  if (!overlay) {
    toastMessage("Emote wheel not loaded");
    return;
  }

  emoteWheelOpen = true;
  overlay.classList.remove("hidden");
}

function closeEmoteWheel() {
  emoteWheelOpen = false;
  const overlay = emoteWheelEl();
  overlay?.classList.add("hidden");
  overlay?.querySelectorAll(".emoteOption").forEach(option => option.classList.remove("selected"));
}

function chooseEmote(emote) {
  if (!isLobbyVisible()) {
    closeEmoteWheel();
    return;
  }

  playLobbyEmote(emote, localLobbyPlayerId(), true);

  if (room && room.phase === "lobby") {
    socket.emit("lobbyEmote", { emote }, () => {});
  }

  closeEmoteWheel();
}

socket.on("lobbyEmote", data => {
  if (!data || data.playerId === selfId) return;
  playLobbyEmote(data.emote, data.playerId, true);
});

window.addEventListener("keydown", event => {
  const tag = document.activeElement?.tagName?.toLowerCase();
  const typing = tag === "input" || tag === "textarea" || tag === "select";
  if (typing) return;

  if (event.key?.toLowerCase() === "b" && isLobbyVisible()) {
    bKeyStartedInLobby = true;
    clearTimeout(emoteHoldTimer);

    // Hold B opens it, but this also opens after a short delay so it feels responsive.
    emoteHoldTimer = setTimeout(() => {
      if (bKeyStartedInLobby && isLobbyVisible()) openEmoteWheel(false);
    }, 180);
  }

  if (event.key === "Escape" && emoteWheelOpen) {
    event.preventDefault();
    closeEmoteWheel();
  }
}, true);

window.addEventListener("keyup", event => {
  if (event.key?.toLowerCase() !== "b") return;
  clearTimeout(emoteHoldTimer);
  bKeyStartedInLobby = false;
}, true);

// Backup: make sure the EMOTE button always opens the wheel.
setTimeout(() => {
  installEmoteWheelHandlers();
  if (emoteBtn) emoteBtn.onclick = () => openEmoteWheel(true);
}, 250);

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
