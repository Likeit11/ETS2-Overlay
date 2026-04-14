# 프로젝트 진행 기록

최종 업데이트: 2026-03-27  
현재 브랜치: premium-gps-overlay

## 목표
메인 로직의 타임스케일 급변 노이즈를 줄여 오버레이 ETA를 안정화하고, 프리미엄 브랜치에서 경로 기반 ETA 모델을 강화한다.

## 현재 상태
- 브랜치를 `premium-gps-overlay`로 전환 완료.
- 기존 이슈 확인: 타임스케일이 빠르게 바뀌는 구간(예: 도시 진입/이탈)에서 ETA가 급등할 수 있음.
- 참고 프로젝트: `Rares-Muntean/TruckNav-Sim`.

## 작업 로그
### 2026-03-26
- 로컬 브랜치 확인 후 `main`에서 `premium-gps-overlay`로 전환.
- 장기 추적용 메모리 파일(`Project-Progress.MD`) 생성.
- 참고 프로젝트(`Rares-Muntean/TruckNav-Sim`)를 `.tmp/TruckNav-Sim-ref`에 클론.
- 오버레이 스킨에 ETS2 경로 그래프 데이터 전체 추가:
- `data/ets2/roadnetwork/nodes.json`
- `data/ets2/roadnetwork/edges.json`
- `data/ets2/map-data/cities.geojson`
- `data/ets2/map-data/companies.geojson`
- `data/ets2/map-data/citiesCheck.json`
- `my_overlay/app.js` ETA 코어를 경로 그래프 방식으로 교체:
- ETS2 게임 좌표 <-> 지리 좌표 변환기(LCC 기반)
- 런타임 그래프 로더 및 압축 adjacency 구조
- 시작/도착 후보 탐색용 공간 인덱스 그리드
- 회전/도로 패널티가 포함된 A* 경로 탐색
- 구간별 게임/실시간 분 캐시 + 경로 진행률 추적
- 텔레메트리 루프에서 경로 기반 실시간 ETA를 기본값으로 사용하고, 내비 타이머는 보정값으로만 사용
- 내비게이션 유사 재탐색 동작 추가:
- 현재 경로와의 이탈 거리 기반 off-route 감지
- 이탈이 큰 경우 짧은 쿨다운으로 강제 경로 재계산
- 목적지 근처 ETA 정밀도 로직 추가:
- 30km 이하부터 실시간 속도와 경로 ETA 혼합
- 20km 이하에서 속도 기반 영향 비중 확대
- 도시/저타임스케일 구간의 목적지 근접 ETA 정확도 개선
- 목적지 도로 스냅(destination road snapping) 추가:
- 회사/도시 좌표를 경로 계산 전에 가장 가까운 도로 세그먼트로 투영
- 차고/회사 부근 도착점 ETA 드리프트 감소
- 도착 판정 개선:
- 거리뿐 아니라 저속 상태 + 유지 시간을 함께 체크
- 주행 중 조기 도착(false positive) 감소
- ETA 모델을 현실 내비게이션에 가깝게 개선:
- 속도 경로 계산에서 하드 속도 제한 캡 의존 제거
- 거리 기반 가중으로 전 구간 실속도 영향 반영
- 속도 변동성 가중을 추가해 ETA 튐 완화
- 상단에 ETA 스무딩 추가 적용
- 시작 직후 임시 ETA 팝업 제거:
- 초기 경로 bootstrap 중에는 임시 추정값 대신 `"계산 중..."` 표시

### 2026-03-27
- Electron에 ETA 로그 전용 모니터 창 추가.
- 오버레이 시작 시 로그 창 자동 실행, `Ctrl + Shift + L`로 재오픈 가능.
- 로그 텍스트 선택/복사 가능, 복사/비우기/자동 스크롤 제어 추가.
- 렌더러 RouteDebug 이벤트를 로그 창으로 전달하는 파이프라인 추가.
- 핵심 ETA 이벤트를 한국어 요약 형태로 정리해서 출력.
- 과도하게 반복되는 로그는 노이즈 감소를 위해 스로틀링 적용.
- `my_overlay/app.js`에 ETA 벤치마크 계측 추가:
- 경로 생성 시간(`buildMs`)
- 경로 캐시 재계산 시간(`rebuildMs`)
- ETA 계산 시간(`calcMs`)
- 주기 벤치마크(`benchmark_eta_cycle`: fetch/cache/eta/total ms)
- 에러 주기 벤치마크(`benchmark_eta_cycle_error`)
- ETA 의사결정용 로그 시스템을 최상위 `eta-eval-lab/` 폴더 중심으로 재구성:
- 로그 UI(`eta-log-window.html`, `preload-log.js`) 완전 폐기
- Electron main에서 세션 기반 파일 기록(`sessions/<session_id>`)으로 전환
- `ticks.jsonl`, `events.jsonl`, `meta.json`, `trip_summary.csv` 자동 생성
- `my_overlay/app.js`에서 ETA 후보 4종 병렬 기록 추가:
- `eta_a_star_pure_min`
- `eta_a_star_calibrated_min`
- `eta_api_base_min`
- `eta_api_near_interp_min`
- 표시값(`eta_displayed_min`)과 입력/중간값/성능값을 tick마다 전량 기록
- 분석 스크립트 추가: `eta-eval-lab/tools/analyze_eta_session.py`
- 분석 결과 산출 위치: `eta-eval-lab/reports/<session_id>/model_scores.csv`, `report.md`

## 추가 제안(백로그)
- 현재 보류: 로그 리플레이 벤치마크(기록된 주행에서 예측 ETA와 실제 도착 시간 비교).
- 다음 개선 후보:
- Web Worker 기반 경로 계산(UI/성능 분리)
- 재탐색 사유 분류 고도화(off-route / 목적지 변경 / 데이터 불일치)
- 사용자별 적응형 ETA 보정(온라인 보정)

## 다음 작업
- 인게임 검증 세션 수행 및 비교:
- 게임 내비 ETA vs 오버레이 경로 기반 ETA
- 도시 진입/이탈 전환 구간 동작
- 목적지 스냅 품질(회사 좌표 vs 도시 중심)
- 목적지 스냅 품질이 불안정하면 최종 경로 계산 전 주변 도로 재투영 로직 추가.
- 저사양 환경 프레임 드롭이 있으면 경로 계산을 Worker로 분리 검토.

## 오픈 질문
- 단순 거리/시간 외에, 어떤 텔레메트리 필드가 구간 특성 추론에 안정적으로 쓸 수 있는가?
- 프리미엄 ETA는 즉시 반응성보다 안정성을 얼마나 우선해야 하는가?
