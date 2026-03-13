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
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClickOutside() { setOpenMenu(null); }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Debounce: update search state + reset page after 300ms of no typing
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

  // Fetch on any filter/sort/page change
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
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>—</td>
              </tr>
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
                  <div className="admin-actions-menu" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn btn-sm admin-actions-trigger"
                      onClick={() => setOpenMenu(openMenu === u.id ? null : u.id)}
                    >
                      ···
                    </button>
                    {openMenu === u.id && (
                      <div className="admin-actions-dropdown">
                        <button
                          className={`admin-actions-item${u.is_coach ? ' admin-actions-item--danger' : ' admin-actions-item--add'}`}
                          onClick={() => { toggleRole(u.id, 'is_coach', u.is_coach); setOpenMenu(null); }}
                        >
                          {u.is_coach ? `− ${t('admin_toggle_coach')}` : `+ ${t('admin_toggle_coach')}`}
                        </button>
                        <button
                          className={`admin-actions-item${u.is_admin ? ' admin-actions-item--danger' : ' admin-actions-item--add'}`}
                          onClick={() => { toggleRole(u.id, 'is_admin', u.is_admin); setOpenMenu(null); }}
                        >
                          {u.is_admin ? `− ${t('admin_toggle_admin')}` : `+ ${t('admin_toggle_admin')}`}
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Pagination */}
      {total > 0 && (
        <div className="admin-pagination">
          <span>{t('admin_showing', { from, to, total })}</span>
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
