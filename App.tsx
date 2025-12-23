
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GameMode, QLearningStats, Direction, ItemType } from './types';
import { SnakeGame, GRID_SIZE } from './game/SnakeGame';
import { QLearningAgent } from './ai/QLearningAgent';

/**
 * A simple SVG Line Chart component for real-time visualization
 */
const SimpleChart: React.FC<{ data: number[], color: string, label: string, height?: number }> = ({ data, color, label, height = 80 }) => {
  const points = useMemo(() => {
    if (data.length < 2) return "";
    const max = Math.max(...data, 0.0001);
    const min = Math.min(...data);
    const range = (max - min) || 1;
    const width = 400;
    return data.map((d, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = (height - 10) - (((d - min) / range) * (height - 20));
      return `${x},${y}`;
    }).join(" ");
  }, [data, height]);

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex justify-between items-end text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
        <span>{label}</span>
        <span className="text-white mono bg-white/5 px-1.5 py-0.5 rounded text-[10px]">{data[data.length - 1]?.toFixed(3) || 0}</span>
      </div>
      <div className="bg-white/[0.03] rounded-2xl p-3 border border-white/5 overflow-hidden shadow-inner h-[80px]">
        <svg viewBox={`0 0 400 ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
            className="drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]"
          />
        </svg>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [mode, setMode] = useState<GameMode>(GameMode.AI_WATCH);
  const modeRef = useRef<GameMode>(mode);
  const [currentScore, setCurrentScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [qStats, setQStats] = useState<QLearningStats>(() => {
    const saved = localStorage.getItem('qs_v6_stats');
    return saved ? JSON.parse(saved) : {
      episodes: 0, epsilon: 1.0, totalReward: 0, qTableSize: 0,
      bestScoreEver: 0, avgScoreLast100: 0, currentLevel: 1, totalStepsEver: 0, levelSuccessRate: 0,
      scoreHistory: [], epsilonHistory: []
    };
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qAgentRef = useRef<QLearningAgent>(new QLearningAgent());
  const requestRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);
  const levelClearsRef = useRef<number>(0);
  const [currentQValues, setCurrentQValues] = useState<number[]>([0, 0, 0, 0]);

  const statsInternalRef = useRef<QLearningStats>(qStats);
  const localScoreHistoryRef = useRef<number[]>(qStats.scoreHistory);
  const localEpsilonHistoryRef = useRef<number[]>(qStats.epsilonHistory);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const saveInterval = setInterval(() => {
      qAgentRef.current.saveToStorage();
      localStorage.setItem('qs_v6_stats', JSON.stringify(statsInternalRef.current));
    }, 5000);
    return () => clearInterval(saveInterval);
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cellSize = canvas.width / GRID_SIZE;
    ctx.fillStyle = '#010103';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const activeGame = qAgentRef.current.game;
    const state = activeGame.state;

    // Subtle Grid
    ctx.strokeStyle = '#0a0a20';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath(); ctx.moveTo(i * cellSize, 0); ctx.lineTo(i * cellSize, canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * cellSize); ctx.lineTo(canvas.width, i * cellSize); ctx.stroke();
    }

    // Walls
    ctx.fillStyle = '#1e293b';
    state.walls.forEach(w => {
      ctx.fillRect(w.x * cellSize, w.y * cellSize, cellSize, cellSize);
      ctx.strokeStyle = '#475569';
      ctx.strokeRect(w.x * cellSize + 2, w.y * cellSize + 2, cellSize - 4, cellSize - 4);
    });

    // Portal
    if (state.portalOpen && state.portalPoint) {
      const p = state.portalPoint;
      const grad = ctx.createRadialGradient(
        (p.x + 0.5) * cellSize, (p.y + 0.5) * cellSize, 2,
        (p.x + 0.5) * cellSize, (p.y + 0.5) * cellSize, cellSize * 2.5
      );
      grad.addColorStop(0, '#d8b4fe');
      grad.addColorStop(0.5, '#9333ea');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc((p.x + 0.5) * cellSize, (p.y + 0.5) * cellSize, cellSize * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Special Items
    state.specialItems.forEach(item => {
      let color = '#fbbf24';
      let icon = '⭐';
      if (item.type === ItemType.GOLD) color = '#f59e0b';
      if (item.type === ItemType.SCISSORS) { color = '#94a3b8'; icon = '✂️'; }
      if (item.type === ItemType.ICE) { color = '#0ea5e9'; icon = '❄️'; }

      ctx.fillStyle = color;
      ctx.shadowBlur = 15; ctx.shadowColor = color;
      ctx.beginPath();
      ctx.arc((item.point.x + 0.5) * cellSize, (item.point.y + 0.5) * cellSize, cellSize / 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      
      ctx.fillStyle = 'black';
      ctx.font = `bold ${cellSize * 0.5}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(icon, (item.point.x + 0.5) * cellSize, (item.point.y + 0.7) * cellSize);
    });

    // Food
    ctx.fillStyle = '#fb7185';
    ctx.shadowBlur = 30; ctx.shadowColor = '#fb7185';
    ctx.beginPath();
    ctx.arc((state.food.x + 0.5) * cellSize, (state.food.y + 0.5) * cellSize, cellSize / 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Snake
    state.snake.forEach((p, i) => {
      const isHead = i === 0;
      const progress = i / Math.max(1, state.snake.length - 1);
      ctx.fillStyle = isHead ? '#34d399' : `rgb(20, ${Math.floor(180 - progress * 120)}, ${Math.floor(220 + progress * 35)})`;
      if (state.isGameOver) ctx.fillStyle = '#4b5563';
      ctx.beginPath();
      ctx.roundRect(p.x * cellSize + 1, p.y * cellSize + 1, cellSize - 2, cellSize - 2, isHead ? 14 : 7);
      ctx.fill();
      
      if (isHead) {
        ctx.fillStyle = 'white';
        ctx.fillRect(p.x * cellSize + cellSize*0.25, p.y * cellSize + cellSize*0.3, cellSize*0.15, cellSize*0.15);
        ctx.fillRect(p.x * cellSize + cellSize*0.6, p.y * cellSize + cellSize*0.3, cellSize*0.15, cellSize*0.15);
      }
    });

    // Vision rays
    if (modeRef.current === GameMode.AI_WATCH) {
      const vision = activeGame.getVisionExtended();
      const head = state.snake[0];
      const neck = state.snake[1];
      let forward = { x: 0, y: -1 };
      if (neck) forward = { x: head.x - neck.x, y: head.y - neck.y };

      vision.forEach(v => {
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.moveTo((head.x + 0.5) * cellSize, (head.y + 0.5) * cellSize);
        ctx.lineTo((v.point.x + 0.5) * cellSize, (v.point.y + 0.5) * cellSize);
        
        const isForward = v.direction.x === forward.x && v.direction.y === forward.y;
        ctx.lineWidth = isForward ? 2 : 1;
        
        if (v.foodFound) {
           ctx.strokeStyle = 'rgba(251, 113, 133, 0.6)';
        } else if (v.itemFound) {
           ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
        } else if (v.wallFound || v.bodyFound) {
           ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
        } else {
           ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        }
        
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }
  }, []);

  const animate = useCallback((time: number) => {
    const isWatch = modeRef.current === GameMode.AI_WATCH;
    const isTraining = modeRef.current === GameMode.TRAINING;
    
    const delta = time - lastUpdateRef.current;
    const activeGame = qAgentRef.current.game;
    const fpsLimit = isWatch ? (activeGame.state.slowEffectSteps > 0 ? 10 : 35) : 0;

    if (isTraining || delta > 1000 / (fpsLimit || 10000)) {
      lastUpdateRef.current = time;
      
      const iterations = isTraining ? 7500 : 1;
      let batchEpisodes = 0;

      for (let i = 0; i < iterations; i++) {
        const game = qAgentRef.current.game;
        if (game.state.isGameOver) {
          batchEpisodes++;
          const score = game.state.score;
          localScoreHistoryRef.current.push(score);
          if (localScoreHistoryRef.current.length > 500) localScoreHistoryRef.current.shift();
          
          if (localScoreHistoryRef.current.length % 8 === 0) {
             localEpsilonHistoryRef.current.push(qAgentRef.current.epsilon);
             if (localEpsilonHistoryRef.current.length > 500) localEpsilonHistoryRef.current.shift();
          }
          qAgentRef.current.reset();
        }
        
        const oldLevel = qAgentRef.current.game.state.level;
        qAgentRef.current.update();
        if (qAgentRef.current.game.state.level > oldLevel) levelClearsRef.current++;
      }

      const recentScores = localScoreHistoryRef.current.slice(-100);
      const avg = recentScores.length > 0 ? (recentScores.reduce((a, b) => a + b, 0) / recentScores.length) : 0;
      
      const newStats: QLearningStats = {
        ...statsInternalRef.current,
        episodes: statsInternalRef.current.episodes + batchEpisodes,
        epsilon: qAgentRef.current.epsilon,
        bestScoreEver: Math.max(statsInternalRef.current.bestScoreEver, ...localScoreHistoryRef.current.slice(-Math.max(1, batchEpisodes))),
        qTableSize: qAgentRef.current.qTable.size,
        avgScoreLast100: parseFloat(avg.toFixed(2)),
        currentLevel: qAgentRef.current.game.state.level,
        totalStepsEver: qAgentRef.current.totalStepsEver,
        levelSuccessRate: parseFloat(((levelClearsRef.current / Math.max(1, statsInternalRef.current.episodes + batchEpisodes)) * 100).toFixed(2)),
        scoreHistory: [...localScoreHistoryRef.current],
        epsilonHistory: [...localEpsilonHistoryRef.current]
      };

      statsInternalRef.current = newStats;
      setQStats(newStats);
      setCurrentScore(qAgentRef.current.game.state.score);
      setLevel(qAgentRef.current.game.state.level);
      
      if (isWatch) {
        setCurrentQValues(qAgentRef.current.getCurrentStateQValues());
        draw();
      } else if (isTraining && Math.random() < 0.05) {
        draw();
      }
    }
    requestRef.current = requestAnimationFrame(animate);
  }, [draw]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [animate]);

  return (
    <div className="flex h-screen w-screen bg-[#010105] text-slate-200 overflow-hidden font-sans">
      {/* SIDEBAR PANEL */}
      <div className="w-[420px] glass p-8 flex flex-col gap-8 border-r border-white/10 z-20 overflow-y-auto scrollbar-hide">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-emerald-500/30 border border-emerald-400 transform rotate-1">
             <div className="text-4xl">🦎</div>
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-white leading-none">CORE <span className="text-emerald-500">SNAKE</span></h1>
            <p className="text-[10px] uppercase tracking-[0.4em] text-white/30 font-black mt-2">Tabular Intelligence Lab</p>
          </div>
        </div>

        {/* MODE SWITCHER */}
        <div className="flex gap-2 p-1.5 bg-white/5 rounded-2xl border border-white/10">
          {[GameMode.AI_WATCH, GameMode.TRAINING].map(m => (
            <button key={m} onClick={() => setMode(m)} className={`flex-1 py-3 text-sm rounded-xl font-black transition-all duration-200 ${mode === m ? 'bg-emerald-600 text-white shadow-lg' : 'text-white/30 hover:bg-white/10 hover:text-white'}`}>
              {m.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* CORE ANALYTICS */}
        <div className="space-y-6">
           <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 p-6 rounded-2xl border border-white/5 shadow-inner">
                <div className="text-[10px] text-emerald-400 font-black uppercase tracking-widest mb-2 opacity-70">Memory Graph</div>
                <div className="text-3xl font-black text-white mono leading-none">{qStats.qTableSize.toLocaleString()}</div>
              </div>
              <div className="bg-white/5 p-6 rounded-2xl border border-white/5 shadow-inner">
                <div className="text-[10px] text-emerald-400 font-black uppercase tracking-widest mb-2 opacity-70">Sim Iterations</div>
                <div className="text-3xl font-black text-white mono leading-none">{(qStats.totalStepsEver / 1000000).toFixed(1)}M</div>
              </div>
           </div>

           <div className="bg-gradient-to-br from-emerald-950/40 via-black to-black p-8 rounded-[2rem] border border-emerald-500/20 shadow-xl relative overflow-hidden">
              <div className="relative z-10 flex justify-between items-end">
                <div>
                   <div className="text-[10px] text-emerald-400 font-black uppercase tracking-[0.3em] mb-2">Peak Performance</div>
                   <div className="text-7xl font-black text-white mono leading-none tracking-tighter">{qStats.bestScoreEver}</div>
                </div>
                <div className="text-right">
                   <div className="text-[10px] text-white/40 font-black uppercase mb-1">Sector</div>
                   <div className="text-2xl font-black text-emerald-400 mono">L-{level}</div>
                </div>
              </div>
           </div>

           {/* CHARTS */}
           <div className="space-y-6 pt-6 border-t border-white/5">
              <SimpleChart data={qStats.scoreHistory} color="#10b981" label="Performance Convergence" height={80} />
              <SimpleChart data={qStats.epsilonHistory} color="#fbbf24" label="Entropy Rate (Exploration)" height={80} />
           </div>

           <div className="bg-white/5 p-6 rounded-2xl border border-white/5 space-y-4 shadow-inner">
              <div className="flex justify-between items-center">
                 <span className="text-xs font-black text-white/30 uppercase tracking-[0.2em]">Episodes</span>
                 <span className="text-xl font-black text-white mono">{qStats.episodes.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                 <span className="text-xs font-black text-white/30 uppercase tracking-[0.2em]">Mastery Rate</span>
                 <span className="text-xl font-black text-blue-400 mono">{qStats.levelSuccessRate}%</span>
              </div>
              <div className="flex justify-between items-center">
                 <span className="text-xs font-black text-white/30 uppercase tracking-[0.2em]">Rolling Avg</span>
                 <span className="text-xl font-black text-emerald-400 mono">{qStats.avgScoreLast100}</span>
              </div>
           </div>
        </div>

        <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="w-full py-4 bg-red-950/10 text-red-500 border border-red-500/20 rounded-xl font-black text-[10px] uppercase tracking-[0.4em] hover:bg-red-500/10 transition-all mt-auto">
          Purge Cognitive Memory
        </button>
      </div>

      {/* PRIMARY STAGE */}
      <div className="flex-1 flex flex-col items-center justify-center p-12 relative bg-[#010105]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#10b98108_0%,_transparent_75%)] opacity-80"></div>
        
        <div className="relative p-3 bg-white/5 rounded-[4rem] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)]">
          <canvas ref={canvasRef} width={800} height={800} className="rounded-[3.2rem] bg-black block shadow-2xl" />
          
          {/* FLOATING HUD */}
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex gap-10 items-center glass px-10 py-5 rounded-full border border-white/20 shadow-2xl backdrop-blur-3xl transform scale-90 lg:scale-100">
             <div className="flex flex-col items-center">
               <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.4em] mb-1">Score</span>
               <span className="text-4xl font-black text-white mono leading-none">{currentScore}</span>
             </div>
             <div className="w-px h-10 bg-white/10"></div>
             <div className="flex flex-col items-center min-w-[180px]">
               <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.4em] mb-1">Priority Vector</span>
               <span className={`text-sm font-black uppercase tracking-widest text-center ${qAgentRef.current.game.state.portalOpen ? 'text-purple-400 animate-pulse' : 'text-emerald-400'}`}>
                 {qAgentRef.current.game.state.portalOpen ? 'SECTOR PORTAL' : 'TRACKING TARGET'}
               </span>
             </div>
             <div className="w-px h-10 bg-white/10"></div>
             <div className="flex flex-col items-center">
               <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.4em] mb-1">Mode</span>
               <div className="flex items-center gap-3">
                 <div className={`w-3 h-3 rounded-full ${mode === GameMode.TRAINING ? 'bg-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.7)]' : 'bg-emerald-500 shadow-[0_0_15px_#10b981]'}`}></div>
                 <span className="text-[10px] font-black text-white uppercase tracking-widest">{mode.replace('_', ' ')}</span>
               </div>
             </div>
          </div>
        </div>

        {/* DECISION MATRIX */}
        <div className="mt-16 w-full max-w-[800px] grid grid-cols-2 gap-10">
           <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
              <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.5em] mb-6">Neural Utility Map (Q)</h3>
              <div className="grid grid-cols-4 gap-6">
                 {['UP', 'DOWN', 'LEFT', 'RIGHT'].map((dir, idx) => {
                    const val = currentQValues[idx];
                    const max = Math.max(...currentQValues);
                    const isBest = val === max && val !== 0;
                    return (
                      <div key={dir} className="flex flex-col items-center">
                        <div className={`w-full h-20 bg-white/5 rounded-2xl relative overflow-hidden flex flex-col justify-end p-1.5 border-2 ${isBest ? 'border-emerald-500/50 shadow-[0_0_20px_#10b98115]' : 'border-white/5'}`}>
                           <div className={`w-full ${isBest ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-white/10'} rounded-xl transition-all duration-500`} style={{height: `${Math.min(100, Math.max(10, (val / (max || 1)) * 100))}%`}}></div>
                        </div>
                        <span className={`text-[9px] font-black mt-3 tracking-widest ${isBest ? 'text-emerald-400' : 'text-white/30'}`}>{dir}</span>
                        <span className="text-[10px] font-black mono mt-1 text-white/80">{val.toFixed(2)}</span>
                      </div>
                    );
                 })}
              </div>
           </div>

           <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 flex flex-col justify-between shadow-2xl">
              <div>
                 <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.5em] mb-6">System Heuristics</h3>
                 <div className="space-y-4">
                    <div className="flex items-center justify-between">
                       <span className="text-xs text-white/40 font-black uppercase tracking-widest">Optimizer</span>
                       <span className="text-xs text-white font-black mono px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">TD(0)</span>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="text-xs text-white/40 font-black uppercase tracking-widest">Descriptor</span>
                       <span className="text-[10px] text-emerald-400 font-bold mono truncate max-w-[180px] bg-black/40 border border-white/10 px-3 py-1.5 rounded-lg">{qAgentRef.current.getStateString()}</span>
                    </div>
                 </div>
              </div>
              <div className="mt-6 pt-6 border-t border-white/10 text-center">
                 <p className="text-[10px] font-black text-white/20 leading-relaxed uppercase tracking-[0.2em] italic animate-pulse">
                   "Neural pathways specialized for sector {level} geometry..."
                 </p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default App;
