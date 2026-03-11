import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getUnreadCount } from "../api/notifications";

const POLL_INTERVAL_MS = 30000;

export default function NotificationBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  async function fetchCount() {
    try {
      const res = await getUnreadCount();
      setCount(res.data.count);
    } catch {
      // Silently fail — badge is non-critical
    }
  }

  return (
    <Link to="/notifications" className="notification-badge">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {count > 0 && <span className="notification-count">{count > 99 ? '99+' : count}</span>}
    </Link>
  );
}
