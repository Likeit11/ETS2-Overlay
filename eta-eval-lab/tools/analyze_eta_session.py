#!/usr/bin/env python3
import argparse
import math
from pathlib import Path
from typing import Optional

import pandas as pd


def parse_args():
    parser = argparse.ArgumentParser(description="Analyze ETA evaluation session logs.")
    parser.add_argument("--session-id", help="Target session id under eta-eval-lab/sessions")
    parser.add_argument("--session-dir", help="Full path to a session directory")
    parser.add_argument(
        "--root",
        default=str(Path(__file__).resolve().parents[1]),
        help="eta-eval-lab root directory",
    )
    return parser.parse_args()


def pick_session_dir(root: Path, session_id: Optional[str], session_dir: Optional[str]) -> Path:
    sessions_root = root / "sessions"
    if session_dir:
        target = Path(session_dir)
        if not target.exists():
            raise FileNotFoundError(f"session-dir not found: {target}")
        return target
    if session_id:
        target = sessions_root / session_id
        if not target.exists():
            raise FileNotFoundError(f"session-id not found: {target}")
        return target
    if not sessions_root.exists():
        raise FileNotFoundError(f"sessions root not found: {sessions_root}")
    candidates = [p for p in sessions_root.iterdir() if p.is_dir()]
    if not candidates:
        raise FileNotFoundError("no session directories found")
    candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return candidates[0]


def read_jsonl(path: Path) -> pd.DataFrame:
    if not path.exists() or path.stat().st_size == 0:
        return pd.DataFrame()
    return pd.read_json(path, lines=True)


def read_trip_summary(path: Path) -> pd.DataFrame:
    if not path.exists() or path.stat().st_size == 0:
        return pd.DataFrame()
    return pd.read_csv(path)


def list_session_dirs(root: Path) -> list[Path]:
    sessions_root = root / "sessions"
    if not sessions_root.exists():
        return []
    return sorted([p for p in sessions_root.iterdir() if p.is_dir()])


def find_related_session_dirs(root: Path, seed_session_dir: Path) -> list[Path]:
    related = {seed_session_dir.resolve()}
    seed_trip_summary = read_trip_summary(seed_session_dir / "trip_summary.csv")
    if seed_trip_summary.empty or "journey_id" not in seed_trip_summary.columns:
        return sorted(related)

    journey_ids = {
        str(value).strip()
        for value in seed_trip_summary["journey_id"].dropna().tolist()
        if str(value).strip()
    }
    if not journey_ids:
        return sorted(related)

    for session_dir in list_session_dirs(root):
        trip_summary = read_trip_summary(session_dir / "trip_summary.csv")
        if trip_summary.empty or "journey_id" not in trip_summary.columns:
            continue
        session_journey_ids = {
            str(value).strip()
            for value in trip_summary["journey_id"].dropna().tolist()
            if str(value).strip()
        }
        if journey_ids & session_journey_ids:
            related.add(session_dir.resolve())
    return sorted(related)


def load_combined_session_data(session_dirs: list[Path]) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    ticks_parts = []
    events_parts = []
    trip_parts = []
    for session_dir in session_dirs:
        ticks = read_jsonl(session_dir / "ticks.jsonl")
        events = read_jsonl(session_dir / "events.jsonl")
        trip_summary = read_trip_summary(session_dir / "trip_summary.csv")

        if not ticks.empty:
            ticks = ticks.copy()
            ticks["source_session_id"] = session_dir.name
            ticks_parts.append(ticks)
        if not events.empty:
            events = events.copy()
            events["source_session_id"] = session_dir.name
            events_parts.append(events)
        if not trip_summary.empty:
            trip_summary = trip_summary.copy()
            trip_summary["source_session_id"] = session_dir.name
            trip_parts.append(trip_summary)

    ticks = pd.concat(ticks_parts, ignore_index=True) if ticks_parts else pd.DataFrame()
    events = pd.concat(events_parts, ignore_index=True) if events_parts else pd.DataFrame()
    trip_summary = pd.concat(trip_parts, ignore_index=True) if trip_parts else pd.DataFrame()
    return ticks, events, trip_summary


def build_trip_end_map(trip_summary: pd.DataFrame, events: pd.DataFrame) -> dict[str, float]:
    out: dict[str, float] = {}
    terminal_end_reasons = {"job_cleared", "job_changed"}

    if (
        not trip_summary.empty
        and "journey_id" in trip_summary.columns
        and "trip_id" in trip_summary.columns
        and "end_ts_ms" in trip_summary.columns
    ):
        temp = trip_summary.copy()
        temp["journey_id"] = temp["journey_id"].fillna("").astype(str).str.strip()
        temp["trip_id"] = temp["trip_id"].fillna("").astype(str).str.strip()
        temp["analysis_id"] = temp["journey_id"].where(temp["journey_id"] != "", temp["trip_id"])
        temp["end_ts_ms"] = pd.to_numeric(temp["end_ts_ms"], errors="coerce")
        temp = temp[temp["analysis_id"] != ""].sort_values("end_ts_ms")

        for analysis_id, group in temp.groupby("analysis_id"):
            latest = group.iloc[-1]
            end_reason = str(latest.get("end_reason", "")).strip()
            end_ts = latest.get("end_ts_ms")
            if pd.notna(end_ts) and end_reason in terminal_end_reasons:
                out[str(analysis_id)] = float(end_ts)

    if not trip_summary.empty and "trip_id" in trip_summary.columns and "end_ts_ms" in trip_summary.columns:
        for _, row in trip_summary.iterrows():
            trip_id = str(row.get("trip_id", "")).strip()
            end_ts = row.get("end_ts_ms")
            if trip_id and pd.notna(end_ts) and trip_id not in out:
                out[trip_id] = float(end_ts)

    if not events.empty and {"event_name", "trip_id", "ts_ms"}.issubset(events.columns):
        subset = events[events["event_name"] == "trip_end"]
        for _, row in subset.iterrows():
            trip_id = str(row.get("trip_id", "")).strip()
            ts_ms = row.get("ts_ms")
            if trip_id and pd.notna(ts_ms):
                out[trip_id] = float(ts_ms)
    return out


def add_actual_remaining_minutes(ticks: pd.DataFrame, trip_end_map: dict[str, float]) -> pd.DataFrame:
    if ticks.empty:
        ticks["actual_remaining_min"] = []
        return ticks

    ticks = ticks.copy()
    ticks["journey_id"] = ticks.get("journey_id", "").fillna("").astype(str)
    ticks["trip_id"] = ticks.get("trip_id", "").fillna("").astype(str)
    ticks["analysis_id"] = ticks["journey_id"].where(ticks["journey_id"] != "", ticks["trip_id"])
    ticks["ts_ms"] = pd.to_numeric(ticks.get("ts_ms"), errors="coerce")
    ticks["actual_remaining_min"] = pd.NA

    for analysis_id, end_ts in trip_end_map.items():
        mask = (ticks["analysis_id"] == analysis_id) & ticks["ts_ms"].notna()
        if not mask.any():
            continue
        rem = (end_ts - ticks.loc[mask, "ts_ms"]) / 60000.0
        ticks.loc[mask, "actual_remaining_min"] = rem

    ticks["actual_remaining_min"] = pd.to_numeric(ticks["actual_remaining_min"], errors="coerce")
    return ticks


def compute_jitter(series: pd.Series) -> tuple[float, float]:
    clean = pd.to_numeric(series, errors="coerce").dropna()
    if len(clean) < 2:
        return (math.nan, math.nan)
    deltas = clean.diff().abs().dropna()
    if deltas.empty:
        return (math.nan, math.nan)
    return (float(deltas.mean()), float(deltas.quantile(0.95)))


def analyze_models(ticks: pd.DataFrame) -> pd.DataFrame:
    model_columns = {
        "a_star_pure": "eta_a_star_pure_min",
        "a_star_calibrated": "eta_a_star_calibrated_min",
        "api_base": "eta_api_base_min",
        "api_near_interp": "eta_api_near_interp_min",
        "displayed_legacy": "eta_displayed_legacy_min",
        "displayed_hybrid": "eta_displayed_hybrid_min",
        "displayed": "eta_displayed_min",
    }

    has_actual = "actual_remaining_min" in ticks.columns
    trip_ids = ticks.get("analysis_id", ticks.get("trip_id", pd.Series(dtype=str))).fillna("").astype(str)

    cycle_series = pd.to_numeric(ticks.get("total_cycle_ms"), errors="coerce")
    cycle_mean = float(cycle_series.mean()) if cycle_series.notna().any() else math.nan
    cycle_p95 = float(cycle_series.quantile(0.95)) if cycle_series.notna().any() else math.nan

    rows = []
    for model_name, col in model_columns.items():
        if col not in ticks.columns:
            rows.append(
                {
                    "model": model_name,
                    "samples": 0,
                    "mae_min": math.nan,
                    "rmse_min": math.nan,
                    "jitter_abs_delta_mean_min": math.nan,
                    "jitter_abs_delta_p95_min": math.nan,
                    "cycle_ms_mean": cycle_mean,
                    "cycle_ms_p95": cycle_p95,
                }
            )
            continue

        pred = pd.to_numeric(ticks[col], errors="coerce")
        pred_valid = pred[pred > 0]

        if has_actual:
            actual = pd.to_numeric(ticks["actual_remaining_min"], errors="coerce")
            valid = pred.notna() & actual.notna() & (pred > 0) & (actual >= 0)
            err = (pred[valid] - actual[valid]).abs()
            mae = float(err.mean()) if not err.empty else math.nan
            rmse = float(((pred[valid] - actual[valid]) ** 2).mean() ** 0.5) if not err.empty else math.nan
            sample_count = int(valid.sum())
        else:
            mae = math.nan
            rmse = math.nan
            sample_count = int(pred_valid.count())

        jitter_means = []
        jitter_p95s = []
        temp = pd.DataFrame({"trip_id": trip_ids, "pred": pred})
        for _, group in temp.groupby("trip_id"):
            if group["trip_id"].iloc[0] == "":
                continue
            jm, jp = compute_jitter(group["pred"])
            if not math.isnan(jm):
                jitter_means.append(jm)
            if not math.isnan(jp):
                jitter_p95s.append(jp)

        rows.append(
            {
                "model": model_name,
                "samples": sample_count,
                "mae_min": mae,
                "rmse_min": rmse,
                "jitter_abs_delta_mean_min": float(sum(jitter_means) / len(jitter_means))
                if jitter_means
                else math.nan,
                "jitter_abs_delta_p95_min": float(sum(jitter_p95s) / len(jitter_p95s))
                if jitter_p95s
                else math.nan,
                "cycle_ms_mean": cycle_mean,
                "cycle_ms_p95": cycle_p95,
            }
        )

    return pd.DataFrame(rows)


def write_report(
    report_path: Path,
    session_id: str,
    model_scores: pd.DataFrame,
    related_session_ids: list[str],
):
    lines = []
    lines.append(f"# ETA Session Report: {session_id}")
    lines.append("")
    if related_session_ids:
        lines.append("## Session Scope")
        lines.append(f"- Included sessions: {', '.join(sorted(related_session_ids))}")
        lines.append("")

    if model_scores.empty:
        lines.append("모델 점수를 계산할 데이터가 없습니다.")
        report_path.write_text("\n".join(lines), encoding="utf8")
        return

    numeric_mae = model_scores.dropna(subset=["mae_min"])
    numeric_jitter = model_scores.dropna(subset=["jitter_abs_delta_mean_min"])

    lines.append("## 핵심 요약")
    if not numeric_mae.empty:
        best_mae = numeric_mae.sort_values("mae_min").iloc[0]
        lines.append(
            f"- 정확도(낮을수록 좋음) 최상: `{best_mae['model']}` (MAE {best_mae['mae_min']:.3f}분)"
        )
    else:
        lines.append("- 정확도 비교 불가: trip 종료 기준 실제 남은시간 계산 데이터가 부족합니다.")

    if not numeric_jitter.empty:
        best_jitter = numeric_jitter.sort_values("jitter_abs_delta_mean_min").iloc[0]
        lines.append(
            f"- 안정성(낮을수록 좋음) 최상: `{best_jitter['model']}` (평균 변동 {best_jitter['jitter_abs_delta_mean_min']:.3f}분)"
        )
    else:
        lines.append("- 안정성 비교 불가: 모델 시계열 샘플이 부족합니다.")

    cycle_mean = model_scores["cycle_ms_mean"].dropna()
    cycle_p95 = model_scores["cycle_ms_p95"].dropna()
    if not cycle_mean.empty:
        lines.append(f"- 연산 주기 평균: {cycle_mean.iloc[0]:.2f}ms")
    if not cycle_p95.empty:
        lines.append(f"- 연산 주기 p95: {cycle_p95.iloc[0]:.2f}ms")

    lines.append("")
    lines.append("## 모델 점수 파일")
    lines.append("- `model_scores.csv`를 참고해 최종 의사결정 가중치(정확도/안정성/성능)를 적용하세요.")
    lines.append("")

    report_path.write_text("\n".join(lines), encoding="utf8")


def main():
    args = parse_args()
    root = Path(args.root).resolve()
    session_dir = pick_session_dir(root, args.session_id, args.session_dir).resolve()
    session_id = session_dir.name

    related_session_dirs = find_related_session_dirs(root, session_dir)
    ticks, events, trip_summary = load_combined_session_data(related_session_dirs)

    trip_end_map = build_trip_end_map(trip_summary, events)
    ticks = add_actual_remaining_minutes(ticks, trip_end_map)
    model_scores = analyze_models(ticks)

    report_dir = root / "reports" / session_id
    report_dir.mkdir(parents=True, exist_ok=True)

    model_scores_path = report_dir / "model_scores.csv"
    model_scores.to_csv(model_scores_path, index=False)

    report_path = report_dir / "report.md"
    write_report(report_path, session_id, model_scores, [p.name for p in related_session_dirs])

    print(f"[OK] session: {session_id}")
    print(f"[OK] related sessions: {', '.join(p.name for p in related_session_dirs)}")
    print(f"[OK] model scores: {model_scores_path}")
    print(f"[OK] report: {report_path}")


if __name__ == "__main__":
    main()
