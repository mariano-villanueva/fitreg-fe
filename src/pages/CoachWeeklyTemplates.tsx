import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useFeedback } from '../context/FeedbackContext';
import { listWeeklyTemplates, deleteWeeklyTemplate } from '../api/weeklyTemplates';
import WeeklyTemplateAssignModal from '../components/WeeklyTemplateAssignModal';
import type { WeeklyTemplate } from '../types';

export default function CoachWeeklyTemplates() {
  const { t } = useTranslation();
  const { showSuccess, showError } = useFeedback();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<WeeklyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [assigningTemplate, setAssigningTemplate] = useState<WeeklyTemplate | null>(null);

  useEffect(() => { loadTemplates(); }, []);

  async function loadTemplates() {
    setLoading(true);
    try {
      const res = await listWeeklyTemplates();
      setTemplates(res.data);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteWeeklyTemplate(id);
      showSuccess(t('weekly_template_deleted'));
      setConfirmDeleteId(null);
      loadTemplates();
    } catch {
      showError(t('error'));
    }
  }

  return (
    <div className="page">
      <div className="coach-section-header">
        <h1>{t('weekly_template_title')}</h1>
        <button className="btn btn-primary" onClick={() => navigate('/coach/weekly-templates/new')}>
          + {t('weekly_template_new')}
        </button>
      </div>

      {loading && <p>{t('loading')}</p>}

      {!loading && templates.length === 0 && (
        <p className="empty-hint">{t('weekly_template_empty')}</p>
      )}

      {!loading && templates.length > 0 && (
        <div className="template-list">
          {templates.map((tmpl) => (
            <div key={tmpl.id} className="template-card">
              <div className="template-card-header">
                <h3>{tmpl.name}</h3>
                <span className="day-modal-type-badge">
                  {t('weekly_template_days_count', { count: tmpl.day_count ?? 0 })}
                </span>
              </div>
              {tmpl.description && (
                <p className="template-card-desc">{tmpl.description}</p>
              )}
              <div className="template-card-actions">
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => navigate(`/coach/weekly-templates/${tmpl.id}/edit`)}
                >
                  {t('edit')}
                </button>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => setAssigningTemplate(tmpl)}
                >
                  {t('weekly_template_assign')}
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => setConfirmDeleteId(tmpl.id)}
                >
                  {t('delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDeleteId !== null && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('weekly_template_delete')}</h3>
            <p>{t('weekly_template_delete_confirm')}</p>
            <div className="form-actions">
              <button className="btn" onClick={() => setConfirmDeleteId(null)}>
                {t('cancel')}
              </button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDeleteId)}>
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {assigningTemplate && (
        <WeeklyTemplateAssignModal
          template={assigningTemplate}
          onClose={() => setAssigningTemplate(null)}
          onSuccess={() => {
            setAssigningTemplate(null);
            showSuccess(t('weekly_template_assigned'));
          }}
        />
      )}
    </div>
  );
}
