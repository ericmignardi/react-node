# Hammerline: Claude Design Prompt

> Copy everything inside the box below into a new Claude Design conversation. Upload the attachments listed at the end first.

---

````text
You are designing the complete UI for **Hammerline**, a web app for maintenance and downtime tracking on a manufacturing plant floor. Please produce a cohesive design system and high-fidelity designs for every screen listed below, including their key states. The designs will be implemented in **React 19 + Tailwind CSS v4 + shadcn/ui (Radix primitives) + Recharts + lucide-react icons**, so stay within what those tools do well: use shadcn component patterns (Button, Card, Dialog, Sheet, DropdownMenu, Command/Combobox, Table, Tabs, Badge, Tooltip, Toast/Sonner, Skeleton, Calendar/DateRangePicker) and Tailwind-friendly spacing and colour tokens.

## 1. Product context
Hammerline helps a manufacturing plant handle the "breakdown loop":
1. An **Operator** at a production line reports a machine problem from a shared tablet and says whether the machine is stopped.
2. The machine immediately shows as **DOWN** (stopped) or **DEGRADED** (running with a problem) on every connected screen, live.
3. A **Supervisor** triages the work order (sets priority) and assigns a **Technician**.
4. The technician starts the job, logs work (notes, minutes, parts used) and resolves it. The machine returns to **RUNNING**.
5. The supervisor verifies and closes the job, or rejects it back to the technician.
6. A dashboard turns the history into maintenance metrics: downtime, MTTR (mean time to repair), MTBF (mean time between failures), availability %, and breakdown trends.

The demo data is a fictional plant, **Bayfront Metal Works**, in Hamilton, Ontario, with three production lines: **Stamping (STP)**, **Welding (WLD)** and **Finishing (FIN)**, about 15 machines in total (hydraulic presses, robotic weld cells, a powder-coat booth, a cure oven, etc.). Asset tags look like `STP-PR-03`. Work order numbers look like `WO-1042`.

This is a portfolio project that recruiters will try through one-click demo logins, so the first impression (sign-in → status board) must feel polished, credible and "real industry software", not a template.

## 2. Users
| Role | Context | Device | Needs |
|---|---|---|---|
| Operator | On the factory floor, possibly wearing gloves, noisy and bright environment, in a hurry | Shared tablet (768–1024 px), sometimes a phone | Report a problem in under 30 seconds; huge touch targets; minimal typing; clear confirmation |
| Technician | Moving between machines | Tablet or phone, sometimes desktop | Their queue at a glance; quick Start / Log / Resolve actions |
| Supervisor | Office or line-side desk | Desktop (1280–1920 px) | Dense, scannable tables; fast triage; metrics; admin of users and machines |

## 3. Brand and tone
- **Name:** Hammerline (a nod to Hamilton's nickname, "The Hammer", plus "production line"). **Tagline:** "Maintenance & downtime tracking for the plant floor."
- **Personality:** industrial, calm, precise, trustworthy. Think "modern control room", not "startup marketing site". Confident, plain-language copy ("Machine stopped", "Assign technician", "Down for 1h 12m").
- **Visual direction:**
  - Neutral cool-slate base (steel), generous whitespace on supervisor screens, dense-but-readable tables.
  - **One accent colour** for brand and primary actions. Suggest a molten / safety orange or a steel blue, and pick whichever keeps status colours most distinct.
  - **Status colours are semantic and reserved:** RUNNING = green, DEGRADED = amber, DOWN = red. Priority: LOW = slate, MEDIUM = blue, HIGH = amber/orange, CRITICAL = red. **Status must always be shown with colour + icon + text label**, never colour alone.
  - Subtle industrial details are welcome (hairline grid textures, monospace asset tags, hazard-stripe accent used *sparingly* on DOWN/critical states only). Avoid kitsch.
  - **Typography:** IBM Plex Sans (UI) and IBM Plex Mono (asset tags, WO numbers, timers, metric numbers). Use tabular numerals for all numbers and timers.
  - **Light and dark themes**, both first-class. Dark is likely preferred for the wall-mounted status board.
- **Logo:** propose a simple wordmark plus a small monogram (e.g. a stylized "H" formed by a hammer head or I-beam). It must work at 16 px as a favicon.

## 4. Information architecture and navigation
- Desktop: collapsible left sidebar plus a top bar. Tablet/phone: top bar plus a bottom tab bar (Operator/Technician) or a hamburger sheet.
- Top bar: plant name, a **live connection indicator** (Live / Reconnecting / Offline), theme toggle, and a user menu (name, role badge, sign out). Demo users show a small "Demo" badge.
- Navigation by role:
  - **Operator:** Report issue (primary), Status board, My reports
  - **Technician:** My assignments (home), Status board, Work orders
  - **Supervisor:** Dashboard (home), Status board, Work orders, Machines, Users

## 5. Screens (design each, with the states listed)

Global states every data screen needs: **loading** (skeletons matching the layout), **empty** (helpful illustration or icon, one sentence, primary action), **error** (plain-language message, retry button, request ID in small mono text), and **no permission** where relevant.

1. **Warm-up screen** (shown while the free-tier API wakes, up to about 60 s): branded, calm, with animated progress (a factory or conveyor motif is fine). Rotating friendly messages ("Starting the presses…", "Checking machine status…"). States: waking, connected (brief success transition), failed after 90 s (explanation + Retry).
2. **Sign in:** email and password form, plus a prominent **"Explore the demo"** section with three role cards (Operator / Technician / Supervisor), each with an icon, a one-line description of what that role can do, and a "Try as …" button. States: default, submitting, invalid credentials (generic message), rate-limited, demo disabled (cards hidden).
3. **Status board:** a grid of machine tiles grouped by line, with summary chips at the top (e.g. 11 Running · 2 Degraded · 2 Down) and a line filter. Tile: machine name, asset tag (mono), type, status (colour + icon + label). DOWN/DEGRADED tiles also show a live "Down for 1h 12m" timer and the linked WO number and priority. Tiles are clickable and keyboard-focusable. Include a "wall display" variant: dark, larger type, auto-fit to the screen. States: loading, all running (celebratory but subtle), several down, a tile that just changed (brief highlight animation, respecting reduced motion), empty (no machines yet, with a CTA for supervisors).
4. **Report issue** (Operator, tablet-first): a single page or short stepper. (a) Pick machine (large searchable combobox with recent machines and line grouping; can arrive pre-filled from the board). (b) **"Is the machine stopped?"** as two very large Yes/No toggle buttons. (c) Category as a big icon chip grid (Mechanical, Electrical, Hydraulic, Pneumatic, Safety, Other). (d) Suggested priority as a segmented control. (e) Short title, optional description. States: inline validation errors; **duplicate warning** ("This machine already has an open work order WO-1038, view it"); submitting; **success** screen with a big WO number, the new machine status, and "Report another" / "Back to board".
5. **My reports** (Operator): a simple list or cards of work orders the operator reported, with status badges and relative times. Empty state.
6. **My assignments** (Technician home): card list sorted by priority then age, split into "In progress" and "Assigned". Each card shows WO number, machine, priority, status, age, "machine stopped" indicator, and quick actions (Start, Add log, Resolve). Empty state: "No assignments, nice work."
7. **Work orders list** (Supervisor/Technician): data table with columns WO #, title, machine, line, priority, status, assignee, reported (relative + absolute on hover), and downtime. Toolbar: search, filter chips plus a filter sheet (status, priority, line, machine, assignee, category, date range), sort, pagination, page-size selector, "Clear filters". Show a "Needs triage" quick filter for OPEN items. States: loading, empty (no results for these filters), error. Responsive: becomes cards on tablet/phone.
8. **Work order detail:** a header with WO number, title, status and priority badges, machine link, "machine stopped" indicator, and a live "down for" timer when applicable. A **role-aware action bar** (Assign/Reassign, Start, Resolve, Close, Reject, Cancel, Change priority; only the allowed actions appear). Panels: details (category, reporter, assignee, timestamps); **work log** (entries with note, minutes, parts; total minutes; "Add log" for the assigned technician); **audit timeline** (vertical timeline of every action, with actor avatar/initials, action, status change and note). Dialogs: Assign (technician picker showing each tech's current workload), Resolve (required resolution note), Reject (required note), Cancel (required note), Add work log (note, minutes, parts). States: loading, not found, conflict toast ("This work order was updated by someone else, refreshed"), live update arriving while viewing.
9. **Machines** (Supervisor admin + read-only for others): table with name, asset tag, line, type, status, and active WO count; "Show archived" toggle; create/edit machine dialog; create/edit line dialog; archive confirmation; archive blocked state ("Resolve 1 active work order before archiving"). Archived rows look visually muted.
10. **Machine detail:** status hero, key facts, active work orders, recent history list, last-30-days downtime summary (a small sparkline or bar), and a "Report issue on this machine" button.
11. **Dashboard** (Supervisor home): a filter bar with date-range presets (7/30/90 days, custom) and a line filter. KPI cards: Total downtime (h), MTTR, MTBF, Availability %, Breakdowns, and Open work orders by priority (stacked mini-bar). Each KPI has an info tooltip explaining its formula. Charts: downtime trend per day (line/area), top 10 machines by downtime (horizontal bar), downtime by line (bar), breakdowns by category (bar). Every chart has a "View as table" toggle. States: loading skeletons, empty range ("No breakdowns in this period 🎉"), error, live refresh (subtle "Updated just now").
12. **Users** (Supervisor): table with name, email, role badge, status (active/deactivated), and a "Demo" badge; search and role filter; create user dialog (name, email, role, temporary password); edit dialog; deactivate/reactivate confirmation. Disabled states with explanations for demo users and for yourself ("You can't deactivate your own account").
13. **403 Not allowed**, **404 Not found**, and a generic **error boundary** page, all on-brand.
14. **Toasts and notifications:** success (e.g. "WO-1042 assigned to Sam Patel"), error, conflict, and a live event toast for supervisors ("STP-PR-03 is DOWN, WO-1043 reported by Jordan Lee").

## 6. Components to define in the design system
Buttons (primary, secondary, ghost, destructive; sizes incl. an XL touch size of 56 px+), StatusBadge (RUNNING/DEGRADED/DOWN), PriorityBadge, WorkOrderStatusBadge (OPEN, ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED, CANCELLED), RoleBadge, DemoBadge, MachineTile, KPI card, chart card with "View as table", DataTable (header, sortable column, row hover/selected, pagination), filter chips + filter sheet, searchable combobox, segmented control, large Yes/No toggle, icon chip grid, timeline item, work log item, live timer, connection indicator, empty state, error state, skeletons, dialogs/sheets, toasts, sidebar/topbar/bottom-tab navigation, avatar/initials. Provide light and dark tokens for colour, typography scale, spacing, radius, shadow/elevation and focus ring.

## 7. Accessibility requirements (WCAG 2.2 AA)
- Text contrast ≥ 4.5:1 (≥ 3:1 for large text and UI component boundaries) in **both** themes, including status and priority badges.
- Never rely on colour alone: every status and priority has an icon and a text label.
- Visible, high-contrast focus ring on every interactive element; logical tab order; skip-to-content link.
- Touch targets ≥ 44×44 px everywhere, and ≥ 56 px for primary operator actions.
- Live updates announced politely (`aria-live`) without stealing focus; connection status announced.
- Charts have accessible table alternatives and descriptive titles.
- Respect `prefers-reduced-motion` (no pulsing or flashing; highlight changes with a static outline instead).
- Forms: visible labels (not placeholder-only), inline errors linked to their fields, error summary on submit.
- Timers and numbers use tabular figures; relative times always have an absolute-time tooltip.

## 8. Deliverables
1. A design system page (tokens, type scale, colour palette in light and dark, components with their variants and states).
2. High-fidelity designs for screens 1–14 at desktop (1440 px) and, for operator/technician screens, tablet (834 px) and phone (390 px).
3. The key states listed for each screen.
4. A short rationale for the accent colour, status colours (with contrast ratios), and the logo.
5. Implementation notes mapping components to shadcn/ui equivalents and Tailwind tokens (CSS variables for the themes).
````

---

## Attachments to upload to the Claude Design conversation

Upload these alongside the prompt:

- [ ] **PRD.md**: the full product requirements: user stories, the state machine table, the data model and metric definitions. It lets the design reflect real fields, statuses and rules instead of guesses.
- [ ] **A realistic sample-data snippet** (export from the seed once Phase 3–4 exists, or paste a short JSON of 3 lines, about 15 machines and 5 work orders with real-looking titles). Realistic names and asset tags make the mockups look credible and expose layout issues with long machine names.
- [ ] **Screenshots of 2–3 maintenance (CMMS) products you like** (e.g. MaintainX, UpKeep, Fiix public marketing screenshots) marked "inspiration, do not copy". They give the designer a sense of what credible industry software looks like, so Hammerline can feel familiar but original.
- [ ] **shadcn/ui theming reference**: a screenshot or link of the shadcn "Themes" page, or the `components.json` / CSS-variables file once initialized. This keeps tokens directly mappable to the CSS variables you'll actually use.
- [ ] **Tailwind v4 note**: a one-liner that the project uses Tailwind v4 with `@theme` CSS variables (no `tailwind.config.js`). This avoids receiving a v3-style config that doesn't apply.
- [ ] **A photo or two of a real factory tablet or andon board** (any royalty-free image of a line-side terminal or status board). It grounds the operator and wall-display layouts in the real environment: distance viewing, gloves, glare.
- [ ] **Any personal brand elements** (portfolio site colours or fonts) if you want Hammerline to sit consistently in your portfolio. This is optional; skip it to let the design lead.
- [ ] **(Later iterations) Screenshots of your implemented screens.** After building a phase, upload them and ask for a critique and polish pass against this brief.
