# Trading Live-Flow Observation Plan — 2026-03-23

## Why this exists
The cross-sector expansion is now structurally broad enough that the best next validation step is **real-flow observation**, not more synthetic sector additions.

Important posture:
- the newer sectors are **bench-ready**
- they are **not yet all live-flow-proven**
- success should now be judged by what the live monitor pipeline actually produces over the next observation window

## Observation goal
Answer four practical questions:

1. **Throughput**
   - do the new lanes actually receive live signals?

2. **Routing quality**
   - when a live signal lands in a new lane, is the route believable and specific?

3. **Candidate quality**
   - does the surfaced candidate list preserve enough long/short contrast to be useful?

4. **Sector honesty**
   - do any lanes stay effectively empty, suggesting they are too broad in framing or too niche in current source mix?

## Observation window
Recommended initial window:
- **3 days** or roughly **6–9 monitor cycles**, whichever gives enough live examples first

Reason:
- long enough to catch a few cross-sector headlines
- short enough to avoid pretending absence of flow is a permanent structural verdict

## What to watch by theme

### 1) Rare earth supply
Current truth:
- structurally ready
- likely low natural flow in current source mix

Watch for:
- critical minerals
- rare earth processing
- magnet materials
- China export restrictions
- MP Materials / Lynas / Energy Fuels mentions

Success condition:
- at least one or two believable live signals route into `rare_earth_processing` without requiring synthetic prompting

Failure mode:
- no live hits at all, or only vague commodity headlines that do not justify the lane

### 2) Industrial automation
Current truth:
- strong bench, but not yet live-proven in current flow

Watch for:
- Rockwell / Emerson
- factory automation
- PLC / control systems
- robotics / motion control
- machine vision / Cognex / Keyence

Success condition:
- live signals split plausibly across `controls_robotics`, `machine_vision_sensing`, or `robotics_motion`

Failure mode:
- repeated collapse into generic macro/industrial language with no clean structural route

### 3) Defense supply chain
Current truth:
- stronger long-side bench than short-side elegance
- still likely event-driven rather than steady-flow

Watch for:
- missile defense
- interceptors / rocket motors / artillery shells
- radar / EW / tactical radio / avionics
- naval shipbuilding / submarine / fleet expansion

Success condition:
- live headlines land in specific defense subchains rather than a vague conflict bucket

Failure mode:
- most defense headlines remain too broad, forcing generic proxies instead of meaningful supply-chain routing

### 4) Healthcare equipment
Current truth:
- strong subchain structure, but current source mix may produce less medtech-specific flow than industrial/energy/geopolitical themes

Watch for:
- imaging / MRI / CT / diagnostics platform
- robotic surgery / procedural platform
- consumables / reagents / procedure tools

Success condition:
- at least one believable live route into each major medtech system/components split over time

Failure mode:
- near-zero throughput despite structurally good taxonomy, which may mean source-mix mismatch rather than taxonomy failure

### 5) Energy infrastructure
Current truth:
- already partly live-proven
- useful as a calibration baseline for new-sector observation

Watch for:
- grid equipment
- transformer / switchgear / substations
- datacenter power/cooling versus broader grid routing

Success condition:
- continued clean separation between `grid_power_equipment` and AI-specific `power_cooling_stack`

Failure mode:
- routing bleed returns or weak-side candidate diversity collapses again

## What counts as a good live-hit
A live hit is useful if it satisfies most of these:
- the route is specific, not generic sector wallpaper
- the mapped long side makes sense for the actual bottleneck
- the weak side is plausible and not absurdly forced
- `none_clear` is used when specificity is not justified
- the headline would still make sense if shown in a future research-first Trading widget

## What not to overreact to
Do **not** treat these as immediate failures:
- a sector not appearing in just one day of flow
- a narrow lane staying quiet during a normal news day
- overlap between adjacent real-world chains when the specific route still wins

## Decision rules after the window

### Keep as-is
If:
- the lane gets believable live hits
- candidate quality is usable
- overlap is explainable and controlled

### Refine
If:
- the lane gets some live hits, but routing is too broad or candidate contrast is weak

### Demote / narrow framing further
If:
- throughput remains extremely low
- live hits are too generic to justify the lane
- the lane is conceptually valid but not supported by current source mix

## Main success metric
The goal is not “more sectors.”
The goal is:
- **credible live routing into a small number of well-formed value-chain lanes**
- with enough candidate depth that the research layer stays honest and useful

## Current bottom line
The system is now ready for real observation.
The next truth should come from the live pipeline, not from more synthetic expansion.
