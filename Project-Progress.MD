# Project Progress

Last Updated: 2026-03-26
Current Branch: premium-gps-overlay

## Mission
Build a stable real-time ETA calculation for the overlay by reducing time-scale jump noise in main logic, then implementing a stronger route-aware model in the premium branch.

## Current Status
- Branch switched to `premium-gps-overlay`.
- Existing issue confirmed: ETA can spike when time scale changes quickly (for example city scale transitions).
- Reference project requested by user: `Rares-Muntean/TruckNav-Sim`.

## Work Log
### 2026-03-26
- Confirmed local branches and switched from `main` to `premium-gps-overlay`.
- Created this progress memory file for long-term tracking.
- Cloned reference project (`Rares-Muntean/TruckNav-Sim`) locally under `.tmp/TruckNav-Sim-ref`.
- Added full ETS2 route graph data into overlay skin:
- `data/ets2/roadnetwork/nodes.json`
- `data/ets2/roadnetwork/edges.json`
- `data/ets2/map-data/cities.geojson`
- `data/ets2/map-data/companies.geojson`
- `data/ets2/map-data/citiesCheck.json`
- Replaced `my_overlay/app.js` ETA core with route-graph approach:
- ETS2 game<->geo converter (LCC-based).
- Runtime graph loader and compressed adjacency structure.
- Spatial node lookup grid for start/end candidate discovery.
- A* pathfinding with turn and road penalties.
- Segment-based game/real minute cache and route-progress tracking.
- Telemetry loop now uses route-derived real ETA as primary value, with nav timer used only for calibration.
- Added navigation-like reroute behavior:
- off-route detection by distance-to-current-route
- forced route recalculation with short cooldown when deviation is large
- Added near-destination ETA precision logic:
- from 30km and below, blend route ETA with live truck speed
- from 20km and below, speed-based influence becomes dominant
- this improves ETA behavior in city / low time-scale zones close to destination
- Added destination road snapping:
- destination company/city geo-point is projected to nearest road segment before path solve
- reduces endpoint ETA drift around yards and company compounds
- Added improved arrival detection:
- not only distance, but also low speed + hold duration
- reduces false early "Arrived" state while still moving
- Updated ETA model to be closer to real navigation behavior:
- removed hard speed-limit cap dependency in ETA speed path
- live-speed influence now applies across full route (distance-based weight)
- added speed-volatility aware weighting to reduce jitter
- added ETA smoothing on top of raw prediction for stable updates
- Removed startup fallback ETA popup:
- during first route bootstrap, show "계산 중..." instead of temporary rough ETA value

## Additional Proposals (Backlog)
- Deferred for now: log replay benchmark (compare predicted ETA vs real arrival over recorded trips).
- Candidate next upgrades:
- Route solving in Web Worker (UI/perf isolation)
- smarter reroute reason classification (off-route vs target update vs data mismatch)
- adaptive per-user ETA correction (online calibration)

## Next Tasks
- Run in-game validation sessions and compare:
- game nav ETA vs our route-derived ETA
- city entry/exit transition behavior
- destination snapping quality (company vs city center)
- If destination snapping is inconsistent, add a nearest-road projection step around destination before final route solve.
- Consider moving route solve off main thread into a Worker if frame drops appear on lower-end systems.

## Open Questions
- Which telemetry fields are stable enough to infer route segment behavior beyond simple distance/time?
- Should premium ETA prioritize stability over immediate responsiveness (and by how much)?
