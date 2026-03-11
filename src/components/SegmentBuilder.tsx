import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WorkoutSegment } from '../types';

interface SegmentBuilderProps {
  segments: WorkoutSegment[];
  onChange: (segments: WorkoutSegment[]) => void;
}

const UNITS: WorkoutSegment['unit'][] = ['km', 'm', 'min', 'sec'];
const INTENSITIES: WorkoutSegment['intensity'][] = ['easy', 'moderate', 'fast', 'sprint'];

function makeSimpleSegment(orderIndex: number): WorkoutSegment {
  return {
    order_index: orderIndex,
    segment_type: 'simple',
    repetitions: 1,
    value: 1,
    unit: 'km',
    intensity: 'easy',
    work_value: 0,
    work_unit: 'km',
    work_intensity: 'fast',
    rest_value: 0,
    rest_unit: 'km',
    rest_intensity: 'easy',
  };
}

function makeIntervalSegment(orderIndex: number): WorkoutSegment {
  return {
    order_index: orderIndex,
    segment_type: 'interval',
    repetitions: 3,
    value: 0,
    unit: 'km',
    intensity: 'easy',
    work_value: 1,
    work_unit: 'min',
    work_intensity: 'fast',
    rest_value: 1,
    rest_unit: 'min',
    rest_intensity: 'easy',
  };
}

export default function SegmentBuilder({ segments, onChange }: SegmentBuilderProps) {
  const { t } = useTranslation();
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<WorkoutSegment | null>(null);
  const [menuIndex, setMenuIndex] = useState<number | null>(null);

  function reindex(segs: WorkoutSegment[]): WorkoutSegment[] {
    return segs.map((s, i) => ({ ...s, order_index: i }));
  }

  function addSegment(type: 'simple' | 'interval') {
    const seg = type === 'simple'
      ? makeSimpleSegment(segments.length)
      : makeIntervalSegment(segments.length);
    const updated = reindex([...segments, seg]);
    onChange(updated);
    setEditDraft({ ...seg, order_index: updated.length - 1 });
    setEditIndex(updated.length - 1);
  }

  function removeSegment(index: number) {
    onChange(reindex(segments.filter((_, i) => i !== index)));
    setMenuIndex(null);
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const copy = [...segments];
    [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
    onChange(reindex(copy));
    setMenuIndex(null);
  }

  function moveDown(index: number) {
    if (index === segments.length - 1) return;
    const copy = [...segments];
    [copy[index], copy[index + 1]] = [copy[index + 1], copy[index]];
    onChange(reindex(copy));
    setMenuIndex(null);
  }

  function duplicate(index: number) {
    const copy = [...segments];
    const dup = { ...copy[index] };
    copy.splice(index + 1, 0, dup);
    onChange(reindex(copy));
    setMenuIndex(null);
  }

  function openEdit(index: number) {
    setEditDraft({ ...segments[index] });
    setEditIndex(index);
    setMenuIndex(null);
  }

  function saveEdit() {
    if (editIndex === null || !editDraft) return;
    onChange(segments.map((s, i) => (i === editIndex ? { ...editDraft, order_index: i } : s)));
    setEditIndex(null);
    setEditDraft(null);
  }

  function cancelEdit() {
    setEditIndex(null);
    setEditDraft(null);
  }

  function patchDraft(patch: Partial<WorkoutSegment>) {
    if (!editDraft) return;
    setEditDraft({ ...editDraft, ...patch });
  }

  function getUnitLabel(unit: string): string {
    return t(`unit_${unit}`);
  }

  function getIntensityLabel(intensity: string): string {
    return t(`intensity_${intensity}`);
  }

  function getSummary(seg: WorkoutSegment): string {
    if (seg.segment_type === 'simple') {
      return `${seg.value} ${getUnitLabel(seg.unit)} ${getIntensityLabel(seg.intensity).toLowerCase()}`;
    }
    const work = `${seg.work_value} ${getUnitLabel(seg.work_unit)} ${getIntensityLabel(seg.work_intensity).toLowerCase()}`;
    const rest = `${seg.rest_value} ${getUnitLabel(seg.rest_unit)} ${getIntensityLabel(seg.rest_intensity).toLowerCase()}`;
    return `${seg.repetitions} \u00d7 ${work} / ${rest}`;
  }

  return (
    <div className="segment-builder">
      <h3>{t('segment_structure')}</h3>

      <div className="segment-actions">
        <button type="button" onClick={() => addSegment('simple')}>
          + {t('segment_add_simple')}
        </button>
        <button type="button" onClick={() => addSegment('interval')}>
          + {t('segment_add_interval')}
        </button>
      </div>

      {segments.length === 0 ? (
        <p className="segment-empty-msg">{t('segment_empty')}</p>
      ) : (
        <table className="segment-table">
          <thead>
            <tr>
              <th>#</th>
              <th>{t('segment_col_reps')}</th>
              <th>{t('segment_col_exercise')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {segments.map((seg, index) => (
              <tr key={index} className={`segment-row segment-row-${seg.segment_type}`}>
                <td className="segment-order">{index + 1}</td>
                <td className="segment-reps">
                  {seg.segment_type === 'interval' ? seg.repetitions : '—'}
                </td>
                <td className="segment-exercise">{getSummary(seg)}</td>
                <td className="segment-actions-cell">
                  <div className="segment-menu-wrapper">
                    <button
                      type="button"
                      className="btn-icon segment-menu-trigger"
                      onClick={() => setMenuIndex(menuIndex === index ? null : index)}
                    >
                      ⋮
                    </button>
                    {menuIndex === index && (
                      <div className="segment-dropdown">
                        <button type="button" onClick={() => openEdit(index)}>
                          {t('edit')}
                        </button>
                        <button type="button" onClick={() => duplicate(index)}>
                          {t('segment_duplicate')}
                        </button>
                        {index > 0 && (
                          <button type="button" onClick={() => moveUp(index)}>
                            {t('segment_move_up')}
                          </button>
                        )}
                        {index < segments.length - 1 && (
                          <button type="button" onClick={() => moveDown(index)}>
                            {t('segment_move_down')}
                          </button>
                        )}
                        <button type="button" className="danger" onClick={() => removeSegment(index)}>
                          {t('delete')}
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

      {/* Edit modal */}
      {editIndex !== null && editDraft && (
        <div className="modal-overlay" onClick={cancelEdit}>
          <div className="modal segment-edit-modal" onClick={(e) => e.stopPropagation()}>
            <h3>
              {editDraft.segment_type === 'simple' ? t('segment_simple') : t('segment_interval')}
            </h3>

            {/* Type switcher */}
            <div className="form-group">
              <label>{t('segment_type_label')}</label>
              <div className="segment-type-toggle">
                <button
                  type="button"
                  className={`btn btn-sm ${editDraft.segment_type === 'simple' ? 'btn-primary' : ''}`}
                  onClick={() =>
                    patchDraft({
                      segment_type: 'simple',
                      repetitions: 1,
                      value: editDraft.work_value || 1,
                      unit: editDraft.work_unit || 'km',
                      intensity: editDraft.work_intensity || 'easy',
                    })
                  }
                >
                  {t('segment_simple')}
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${editDraft.segment_type === 'interval' ? 'btn-primary' : ''}`}
                  onClick={() =>
                    patchDraft({
                      segment_type: 'interval',
                      repetitions: editDraft.repetitions || 3,
                      work_value: editDraft.value || 1,
                      work_unit: editDraft.unit || 'min',
                      work_intensity: editDraft.intensity || 'fast',
                    })
                  }
                >
                  {t('segment_interval')}
                </button>
              </div>
            </div>

            {editDraft.segment_type === 'simple' ? (
              <>
                <div className="form-group">
                  <label>{t('segment_value')}</label>
                  <div className="segment-inline-fields">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={editDraft.value}
                      onChange={(e) => patchDraft({ value: Number(e.target.value) })}
                    />
                    <select
                      value={editDraft.unit}
                      onChange={(e) => patchDraft({ unit: e.target.value as WorkoutSegment['unit'] })}
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u}>{getUnitLabel(u)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>{t('segment_intensity_label')}</label>
                  <select
                    value={editDraft.intensity}
                    onChange={(e) =>
                      patchDraft({ intensity: e.target.value as WorkoutSegment['intensity'] })
                    }
                  >
                    {INTENSITIES.map((i) => (
                      <option key={i} value={i}>{getIntensityLabel(i)}</option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="form-group">
                  <label>{t('segment_repetitions')}</label>
                  <input
                    type="number"
                    min={1}
                    value={editDraft.repetitions}
                    onChange={(e) => patchDraft({ repetitions: Number(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label>{t('segment_work')}</label>
                  <div className="segment-inline-fields">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={editDraft.work_value}
                      onChange={(e) => patchDraft({ work_value: Number(e.target.value) })}
                    />
                    <select
                      value={editDraft.work_unit}
                      onChange={(e) =>
                        patchDraft({ work_unit: e.target.value as WorkoutSegment['unit'] })
                      }
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u}>{getUnitLabel(u)}</option>
                      ))}
                    </select>
                    <select
                      value={editDraft.work_intensity}
                      onChange={(e) =>
                        patchDraft({ work_intensity: e.target.value as WorkoutSegment['intensity'] })
                      }
                    >
                      {INTENSITIES.map((i) => (
                        <option key={i} value={i}>{getIntensityLabel(i)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>{t('segment_rest')}</label>
                  <div className="segment-inline-fields">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={editDraft.rest_value}
                      onChange={(e) => patchDraft({ rest_value: Number(e.target.value) })}
                    />
                    <select
                      value={editDraft.rest_unit}
                      onChange={(e) =>
                        patchDraft({ rest_unit: e.target.value as WorkoutSegment['unit'] })
                      }
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u}>{getUnitLabel(u)}</option>
                      ))}
                    </select>
                    <select
                      value={editDraft.rest_intensity}
                      onChange={(e) =>
                        patchDraft({ rest_intensity: e.target.value as WorkoutSegment['intensity'] })
                      }
                    >
                      {INTENSITIES.map((i) => (
                        <option key={i} value={i}>{getIntensityLabel(i)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            <div className="modal-actions">
              <button type="button" className="btn btn-sm" onClick={cancelEdit}>
                {t('cancel')}
              </button>
              <button type="button" className="btn btn-sm btn-primary" onClick={saveEdit}>
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
