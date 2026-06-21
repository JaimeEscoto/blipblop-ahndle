import { useRef, useState, useEffect } from 'react';
import { Eraser } from 'lucide-react';

// Pad simple de firma sobre canvas. Soporta mouse y touch.
// onChange recibe un dataURL PNG (transparente) cuando el usuario deja de trazar.
interface Props {
  onChange: (dataUrl: string | null) => void;
  height?: number;
}

export default function SignaturePad({ onChange, height = 180 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);

  // Ajusta el canvas al tamaño real con devicePixelRatio para que se vea nítido.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0f2f4f';
    }
  }, []);

  const getPos = (e: PointerEvent | React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: (e as PointerEvent).clientX - rect.left, y: (e as PointerEvent).clientY - rect.top };
  };

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    drawing.current = true;
    lastPoint.current = getPos(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !lastPoint.current) return;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPoint.current = p;
  };
  const end = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    drawing.current = false;
    canvasRef.current?.releasePointerCapture(e.pointerId);
    const dataUrl = canvasRef.current?.toDataURL('image/png') || null;
    setHasInk(true);
    onChange(dataUrl);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange(null);
  };

  return (
    <div>
      <div className="relative border-2 border-dashed border-gray-300 rounded-lg bg-white" style={{ height }}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none cursor-crosshair rounded-lg"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        />
        {!hasInk && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-gray-400 pointer-events-none">
            Firma aquí
          </p>
        )}
      </div>
      <button type="button" onClick={clear}
        className="mt-2 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
        <Eraser className="w-3.5 h-3.5" /> Borrar y volver a firmar
      </button>
    </div>
  );
}
