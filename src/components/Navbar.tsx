import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import NotificationBadge from "./NotificationBadge";
import Sidebar from "./Sidebar";

export default function Navbar() {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <nav className="navbar">
        <div className="navbar-left">
          {isAuthenticated && (
            <button className="navbar-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Menu">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          )}
          <Link to="/" className="navbar-brand-link">{t('app_name')}</Link>
        </div>
        {isAuthenticated ? (
          <div className="navbar-right">
            <NotificationBadge />
          </div>
        ) : (
          <div className="navbar-right">
            <span className="navbar-tagline">{t('app_tagline')}</span>
          </div>
        )}
      </nav>
      {isAuthenticated && (
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      )}
    </>
  );
}
