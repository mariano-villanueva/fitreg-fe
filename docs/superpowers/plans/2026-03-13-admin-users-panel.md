# Admin Users Panel Improvement — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-side search, role filtering, sortable columns, and pagination to the admin user management page, with a redesigned UI showing avatars, role badges, and join dates.

**Architecture:** Extend `GET /api/admin/users` with query params (search, role, sort, order, page, limit); rewrite `AdminUsers.tsx` to consume them with debounced input, role pills, sortable column headers, and a pagination footer.

**Tech Stack:** Go stdlib HTTP (backend), React 19 + TypeScript + react-i18next (frontend), existing CSS variables.

---

## File Map

| File | Change |
|------|--------|
| `FitRegAPI/handlers/admin_handler.go` | Modify `ListUsers` — add query params, dynamic WHERE, COUNT query, paginated response |
| `FitRegFE/src/types/index.ts` | Add `AdminUsersResponse` interface |
| `FitRegFE/src/api/admin.ts` | Update `listAdminUsers` signature + return type |
| `FitRegFE/src/i18n/es.ts` | Add 12 new i18n keys |
| `FitRegFE/src/i18n/en.ts` | Add 12 new i18n keys |
| `FitRegFE/src/App.css` | Add CSS classes for toolbar, pills, sortable headers, pagination, user cell |
| `FitRegFE/src/pages/AdminUsers.tsx` | Full redesign with all new state, effects, and layout |

---

## ## Chunk 1: Backend — Update ListUsers handler

### Task 1: Update `GET /api/admin/users` in `admin_handler.go`

**Files:**
- Modify: `~/Desktop/FitReg/FitRegAPI/handlers/admin_handler.go` (lines 57–97)

**Context:**
The existing `ListUsers` method runs a plain `SELECT` with no filters and returns `[]AdminUser`. We need to replace it with a version that:
1. Reads query params: `search`, `role`, `sort`, `order`, `page`, `limit`
2. Builds a dynamic WHERE clause
3. Runs a COUNT query with the same filters
4. Runs the paginated SELECT
5. Returns `{ users, total, page, limit }`

The `ListInvitations` handler in `invitation_handler.go` shows the pattern for building dynamic WHERE clauses and using `LIMIT ? OFFSET ?`.

- [ ] **Step 1: Replace the `ListUsers` method body**

Open `~/Desktop/FitReg/FitRegAPI/handlers/admin_handler.go` and replace the entire `ListUsers` method (from `func (h *AdminHandler) ListUsers` to its closing `}`) with:

```go
func (h *AdminHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserIDFromContext(r.Context())
	if !h.requireAdmin(userID) {
		writeError(w, http.StatusForbidden, "Admin access required")
		return
	}

	// Parse query params
	search := r.URL.Query().Get("search")
	role := r.URL.Query().Get("role")
	sortCol := r.URL.Query().Get("sort")
	sortOrder := r.URL.Query().Get("order")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

	// Defaults and clamping
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	// Whitelist sort column
	allowedSort := map[string]string{
		"name":       "name",
		"email":      "email",
		"created_at": "created_at",
	}
	if _, ok := allowedSort[sortCol]; !ok {
		sortCol = "created_at"
	}
	if sortOrder != "asc" && sortOrder != "desc" {
		sortOrder = "desc"
	}

	// Build dynamic WHERE
	where := "WHERE 1=1"
	args := []interface{}{}

	if search != "" {
		where += " AND (name LIKE ? OR email LIKE ?)"
		pattern := "%" + search + "%"
		args = append(args, pattern, pattern)
	}

	switch role {
	case "athlete":
		where += " AND COALESCE(is_coach, FALSE) = FALSE AND COALESCE(is_admin, FALSE) = FALSE"
	case "coach":
		where += " AND COALESCE(is_coach, FALSE) = TRUE"
	case "admin":
		where += " AND COALESCE(is_admin, FALSE) = TRUE"
	}

	// Count total matching users
	var total int
	countArgs := make([]interface{}, len(args))
	copy(countArgs, args)
	if err := h.DB.QueryRow("SELECT COUNT(*) FROM users "+where, countArgs...).Scan(&total); err != nil {
		logErr("count admin users", err)
		writeError(w, http.StatusInternalServerError, "Failed to count users")
		return
	}

	// Paginated SELECT
	offset := (page - 1) * limit
	args = append(args, limit, offset)
	query := `
		SELECT id, email, COALESCE(name, '') as name,
			COALESCE(custom_avatar, avatar_url, '') as avatar_url,
			COALESCE(is_coach, FALSE), COALESCE(is_admin, FALSE), created_at
		FROM users ` + where + ` ORDER BY ` + sortCol + ` ` + sortOrder + ` LIMIT ? OFFSET ?`

	rows, err := h.DB.Query(query, args...)
	if err != nil {
		logErr("list admin users", err)
		writeError(w, http.StatusInternalServerError, "Failed to fetch users")
		return
	}
	defer rows.Close()

	type AdminUser struct {
		ID        int64  `json:"id"`
		Email     string `json:"email"`
		Name      string `json:"name"`
		AvatarURL string `json:"avatar_url"`
		IsCoach   bool   `json:"is_coach"`
		IsAdmin   bool   `json:"is_admin"`
		CreatedAt string `json:"created_at"`
	}

	users := []AdminUser{}
	for rows.Next() {
		var u AdminUser
		if err := rows.Scan(&u.ID, &u.Email, &u.Name, &u.AvatarURL,
			&u.IsCoach, &u.IsAdmin, &u.CreatedAt); err != nil {
			logErr("scan admin user row", err)
			continue
		}
		users = append(users, u)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"users": users,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}
```

- [ ] **Step 2: Add `"strconv"` to imports if not already present**

The existing imports in `admin_handler.go` are:
```go
import (
    "database/sql"
    "encoding/json"
    "log"
    "net/http"
    "strings"
    ...
)
```

Add `"strconv"` to the import block.

- [ ] **Step 3: Verify the backend compiles**

```bash
cd ~/Desktop/FitReg/FitRegAPI
go build ./...
```
Expected: no errors.

- [ ] **Step 4: Restart backend and test the endpoint manually**

```bash
# Kill existing backend
lsof -i :8080 -t | xargs kill -9 2>/dev/null; sleep 1

# Start backend
cd ~/Desktop/FitReg/FitRegAPI
export $(cat .env | xargs)
go run main.go &

# Test basic (replace TOKEN with a real admin JWT)
curl -s -H "Authorization: Bearer TOKEN" \
  "http://localhost:8080/api/admin/users?page=1&limit=5" | python3 -m json.tool
```
Expected: JSON with `{ "users": [...], "total": N, "page": 1, "limit": 5 }`.

```bash
# Test search
curl -s -H "Authorization: Bearer TOKEN" \
  "http://localhost:8080/api/admin/users?search=mar&limit=5" | python3 -m json.tool

# Test role filter
curl -s -H "Authorization: Bearer TOKEN" \
  "http://localhost:8080/api/admin/users?role=coach" | python3 -m json.tool

# Test sort
curl -s -H "Authorization: Bearer TOKEN" \
  "http://localhost:8080/api/admin/users?sort=name&order=asc" | python3 -m json.tool
```

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/FitReg/FitRegAPI
git add handlers/admin_handler.go
git commit -m "feat: add search, filter, sort, pagination to admin users endpoint"
```

---

## ## Chunk 2: Frontend — Types, API, i18n, CSS

### Task 2: Update types, API function, i18n keys, and CSS

**Files:**
- Modify: `~/Desktop/FitReg/FitRegFE/src/types/index.ts` (after line 175, after `AdminUser`)
- Modify: `~/Desktop/FitReg/FitRegFE/src/api/admin.ts`
- Modify: `~/Desktop/FitReg/FitRegFE/src/i18n/es.ts`
- Modify: `~/Desktop/FitReg/FitRegFE/src/i18n/en.ts`
- Modify: `~/Desktop/FitReg/FitRegFE/src/App.css`

**Context:**
- `AdminUser` interface is at line 167–175 in `types/index.ts` — no changes needed to it
- `admin.ts` currently exports `listAdminUsers` with no params, returning `AdminUser[]` — needs new signature and `AdminUsersResponse` return type
- i18n files use object literal syntax: `key: 'value'` inside a big object
- CSS uses `var(--accent)`, `var(--bg-card)`, `var(--border)`, `var(--radius)`, `var(--text-primary)`, `var(--text-secondary)` for theming

- [ ] **Step 1: Add `AdminUsersResponse` to `types/index.ts`**

After the `AdminUser` interface (after line 175), add:

```typescript
export interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
}
```

- [ ] **Step 2: Update `src/api/admin.ts`**

Replace the `listAdminUsers` line:
```typescript
export const listAdminUsers = () => client.get<AdminUser[]>('/admin/users');
```
With:
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

Also add `AdminUsersResponse` to the import at the top:
```typescript
import type { AdminUser, AdminStats, PendingAchievement, AdminUsersResponse } from '../types';
```

- [ ] **Step 3: Add i18n keys to `src/i18n/es.ts`**

Find the block of existing `admin_` keys (around line 283–298) and add the new keys after the last admin key:

```typescript
    admin_search_placeholder: 'Buscar por nombre o email',
    admin_filter_all: 'Todos',
    admin_filter_athlete: 'Atleta',
    admin_filter_coach: 'Entrenador',
    admin_filter_admin: 'Admin',
    admin_col_name: 'Nombre',
    admin_col_joined: 'Registro',
    admin_col_roles: 'Roles',
    admin_col_actions: 'Acciones',
    admin_showing: 'Mostrando {{from}}–{{to}} de {{total}} usuarios',
    admin_toggle_coach: 'Entrenador',
    admin_toggle_admin: 'Admin',
```

- [ ] **Step 4: Add i18n keys to `src/i18n/en.ts`**

Find the same block in `en.ts` and add:

```typescript
    admin_search_placeholder: 'Search by name or email',
    admin_filter_all: 'All',
    admin_filter_athlete: 'Athlete',
    admin_filter_coach: 'Coach',
    admin_filter_admin: 'Admin',
    admin_col_name: 'Name',
    admin_col_joined: 'Joined',
    admin_col_roles: 'Roles',
    admin_col_actions: 'Actions',
    admin_showing: 'Showing {{from}}–{{to}} of {{total}} users',
    admin_toggle_coach: 'Coach',
    admin_toggle_admin: 'Admin',
```

- [ ] **Step 5: Add CSS classes to `src/App.css`**

Append at the end of the file (before the closing of any `@media` blocks, or simply at the very end):

```css
/* ---- Admin Users Panel ---- */
.admin-toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.admin-search-input {
  flex: 1;
  max-width: 320px;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 0.9rem;
}

.admin-search-input:focus {
  outline: none;
  border-color: var(--accent);
}

.admin-role-pills {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.admin-role-pill {
  padding: 0.35rem 0.85rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s;
}

.admin-role-pill:hover {
  border-color: var(--accent);
  color: var(--text-primary);
}

.admin-role-pill--active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--bg-primary);
  font-weight: 600;
}

.admin-table th.sortable {
  cursor: pointer;
  user-select: none;
}

.admin-table th.sortable:hover {
  color: var(--accent);
}

.admin-sort-indicator {
  margin-left: 0.25rem;
  font-size: 0.75rem;
}

.admin-user-cell {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.admin-user-cell .user-name {
  font-weight: 500;
}

.admin-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 1.25rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.admin-pagination-controls {
  display: flex;
  gap: 0.5rem;
}

.badge-admin {
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
  border: 1px solid rgba(99, 102, 241, 0.3);
}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd ~/Desktop/FitReg/FitRegFE
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd ~/Desktop/FitReg/FitRegFE
git add src/types/index.ts src/api/admin.ts src/i18n/es.ts src/i18n/en.ts src/App.css
git commit -m "feat: add AdminUsersResponse type, update API, add i18n keys and CSS for admin panel"
```

---

## ## Chunk 3: Frontend — AdminUsers.tsx redesign

### Task 3: Rewrite `AdminUsers.tsx`

**Files:**
- Modify: `~/Desktop/FitReg/FitRegFE/src/pages/AdminUsers.tsx`

**Context:**
The current file is 54 lines — a plain table with ID, name, email, checkbox role toggles, no styling or filters. We replace it entirely. The `Avatar` component is imported from `../components/Avatar` and takes `src?: string`, `name: string`, `size?: number`. The `useFeedback` hook provides `showSuccess` and `showError`. The `useTranslation` hook provides `t()`.

The `LIMIT` constant is `20` — sent explicitly in every API call so the frontend and backend stay in sync.

- [ ] **Step 1: Replace `AdminUsers.tsx` with the full redesigned component**

```tsx
import { useState, useEffect, useRef } from "react";
import { listAdminUsers, updateAdminUser } from "../api/admin";
import { useTranslation } from "react-i18next";
import { useFeedback } from "../context/FeedbackContext";
import Avatar from "../components/Avatar";
import type { AdminUser } from "../types";

const LIMIT = 20;

type RoleFilter = '' | 'athlete' | 'coach' | 'admin';
type SortCol = 'name' | 'email' | 'created_at';
type SortOrder = 'asc' | 'desc';

export default function AdminUsers() {
  const { t } = useTranslation();
  const { showSuccess, showError } = useFeedback();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<RoleFilter>('');
  const [sort, setSort] = useState<SortCol>('created_at');
  const [order, setOrder] = useState<SortOrder>('desc');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input → search state + reset page
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  // Fetch whenever search/role/sort/order/page changes
  useEffect(() => {
    loadUsers();
  }, [search, role, sort, order, page]);

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await listAdminUsers({ search, role, sort, order, page, limit: LIMIT });
      setUsers(res.data.users);
      setTotal(res.data.total);
    } catch {
      showError(t('error'));
    } finally {
      setLoading(false);
    }
  }

  async function toggleRole(userId: number, field: 'is_coach' | 'is_admin', currentValue: boolean) {
    try {
      await updateAdminUser(userId, { [field]: !currentValue });
      showSuccess(t('role_updated'));
      loadUsers();
    } catch {
      showError(t('error'));
    }
  }

  function handleRoleFilter(r: RoleFilter) {
    setRole(r);
    setPage(1);
  }

  function handleSort(col: SortCol) {
    if (col === sort) {
      setOrder(o => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(col);
      setOrder('asc');
    }
    setPage(1);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString([], {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }

  const from = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const to = Math.min(page * LIMIT, total);

  const roles: { value: RoleFilter; labelKey: string }[] = [
    { value: '', labelKey: 'admin_filter_all' },
    { value: 'athlete', labelKey: 'admin_filter_athlete' },
    { value: 'coach', labelKey: 'admin_filter_coach' },
    { value: 'admin', labelKey: 'admin_filter_admin' },
  ];

  function sortIndicator(col: SortCol) {
    if (sort !== col) return null;
    return <span className="admin-sort-indicator">{order === 'asc' ? '↑' : '↓'}</span>;
  }

  return (
    <div className="page">
      <h1>{t('admin_users')}</h1>

      {/* Search toolbar */}
      <div className="admin-toolbar">
        <input
          className="admin-search-input"
          type="text"
          placeholder={t('admin_search_placeholder')}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      {/* Role filter pills */}
      <div className="admin-role-pills">
        {roles.map(({ value, labelKey }) => {
          const isActive = role === value;
          const label = t(labelKey);
          return (
            <button
              key={value}
              className={`admin-role-pill${isActive ? ' admin-role-pill--active' : ''}`}
              onClick={() => handleRoleFilter(value)}
            >
              {isActive ? `${label} (${total})` : label}
            </button>
          );
        })}
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading">{t('loading')}</div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th className="sortable" onClick={() => handleSort('name')}>
                {t('admin_col_name')}{sortIndicator('name')}
              </th>
              <th className="sortable" onClick={() => handleSort('email')}>
                {t('profile_email')}{sortIndicator('email')}
              </th>
              <th>{t('admin_col_roles')}</th>
              <th className="sortable" onClick={() => handleSort('created_at')}>
                {t('admin_col_joined')}{sortIndicator('created_at')}
              </th>
              <th>{t('admin_col_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>—</td></tr>
            ) : users.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="admin-user-cell">
                    <Avatar src={u.avatar_url || undefined} name={u.name} size={32} />
                    <span className="user-name">{u.name || '—'}</span>
                  </div>
                </td>
                <td>{u.email}</td>
                <td>
                  {u.is_coach && <span className="badge badge-verified" style={{ marginRight: '0.35rem' }}>{t('admin_toggle_coach')}</span>}
                  {u.is_admin && <span className="badge badge-admin">{t('admin_toggle_admin')}</span>}
                </td>
                <td>{formatDate(u.created_at)}</td>
                <td>
                  <button
                    className={`btn btn-sm${u.is_coach ? ' btn-danger' : ''}`}
                    onClick={() => toggleRole(u.id, 'is_coach', u.is_coach)}
                    title={t('admin_toggle_coach')}
                  >
                    {u.is_coach ? '−' : '+'} {t('admin_toggle_coach')}
                  </button>{' '}
                  <button
                    className={`btn btn-sm${u.is_admin ? ' btn-danger' : ''}`}
                    onClick={() => toggleRole(u.id, 'is_admin', u.is_admin)}
                    title={t('admin_toggle_admin')}
                  >
                    {u.is_admin ? '−' : '+'} {t('admin_toggle_admin')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Pagination */}
      {total > 0 && (
        <div className="admin-pagination">
          <span>
            {t('admin_showing', { from, to, total })}
          </span>
          <div className="admin-pagination-controls">
            <button
              className="btn btn-sm"
              onClick={() => setPage(p => p - 1)}
              disabled={page === 1}
            >
              ← Prev
            </button>
            <button
              className="btn btn-sm"
              onClick={() => setPage(p => p + 1)}
              disabled={to >= total}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd ~/Desktop/FitReg/FitRegFE
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Start frontend and smoke-test in browser**

```bash
cd ~/Desktop/FitReg/FitRegFE
npm run dev
```

Navigate to `http://localhost:5173` → log in as admin → go to Admin → Users.

Check:
- [ ] Table renders users with avatars (or initials fallback) and names
- [ ] Role pills appear; clicking one re-fetches with that filter
- [ ] Active pill shows count badge (e.g. "Todos (12)")
- [ ] Search input filters users after 300ms debounce
- [ ] Clicking "Nombre" column header sorts ascending, clicking again sorts descending with `↑`/`↓` indicator
- [ ] Pagination shows "Mostrando 1–20 de X usuarios" and Prev/Next work
- [ ] Toggle Coach/Admin buttons update roles and list refreshes

- [ ] **Step 4: Commit**

```bash
cd ~/Desktop/FitReg/FitRegFE
git add src/pages/AdminUsers.tsx
git commit -m "feat: redesign admin users page with search, filter, sort, pagination and avatars"
```
