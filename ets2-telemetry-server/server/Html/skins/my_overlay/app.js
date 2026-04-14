const TELEMETRY_URL = "/api/ets2/telemetry";

const ROUTE_DATA_BASE = "/skins/my_overlay/data/ets2";
const CITY_ZONES_URL = "/skins/my_overlay/cities_ets2.json";
const GRAPH_NODES_URL = `${ROUTE_DATA_BASE}/roadnetwork/nodes.json`;
const GRAPH_EDGES_URL = `${ROUTE_DATA_BASE}/roadnetwork/edges.json`;
const GEO_CITIES_URL = `${ROUTE_DATA_BASE}/map-data/cities.geojson`;
const GEO_COMPANIES_URL = `${ROUTE_DATA_BASE}/map-data/companies.geojson`;
const CITY_ALIAS_URL = `${ROUTE_DATA_BASE}/map-data/citiesCheck.json`;

const ROUTE_RECALC_MIN_INTERVAL_MS = 20_000;
const ROUTE_FORCE_RECALC_MS = 180_000;
const ROUTE_DEVIATION_RECALC_COOLDOWN_MS = 8_000;
const ROUTE_OFFROUTE_RECALC_KM = 1.5;
const ROUTE_OFFROUTE_MIN_SPEED_KMH = 20;
const ROUTE_OFFROUTE_GRACE_MS = 15_000;
const ROUTE_NO_CACHE_RETRY_MS = 5_000;
const ETA_BOOTSTRAP_WAIT_MS = 2_500;
const ETA_EVAL_JOURNEY_STATE_KEY = "eta_eval_journey_state_v1";
const ETA_EVAL_JOURNEY_RESUME_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const DEBUG_ROUTE_LOG = true;
const DEBUG_ROUTE_LOG_INTERVAL_MS = 2_000;
const BENCHMARK_LOG_INTERVAL_MS = 10_000;

const GAME_SPEED_CITY = 35;
const GAME_SPEED_HIGHWAY = 70;
const ETA_NEAR_BLEND_START_KM = 30;
const ETA_NEAR_BLEND_FULL_KM = 20;
const ETA_MIN_EFFECTIVE_SPEED_KMH = 12;
const SPEED_EMA_ALPHA = 0.18;
const SPEED_EMA_STOP_DECAY_ALPHA = 0.28;
const SPEED_SPIKE_MAX_KMH = 180;
const SPEED_DELTA_EMA_ALPHA = 0.2;
const ETA_SMOOTH_ALPHA_BASE = 0.26;
const ETA_SMOOTH_ALPHA_NEAR_BOOST = 0.15;
const LIVE_WEIGHT_MAX = 0.85;
const LIVE_WEIGHT_FAR_KM = 120;
const LIVE_WEIGHT_MID_KM = 60;
const LIVE_WEIGHT_NEAR_KM = 30;
const LIVE_WEIGHT_FULL_KM = 20;
const LIVE_WEIGHT_DIST_AT_MID = 0.2;
const LIVE_WEIGHT_DIST_AT_NEAR = 0.35;
const LIVE_WEIGHT_DIST_AT_FULL = 0.65;
const LIVE_WEIGHT_DIST_AT_FINAL = 0.85;
const LIVE_SPEED_RELIABILITY_LOW_KMH = 15;
const LIVE_SPEED_RELIABILITY_MID_KMH = 25;
const LIVE_SPEED_RELIABILITY_HIGH_KMH = 40;
const SPEED_BASED_MIN_RATIO = 0.5;
const SPEED_BASED_MAX_RATIO_FAR = 1.45;
const SPEED_BASED_MAX_RATIO_MID = 1.65;
const SPEED_BASED_MAX_RATIO_NEAR = 1.9;
const SPEED_BASED_MAX_RATIO_FINAL = 2.3;
const ETA_JUMP_GUARD_UP_BASE_MIN = 0.22;
const ETA_JUMP_GUARD_UP_RATE_MIN_PER_SEC = 0.45;
const ETA_JUMP_GUARD_DOWN_BASE_MIN = 0.35;
const ETA_JUMP_GUARD_DOWN_RATE_MIN_PER_SEC = 0.9;
const ETA_PROJECTION_STOP_SPEED_KMH = 0.5;
const ETA_PROJECTION_SLOW_SPEED_KMH = 4;
const ETA_PROJECTION_LOW_SPEED_KMH = 12;
const ETA_PROJECTION_MED_SPEED_KMH = 25;
const ETA_PROJECTION_SLOW_FACTOR = 0.15;
const ETA_PROJECTION_LOW_FACTOR = 0.35;
const ETA_PROJECTION_MED_FACTOR = 0.7;
const ETA_CALIBRATION_BLEND_NEAR_KM = 20;
const ETA_CALIBRATION_BLEND_MID_KM = 60;
const ETA_CALIBRATION_BLEND_FAR_KM = 120;
const ETA_CALIBRATION_BLEND_START_MS = 90_000;
const ETA_CALIBRATION_BLEND_FULL_MS = 240_000;
const ETA_CALIBRATION_RATIO_DEVIATION_SOFT = 0.05;
const ETA_CALIBRATION_RATIO_DEVIATION_HARD = 0.2;
const DEST_SNAP_RADIUS_KM = 2.5;
const ARRIVAL_REMAINING_KM_THRESHOLD = 0.35;
const ARRIVAL_NAV_KM_THRESHOLD = 1.0;
const ARRIVAL_SPEED_MAX_KMH = 8;
const ARRIVAL_HOLD_MS = 4_000;

const LCC = (() => {
    const R = 6370997;
    const DEG = Math.PI / 180;
    const RAD = 180 / Math.PI;

    const lat1 = 37 * DEG;
    const lat2 = 65 * DEG;
    const lat0 = 50 * DEG;
    const lon0 = 15 * DEG;

    const n =
        Math.log(Math.cos(lat1) / Math.cos(lat2)) /
        Math.log(
            Math.tan(Math.PI / 4 + lat2 / 2) /
                Math.tan(Math.PI / 4 + lat1 / 2),
        );
    const F = (Math.cos(lat1) * Math.pow(Math.tan(Math.PI / 4 + lat1 / 2), n)) / n;
    const rho0 = (R * F) / Math.pow(Math.tan(Math.PI / 4 + lat0 / 2), n);
    const degLen = (R * Math.PI) / 180;

    const mapOffsetX = 16660;
    const mapOffsetZ = 4150;
    const mapFactorX = 0.0001729241463;
    const mapFactorZ = -0.000171570875;

    function forward(lng, lat) {
        const lon = lng * DEG;
        const phi = lat * DEG;

        const rho = (R * F) / Math.pow(Math.tan(Math.PI / 4 + phi / 2), n);
        const theta = n * (lon - lon0);

        const projX = rho * Math.sin(theta);
        const projY = rho0 - rho * Math.cos(theta);

        const localX = projX / (mapFactorX * degLen);
        const localZ = projY / (mapFactorZ * degLen);

        return [localX + mapOffsetX, localZ + mapOffsetZ];
    }

    function inverse(gameX, gameZ) {
        let x = gameX - mapOffsetX;
        let z = gameZ - mapOffsetZ;

        const ukScale = 0.75;
        const calaisBoundX = -31100;
        const calaisBoundZ = -5500;
        if (x * ukScale < calaisBoundX && z * ukScale < calaisBoundZ) {
            x = (x + calaisBoundX / 2) * ukScale;
            z = (z + calaisBoundZ / 2) * ukScale;
        }

        const projX = x * mapFactorX * degLen;
        const projY = z * mapFactorZ * degLen;

        const dx = projX;
        const dy = rho0 - projY;

        const rho = Math.sign(n) * Math.sqrt(dx * dx + dy * dy);
        const theta = Math.atan2(dx, dy);

        const lon = lon0 + theta / n;
        const lat = 2 * Math.atan(Math.pow((R * F) / rho, 1 / n)) - Math.PI / 2;

        return [lon * RAD, lat * RAD];
    }

    return { forward, inverse };
})();

class MinHeap {
    constructor() {
        this.ids = [];
        this.keys = [];
    }

    size() {
        return this.ids.length;
    }

    clear() {
        this.ids.length = 0;
        this.keys.length = 0;
    }

    push(id, key) {
        this.ids.push(id);
        this.keys.push(key);
        this.#up(this.ids.length - 1);
    }

    pop() {
        if (!this.ids.length) return undefined;
        const top = this.ids[0];
        const lastId = this.ids.pop();
        const lastKey = this.keys.pop();
        if (this.ids.length) {
            this.ids[0] = lastId;
            this.keys[0] = lastKey;
            this.#down(0);
        }
        return top;
    }

    #up(idx) {
        while (idx > 0) {
            const parent = (idx - 1) >> 1;
            if (this.keys[parent] <= this.keys[idx]) break;
            this.#swap(parent, idx);
            idx = parent;
        }
    }

    #down(idx) {
        const n = this.ids.length;
        while (true) {
            const l = idx * 2 + 1;
            const r = l + 1;
            let smallest = idx;
            if (l < n && this.keys[l] < this.keys[smallest]) smallest = l;
            if (r < n && this.keys[r] < this.keys[smallest]) smallest = r;
            if (smallest === idx) break;
            this.#swap(idx, smallest);
            idx = smallest;
        }
    }

    #swap(a, b) {
        [this.ids[a], this.ids[b]] = [this.ids[b], this.ids[a]];
        [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
    }
}

const routeEngine = {
    initialized: false,
    loading: false,

    cityZones: [],
    cityAliasList: [],
    cityByName: new Map(),
    companies: [],

    nodeCount: 0,
    nodeLng: null,
    nodeLat: null,

    edgeOffsets: null,
    edgeTo: null,
    edgeWeight: null,
    edgeRoadType: null,

    spatialCellSize: 0.08,
    spatialMap: new Map(),

    routeCache: null,
    routeInFlight: false,
    lastRouteTryAt: 0,
    lastPathIndex: 0,
    speedEmaKmh: 0,
    speedDeltaEmaKmh: 0,
    lastSpeedKmh: 0,
    etaSmoothedMinutes: 0,
    etaUpdatedAtMs: 0,
    waitPenaltyMinutes: 0,
    waitPenaltyUpdatedAtMs: 0,
    arrivalSinceMs: 0,
    arrivalEventSent: false,
    etaBootstrapSinceMs: 0,
    lastEtaMode: "",
    debugLogTimes: {},
};

const etaEvalTripState = {
    activeTripId: "",
    activeJourneyId: "",
    activeJourneySegmentIndex: 0,
    resumedFromTripId: "",
    activeJobKey: "",
    startedAtMs: 0,
    rerouteCount: 0,
    maxOffRouteKm: 0,
    speedSum: 0,
    speedSamples: 0,
};

const etaEvalUiState = {
    available: false,
    sessionId: "",
    lastTickSentAtMs: 0,
    lastError: "",
};

function safeNumber(value, digits = 3) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    const factor = 10 ** digits;
    return Math.round(n * factor) / factor;
}

function createEtaEvalId(prefix) {
    const now = Date.now();
    const randomPart = Math.floor(Math.random() * 1_000_000)
        .toString()
        .padStart(6, "0");
    return `${prefix}_${now}_${randomPart}`;
}

function readEtaEvalJourneyState() {
    try {
        const raw = window.localStorage.getItem(ETA_EVAL_JOURNEY_STATE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
        return null;
    }
}

function writeEtaEvalJourneyState(state) {
    try {
        if (!state) {
            window.localStorage.removeItem(ETA_EVAL_JOURNEY_STATE_KEY);
            return;
        }
        window.localStorage.setItem(ETA_EVAL_JOURNEY_STATE_KEY, JSON.stringify(state));
    } catch {}
}

function clearEtaEvalJourneyState() {
    writeEtaEvalJourneyState(null);
}

function getEtaEvalJourneyResume(jobKey) {
    const state = readEtaEvalJourneyState();
    if (!state) return null;
    if (String(state.job_key || "") !== String(jobKey || "")) return null;

    const pendingSinceMs = Number(state.pending_since_ms || 0);
    if (!pendingSinceMs || Date.now() - pendingSinceMs > ETA_EVAL_JOURNEY_RESUME_MAX_AGE_MS) {
        clearEtaEvalJourneyState();
        return null;
    }

    return state;
}

function emitEtaEvalEvent(eventName, payload = {}, severity = "info") {
    if (!window?.electronAPI?.etaEvalEvent) return;
    try {
        window.electronAPI.etaEvalEvent({
            event_name: eventName,
            severity,
            payload,
            trip_id: etaEvalTripState.activeTripId || "",
            journey_id: etaEvalTripState.activeJourneyId || "",
            journey_segment_index: etaEvalTripState.activeJourneySegmentIndex || null,
            resumed_from_trip_id: etaEvalTripState.resumedFromTripId || "",
            job_key: etaEvalTripState.activeJobKey || "",
            ts_ms: Date.now(),
        });
    } catch (error) {
        etaEvalUiState.lastError = error?.message || String(error);
    }
}

function emitEtaEvalTick(payload = {}) {
    if (!window?.electronAPI?.etaEvalTick) return;
    try {
        window.electronAPI.etaEvalTick({
            ...payload,
            trip_id: etaEvalTripState.activeTripId || "",
            journey_id: etaEvalTripState.activeJourneyId || "",
            journey_segment_index: etaEvalTripState.activeJourneySegmentIndex || null,
            resumed_from_trip_id: etaEvalTripState.resumedFromTripId || "",
            job_key: etaEvalTripState.activeJobKey || "",
            ts_ms: Date.now(),
        });
        etaEvalUiState.lastError = "";
        etaEvalUiState.lastTickSentAtMs = Date.now();
    } catch (error) {
        etaEvalUiState.lastError = error?.message || String(error);
    }
}

function emitEtaEvalTripSummary(summary = {}) {
    if (!window?.electronAPI?.etaEvalTripSummary) return;
    try {
        window.electronAPI.etaEvalTripSummary(summary);
    } catch (error) {
        etaEvalUiState.lastError = error?.message || String(error);
    }
}

function finalizeEtaEvalTrip(endReason, endTsMs = Date.now()) {
    if (!etaEvalTripState.activeTripId || !etaEvalTripState.startedAtMs) return;

    const actualTripMin = Math.max(0, (endTsMs - etaEvalTripState.startedAtMs) / 60000);
    const avgSpeedKmh =
        etaEvalTripState.speedSamples > 0
            ? etaEvalTripState.speedSum / etaEvalTripState.speedSamples
            : 0;

    emitEtaEvalEvent("trip_end", {
        end_reason: endReason,
        actual_trip_min: safeNumber(actualTripMin, 3),
        reroute_count: etaEvalTripState.rerouteCount,
        avg_speed_kmh: safeNumber(avgSpeedKmh, 3),
        max_offroute_km: safeNumber(etaEvalTripState.maxOffRouteKm, 3),
    });

    emitEtaEvalTripSummary({
        trip_id: etaEvalTripState.activeTripId,
        journey_id: etaEvalTripState.activeJourneyId,
        journey_segment_index: etaEvalTripState.activeJourneySegmentIndex,
        resumed_from_trip_id: etaEvalTripState.resumedFromTripId,
        job_key: etaEvalTripState.activeJobKey,
        start_ts_ms: etaEvalTripState.startedAtMs,
        end_ts_ms: endTsMs,
        actual_trip_min: safeNumber(actualTripMin, 3),
        reroute_count: etaEvalTripState.rerouteCount,
        avg_speed_kmh: safeNumber(avgSpeedKmh, 3),
        max_offroute_km: safeNumber(etaEvalTripState.maxOffRouteKm, 3),
        end_reason: endReason,
    });

    if (
        (endReason === "disconnect" || endReason === "overlay_closed") &&
        etaEvalTripState.activeJourneyId &&
        etaEvalTripState.activeJobKey
    ) {
        writeEtaEvalJourneyState({
            journey_id: etaEvalTripState.activeJourneyId,
            job_key: etaEvalTripState.activeJobKey,
            next_segment_index: etaEvalTripState.activeJourneySegmentIndex + 1,
            last_trip_id: etaEvalTripState.activeTripId,
            pending_since_ms: endTsMs,
            end_reason: endReason,
        });
    } else {
        clearEtaEvalJourneyState();
    }

    etaEvalTripState.activeTripId = "";
    etaEvalTripState.activeJourneyId = "";
    etaEvalTripState.activeJourneySegmentIndex = 0;
    etaEvalTripState.resumedFromTripId = "";
    etaEvalTripState.activeJobKey = "";
    etaEvalTripState.startedAtMs = 0;
    etaEvalTripState.rerouteCount = 0;
    etaEvalTripState.maxOffRouteKm = 0;
    etaEvalTripState.speedSum = 0;
    etaEvalTripState.speedSamples = 0;
}

function routeLog(event, payload = null) {
    if (!DEBUG_ROUTE_LOG) return;
    if (payload === null) {
        console.log(`[RouteDebug] ${event}`);
    } else {
        let payloadText = "";
        try {
            payloadText = ` ${JSON.stringify(payload)}`;
        } catch (_) {
            payloadText = " [unserializable-payload]";
        }
        console.log(`[RouteDebug] ${event}${payloadText}`);
    }
    emitEtaEvalEvent("route_event", {
        event_name: event,
        payload,
    });
}

function routeLogThrottled(key, event, payload = null, intervalMs = DEBUG_ROUTE_LOG_INTERVAL_MS) {
    if (!DEBUG_ROUTE_LOG) return;
    const now = Date.now();
    const last = routeEngine.debugLogTimes[key] || 0;
    if (now - last < intervalMs) return;
    routeEngine.debugLogTimes[key] = now;
    routeLog(event, payload);
}

async function fetchJsonStrict(url, label) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
        throw new Error(`${label} load failed (HTTP ${response.status}) at ${url}`);
    }
    try {
        return await response.json();
    } catch (error) {
        throw new Error(`${label} invalid JSON at ${url}: ${error?.message || error}`);
    }
}

function normalizeName(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

function getScaleMultiplier(gameX, gameZ) {
    const zones = routeEngine.cityZones;
    if (!zones || !zones.length) return 19;
    for (let i = 0; i < zones.length; i++) {
        const city = zones[i];
        const dx = gameX - city.x;
        const dz = gameZ - city.z;
        if (dx * dx + dz * dz < city.radius * city.radius) return 3;
    }
    return 19;
}

function getBearingDeg(lng1, lat1, lng2, lat2) {
    const y = lng2 - lng1;
    const x = lat2 - lat1;
    const deg = (Math.atan2(y, x) * 180) / Math.PI;
    return (deg + 360) % 360;
}

function angleDiffDeg(a, b) {
    let d = Math.abs(a - b) % 360;
    if (d > 180) d = 360 - d;
    return d;
}

function signedTurnDeg(ax, ay, bx, by, cx, cy) {
    const v1x = bx - ax;
    const v1y = by - ay;
    const v2x = cx - bx;
    const v2y = cy - by;
    const dot = v1x * v2x + v1y * v2y;
    const det = v1x * v2y - v1y * v2x;
    return (Math.atan2(det, dot) * 180) / Math.PI;
}

function pointSegmentDistanceSq(px, py, ax, ay, bx, by) {
    const midLat = ((py + ay + by) / 3) * (Math.PI / 180);
    const scaleX = 111 * Math.cos(midLat);
    const scaleY = 111;

    const pxK = px * scaleX;
    const pyK = py * scaleY;
    const axK = ax * scaleX;
    const ayK = ay * scaleY;
    const bxK = bx * scaleX;
    const byK = by * scaleY;

    const vx = bxK - axK;
    const vy = byK - ayK;
    const lenSq = vx * vx + vy * vy;
    if (lenSq <= 0) {
        const dx = pxK - axK;
        const dy = pyK - ayK;
        return dx * dx + dy * dy;
    }
    let t = ((pxK - axK) * vx + (pyK - ayK) * vy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const sx = axK + t * vx;
    const sy = ayK + t * vy;
    const dx = pxK - sx;
    const dy = pyK - sy;
    return dx * dx + dy * dy;
}

function projectPointToSegmentGeo(px, py, ax, ay, bx, by) {
    const midLat = ((py + ay + by) / 3) * (Math.PI / 180);
    const scaleX = 111 * Math.cos(midLat);
    const scaleY = 111;

    const pxK = px * scaleX;
    const pyK = py * scaleY;
    const axK = ax * scaleX;
    const ayK = ay * scaleY;
    const bxK = bx * scaleX;
    const byK = by * scaleY;

    const vx = bxK - axK;
    const vy = byK - ayK;
    const lenSq = vx * vx + vy * vy;

    let t = 0;
    if (lenSq > 0) {
        t = ((pxK - axK) * vx + (pyK - ayK) * vy) / lenSq;
        t = Math.max(0, Math.min(1, t));
    }

    const sxK = axK + t * vx;
    const syK = ayK + t * vy;

    const dx = pxK - sxK;
    const dy = pyK - syK;
    const distKm = Math.sqrt(dx * dx + dy * dy);

    const snapLng = ax + (bx - ax) * t;
    const snapLat = ay + (by - ay) * t;

    return { lng: snapLng, lat: snapLat, distKm, t };
}

async function initializeRouteEngine() {
    if (routeEngine.initialized || routeEngine.loading) return routeEngine.initialized;
    routeEngine.loading = true;
    routeLog("engine_init_start");

    try {
        const [
            cityZones,
            packedNodes,
            packedEdges,
            citiesGeo,
            companiesGeo,
            cityAliasList,
        ] = await Promise.all([
            fetchJsonStrict(CITY_ZONES_URL, "cityZones"),
            fetchJsonStrict(GRAPH_NODES_URL, "graphNodes"),
            fetchJsonStrict(GRAPH_EDGES_URL, "graphEdges"),
            fetchJsonStrict(GEO_CITIES_URL, "citiesGeo"),
            fetchJsonStrict(GEO_COMPANIES_URL, "companiesGeo"),
            fetchJsonStrict(CITY_ALIAS_URL, "cityAliasList"),
        ]);

        if (!Array.isArray(packedNodes) || packedNodes.length === 0) {
            throw new Error(`graphNodes empty or invalid. type=${typeof packedNodes}`);
        }
        if (!Array.isArray(packedEdges) || packedEdges.length === 0) {
            throw new Error(`graphEdges empty or invalid. type=${typeof packedEdges}`);
        }

        routeEngine.cityZones = Array.isArray(cityZones) ? cityZones : [];
        routeEngine.cityAliasList = Array.isArray(cityAliasList) ? cityAliasList : [];
        routeEngine.cityByName.clear();

        if (citiesGeo && Array.isArray(citiesGeo.features)) {
            for (let i = 0; i < citiesGeo.features.length; i++) {
                const feature = citiesGeo.features[i];
                const name = normalizeName(feature?.properties?.name);
                const coords = feature?.geometry?.coordinates;
                if (!name || !coords || coords.length < 2) continue;
                routeEngine.cityByName.set(name, [coords[0], coords[1]]);
            }
        }

        const companyList = [];
        if (companiesGeo && Array.isArray(companiesGeo.features)) {
            for (let i = 0; i < companiesGeo.features.length; i++) {
                const feature = companiesGeo.features[i];
                const props = feature?.properties || {};
                const coords = feature?.geometry?.coordinates;
                if (!coords || coords.length < 2) continue;
                if (props.poiType !== "company" || !props.poiName) continue;
                companyList.push({
                    name: normalizeName(props.poiName),
                    lng: coords[0],
                    lat: coords[1],
                });
            }
        }
        routeEngine.companies = companyList;

        if (routeEngine.cityByName.size === 0) {
            throw new Error("citiesGeo parsed but cityByName is empty");
        }
        if (routeEngine.companies.length === 0) {
            throw new Error("companiesGeo parsed but companies list is empty");
        }

        buildGraphRuntime(packedNodes, packedEdges);
        routeEngine.initialized = true;
        routeLog("engine_init_done", {
            cityZones: routeEngine.cityZones.length,
            cities: routeEngine.cityByName.size,
            companies: routeEngine.companies.length,
            nodeCount: routeEngine.nodeCount,
        });
        return true;
    } catch (error) {
        console.error("[RouteEngine] Initialization failed:", error);
        routeLog("engine_init_failed", { message: error?.message || String(error) });
        routeEngine.initialized = false;
        return false;
    } finally {
        routeEngine.loading = false;
    }
}

function buildGraphRuntime(packedNodes, packedEdges) {
    const nodeCount = packedNodes.length;
    const edgeCount = packedEdges.length;

    const nodeLat = new Float64Array(nodeCount);
    const nodeLng = new Float64Array(nodeCount);
    const spatial = new Map();
    const cellSize = routeEngine.spatialCellSize;

    for (let i = 0; i < nodeCount; i++) {
        const n = packedNodes[i];
        const lat = n[0] / 1e5;
        const lng = n[1] / 1e5;
        nodeLat[i] = lat;
        nodeLng[i] = lng;

        const cx = Math.floor(lng / cellSize);
        const cy = Math.floor(lat / cellSize);
        const key = `${cx}:${cy}`;
        let bucket = spatial.get(key);
        if (!bucket) {
            bucket = [];
            spatial.set(key, bucket);
        }
        bucket.push(i);
    }

    const offsets = new Int32Array(nodeCount + 1);
    for (let i = 0; i < edgeCount; i++) {
        const from = packedEdges[i][0];
        if (from >= 0 && from < nodeCount) offsets[from + 1]++;
    }
    for (let i = 1; i < offsets.length; i++) offsets[i] += offsets[i - 1];

    const cursor = new Int32Array(offsets);
    const edgeTo = new Int32Array(edgeCount);
    const edgeWeight = new Float32Array(edgeCount);
    const edgeRoadType = new Uint8Array(edgeCount);

    for (let i = 0; i < edgeCount; i++) {
        const e = packedEdges[i];
        const from = e[0];
        if (from < 0 || from >= nodeCount) continue;
        const idx = cursor[from]++;
        edgeTo[idx] = e[1];
        edgeWeight[idx] = e[2];
        edgeRoadType[idx] = e[3] || 0;
    }

    routeEngine.nodeCount = nodeCount;
    routeEngine.nodeLat = nodeLat;
    routeEngine.nodeLng = nodeLng;
    routeEngine.edgeOffsets = offsets;
    routeEngine.edgeTo = edgeTo;
    routeEngine.edgeWeight = edgeWeight;
    routeEngine.edgeRoadType = edgeRoadType;
    routeEngine.spatialMap = spatial;
    routeLog("graph_runtime_built", {
        nodes: nodeCount,
        edges: edgeCount,
        cells: spatial.size,
    });
}

function getClosestNodeIds(lng, lat, maxCount, maxRing = 8) {
    const map = routeEngine.spatialMap;
    const cellSize = routeEngine.spatialCellSize;
    const baseX = Math.floor(lng / cellSize);
    const baseY = Math.floor(lat / cellSize);

    const candidates = [];
    for (let r = 0; r <= maxRing; r++) {
        const minX = baseX - r;
        const maxX = baseX + r;
        const minY = baseY - r;
        const maxY = baseY + r;

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                if (r > 0 && x > minX && x < maxX && y > minY && y < maxY) continue;
                const bucket = map.get(`${x}:${y}`);
                if (!bucket) continue;
                for (let i = 0; i < bucket.length; i++) candidates.push(bucket[i]);
            }
        }
        if (candidates.length >= maxCount * 3) break;
    }

    if (!candidates.length) return [];

    const out = [];
    const nodeLng = routeEngine.nodeLng;
    const nodeLat = routeEngine.nodeLat;
    const latScale = Math.cos((lat * Math.PI) / 180);

    for (let i = 0; i < candidates.length; i++) {
        const id = candidates[i];
        const dLng = (nodeLng[id] - lng) * latScale;
        const dLat = nodeLat[id] - lat;
        out.push({ id, d2: dLng * dLng + dLat * dLat });
    }

    out.sort((a, b) => a.d2 - b.d2);
    const result = [];
    const used = new Set();
    for (let i = 0; i < out.length && result.length < maxCount; i++) {
        const id = out[i].id;
        if (used.has(id)) continue;
        used.add(id);
        result.push(id);
    }
    return result;
}

function resolveCityGeo(cityName) {
    const normalized = normalizeName(cityName);
    if (!normalized) return null;

    const direct = routeEngine.cityByName.get(normalized);
    if (direct) return direct;

    for (let i = 0; i < routeEngine.cityAliasList.length; i++) {
        const row = routeEngine.cityAliasList[i];
        const first = normalizeName(row?.FirstName);
        const second = normalizeName(row?.SecondName);
        if (normalized !== first && normalized !== second) continue;
        if (second && routeEngine.cityByName.has(second)) {
            return routeEngine.cityByName.get(second);
        }
        if (first && routeEngine.cityByName.has(first)) {
            return routeEngine.cityByName.get(first);
        }
    }
    return null;
}

function resolveDestinationGeo(cityName, companyName) {
    const cityCoord = resolveCityGeo(cityName);
    if (!cityCoord) return null;

    const normalizedCompany = normalizeName(companyName);
    if (!normalizedCompany) return cityCoord;

    let best = null;
    let minDistSq = Infinity;

    for (let i = 0; i < routeEngine.companies.length; i++) {
        const company = routeEngine.companies[i];
        if (company.name !== normalizedCompany) continue;
        const dx = company.lng - cityCoord[0];
        const dy = company.lat - cityCoord[1];
        const distSq = dx * dx + dy * dy;
        if (distSq < minDistSq) {
            minDistSq = distSq;
            best = [company.lng, company.lat];
        }
    }

    return best || cityCoord;
}

function snapGeoToRoad(lng, lat) {
    if (!routeEngine.nodeCount || !routeEngine.edgeOffsets) return null;

    const nodeLng = routeEngine.nodeLng;
    const nodeLat = routeEngine.nodeLat;
    const offsets = routeEngine.edgeOffsets;
    const edgeTo = routeEngine.edgeTo;

    const nearNodes = getClosestNodeIds(lng, lat, 64, 10);
    if (!nearNodes.length) return null;

    let best = null;
    let bestDistKm = Infinity;

    for (let i = 0; i < nearNodes.length; i++) {
        const from = nearNodes[i];
        const start = offsets[from];
        const end = offsets[from + 1];

        for (let e = start; e < end; e++) {
            const to = edgeTo[e];
            const snapped = projectPointToSegmentGeo(
                lng,
                lat,
                nodeLng[from],
                nodeLat[from],
                nodeLng[to],
                nodeLat[to],
            );

            if (snapped.distKm < bestDistKm) {
                bestDistKm = snapped.distKm;
                best = snapped;
            }
        }
    }

    if (!best) return null;
    return { ...best, used: bestDistKm <= DEST_SNAP_RADIUS_KM };
}

function calculateRoute(startId, endCandidates, startHeadingDeg = null) {
    const nodeCount = routeEngine.nodeCount;
    const nodeLng = routeEngine.nodeLng;
    const nodeLat = routeEngine.nodeLat;
    const offsets = routeEngine.edgeOffsets;
    const edgeTo = routeEngine.edgeTo;
    const edgeWeight = routeEngine.edgeWeight;
    const edgeRoadType = routeEngine.edgeRoadType;

    if (!endCandidates.length) return null;

    const endSet = new Set(endCandidates);
    const targetId = endCandidates[0];
    const targetLng = nodeLng[targetId];
    const targetLat = nodeLat[targetId];

    const gScore = new Float64Array(nodeCount);
    const previous = new Int32Array(nodeCount);
    const visited = new Uint8Array(nodeCount);
    gScore.fill(Infinity);
    previous.fill(-1);

    const heap = new MinHeap();
    const heuristicScale = 2.0;

    const heuristic = (id) => {
        const dx = nodeLng[id] - targetLng;
        const dy = nodeLat[id] - targetLat;
        return Math.sqrt(dx * dx + dy * dy) * 100 * heuristicScale;
    };

    gScore[startId] = 0;
    heap.push(startId, heuristic(startId));

    let foundEnd = -1;
    let iterations = 0;
    const maxIterations = 240000;

    while (heap.size() > 0 && iterations < maxIterations) {
        iterations++;
        const current = heap.pop();
        if (current === undefined) break;
        if (visited[current]) continue;
        visited[current] = 1;

        if (endSet.has(current)) {
            foundEnd = current;
            break;
        }

        const fromStart = offsets[current];
        const fromEnd = offsets[current + 1];
        if (fromStart === fromEnd) continue;

        const currentG = gScore[current];
        const prev = previous[current];
        const cLng = nodeLng[current];
        const cLat = nodeLat[current];

        for (let edgeIndex = fromStart; edgeIndex < fromEnd; edgeIndex++) {
            const next = edgeTo[edgeIndex];
            if (visited[next]) continue;

            let stepCost = edgeWeight[edgeIndex] || 1;
            const roadType = edgeRoadType[edgeIndex];

            const nLng = nodeLng[next];
            const nLat = nodeLat[next];

            if (current === startId && typeof startHeadingDeg === "number") {
                const headingToNext = getBearingDeg(cLng, cLat, nLng, nLat);
                const diff = angleDiffDeg(startHeadingDeg, headingToNext);
                if (diff > 75) stepCost += 10_000_000;
                else if (diff > 45) stepCost += 1000;
            } else if (prev !== -1) {
                const pLng = nodeLng[prev];
                const pLat = nodeLat[prev];
                const turn = signedTurnDeg(pLng, pLat, cLng, cLat, nLng, nLat);
                const absTurn = Math.abs(turn);

                if (roadType === 2) {
                    stepCost *= 1.1;
                    if (turn < -105) stepCost += 100_000;
                }

                if (roadType !== 4) {
                    if (absTurn > 105) stepCost += Infinity;
                    else if (turn < -45) stepCost += 2000;
                    else if (turn > 45) stepCost += 500;
                    else if (absTurn > 10) stepCost += 50;
                }
            }

            if (stepCost < 1) stepCost = 1;
            const tentative = currentG + stepCost;
            if (tentative < gScore[next]) {
                gScore[next] = tentative;
                previous[next] = current;
                heap.push(next, tentative + heuristic(next));
            }
        }
    }

    if (foundEnd === -1) return null;

    const path = [];
    let cursor = foundEnd;
    while (cursor !== -1) {
        path.unshift(cursor);
        cursor = previous[cursor];
        if (path.length > 50000) break;
    }

    if (path.length < 2) return null;
    return { path, endId: foundEnd };
}

function buildRouteStats(pathNodeIds) {
    const nodeLng = routeEngine.nodeLng;
    const nodeLat = routeEngine.nodeLat;
    const len = pathNodeIds.length;

    const cumulativeGameMin = new Float32Array(len);
    const cumulativeRealMin = new Float32Array(len);
    const cumulativeGameKm = new Float32Array(len);

    let totalGameMin = 0;
    let totalRealMin = 0;
    let totalGameKm = 0;

    for (let i = 0; i < len - 1; i++) {
        const id1 = pathNodeIds[i];
        const id2 = pathNodeIds[i + 1];

        const lng1 = nodeLng[id1];
        const lat1 = nodeLat[id1];
        const lng2 = nodeLng[id2];
        const lat2 = nodeLat[id2];

        const [x1, z1] = LCC.forward(lng1, lat1);
        const [x2, z2] = LCC.forward(lng2, lat2);

        const dx = x2 - x1;
        const dz = z2 - z1;
        const rawLen = Math.sqrt(dx * dx + dz * dz);

        const midX = (x1 + x2) / 2;
        const midZ = (z1 + z2) / 2;
        const scale = getScaleMultiplier(midX, midZ);

        const gameKm = (rawLen * scale) / 1000;
        const speed = scale === 3 ? GAME_SPEED_CITY : GAME_SPEED_HIGHWAY;
        const gameMin = (gameKm / speed) * 60;
        const realMin = gameMin / scale;

        totalGameKm += gameKm;
        totalGameMin += gameMin;
        totalRealMin += realMin;

        cumulativeGameKm[i + 1] = totalGameKm;
        cumulativeGameMin[i + 1] = totalGameMin;
        cumulativeRealMin[i + 1] = totalRealMin;
    }

    return {
        cumulativeGameMin,
        cumulativeRealMin,
        cumulativeGameKm,
        totalGameKm,
        totalGameMin,
        totalRealMin,
    };
}

function computePathProgress(pathNodeIds, truckLng, truckLat, lastIndex) {
    const nodeLng = routeEngine.nodeLng;
    const nodeLat = routeEngine.nodeLat;
    const lastSegment = Math.max(0, pathNodeIds.length - 2);
    if (!lastSegment) return { segmentIndex: 0, distSq: Infinity, distKm: Infinity };

    const searchStart = Math.max(0, lastIndex - 5);
    const searchEnd = Math.min(lastSegment, lastIndex + 80);

    let bestIndex = searchStart;
    let bestDistSq = Infinity;

    for (let i = searchStart; i <= searchEnd; i++) {
        const a = pathNodeIds[i];
        const b = pathNodeIds[i + 1];
        const d2 = pointSegmentDistanceSq(
            truckLng,
            truckLat,
            nodeLng[a],
            nodeLat[a],
            nodeLng[b],
            nodeLat[b],
        );
        if (d2 < bestDistSq) {
            bestDistSq = d2;
            bestIndex = i;
        }
    }

    if (bestDistSq > 0.25) {
        for (let i = 0; i <= lastSegment; i++) {
            const a = pathNodeIds[i];
            const b = pathNodeIds[i + 1];
            const d2 = pointSegmentDistanceSq(
                truckLng,
                truckLat,
                nodeLng[a],
                nodeLat[a],
                nodeLng[b],
                nodeLat[b],
            );
            if (d2 < bestDistSq) {
                bestDistSq = d2;
                bestIndex = i;
            }
        }
    }

    return { segmentIndex: bestIndex, distSq: bestDistSq, distKm: Math.sqrt(bestDistSq) };
}

function parseGameMinutes(timeStr) {
    if (!timeStr) return 0;
    const d = new Date(timeStr);
    const base = new Date("0001-01-01T00:00:00Z");
    const ms = d.getTime() - base.getTime();
    return ms > 0 ? ms / 60000 : 0;
}

function formatEtaText(realMinutes) {
    const clamped = Math.max(1, Math.round(realMinutes));
    const h = Math.floor(clamped / 60);
    const m = clamped % 60;
    if (h > 0) return `${h}시간 ${m}분`;
    return `${m}분`;
}

function updateEffectiveSpeedKmh(truck, navigation, game) {
    if (!truck || !game?.connected || game?.paused) return routeEngine.speedEmaKmh;

    const rawSpeed = Math.max(0, Math.min(SPEED_SPIKE_MAX_KMH, Number(truck.speed || 0)));
    if (rawSpeed <= 0.1) {
        const speedDiff = Math.abs(rawSpeed - routeEngine.lastSpeedKmh);
        routeEngine.lastSpeedKmh = rawSpeed;
        routeEngine.speedDeltaEmaKmh =
            routeEngine.speedDeltaEmaKmh * (1 - SPEED_DELTA_EMA_ALPHA) +
            speedDiff * SPEED_DELTA_EMA_ALPHA;
        routeEngine.speedEmaKmh *= 1 - SPEED_EMA_STOP_DECAY_ALPHA;
        if (!Number.isFinite(routeEngine.speedEmaKmh) || routeEngine.speedEmaKmh < 0.25) {
            routeEngine.speedEmaKmh = 0;
        }
        return routeEngine.speedEmaKmh;
    }

    if (routeEngine.speedEmaKmh <= 0) {
        routeEngine.speedEmaKmh = rawSpeed;
        routeEngine.lastSpeedKmh = rawSpeed;
        return routeEngine.speedEmaKmh;
    }

    const speedDiff = Math.abs(rawSpeed - routeEngine.lastSpeedKmh);
    routeEngine.lastSpeedKmh = rawSpeed;
    routeEngine.speedDeltaEmaKmh =
        routeEngine.speedDeltaEmaKmh * (1 - SPEED_DELTA_EMA_ALPHA) +
        speedDiff * SPEED_DELTA_EMA_ALPHA;

    // 현실 네비처럼 실제 속도를 반영하되 급변 노이즈는 완만화
    routeEngine.speedEmaKmh =
        routeEngine.speedEmaKmh * (1 - SPEED_EMA_ALPHA) +
        rawSpeed * SPEED_EMA_ALPHA;

    if (!Number.isFinite(routeEngine.speedEmaKmh) || routeEngine.speedEmaKmh < 0) {
        routeEngine.speedEmaKmh = rawSpeed;
    }

    return routeEngine.speedEmaKmh;
}

function getEtaProjectionRate(context = {}) {
    const remainingKm = Number(context.remainingKm);
    const truckSpeedKmh = Math.max(0, Number(context.truckSpeedKmh) || 0);
    const effectiveSpeedKmh = Math.max(0, Number(context.effectiveSpeedKmh) || 0);

    if (context.isPaused) return 0;
    if (truckSpeedKmh <= ETA_PROJECTION_STOP_SPEED_KMH && remainingKm > 1) return 0;
    if (effectiveSpeedKmh < ETA_PROJECTION_SLOW_SPEED_KMH && remainingKm > 3) {
        return ETA_PROJECTION_SLOW_FACTOR;
    }
    if (effectiveSpeedKmh < ETA_PROJECTION_LOW_SPEED_KMH && remainingKm > 10) {
        return ETA_PROJECTION_LOW_FACTOR;
    }
    if (effectiveSpeedKmh < ETA_PROJECTION_MED_SPEED_KMH && remainingKm > 30) {
        return ETA_PROJECTION_MED_FACTOR;
    }
    return 1;
}

function updateEtaWaitPenalty(context = {}) {
    const now = Date.now();
    if (!routeEngine.waitPenaltyUpdatedAtMs) {
        routeEngine.waitPenaltyUpdatedAtMs = now;
        return routeEngine.waitPenaltyMinutes;
    }

    const elapsedMin = Math.max(0, (now - routeEngine.waitPenaltyUpdatedAtMs) / 60000);
    routeEngine.waitPenaltyUpdatedAtMs = now;
    if (elapsedMin <= 0) return routeEngine.waitPenaltyMinutes;

    const remainingKm = Math.max(0, Number(context.remainingKm) || 0);
    const truckSpeedKmh = Math.max(0, Number(context.truckSpeedKmh) || 0);
    const effectiveSpeedKmh = Math.max(0, Number(context.effectiveSpeedKmh) || 0);
    const isPaused = !!context.isPaused;

    if (isPaused && remainingKm > 1) {
        routeEngine.waitPenaltyMinutes = Math.min(
            20,
            routeEngine.waitPenaltyMinutes + elapsedMin,
        );
        return routeEngine.waitPenaltyMinutes;
    }

    if (truckSpeedKmh <= ETA_PROJECTION_STOP_SPEED_KMH && remainingKm > 1) {
        routeEngine.waitPenaltyMinutes = Math.min(
            20,
            routeEngine.waitPenaltyMinutes + elapsedMin * 0.85,
        );
        return routeEngine.waitPenaltyMinutes;
    }

    if (effectiveSpeedKmh < ETA_PROJECTION_LOW_SPEED_KMH && remainingKm > 3) {
        routeEngine.waitPenaltyMinutes = Math.min(
            20,
            routeEngine.waitPenaltyMinutes + elapsedMin * 0.2,
        );
        return routeEngine.waitPenaltyMinutes;
    }

    let decayRate = 0.1;
    if (effectiveSpeedKmh >= ETA_PROJECTION_MED_SPEED_KMH) {
        decayRate = 0.35;
    } else if (effectiveSpeedKmh >= ETA_PROJECTION_LOW_SPEED_KMH) {
        decayRate = 0.2;
    }
    routeEngine.waitPenaltyMinutes = Math.max(
        0,
        routeEngine.waitPenaltyMinutes - elapsedMin * decayRate,
    );
    return routeEngine.waitPenaltyMinutes;
}

function getEtaCalibrationBlendWeight(context = {}) {
    const remainingKm = Math.max(0, Number(context.remainingKm) || 0);
    const routeAgeMs = Math.max(0, Number(context.routeAgeMs) || 0);
    const navRatioClamped = Number(context.navRatioClamped);
    const isPaused = !!context.isPaused;

    let distanceWeight = 0.2;
    if (remainingKm <= ETA_CALIBRATION_BLEND_NEAR_KM) {
        distanceWeight = 0.95;
    } else if (remainingKm <= ETA_CALIBRATION_BLEND_MID_KM) {
        distanceWeight = 0.65;
    } else if (remainingKm <= ETA_CALIBRATION_BLEND_FAR_KM) {
        distanceWeight = 0.4;
    }

    let ageWeight = 1;
    if (routeAgeMs <= ETA_CALIBRATION_BLEND_START_MS) {
        ageWeight = 0.2;
    } else if (routeAgeMs < ETA_CALIBRATION_BLEND_FULL_MS) {
        ageWeight = smoothstep01(
            (routeAgeMs - ETA_CALIBRATION_BLEND_START_MS) /
                (ETA_CALIBRATION_BLEND_FULL_MS - ETA_CALIBRATION_BLEND_START_MS),
        );
    }

    let ratioTrustWeight = 1;
    if (Number.isFinite(navRatioClamped)) {
        const deviation = Math.abs(navRatioClamped - 1);
        if (deviation >= ETA_CALIBRATION_RATIO_DEVIATION_HARD) {
            ratioTrustWeight = 0.25;
        } else if (deviation > ETA_CALIBRATION_RATIO_DEVIATION_SOFT) {
            ratioTrustWeight =
                1 -
                0.75 *
                    smoothstep01(
                        (deviation - ETA_CALIBRATION_RATIO_DEVIATION_SOFT) /
                            (ETA_CALIBRATION_RATIO_DEVIATION_HARD -
                                ETA_CALIBRATION_RATIO_DEVIATION_SOFT),
                    );
        }
    }

    let blendWeight = distanceWeight * ageWeight * ratioTrustWeight;
    if (isPaused && remainingKm > 1) {
        blendWeight *= 0.5;
    }

    return Math.max(0, Math.min(1, blendWeight));
}

function smoothLerp(start, end, ratio) {
    return start + (end - start) * smoothstep01(ratio);
}

function getLiveEtaDistanceWeight(remainingKm) {
    if (!Number.isFinite(remainingKm)) return 0;
    if (remainingKm >= LIVE_WEIGHT_FAR_KM) return 0;

    if (remainingKm >= LIVE_WEIGHT_MID_KM) {
        const t = (LIVE_WEIGHT_FAR_KM - remainingKm) / (LIVE_WEIGHT_FAR_KM - LIVE_WEIGHT_MID_KM);
        return smoothLerp(0, LIVE_WEIGHT_DIST_AT_MID, t);
    }
    if (remainingKm >= LIVE_WEIGHT_NEAR_KM) {
        const t = (LIVE_WEIGHT_MID_KM - remainingKm) / (LIVE_WEIGHT_MID_KM - LIVE_WEIGHT_NEAR_KM);
        return smoothLerp(LIVE_WEIGHT_DIST_AT_MID, LIVE_WEIGHT_DIST_AT_NEAR, t);
    }
    if (remainingKm >= LIVE_WEIGHT_FULL_KM) {
        const t =
            (LIVE_WEIGHT_NEAR_KM - remainingKm) / (LIVE_WEIGHT_NEAR_KM - LIVE_WEIGHT_FULL_KM);
        return smoothLerp(LIVE_WEIGHT_DIST_AT_NEAR, LIVE_WEIGHT_DIST_AT_FULL, t);
    }

    const t = (LIVE_WEIGHT_FULL_KM - Math.max(0, remainingKm)) / LIVE_WEIGHT_FULL_KM;
    return smoothLerp(LIVE_WEIGHT_DIST_AT_FULL, LIVE_WEIGHT_DIST_AT_FINAL, t);
}

function getLiveEtaSpeedReliabilityWeight(effectiveSpeedKmh, remainingKm) {
    if (!Number.isFinite(effectiveSpeedKmh) || effectiveSpeedKmh <= 0) return 0;
    if (remainingKm > LIVE_WEIGHT_NEAR_KM) {
        if (effectiveSpeedKmh < LIVE_SPEED_RELIABILITY_LOW_KMH) return 0.05;
        if (effectiveSpeedKmh < LIVE_SPEED_RELIABILITY_MID_KMH) return 0.2;
        if (effectiveSpeedKmh < LIVE_SPEED_RELIABILITY_HIGH_KMH) return 0.45;
    }
    if (effectiveSpeedKmh < ARRIVAL_SPEED_MAX_KMH) return 0.2;
    return 1;
}

function getLiveEtaVolatilityWeight(speedDeltaEmaKmh) {
    if (!Number.isFinite(speedDeltaEmaKmh)) return 1;
    let weight = 1;
    if (speedDeltaEmaKmh > 12) weight *= 0.8;
    if (speedDeltaEmaKmh > 20) weight *= 0.7;
    if (speedDeltaEmaKmh > 30) weight *= 0.6;
    return weight;
}

function getLiveEtaWeight(remainingKm, speedDeltaEmaKmh, effectiveSpeedKmh) {
    const distanceWeight = getLiveEtaDistanceWeight(remainingKm);
    const speedReliabilityWeight = getLiveEtaSpeedReliabilityWeight(
        effectiveSpeedKmh,
        remainingKm,
    );
    const volatilityWeight = getLiveEtaVolatilityWeight(speedDeltaEmaKmh);
    const combined = distanceWeight * speedReliabilityWeight * volatilityWeight;
    return Math.max(0, Math.min(LIVE_WEIGHT_MAX, combined));
}

function clampSpeedBasedEtaMinutes(speedBasedRealMin, routeModelCalibratedMin, remainingKm) {
    if (!Number.isFinite(speedBasedRealMin) || speedBasedRealMin <= 0) {
        return Math.max(1, Number(routeModelCalibratedMin) || 1);
    }
    const model = Number(routeModelCalibratedMin);
    if (!Number.isFinite(model) || model <= 0) {
        return speedBasedRealMin;
    }

    let maxRatio = SPEED_BASED_MAX_RATIO_FINAL;
    if (remainingKm > LIVE_WEIGHT_FAR_KM) {
        maxRatio = SPEED_BASED_MAX_RATIO_FAR;
    } else if (remainingKm > LIVE_WEIGHT_NEAR_KM) {
        maxRatio = SPEED_BASED_MAX_RATIO_MID;
    } else if (remainingKm > 10) {
        maxRatio = SPEED_BASED_MAX_RATIO_NEAR;
    }

    const minEta = model * SPEED_BASED_MIN_RATIO;
    const maxEta = model * maxRatio;
    return Math.max(minEta, Math.min(maxEta, speedBasedRealMin));
}

function clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
}

function smoothstep01(value) {
    const t = clamp01(value);
    return t * t * (3 - 2 * t);
}

function getDestinationNearWeight(remainingKm) {
    if (!Number.isFinite(remainingKm)) return 0;
    if (remainingKm >= ETA_NEAR_BLEND_START_KM) return 0;
    if (remainingKm <= ETA_NEAR_BLEND_FULL_KM) return 1;

    const range = ETA_NEAR_BLEND_START_KM - ETA_NEAR_BLEND_FULL_KM;
    if (range <= 0) return 0;
    const ratio = (ETA_NEAR_BLEND_START_KM - remainingKm) / range;
    return smoothstep01(ratio);
}

function smoothEtaMinutes(rawEtaMinutes, context = {}) {
    const now = Date.now();
    const sanitizedRaw = Math.max(1, Number(rawEtaMinutes) || 0);
    if (routeEngine.etaSmoothedMinutes <= 0 || !routeEngine.etaUpdatedAtMs) {
        routeEngine.etaSmoothedMinutes = sanitizedRaw;
        routeEngine.etaUpdatedAtMs = now;
        return sanitizedRaw;
    }

    const elapsedMs = Math.max(0, now - routeEngine.etaUpdatedAtMs);
    const elapsedSec = Math.max(0.1, elapsedMs / 1000);
    const elapsedMin = elapsedSec / 60;
    const projectionRate = Math.max(0, Math.min(1, Number(context.projectionRate) || 0));
    const projected = Math.max(0, routeEngine.etaSmoothedMinutes - elapsedMin * projectionRate);
    const maxUp = ETA_JUMP_GUARD_UP_BASE_MIN + ETA_JUMP_GUARD_UP_RATE_MIN_PER_SEC * elapsedSec;
    const maxDown =
        ETA_JUMP_GUARD_DOWN_BASE_MIN + ETA_JUMP_GUARD_DOWN_RATE_MIN_PER_SEC * elapsedSec;

    let guardedRaw = sanitizedRaw;
    const delta = guardedRaw - projected;
    if (delta > maxUp) guardedRaw = projected + maxUp;
    if (delta < -maxDown) guardedRaw = projected - maxDown;

    const remainingKm = Number(context.remainingKm);
    const nearBlendWeight = Number.isFinite(remainingKm)
        ? smoothstep01(
              (ETA_NEAR_BLEND_START_KM -
                  Math.max(0, Math.min(ETA_NEAR_BLEND_START_KM, remainingKm))) /
                  ETA_NEAR_BLEND_START_KM,
          )
        : 0;
    const alpha = Math.max(
        0.12,
        Math.min(0.5, ETA_SMOOTH_ALPHA_BASE + nearBlendWeight * ETA_SMOOTH_ALPHA_NEAR_BOOST),
    );
    const smoothed = projected * (1 - alpha) + guardedRaw * alpha;

    routeEngine.etaSmoothedMinutes = smoothed;
    routeEngine.etaUpdatedAtMs = now;
    return smoothed;
}

function logEtaMode(mode, info = {}) {
    if (routeEngine.lastEtaMode !== mode) {
        routeEngine.lastEtaMode = mode;
        routeLog(`eta_mode_${mode}`, info);
        return;
    }
    routeLogThrottled(`eta_mode_${mode}`, `eta_mode_${mode}`, info);
}

function isArrivalState(routeEta, navigationDistanceKm, truckSpeedKmh, hasJob) {
    if (!hasJob) {
        routeEngine.arrivalSinceMs = 0;
        return false;
    }

    const remKm = routeEta?.remainingKm ?? navigationDistanceKm;
    const nearEnough =
        remKm <= ARRIVAL_REMAINING_KM_THRESHOLD ||
        navigationDistanceKm <= ARRIVAL_NAV_KM_THRESHOLD;
    const slowEnough = truckSpeedKmh <= ARRIVAL_SPEED_MAX_KMH;

    if (nearEnough && slowEnough) {
        if (!routeEngine.arrivalSinceMs) {
            routeEngine.arrivalSinceMs = Date.now();
        }
        return Date.now() - routeEngine.arrivalSinceMs >= ARRIVAL_HOLD_MS;
    }

    routeEngine.arrivalSinceMs = 0;
    return false;
}

function buildJobKey(job) {
    return [
        normalizeName(job.sourceCity),
        normalizeName(job.sourceCompany),
        normalizeName(job.destinationCity),
        normalizeName(job.destinationCompany),
    ].join("|");
}

async function buildRouteForJob(truck, job) {
    const buildStartMs = Date.now();
    const ready = await initializeRouteEngine();
    if (!ready) return null;

    const destinationGeoRaw = resolveDestinationGeo(
        job.destinationCity,
        job.destinationCompany,
    );
    if (!destinationGeoRaw) return null;
    const snapped = snapGeoToRoad(destinationGeoRaw[0], destinationGeoRaw[1]);
    const destinationGeo =
        snapped && snapped.used
            ? [snapped.lng, snapped.lat]
            : destinationGeoRaw;

    const truckPlacement = truck?.placement;
    if (!truckPlacement) return null;
    const truckGeo = LCC.inverse(truckPlacement.x, truckPlacement.z);

    const startCandidates = getClosestNodeIds(truckGeo[0], truckGeo[1], 8);
    const endCandidates = getClosestNodeIds(destinationGeo[0], destinationGeo[1], 24);
    if (!startCandidates.length || !endCandidates.length) return null;
    routeLog("route_build_start", {
        jobKey: buildJobKey(job),
        startCandidates: startCandidates.length,
        endCandidates: endCandidates.length,
        snappedDestination: !!(snapped && snapped.used),
        snapDistanceKm: snapped ? Number(snapped.distKm.toFixed(3)) : null,
    });

    const headingDeg =
        typeof truckPlacement.heading === "number"
            ? ((truckPlacement.heading * 180) / Math.PI + 360) % 360
            : null;

    let best = null;
    let attemptCount = 0;
    for (let i = 0; i < startCandidates.length; i++) {
        attemptCount++;
        const candidate = calculateRoute(startCandidates[i], endCandidates, headingDeg);
        if (!candidate) continue;
        if (!best || candidate.path.length < best.path.length) best = candidate;
        if (best && best.path.length < 1500) break;
    }

    if (!best) {
        routeLog("route_build_no_result", {
            attempts: attemptCount,
            buildMs: Date.now() - buildStartMs,
        });
        return null;
    }
    const stats = buildRouteStats(best.path);
    routeLog("route_build_success", {
        attempts: attemptCount,
        pathNodes: best.path.length,
        gameMinutes: Number(stats.totalGameMin.toFixed(2)),
        realMinutes: Number(stats.totalRealMin.toFixed(2)),
        gameKm: Number(stats.totalGameKm.toFixed(2)),
        buildMs: Date.now() - buildStartMs,
    });

    return {
        key: buildJobKey(job),
        pathNodeIds: best.path,
        endId: best.endId,
        destinationGeo,
        destinationRawGeo: destinationGeoRaw,
        destinationSnapDistKm: snapped ? snapped.distKm : null,
        createdAt: Date.now(),
        ...stats,
    };
}

async function ensureRouteCache(truck, job, options = {}) {
    const force = !!options.force;
    if (!job?.destinationCity || !job?.destinationCompany) {
        routeLogThrottled("no_job", "cache_clear_no_job");
        routeEngine.routeCache = null;
        routeEngine.etaSmoothedMinutes = 0;
        routeEngine.etaUpdatedAtMs = 0;
        routeEngine.waitPenaltyMinutes = 0;
        routeEngine.waitPenaltyUpdatedAtMs = 0;
        routeEngine.etaBootstrapSinceMs = 0;
        return;
    }

    const key = buildJobKey(job);
    const now = Date.now();
    const hasValid = routeEngine.routeCache && routeEngine.routeCache.key === key;
    const routeExpired =
        !hasValid ||
        now - routeEngine.routeCache.createdAt > ROUTE_FORCE_RECALC_MS;
    if (!routeExpired && !force) {
        routeLogThrottled("cache_ok", "cache_reuse", {
            key,
            ageMs: now - routeEngine.routeCache.createdAt,
        });
        return;
    }

    if (routeEngine.routeInFlight) {
        routeLogThrottled("inflight", "cache_wait_inflight", { key });
        return;
    }
    const minInterval = force
        ? ROUTE_DEVIATION_RECALC_COOLDOWN_MS
        : routeEngine.routeCache
            ? ROUTE_RECALC_MIN_INTERVAL_MS
            : ROUTE_NO_CACHE_RETRY_MS;
    if (now - routeEngine.lastRouteTryAt < minInterval) {
        routeLogThrottled("cooldown", "cache_wait_cooldown", {
            key,
            waitLeftMs: Math.max(0, minInterval - (now - routeEngine.lastRouteTryAt)),
            force,
        });
        return;
    }

    routeEngine.lastRouteTryAt = now;
    routeEngine.routeInFlight = true;
    routeLog("cache_rebuild_start", { key, force, routeExpired });
    const rebuildStartMs = Date.now();
    try {
        const route = await buildRouteForJob(truck, job);
        if (route) {
            routeEngine.routeCache = route;
            routeEngine.lastPathIndex = 0;
            if (!hasValid) {
                routeEngine.etaSmoothedMinutes = 0;
                routeEngine.etaUpdatedAtMs = 0;
                routeEngine.waitPenaltyMinutes = 0;
                routeEngine.waitPenaltyUpdatedAtMs = 0;
            }
            routeEngine.etaBootstrapSinceMs = 0;
            console.log(
                `[RouteEngine] Route built. nodes=${route.pathNodeIds.length}, game=${route.totalGameMin.toFixed(
                    1,
                )}m, real=${route.totalRealMin.toFixed(1)}m, snap=${(
                    route.destinationSnapDistKm ?? 0
                ).toFixed(2)}km`,
            );
            routeLog("cache_rebuild_success", {
                key,
                pathNodes: route.pathNodeIds.length,
                realMinutes: Number(route.totalRealMin.toFixed(2)),
                rebuildMs: Date.now() - rebuildStartMs,
            });
        } else {
            console.warn("[RouteEngine] Route build returned null");
            routeLog("cache_rebuild_null", {
                key,
                rebuildMs: Date.now() - rebuildStartMs,
            });
        }
    } catch (error) {
        console.error("[RouteEngine] Route build failed:", error);
        routeLog("cache_rebuild_failed", {
            key,
            rebuildMs: Date.now() - rebuildStartMs,
            message: error?.message || String(error),
        });
    } finally {
        routeEngine.routeInFlight = false;
    }
}

function estimateRealEtaFromRoute(truck, navigation, game) {
    const calcStartMs = Date.now();
    const cache = routeEngine.routeCache;
    if (!cache || !truck?.placement) return null;

    const truckGeo = LCC.inverse(truck.placement.x, truck.placement.z);
    const progress = computePathProgress(
        cache.pathNodeIds,
        truckGeo[0],
        truckGeo[1],
        routeEngine.lastPathIndex,
    );
    routeEngine.lastPathIndex = progress.segmentIndex;

    const idx = progress.segmentIndex;
    const remGame = Math.max(0, cache.totalGameMin - cache.cumulativeGameMin[idx]);
    const remKm = Math.max(0, cache.totalGameKm - cache.cumulativeGameKm[idx]);
    const routeAgeMs = Math.max(0, Date.now() - Number(cache.createdAt || 0));
    const routeModelPure = Math.max(0, cache.totalRealMin - cache.cumulativeRealMin[idx]);
    let routeModelCalibrated = routeModelPure;
    let navRatioClamped = 1;

    const navGame = parseGameMinutes(navigation?.estimatedTime);
    if (navGame > 1 && remGame > 1) {
        const ratio = navGame / remGame;
        navRatioClamped = Math.max(0.5, Math.min(1.8, ratio));
        routeModelCalibrated *= navRatioClamped;
    }

    const truckSpeedKmh = Math.max(0, Number(truck?.speed || 0));
    const liveSpeed = Math.max(0, updateEffectiveSpeedKmh(truck, navigation, game) || 0);
    const speedForEta = Math.max(ETA_MIN_EFFECTIVE_SPEED_KMH, liveSpeed);
    const speedBasedRealMin = speedForEta > 0 ? (remKm / speedForEta) * 60 : routeModelCalibrated;
    const speedBasedCappedMin = clampSpeedBasedEtaMinutes(
        speedBasedRealMin,
        routeModelCalibrated,
        remKm,
    );
    const liveDistanceWeight = getLiveEtaDistanceWeight(remKm);
    const liveSpeedReliabilityWeight = getLiveEtaSpeedReliabilityWeight(liveSpeed, remKm);
    const liveVolatilityWeight = getLiveEtaVolatilityWeight(routeEngine.speedDeltaEmaKmh);
    const baseLiveWeight = getLiveEtaWeight(remKm, routeEngine.speedDeltaEmaKmh, liveSpeed);
    const liveWeight =
        game?.paused || (truckSpeedKmh <= ETA_PROJECTION_STOP_SPEED_KMH && remKm > 1)
            ? 0
            : baseLiveWeight;
    const etaProjectionRate = getEtaProjectionRate({
        remainingKm: remKm,
        truckSpeedKmh,
        effectiveSpeedKmh: liveSpeed,
        isPaused: !!game?.paused,
    });
    const waitPenaltyMinutes = updateEtaWaitPenalty({
        remainingKm: remKm,
        truckSpeedKmh,
        effectiveSpeedKmh: liveSpeed,
        isPaused: !!game?.paused,
    });
    const pureBlendedRaw =
        liveWeight > 0
            ? routeModelPure * (1 - liveWeight) + speedBasedCappedMin * liveWeight
            : routeModelPure;
    const calibratedBlendedRaw =
        liveWeight > 0
            ? routeModelCalibrated * (1 - liveWeight) + speedBasedCappedMin * liveWeight
            : routeModelCalibrated;
    const pureCandidateMinutes = pureBlendedRaw + waitPenaltyMinutes;
    const calibratedCandidateMinutes = calibratedBlendedRaw + waitPenaltyMinutes;
    const calibrationBlendWeight = getEtaCalibrationBlendWeight({
        remainingKm: remKm,
        routeAgeMs,
        navRatioClamped,
        isPaused: !!game?.paused,
    });
    const hybridCandidateMinutes =
        pureCandidateMinutes * (1 - calibrationBlendWeight) +
        calibratedCandidateMinutes * calibrationBlendWeight;

    let remReal = hybridCandidateMinutes;
    remReal = Math.max(1, remReal);
    remReal = smoothEtaMinutes(remReal, {
        remainingKm: remKm,
        projectionRate: etaProjectionRate,
    });

    return {
        realMinutes: remReal,
        remainingKm: remKm,
        offRouteKm: progress.distKm,
        segmentIndex: progress.segmentIndex,
        routeModelPureMinutes: routeModelPure,
        routeModelCalibratedMinutes: routeModelCalibrated,
        routeModelRealMinutes: hybridCandidateMinutes,
        routeModelHybridMinutes: hybridCandidateMinutes,
        speedBasedRealMinutes: speedBasedRealMin,
        speedBasedCappedMinutes: speedBasedCappedMin,
        liveWeight,
        liveDistanceWeight,
        liveSpeedReliabilityWeight,
        liveVolatilityWeight,
        liveSpeedKmh: liveSpeed,
        truckSpeedKmh,
        etaProjectionRate,
        waitPenaltyMinutes,
        routeAgeMs,
        navRatioClamped,
        calibrationBlendWeight,
        pureCandidateMinutes,
        calibratedCandidateMinutes,
        hybridCandidateMinutes,
        pureBlendedRawMinutes: pureBlendedRaw,
        calibratedBlendedRawMinutes: calibratedBlendedRaw,
        navGameMinutes: navGame,
        remGameMinutes: remGame,
        calcMs: Date.now() - calcStartMs,
    };
}

// ==========================================
// 1. Drag widgets
// ==========================================
function makeDraggable(element) {
    const header = element.querySelector(".widget-header");
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    header.addEventListener("mousedown", (e) => {
        isDragging = true;
        const rect = element.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        document.querySelectorAll(".widget").forEach((w) => (w.style.zIndex = "10"));
        element.style.zIndex = "100";
    });

    document.addEventListener("mouseup", () => {
        if (!isDragging) return;
        isDragging = false;
        localStorage.setItem(
            `pos_${element.id}`,
            JSON.stringify({ left: element.style.left, top: element.style.top }),
        );
    });

    document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        const x = Math.max(
            0,
            Math.min(e.clientX - offsetX, window.innerWidth - element.offsetWidth),
        );
        const y = Math.max(
            0,
            Math.min(e.clientY - offsetY, window.innerHeight - element.offsetHeight),
        );
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
    });
}

const defaultPositions = {
    "widget-truck": { left: "20px", top: "20px" },
    "widget-job": { left: "20px", top: "160px" },
    "widget-nav": { left: "20px", top: "340px" },
};

document.querySelectorAll(".widget").forEach((widget) => {
    let applied = false;
    const saved = localStorage.getItem(`pos_${widget.id}`);
    if (saved) {
        try {
            const p = JSON.parse(saved);
            const x = parseInt(p.left, 10);
            const y = parseInt(p.top, 10);
            if (
                !Number.isNaN(x) &&
                !Number.isNaN(y) &&
                x >= 0 &&
                x <= (window.innerWidth || 1920) &&
                y >= 0 &&
                y <= (window.innerHeight || 1080)
            ) {
                widget.style.left = p.left;
                widget.style.top = p.top;
                applied = true;
            }
        } catch (_) {}
    }
    if (!applied) {
        widget.style.left = defaultPositions[widget.id].left;
        widget.style.top = defaultPositions[widget.id].top;
        localStorage.removeItem(`pos_${widget.id}`);
    }
    makeDraggable(widget);
});

// ==========================================
// 2. Settings + Electron IPC
// ==========================================
window.openSettingsModal = async function () {
    if (window.electronAPI) {
        const config = await window.electronAPI.getShortcuts();
        document.getElementById("key-mode").value = config.toggleMode;
        document.getElementById("key-toggle").value = config.toggleOverlay;
        document.getElementById("key-settings").value = config.openSettings;
        document.getElementById("opt-opacity").value = config.opacity;
        document.getElementById("opt-truck").checked = config.showTruck;
        document.getElementById("opt-job").checked = config.showJob;
        document.getElementById("opt-nav").checked = config.showNav;
    }
    document.getElementById("settings-modal").style.display = "flex";
};

window.closeSettingsModal = function () {
    document.getElementById("settings-modal").style.display = "none";
    if (window.electronAPI) window.electronAPI.setLocked(true);
};

document.querySelectorAll('.setting-item input[type="text"]').forEach((input) => {
    input.addEventListener("focus", () => {
        if (window.electronAPI) window.electronAPI.suspendShortcuts();
        input.dataset.oldVal = input.value;
        input.value = "";
        input.placeholder = "원하는 키 입력... (취소: Esc)";
    });

    input.addEventListener("blur", () => {
        if (input.value.trim() === "") input.value = input.dataset.oldVal || "";
        if (window.electronAPI) window.electronAPI.resumeShortcuts();
    });

    input.addEventListener("keydown", (e) => {
        e.preventDefault();
        let key = e.key;
        if (key.length === 1 && key >= "a" && key <= "z") key = key.toUpperCase();
        if (key === " ") key = "Space";
        if (key === "Escape") {
            input.value = input.dataset.oldVal || "";
            input.blur();
            return;
        }
        input.value = key;
        input.blur();
    });
});

document.getElementById("btn-save").onclick = () => {
    if (window.electronAPI) {
        const config = {
            toggleMode: document.getElementById("key-mode").value || "Insert",
            toggleOverlay: document.getElementById("key-toggle").value || "PageDown",
            openSettings: document.getElementById("key-settings").value || "PageUp",
            opacity: parseInt(document.getElementById("opt-opacity").value, 10),
            showTruck: document.getElementById("opt-truck").checked,
            showJob: document.getElementById("opt-job").checked,
            showNav: document.getElementById("opt-nav").checked,
        };
        window.electronAPI.updateShortcuts(config);
        applyVisualConfig(config);
    }
    window.closeSettingsModal();
};

document.getElementById("btn-cancel").onclick = () => window.closeSettingsModal();
document.getElementById("btn-quit").onclick = () => {
    if (window.electronAPI) window.electronAPI.closeOverlay();
};

function applyVisualConfig(config) {
    document
        .querySelectorAll(".widget")
        .forEach((w) => (w.style.backgroundColor = `rgba(22, 22, 25, ${config.opacity / 100})`));
    document.getElementById("widget-truck").style.display = config.showTruck ? "flex" : "none";
    document.getElementById("widget-job").style.display = config.showJob ? "flex" : "none";
    document.getElementById("widget-nav").style.display = config.showNav ? "flex" : "none";
}

if (window.electronAPI) window.electronAPI.getShortcuts().then(applyVisualConfig);

// ==========================================
// 3. Telemetry + Premium route ETA
// ==========================================
const elTruckDamage = document.getElementById("truck-damage");
const elTruckGear = document.getElementById("truck-gear");
const elTruckFuel = document.getElementById("truck-fuel");
const elTruckRange = document.getElementById("truck-range");
const elTrailerDamage = document.getElementById("trailer-damage");

const elJobSource = document.getElementById("job-source");
const elJobDest = document.getElementById("job-dest");
const elCargoInfo = document.getElementById("cargo-info");
const elCargoDamage = document.getElementById("cargo-damage");
const elJobIncome = document.getElementById("job-income");
const elFuelConsumption = document.getElementById("fuel-consumption");

const elNavDistance = document.getElementById("nav-distance");
const elNavEta = document.getElementById("nav-eta");
const elRealClock = document.getElementById("real-clock");
const elEtaEvalStatus = document.getElementById("eta-eval-status");

function formatGear(gear) {
    if (gear > 0) return `D${gear}`;
    if (gear < 0) return `R${Math.abs(gear)}`;
    return "N";
}

function updateRealClock() {
    if (!elRealClock) return;
    const now = new Date();
    let h = now.getHours();
    const ampm = h >= 12 ? "오후" : "오전";
    h = h % 12 || 12;
    const m = String(now.getMinutes()).padStart(2, "0");
    elRealClock.innerText = `${ampm} ${h}:${m}`;
    refreshEtaEvalStatusIndicator();
}

function refreshEtaEvalStatusIndicator() {
    if (!elEtaEvalStatus) return;

    if (etaEvalUiState.lastError) {
        elEtaEvalStatus.className = "eta-eval-pill off";
        elEtaEvalStatus.innerText = "분석 기록 오류";
        return;
    }

    if (!etaEvalUiState.available) {
        elEtaEvalStatus.className = "eta-eval-pill off";
        elEtaEvalStatus.innerText = "분석 기록 비활성";
        return;
    }

    if (!etaEvalUiState.lastTickSentAtMs) {
        elEtaEvalStatus.className = "eta-eval-pill wait";
        elEtaEvalStatus.innerText = "분석 기록 준비";
        return;
    }

    const ageMs = Date.now() - etaEvalUiState.lastTickSentAtMs;
    if (ageMs <= 2_500) {
        elEtaEvalStatus.className = "eta-eval-pill on";
        const shortSession = etaEvalUiState.sessionId
            ? etaEvalUiState.sessionId.slice(-6)
            : "active";
        elEtaEvalStatus.innerText = `분석 기록중 (${shortSession})`;
        return;
    }

    elEtaEvalStatus.className = "eta-eval-pill wait";
    elEtaEvalStatus.innerText = "분석 기록 대기";
}

async function initializeEtaEvalStatusIndicator() {
    if (!elEtaEvalStatus) return;
    if (!window?.electronAPI?.getEtaEvalSession) {
        refreshEtaEvalStatusIndicator();
        return;
    }

    try {
        const session = await window.electronAPI.getEtaEvalSession();
        if (session?.session_id) {
            etaEvalUiState.available = true;
            etaEvalUiState.sessionId = String(session.session_id);
        } else {
            etaEvalUiState.available = false;
            etaEvalUiState.lastError = "session_id 없음";
        }
    } catch (error) {
        etaEvalUiState.available = false;
        etaEvalUiState.lastError = error?.message || String(error);
    }
    refreshEtaEvalStatusIndicator();
}

setInterval(updateRealClock, 1000);
updateRealClock();
initializeEtaEvalStatusIndicator();

function startEtaEvalTrip(jobKey) {
    const now = Date.now();
    const resume = getEtaEvalJourneyResume(jobKey);
    etaEvalTripState.activeTripId = createEtaEvalId("trip");
    etaEvalTripState.activeJourneyId = resume?.journey_id || createEtaEvalId("journey");
    etaEvalTripState.activeJourneySegmentIndex = Math.max(
        1,
        Number(resume?.next_segment_index || 1),
    );
    etaEvalTripState.resumedFromTripId = String(resume?.last_trip_id || "");
    etaEvalTripState.activeJobKey = jobKey;
    etaEvalTripState.startedAtMs = now;
    etaEvalTripState.rerouteCount = 0;
    etaEvalTripState.maxOffRouteKm = 0;
    etaEvalTripState.speedSum = 0;
    etaEvalTripState.speedSamples = 0;
    writeEtaEvalJourneyState({
        journey_id: etaEvalTripState.activeJourneyId,
        job_key: jobKey,
        next_segment_index: etaEvalTripState.activeJourneySegmentIndex,
        last_trip_id: etaEvalTripState.activeTripId,
        pending_since_ms: now,
        end_reason: "active",
    });
    emitEtaEvalEvent("trip_start", {
        trip_id: etaEvalTripState.activeTripId,
        journey_id: etaEvalTripState.activeJourneyId,
        journey_segment_index: etaEvalTripState.activeJourneySegmentIndex,
        resumed_from_trip_id: etaEvalTripState.resumedFromTripId,
        job_key: jobKey,
        started_at_ms: now,
    });
}

async function fetchTelemetry() {
    const cycleStartMs = Date.now();
    let telemetryFetchMs = 0;
    let cacheEnsureMs = 0;
    let etaCalcMs = 0;
    let distKm = 0;
    let truckSpeedKmh = 0;
    let routeAgeMs = 0;
    let routeEta = null;
    let hasJob = false;
    let jobKey = "";
    let navGameMin = 0;
    let scale = 19;
    let etaRealMinutes = 0;
    let etaAStarPure = 0;
    let etaAStarCalibrated = 0;
    let etaApiBase = 0;
    let etaApiNearInterp = 0;
    let etaDisplayedLegacy = 0;
    let etaDisplayedHybrid = 0;
    let remainingKmForCandidates = 0;
    let nearInterpWeight = 0;
    let navFallbackUsed = false;
    try {
        const fetchStartMs = Date.now();
        const response = await fetch(TELEMETRY_URL);
        if (!response.ok) return;
        const data = await response.json();
        telemetryFetchMs = Date.now() - fetchStartMs;
        const { game, truck, trailer, job, navigation } = data;
        hasJob = !!job?.destinationCity;
        jobKey = hasJob ? buildJobKey(job) : "";
        truckSpeedKmh = Math.max(0, Number(truck?.speed || 0));

        if (!game.connected) {
            if (etaEvalTripState.activeTripId) {
                finalizeEtaEvalTrip("disconnect", Date.now());
            }
            routeEngine.waitPenaltyMinutes = 0;
            routeEngine.waitPenaltyUpdatedAtMs = 0;
            elNavDistance.innerText = "미연결";
            elNavEta.innerText = "-";
            logEtaMode("disconnected");
            emitEtaEvalTick({
                type: "telemetry_tick",
                game_connected: false,
                game_paused: !!game?.paused,
                has_job: hasJob,
                eta_mode: routeEngine.lastEtaMode || "disconnected",
                truck_speed_kmh: safeNumber(truckSpeedKmh, 3),
                total_cycle_ms: Date.now() - cycleStartMs,
                fetch_ms: telemetryFetchMs,
                cache_ms: cacheEnsureMs,
                eta_ms: etaCalcMs,
                has_route_cache: !!routeEngine.routeCache,
                route_inflight: !!routeEngine.routeInFlight,
            });
            return;
        }

        if (hasJob) {
            if (!etaEvalTripState.activeTripId) {
                startEtaEvalTrip(jobKey);
            } else if (etaEvalTripState.activeJobKey !== jobKey) {
                finalizeEtaEvalTrip("job_changed", Date.now());
                startEtaEvalTrip(jobKey);
            }
        } else if (etaEvalTripState.activeTripId) {
            finalizeEtaEvalTrip("job_cleared", Date.now());
        }

        const maxTruckWear = Math.max(
            truck.wearEngine,
            truck.wearTransmission,
            truck.wearCabin,
            truck.wearChassis,
            truck.wearWheels,
        );
        elTruckDamage.innerText = `${Math.round(maxTruckWear * 100)}%`;
        elTruckGear.innerText = formatGear(truck.displayedGear);

        elTruckFuel.innerText = `${Math.round(truck.fuel)} l / ${Math.round(truck.fuelCapacity)} l`;
        const range = truck.fuelAverageConsumption > 0
            ? Math.round(truck.fuel / truck.fuelAverageConsumption)
            : 0;
        elTruckRange.innerText = `${range} km`;
        elTrailerDamage.innerText = trailer.attached ? `${Math.round(trailer.wear * 100)}%` : "0%";

        if (hasJob) {
            if (!routeEngine.etaBootstrapSinceMs) {
                routeEngine.etaBootstrapSinceMs = Date.now();
            }
            elJobSource.innerText = `${job.sourceCity}, ${job.sourceCompany}`;
            elJobDest.innerText = `${job.destinationCity}, ${job.destinationCompany}`;
            elCargoInfo.innerText = `${trailer.name || "화물 없음"} (${trailer.mass ? Math.round(trailer.mass / 1000) : 0} t)`;
            elCargoDamage.innerText = trailer.attached ? `${Math.round(trailer.wear * 100)}%` : "0%";
            elJobIncome.innerText = `${job.income.toLocaleString()} EUR`;
        } else {
            elJobSource.innerText = "배송 없음";
            elJobDest.innerText = "자유 주행";
            elCargoInfo.innerText = "- (0 t)";
            elCargoDamage.innerText = "0%";
            elJobIncome.innerText = "0 EUR";
            routeEngine.routeCache = null;
            routeEngine.etaSmoothedMinutes = 0;
            routeEngine.etaUpdatedAtMs = 0;
            routeEngine.waitPenaltyMinutes = 0;
            routeEngine.waitPenaltyUpdatedAtMs = 0;
            routeEngine.arrivalSinceMs = 0;
            routeEngine.arrivalEventSent = false;
            routeEngine.etaBootstrapSinceMs = 0;
        }

        elFuelConsumption.innerText = `${(truck.fuelAverageConsumption * 100).toFixed(1)} l/100km`;
        updateEffectiveSpeedKmh(truck, navigation, game);

        distKm = Math.round((navigation?.estimatedDistance || 0) / 1000);
        elNavDistance.innerText = `${distKm} km`;
        navGameMin = parseGameMinutes(navigation?.estimatedTime);
        scale = Math.max(1, Number(game.timeScale || 19));

        const cacheStartMs = Date.now();
        await ensureRouteCache(truck, job);
        cacheEnsureMs = Date.now() - cacheStartMs;

        const etaStartMs = Date.now();
        routeEta = estimateRealEtaFromRoute(truck, navigation, game);
        etaCalcMs = Date.now() - etaStartMs;
        routeAgeMs = routeEngine.routeCache
            ? Date.now() - routeEngine.routeCache.createdAt
            : 0;
        if (
            routeEta &&
            routeEta.offRouteKm >= ROUTE_OFFROUTE_RECALC_KM &&
            distKm > 1 &&
            truckSpeedKmh >= ROUTE_OFFROUTE_MIN_SPEED_KMH &&
            routeAgeMs >= ROUTE_OFFROUTE_GRACE_MS
        ) {
            routeLog("offroute_reroute_trigger", {
                offRouteKm: Number(routeEta.offRouteKm.toFixed(3)),
                navKm: distKm,
                speedKmh: Number(truckSpeedKmh.toFixed(1)),
                routeAgeMs,
            });
            etaEvalTripState.rerouteCount += 1;
            etaEvalTripState.maxOffRouteKm = Math.max(
                etaEvalTripState.maxOffRouteKm,
                Number(routeEta.offRouteKm || 0),
            );
            await ensureRouteCache(truck, job, { force: true });
        }

        etaRealMinutes = routeEta?.realMinutes || 0;
        if (!etaRealMinutes && hasJob) {
            const waitedMs = routeEngine.etaBootstrapSinceMs
                ? Date.now() - routeEngine.etaBootstrapSinceMs
                : 0;
            if (waitedMs >= ETA_BOOTSTRAP_WAIT_MS) {
                if (navGameMin > 0) etaRealMinutes = navGameMin / scale;
                if (etaRealMinutes > 0) {
                    navFallbackUsed = true;
                    logEtaMode("nav_fallback", {
                        navGameMin: Number(navGameMin.toFixed(2)),
                        scale: Number(scale.toFixed(2)),
                        etaMin: Number(etaRealMinutes.toFixed(2)),
                        distKm,
                    });
                }
            }
        }

        const arrived = isArrivalState(
            routeEta,
            distKm,
            Math.max(0, Number(truck.speed || 0)),
            hasJob,
        );

        if (arrived) {
            if (!routeEngine.arrivalEventSent) {
                routeEngine.arrivalEventSent = true;
                emitEtaEvalEvent("arrival_detected", {
                    dist_km: safeNumber(distKm, 3),
                    speed_kmh: safeNumber(truckSpeedKmh, 3),
                    rem_km: safeNumber(routeEta?.remainingKm ?? distKm, 3),
                });
            }
            elNavEta.innerText = "도착";
            logEtaMode("arrived", { distKm, speed: Number((truck.speed || 0).toFixed(1)) });
        } else if (etaRealMinutes && distKm > 0) {
            routeEngine.arrivalEventSent = false;
            const etaText = formatEtaText(etaRealMinutes);
            const arrival = new Date(Date.now() + etaRealMinutes * 60000);
            let h = arrival.getHours();
            const ampm = h >= 12 ? "오후" : "오전";
            h = h % 12 || 12;
            const mm = String(arrival.getMinutes()).padStart(2, "0");
            elNavEta.innerText = `${etaText} - ${h}:${mm} ${ampm}`;
            if (routeEta) {
                logEtaMode("route", {
                    etaMin: Number(etaRealMinutes.toFixed(2)),
                    remKm: Number(routeEta.remainingKm.toFixed(2)),
                    offRouteKm: Number(routeEta.offRouteKm.toFixed(3)),
                    speedEma: Number((routeEngine.speedEmaKmh || 0).toFixed(1)),
                    mode: "route_model",
                    routeModelMin: Number((routeEta.routeModelRealMinutes || 0).toFixed(2)),
                    routeModelPureMin: Number((routeEta.routeModelPureMinutes || 0).toFixed(2)),
                    routeModelCalibratedMin: Number(
                        (routeEta.routeModelCalibratedMinutes || 0).toFixed(2),
                    ),
                    speedBasedMin: Number((routeEta.speedBasedRealMinutes || 0).toFixed(2)),
                    speedBasedCappedMin: Number((routeEta.speedBasedCappedMinutes || 0).toFixed(2)),
                    liveWeight: Number((routeEta.liveWeight || 0).toFixed(2)),
                    projectionRate: Number((routeEta.etaProjectionRate || 0).toFixed(2)),
                    waitPenaltyMin: Number((routeEta.waitPenaltyMinutes || 0).toFixed(2)),
                    calibrationBlendWeight: Number((routeEta.calibrationBlendWeight || 0).toFixed(2)),
                });
            } else {
                logEtaMode("nav_fallback", {
                    etaMin: Number(etaRealMinutes.toFixed(2)),
                    distKm,
                    mode: "fallback_display",
                });
            }
        } else if (hasJob) {
            routeEngine.arrivalEventSent = false;
            elNavEta.innerText = "계산 중...";
            logEtaMode("calculating", {
                distKm,
                hasRouteCache: !!routeEngine.routeCache,
                routeInFlight: routeEngine.routeInFlight,
            });
        } else {
            routeEngine.arrivalEventSent = false;
            elNavEta.innerText = "-";
            logEtaMode("idle");
        }

        remainingKmForCandidates = Math.max(0, routeEta?.remainingKm ?? distKm ?? 0);
        etaAStarCalibrated = Math.max(0, routeEta?.calibratedCandidateMinutes || 0);
        etaAStarPure = Math.max(0, routeEta?.pureCandidateMinutes || 0);
        etaDisplayedLegacy = Math.max(0, routeEta?.calibratedCandidateMinutes || 0);
        etaDisplayedHybrid = Math.max(0, routeEta?.hybridCandidateMinutes || 0);
        etaApiBase = navGameMin > 0 ? navGameMin / scale : 0;
        const liveSpeedForApi = Math.max(
            ETA_MIN_EFFECTIVE_SPEED_KMH,
            Number(routeEta?.liveSpeedKmh || routeEngine.speedEmaKmh || truckSpeedKmh || 0),
        );
        const apiSpeedBasedMin =
            remainingKmForCandidates > 0
                ? (remainingKmForCandidates / liveSpeedForApi) * 60
                : etaApiBase;
        nearInterpWeight = getDestinationNearWeight(remainingKmForCandidates);
        etaApiNearInterp =
            etaApiBase > 0
                ? etaApiBase * (1 - nearInterpWeight) + apiSpeedBasedMin * nearInterpWeight
                : 0;

        if (etaEvalTripState.activeTripId && Number.isFinite(truckSpeedKmh)) {
            etaEvalTripState.speedSum += truckSpeedKmh;
            etaEvalTripState.speedSamples += 1;
            if (routeEta?.offRouteKm) {
                etaEvalTripState.maxOffRouteKm = Math.max(
                    etaEvalTripState.maxOffRouteKm,
                    Number(routeEta.offRouteKm),
                );
            }
        }

        routeLogThrottled(
            "benchmark_eta_cycle",
            "benchmark_eta_cycle",
            {
                fetchMs: telemetryFetchMs,
                cacheMs: cacheEnsureMs,
                etaMs: etaCalcMs,
                totalMs: Date.now() - cycleStartMs,
                hasJob,
                hasRoute: !!routeEngine.routeCache,
                etaMode: routeEngine.lastEtaMode || "unknown",
                distKm,
                speedKmh: Number((truck.speed || 0).toFixed(1)),
            },
            BENCHMARK_LOG_INTERVAL_MS,
        );

        emitEtaEvalTick({
            type: "telemetry_tick",
            game_connected: true,
            game_paused: !!game?.paused,
            has_job: hasJob,
            eta_mode: routeEngine.lastEtaMode || "unknown",
            truck_speed_kmh: safeNumber(truckSpeedKmh, 3),
            speed_ema_kmh: safeNumber(routeEngine.speedEmaKmh, 3),
            speed_delta_ema_kmh: safeNumber(routeEngine.speedDeltaEmaKmh, 3),
            nav_distance_km: safeNumber(distKm, 3),
            nav_estimated_time_game_min: safeNumber(navGameMin, 3),
            game_time_scale: safeNumber(scale, 3),
            remaining_km: safeNumber(remainingKmForCandidates, 3),
            offroute_km: safeNumber(routeEta?.offRouteKm, 3),
            segment_index: routeEta?.segmentIndex ?? routeEngine.lastPathIndex ?? null,
            has_route_cache: !!routeEngine.routeCache,
            route_inflight: !!routeEngine.routeInFlight,
            route_age_ms: routeAgeMs,
            route_model_pure_min: safeNumber(routeEta?.routeModelPureMinutes, 3),
            route_model_calibrated_min: safeNumber(routeEta?.routeModelCalibratedMinutes, 3),
            route_model_min: safeNumber(routeEta?.routeModelRealMinutes, 3),
            route_model_hybrid_min: safeNumber(routeEta?.routeModelHybridMinutes, 3),
            speed_based_min: safeNumber(routeEta?.speedBasedRealMinutes, 3),
            speed_based_capped_min: safeNumber(routeEta?.speedBasedCappedMinutes, 3),
            live_weight: safeNumber(routeEta?.liveWeight, 4),
            live_weight_distance: safeNumber(routeEta?.liveDistanceWeight, 4),
            live_weight_speed: safeNumber(routeEta?.liveSpeedReliabilityWeight, 4),
            live_weight_volatility: safeNumber(routeEta?.liveVolatilityWeight, 4),
            eta_projection_rate: safeNumber(routeEta?.etaProjectionRate, 4),
            wait_penalty_min: safeNumber(routeEta?.waitPenaltyMinutes, 4),
            nav_ratio_clamped: safeNumber(routeEta?.navRatioClamped, 4),
            calibration_blend_weight: safeNumber(routeEta?.calibrationBlendWeight, 4),
            eta_a_star_pure_min: safeNumber(etaAStarPure, 3),
            eta_a_star_calibrated_min: safeNumber(etaAStarCalibrated, 3),
            eta_api_base_min: safeNumber(etaApiBase, 3),
            eta_api_near_interp_min: safeNumber(etaApiNearInterp, 3),
            eta_displayed_legacy_min: safeNumber(etaDisplayedLegacy, 3),
            eta_displayed_hybrid_min: safeNumber(etaDisplayedHybrid, 3),
            eta_displayed_min: safeNumber(etaRealMinutes, 3),
            api_near_weight: safeNumber(nearInterpWeight, 4),
            nav_fallback_used: navFallbackUsed,
            fetch_ms: telemetryFetchMs,
            cache_ms: cacheEnsureMs,
            eta_ms: etaCalcMs,
            total_cycle_ms: Date.now() - cycleStartMs,
        });
    } catch (error) {
        console.error("Telemetry error:", error);
        elNavEta.innerText = `오류: ${error.message}`;
        routeLog("telemetry_error", { message: error?.message || String(error) });
        emitEtaEvalEvent(
            "telemetry_error",
            {
                message: error?.message || String(error),
            },
            "error",
        );
        routeLogThrottled(
            "benchmark_eta_cycle_error",
            "benchmark_eta_cycle_error",
            {
                fetchMs: telemetryFetchMs,
                cacheMs: cacheEnsureMs,
                etaMs: etaCalcMs,
                totalMs: Date.now() - cycleStartMs,
                message: error?.message || String(error),
            },
            BENCHMARK_LOG_INTERVAL_MS,
        );
        emitEtaEvalTick({
            type: "telemetry_tick_error",
            game_connected: null,
            has_job: hasJob,
            eta_mode: routeEngine.lastEtaMode || "error",
            truck_speed_kmh: safeNumber(truckSpeedKmh, 3),
            nav_distance_km: safeNumber(distKm, 3),
            nav_estimated_time_game_min: safeNumber(navGameMin, 3),
            game_time_scale: safeNumber(scale, 3),
            remaining_km: safeNumber(remainingKmForCandidates, 3),
            eta_a_star_pure_min: safeNumber(etaAStarPure, 3),
            eta_a_star_calibrated_min: safeNumber(etaAStarCalibrated, 3),
            eta_api_base_min: safeNumber(etaApiBase, 3),
            eta_api_near_interp_min: safeNumber(etaApiNearInterp, 3),
            eta_displayed_legacy_min: safeNumber(etaDisplayedLegacy, 3),
            eta_displayed_hybrid_min: safeNumber(etaDisplayedHybrid, 3),
            eta_displayed_min: safeNumber(etaRealMinutes, 3),
            fetch_ms: telemetryFetchMs,
            cache_ms: cacheEnsureMs,
            eta_ms: etaCalcMs,
            total_cycle_ms: Date.now() - cycleStartMs,
            error_message: error?.message || String(error),
        });
    }
}

initializeRouteEngine().catch((e) => {
    console.error("[RouteEngine] Warmup failed:", e);
});

window.addEventListener("beforeunload", () => {
    finalizeEtaEvalTrip("overlay_closed", Date.now());
});

setInterval(fetchTelemetry, 500);
