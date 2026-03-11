import { useState, useEffect } from "react";
import { listAdminUsers, updateAdminUser } from "../api/admin";
import { useTranslation } from "react-i18next";
import { useFeedback } from "../context/FeedbackContext";
import type { AdminUser } from "../types";

export default function AdminUsers() {
  const { t } = useTranslation();
  const { showSuccess, showError } = useFeedback();
  const [users, setUsers] = useState<AdminUser[]>([]);

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    try { const res = await listAdminUsers(); setUsers(res.data); }
    catch { setUsers([]); }
  }

  async function toggleRole(userId: number, field: 'is_coach' | 'is_admin', currentValue: boolean) {
    try {
      await updateAdminUser(userId, { [field]: !currentValue });
      showSuccess(t('role_updated'));
      loadUsers();
    } catch { showError(t('error')); }
  }

  return (
    <div className="page">
      <h1>{t('admin_users')}</h1>
      <table className="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>{t('profile_name')}</th>
            <th>{t('profile_email')}</th>
            <th>{t('admin_role_coach')}</th>
            <th>{t('admin_role_admin')}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td><input type="checkbox" checked={u.is_coach} onChange={() => toggleRole(u.id, 'is_coach', u.is_coach)} /></td>
              <td><input type="checkbox" checked={u.is_admin} onChange={() => toggleRole(u.id, 'is_admin', u.is_admin)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
