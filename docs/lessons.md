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
