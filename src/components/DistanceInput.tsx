import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

const KM_PER_MILE = 1.60934;

const PRESETS = [
  { label: "5", sub: "km", km: 5 },
  { label: "10", sub: "km", km: 10 },
  { label: "21.1", sub: "dist_half", km: 21.097 },
  { label: "42.2", sub: "dist_marathon", km: 42.195 },
];

type Unit = "km" | "m" | "mi";

interface DistanceInputProps {
  valueKm: number;
  onChange: (km: number) => void;
  label?: string;
  showUnitToggle?: boolean;
}

function toDisplay(km: number, unit: Unit): number {
  if (unit === "m") return km * 1000;
  if (unit === "mi") return km / KM_PER_MILE;
  return km;
}

function toKm(val: number, unit: Unit): number {
  if (unit === "m") return val / 1000;
  if (unit === "mi") return val * KM_PER_MILE;
  return val;
}

export default function DistanceInput({ valueKm, onChange, label, showUnitToggle = false }: DistanceInputProps) {
  const { t } = useTranslation();
  const [unit, setUnit] = useState<Unit>("km");
  const [inputVal, setInputVal] = useState(valueKm > 0 ? String(valueKm) : "");

  const unitLabel = unit === "km" ? "km" : unit === "m" ? "m" : "mi";

  // Sync displayed value when parent changes valueKm (e.g. on preset click or reset)
  useEffect(() => {
    const displayed = toDisplay(valueKm, unit);
    setInputVal(valueKm > 0 ? String(parseFloat(displayed.toFixed(3))) : "");
  }, [valueKm, unit]);

  function handleInput(raw: string) {
    setInputVal(raw);
    const num = parseFloat(raw);
    if (!isNaN(num) && num >= 0) {
      onChange(toKm(num, unit));
    } else if (raw === "" || raw === "0") {
      onChange(0);
    }
  }

  function handleUnitSwitch(next: Unit) {
    if (next === unit) return;
    const converted = toDisplay(valueKm, next);
    setUnit(next);
    setInputVal(valueKm > 0 ? String(parseFloat(converted.toFixed(3))) : "");
  }

  function handlePreset(km: number) {
    setUnit("km");
    setInputVal(String(km));
    onChange(km);
  }

  const activePreset = PRESETS.find((p) => Math.abs(p.km - valueKm) < 0.01);

  return (
    <div className="distance-input-c">
      {label && (
        <label className="distance-label">{label} ({unitLabel})</label>
      )}

      {/* Presets */}
      <div className="distance-presets">
        {PRESETS.map((p) => (
          <button
            key={p.km}
            type="button"
            className={`distance-preset${activePreset?.km === p.km ? " active" : ""}`}
            onClick={() => handlePreset(p.km)}
          >
            {p.label}
            <small>{p.sub.startsWith("dist_") ? t(p.sub) : p.sub}</small>
          </button>
        ))}
      </div>

      <div className="distance-divider">{t("distance_or")}</div>

      {/* Large input with floating badge */}
      <div className="distance-field">
        <input
          className="distance-field-input"
          type="number"
          min="0"
          step="0.001"
          placeholder="0.000"
          value={inputVal}
          onChange={(e) => handleInput(e.target.value)}
        />
        <span className="distance-field-badge">{unitLabel}</span>
      </div>

      {/* Unit tabs */}
      {showUnitToggle && (
        <div className="distance-unit-tabs">
          <button
            type="button"
            className={`distance-unit-tab${unit === "km" ? " active" : ""}`}
            onClick={() => handleUnitSwitch("km")}
          >
            km — {t("unit_km_label")}
          </button>
          <button
            type="button"
            className={`distance-unit-tab${unit === "m" ? " active" : ""}`}
            onClick={() => handleUnitSwitch("m")}
          >
            m — {t("unit_m_label")}
          </button>
          <button
            type="button"
            className={`distance-unit-tab${unit === "mi" ? " active" : ""}`}
            onClick={() => handleUnitSwitch("mi")}
          >
            mi — {t("unit_mi_label")}
          </button>
        </div>
      )}
    </div>
  );
}
