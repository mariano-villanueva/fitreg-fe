import { useState } from "react";
import { useTranslation } from "react-i18next";

export interface TimeValue {
  h: number;
  m: number;
  s: number;
}

interface TimeInputProps {
  value: TimeValue;
  onChange: (val: TimeValue) => void;
}

export function toSeconds(v: TimeValue): number {
  return v.h * 3600 + v.m * 60 + v.s;
}

export function fromSeconds(total: number): TimeValue {
  return {
    h: Math.floor(total / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

const MAX: Record<"h" | "m" | "s", number> = { h: 99, m: 59, s: 59 };

export default function TimeInput({ value, onChange }: TimeInputProps) {
  const { t } = useTranslation();
  // Track raw text while the user is typing, keyed by field
  const [draft, setDraft] = useState<Partial<Record<"h" | "m" | "s", string>>>({});

  function spin(field: "h" | "m" | "s", delta: number) {
    setDraft((d) => { const next = { ...d }; delete next[field]; return next; });
    onChange({ ...value, [field]: Math.max(0, Math.min(MAX[field], value[field] + delta)) });
  }

  function handleChange(field: "h" | "m" | "s", raw: string) {
    // Allow only digits, max 2 chars
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    setDraft((d) => ({ ...d, [field]: digits }));
    const num = parseInt(digits, 10);
    if (!isNaN(num)) {
      onChange({ ...value, [field]: Math.min(MAX[field], num) });
    }
  }

  function handleBlur(field: "h" | "m" | "s") {
    // Commit and clear draft so display goes back to formatted value
    setDraft((d) => { const next = { ...d }; delete next[field]; return next; });
    // Clamp the stored value in case user typed something above max
    onChange({ ...value, [field]: Math.min(MAX[field], value[field]) });
  }

  const fields: { key: "h" | "m" | "s"; label: string }[] = [
    { key: "h", label: t("field_hours_short") },
    { key: "m", label: t("field_minutes_short") },
    { key: "s", label: t("field_seconds_short") },
  ];

  return (
    <div className="time-input-c1">
      {fields.map(({ key, label }, i) => {
        const displayVal = draft[key] !== undefined
          ? draft[key]!
          : String(value[key]).padStart(2, "0");

        return (
          <div key={key} className="time-input-group">
            {i > 0 && <span className="time-input-sep">:</span>}
            <div className="time-input-col">
              <button type="button" className="time-input-btn" tabIndex={-1} onClick={() => spin(key, 1)}>▲</button>
              <input
                className="time-input-val"
                type="text"
                inputMode="numeric"
                value={displayVal}
                onChange={(e) => handleChange(key, e.target.value)}
                onFocus={(e) => e.target.select()}
                onBlur={() => handleBlur(key)}
              />
              <button type="button" className="time-input-btn" tabIndex={-1} onClick={() => spin(key, -1)}>▼</button>
              <div className="time-input-unit">{label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
