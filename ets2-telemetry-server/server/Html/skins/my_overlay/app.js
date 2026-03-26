const TELEMETRY_URL = "/api/ets2/telemetry";

const ROUTE_DATA_BASE = "skins/my_overlay/data/ets2";
const CITY_ZONES_URL = "skins/my_overlay/cities_ets2.json";
const GRAPH_NODES_URL = `${ROUTE_DATA_BASE}/roadnetwork/nodes.json`;
const GRAPH_EDGES_URL = `${ROUTE_DATA_BASE}/roadnetwork/edges.json`;
const GEO_CITIES_URL = `${ROUTE_DATA_BASE}/map-data/cities.geojson`;
const GEO_COMPANIES_URL = `${ROUTE_DATA_BASE}/map-data/companies.geojson`;
const CITY_ALIAS_URL = `${ROUTE_DATA_BASE}/map-data/citiesCheck.json`;

const ROUTE_RECALC_MIN_INTERVAL_MS = 20_000;
const ROUTE_FORCE_RECALC_MS = 180_000;
const ROUTE_DEVIATION_RECALC_COOLDOWN_MS = 8_000;
const ROUTE_OFFROUTE_RECALC_KM = 0.45;

const GAME_SPEED_CITY = 35;
const GAME_SPEED_HIGHWAY = 70;
const ETA_NEAR_BLEND_START_KM = 30;
const ETA_NEAR_BLEND_FULL_KM = 20;
const ETA_MIN_EFFECTIVE_SPEED_KMH = 12;
const SPEED_EMA_ALPHA = 0.18;
const SPEED_SPIKE_MAX_KMH = 180;
const SPEED_DELTA_EMA_ALPHA = 0.2;
const ETA_SMOOTH_ALPHA_BASE = 0.45;
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
    arrivalSinceMs: 0,
};

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

    try {
        const [
            cityZones,
            packedNodes,
            packedEdges,
            citiesGeo,
            companiesGeo,
            cityAliasList,
        ] = await Promise.all([
            fetch(CITY_ZONES_URL).then((r) => r.json()),
            fetch(GRAPH_NODES_URL).then((r) => r.json()),
            fetch(GRAPH_EDGES_URL).then((r) => r.json()),
            fetch(GEO_CITIES_URL).then((r) => r.json()),
            fetch(GEO_COMPANIES_URL).then((r) => r.json()),
            fetch(CITY_ALIAS_URL).then((r) => r.json()),
        ]);

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

        buildGraphRuntime(packedNodes, packedEdges);
        routeEngine.initialized = true;
        return true;
    } catch (error) {
        console.error("[RouteEngine] Initialization failed:", error);
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
    if (rawSpeed <= 0.1) return routeEngine.speedEmaKmh;

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

function getLiveEtaWeight(remainingKm, speedDeltaEmaKmh) {
    let weight = 0.25;
    if (remainingKm <= 120) weight = 0.35;
    if (remainingKm <= 60) weight = 0.5;
    if (remainingKm <= ETA_NEAR_BLEND_START_KM) weight = 0.65;
    if (remainingKm <= ETA_NEAR_BLEND_FULL_KM) weight = 0.85;

    // 속도 변동이 큰 구간에서는 실시간 속도 비중을 조금 줄여 ETA 튐 방지
    if (speedDeltaEmaKmh > 18) weight *= 0.85;
    if (speedDeltaEmaKmh > 30) weight *= 0.75;

    return Math.max(0.15, Math.min(0.9, weight));
}

function smoothEtaMinutes(rawEtaMinutes) {
    const now = Date.now();
    if (routeEngine.etaSmoothedMinutes <= 0 || !routeEngine.etaUpdatedAtMs) {
        routeEngine.etaSmoothedMinutes = rawEtaMinutes;
        routeEngine.etaUpdatedAtMs = now;
        return rawEtaMinutes;
    }

    const elapsedMin = Math.max(0, (now - routeEngine.etaUpdatedAtMs) / 60000);
    const projected = Math.max(0, routeEngine.etaSmoothedMinutes - elapsedMin);
    const smoothed =
        projected * (1 - ETA_SMOOTH_ALPHA_BASE) + rawEtaMinutes * ETA_SMOOTH_ALPHA_BASE;

    routeEngine.etaSmoothedMinutes = smoothed;
    routeEngine.etaUpdatedAtMs = now;
    return smoothed;
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

    const headingDeg =
        typeof truckPlacement.heading === "number"
            ? ((truckPlacement.heading * 180) / Math.PI + 360) % 360
            : null;

    let best = null;
    for (let i = 0; i < startCandidates.length; i++) {
        const candidate = calculateRoute(startCandidates[i], endCandidates, headingDeg);
        if (!candidate) continue;
        if (!best || candidate.path.length < best.path.length) best = candidate;
        if (best && best.path.length < 1500) break;
    }

    if (!best) return null;
    const stats = buildRouteStats(best.path);

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
        routeEngine.routeCache = null;
        routeEngine.etaSmoothedMinutes = 0;
        routeEngine.etaUpdatedAtMs = 0;
        return;
    }

    const key = buildJobKey(job);
    const now = Date.now();
    const hasValid = routeEngine.routeCache && routeEngine.routeCache.key === key;
    const routeExpired =
        !hasValid ||
        now - routeEngine.routeCache.createdAt > ROUTE_FORCE_RECALC_MS;
    if (!routeExpired && !force) return;

    if (routeEngine.routeInFlight) return;
    const minInterval = force
        ? ROUTE_DEVIATION_RECALC_COOLDOWN_MS
        : ROUTE_RECALC_MIN_INTERVAL_MS;
    if (now - routeEngine.lastRouteTryAt < minInterval) return;

    routeEngine.lastRouteTryAt = now;
    routeEngine.routeInFlight = true;
    try {
        const route = await buildRouteForJob(truck, job);
        if (route) {
            routeEngine.routeCache = route;
            routeEngine.lastPathIndex = 0;
            routeEngine.etaSmoothedMinutes = 0;
            routeEngine.etaUpdatedAtMs = 0;
            console.log(
                `[RouteEngine] Route built. nodes=${route.pathNodeIds.length}, game=${route.totalGameMin.toFixed(
                    1,
                )}m, real=${route.totalRealMin.toFixed(1)}m, snap=${(
                    route.destinationSnapDistKm ?? 0
                ).toFixed(2)}km`,
            );
        }
    } catch (error) {
        console.error("[RouteEngine] Route build failed:", error);
    } finally {
        routeEngine.routeInFlight = false;
    }
}

function estimateRealEtaFromRoute(truck, navigation, game) {
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
    let routeModelReal = Math.max(0, cache.totalRealMin - cache.cumulativeRealMin[idx]);

    const navGame = parseGameMinutes(navigation?.estimatedTime);
    if (navGame > 1 && remGame > 1) {
        const ratio = navGame / remGame;
        const clamped = Math.max(0.5, Math.min(1.8, ratio));
        routeModelReal *= clamped;
    }

    const speed = Math.max(
        ETA_MIN_EFFECTIVE_SPEED_KMH,
        updateEffectiveSpeedKmh(truck, navigation, game) || 0,
    );
    const speedBasedRealMin = speed > 0 ? (remKm / speed) * 60 : routeModelReal;
    const liveWeight = getLiveEtaWeight(remKm, routeEngine.speedDeltaEmaKmh);
    let remReal = routeModelReal * (1 - liveWeight) + speedBasedRealMin * liveWeight;
    remReal = Math.max(1, remReal);
    remReal = smoothEtaMinutes(remReal);

    return {
        realMinutes: remReal,
        remainingKm: remKm,
        offRouteKm: progress.distKm,
        segmentIndex: progress.segmentIndex,
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
}

setInterval(updateRealClock, 1000);
updateRealClock();

async function fetchTelemetry() {
    try {
        const response = await fetch(TELEMETRY_URL);
        if (!response.ok) return;
        const data = await response.json();
        const { game, truck, trailer, job, navigation } = data;
        const hasJob = !!job?.destinationCity;

        if (!game.connected) {
            elNavDistance.innerText = "미연결";
            elNavEta.innerText = "-";
            return;
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
            routeEngine.arrivalSinceMs = 0;
        }

        elFuelConsumption.innerText = `${(truck.fuelAverageConsumption * 100).toFixed(1)} l/100km`;
        updateEffectiveSpeedKmh(truck, navigation, game);

        const distKm = Math.round((navigation?.estimatedDistance || 0) / 1000);
        elNavDistance.innerText = `${distKm} km`;

        await ensureRouteCache(truck, job);

        const routeEta = estimateRealEtaFromRoute(truck, navigation, game);
        if (routeEta && routeEta.offRouteKm >= ROUTE_OFFROUTE_RECALC_KM && distKm > 1) {
            await ensureRouteCache(truck, job, { force: true });
        }

        const etaRealMinutes = routeEta?.realMinutes || 0;

        const arrived = isArrivalState(
            routeEta,
            distKm,
            Math.max(0, Number(truck.speed || 0)),
            hasJob,
        );

        if (arrived) {
            elNavEta.innerText = "도착";
        } else if (etaRealMinutes && distKm > 0) {
            const etaText = formatEtaText(etaRealMinutes);
            const arrival = new Date(Date.now() + etaRealMinutes * 60000);
            let h = arrival.getHours();
            const ampm = h >= 12 ? "오후" : "오전";
            h = h % 12 || 12;
            const mm = String(arrival.getMinutes()).padStart(2, "0");
            elNavEta.innerText = `${etaText} - ${h}:${mm} ${ampm}`;
        } else if (hasJob) {
            elNavEta.innerText = "계산 중...";
        } else {
            elNavEta.innerText = "-";
        }
    } catch (error) {
        console.error("Telemetry error:", error);
        elNavEta.innerText = `오류: ${error.message}`;
    }
}

initializeRouteEngine().catch((e) => {
    console.error("[RouteEngine] Warmup failed:", e);
});

setInterval(fetchTelemetry, 500);
