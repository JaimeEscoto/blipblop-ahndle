import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// ── Modelo de datos ─────────────────────────────────────────────────────────
// Retrocompatible con el formato viejo. El valor de un diente puede ser:
//   • string  → formato antiguo: un estado aplicado a TODO el diente.
//   • ToothCell → formato nuevo: estado estructural de todo el diente (whole)
//                 y/o estados por cara (surfaces).
export type ToothSurface = 'vestibular' | 'lingual' | 'mesial' | 'distal' | 'occlusal';
export interface ToothCell {
  whole?: string | null;                              // extraído / corona / implante
  surfaces?: Partial<Record<ToothSurface, string>>;   // caries / obturado por cara
}
export type ToothValue = string | ToothCell;
export type ToothChart = Record<string, ToothValue>;

const STATE_COLORS: Record<string, string> = {
  healthy:   '#ffffff',
  cavity:    '#ef4444',
  filled:    '#3b82f6',
  extracted: '#6b7280',
  crown:     '#f59e0b',
  implant:   '#8b5cf6',
};

// Caries y obturación se marcan por cara; extraído/corona/implante afectan al
// diente completo; "sano" funciona como borrador.
const SURFACE_STATES = ['cavity', 'filled'];
const WHOLE_STATES = ['extracted', 'crown', 'implant'];
const STATE_ORDER = ['cavity', 'filled', 'extracted', 'crown', 'implant', 'healthy'];

const UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

const isWhole = (s: string) => WHOLE_STATES.includes(s);
const isSurface = (s: string) => SURFACE_STATES.includes(s);

// Normaliza cualquier valor (viejo o nuevo) a ToothCell.
function normalize(v: ToothValue | undefined): ToothCell {
  if (!v) return {};
  if (typeof v === 'string') {
    if (v === 'healthy') return {};
    // Formato antiguo: se pintaba todo el diente → lo tratamos como "whole".
    return { whole: v };
  }
  return { whole: v.whole ?? null, surfaces: { ...(v.surfaces || {}) } };
}

// Devuelve la celda limpia, o undefined si el diente queda sano (para no
// guardar entradas vacías en el JSON).
function cleanCell(cell: ToothCell): ToothCell | undefined {
  const surfaces: Partial<Record<ToothSurface, string>> = {};
  for (const [k, val] of Object.entries(cell.surfaces || {})) {
    if (val && val !== 'healthy') surfaces[k as ToothSurface] = val;
  }
  const whole = cell.whole && cell.whole !== 'healthy' ? cell.whole : null;
  const hasSurfaces = Object.keys(surfaces).length > 0;
  if (!whole && !hasSurfaces) return undefined;
  const out: ToothCell = {};
  if (whole) out.whole = whole;
  if (hasSurfaces) out.surfaces = surfaces;
  return out;
}

// Mesial siempre apunta hacia la línea media. Dentro del cuadro del diente eso
// significa: cuadrantes 1 y 4 → mesial a la derecha; 2 y 3 → mesial a la izq.
function sideSurfaces(tooth: number): { left: ToothSurface; right: ToothSurface } {
  const q = Math.floor(tooth / 10);
  const mesialRight = q === 1 || q === 4;
  return mesialRight ? { left: 'distal', right: 'mesial' } : { left: 'mesial', right: 'distal' };
}

// Geometría del cuadro de 5 zonas (viewBox 0 0 40 40, centro 13..27).
const REGION_POINTS: Record<'top' | 'bottom' | 'left' | 'right' | 'center', string> = {
  top:    '0,0 40,0 27,13 13,13',
  bottom: '0,40 40,40 27,27 13,27',
  left:   '0,0 13,13 13,27 0,40',
  right:  '40,0 27,13 27,27 40,40',
  center: '13,13 27,13 27,27 13,27',
};

interface OdontogramProps {
  value: Record<string, any>;
  onChange: (v: ToothChart) => void;
  readOnly?: boolean;
}

export default function Odontogram({ value, onChange, readOnly = false }: OdontogramProps) {
  const { t } = useTranslation();
  const stateLabel = (k: string) => t(`odontogram.states.${k}`, { defaultValue: k });
  const surfaceLabel = (k: ToothSurface) => t(`odontogram.surfaces.${k}`, { defaultValue: k });
  const [activeState, setActiveState] = useState('cavity');
  const [selected, setSelected] = useState<string | null>(null);

  const applySurface = (tooth: number, surface: ToothSurface) => {
    if (readOnly) return;
    const key = String(tooth);
    setSelected(key);
    const cell = normalize(value[key]);
    cell.surfaces = { ...(cell.surfaces || {}) };

    if (isWhole(activeState)) {
      cell.whole = activeState;
      cell.surfaces = {}; // whole y surfaces son excluyentes
    } else if (activeState === 'healthy') {
      // Borrador: si el diente estaba marcado como completo, límpialo; si no,
      // borra solo la cara tocada.
      if (cell.whole) cell.whole = null;
      else delete cell.surfaces[surface];
    } else {
      cell.whole = null;
      cell.surfaces[surface] = activeState;
    }

    const next: ToothChart = { ...value };
    const cleaned = cleanCell(cell);
    if (cleaned) next[key] = cleaned;
    else delete next[key];
    onChange(next);
  };

  // Color de cada región para un diente dado.
  const regionColor = (cell: ToothCell, surface: ToothSurface): string => {
    if (cell.whole) return STATE_COLORS[cell.whole] || '#ffffff';
    const s = cell.surfaces?.[surface];
    return s ? STATE_COLORS[s] || '#ffffff' : '#ffffff';
  };

  const ToothBox = ({ tooth }: { tooth: number }) => {
    const key = String(tooth);
    const cell = normalize(value[key]);
    const sides = sideSurfaces(tooth);
    const isExtracted = cell.whole === 'extracted';
    const isSel = selected === key;

    // Mapa región → cara
    const regions: { name: keyof typeof REGION_POINTS; surface: ToothSurface }[] = [
      { name: 'top', surface: 'vestibular' },
      { name: 'bottom', surface: 'lingual' },
      { name: 'left', surface: sides.left },
      { name: 'right', surface: sides.right },
      { name: 'center', surface: 'occlusal' },
    ];

    return (
      <div className="flex flex-col items-center gap-0.5 shrink-0">
        <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">{tooth}</span>
        <svg
          viewBox="0 0 40 40"
          className={`w-11 h-11 ${readOnly ? '' : 'cursor-pointer'}`}
          style={{ filter: isSel ? 'drop-shadow(0 0 2px #2563eb)' : undefined }}
        >
          {regions.map(({ name, surface }) => (
            <polygon
              key={name}
              points={REGION_POINTS[name]}
              fill={regionColor(cell, surface)}
              stroke={isSel ? '#2563eb' : '#9ca3af'}
              strokeWidth={isSel ? 1.4 : 0.9}
              opacity={isExtracted ? 0.5 : 1}
              onClick={() => applySurface(tooth, surface)}
            >
              <title>{`${tooth} · ${surfaceLabel(surface)}${
                cell.whole
                  ? ' — ' + stateLabel(cell.whole)
                  : cell.surfaces?.[surface]
                  ? ' — ' + stateLabel(cell.surfaces[surface]!)
                  : ''
              }`}</title>
            </polygon>
          ))}
          {isExtracted && (
            <path d="M6 6 L34 34 M34 6 L6 34" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
          )}
        </svg>
      </div>
    );
  };

  const scope = isWhole(activeState) ? t('odontogram.scope.whole', { defaultValue: 'todo el diente' })
    : isSurface(activeState) ? t('odontogram.scope.surface', { defaultValue: 'por cara' })
    : '';

  return (
    <div className="space-y-4">
      {/* Selector de condición */}
      {!readOnly && (
        <>
          <div className="flex flex-wrap gap-2">
            {STATE_ORDER.map(k => (
              <button
                key={k}
                type="button"
                onClick={() => setActiveState(k)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-all ${
                  activeState === k
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/40 font-semibold ring-1 ring-blue-400'
                    : 'border-gray-200 dark:border-gray-600'
                } text-gray-700 dark:text-gray-200`}
              >
                <span
                  className="w-3.5 h-3.5 rounded border border-gray-300 dark:border-gray-500 inline-block"
                  style={{ backgroundColor: STATE_COLORS[k] }}
                />
                {stateLabel(k)}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {t('odontogram.byToothHint', {
              defaultValue: 'Elige una condición y toca la cara del diente. Extraído, corona e implante aplican a todo el diente.',
            })}
            {scope && (
              <span className="ml-1 font-medium text-blue-600 dark:text-blue-400">
                — {stateLabel(activeState)}: {scope}
              </span>
            )}
          </p>
        </>
      )}

      {/* Arcada superior */}
      <div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-1">{t('odontogram.upper')}</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {UPPER.map(tooth => <ToothBox key={tooth} tooth={tooth} />)}
        </div>
      </div>
      {/* Arcada inferior */}
      <div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-1">{t('odontogram.lower')}</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {LOWER.map(tooth => <ToothBox key={tooth} tooth={tooth} />)}
        </div>
      </div>

      {/* Leyenda de estados */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {STATE_ORDER.filter(k => k !== 'healthy').map(k => (
          <span key={k} className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
            <span
              className="w-2.5 h-2.5 rounded border border-gray-300 dark:border-gray-500 inline-block"
              style={{ backgroundColor: STATE_COLORS[k] }}
            />
            {stateLabel(k)}
          </span>
        ))}
      </div>
    </div>
  );
}
