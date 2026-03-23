const TELEMETRY_URL = '/api/ets2/telemetry';

// ==========================================
// 1. 드래그 및 이동 로직 (Drag & Drop Logic)
// ==========================================
function makeDraggable(element) {
    const header = element.querySelector('.widget-header');
    let isDragging = false;
    let offsetX, offsetY;
    
    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        const rect = element.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        document.querySelectorAll('.widget').forEach(w => w.style.zIndex = '10');
        element.style.zIndex = '100'; 
    });
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            localStorage.setItem(`pos_${element.id}`, JSON.stringify({ left: element.style.left, top: element.style.top }));
        }
    });
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        let newX = Math.max(0, Math.min(e.clientX - offsetX, window.innerWidth - element.offsetWidth));
        let newY = Math.max(0, Math.min(e.clientY - offsetY, window.innerHeight - element.offsetHeight));
        element.style.left = `${newX}px`;
        element.style.top = `${newY}px`;
    });
}

const defaultPositions = { 'widget-truck': { left: '20px', top: '20px' }, 'widget-job': { left: '20px', top: '160px' }, 'widget-nav': { left: '20px', top: '340px' } };
document.querySelectorAll('.widget').forEach(widget => {
    let savedPos = localStorage.getItem(`pos_${widget.id}`);
    let applied = false;
    
    if (savedPos) {
        try {
            const { left, top } = JSON.parse(savedPos);
            let x = parseInt(left, 10);
            let y = parseInt(top, 10);
            // 윈도우 크기를 벗어났거나 숫자가 아니면 초기화
            if (!isNaN(x) && !isNaN(y) && x >= 0 && x <= (window.innerWidth || 1920) && y >= 0 && y <= (window.innerHeight || 1080)) {
                widget.style.left = left;
                widget.style.top = top;
                applied = true;
            }
        } catch(e) {}
    }
    
    if (!applied) {
        widget.style.left = defaultPositions[widget.id].left; 
        widget.style.top = defaultPositions[widget.id].top; 
        localStorage.removeItem(`pos_${widget.id}`); // 잘못된 값 삭제
    }
    
    makeDraggable(widget);
});

// ==========================================
// 2. 키맵핑 설정창 연동 (Electron IPC)
// ==========================================
window.openSettingsModal = async function() {
    if(window.electronAPI) {
        const config = await window.electronAPI.getShortcuts();
        document.getElementById('key-mode').value = config.toggleMode;
        document.getElementById('key-toggle').value = config.toggleOverlay;
        document.getElementById('key-settings').value = config.openSettings;
        document.getElementById('opt-opacity').value = config.opacity;
        document.getElementById('opt-truck').checked = config.showTruck;
        document.getElementById('opt-job').checked = config.showJob;
        document.getElementById('opt-nav').checked = config.showNav;
    }
    document.getElementById('settings-modal').style.display = 'flex';
}

window.closeSettingsModal = function() {
    document.getElementById('settings-modal').style.display = 'none';
    if(window.electronAPI) window.electronAPI.setLocked(true);
}

// 자동 키 입력 등록을 위한 로직
document.querySelectorAll('.setting-item input[type="text"]').forEach(input => {
    input.addEventListener('focus', () => {
        if(window.electronAPI) window.electronAPI.suspendShortcuts();
        input.dataset.oldVal = input.value; // 기존 값 백업
        input.value = "";
        input.placeholder = "새 키를 입력... (취소는 ESC)";
    });
    input.addEventListener('blur', () => {
        // 포커스 해제 시 값이 비어있다면 취소된 것으로 간주하고 복구
        if(input.value.trim() === "") {
            input.value = input.dataset.oldVal || "";
        }
        if(window.electronAPI) window.electronAPI.resumeShortcuts();
    });
    input.addEventListener('keydown', (e) => {
        e.preventDefault();
        let key = e.key;
        if(key.length === 1 && key >= 'a' && key <= 'z') key = key.toUpperCase();
        if(key === ' ') key = 'Space';
        
        if(key === 'Escape') { 
            input.value = input.dataset.oldVal; // 초기화(원래 값 복원)
            input.blur(); 
            return; 
        }
        
        input.value = key;
        input.blur();
    });
});

document.getElementById('btn-save').onclick = () => {
    if(window.electronAPI) {
        const config = {
            toggleMode: document.getElementById('key-mode').value || 'Insert',
            toggleOverlay: document.getElementById('key-toggle').value || 'PageDown',
            openSettings: document.getElementById('key-settings').value || 'PageUp',
            opacity: parseInt(document.getElementById('opt-opacity').value),
            showTruck: document.getElementById('opt-truck').checked,
            showJob: document.getElementById('opt-job').checked,
            showNav: document.getElementById('opt-nav').checked
        };
        window.electronAPI.updateShortcuts(config);
        applyVisualConfig(config);
    }
    window.closeSettingsModal();
}

document.getElementById('btn-cancel').onclick = () => { window.closeSettingsModal(); }

document.getElementById('btn-quit').onclick = () => {
    if(window.electronAPI) {
        window.electronAPI.closeOverlay();
    }
}

function applyVisualConfig(config) {
    document.querySelectorAll('.widget').forEach(w => { w.style.backgroundColor = `rgba(22, 22, 25, ${config.opacity / 100})`; });
    document.getElementById('widget-truck').style.display = config.showTruck ? 'flex' : 'none';
    document.getElementById('widget-job').style.display = config.showJob ? 'flex' : 'none';
    document.getElementById('widget-nav').style.display = config.showNav ? 'flex' : 'none';
}
if (window.electronAPI) { window.electronAPI.getShortcuts().then(applyVisualConfig); }

// ==========================================
// 3. 프리미엄 ETA 엔진 (도시 근접도 기반)
// ==========================================
const elTruckDamage = document.getElementById('truck-damage'), elTruckGear = document.getElementById('truck-gear'), elTruckFuel = document.getElementById('truck-fuel'), elTruckRange = document.getElementById('truck-range'), elTrailerDamage = document.getElementById('trailer-damage');
const elJobSource = document.getElementById('job-source'), elJobDest = document.getElementById('job-dest'), elCargoInfo = document.getElementById('cargo-info'), elCargoDamage = document.getElementById('cargo-damage'), elJobIncome = document.getElementById('job-income'), elFuelConsumption = document.getElementById('fuel-consumption');
const elNavDistance = document.getElementById('nav-distance');
const elNavEta = document.getElementById('nav-eta');
const elRealClock = document.getElementById('real-clock');

// --- 도시 데이터 (372개 도시 좌표 + 반경) ---
let cityNodes = null; // [{x, z, radius}, ...]
fetch('skins/my_overlay/cities_ets2.json')
    .then(r => r.json())
    .then(data => { cityNodes = data; console.log(`[Premium ETA] ${data.length}개 도시 데이터 로드 완료`); })
    .catch(e => console.warn('[Premium ETA] 도시 데이터 로드 실패:', e));

// --- TruckNav-Sim 포팅: 도시 반경 내부인지 판정 ---
// (algorithm.ts의 getScaleMultiplier와 동일한 로직)
function getTimeScale(gameX, gameZ) {
    if (!cityNodes) return 19;
    for (let i = 0; i < cityNodes.length; i++) {
        const city = cityNodes[i];
        const dx = gameX - city.x;
        const dz = gameZ - city.z;
        if (dx * dx + dz * dz < city.radius * city.radius) {
            return 3; // 도심
        }
    }
    return 19; // 고속도로/교외
}

// --- 게임 시간 파싱: "0001-01-01T03:01:40Z" → 분 단위 ---
function parseGameMinutes(timeStr) {
    if (!timeStr) return 0;
    const d = new Date(timeStr);
    const base = new Date('0001-01-01T00:00:00Z');
    return (d.getTime() - base.getTime()) / 60000;
}

// --- 타이머 소진율 추적 (슬라이딩 윈도우) ---
const timerHistory = []; // {realMs, gameMin}
const TIMER_HISTORY_MAX = 120; // 60초 (0.5초×120)
let lastKnownRate = 19; // 초기값: 고속도로

function updateTimerHistory(gameMinRemaining) {
    const now = Date.now();
    timerHistory.push({ realMs: now, gameMin: gameMinRemaining });
    if (timerHistory.length > TIMER_HISTORY_MAX) timerHistory.shift();
}

function getCountdownRate() {
    if (timerHistory.length < 4) return lastKnownRate;
    
    // 최근 30초(60 samples)와 비교
    const lookback = Math.min(timerHistory.length, 60);
    const oldest = timerHistory[timerHistory.length - lookback];
    const newest = timerHistory[timerHistory.length - 1];
    
    const realMinElapsed = (newest.realMs - oldest.realMs) / 60000;
    const gameMinConsumed = oldest.gameMin - newest.gameMin;
    
    // 게임이 일시정지되었거나 정차 중이면 소진이 없음
    if (realMinElapsed < 0.05 || gameMinConsumed <= 0) return lastKnownRate;
    
    const rate = gameMinConsumed / realMinElapsed;
    
    // 합리적 범위 내에서만 갱신 (3~25)
    if (rate >= 2 && rate <= 25) {
        lastKnownRate = rate;
    }
    return lastKnownRate;
}

// --- 이동 평균 속도 (보조 보정용) ---
const speedHistory = [];
const HISTORY_MAX_LEN = 360;

function updateRealClock() {
    if (!elRealClock) return;
    const now = new Date();
    let h = now.getHours();
    const ampm = h >= 12 ? '오후' : '오전';
    h = h % 12 || 12;
    const m = now.getMinutes().toString().padStart(2, '0');
    elRealClock.innerText = `${ampm} ${h}:${m}`;
}
setInterval(updateRealClock, 1000);
updateRealClock();

function formatGear(gear) { if (gear > 0) return `D${gear}`; if (gear < 0) return `R${Math.abs(gear)}`; return 'N'; }

async function fetchTelemetry() {
    try {
        const response = await fetch(TELEMETRY_URL);
        if (!response.ok) return;
        const data = await response.json();
        const { game, truck, trailer, job, navigation } = data;

        if (!game.connected) { elNavDistance.innerText = '미연결'; return; }

        // 속도 기록 누적 (보조 보정용)
        if (!game.paused && truck.speed > 0) {
            speedHistory.push(truck.speed);
            if (speedHistory.length > HISTORY_MAX_LEN) speedHistory.shift();
        }

        const maxTruckWear = Math.max(truck.wearEngine, truck.wearTransmission, truck.wearCabin, truck.wearChassis, truck.wearWheels);
        elTruckDamage.innerText = `${Math.round(maxTruckWear * 100)}%`;
        elTruckGear.innerText = formatGear(truck.displayedGear);

        elTruckFuel.innerText = `${Math.round(truck.fuel)} l / ${Math.round(truck.fuelCapacity)} l`;
        const range = truck.fuelAverageConsumption > 0 ? Math.round(truck.fuel / truck.fuelAverageConsumption) : 0;
        elTruckRange.innerText = `${range} km`;
        elTrailerDamage.innerText = trailer.attached ? `${Math.round(trailer.wear * 100)}%` : '0%';

        if (job.destinationCity) {
            elJobSource.innerText = `${job.sourceCity}, ${job.sourceCompany}`;
            elJobDest.innerText = `${job.destinationCity}, ${job.destinationCompany}`;
            elCargoInfo.innerText = `${trailer.name || '알 수 없음'} (${trailer.mass ? Math.round(trailer.mass / 1000) : 0} t)`;
            elCargoDamage.innerText = trailer.attached ? `${Math.round(trailer.wear * 100)}%` : '0%';
            elJobIncome.innerText = `${job.income.toLocaleString()} EUR`;
        } else {
            elJobSource.innerText = '배송물 없음'; elJobDest.innerText = '자유 주행';
            elCargoInfo.innerText = '- (0 t)'; elCargoDamage.innerText = '0%'; elJobIncome.innerText = '0 EUR';
        }

        elFuelConsumption.innerText = `${(truck.fuelAverageConsumption * 100).toFixed(1)} l/100km`;

        const distKm = Math.round(navigation.estimatedDistance / 1000);
        elNavDistance.innerText = `${distKm} km`;

        // ============================================
        // [프리미엄 ETA 산출]
        // 방법 1: 타이머 소진율 (navigation.estimatedTime 변화 추적)
        // 방법 2: 도시 근접도 기반 timeScale + 속도 결합 (폴백)
        // ============================================
        if (distKm > 1) {
            let irlMinutes = 0;

            // === 방법 1: 게임 네비 타이머 소진율 기반 ===
            const gameMinRemaining = parseGameMinutes(navigation.estimatedTime);
            if (gameMinRemaining > 0) {
                updateTimerHistory(gameMinRemaining);
            }

            const countdownRate = getCountdownRate();

            if (gameMinRemaining > 0 && countdownRate > 0) {
                // 기본 계산: 남은 게임 분 / 소진율 = 현실 분
                irlMinutes = gameMinRemaining / countdownRate;

                // === 도시 근접도 보정 ===
                // 현재 위치의 실제 timeScale을 판정하여 소진율 보정
                const truckX = truck.placement ? truck.placement.x : 0;
                const truckZ = truck.placement ? truck.placement.z : 0;
                const currentTrueScale = getTimeScale(truckX, truckZ);

                // 만약 소진율이 고속도로(~19) 기준인데 현재 도심(3)이면,
                // 남은 구간에서 도심 시간이 더 필요 → ETA 상향 보정
                if (currentTrueScale === 3 && countdownRate > 10) {
                    // 도심인데 소진율이 아직 고속 기준 → 보정 계수 적용
                    // 남은 거리가 짧을수록(도심 비중 높을수록) 보정 강화
                    const cityWeight = Math.min(1, 30 / Math.max(distKm, 1));
                    const correctedRate = countdownRate * (1 - cityWeight) + 3 * cityWeight;
                    irlMinutes = gameMinRemaining / correctedRate;
                }
                
                // 반대: 현재 고속인데 소진율이 도심 기준이면 → ETA 하향 보정
                if (currentTrueScale === 19 && countdownRate < 8) {
                    const hwWeight = Math.min(1, 30 / Math.max(distKm, 1));
                    const correctedRate = countdownRate * (1 - hwWeight) + 19 * hwWeight;
                    irlMinutes = gameMinRemaining / correctedRate;
                }
            }

            // === 방법 2 폴백: 소진율 데이터 부족 시 도시 근접도만으로 계산 ===
            if (irlMinutes <= 0) {
                const truckX = truck.placement ? truck.placement.x : 0;
                const truckZ = truck.placement ? truck.placement.z : 0;
                const scale = getTimeScale(truckX, truckZ);
                
                // 게임 속도 추정: 도심 35km/h, 고속 70km/h
                const estimatedGameSpeed = (scale === 3) ? 35 : 70;
                irlMinutes = Math.floor((distKm / estimatedGameSpeed) * 60 / scale);
            }

            // 최소 1분 보장 (0분 표시 방지)
            irlMinutes = Math.max(1, Math.round(irlMinutes));

            const arrivalDate = new Date(Date.now() + irlMinutes * 60000);
            let irlHours = arrivalDate.getHours();
            const ampm = irlHours >= 12 ? '오후' : '오전';
            irlHours = irlHours % 12 || 12;
            const h = Math.floor(irlMinutes / 60);
            const m = irlMinutes % 60;
            const timeStr = h > 0 ? `${h}시간 ${m}분` : `${m}분`;
            
            elNavEta.innerText = `${timeStr} - ${irlHours}:${arrivalDate.getMinutes().toString().padStart(2, '0')} ${ampm}`;
        } else { 
            elNavEta.innerText = `도착 지점 근처`; 
        }

    } catch (e) {
        console.error("Telemetry error: ", e);
        elNavEta.innerText = "연결 오류: " + e.message;
    }
}
setInterval(fetchTelemetry, 500);
