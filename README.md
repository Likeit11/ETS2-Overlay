# ETS2-Overlay 🚛

**Euro Truck Simulator 2** 게임 위에 실시간 텔레메트리 정보를 투명하게 띄워주는 인게임 오버레이입니다.  
Electron 기반의 투명 윈도우로 게임 화면 위에 항상 최상단으로 표시되며, 마우스 클릭이 게임으로 그대로 투과됩니다.

<div align="center">

![ETS2-Overlay Preview](https://img.shields.io/badge/ETS2-In--Game_Overlay-blue?style=for-the-badge&logo=steam&logoColor=white)
![License](https://img.shields.io/badge/License-GPL--3.0-green?style=for-the-badge)
![Electron](https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=electron&logoColor=white)

</div>

## ✨ 주요 기능

- **🔒 클릭 투과 모드** — 오버레이가 게임 조작을 방해하지 않음
- **🖱️ 편집 모드** — 위젯을 자유롭게 드래그하여 위치 조정 가능
- **📊 실시간 텔레메트리** — 트럭 상태, 배송 정보, 네비게이션을 한눈에
- **⌨️ 단축키 지원** — Insert, PageDown, PageUp 키로 모드 전환
- **🎮 스팀 실행 옵션 연동** — 게임 실행 시 오버레이 자동 시작
- **🔁 중복 실행 방지** — 오버레이가 여러 번 켜지는 것을 방지

## 📋 표시 정보

| 위젯 | 표시 항목 |
|------|----------|
| **트럭 & 트레일러** | 트럭 손상도, 현재 기어, 연료량, 주행 가능 거리, 트레일러 손상도 |
| **배송 정보** | 출발지 → 목적지, 화물명 및 중량, 화물 손상도, 수입, 연비 |
| **네비게이션** | 남은 거리, 도착 예정 시간 (실제 시간 기준 변환) |

## 🚀 설치 방법

### 1. 사전 요구사항
- [Node.js](https://nodejs.org/) (LTS 버전 권장)
- Euro Truck Simulator 2 또는 American Truck Simulator

### 2. 클론 & 설치

```bash
git clone https://github.com/DoubleBeyanco/ETS2-Overlay.git
cd ETS2-Overlay
npm install
```

### 3. 텔레메트리 서버 설정 (최초 1회)

1. `ets2-telemetry-server/server/Ets2Telemetry.exe`를 **관리자 권한**으로 실행합니다.
2. **Install** 버튼을 클릭하여 텔레메트리 플러그인 DLL을 게임 디렉토리에 설치합니다.
3. 설치가 완료되면 서버를 닫아도 됩니다. (이후에는 배치 파일이 자동 실행합니다.)

> [!IMPORTANT]
> 텔레메트리 서버의 최초 설치는 반드시 **관리자 권한**으로 실행해야 합니다. 이후 실행부터는 일반 권한으로도 동작합니다.

### 4. 실행

`오버레이실행.bat` 파일을 더블클릭하면:
1. 텔레메트리 서버가 자동 시작됩니다 (이미 실행 중이면 건너뜀)
2. 투명 오버레이가 게임 화면 위에 표시됩니다

## 🎮 스팀 실행 옵션으로 자동 시작하기

게임 실행 시 오버레이를 자동으로 함께 시작할 수 있습니다.

1. 스팀 라이브러리 → **Euro Truck Simulator 2** 우클릭 → **속성**
2. **일반** 탭 → **실행 옵션**에 아래 내용을 입력:

```
"C:\YOUR_PATH\ETS2-Overlay\오버레이실행.bat" %command%
```

> [!NOTE]
> `C:\YOUR_PATH\`를 실제 설치 경로로 변경하세요.

## ⌨️ 단축키

| 키 | 기능 |
|----|------|
| `Insert` | 🔒 클릭 투과 ↔ 🔓 편집 모드 전환 |
| `PageDown` | 오버레이 숨기기 / 보이기 |
| `PageUp` | 설정 창 열기 (편집 모드로 자동 전환) |

> [!TIP]
> 단축키는 오버레이 설정 창에서 원하는 키로 변경할 수 있습니다.

## 🏗️ 프로젝트 구조

```
ETS2-Overlay/
├── overlay-main.js          # Electron 메인 프로세스 (투명 윈도우 생성)
├── preload.js               # Electron preload 스크립트
├── index.html               # 오버레이 UI 레이아웃
├── app.js                   # 텔레메트리 데이터 연동 및 위젯 로직
├── style.css                # 글래스모피즘 스타일
├── package.json             # 프로젝트 설정 및 의존성
├── 오버레이실행.bat            # 원클릭 실행 배치 파일
└── ets2-telemetry-server/   # Funbit 텔레메트리 서버 (GPL-3.0)
    └── server/
        └── Html/skins/my_overlay/  # 커스텀 대시보드 스킨
```

## ⚙️ 설정

`config.json` 파일은 최초 실행 시 자동 생성되며, 단축키와 위젯 표시 설정을 저장합니다:

```json
{
  "toggleMode": "Insert",
  "toggleOverlay": "PageDown",
  "openSettings": "PageUp",
  "opacity": 75,
  "showTruck": true,
  "showJob": true,
  "showNav": true
}
```

## 📜 라이선스

이 프로젝트는 [GNU General Public License v3.0](LICENSE)을 따릅니다.

## 🙏 크레딧 & 감사 표기

### [@Funbit](https://github.com/Funbit) — ets2-telemetry-server
이 프로젝트는 Funbit의 [ets2-telemetry-server](https://github.com/Funbit/ets2-telemetry-server) (GPL-3.0)를 번들하여 사용합니다.  
게임과 브라우저 간의 텔레메트리 데이터 통신을 가능하게 해주는 핵심 서버입니다.

### [@Haz_Du](https://github.com/HazDu) — ETS2-TC
ETS2 인게임 시간 ↔ 실제 시간 변환 로직은 [ETS2-TC](https://github.com/HazDu/ETS2-TC) (MIT License) 프로젝트에서 영감을 받았습니다.

---

*Drive safe, and happy trucking!* 🚛💨
