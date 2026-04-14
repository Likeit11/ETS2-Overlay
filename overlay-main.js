const { app, BrowserWindow, globalShortcut, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

let overlayWin = null;
let isLocked = true;
let isVisible = true;

const configFile = path.join(__dirname, "config.json");
let config = {
    toggleMode: "Insert",
    toggleOverlay: "PageDown",
    openSettings: "PageUp",
    opacity: 75,
    showTruck: true,
    showJob: true,
    showNav: true,
};

if (fs.existsSync(configFile)) {
    try {
        config = { ...config, ...JSON.parse(fs.readFileSync(configFile, "utf8")) };
    } catch (error) {
        console.error("[Config] Failed to read config.json:", error?.message || error);
    }
}

const ETA_EVAL_ROOT = path.join(__dirname, "eta-eval-lab");
const ETA_EVAL_SESSIONS_ROOT = path.join(ETA_EVAL_ROOT, "sessions");
const ETA_EVAL_REPORTS_ROOT = path.join(ETA_EVAL_ROOT, "reports");

const evalLog = {
    sessionId: "",
    sessionDir: "",
    reportDir: "",
    ticksPath: "",
    eventsPath: "",
    metaPath: "",
    tripSummaryPath: "",
    ticksStream: null,
    eventsStream: null,
    tripSummaryStream: null,
    startedAtMs: 0,
    ticksCount: 0,
    eventsCount: 0,
    tripSummaryCount: 0,
    closed: false,
};

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function formatDatePart(n) {
    return String(n).padStart(2, "0");
}

function createSessionId() {
    const now = new Date();
    return [
        now.getFullYear(),
        formatDatePart(now.getMonth() + 1),
        formatDatePart(now.getDate()),
        "_",
        formatDatePart(now.getHours()),
        formatDatePart(now.getMinutes()),
        formatDatePart(now.getSeconds()),
    ].join("");
}

function getGitCommitShort() {
    try {
        return execSync("git rev-parse --short HEAD", {
            cwd: __dirname,
            stdio: ["ignore", "pipe", "ignore"],
        })
            .toString("utf8")
            .trim();
    } catch {
        return null;
    }
}

function createWriteStream(filepath) {
    return fs.createWriteStream(filepath, { flags: "a", encoding: "utf8" });
}

function nowIso() {
    return new Date().toISOString();
}

function csvEscape(value) {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
        return `"${str.replace(/"/g, "\"\"")}"`;
    }
    return str;
}

function safeWriteJsonl(stream, payload) {
    if (!stream) return;
    stream.write(`${JSON.stringify(payload)}\n`);
}

function initializeEvalLogSession() {
    ensureDir(ETA_EVAL_ROOT);
    ensureDir(ETA_EVAL_SESSIONS_ROOT);
    ensureDir(ETA_EVAL_REPORTS_ROOT);

    evalLog.sessionId = createSessionId();
    evalLog.sessionDir = path.join(ETA_EVAL_SESSIONS_ROOT, evalLog.sessionId);
    evalLog.reportDir = path.join(ETA_EVAL_REPORTS_ROOT, evalLog.sessionId);
    ensureDir(evalLog.sessionDir);
    ensureDir(evalLog.reportDir);

    evalLog.ticksPath = path.join(evalLog.sessionDir, "ticks.jsonl");
    evalLog.eventsPath = path.join(evalLog.sessionDir, "events.jsonl");
    evalLog.metaPath = path.join(evalLog.sessionDir, "meta.json");
    evalLog.tripSummaryPath = path.join(evalLog.sessionDir, "trip_summary.csv");
    evalLog.startedAtMs = Date.now();

    evalLog.ticksStream = createWriteStream(evalLog.ticksPath);
    evalLog.eventsStream = createWriteStream(evalLog.eventsPath);
    evalLog.tripSummaryStream = createWriteStream(evalLog.tripSummaryPath);

    evalLog.tripSummaryStream.write(
        "trip_id,journey_id,journey_segment_index,resumed_from_trip_id,job_key,start_ts_ms,end_ts_ms,actual_trip_min,reroute_count,avg_speed_kmh,max_offroute_km,end_reason\n",
    );

    appendEvalEvent({
        event_name: "session_start",
        severity: "info",
        payload: {
            app_version: app.getVersion(),
            git_commit_short: getGitCommitShort(),
            config,
        },
    });
}

function appendEvalTick(payload = {}) {
    const tsMs = Number(payload.ts_ms) || Date.now();
    const data = {
        ...payload,
        ts_ms: tsMs,
        ts_iso: payload.ts_iso || new Date(tsMs).toISOString(),
        session_id: evalLog.sessionId,
    };
    safeWriteJsonl(evalLog.ticksStream, data);
    evalLog.ticksCount++;
}

function appendEvalEvent({
    event_name = "unknown",
    severity = "info",
    payload = null,
    trip_id = "",
    job_key = "",
    ts_ms = Date.now(),
} = {}) {
    const record = {
        ts_ms,
        ts_iso: new Date(ts_ms).toISOString(),
        session_id: evalLog.sessionId,
        event_name,
        severity,
        trip_id,
        job_key,
        payload,
    };
    safeWriteJsonl(evalLog.eventsStream, record);
    evalLog.eventsCount++;
}

function appendTripSummary({
    trip_id = "",
    journey_id = "",
    journey_segment_index = "",
    resumed_from_trip_id = "",
    job_key = "",
    start_ts_ms = "",
    end_ts_ms = "",
    actual_trip_min = "",
    reroute_count = "",
    avg_speed_kmh = "",
    max_offroute_km = "",
    end_reason = "",
} = {}) {
    if (!evalLog.tripSummaryStream) return;
    const row = [
        trip_id,
        journey_id,
        journey_segment_index,
        resumed_from_trip_id,
        job_key,
        start_ts_ms,
        end_ts_ms,
        actual_trip_min,
        reroute_count,
        avg_speed_kmh,
        max_offroute_km,
        end_reason,
    ]
        .map(csvEscape)
        .join(",");
    evalLog.tripSummaryStream.write(`${row}\n`);
    evalLog.tripSummaryCount++;
}

function finalizeEvalLogSession() {
    if (evalLog.closed) return;
    evalLog.closed = true;

    appendEvalEvent({
        event_name: "session_end",
        severity: "info",
        payload: {
            ticks_count: evalLog.ticksCount,
            events_count: evalLog.eventsCount,
            trip_summary_count: evalLog.tripSummaryCount,
        },
    });

    const meta = {
        session_id: evalLog.sessionId,
        started_at_ms: evalLog.startedAtMs,
        started_at_iso: new Date(evalLog.startedAtMs).toISOString(),
        ended_at_ms: Date.now(),
        ended_at_iso: nowIso(),
        app_version: app.getVersion(),
        git_commit_short: getGitCommitShort(),
        ticks_count: evalLog.ticksCount,
        events_count: evalLog.eventsCount,
        trip_summary_count: evalLog.tripSummaryCount,
        paths: {
            ticks: evalLog.ticksPath,
            events: evalLog.eventsPath,
            trip_summary: evalLog.tripSummaryPath,
            report_dir: evalLog.reportDir,
        },
    };
    try {
        fs.writeFileSync(evalLog.metaPath, JSON.stringify(meta, null, 2), "utf8");
    } catch (error) {
        console.error("[ETA-Eval] Failed writing meta.json:", error?.message || error);
    }

    if (evalLog.ticksStream) evalLog.ticksStream.end();
    if (evalLog.eventsStream) evalLog.eventsStream.end();
    if (evalLog.tripSummaryStream) evalLog.tripSummaryStream.end();
}

function registerShortcuts() {
    globalShortcut.unregisterAll();

    try {
        globalShortcut.register(config.toggleMode, () => {
            if (!overlayWin) return;
            isLocked = !isLocked;
            overlayWin.setIgnoreMouseEvents(isLocked, { forward: true });
            if (!isLocked) {
                overlayWin.focus();
            } else {
                overlayWin.blur();
            }
            overlayWin.webContents
                .executeJavaScript(`(() => {
                    let b = document.getElementById('overlay-status');
                    if (!b) {
                        b = document.createElement('div');
                        b.id = 'overlay-status';
                        b.className = 'status-banner';
                        document.body.appendChild(b);
                    }
                    b.style.background = ${isLocked} ? 'rgba(0,180,0,0.9)' : 'rgba(255,100,0,0.9)';
                    b.innerText = ${isLocked}
                        ? '클릭 통과 모드 (게임 내 마우스 사용 가능)'
                        : '편집 모드 (오버레이 조작 가능)';
                    b.style.display = 'block';
                    setTimeout(() => { b.style.display = 'none'; }, 3000);
                })()`)
                .catch(console.error);
        });
    } catch {
        console.error("Invalid hotkey: toggleMode");
    }

    try {
        globalShortcut.register(config.toggleOverlay, () => {
            if (!overlayWin) return;
            isVisible = !isVisible;
            if (isVisible) overlayWin.showInactive();
            else overlayWin.hide();
        });
    } catch {
        console.error("Invalid hotkey: toggleOverlay");
    }

    try {
        globalShortcut.register(config.openSettings, () => {
            if (!overlayWin || !isVisible) return;
            overlayWin.webContents
                .executeJavaScript(`(() => {
                    const m = document.getElementById('settings-modal');
                    if (m.style.display === 'flex') {
                        if (typeof closeSettingsModal === 'function') closeSettingsModal();
                        return true;
                    }
                    if (typeof openSettingsModal === 'function') openSettingsModal();
                    return false;
                })()`)
                .then((wasOpen) => {
                    if (wasOpen) {
                        isLocked = true;
                        overlayWin.setIgnoreMouseEvents(true, { forward: true });
                        overlayWin.blur();
                    } else {
                        isLocked = false;
                        overlayWin.setIgnoreMouseEvents(false, { forward: true });
                        overlayWin.show();
                        overlayWin.focus();
                    }
                })
                .catch(console.error);
        });
    } catch {
        console.error("Invalid hotkey: openSettings");
    }
}

function createOverlayWindow() {
    overlayWin = new BrowserWindow({
        fullscreen: true,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        hasShadow: false,
        skipTaskbar: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    overlayWin.setAlwaysOnTop(true, "screen-saver");
    overlayWin.setVisibleOnAllWorkspaces(true);
    overlayWin.setIgnoreMouseEvents(isLocked, { forward: true });
    overlayWin.loadURL("http://127.0.0.1:25555/skins/my_overlay/index.html");

    overlayWin.webContents.on("console-message", (event, level, message, line, sourceId) => {
        const levelTag = level === 2 ? "ERROR" : level === 1 ? "WARN" : "LOG";
        console.log(`[Renderer:${levelTag}] ${message} (${sourceId}:${line})`);
    });

    overlayWin.webContents.on("did-fail-load", (event, code, desc, url) => {
        console.error(`[OverlayLoadError] code=${code} url=${url} desc=${desc}`);
        appendEvalEvent({
            event_name: "overlay_load_failed",
            severity: "error",
            payload: { code, desc, url },
        });
    });
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on("second-instance", () => {
        if (overlayWin) {
            if (overlayWin.isMinimized()) overlayWin.restore();
            overlayWin.focus();
        }
    });

    app.whenReady().then(() => {
        initializeEvalLogSession();
        createOverlayWindow();
        registerShortcuts();
    });

    app.on("window-all-closed", () => app.quit());
}

app.on("before-quit", () => {
    finalizeEvalLogSession();
});

ipcMain.on("update-shortcuts", (event, newConfig) => {
    config = { ...config, ...newConfig };
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
    registerShortcuts();
});

ipcMain.on("set-locked", (event, state) => {
    isLocked = state;
    if (!overlayWin) return;
    overlayWin.setIgnoreMouseEvents(state, { forward: true });
    if (state) overlayWin.blur();
    else overlayWin.focus();
});

ipcMain.on("suspend-shortcuts", () => globalShortcut.unregisterAll());
ipcMain.on("resume-shortcuts", () => registerShortcuts());
ipcMain.handle("get-shortcuts", () => config);
ipcMain.on("close-overlay", () => app.quit());

ipcMain.on("eta-eval:tick", (event, payload) => {
    appendEvalTick(payload || {});
});

ipcMain.on("eta-eval:event", (event, payload) => {
    appendEvalEvent(payload || {});
});

ipcMain.on("eta-eval:trip-summary", (event, payload) => {
    appendTripSummary(payload || {});
});

ipcMain.handle("eta-eval:get-session", () => ({
    session_id: evalLog.sessionId,
    session_dir: evalLog.sessionDir,
    report_dir: evalLog.reportDir,
}));
