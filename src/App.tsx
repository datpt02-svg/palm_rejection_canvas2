import React, { useState, useRef, useEffect } from 'react';
import { PenTool, Eraser, Trash2, Settings2, Info, PenLine } from 'lucide-react';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState('#1a1a1a');
  const [size, setSize] = useState(5);
  const [strictPalmRejection, setStrictPalmRejection] = useState(true);
  
  // Debug info
  const [lastPointerType, setLastPointerType] = useState<string>('none');
  const [rejectedTouches, setRejectedTouches] = useState(0);

  // Drawing state refs (to avoid re-renders during drawing)
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const activePointerId = useRef<number | null>(null);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      // Save current drawing
      const ctx = canvas.getContext('2d');
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx && ctx) {
        tempCtx.drawImage(canvas, 0, 0);
      }

      // Resize
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      // Restore drawing or fill white
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (tempCtx) {
          ctx.drawImage(tempCanvas, 0, 0);
        }
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setRejectedTouches(0);
  };

  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setLastPointerType(e.pointerType);
    
    // Palm rejection logic
    if (strictPalmRejection && e.pointerType !== 'pen') {
      if (e.pointerType === 'touch') {
        setRejectedTouches(prev => prev + 1);
      }
      return;
    }

    // Only allow one pointer to draw at a time
    if (activePointerId.current !== null) return;
    
    isDrawing.current = true;
    activePointerId.current = e.pointerId;
    lastPos.current = getCoordinates(e);
    
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || e.pointerId !== activePointerId.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const currentPos = getCoordinates(e);
    
    // Use pressure for pen, default to 0.5 for others
    const pressure = e.pointerType === 'pen' ? e.pressure : 0.5;
    // Simple pressure dynamics: size varies from 0.5x to 1.5x based on pressure
    const pressureMultiplier = pressure > 0 ? (pressure * 1.5 + 0.2) : 1;
    const currentSize = size * pressureMultiplier;

    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(currentPos.x, currentPos.y);
    
    if (tool === 'eraser') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = size * 3; // Eraser is usually bigger
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = currentSize;
    }
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    lastPos.current = currentPos;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerId === activePointerId.current) {
      isDrawing.current = false;
      activePointerId.current = null;
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans text-gray-900 overflow-hidden">
      {/* Header / Toolbar */}
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm z-10">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
            <PenLine size={24} />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">Studio Canvas</h1>
            <p className="text-xs text-gray-500 font-medium">Palm Rejection Demo</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Tools */}
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setTool('pen')}
              className={`p-2 rounded-lg flex items-center gap-2 transition-colors ${tool === 'pen' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:bg-gray-200'}`}
              title="Pen Tool"
            >
              <PenTool size={20} />
            </button>
            <button
              onClick={() => setTool('eraser')}
              className={`p-2 rounded-lg flex items-center gap-2 transition-colors ${tool === 'eraser' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:bg-gray-200'}`}
              title="Eraser"
            >
              <Eraser size={20} />
            </button>
          </div>

          {/* Properties */}
          <div className="flex items-center gap-4 border-l border-gray-200 pl-6">
            <div className="flex items-center gap-2">
              <input 
                type="color" 
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
                disabled={tool === 'eraser'}
              />
            </div>
            <div className="flex items-center gap-2 w-32">
              <span className="text-xs text-gray-500 font-medium w-8">{size}px</span>
              <input 
                type="range" 
                min="1" 
                max="50" 
                value={size}
                onChange={(e) => setSize(parseInt(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 border-l border-gray-200 pl-6">
            <button
              onClick={clearCanvas}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Clear Canvas"
            >
              <Trash2 size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative flex">
        {/* Sidebar Settings */}
        <aside className="w-64 bg-white border-r border-gray-200 p-6 flex flex-col gap-6 z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <Settings2 size={16} />
              Input Settings
            </h2>
            
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center mt-0.5">
                  <input 
                    type="checkbox" 
                    className="sr-only"
                    checked={strictPalmRejection}
                    onChange={(e) => setStrictPalmRejection(e.target.checked)}
                  />
                  <div className={`w-10 h-6 rounded-full transition-colors ${strictPalmRejection ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${strictPalmRejection ? 'translate-x-4' : 'translate-x-0'}`}></div>
                </div>
                <div>
                  <span className="block text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">Strict Palm Rejection</span>
                  <span className="block text-xs text-gray-500 mt-1">Only allow drawing with a stylus/pen. Ignores touch and mouse inputs.</span>
                </div>
              </label>
            </div>
          </div>

          <div className="space-y-4 mt-auto">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <Info size={16} />
              Debug Info
            </h2>
            <div className="bg-slate-900 text-slate-300 rounded-xl p-4 text-xs font-mono space-y-2 shadow-inner">
              <div className="flex justify-between">
                <span>Last Input:</span>
                <span className={`font-bold ${lastPointerType === 'pen' ? 'text-green-400' : lastPointerType === 'touch' ? 'text-orange-400' : 'text-blue-400'}`}>
                  {lastPointerType}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Rejected Touches:</span>
                <span className="text-red-400 font-bold">{rejectedTouches}</span>
              </div>
              <div className="flex justify-between">
                <span>Rejection Status:</span>
                <span className={strictPalmRejection ? 'text-green-400' : 'text-slate-500'}>
                  {strictPalmRejection ? 'ACTIVE' : 'DISABLED'}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed">
              Try resting your palm on the screen while drawing with a pen. If strict mode is on, the palm touches will be ignored.
            </p>
          </div>
        </aside>

        {/* Canvas Container */}
        <div 
          ref={containerRef} 
          className="flex-1 relative bg-gray-200 cursor-crosshair overflow-hidden"
          style={{ touchAction: 'none' }} // Prevent browser scrolling/zooming
        >
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerOut={handlePointerUp}
            className="absolute inset-0 bg-white shadow-md"
            style={{ touchAction: 'none' }}
          />
        </div>
      </main>
    </div>
  );
}
