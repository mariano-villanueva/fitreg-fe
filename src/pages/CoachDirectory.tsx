import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { listCoaches } from "../api/coaches";
import { useTranslation } from "react-i18next";
import type { CoachListItem } from "../types";

export default function CoachDirectory() {
  const { t } = useTranslation();
  const [coaches, setCoaches] = useState<CoachListItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCoaches(); }, []);

  async function loadCoaches() {
    setLoading(true);
    try {
      const res = await listCoaches(search || undefined);
      setCoaches(res.data);
    } catch { setCoaches([]); }
    finally { setLoading(false); }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    loadCoaches();
  }

  if (loading) return <div className="loading">{t('loading')}</div>;

  return (
    <div className="page">
      <h1>{t('coach_directory')}</h1>
      <form className="search-form" onSubmit={handleSearch}>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('coach_directory_search')} />
        <button type="submit" className="btn btn-primary btn-sm">{t('coach_directory_search')}</button>
      </form>
      {coaches.length === 0 ? (
        <p>{t('coach_directory_empty')}</p>
      ) : (
        <div className="coach-grid">
          {coaches.map((coach) => (
            <Link to={`/coaches/${coach.id}`} key={coach.id} className="coach-card">
              <img src={coach.avatar_url || ''} alt={coach.name} className="coach-card-avatar" />
              <h3>{coach.name}</h3>
              <p className="coach-card-description">{coach.coach_description?.slice(0, 100) || ''}</p>
              <div className="coach-card-stats">
                <span className="coach-card-rating">{coach.avg_rating.toFixed(1)} ({coach.rating_count} {t('rating_count')})</span>
                {coach.verified_achievements > 0 && (
                  <span className="coach-card-achievements">{coach.verified_achievements} {t('coach_directory_achievements')}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
