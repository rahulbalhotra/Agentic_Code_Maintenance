# Facebook Clone Workspace

## Codebase Audit Baseline

An audit of the repository baseline confirms the existing architectural components and engineering guidelines:

- **Navigation Header**: Top navigation containing search input, central navigation tabs (Home, Watch, Marketplace, Groups), theme toggle control, and profile user menu. Responsive layouts adapt at `768px` breakpoints.
- **Theme Toggle Engine**: Supports dynamic light/dark theme switching by setting the `data-theme` attribute on `document.documentElement` (`light` vs `dark`) and persisting preferences in `localStorage` with standard design token CSS variables.
- **Toast Notification Helper**: `window.showToast(message)` helper provides auto-dismissing feedback messages for user interactions.
- **Threaded Comments & Share Handler**: Renders nested comment trees up to `MAX_COMMENT_DEPTH = 3`. Dynamically rendered content uses `escapeHTML()` sanitization to guard against XSS vulnerabilities.

---

## REJECTED_NEEDS_INFO Protocol Standards

When a ticket is submitted with ambiguous, incomplete, or missing specifications (such as `FB-NEW`), the system enforces the `REJECTED_NEEDS_INFO` protocol.

### Ticket Validation Thresholds

- **Title & Description**: A ticket must contain an explicit title, clear scope description, and concrete target components.
- **Acceptance Criteria**: Functional and design requirements must be defined prior to code implementation.
- **Execution Halt**: If triage determines a ticket lacks necessary specifications (`REJECTED_MISSING_INFO` or `REJECTED_NEEDS_INFO`), code generation is blocked until actionable requirements are provided.

### Ticket Status: FB-NEW

- **Status**: Execution Halted (`REJECTED_MISSING_INFO`)
- **Reason**: Ticket `FB-NEW` was submitted without a title, description, or acceptance criteria.
- **Action Required**: The ticket reporter/owner must update `FB-NEW` with feature scope, target components, and acceptance criteria before triage and engineering execution can resume.
