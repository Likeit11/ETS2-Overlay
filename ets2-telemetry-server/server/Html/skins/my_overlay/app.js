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
// 3. 텔레메트리 업데이트 로직 
// ==========================================
const elTruckDamage = document.getElementById('truck-damage'), elTruckGear = document.getElementById('truck-gear'), elTruckFuel = document.getElementById('truck-fuel'), elTruckRange = document.getElementById('truck-range'), elTrailerDamage = document.getElementById('trailer-damage');
const elJobSource = document.getElementById('job-source'), elJobDest = document.getElementById('job-dest'), elCargoInfo = document.getElementById('cargo-info'), elCargoDamage = document.getElementById('cargo-damage'), elJobIncome = document.getElementById('job-income'), elFuelConsumption = document.getElementById('fuel-consumption');
const elNavDistance = document.getElementById('nav-distance');
const elNavEta = document.getElementById('nav-eta');
const elRealClock = document.getElementById('real-clock');

// 이동 평균 속도 계산을 위한 배열 (0.5초마다 업데이트되므로 3분 = 360개)
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

        // 트럭이 정차해있지 않고 게임이 일시정지가 아닐 경우에만 속도 기록 누적
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

        // ETS2의 game.timeScale은 도심/주유소에서 3으로 떨어짐
        // 이 때 남은 전체 시간을 3으로 나누면 현실 도착 예상 시간이 무려 6배 이상 폭증하는 버그가 발생함
        // 따라서 계산용 배율은 최소 15(유럽 19, 영국 15)로 고정하여 안정적인 현실 시간 산출
        let safeScale = game.timeScale || 19;
        if (safeScale < 15) safeScale = 19; 

        if (distKm > 1) {
            // [속도 계산 방식: 하이브리드(Mode 3) 적용]
            // 최근 3분 실시간 평균 속도 반영 (최소 62 보장)
            let avgKmh = 62;
            if (speedHistory.length > 0) {
                const avg = speedHistory.reduce((a, b) => a + b, 0) / speedHistory.length;
                avgKmh = Math.max(62, avg);
            }
            // 평균 속도보다 지금 과속 중이라면 현재 속도를 기준
            let chosenAvgSpeed = Math.max(avgKmh, truck.speed > 0 ? truck.speed : 0);
            
            // 만약 현재 정차(0km/h) 중이라면 무한대가 되지 않게 62km/h 보정
            chosenAvgSpeed = Math.max(62, chosenAvgSpeed);

            const irlMinutes = Math.floor((distKm / chosenAvgSpeed) * 60 / safeScale);
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
