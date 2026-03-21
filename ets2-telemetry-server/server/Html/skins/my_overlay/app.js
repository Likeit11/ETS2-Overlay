const TELEMETRY_URL = '/api/ets2/telemetry';

// ==========================================
// 1. 드래그 및 이동 로직 (Drag & Drop Logic)
// ==========================================
function makeDraggable(element) {
    const header = element.querySelector('.widget-header');
    let isDragging = false;
    let offsetX, offsetY;
    const savedPos = localStorage.getItem(`pos_${element.id}`);
    if (savedPos) {
        const { left, top } = JSON.parse(savedPos);
        element.style.left = left;
        element.style.top = top;
    }
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
    if (!localStorage.getItem(`pos_${widget.id}`)) { widget.style.left = defaultPositions[widget.id].left; widget.style.top = defaultPositions[widget.id].top; }
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
    document.getElementById('settings-modal').style.display = 'none';
}

document.getElementById('btn-cancel').onclick = () => { document.getElementById('settings-modal').style.display = 'none'; }

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
const elNavDistance = document.getElementById('nav-distance'), elNavEta = document.getElementById('nav-eta');

function formatGear(gear) { if (gear > 0) return `D${gear}`; if (gear < 0) return `R${Math.abs(gear)}`; return 'N'; }

async function fetchTelemetry() {
    try {
        const response = await fetch(TELEMETRY_URL);
        if (!response.ok) return;
        const data = await response.json();
        const { game, truck, trailer, job, navigation } = data;

        if (!game.connected) { elNavDistance.innerText = '미연결'; return; }

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

        const estTime = new Date(navigation.estimatedTime);
        const estDays = Math.max(0, estTime.getUTCDate() - 1);
        const totalGameMins = (estDays * 24 * 60) + (estTime.getUTCHours() * 60) + estTime.getUTCMinutes();
        const timeScale = game.timeScale || 19;

        if (totalGameMins > 0) {
            const irlMinutes = Math.floor(totalGameMins / timeScale);
            const arrivalDate = new Date(Date.now() + irlMinutes * 60000);
            let irlHours = arrivalDate.getHours();
            const ampm = irlHours >= 12 ? '오후' : '오전';
            irlHours = irlHours % 12 || 12;
            const h = Math.floor(irlMinutes / 60);
            const m = irlMinutes % 60;
            const timeStr = h > 0 ? `${h}시간 ${m}분` : `${m}분`;
            elNavEta.innerText = `${timeStr} - ${irlHours}:${arrivalDate.getMinutes().toString().padStart(2, '0')} ${ampm}`;
        } else { elNavEta.innerText = `도착 지점 근처`; }

    } catch (e) {
        console.error("Telemetry error: ", e);
        elNavEta.innerText = "연결 오류: " + e.message;
    }
}
setInterval(fetchTelemetry, 500);
