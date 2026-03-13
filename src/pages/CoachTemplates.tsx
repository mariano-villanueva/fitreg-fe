import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { listTemplates, createTemplate, updateTemplate, deleteTemplate } from "../api/templates";
import { useFeedback } from "../context/FeedbackContext";
import AssignWorkoutFields from "../components/AssignWorkoutFields";
import type { WorkoutTemplate } from "../types";

export default function CoachTemplates() {
  const { t } = useTranslation();
  const { showSuccess, showError } = useFeedback();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkoutTemplate | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  useEffect(() => { loadTemplates(); }, []);

  async function loadTemplates() {
    setLoading(true);
    try {
      const res = await listTemplates();
      setTemplates(res.data);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingTemplate(null);
    setShowModal(true);
  }

  function openEdit(tmpl: WorkoutTemplate) {
    setEditingTemplate(tmpl);
    setShowModal(true);
  }

  function closeModal() {
    setEditingTemplate(null);
    setShowModal(false);
  }

  async function handleSave(data?: Record<string, unknown>) {
    if (!data) return;
    const payload = data as unknown as {
      title: string; description: string; type: string;
      notes: string; expected_fields: string[]; segments: unknown[];
    };
    try {
      if (editingTemplate) {
        await updateTemplate(editingTemplate.id, payload);
        showSuccess(t('template_updated'));
      } else {
        await createTemplate(payload);
        showSuccess(t('template_created'));
      }
      closeModal();
      loadTemplates();
    } catch {
      showError(t('error'));
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteTemplate(id);
      showSuccess(t('template_deleted'));
      setConfirmDeleteId(null);
      loadTemplates();
    } catch {
      showError(t('error'));
    }
  }

  return (
    <div className="page">
      <div className="coach-section-header">
        <h1>{t('template_title')}</h1>
        <button className="btn btn-primary" onClick={openCreate}>+ {t('template_new')}</button>
      </div>

      {loading && <p>{t('loading')}</p>}

      {!loading && templates.length === 0 && (
        <p className="empty-hint">{t('template_empty')}</p>
      )}

      {!loading && templates.length > 0 && (
        <div className="template-list">
          {templates.map((tmpl) => (
            <div key={tmpl.id} className="template-card">
              <div className="template-card-header">
                <h3>{tmpl.title}</h3>
                <span className="day-modal-type-badge">{tmpl.type}</span>
              </div>
              {tmpl.description && (
                <p className="template-card-desc">{tmpl.description}</p>
              )}
              <div className="template-card-meta">
                {tmpl.segments && tmpl.segments.length > 0 && (
                  <span>{t('template_segments_count', { count: tmpl.segments.length })}</span>
                )}
              </div>
              <div className="template-card-actions">
                <button className="btn btn-sm btn-primary" onClick={() => openEdit(tmpl)}>{t('edit')}</button>
                <button className="btn btn-sm btn-danger" onClick={() => setConfirmDeleteId(tmpl.id)}>{t('delete')}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <h3>{editingTemplate ? t('template_edit') : t('template_new')}</h3>
            <AssignWorkoutFields
              mode="template"
              initialData={editingTemplate || undefined}
              onSave={handleSave}
              onCancel={closeModal}
            />
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDeleteId !== null && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{t('template_delete')}</h3>
            <p>{t('template_delete_confirm')}</p>
            <div className="form-actions">
              <button className="btn" onClick={() => setConfirmDeleteId(null)}>{t('cancel')}</button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDeleteId)}>{t('delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
