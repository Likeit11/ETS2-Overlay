# ETA Eval Lab

ETA 의사결정 검증용 데이터와 도구를 관리하는 전용 폴더입니다.

## 구조
- `sessions/<session_id>/ticks.jsonl`
- `sessions/<session_id>/events.jsonl`
- `sessions/<session_id>/meta.json`
- `sessions/<session_id>/trip_summary.csv`
- `reports/<session_id>/model_scores.csv`
- `reports/<session_id>/report.md`
- `tools/analyze_eta_session.py`

## 분석 실행
```bash
python eta-eval-lab/tools/analyze_eta_session.py --session-id <session_id>
```

세션 ID를 생략하면 가장 최근 세션을 자동 선택합니다.
