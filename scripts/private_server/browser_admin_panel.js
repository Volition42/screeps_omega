const logEl = document.getElementById("action-log");
const roomInput = document.getElementById("room-input");
const tickInput = document.getElementById("tick-input");
const cpuInput = document.getElementById("cpu-input");
const gclInput = document.getElementById("gcl-input");
const pclInput = document.getElementById("pcl-input");
const rclSelect = document.getElementById("rcl-select");
const invaderType = document.getElementById("invader-type");
const invaderSize = document.getElementById("invader-size");
const openClientLink = document.getElementById("open-client-link");
const openGameLink = document.getElementById("open-game-link");
const openMaptoolLink = document.getElementById("open-maptool-link");
const openOverviewLink = document.getElementById("open-overview-link");
const openDashboardLink = document.getElementById("open-dashboard-link");
const tickChartLine = document.getElementById("tick-chart-line");
const tickChartSummary = document.getElementById("tick-chart-summary");
const roomStorageKey = "omegaAdmin.room";
const MAX_TICK_SAMPLES = 40;

let actionRequests = 0;
let statusTimer = null;
let lastStatusSnapshot = null;
let tickSamples = [];

function appendLog(title, payload) {
  const stamp = new Date().toLocaleTimeString();
  const content = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  logEl.textContent = `[${stamp}] ${title}\n${content}\n\n${logEl.textContent}`;
}

function setActionBusyState() {
  const busy = actionRequests > 0;
  document
    .querySelectorAll("button[data-action], .pill, #set-rcl, #spawn-invader, #set-cpu, #set-gcl, #set-pcl")
    .forEach((button) => {
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

function setInputValueIfIdle(input, nextValue) {
  if (!input) return;
  if (document.activeElement === input) return;
  input.value = `${nextValue}`;
}

function formatCompactNumber(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "-";
  if (numeric >= 1_000_000) return `${(numeric / 1_000_000).toFixed(1)}m`;
  if (numeric >= 1_000) return `${(numeric / 1_000).toFixed(1)}k`;
  return `${numeric}`;
}

function formatObservedTick(sample) {
  if (!sample || !Number.isFinite(sample.msPerTick) || sample.msPerTick <= 0) {
    return "-";
  }
  return `${Math.round(sample.msPerTick)} ms`;
}

function renderTickChart() {
  if (!tickSamples.length) {
    tickChartLine.setAttribute("points", "");
    tickChartSummary.textContent = "Collecting samples...";
    return;
  }

  const samples = tickSamples.filter((sample) => Number.isFinite(sample.msPerTick) && sample.msPerTick > 0);
  if (!samples.length) {
    tickChartLine.setAttribute("points", "");
    tickChartSummary.textContent = "Waiting for live ticks...";
    return;
  }

  const width = 240;
  const height = 64;
  const padX = 4;
  const padY = 6;
  const min = Math.min(...samples.map((sample) => sample.msPerTick));
  const max = Math.max(...samples.map((sample) => sample.msPerTick));
  const range = Math.max(1, max - min);
  const stepX = samples.length > 1 ? (width - padX * 2) / (samples.length - 1) : 0;

  const points = samples.map((sample, index) => {
    const x = padX + stepX * index;
    const ratio = range === 0 ? 0.5 : (sample.msPerTick - min) / range;
    const y = height - padY - ratio * (height - padY * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const average = samples.reduce((sum, sample) => sum + sample.msPerTick, 0) / samples.length;
  const latest = samples[samples.length - 1];

  tickChartLine.setAttribute("points", points.join(" "));
  tickChartSummary.textContent = `Live ${Math.round(latest.msPerTick)} ms/t | Avg ${Math.round(average)} ms/t`;
}

function recordTickSample(data) {
  const now = Date.now();
  const current = {
    timeMs: now,
    gameTime: Number(data.gameTime || 0),
    paused: !!data.paused,
  };

  if (lastStatusSnapshot) {
    const deltaTicks = current.gameTime - lastStatusSnapshot.gameTime;
    const deltaMs = current.timeMs - lastStatusSnapshot.timeMs;

    if (!current.paused && deltaTicks > 0 && deltaMs > 0) {
      tickSamples.push({
        msPerTick: deltaMs / deltaTicks,
        ticks: deltaTicks,
      });
      if (tickSamples.length > MAX_TICK_SAMPLES) {
        tickSamples = tickSamples.slice(-MAX_TICK_SAMPLES);
      }
    }
  }

  lastStatusSnapshot = current;
  renderTickChart();
}

function renderStatus(data) {
  const user = data.user || null;
  const latestSample = tickSamples.length > 0 ? tickSamples[tickSamples.length - 1] : null;

  document.getElementById("status-state").textContent = data.paused ? "Paused" : "Running";
  document.getElementById("status-game-time").textContent = `${data.gameTime}`;
  document.getElementById("status-tick").textContent = `${data.tickDuration} ms`;
  document.getElementById("status-observed-tick").textContent = data.paused ? "Paused" : formatObservedTick(latestSample);
  document.getElementById("status-user").textContent = user?.username || "-";
  document.getElementById("status-cpu").textContent = user ? `${user.cpu}` : "-";
  document.getElementById("status-gcl").textContent = user ? `L${user.gclLevel}` : "-";
  document.getElementById("status-pcl").textContent = user ? `L${user.pclLevel}` : "-";
  document.getElementById("status-cpu-bucket").textContent = user ? `Bucket ${formatCompactNumber(user.cpuAvailable)}` : "Bucket -";
  document.getElementById("status-cpu-mode").textContent = user?.fixedCPU ? `CPU Fixed ${user.fixedCPU}` : "CPU Auto";
  document.getElementById("status-branch").textContent = `Branch ${data.activeBranch || "-"}`;

  setInputValueIfIdle(cpuInput, user?.cpu ?? 20);
  setInputValueIfIdle(gclInput, user?.gclLevel ?? 1);
  setInputValueIfIdle(pclInput, user?.pclLevel ?? 0);
  setInputValueIfIdle(tickInput, data.tickDuration || 200);

  openClientLink.dataset.url = data.browserPublicUrl || "/";
  openGameLink.dataset.url = data.clientRouteUrl || "/";
  openMaptoolLink.dataset.url = data.maptoolUrl || "/";
  openOverviewLink.dataset.url = data.clientOverviewUrl || "/";
  openDashboardLink.dataset.url = data.dashboardUrl || "/";
}

function openInNewTab(url, label) {
  if (!url || url === "/") {
    appendLog(`${label} Failed`, "URL not available yet.");
    return;
  }
  const nextTab = window.open(url, "_blank", "noopener,noreferrer");
  if (nextTab) {
    nextTab.opener = null;
  } else {
    appendLog(`${label} Failed`, "Browser blocked the new tab.");
  }
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
    recordTickSample(result.data);
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
    const result = await request(
      path,
      {
        method: "POST",
        body: JSON.stringify(body || {}),
      },
      true,
    );
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

openClientLink.addEventListener("click", () => openInNewTab(openClientLink.dataset.url, "Open Portal"));
openGameLink.addEventListener("click", () => openInNewTab(openGameLink.dataset.url, "Open Game"));
openMaptoolLink.addEventListener("click", () => openInNewTab(openMaptoolLink.dataset.url, "Open Map Tool"));
openOverviewLink.addEventListener("click", () => openInNewTab(openOverviewLink.dataset.url, "Open Client Overview"));
openDashboardLink.addEventListener("click", () => openInNewTab(openDashboardLink.dataset.url, "Open Raw Dashboard"));

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

document.getElementById("set-cpu").addEventListener("click", () => {
  const cpu = Number(cpuInput.value);
  runAction("/omega-admin/api/set-cpu", { cpu }, `Set CPU Max ${cpu}`);
});

document.getElementById("set-gcl").addEventListener("click", () => {
  const level = Number(gclInput.value);
  runAction("/omega-admin/api/set-gcl", { level }, `Set GCL ${level}`);
});

document.getElementById("set-pcl").addEventListener("click", () => {
  const level = Number(pclInput.value);
  runAction("/omega-admin/api/set-pcl", { level }, `Set PCL ${level}`);
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
statusTimer = window.setInterval(() => refreshStatus(false), 2000);
