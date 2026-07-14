# MedGuard Lessons Learned

## Milestone 1

### What went well
- Skills directory provides structured agent expertise for each domain (Docker, React, FastAPI, etc.)
- Schema-first approach ensures all services agree on data contracts before writing code
- Mermaid diagrams in architecture docs make system flows immediately understandable

### What to watch for
- **Docker Compose networking**: The `backend` network is marked `internal: true` — this means ms1 must be on _both_ networks (frontend-net and backend) to bridge the gap
- **Append-only triggers**: The `prevent_mutation()` trigger will block migrations that try to UPDATE reference tables — always INSERT new versioned rows instead
- **JWT in localStorage**: Current approach stores JWT in localStorage for simplicity. For production, consider httpOnly cookies to prevent XSS token theft
- **CORS on ms2**: Currently allows all origins because it's internal-only. If ms2 is ever exposed, lock this down immediately

---

## Milestone 2 (Visual Polish & Layout State)

### What went well
- **Persistent Navbar State via React Router Layouts**: Moving `<MgNavbar />` into a persistent route wrapper (`Layout.jsx`) instead of instantiating it inside every single page component allows React to maintain navbar state across route changes. This enables smooth CSS transitions for the sliding tab indicator without unmount/remount glitches.
- **Strict Styling for Native Elements**: Buttons and anchors have browser-default appearances (rigid square borders, underlines) that can break modern designs. Explicit utility classes like `no-underline`, `border border-slate-200`, and `rounded-full` ensure clean design integration.

### What to watch for
- **Global Typography Specificity**: Global stylesheet overrides on generic tags (like `h2`) have high specificity and can easily break local Tailwind sizing classes (`text-xs`). Shift generic card subheadings to alternative tags (like `h4` or `div`) to allow local utility overrides to take effect.
- **In-Memory Seed Resetting**: Restarts of development servers (e.g. nodemon) reset transient mock database seeds. Direct routing checks need robust redirect fallback protections to handle session token expirations gracefully.
