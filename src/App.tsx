import React, { useState, useRef, useEffect } from 'react';
import { PenTool, Eraser, Trash2, Settings2, Info, PenLine } from 'lucide-react';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState('#1a1a1a');
  const [size, setSize] = useState(5);
  const [rejectionMode, setRejectionMode] = useState<'pen_only' | 'smart' | 'none'>('pen_only');
  
  // Debug info
  const [rejectedTouches, setRejectedTouches] = useState(0);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setDebugLogs(prev => [msg, ...prev].slice(0, 6));
  };

  // Drawing state refs
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const activePointerId = useRef<number | null>(null);
  const activePointerType = useRef<string | null>(null);

  // Initialize canvas & native touch listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const ctx = canvas.getContext('2d');
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx && ctx) {
        tempCtx.drawImage(canvas, 0, 0);
      }

      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

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

    // Native touch event prevention (Crucial for Android tablets)
    const preventTouch = (e: TouchEvent) => {
      // Prevent default to stop scrolling/zooming and browser gesture interference
      if (rejectionMode !== 'none') {
        e.preventDefault();
      }
    };

    canvas.addEventListener('touchstart', preventTouch, { passive: false });
    canvas.addEventListener('touchmove', preventTouch, { passive: false });
    canvas.addEventListener('touchend', preventTouch, { passive: false });
    canvas.addEventListener('touchcancel', preventTouch, { passive: false });

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('touchstart', preventTouch);
      canvas.removeEventListener('touchmove', preventTouch);
      canvas.removeEventListener('touchend', preventTouch);
      canvas.removeEventListener('touchcancel', preventTouch);
    };
  }, [rejectionMode]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setRejectedTouches(0);
    setDebugLogs([]);
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
    const info = `${e.pointerType} (w:${e.width || 0}, h:${e.height || 0}, p:${e.pressure?.toFixed(2) || 0})`;

    let isRejected = false;
    let reason = '';

    if (rejectionMode === 'pen_only') {
      if (e.pointerType !== 'pen') {
        isRejected = true;
        reason = 'Not a pen';
      }
    } else if (rejectionMode === 'smart') {
      if (e.pointerType === 'touch') {
        // Smart rejection: if contact area is large, it's likely a palm
        if ((e.width && e.width > 15) || (e.height && e.height > 15)) {
          isRejected = true;
          reason = `Large area (${e.width}x${e.height})`;
        }
      }
    }

    if (isRejected) {
      setRejectedTouches(prev => prev + 1);
      addLog(`❌ Rejected: ${info} - ${reason}`);
      return;
    }

    addLog(`✅ Accepted: ${info}`);

    // If we are already drawing with a touch, but a PEN comes in, override it
    if (activePointerId.current !== null) {
      if (e.pointerType === 'pen' && activePointerType.current !== 'pen') {
        // Override
        activePointerId.current = e.pointerId;
        activePointerType.current = 'pen';
      } else {
        return; // Ignore secondary touches
      }
    } else {
      activePointerId.current = e.pointerId;
      activePointerType.current = e.pointerType;
    }
    
    isDrawing.current = true;
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
    const pressureMultiplier = pressure > 0 ? (pressure * 1.5 + 0.2) : 1;
    const currentSize = size * pressureMultiplier;

    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(currentPos.x, currentPos.y);
    
    if (tool === 'eraser') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = size * 3;
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
      activePointerType.current = null;
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
            <p className="text-xs text-gray-500 font-medium">Advanced Palm Rejection</p>
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
        <aside className="w-80 bg-white border-r border-gray-200 p-6 flex flex-col gap-6 z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)] overflow-y-auto">
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <Settings2 size={16} />
              Rejection Mode
            </h2>
            
            <div className="flex flex-col gap-3">
              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${rejectionMode === 'pen_only' ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                <input 
                  type="radio" 
                  name="rejectionMode"
                  value="pen_only"
                  checked={rejectionMode === 'pen_only'}
                  onChange={() => setRejectionMode('pen_only')}
                  className="mt-1 accent-blue-600"
                />
                <div>
                  <span className={`block text-sm font-semibold ${rejectionMode === 'pen_only' ? 'text-blue-700' : 'text-gray-900'}`}>Pen Only (Strict)</span>
                  <span className="block text-xs text-gray-500 mt-0.5">Chỉ nhận diện bút (pointerType = 'pen'). Tốt nhất nếu tablet hỗ trợ chuẩn.</span>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${rejectionMode === 'smart' ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                <input 
                  type="radio" 
                  name="rejectionMode"
                  value="smart"
                  checked={rejectionMode === 'smart'}
                  onChange={() => setRejectionMode('smart')}
                  className="mt-1 accent-blue-600"
                />
                <div>
                  <span className={`block text-sm font-semibold ${rejectionMode === 'smart' ? 'text-blue-700' : 'text-gray-900'}`}>Smart (Area Based)</span>
                  <span className="block text-xs text-gray-500 mt-0.5">Từ chối các điểm chạm có diện tích lớn (lòng bàn tay). Dùng khi tablet nhận bút là ngón tay.</span>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${rejectionMode === 'none' ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                <input 
                  type="radio" 
                  name="rejectionMode"
                  value="none"
                  checked={rejectionMode === 'none'}
                  onChange={() => setRejectionMode('none')}
                  className="mt-1 accent-blue-600"
                />
                <div>
                  <span className={`block text-sm font-semibold ${rejectionMode === 'none' ? 'text-blue-700' : 'text-gray-900'}`}>None (Allow All)</span>
                  <span className="block text-xs text-gray-500 mt-0.5">Nhận mọi thao tác chạm. Không có palm rejection.</span>
                </div>
              </label>
            </div>
          </div>

          <div className="space-y-4 mt-auto">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <Info size={16} />
              Debug Log
            </h2>
            <div className="bg-slate-900 text-slate-300 rounded-xl p-4 text-xs font-mono space-y-3 shadow-inner">
              <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                <span>Rejected:</span>
                <span className="text-red-400 font-bold text-sm bg-red-400/10 px-2 py-0.5 rounded">{rejectedTouches}</span>
              </div>
              <div className="space-y-1.5">
                <div className="text-slate-500 mb-1">Recent events:</div>
                {debugLogs.length === 0 ? (
                  <div className="text-slate-600 italic">No events yet...</div>
                ) : (
                  debugLogs.map((log, i) => (
                    <div key={i} className={`truncate ${log.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed bg-blue-50 p-3 rounded-lg border border-blue-100">
              <strong className="text-blue-700">Mẹo:</strong> Hãy thử vẽ bằng bút và xem log hiện chữ gì. Nếu bút hiện là <code>touch</code>, hãy chuyển sang chế độ <strong>Smart</strong>.
            </p>
          </div>
        </aside>

        {/* Canvas Container */}
        <div 
          ref={containerRef} 
          className="flex-1 relative bg-gray-200 cursor-crosshair overflow-hidden"
          style={{ touchAction: 'none' }}
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
