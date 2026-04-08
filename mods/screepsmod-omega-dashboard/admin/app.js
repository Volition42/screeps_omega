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
const openDashboardLink = document.getElementById("open-dashboard-link");
const statusCard = document.querySelector(".status-card");
const controlCard = document.querySelector(".control-card");
const logCard = document.querySelector(".log-card");
const toggleLiveStatusButton = document.getElementById("toggle-live-status");
const toggleLiveStatusIcon = document.getElementById("toggle-live-status-icon");
const toggleControlGroupButton = document.getElementById("toggle-control-group");
const toggleControlGroupIcon = document.getElementById("toggle-control-group-icon");
const toggleActionLogButton = document.getElementById("toggle-action-log");
const toggleActionLogIcon = document.getElementById("toggle-action-log-icon");
const tickChartLine = document.getElementById("tick-chart-line");
const tickChartSummary = document.getElementById("tick-chart-summary");
const hostCpuChartLine = document.getElementById("host-cpu-chart-line");
const hostCpuChartSummary = document.getElementById("host-cpu-chart-summary");
const gameCpuChartLine = document.getElementById("game-cpu-chart-line");
const gameCpuChartSummary = document.getElementById("game-cpu-chart-summary");
const bucketChartLine = document.getElementById("bucket-chart-line");
const bucketChartSummary = document.getElementById("bucket-chart-summary");
const roomStorageKey = "omegaAdmin.room";
const liveStatusCollapsedKey = "omegaAdmin.liveStatusCollapsed";
const controlGroupCollapsedKey = "omegaAdmin.controlGroupCollapsed";
const actionLogCollapsedKey = "omegaAdmin.actionLogCollapsed";
const MAX_HISTORY_SAMPLES = 40;
const CPU_BUCKET_MAX = 10000;
const adminApiBase = "./api";

let actionRequests = 0;
let statusTimer = null;
let lastStatusSnapshot = null;
let tickSamples = [];
let hostCpuSamples = [];
let gameCpuSamples = [];
let bucketSamples = [];

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

function formatPercent(value, digits = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return `${numeric.toFixed(digits)}%`;
}

function trimSamples(samples) {
  if (samples.length > MAX_HISTORY_SAMPLES) {
    return samples.slice(-MAX_HISTORY_SAMPLES);
  }
  return samples;
}

function renderSeriesChart({
  source,
  lineEl,
  summaryEl,
  waitingMessage,
  emptyMessage,
  getValue,
  buildSummary,
  minValue,
  maxValue,
}) {
  if (!source.length) {
    lineEl.setAttribute("points", "");
    summaryEl.textContent = waitingMessage;
    return;
  }

  const samples = source
    .map((sample) => ({ ...sample, chartValue: getValue(sample) }))
    .filter((sample) => Number.isFinite(sample.chartValue));

  if (!samples.length) {
    lineEl.setAttribute("points", "");
    summaryEl.textContent = emptyMessage;
    return;
  }

  const width = 240;
  const height = 64;
  const padX = 4;
  const padY = 6;
  const values = samples.map((sample) => sample.chartValue);
  const min = Number.isFinite(minValue) ? minValue : Math.min(...values);
  const max = Number.isFinite(maxValue) ? maxValue : Math.max(...values);
  const range = Math.max(1, max - min);
  const stepX = samples.length > 1 ? (width - padX * 2) / (samples.length - 1) : 0;

  const points = samples.map((sample, index) => {
    const x = padX + stepX * index;
    const ratio = range === 0 ? 0.5 : (sample.chartValue - min) / range;
    const y = height - padY - ratio * (height - padY * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const latest = samples[samples.length - 1];

  lineEl.setAttribute("points", points.join(" "));
  summaryEl.textContent = buildSummary({ latest, average });
}

function renderTickChart() {
  renderSeriesChart({
    source: tickSamples,
    lineEl: tickChartLine,
    summaryEl: tickChartSummary,
    waitingMessage: "Collecting samples...",
    emptyMessage: "Waiting for live ticks...",
    getValue: (sample) => (sample.msPerTick > 0 ? sample.msPerTick : NaN),
    buildSummary: ({ latest, average }) =>
      `Live ${Math.round(latest.msPerTick)} ms/t | Avg ${Math.round(average)} ms/t`,
  });
}

function renderHostCpuChart() {
  renderSeriesChart({
    source: hostCpuSamples,
    lineEl: hostCpuChartLine,
    summaryEl: hostCpuChartSummary,
    waitingMessage: "Collecting samples...",
    emptyMessage: "Waiting for host telemetry...",
    getValue: (sample) => sample.percent,
    buildSummary: ({ latest, average }) =>
      `${formatPercent(latest.percent)} live | ${formatPercent(average)} avg`,
    minValue: 0,
    maxValue: 100,
  });
}

function renderBucketChart() {
  renderSeriesChart({
    source: bucketSamples,
    lineEl: bucketChartLine,
    summaryEl: bucketChartSummary,
    waitingMessage: "Collecting samples...",
    emptyMessage: "Waiting for bucket data...",
    getValue: (sample) => sample.value,
    buildSummary: ({ latest, average }) =>
      `Live ${formatCompactNumber(latest.value)} | Avg ${formatCompactNumber(Math.round(average))}`,
    minValue: 0,
    maxValue: CPU_BUCKET_MAX,
  });
}

function renderGameCpuChart(userCpuMax = 0) {
  const sampleMax = gameCpuSamples.length
    ? Math.max(...gameCpuSamples.map((sample) => Number(sample.used || 0)))
    : 0;
  const chartMax = Math.max(10, Math.ceil(Math.max(Number(userCpuMax || 0), sampleMax)));

  renderSeriesChart({
    source: gameCpuSamples,
    lineEl: gameCpuChartLine,
    summaryEl: gameCpuChartSummary,
    waitingMessage: "Collecting samples...",
    emptyMessage: "Waiting for game CPU stats...",
    getValue: (sample) => sample.used,
    buildSummary: ({ latest, average }) =>
      `Live ${latest.used.toFixed(2)} | Avg ${average.toFixed(2)} / ${chartMax}`,
    minValue: 0,
    maxValue: chartMax,
  });
}

function recordStatusSamples(data) {
  const user = data.user || null;
  const runtimeCpu = data.runtimeStats && data.runtimeStats.cpu ? data.runtimeStats.cpu : null;
  const now = Date.now();
  const current = {
    timeMs: now,
    gameTime: Number(data.gameTime || 0),
    paused: !!data.paused,
  };

  const gameCpuUsed = user && Number.isFinite(Number(user.lastUsedCpu))
    ? Number(user.lastUsedCpu)
    : runtimeCpu && Number.isFinite(Number(runtimeCpu.used))
      ? Number(runtimeCpu.used)
      : null;

  if (gameCpuUsed !== null) {
    gameCpuSamples.push({
      used: gameCpuUsed,
      limit: Number((runtimeCpu && runtimeCpu.limit) || user?.cpu || 0),
    });
    gameCpuSamples = trimSamples(gameCpuSamples);
  }

  const bucketValue = runtimeCpu && Number.isFinite(Number(runtimeCpu.bucket))
    ? Number(runtimeCpu.bucket)
    : user && Number.isFinite(Number(user.cpuAvailable))
      ? Number(user.cpuAvailable)
      : null;

  if (bucketValue !== null) {
    bucketSamples.push({
      value: bucketValue,
    });
    bucketSamples = trimSamples(bucketSamples);
  }

  if (data.hostCpu && Number.isFinite(Number(data.hostCpu.percent))) {
    hostCpuSamples.push({
      percent: Number(data.hostCpu.percent),
      cores: Number(data.hostCpu.cores || 0),
    });
    hostCpuSamples = trimSamples(hostCpuSamples);
  }

  if (lastStatusSnapshot) {
    const deltaTicks = current.gameTime - lastStatusSnapshot.gameTime;
    const deltaMs = current.timeMs - lastStatusSnapshot.timeMs;

    if (!current.paused && deltaTicks > 0 && deltaMs > 0) {
      tickSamples.push({
        msPerTick: deltaMs / deltaTicks,
        ticks: deltaTicks,
      });
      tickSamples = trimSamples(tickSamples);
    }
  }

  lastStatusSnapshot = current;
  renderTickChart();
  renderHostCpuChart();
  renderGameCpuChart(user?.cpu || runtimeCpu?.limit || 0);
  renderBucketChart();
}

function renderStatus(data) {
  const user = data.user || null;

  document.getElementById("status-state").textContent = data.paused ? "Paused" : "Running";
  document.getElementById("status-game-time").textContent = `${data.gameTime}`;
  document.getElementById("status-user").textContent = user?.username || "-";
  document.getElementById("status-cpu").textContent = user ? `${user.cpu}` : "-";
  document.getElementById("status-gcl").textContent = user ? `L${user.gclLevel}` : "-";
  document.getElementById("status-pcl").textContent = user ? `L${user.pclLevel}` : "-";

  setInputValueIfIdle(cpuInput, user?.cpu ?? 20);
  setInputValueIfIdle(gclInput, user?.gclLevel ?? 1);
  setInputValueIfIdle(pclInput, user?.pclLevel ?? 0);
  setInputValueIfIdle(tickInput, data.tickDuration || 200);

  openClientLink.dataset.url = data.browserPublicUrl || "/";
  openGameLink.dataset.url = data.clientOverviewUrl || "/";
  openMaptoolLink.dataset.url = data.maptoolUrl || "/maptool/";
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

function openInCurrentTab(url, label) {
  if (!url || url === "/") {
    appendLog(`${label} Failed`, "URL not available yet.");
    return;
  }
  window.location.assign(url);
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

function setLiveStatusCollapsed(collapsed) {
  statusCard.classList.toggle("status-card--collapsed", collapsed);
  toggleLiveStatusButton.setAttribute("aria-expanded", collapsed ? "false" : "true");
  toggleLiveStatusButton.setAttribute("aria-label", collapsed ? "Expand live status" : "Collapse live status");
  toggleLiveStatusButton.title = collapsed ? "Expand live status" : "Collapse live status";
  toggleLiveStatusIcon.className = collapsed ? "mdi mdi-chevron-down" : "mdi mdi-chevron-up";

  try {
    window.localStorage.setItem(liveStatusCollapsedKey, collapsed ? "1" : "0");
  } catch (_error) {
    // Ignore local storage failures; the toggle still works without persistence.
  }
}

function loadLiveStatusPreference() {
  try {
    const saved = window.localStorage.getItem(liveStatusCollapsedKey);
    setLiveStatusCollapsed(saved === "1");
  } catch (_error) {
    setLiveStatusCollapsed(false);
  }
}

function setControlGroupCollapsed(collapsed) {
  controlCard.classList.toggle("control-card--collapsed", collapsed);
  toggleControlGroupButton.setAttribute("aria-expanded", collapsed ? "false" : "true");
  toggleControlGroupButton.setAttribute("aria-label", collapsed ? "Expand control tools" : "Collapse control tools");
  toggleControlGroupButton.title = collapsed ? "Expand control tools" : "Collapse control tools";
  toggleControlGroupIcon.className = collapsed ? "mdi mdi-chevron-down" : "mdi mdi-chevron-up";

  try {
    window.localStorage.setItem(controlGroupCollapsedKey, collapsed ? "1" : "0");
  } catch (_error) {
    // Ignore local storage failures; the toggle still works without persistence.
  }
}

function loadControlGroupPreference() {
  try {
    const saved = window.localStorage.getItem(controlGroupCollapsedKey);
    setControlGroupCollapsed(saved === "1");
  } catch (_error) {
    setControlGroupCollapsed(false);
  }
}

function setActionLogCollapsed(collapsed) {
  logCard.classList.toggle("log-card--collapsed", collapsed);
  toggleActionLogButton.setAttribute("aria-expanded", collapsed ? "false" : "true");
  toggleActionLogButton.setAttribute("aria-label", collapsed ? "Expand action log" : "Collapse action log");
  toggleActionLogButton.title = collapsed ? "Expand action log" : "Collapse action log";
  toggleActionLogIcon.className = collapsed ? "mdi mdi-chevron-down" : "mdi mdi-chevron-up";

  try {
    window.localStorage.setItem(actionLogCollapsedKey, collapsed ? "1" : "0");
  } catch (_error) {
    // Ignore local storage failures; the toggle still works without persistence.
  }
}

function loadActionLogPreference() {
  try {
    const saved = window.localStorage.getItem(actionLogCollapsedKey);
    setActionLogCollapsed(saved === "1");
  } catch (_error) {
    setActionLogCollapsed(false);
  }
}

async function refreshStatus(log = false) {
  try {
    const result = await request(`${adminApiBase}/status`);
    recordStatusSamples(result.data);
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

document.getElementById("clear-log").addEventListener("click", () => {
  logEl.textContent = "Waiting for commands...";
});

openClientLink.addEventListener("click", () => openInCurrentTab(openClientLink.dataset.url, "Open Portal"));
openGameLink.addEventListener("click", () => openInNewTab(openGameLink.dataset.url, "Open Game"));
openMaptoolLink.addEventListener("click", () => openInCurrentTab(openMaptoolLink.dataset.url, "Open Map Tool"));
openDashboardLink.addEventListener("click", () => openInCurrentTab(openDashboardLink.dataset.url, "Open Dashboard"));
toggleLiveStatusButton.addEventListener("click", () => {
  const collapsed = statusCard.classList.contains("status-card--collapsed");
  setLiveStatusCollapsed(!collapsed);
});
toggleControlGroupButton.addEventListener("click", () => {
  const collapsed = controlCard.classList.contains("control-card--collapsed");
  setControlGroupCollapsed(!collapsed);
});
toggleActionLogButton.addEventListener("click", () => {
  const collapsed = logCard.classList.contains("log-card--collapsed");
  setActionLogCollapsed(!collapsed);
});

roomInput.addEventListener("input", persistRoom);

document.querySelectorAll("[data-action='pause']").forEach((button) => {
  button.addEventListener("click", () => runAction(`${adminApiBase}/pause`, {}, "Pause Simulation"));
});

document.querySelectorAll("[data-action='resume']").forEach((button) => {
  button.addEventListener("click", () => runAction(`${adminApiBase}/resume`, {}, "Resume Simulation"));
});

document.querySelectorAll("[data-tick]").forEach((button) => {
  button.addEventListener("click", () => {
    const milliseconds = Number(button.getAttribute("data-tick"));
    tickInput.value = `${milliseconds}`;
    runAction(`${adminApiBase}/set-tick`, { milliseconds }, `Set Tick ${milliseconds}ms`);
  });
});

document.getElementById("tick-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const milliseconds = Number(tickInput.value);
  runAction(`${adminApiBase}/set-tick`, { milliseconds }, `Set Tick ${milliseconds}ms`);
});

document.getElementById("set-cpu").addEventListener("click", () => {
  const cpu = Number(cpuInput.value);
  runAction(`${adminApiBase}/set-cpu`, { cpu }, `Set CPU Max ${cpu}`);
});

document.getElementById("set-gcl").addEventListener("click", () => {
  const level = Number(gclInput.value);
  runAction(`${adminApiBase}/set-gcl`, { level }, `Set GCL ${level}`);
});

document.getElementById("set-pcl").addEventListener("click", () => {
  const level = Number(pclInput.value);
  runAction(`${adminApiBase}/set-pcl`, { level }, `Set PCL ${level}`);
});

document.querySelectorAll("[data-action='reseed-room']").forEach((button) => {
  button.addEventListener("click", () =>
    runAction(`${adminApiBase}/reseed-room`, { room: roomInput.value.trim() }, `Reseed ${roomInput.value.trim()}`));
});

document.querySelectorAll("[data-action='complete-sites']").forEach((button) => {
  button.addEventListener("click", () =>
    runAction(`${adminApiBase}/complete-sites`, { room: roomInput.value.trim() }, `Complete Sites ${roomInput.value.trim()}`));
});

document.querySelectorAll("[data-action='fill-energy']").forEach((button) => {
  button.addEventListener("click", () =>
    runAction(`${adminApiBase}/fill-energy`, { room: roomInput.value.trim(), amount: 300000 }, `Fill Energy ${roomInput.value.trim()}`));
});

document.getElementById("set-rcl").addEventListener("click", () => {
  const room = roomInput.value.trim();
  const level = Number(rclSelect.value);
  runAction(`${adminApiBase}/set-rcl`, { room, level }, `Set ${room} to RCL ${level}`);
});

document.getElementById("spawn-invader").addEventListener("click", () => {
  const room = roomInput.value.trim();
  runAction(
    `${adminApiBase}/spawn-invader`,
    { room, type: invaderType.value, size: invaderSize.value },
    `Spawn ${invaderSize.value} ${invaderType.value} Invader in ${room}`,
  );
});

document.querySelectorAll("[data-action='upload-code']").forEach((button) => {
  button.addEventListener("click", () => runAction(`${adminApiBase}/upload-code`, {}, "Upload Current Code"));
});

document.querySelectorAll("[data-action='reset-world']").forEach((button) => {
  button.addEventListener("click", () => {
    const confirmed = window.confirm("Reset the entire local dev world and rebuild the test room?");
    if (confirmed) {
      runAction(`${adminApiBase}/reset-world`, {}, "Reset Dev World");
    }
  });
});

loadSavedRoom();
loadLiveStatusPreference();
loadControlGroupPreference();
loadActionLogPreference();
refreshStatus(true);
statusTimer = window.setInterval(() => refreshStatus(false), 2000);
