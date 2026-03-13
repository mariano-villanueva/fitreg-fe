# Admin Users Panel — Design Spec

**Goal:** Improve the admin user management page with server-side search, role filtering, sortable columns, pagination, and a cleaner UI.

**Architecture:** Extend the existing `GET /api/admin/users` endpoint with query params for search, role filter, sort, and pagination. The frontend `AdminUsers.tsx` is redesigned to use these params with debounced input, role pills, sortable headers, and pagination controls.

**Tech Stack:** Go stdlib HTTP (backend), React 19 + TypeScript (frontend), react-i18next, existing CSS patterns.

---

## Backend

### `GET /api/admin/users` — updated query params

| Param    | Values                                      | Default       |
|----------|---------------------------------------------|---------------|
| `search` | any string — LIKE on `name` OR `email`      | (none)        |
| `role`   | `athlete` \| `coach` \| `admin` \| (empty)  | all           |
| `sort`   | `name` \| `email` \| `created_at`           | `created_at`  |
| `order`  | `asc` \| `desc`                             | `desc`        |
| `page`   | integer ≥ 1                                 | `1`           |
| `limit`  | integer 1–100                               | `20`          |

**Role filter logic:**
- `athlete` → `WHERE is_coach = FALSE AND is_admin = FALSE` (exclusive: neither coach nor admin)
- `coach` → `WHERE is_coach = TRUE` (may include users who are also admins — this overlap is intentional)
- `admin` → `WHERE is_admin = TRUE` (may include users who are also coaches — this overlap is intentional)
- (empty) → no role filter

**Search logic:**
- `WHERE (name LIKE ? OR email LIKE ?)` with `%search%` pattern

**Avatar field:** The `SELECT` query must use `COALESCE(custom_avatar, avatar_url, '')` as `avatar_url`. Both `custom_avatar` and `avatar_url` are existing columns on the `users` table — `custom_avatar` (URL string) holds the user's uploaded image, `avatar_url` (URL string) holds the Google OAuth profile photo. The COALESCE returns the custom upload URL if set, falls back to the Google OAuth URL, and finally to empty string. The existing `ListUsers` handler already uses `custom_avatar` — confirmed present in the schema. The only change is adding the `avatar_url` fallback. The existing query only uses `custom_avatar`, which drops Google avatars — this must be fixed in the new query.

**Response shape** (replaces plain `[]AdminUser` array):
```json
{
  "users": [...AdminUser],
  "total": 84,
  "page": 1,
  "limit": 20
}
```

**Implementation pattern:** Build WHERE clauses and args slice dynamically (same approach as `ListInvitations` for the WHERE builder, but this handler adds a COUNT step that `ListInvitations` does not have). Steps:
1. Build `whereClause` string and `args` slice from the active filters
2. Run `SELECT COUNT(*) FROM users` + whereClause with the same `args` (no LIMIT/OFFSET) to get `total`
3. Append LIMIT and OFFSET to `args`, then run the paginated `SELECT ... ORDER BY <whitelisted col> <whitelisted dir> LIMIT ? OFFSET ?`

Sort column and order are whitelisted against known-safe values (`name`, `email`, `created_at` / `asc`, `desc`) before string interpolation.

**Edge case handling:**
- `limit` outside 1–100 range: silently clamp to 20. Note: `ListInvitations` clamps at `>50`, but this handler uses a 1–100 valid range — only the clamping mechanic is the same, not the boundary value
- `page` ≤ 0: treat as 1
- `page` exceeds available pages: return `users: []` with the correct `total` (not an error); the `page` field in the response echoes the requested value unchanged — the frontend manages page state independently and does not rely on the server to clamp it
- Unknown `role` value: treat as empty (no filter)

### No new endpoints, no schema changes.

---

## Frontend

### `src/api/admin.ts`

Update `listAdminUsers` signature:
```typescript
export const listAdminUsers = (params?: {
  search?: string;
  role?: 'athlete' | 'coach' | 'admin' | '';
  sort?: 'name' | 'email' | 'created_at';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}) => client.get<AdminUsersResponse>('/admin/users', { params });
```

### `src/types/index.ts`

Add `AdminUsersResponse` interface:
```typescript
export interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
}
```

`AdminUser` already has `avatar_url` and `created_at` — no changes needed.

**Breaking change note:** The existing `loadUsers()` call site uses `res.data` directly as an array (`setUsers(res.data)`). After this change, the call site must be updated to `res.data.users` and `setTotal(res.data.total)`. The `users` state type stays `AdminUser[]`.

### `src/pages/AdminUsers.tsx` — full redesign

**State:**
- `searchInput` string — controlled input value (raw, updates on every keystroke)
- `search` string — debounced value (what the fetch effect depends on)
- `role` filter: `'' | 'athlete' | 'coach' | 'admin'`
- `sort`: `'name' | 'email' | 'created_at'`
- `order`: `'asc' | 'desc'`
- `page`: number
- `total`: number (from response)
- `users`: AdminUser[]
- `loading`: boolean

**Debounce implementation:**
Use a second `useEffect` with `[searchInput]` as its dependency. Inside, set a `setTimeout` (300ms) that sets `search` to the current `searchInput` value, and clear it with `clearTimeout` on cleanup. Page reset to 1 happens inside this debounce callback (when `search` is updated), NOT on the raw keystroke — this avoids triggering an extra fetch with the old search value mid-debounce:

```tsx
useEffect(() => {
  const timer = setTimeout(() => {
    setSearch(searchInput);
    setPage(1);
  }, 300);
  return () => clearTimeout(timer);
}, [searchInput]);
```

**Fetch effect:** A separate `useEffect` depends on `[search, role, sort, order, page]` and calls `loadUsers()`.

**Other behavior:**
- Role filter: sets `role`, resets `page` to 1
- Sort click: if same column → toggle `order`; if new column → set `sort`, set `order` to `asc`, reset `page` to 1

**Layout (top to bottom):**
1. **Toolbar row:** search input (left) — no submit button, debounced
2. **Role pills row:** All | Athlete | Coach | Admin
   - Only the **active** pill shows a count badge using `total` from the current response (e.g., if `role='coach'` is active, the Coach pill shows "Coach (12)")
   - Inactive pills show their label only — no count, no separate requests
   - The "All" pill is active when `role === ''`; it shows the count too (e.g., "All (84)")
   - This means at most one pill shows a count at a time — no per-role count fetching needed
3. **Table:**
   - Columns: Avatar+Name | Email | Roles | Joined | Actions
   - Avatar+Name: `<Avatar>` component (32px) inline with name. Pass `src={u.avatar_url || undefined}` — while an empty string is falsy in JS and the Avatar fallback would technically work, the `src` prop is typed as `string | undefined`; passing `""` is inconsistent with the prop contract so convert empty strings to `undefined`
   - Roles: colored badge pills (`Coach`, `Admin`) — athletes show no badge
   - Joined: formatted date using `new Date(u.created_at).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })`
   - Sortable columns: Name, Email, Joined — clicking header toggles asc/desc, shows `↑` or `↓` indicator next to active sort column
   - Actions column: "Coach" toggle button and "Admin" toggle button (small, one per role). After a successful toggle, call `loadUsers()` with the current params (preserving the active search/filter/sort/page) — this keeps the user in context. If the toggled user no longer matches the active role filter, they will naturally disappear from the list on refresh.
4. **Pagination footer:** "Showing X–Y of Z users" text + Prev / Next buttons
   - `from = (page - 1) * LIMIT + 1`, `to = Math.min(page * LIMIT, total)`, `total` from response
   - Prev disabled when `page === 1`; Next disabled when `to >= total`
   - `LIMIT` is the constant `20`

**No modal, no new page** — all inline in `AdminUsers.tsx`.

### CSS additions (`App.css`)

New classes following existing patterns:
- `.admin-toolbar` — flex row, gap, align-center
- `.admin-search-input` — styled text input
- `.admin-role-pills` — flex row of pill buttons
- `.admin-role-pill`, `.admin-role-pill--active` — pill button styles
- `.admin-table th.sortable` — cursor pointer, with sort indicator
- `.admin-pagination` — flex row, justify-between, align-center
- `.admin-user-cell` — flex row with avatar + name

### i18n keys to add (es.ts + en.ts)

All values use react-i18next `{{variable}}` double-brace interpolation where applicable:

```
admin_search_placeholder      // "Buscar por nombre o email" / "Search by name or email"
admin_filter_all              // "Todos" / "All"
admin_filter_athlete          // "Atleta" / "Athlete"
admin_filter_coach            // "Entrenador" / "Coach"
admin_filter_admin            // "Admin"
admin_col_joined              // "Registro" / "Joined"
admin_col_roles               // "Roles"
admin_col_name                // "Nombre" / "Name" — new key for the Name column header (do NOT reuse profile_name, keep admin keys self-contained)
admin_col_actions             // "Acciones" / "Actions"
admin_showing                 // "Mostrando {{from}}–{{to}} de {{total}} usuarios" / "Showing {{from}}–{{to}} of {{total}} users"
admin_toggle_coach            // "Entrenador" / "Coach"
admin_toggle_admin            // "Admin"
```

---

## Constraints

- No schema migrations needed
- No new backend endpoints
- All role/sort/order values whitelisted before SQL interpolation (no injection risk)
- Debounce is purely frontend (300ms), no rate limiting needed
- `limit` hardcoded to `20` (constant) in UI — frontend always sends `limit=20` explicitly in every request (does not rely on the backend default, to ensure consistency if the default ever changes)
- Out-of-range `limit` clamped to 20 server-side; out-of-bounds `page` returns empty users array with correct total
- Sort/order state is client-only and is intentionally lost on page reload (acceptable for an admin tool — no need to persist or recover from the API response)
