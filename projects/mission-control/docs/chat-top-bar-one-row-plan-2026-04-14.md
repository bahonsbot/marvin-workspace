# Mission Control Chat — one-row top section plan

Date: 2026-04-14
Scope: planning only
Target surface: `projects/mission-control/components/chat/MissionControlChatSurface.tsx`
Status: proposed implementation plan, not yet implemented

## Goal

Collapse the current two-row Chat top section into a single clean working row without losing the current control set:
- WS status
- session status
- status detail access
- context meter
- seat selector
- model selector
- effort selector
- recent sessions access
- refresh
- stop

And remove the second-row `Reset` button.

## Current reality

The top section is currently split like this:

### Row 1
- `ws {state}` pill
- `session {state}` pill
- info/status button with dropdown
- `Refresh`
- `Stop`
- inline context meter
- `Controls` collapse toggle

### Row 2
- seat selector
- model selector
- effort selector
- optional `Apply seat defaults`
- `Reset`
- `Recent Sessions`

The current collapse pattern saves some height only when the second row is hidden, but when visible it still burns too much vertical space for a page that is supposed to feel like a working chat surface rather than a dashboard header.

## Design thesis

The top bar should feel like a compact operator strip, not two stacked control bands.

The right answer is not to force the existing controls into one row unchanged. The right answer is to **compress the language, flatten the hierarchy, and convert low-frequency labels into icon-or-chip patterns** so the row stays legible.

## Recommended direction

Use a **single responsive operator rail** with this order:

1. transport cluster
2. runtime controls cluster
3. session/model controls cluster
4. session history access

In practice:

- keep the most live/volatile truth on the left
- keep active runtime action buttons in the center-right
- keep configuration selectors toward the right
- keep Recent Sessions as the last popover trigger

## Proposed one-row composition

### Cluster A — connection truth
Compact always-visible items:
- `WS` pill with state color only, not `ws open`
- `Session` pill with state color only, not `session connected`
- status/info icon button

Example visual language:
- `WS` + green dot / amber / red treatment
- `SESS` + state color
- `ⓘ` remains the details trigger

Reason:
- the current text is truthful but verbose
- the bar needs scan-first tokens, not sentence fragments

## Cluster B — live actions and context
Visible in-row:
- icon refresh button
- `Stop` text button, because this is the only destructive/interruptive action and should stay explicit
- compact context meter chip

Context chip proposal:
- label becomes `Ctx 42%`
- tiny bar stays visible inside the chip
- tooltip preserves fuller wording: `42% of visible context`

Reason:
- context is useful but should not read like a mini-widget
- keeping percent + tiny bar preserves utility while shrinking width

## Cluster C — runtime selectors
Visible in-row as compressed segmented trigger buttons:
- seat
- model
- effort
- optional apply-seat-defaults action only when relevant

### Seat trigger
Current problem:
- the seat control is the widest item because it includes label + detail text

Recommendation:
- one-line trigger only
- default visible text: selected seat label only
- remove detail subtitle from the closed trigger
- keep detail text inside dropdown items, not in the top bar

Closed state example:
- `Marvin ▾`
- `Sudo ▾`
- `Vantage ▾`

### Model trigger
Recommendation:
- keep as one-line compact trigger
- show only the active display label
- move any command/readback nuance fully into dropdown content or tooltip

### Effort trigger
Recommendation:
- keep as one-line compact trigger
- use shorter copy such as `Low`, `High`, `XHigh`
- if non-interactive, show disabled compact chip instead of a wide pseudo-dropdown

### Apply seat defaults
Recommendation:
- do not reserve permanent width for this control
- only show when a seat actually has defaults worth applying
- style as compact icon+tooltip or short chip, for example `Apply defaults`
- if that still crowds the row, move it into the seat dropdown footer instead of keeping it in the top bar

This is the cleanest likely outcome.

## Cluster D — recent sessions
Recommendation:
- keep this as a compact trigger at the far right
- shorten visible label from `Recent Sessions` to either:
  - `Sessions 6`
  - or clock/history icon + count

Best option:
- history icon + count in the bar
- full `Recent Sessions` title stays inside the popover

Reason:
- the feature matters, but the full label is too expensive for a one-row header

## Controls to remove or relocate

### Remove from top bar
- `Reset`

This matches Philippe’s stated preference and is the easiest width win.

### Remove entirely from default interaction
- `Controls` expand/collapse button
- collapsible second row container

If the top bar succeeds as one row, the collapse affordance is no longer solving the real problem and becomes leftover complexity.

### Likely relocate
- `Apply seat defaults`, if it still causes width pressure

Best relocation target:
- inside the seat dropdown, pinned near the active seat state

## Information architecture changes

### What stays always visible
- connection truth
- stop
- context
- seat
- model
- effort
- recent sessions trigger

### What moves behind popovers/tooltips/dropdowns
- verbose connection detail
- seat detail text
- model command detail
- effort command detail
- recent session labels/details
- optional seat-default action

This preserves functionality while stripping visible verbosity.

## Interaction details

### 1. Closed-state controls must become one-line only
No control in the top row should render a subtitle in its resting state.

That means:
- seat trigger loses the second line
- model trigger stays single-line
- effort trigger stays single-line

### 2. Popovers keep the lost richness
The dropdowns are where explanatory copy belongs.

That means:
- seat menu keeps note/detail text
- model menu keeps command/readback hints
- effort menu keeps `/think:<level>` hints
- status dropdown keeps bridge/session detail

### 3. Stop remains text, not icon-only
`Stop` is used rarely enough that it does not deserve dominant visual weight, but it is important enough that it should not become a mystery glyph.

### 4. Refresh can become icon-first
Refresh is a good candidate for icon-only with tooltip, or icon + very short label if needed.

## Layout rules

### Desktop / laptop target
The full strip should fit on one row at normal laptop widths used for Mission Control.

Recommended CSS posture:
- outer container: horizontal flex row
- `align-items: center`
- `flex-wrap: nowrap` at desktop breakpoint
- allow only internal truncation, not row wrap, at desktop widths
- use `min-width: 0` aggressively on selector triggers
- cap trigger widths rather than letting seat/model labels expand endlessly

### Width budgeting
Approximate priority order when width gets tight:
1. keep WS + Session + info visible
2. keep Stop visible
3. keep seat/model/effort visible but truncated
4. compress Recent Sessions trigger to icon + count
5. move Apply seat defaults into seat menu

### Mobile / narrow widths
Do not force the same strict one-row rule on narrow screens.

Recommendation:
- one-row requirement applies to desktop/laptop Mission Control working widths
- below a chosen breakpoint, allow controlled wrap or horizontal scrolling for controls
- do not degrade the desktop solution to satisfy a narrow layout first

## Concrete implementation slices

### Slice 1 — control compression
- remove `Reset`
- remove closed-trigger subtitles from seat trigger
- shorten `ws {state}` to compact WS token
- shorten `session {state}` to compact Session token
- convert context widget to compact `Ctx` chip
- shorten Recent Sessions trigger
- verify no loss of existing dropdown behavior

Expected result:
- the existing row 2 content becomes materially narrower before any deeper structural refactor

### Slice 2 — single-row restructure
- replace the row-1 + details-row composition with one horizontal operator rail
- keep existing dropdown menus and handlers
- move `Apply seat defaults` into seat menu if needed
- remove old `Controls` collapse state and `details` wrapper

Expected result:
- true one-row top section on desktop

### Slice 3 — visual cleanup and restraint pass
- normalize button heights and border radii
- make icon/text rhythm consistent
- reduce noisy uppercase where it harms scan speed
- tune spacing so the strip feels like one instrument panel, not many small cards
- verify sticky behavior still feels calm

Expected result:
- one-row header looks intentional rather than merely compressed

## Verification checklist

### Functional verification
- seat switching still works
- model switching still works
- effort switching still works
- stop still works
- refresh still works
- recent session switch still works
- status dropdown still exposes bridge/session detail
- context percent still updates correctly
- optional seat defaults action remains reachable

### UX verification
- one row at normal laptop width
- no awkward wrap at standard desktop Mission Control widths
- no selector feels ambiguous when closed
- no important action becomes icon-guessing
- header looks lighter than the current two-row version
- transcript gets visibly more vertical room

### Regression watchpoints
- dropdown overlap in sticky mode
- trigger truncation causing unreadable active state
- top-bar overflow when long model names appear
- seat-default action disappearing unintentionally
- too many icon-only controls making the strip cryptic

## Recommended component-level changes

Primary file:
- `projects/mission-control/components/chat/MissionControlChatSurface.tsx`

Possible supporting follow-up:
- `projects/mission-control/components/chat/chat-session-rail.tsx`
- `projects/mission-control/components/chat/chat-ui-helpers.ts`

No architecture rewrite is needed. This is mostly a surface-composition and control-density refactor.

## Suggested exact posture

If this gets implemented, the best version is:
- one sticky row
- no second-row collapse mechanism
- no Reset button in the top bar
- Recent Sessions reduced to compact history access
- seat/model/effort as narrow one-line selectors
- context reduced to a compact chip
- verbose detail preserved only inside menus

That is the cleanest route to getting the height down without turning the strip into inscrutable icon soup.

## Final recommendation

Do this as a **compression-first refactor, not a redesign**.

The current structure already has the right capabilities. The problem is mostly that the closed-state controls are too wordy and too tall. Once the visible language is compressed and the second-row-only affordances are removed, the top section should fit cleanly as a single operator row.
