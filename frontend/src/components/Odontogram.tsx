import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const TOOTH_STATES: Record<string, { color: string }> = {
  healthy:   { color: '#ffffff' },
  cavity:    { color: '#ef4444' },
  filled:    { color: '#3b82f6' },
  extracted: { color: '#6b7280' },
  crown:     { color: '#f59e0b' },
  implant:   { color: '#8b5cf6' },
};

const UPPER = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
const LOWER = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];

interface OdontogramProps {
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  readOnly?: boolean;
}

export default function Odontogram({ value, onChange, readOnly = false }: OdontogramProps) {
  const { t } = useTranslation();
  const stateLabel = (k: string) => t(`odontogram.states.${k}`, { defaultValue: k });
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

  // Siluetas según el tipo de diente (numeración FDI: último dígito)
  // 1-2 incisivos · 3 colmillo · 4-5 premolares · 6-8 molares
  const TOOTH_PATHS: Record<string, string> = {
    // Incisivo: corona plana tipo cincel, raíz única
    incisor:  'M12 3 H28 C30 3 31 7 30 14 C29 23 27 31 24 43 C23 49 22 50 20 50 C18 50 17 49 16 43 C13 31 11 23 10 14 C9 7 10 3 12 3 Z',
    // Colmillo: corona puntiaguda, raíz larga
    canine:   'M20 1 C24 7 29 9 29 17 C29 25 27 32 24 43 C23 49 22 50 20 50 C18 50 17 49 16 43 C13 32 11 25 11 17 C11 9 16 7 20 1 Z',
    // Premolar: corona redondeada, raíz cónica
    premolar: 'M20 3 C29 3 34 8 34 17 C34 25 30 31 27 41 C26 47 24 48 23 42 C22 37 21 35 20 35 C19 35 18 37 17 42 C16 48 14 47 13 41 C10 31 6 25 6 17 C6 8 11 3 20 3 Z',
    // Molar: corona ancha, dos raíces
    molar:    'M20 2 C32 2 39 8 39 20 C39 30 35 34 33 44 C32 50 28 50 27 44 C26 38 24 36 20 36 C16 36 14 38 13 44 C12 50 8 50 7 44 C5 34 1 30 1 20 C1 8 8 2 20 2 Z',
  };

  const toothType = (tooth: number) => {
    const pos = tooth % 10; // último dígito FDI
    if (pos <= 2) return 'incisor';
    if (pos === 3) return 'canine';
    if (pos <= 5) return 'premolar';
    return 'molar';
  };

  const ToothBox = ({ tooth }: { tooth: number }) => {
    const key = String(tooth);
    const state = value[key] || 'healthy';
    const cfg = TOOTH_STATES[state];
    const isExtracted = state === 'extracted';
    const isSelected = selected === key;
    const path = TOOTH_PATHS[toothType(tooth)];
    return (
      <div
        onClick={() => handleTooth(tooth)}
        className={`flex flex-col items-center gap-0.5 ${readOnly ? '' : 'cursor-pointer'}`}
        title={`${tooth} — ${stateLabel(state)}`}
      >
        <span className="text-[9px] text-gray-400">{tooth}</span>
        <svg
          viewBox="0 0 40 52"
          className="w-7 h-9 transition-transform hover:scale-110"
          style={{ filter: isSelected ? 'drop-shadow(0 0 2px #2563eb)' : undefined }}
        >
          <path
            d={path}
            fill={isExtracted ? '#f3f4f6' : cfg.color}
            stroke={isSelected ? '#2563eb' : '#9ca3af'}
            strokeWidth={isSelected ? 3 : 2}
            opacity={isExtracted ? 0.5 : 1}
          />
          {isExtracted && (
            <path d="M11 12 L29 40 M29 12 L11 40" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
          )}
        </svg>
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
              {stateLabel(k)}
            </button>
          ))}
        </div>
      )}
      {/* Upper teeth */}
      <div>
        <p className="text-[10px] text-gray-400 mb-1">{t('odontogram.upper')}</p>
        <div className="flex gap-1 flex-wrap">
          {UPPER.map(tooth => <ToothBox key={tooth} tooth={tooth} />)}
        </div>
      </div>
      {/* Lower teeth */}
      <div>
        <p className="text-[10px] text-gray-400 mb-1">{t('odontogram.lower')}</p>
        <div className="flex gap-1 flex-wrap">
          {LOWER.map(tooth => <ToothBox key={tooth} tooth={tooth} />)}
        </div>
      </div>
      {/* Legend readonly */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(TOOTH_STATES).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1 text-[10px] text-gray-500">
            <span className="w-2.5 h-2.5 rounded border border-gray-300 inline-block" style={{ backgroundColor: v.color }} />
            {stateLabel(k)}
          </span>
        ))}
      </div>
    </div>
  );
}
