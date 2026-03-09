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

  function reindex(segs: WorkoutSegment[]): WorkoutSegment[] {
    return segs.map((s, i) => ({ ...s, order_index: i }));
  }

  function addSimple() {
    onChange(reindex([...segments, makeSimpleSegment(segments.length)]));
  }

  function addInterval() {
    onChange(reindex([...segments, makeIntervalSegment(segments.length)]));
  }

  function removeSegment(index: number) {
    onChange(reindex(segments.filter((_, i) => i !== index)));
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const copy = [...segments];
    [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
    onChange(reindex(copy));
  }

  function moveDown(index: number) {
    if (index === segments.length - 1) return;
    const copy = [...segments];
    [copy[index], copy[index + 1]] = [copy[index + 1], copy[index]];
    onChange(reindex(copy));
  }

  function updateSegment(index: number, patch: Partial<WorkoutSegment>) {
    onChange(segments.map((s, i) => (i === index ? { ...s, ...patch } : s)));
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

      {segments.length === 0 && (
        <p style={{ color: '#888', fontStyle: 'italic', margin: '0.5rem 0' }}>
          {t('segment_empty')}
        </p>
      )}

      <div className="segment-list">
        {segments.map((seg, index) => (
          <div key={index} className={`segment-card ${seg.segment_type}`}>
            <div className="segment-header">
              <span className="segment-type-label">
                {seg.segment_type === 'simple' ? t('segment_simple') : t('segment_interval')}
              </span>
              <div className="segment-controls">
                <button type="button" onClick={() => moveUp(index)} disabled={index === 0}>
                  &#9650;
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(index)}
                  disabled={index === segments.length - 1}
                >
                  &#9660;
                </button>
                <button type="button" className="delete" onClick={() => removeSegment(index)}>
                  &#10005;
                </button>
              </div>
            </div>

            {seg.segment_type === 'simple' ? (
              <div className="segment-fields">
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={seg.value}
                  onChange={(e) => updateSegment(index, { value: Number(e.target.value) })}
                />
                <select
                  value={seg.unit}
                  onChange={(e) =>
                    updateSegment(index, { unit: e.target.value as WorkoutSegment['unit'] })
                  }
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {getUnitLabel(u)}
                    </option>
                  ))}
                </select>
                <select
                  value={seg.intensity}
                  onChange={(e) =>
                    updateSegment(index, {
                      intensity: e.target.value as WorkoutSegment['intensity'],
                    })
                  }
                >
                  {INTENSITIES.map((i) => (
                    <option key={i} value={i}>
                      {getIntensityLabel(i)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="interval-row">
                <div className="segment-fields">
                  <input
                    type="number"
                    min={1}
                    value={seg.repetitions}
                    onChange={(e) =>
                      updateSegment(index, { repetitions: Number(e.target.value) })
                    }
                  />
                  <span className="segment-separator">x</span>
                </div>
                <div className="interval-section">
                  <span className="interval-label">{t('segment_work')}</span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={seg.work_value}
                    onChange={(e) =>
                      updateSegment(index, { work_value: Number(e.target.value) })
                    }
                  />
                  <select
                    value={seg.work_unit}
                    onChange={(e) =>
                      updateSegment(index, {
                        work_unit: e.target.value as WorkoutSegment['unit'],
                      })
                    }
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {getUnitLabel(u)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={seg.work_intensity}
                    onChange={(e) =>
                      updateSegment(index, {
                        work_intensity: e.target.value as WorkoutSegment['intensity'],
                      })
                    }
                  >
                    {INTENSITIES.map((i) => (
                      <option key={i} value={i}>
                        {getIntensityLabel(i)}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="segment-separator">/</span>
                <div className="interval-section">
                  <span className="interval-label">{t('segment_rest')}</span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={seg.rest_value}
                    onChange={(e) =>
                      updateSegment(index, { rest_value: Number(e.target.value) })
                    }
                  />
                  <select
                    value={seg.rest_unit}
                    onChange={(e) =>
                      updateSegment(index, {
                        rest_unit: e.target.value as WorkoutSegment['unit'],
                      })
                    }
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {getUnitLabel(u)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={seg.rest_intensity}
                    onChange={(e) =>
                      updateSegment(index, {
                        rest_intensity: e.target.value as WorkoutSegment['intensity'],
                      })
                    }
                  >
                    {INTENSITIES.map((i) => (
                      <option key={i} value={i}>
                        {getIntensityLabel(i)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="segment-summary">{getSummary(seg)}</div>
          </div>
        ))}
      </div>

      <div className="segment-actions">
        <button type="button" onClick={addSimple}>
          + {t('segment_add_simple')}
        </button>
        <button type="button" onClick={addInterval}>
          + {t('segment_add_interval')}
        </button>
      </div>
    </div>
  );
}
