import { useState } from 'react';

const TOOTH_STATES: Record<string, { label: string; color: string }> = {
  healthy:   { label: 'Sano',      color: '#ffffff' },
  cavity:    { label: 'Caries',    color: '#ef4444' },
  filled:    { label: 'Obturado',  color: '#3b82f6' },
  extracted: { label: 'Extraído',  color: '#6b7280' },
  crown:     { label: 'Corona',    color: '#f59e0b' },
  implant:   { label: 'Implante',  color: '#8b5cf6' },
};

const UPPER = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
const LOWER = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];

interface OdontogramProps {
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  readOnly?: boolean;
}

export default function Odontogram({ value, onChange, readOnly = false }: OdontogramProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [activeState, setActiveState] = useState('cavity');

  const handleTooth = (tooth: number) => {
    if (readOnly) return;
    const key = String(tooth);
    setSelected(key);
    const current = value[key] || 'healthy';
    const states = Object.keys(TOOTH_STATES);
    const next = states[(states.indexOf(activeState))] ;
    onChange({ ...value, [key]: next });
  };

  const ToothBox = ({ tooth }: { tooth: number }) => {
    const key = String(tooth);
    const state = value[key] || 'healthy';
    const cfg = TOOTH_STATES[state];
    return (
      <div
        onClick={() => handleTooth(tooth)}
        className={`flex flex-col items-center gap-0.5 ${readOnly ? '' : 'cursor-pointer'}`}
        title={`${tooth} — ${cfg.label}`}
      >
        <span className="text-[9px] text-gray-400">{tooth}</span>
        <div
          className="w-7 h-7 rounded border-2 border-gray-300 transition-all hover:scale-110"
          style={{ backgroundColor: cfg.color, boxShadow: selected === key ? '0 0 0 2px #2563eb' : undefined }}
        />
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Legend + state selector */}
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(TOOTH_STATES).map(([k, v]) => (
            <button
              key={k}
              type="button"
              onClick={() => setActiveState(k)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border transition-all ${
                activeState === k ? 'border-blue-500 bg-blue-50 font-semibold' : 'border-gray-200'
              }`}
            >
              <span className="w-3 h-3 rounded border border-gray-300 inline-block" style={{ backgroundColor: v.color }} />
              {v.label}
            </button>
          ))}
        </div>
      )}
      {/* Upper teeth */}
      <div>
        <p className="text-[10px] text-gray-400 mb-1">Superior</p>
        <div className="flex gap-1 flex-wrap">
          {UPPER.map(t => <ToothBox key={t} tooth={t} />)}
        </div>
      </div>
      {/* Lower teeth */}
      <div>
        <p className="text-[10px] text-gray-400 mb-1">Inferior</p>
        <div className="flex gap-1 flex-wrap">
          {LOWER.map(t => <ToothBox key={t} tooth={t} />)}
        </div>
      </div>
      {/* Legend readonly */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(TOOTH_STATES).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1 text-[10px] text-gray-500">
            <span className="w-2.5 h-2.5 rounded border border-gray-300 inline-block" style={{ backgroundColor: v.color }} />
            {v.label}
          </span>
        ))}
      </div>
    </div>
  );
}
