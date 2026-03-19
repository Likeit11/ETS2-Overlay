const TELEMETRY_URL = 'http://localhost:25555/api/ets2/telemetry';

// ==========================================
// 1. 드래그 및 이동 로직 (Drag & Drop Logic)
// ==========================================
function makeDraggable(element) {
    const header = element.querySelector('.widget-header');
    let isDragging = false;
    let offsetX, offsetY;

    // 로컬 스토리지에 저장된 위치값이 있으면 불러와서 적용
    const savedPos = localStorage.getItem(`pos_${element.id}`);
    if (savedPos) {
        const { left, top } = JSON.parse(savedPos);
        element.style.left = left;
        element.style.top = top;
    }

    // 마우스를 눌렀을 때
    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        const rect = element.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        // 클릭 시 해당 위젯을 가장 앞으로 가져옴
        document.querySelectorAll('.widget').forEach(w => w.style.zIndex = '10');
        element.style.zIndex = '100';
    });

    // 화면 위에서 마우스를 뗄 때
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            // 이동한 위치를 브라우저 로컬 스토리지에 저장
            localStorage.setItem(`pos_${element.id}`, JSON.stringify({
                left: element.style.left,
                top: element.style.top
            }));
        }
    });

    // 드래그하여 움직이는 중
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        let newX = e.clientX - offsetX;
        let newY = e.clientY - offsetY;

        // 화면 밖으로 나가지 않도록 바운더리 체크 (화면 경계 - 약간의 여유)
        newX = Math.max(0, Math.min(newX, window.innerWidth - element.offsetWidth));
        newY = Math.max(0, Math.min(newY, window.innerHeight - element.offsetHeight));

        element.style.left = `${newX}px`;
        element.style.top = `${newY}px`;
    });
}

// 초기 위치값 세팅 (저장된 값이 없을 때)
const defaultPositions = {
    'widget-truck': { left: '20px', top: '20px' },
    'widget-job': { left: '20px', top: '160px' },
    'widget-nav': { left: '20px', top: '340px' }
};

document.querySelectorAll('.widget').forEach(widget => {
    // 저장된 위치가 없다면 디폴트 위치 할당
    if (!localStorage.getItem(`pos_${widget.id}`)) {
        widget.style.left = defaultPositions[widget.id].left;
        widget.style.top = defaultPositions[widget.id].top;
    }
    // 드래그 기능 활성화
    makeDraggable(widget);
});


// ==========================================
// 2. 텔레메트리 업데이트 로직 
// ==========================================
const elTruckDamage = document.getElementById('truck-damage');
const elTruckGear = document.getElementById('truck-gear');
const elTruckFuel = document.getElementById('truck-fuel');
const elTruckRange = document.getElementById('truck-range');
const elTrailerDamage = document.getElementById('trailer-damage');

const elJobSource = document.getElementById('job-source');
const elJobDest = document.getElementById('job-dest');
const elCargoInfo = document.getElementById('cargo-info');
const elCargoDamage = document.getElementById('cargo-damage');
const elJobIncome = document.getElementById('job-income');
const elFuelConsumption = document.getElementById('fuel-consumption');

const elNavDistance = document.getElementById('nav-distance');
const elNavEta = document.getElementById('nav-eta');

function formatGear(gear) {
    if (gear > 0) return `D${gear}`;
    if (gear < 0) return `R${Math.abs(gear)}`;
    return 'N';
}

async function fetchTelemetry() {
    try {
        const response = await fetch(TELEMETRY_URL);
        if (!response.ok) return;

        const data = await response.json();
        const { game, truck, trailer, job, navigation } = data;

        if (!game.connected) {
            elNavDistance.innerText = '미연결';
            return;
        }

        // --- 위젯 1 ---
        const maxTruckWear = Math.max(truck.wearEngine, truck.wearTransmission, truck.wearCabin, truck.wearChassis, truck.wearWheels);
        elTruckDamage.innerText = `${Math.round(maxTruckWear * 100)}%`;
        elTruckGear.innerText = formatGear(truck.displayedGear);

        elTruckFuel.innerText = `${Math.round(truck.fuel)} l / ${Math.round(truck.fuelCapacity)} l`;
        const range = truck.fuelAverageConsumption > 0 ? Math.round(truck.fuel / truck.fuelAverageConsumption) : 0;
        elTruckRange.innerText = `${range} km`;
        elTrailerDamage.innerText = trailer.attached ? `${Math.round(trailer.wear * 100)}%` : '0%';

        // --- 위젯 2 ---
        if (job.destinationCity) {
            elJobSource.innerText = `${job.sourceCity}, ${job.sourceCompany}`;
            elJobDest.innerText = `${job.destinationCity}, ${job.destinationCompany}`;
            const cargoName = trailer.name || '알 수 없음';
            const cargoMassTons = trailer.mass ? Math.round(trailer.mass / 1000) : 0;
            elCargoInfo.innerText = `${cargoName} (${cargoMassTons} t)`;
            elCargoDamage.innerText = trailer.attached ? `${Math.round(trailer.wear * 100)}%` : '0%';
            elJobIncome.innerText = `${job.income.toLocaleString()} EUR`;
        } else {
            elJobSource.innerText = '배송물 없음';
            elJobDest.innerText = '자유 주행';
            elCargoInfo.innerText = '- (0 t)';
            elCargoDamage.innerText = '0%';
            elJobIncome.innerText = '0 EUR';
        }

        elFuelConsumption.innerText = `${(truck.fuelAverageConsumption * 100).toFixed(1)} l/100km`;

        // --- 위젯 3 ---
        const distKm = Math.round(navigation.estimatedDistance / 1000);
        elNavDistance.innerText = `${distKm} km`;

        const etaDate = new Date(navigation.estimatedTime);
        const gameHoursLeft = etaDate.getUTCHours();
        const gameMinsLeft = etaDate.getUTCMinutes();
        const totalGameMins = (gameHoursLeft * 60) + gameMinsLeft;

        if (totalGameMins > 0) {
            const irlMinutes = Math.floor(totalGameMins / 19);
            const arrivalDate = new Date(Date.now() + irlMinutes * 60000);

            let irlHours = arrivalDate.getHours();
            const irlMins = arrivalDate.getMinutes();
            const ampm = irlHours >= 12 ? '오후' : '오전';
            irlHours = irlHours % 12 || 12;
            const formattedTime = `${irlHours}:${irlMins.toString().padStart(2, '0')}`;

            elNavEta.innerText = `${irlMinutes}분 - ${formattedTime} ${ampm}`;
        } else {
            elNavEta.innerText = `도착 지점 근처`;
        }

    } catch (e) {
        console.error("Telemetry fetch error: ", e);
        elNavEta.innerText = "연결 실패: " + e.message;
    }
}

// 500ms 간격으로 통신
setInterval(fetchTelemetry, 500);
