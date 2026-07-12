# MedGuard Homepage — UI/UX Design Document

## 1. Scope

**In scope**: Public homepage at `/` — scroll-driven frame-sequence hero, editorial copy in quadrants, scroll-scrubbed winding path vertical flowchart, static product sections, CTA buttons on center title card, a middle CTA divider, and a caregiver/family section.

**Non-goals**: Login, signup, dashboard, upload, medicines, alerts, caregiver, admin, backend, API, auth, or database changes. No invented clinical claims, metrics, certifications, testimonials, patient data, or safety guarantees.

---

## 2. Audience

| Audience | What they need from the homepage |
|----------|----------------------------------|
| **Chronic-condition patients** (e.g., Ramesh, 64, managing diabetes + hypertension across multiple doctors) | Immediate trust, plain-language promise, no jargon wall |
| **Family caregivers** (e.g., Priya, 34, managing her father's health remotely) | Understand the product helps visibility, not just reminders |
| **Clinical reviewers / evaluators** | Understand the safety architecture without being overwhelmed |

---

## 3. Medical-Claims & Privacy Guardrails

- **No diagnostic claims.** Always frame as "preparation, not diagnosis."
- **No invented statistics.** No "99% accuracy" or "trusted by X hospitals."
- **No fabricated testimonials, endorsements, or certifications.**
- **Clinician-conversation framing.** Every CTA points toward "discuss with your clinician," never "this replaces your doctor."
- **No patient data shown.** Demo content uses illustrative examples from docs (Dolo 650, Glycomet) if needed, never real patient data.
- **DPDP language.** If consent is ever mentioned, use "DPDP-aligned consent" per CONTEXT.md.

---

## 4. Visual Directions (Three Explored)

### A. "Clinical Editorial" ✅ Selected & Implemented
Apple-level restraint. Premium health-tech confidence. Generous whitespace. Refined serif typography. The frame sequence is the hero — design supports it, never competes. Monochrome palette with a single restrained teal accent.

### B. "Warm Caregiving"
Soft rounded forms, warm neutrals, friendly illustration style. Risk: looks like a wellness app, undermines the safety-critical positioning.

### C. "Data Dashboard"
Technical, data-forward, structured grids. Risk: alienates non-technical patients and caregivers. Feels like an internal tool, not a product landing page.

---

## 5. Design Tokens

### Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--mg-ink` | `#0B1F33` | Primary text, headings |
| `--mg-muted` | `#5D6B78` | Secondary text, descriptions |
| `--mg-accent` | `#0F766E` | Links, CTAs, accent elements, active SVG path |
| `--mg-accent-hover` | `#0D6660` | Hover state for accent |
| `--mg-surface` | `#F4F8F8` | Alternating section background |
| `--mg-white` | `#FFFFFF` | Page background, canvas background, opaque fade cover |
| `--mg-border` | `rgba(226, 232, 240, 0.8)` | Subtle card dividers |

### Typography
- **Core Font family**: `'Manrope', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`
- **Logo Font family**: `'Cormorant Garamond', serif` (or `'Cinzel', serif` for roman style). Applied as a bold (700 weight), normal (non-italicized) display style with a subtle `-0.5px` letter-spacing.
- **Display**: 76px / 1.05 / -0.5px tracking (desktop), 48px / 1.1 / -0.5px (mobile)
- **Body large**: 20px / 1.6 (desktop), 18px / 1.6 (mobile)
- **Body**: 16px / 1.6
- **Caption**: 14px / 1.5

---

## 6. Hero Animation & Copy Beats (286 Frames)

The hero is a full-viewport canvas playing 286 JPG frames driven by scroll position over a `650vh` track.

### Scroll Dead-Zone (First 15% Scroll Progress)
For the first 15% of scroll progress, the background sequence remains stationary on frame 0 while the glassmorphic title card remains completely static. This ensures the reader can read the logo and tagline before transition begins.

### Quadrant Copy Card Position mapping
The scroll copy cards fade in, hold, and fade out across the remaining `[0.20, 1.0]` scroll progress:
- **Card 1 (Progress 0.20 - 0.38)**: Top-Left quadrant position.
- **Card 2 (Progress 0.40 - 0.58)**: Right-Center quadrant position.
- **Card 3 (Progress 0.60 - 0.78)**: Right-Top quadrant position.
- **Card 4 (Progress 0.80 - 0.95)**: Left-Bottom quadrant position.

### Transition Overlays
- **Bottom Gradient Border Merge**: A transparent-to-white vertical gradient mask (`.mg-scene__fade-bottom`) covering the bottom `15vh` of the viewport to seamlessly blend the sequence into the layout block below.
- **Opaque Scroll Fade Overlay**: A full-viewport solid white mask (`.mg-scene__opaque-fade`) that transitions from `opacity: 0` to `opacity: 1` as scroll progress moves from 85% to 100%, completing the transition to a solid white background.

---

## 7. Interactive SVG Vertical Flowchart

The "How MedGuard helps" section features a scroll-scrubbed vertical winding path timeline with 5 full-viewport step sections:

### Full-Screen Isolation & Header
- The "How it works" header sits at the top of the flowchart container, sharing the same dynamic background transitions.
- Each step occupies `100vh` (full viewport height) as a self-contained section with `overflow: hidden`.
- No neighboring step's elements are visible while viewing the current step.

### Node & Track Scale
- Nodes are oversized (**58px radius circle**, 78px pulse ring) with 38×38px icons to make them prominent.
- Nodes are shifted closer to the center of the screen layout using a responsive offset (`offsetX = Math.max(220, Math.min(300, width * 0.18))`), bringing them closer to the text cards.
- Connecting path stroke width is 6px; tracker marker is an 18px radius circle.

### Layout (Alternating Sides)
- **Step 1 (Photograph)**: Node left (offsetX), text right
- **Step 2 (Structure)**: Node right (width - offsetX), text left
- **Step 3 (Translate)**: Node left (offsetX), text right
- **Step 4 (Analyze)**: Node right (width - offsetX), text left
- **Step 5 (Prepare)**: Node left (offsetX), text right

### Connecting Paths
- All nodes are connected sequentially into a **single, unbroken winding path string** (`continuousPathD`) drawn inside a single SVG layer spanning the full `500vh` height.
- The path is continuous from Step 1 through Step 5's node with no visual breaks, gaps, or chevrons.
- The path Y coordinates are offset by `320px` to sit cleanly below the container header.

### Continuous Tracker & Trail (Color Morphing)
- A **single active tracker marker** (18px radius dot) is rendered inside the SVG coordinates, positioned **on top of the track but underneath the nodes** in SVG render order.
- The tracker dot and active trail path use the **exact same scroll-to-path progress value** so they move in perfect sync.
- The active trail path, tracker dot, and active node borders/icons morph colors gradually in sync with the background:
  - **Start (Default)**: Teal (`#0F766E`)
  - **Step 2 (Blue stage)**: Sky Blue (`#0284C7`)
  - **Step 3 (Yellow stage)**: Golden Yellow (`#CA8A04`)
  - **Step 4 (Purple stage)**: Purple (`#9333EA`)
  - **Step 5 (End / Default)**: Teal (`#0F766E`)

### Piecewise Speed Warps
- Easing warps are applied to segment scroll progress individually to control speeds:
  - **Step 2 (Segment 1)** and **Step 5 (Segment 3)** are warped **slower** (`t^1.45`) to give a deliberate visual focus on those steps.
  - **Step 1 (Segment 0)**, **Step 3 (Segment 2)**, and **Step 4** move at normal, linear speed.

### Text Presentation
- Text (badge, title, description, label) renders **directly on the page** with no bordered card, box, or background.
- Fast carousel slide-up entrance (+40px below → 0) on scroll-in, slide-up-and-out (0 → -40px above) on scroll-past.
- Card wrappers are top-positioned at `260px` to align vertically with the shifted `320px` node centers.

### Full-Width Background & Complementary Grid
- The background color uses a `100vw` breakout to cover the **entire width of the viewport** edge-to-edge.
- The grid lines use **complementary colors** with respect to the background color to give a visual pop:
  - **Default (White background)**: Teal grid (`rgba(15, 118, 110, 0.12)`)
  - **Blue background**: Orange grid (`rgba(234, 88, 12, 0.16)`)
  - **Yellow background**: Purple grid (`rgba(126, 34, 206, 0.14)`)
  - **Purple background**: Green grid (`rgba(22, 163, 74, 0.16)`)

### Mobile Fallback
- Below `768px`: SVG layer hidden, all five cards render in a clean vertical list with full opacity and no scroll-driven animations.

---

## 8. Interaction & Buttons Placement

- **Cinematic Title Card**: Rendered as a glassmorphic card with `pointer-events: auto` to allow navigation. Features primary **Get Started** and outline **Sign In** action buttons.
- **CTA Divider**: Positioned between the flowchart and the Caregiver sections to provide **Create Free Account** and **Sign In** actions for user onboarding.
- **Medical Reticle Cursor**: A custom interactive mouse follower themed after medical scanners:
  - Center dot is styled as a plus crosshair (`+`).
  - Trailing ring features crosshair targeting tick marks at 12, 3, 6, and 9 o'clock.

---

## 9. Files Changed

| File | Action | Description |
|------|--------|-------------|
| `docs/ui-ux-design.md` | MODIFY | Document visual changes, fonts, vertical flowchart v2, reticle cursor, and color palette. |
| `docs/tracker.md` | MODIFY | Update deliverables with v2 flowchart entries. |
| `frontend/public/medguard-sequence/*.jpg` | NEW | 286 extracted JPG frames for the scrollytelling hero. |
| `frontend/src/pages/Home.jsx` | MODIFY | Renders home layout including custom cursors, vertical flowchart, and CTA sections. |
| `frontend/src/pages/Home.css` | MODIFY | Core style variables, glassmorphic filters, quadrant placements, and CTA dividers. |
| `frontend/src/components/MedGuardScrollScene.jsx` | MODIFY | Canvas rendering context, scroll dead-zone tracking, and opaque fade overlays. |
| `frontend/src/components/MedGuardFlowchart.jsx` | MODIFY | Overhauled to segment-based architecture with per-step scroll tracking, alternating top-anchored layout, SVG-embedded marker flourishes, traveled state array, and background gradient shifts. |
| `frontend/src/components/MedGuardFlowchart.css` | MODIFY | Redesigned for alternating flex layout, carousel text entrance/exit, chevron cues, and mobile fallback. |
| `frontend/index.html` | MODIFY | Integrated Google Fonts (Cinzel, Cormorant Garamond, Space Grotesk). |

