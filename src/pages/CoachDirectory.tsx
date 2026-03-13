import { useState } from "react";
import { Link } from "react-router-dom";
import { listCoaches } from "../api/coaches";
import { useTranslation } from "react-i18next";
import Avatar from "../components/Avatar";
import type { CoachListItem } from "../types";

const LIMIT = 12;

export default function CoachDirectory() {
  const { t } = useTranslation();
  const [coaches, setCoaches] = useState<CoachListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [locality, setLocality] = useState("");
  const [level, setLevel] = useState("");
  const [sort, setSort] = useState("rating");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const LEVEL_LABELS: Record<string, string> = {
    beginner: t('level_beginner'),
    intermediate: t('level_intermediate'),
    advanced: t('level_advanced'),
    competitive: t('level_competitive'),
  };

  async function loadCoaches(p: number) {
    setLoading(true);
    try {
      const res = await listCoaches({
        search: search || undefined,
        locality: locality || undefined,
        level: level || undefined,
        sort: sort || undefined,
        page: p,
        limit: LIMIT,
      });
      setCoaches(res.data.data);
      setTotal(res.data.total);
      setSearched(true);
    } catch {
      setCoaches([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    loadCoaches(1);
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    loadCoaches(newPage);
  }

  function handleClearFilters() {
    setSearch("");
    setLocality("");
    setLevel("");
    setSort("rating");
    setPage(1);
    setSearched(false);
    setCoaches([]);
    setTotal(0);
  }

  const totalPages = Math.ceil(total / LIMIT);

  function renderStars(rating: number) {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5;
    const stars = [];
    for (let i = 0; i < 5; i++) {
      if (i < full) stars.push(<span key={i} className="star star-full">&#9733;</span>);
      else if (i === full && half) stars.push(<span key={i} className="star star-half">&#9733;</span>);
      else stars.push(<span key={i} className="star star-empty">&#9734;</span>);
    }
    return stars;
  }

  return (
    <div className="page">
      <h1>{t('coach_directory')}</h1>

      <form className="coach-filters" onSubmit={handleSearch}>
        <div className="coach-filters-row">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('coach_directory_search')}
            className="coach-filter-input"
          />
          <input
            type="text"
            value={locality}
            onChange={(e) => setLocality(e.target.value)}
            placeholder={t('coach_filter_locality')}
            className="coach-filter-input"
          />
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="coach-filter-select"
          >
            <option value="">{t('coach_filter_level_all')}</option>
            <option value="beginner">{t('level_beginner')}</option>
            <option value="intermediate">{t('level_intermediate')}</option>
            <option value="advanced">{t('level_advanced')}</option>
            <option value="competitive">{t('level_competitive')}</option>
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="coach-filter-select"
          >
            <option value="rating">{t('coach_sort_rating')}</option>
            <option value="name">{t('coach_sort_name')}</option>
            <option value="newest">{t('coach_sort_newest')}</option>
            <option value="oldest">{t('coach_sort_oldest')}</option>
          </select>
        </div>
        <div className="coach-filters-actions">
          <button type="submit" className="btn btn-primary btn-sm">{t('coach_filter_search')}</button>
          {(search || locality || level || sort !== "rating") && (
            <button type="button" className="btn btn-sm" onClick={handleClearFilters}>{t('coach_filter_clear')}</button>
          )}
        </div>
      </form>

      {loading ? (
        <div className="loading">{t('loading')}</div>
      ) : !searched ? (
        <div className="empty-state">
          <p>{t('coach_directory_hint')}</p>
        </div>
      ) : coaches.length === 0 ? (
        <div className="empty-state">
          <p>{t('coach_directory_empty')}</p>
        </div>
      ) : (
        <>
          <div className="coach-list">
            {coaches.map((coach) => (
              <Link to={`/coaches/${coach.id}`} key={coach.id} className="coach-list-item">
                <Avatar src={coach.avatar_url} name={coach.name} size={44} className="coach-list-avatar" />
                <div className="coach-list-info">
                  <div className="coach-list-top">
                    <span className="coach-list-name">{coach.name}</span>
                    {coach.coach_level && coach.coach_level.split(',').map((lvl) => (
                      <span key={lvl} className={`coach-level-badge level-${lvl}`}>
                        {LEVEL_LABELS[lvl] || lvl}
                      </span>
                    ))}
                  </div>
                  {coach.coach_locality && (
                    <span className="coach-list-locality">{coach.coach_locality}</span>
                  )}
                  <p className="coach-list-description">
                    {coach.coach_description?.slice(0, 150) || t('coach_no_description')}
                    {coach.coach_description && coach.coach_description.length > 150 ? '...' : ''}
                  </p>
                </div>
                <div className="coach-list-meta">
                  <div className="coach-list-rating">
                    <span className="coach-card-stars">{renderStars(coach.avg_rating)}</span>
                    <span className="coach-list-rating-text">
                      {coach.avg_rating.toFixed(1)} ({coach.rating_count})
                    </span>
                  </div>
                  {coach.verified_achievements > 0 && (
                    <span className="coach-list-achievements">
                      {coach.verified_achievements} {t('coach_directory_achievements')}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button className="btn btn-sm" disabled={page <= 1} onClick={() => handlePageChange(page - 1)}>&laquo;</button>
              <span className="pagination-info">{page} / {totalPages}</span>
              <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => handlePageChange(page + 1)}>&raquo;</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
