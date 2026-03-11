## Plan: Multi-layer FL/TX HPI map with quarter toggles

Build checkbox-driven map layers for FL/TX state quarterly YoY (latest, previous quarter, two quarters back) and add an optional county overlay using annual county HPI YoY from FRED ATNHPIUS{countyFIPS}A series. Reuse current Mapbox load/popup architecture, split data preparation by geography (state vs county), and keep robust fallbacks and loading indicators so the map stays interactive during partial data failures.

**Steps**
1. Phase 1: Data model refactor in `src/MapboxExample.jsx`.
2. Define shared data contracts in component scope:
3. State-quarter payload per state: latest quarter, prev quarter, prev-2 quarter YoY + quarter labels + raw HPI values.
4. County payload per county: latest annual YoY + year label + raw HPI value + county FIPS + series id.
5. Add utility functions for quarterly and annual YoY extraction from FRED CSV rows; ensure handling for `.` missing values and insufficient history.
6. Add `Promise.allSettled` fetch strategy for all data groups to avoid hard-fail on partial outages.
7. Phase 2: Source/geometry expansion (*depends on Phase 1*).
8. Keep existing states GeoJSON pipeline for FL/TX and enrich each feature with quarter-specific properties: `yoy_q0`, `yoy_q1`, `yoy_q2`, `label_q0`, `label_q1`, `label_q2`.
9. Add county GeoJSON source for US counties; filter to FL/TX by state FIPS prefixes (`12`, `48`) and preserve county FIPS in properties.
10. Build county series mapping using deterministic ID format `ATNHPIUS{countyFIPS}A` and enrich counties with annual YoY properties.
11. Phase 3: Layer topology and toggles (*depends on Phase 2*).
12. Create separate fill layers for state quarter views: `state-fill-q0`, `state-fill-q1`, `state-fill-q2` (initially q0 visible).
13. Create county fill layer `county-fill-annual` and county outline layer; set initial visibility off.
14. Add checkbox UI controls (React state) for each layer visibility, matching user preference for multi-select overlays.
15. Keep state outlines always visible unless visual clutter requires separate toggle.
16. Phase 4: Popup and interaction updates (*depends on Phase 3*).
17. Reuse one popup instance but route hover handlers per layer type.
18. State popup: state name + selected quarter label + YoY + HPI.
19. County popup: county name + annual reference year + YoY + HPI + series id.
20. Ensure cursor state and popup removal are correct when moving across overlapping layers.
21. Phase 5: Performance, resiliency, and UX polish (*parallel with Phase 4 once layer IDs exist*).
22. Add loading indicator while county data resolves (county fetch fan-out may be large).
23. Add fail-soft banner/message when some county series fail but map still renders.
24. Optional optimization switch: start with top-N counties by population if full-county load time is too high.
25. Verification and hardening (*depends on all phases*).
26. Validate no duplicate layer/source registration on hot reload or StrictMode remount.
27. Ensure map cleanup removes all handlers/popups to prevent leaks.

**Relevant files**
- `/Users/meghankulkarni/mapboxjs/src/MapboxExample.jsx` — main implementation: data fetch orchestration, source/layer creation, popup logic, and toggle UI.
- `/Users/meghankulkarni/mapboxjs/src/mapbox.css` — style for checkbox control panel and loading/error badges.
- `/Users/meghankulkarni/mapboxjs/src/App.css` — optional shared layout tweaks if control panel needs app-level positioning.

**Verification**
1. Run `npm run dev`, verify four checkboxes render: state latest quarter, state previous quarter, state previous-2 quarter, county annual.
2. Toggle each checkbox and confirm corresponding layer visibility changes without errors in console.
3. Hover FL and TX in each state-quarter layer and confirm popup quarter label and YoY change consistently.
4. Enable county layer, hover at least 3 FL counties and 3 TX counties, confirm annual labels and county-specific values.
5. Temporarily simulate failed fetch for one series and confirm map still renders with partial data + warning UI.
6. Run `npm run build` and ensure no compile errors.

**Decisions**
- Included: checkbox-style multi-select toggles.
- Included: county data via annual HPI YoY where quarterly county series are unavailable.
- Included: state data remains quarterly using FLSTHPI/TXSTHPI.
- Excluded: introducing paid/API-key FRED endpoints; implementation uses public CSV graph endpoints.
- Excluded: nationwide county rendering outside FL/TX.

**Further Considerations**
1. County fan-out request volume may be high (all FL/TX counties); if runtime is slow, add lazy-load on first county-toggle activation and local caching in memory.
2. If annual county YoY and quarterly state YoY in one color scale feels inconsistent, keep separate legends/scales for state and county layers.
3. If visual overlap is busy with checkbox multi-select, add layer opacity sliders for county and state layers.
