const logEl = document.getElementById("action-log");
const roomInput = document.getElementById("room-input");
const tickInput = document.getElementById("tick-input");
const rclSelect = document.getElementById("rcl-select");
const invaderType = document.getElementById("invader-type");
const invaderSize = document.getElementById("invader-size");
const roomStorageKey = "omegaAdmin.room";

let actionRequests = 0;
let statusTimer = null;

function appendLog(title, payload) {
  const stamp = new Date().toLocaleTimeString();
  const content = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  logEl.textContent = `[${stamp}] ${title}\n${content}\n\n` + logEl.textContent;
}

function setActionBusyState() {
  const busy = actionRequests > 0;
  document.querySelectorAll("button[data-action], .pill, #set-rcl, #spawn-invader").forEach((button) => {
    button.disabled = busy;
  });
}

async function request(path, options = {}, controlsBusy = false) {
  if (controlsBusy) {
    actionRequests += 1;
    setActionBusyState();
  }
  try {
    const response = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || data.stderr || `Request failed with ${response.status}`);
    }
    return data;
  } finally {
    if (controlsBusy) {
      actionRequests -= 1;
      setActionBusyState();
    }
  }
}

function renderStatus(data) {
  document.getElementById("status-state").textContent = data.paused ? "Paused" : "Running";
  document.getElementById("status-game-time").textContent = `${data.gameTime}`;
  document.getElementById("status-tick").textContent = `${data.tickDuration} ms`;
  document.getElementById("status-user").textContent = data.user?.username || "-";
  document.getElementById("status-cpu").textContent = data.user ? `${data.user.cpu} CPU` : "-";
  document.getElementById("status-branch").textContent = data.activeBranch || "-";
  document.getElementById("open-client-link").href = data.browserPublicUrl || "/";
  document.getElementById("open-game-link").href = data.clientRouteUrl || "/";
}

function loadSavedRoom() {
  try {
    const savedRoom = window.localStorage.getItem(roomStorageKey);
    if (savedRoom) {
      roomInput.value = savedRoom;
    }
  } catch (_error) {
    // Ignore local storage failures and fall back to the HTML default.
  }
}

function persistRoom() {
  try {
    window.localStorage.setItem(roomStorageKey, roomInput.value.trim());
  } catch (_error) {
    // Ignore local storage failures; the panel still works without persistence.
  }
}

async function refreshStatus(log = false) {
  try {
    const result = await request("/omega-admin/api/status");
    renderStatus(result.data);
    if (log) {
      appendLog("Status", result.data);
    }
  } catch (error) {
    appendLog("Status Error", error.message);
  }
}

async function runAction(path, body, label) {
  try {
    const result = await request(path, {
      method: "POST",
      body: JSON.stringify(body || {}),
    }, true);
    appendLog(label, result);
    await refreshStatus(false);
  } catch (error) {
    appendLog(`${label} Failed`, error.message);
  }
}

document.getElementById("refresh-status").addEventListener("click", () => refreshStatus(true));
document.getElementById("clear-log").addEventListener("click", () => {
  logEl.textContent = "Waiting for commands...";
});
roomInput.addEventListener("input", persistRoom);

document.querySelectorAll("[data-action='pause']").forEach((button) => {
  button.addEventListener("click", () => runAction("/omega-admin/api/pause", {}, "Pause Simulation"));
});

document.querySelectorAll("[data-action='resume']").forEach((button) => {
  button.addEventListener("click", () => runAction("/omega-admin/api/resume", {}, "Resume Simulation"));
});

document.querySelectorAll("[data-tick]").forEach((button) => {
  button.addEventListener("click", () => {
    const milliseconds = Number(button.getAttribute("data-tick"));
    tickInput.value = `${milliseconds}`;
    runAction("/omega-admin/api/set-tick", { milliseconds }, `Set Tick ${milliseconds}ms`);
  });
});

document.getElementById("tick-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const milliseconds = Number(tickInput.value);
  runAction("/omega-admin/api/set-tick", { milliseconds }, `Set Tick ${milliseconds}ms`);
});

document.querySelectorAll("[data-action='reseed-room']").forEach((button) => {
  button.addEventListener("click", () =>
    runAction("/omega-admin/api/reseed-room", { room: roomInput.value.trim() }, `Reseed ${roomInput.value.trim()}`));
});

document.querySelectorAll("[data-action='complete-sites']").forEach((button) => {
  button.addEventListener("click", () =>
    runAction("/omega-admin/api/complete-sites", { room: roomInput.value.trim() }, `Complete Sites ${roomInput.value.trim()}`));
});

document.querySelectorAll("[data-action='fill-energy']").forEach((button) => {
  button.addEventListener("click", () =>
    runAction("/omega-admin/api/fill-energy", { room: roomInput.value.trim(), amount: 300000 }, `Fill Energy ${roomInput.value.trim()}`));
});

document.getElementById("set-rcl").addEventListener("click", () => {
  const room = roomInput.value.trim();
  const level = Number(rclSelect.value);
  runAction("/omega-admin/api/set-rcl", { room, level }, `Set ${room} to RCL ${level}`);
});

document.getElementById("spawn-invader").addEventListener("click", () => {
  const room = roomInput.value.trim();
  runAction(
    "/omega-admin/api/spawn-invader",
    { room, type: invaderType.value, size: invaderSize.value },
    `Spawn ${invaderSize.value} ${invaderType.value} Invader in ${room}`,
  );
});

document.querySelectorAll("[data-action='upload-code']").forEach((button) => {
  button.addEventListener("click", () => runAction("/omega-admin/api/upload-code", {}, "Upload Current Code"));
});

document.querySelectorAll("[data-action='reset-world']").forEach((button) => {
  button.addEventListener("click", () => {
    const confirmed = window.confirm("Reset the entire local dev world and rebuild the test room?");
    if (confirmed) {
      runAction("/omega-admin/api/reset-world", {}, "Reset Dev World");
    }
  });
});

loadSavedRoom();
refreshStatus(true);
statusTimer = window.setInterval(() => refreshStatus(false), 5000);
