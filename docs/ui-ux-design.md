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

The "How MedGuard helps" section features a scroll-scrubbed vertical winding path timeline with 5 dedicated step sections:

### Layout
- Each step occupies a fixed-height section (500px). Nodes and text cards are **top-anchored** at the same height, not centered.
- Sides strictly alternate per step:
  - **Step 1 (Photograph)**: Node top-left, text top-right
  - **Step 2 (Structure)**: Node top-right, text top-left
  - **Step 3 (Translate)**: Node top-left, text top-right
  - **Step 4 (Analyze)**: Node top-right, text top-left
  - **Step 5 (Prepare)**: Node top-left, text top-right

### Connecting Paths
- Between each step, a large dramatic sweeping S-curve (cubic bezier) fills most of the vertical space, crossing from one side to the other.
- A continuation chevron cue animates near the bottom of each segment to hint the path continues.

### Segment-Based Marker & Trail
- No continuous marker scrub across the full path length. Each step's segment tracks its own local `scrollYProgress`.
- A small traveling marker dot flourishes along the active segment only, hidden when near a node (< 5% or > 95% progress).
- When the marker "arrives" at a node, the node itself switches to its active visual state (filled accent ring, pulse glow) instead of rendering a floating dot on top of the icon.
- Once a segment's scroll progress crosses 90%, it is permanently marked as "traveled" in React state — the colored trail stays filled even during slight reverse scrolls.

### Text Entrance
- Each step's text card enters with a **fast carousel slide-up** animation (from +40px below) as the user scrolls into the step's range.
- Scrolling past the step's range exits the card with a quick slide-up-and-out (to -40px above). Only one card is visible at any time.

### Background Gradient
- The parent container's scroll progress drives a smooth radial gradient color shift between light teal (`#e6f2f2`, `#f4fbfb`) and pure white (`#ffffff`), staying within the light medical theme at all points.

### Mobile Fallback
- Below `768px` screen widths, the SVG paths and markers are hidden. All five step cards render in a clean vertical list with full opacity and no scroll-driven animations.

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

