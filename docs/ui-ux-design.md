# MedGuard Homepage — UI/UX Design Document

## 1. Scope

**In scope**: Public homepage at `/` — scroll-driven frame-sequence hero, editorial copy, static product sections, team section, and a quiet CTA.

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

### A. "Clinical Editorial" ✅ Recommended
Apple-level restraint. Premium health-tech confidence. Generous whitespace. Refined sans-serif typography. The frame sequence is the hero — design supports it, never competes. Monochrome palette with a single restrained teal accent.

### B. "Warm Caregiving"
Soft rounded forms, warm neutrals, friendly illustration style. Risk: looks like a wellness app, undermines the safety-critical positioning.

### C. "Data Dashboard"
Technical, data-forward, structured grids. Risk: alienates non-technical patients and caregivers. Feels like an internal tool, not a product landing page.

**Selected: Direction A — Clinical Editorial.**

---

## 5. Design Tokens

### Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--mg-ink` | `#0B1F33` | Primary text, headings |
| `--mg-muted` | `#5D6B78` | Secondary text, descriptions |
| `--mg-accent` | `#0F766E` | Links, CTAs, accent elements |
| `--mg-accent-hover` | `#0D6660` | Hover state for accent |
| `--mg-surface` | `#F4F8F8` | Alternating section background |
| `--mg-white` | `#FFFFFF` | Page background, canvas background |
| `--mg-border` | `#E2E8F0` | Subtle dividers |
| `--mg-scroll-track` | `#0F766E` | Scroll progress indicator |

### Typography
- **Font family**: `'Manrope', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`
- **Display**: 56px / 1.05 / -1.5px tracking (desktop), 36px / 1.1 / -1px (mobile)
- **Body large**: 20px / 1.6 (desktop), 18px / 1.6 (mobile)
- **Body**: 16px / 1.6
- **Caption**: 14px / 1.5
- **Weight range**: 400 (body), 500 (subheadings), 700 (display headings)

### Spacing Scale
`4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px, 96px, 128px`

### Grid
- Max content width: `1200px`
- Horizontal padding: `24px` (mobile), `48px` (tablet), `64px` (desktop)
- Section vertical spacing: `96px` (desktop), `64px` (mobile)

### Responsive Breakpoints
- Mobile: `375px`–`767px`
- Tablet: `768px`–`1023px`
- Desktop: `1024px`+
- Large desktop: `1440px`+

---

## 6. Animation Timeline & Copy Beats (286 Frames)

The hero is a full-viewport canvas playing 286 JPG frames driven by scroll position.

### Frame Narrative
| Frame Range | Visual Content | Scroll % |
|-------------|---------------|----------|
| 001–059 | Prescription sheet, static then beginning to dissolve | 0–22% |
| 060–129 | Prescription dissolves into rising binary digits | 23–48% |
| 130–201 | Binary streams reorganize into a forming neural network | 49–75% |
| 202–286 | Neural network fully formed and floating | 76–100% |

### Copy Overlays (Semantic DOM)
Each copy block fades in (first 10% of range), holds, then fades out (last 10%), with a subtle 20px vertical shift.

| Scroll % | Headline | Body |
|----------|----------|------|
| 0–22% | "Every prescription deserves a second look." | "MedGuard turns a prescription photo into a clearer medication-safety conversation." |
| 23–48% | "From paper to structured clarity." | "Details that are easy to miss become information you can carry between appointments." |
| 49–75% | "Connected signals. Safer next steps." | "Medications, changes, and caregiver context—kept together." |
| 76–100% | "Designed to help you prepare, not diagnose." | "Clearer information for more informed conversations with your clinician." + CTA |

---

## 7. Interaction Principles

- **No scroll hijacking.** Normal page scroll drives the frame sequence.
- **No parallax overload.** The frame sequence is the single dramatic element.
- **Subtle only.** Header state change, section reveals, button hover/focus — all low-distance, purposeful.
- **No autoplaying elements, cursor effects, or decorative motion competing with frames.**
- **Loader**: percentage + thin progress line, clean reveal. No spinner clutter.

---

## 8. Accessibility

- `prefers-reduced-motion`: static final neural-network frame, skip pinned scrollytelling, normal document flow
- "Skip animation" link at top of hero
- Canvas: `aria-hidden="true"`, `role="img"`
- All copy is semantic HTML (not canvas text)
- One `<h1>`, sensible heading hierarchy
- Semantic landmarks: `<header>`, `<main>`, `<section>`, `<footer>`
- Keyboard-visible focus states on all interactive elements
- Large touch targets (minimum 44×44px)
- Contrast validated: `#0B1F33` on `#FFFFFF` = 15.7:1, `#5D6B78` on `#FFFFFF` = 5.1:1
- Color never used as the sole way to communicate meaning

---

## 9. Performance & Fallback

- First frame loaded immediately, remaining queued with limited concurrency (4 parallel)
- Accurate loading progress shown before animation starts
- Nearest loaded frame shown if a frame is briefly unavailable
- High-DPI canvas capped at `devicePixelRatio` of 2
- `ResizeObserver` for responsive canvas sizing
- `requestAnimationFrame` draws only when frame changes
- Non-canvas fallback message if assets fail
- Frame paths use `import.meta.env.BASE_URL` for deployment flexibility

---

## 10. Files Changed

| File | Action |
|------|--------|
| `docs/ui-ux-design.md` | NEW |
| `frontend/public/medguard-sequence/*.jpg` | NEW (286 extracted frames) |
| `frontend/src/pages/Home.jsx` | NEW |
| `frontend/src/pages/Home.css` | NEW |
| `frontend/src/components/MedGuardScrollScene.jsx` | NEW |
| `frontend/src/data/medguardFrames.js` | NEW |
| `frontend/src/lib/utils.js` | NEW (shadcn cn helper) |
| `frontend/src/components/ui/button.jsx` | NEW (shadcn) |
| `frontend/src/components/ui/card.jsx` | NEW (shadcn) |
| `frontend/src/components/ui/badge.jsx` | NEW (shadcn) |
| `frontend/src/components/ui/separator.jsx` | NEW (shadcn) |
| `frontend/src/App.jsx` | MODIFY (route change) |
| `frontend/index.html` | MODIFY (title, meta, font) |
| `frontend/src/index.css` | MODIFY (root scoping) |
| `frontend/vite.config.js` | MODIFY (Tailwind plugin + alias) |
| `frontend/components.json` | NEW (shadcn config) |
| `frontend/.gitignore` | MODIFY |
| `frontend/package.json` | MODIFY (new deps) |
