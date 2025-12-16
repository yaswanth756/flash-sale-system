"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Database,
  Server,
  Activity,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  Cpu,
  BarChart3,
  Layers,
  Settings,
  Lock,
  Globe,
  Code2,
  FileCode,
  Terminal,
  LucideIcon,
  ShoppingBag,
  Smartphone
} from "lucide-react";

// --- Types & Constants ---
const API_URL = "http://localhost:8080";
const PRODUCT_IMAGE = "https://images.unsplash.com/photo-1695048133142-1a20484d2569?q=80&w=1000&auto=format&fit=crop";

type Mode = "naive" | "postgres" | "redis";

interface Stats {
  total_requests: number;
  success: number;
  failed: number;
  oversells: number;
  avg_latency_ms: number;
  db_stock: number;
  redis_stock: number;
  order_count: number;
}

interface TestResult {
  mode: Mode;
  totalRequests: number;
  successCount: number;
  failCount: number;
  avgLatency: number;
  finalStock: number;
  oversells: number;
  duration: number;
  throughput: number;
}

const modeConfig = {
  naive: {
    name: "No Lock",
    tech: "Go + PostgreSQL",
    description: "No protection. Multiple requests read same stock = overselling!",
    color: "rose",
    endpoint: "/purchase/naive",
  },
  postgres: {
    name: "DB Lock",
    tech: "Go + PostgreSQL FOR UPDATE",
    description: "Row-level locking. Safe but slower due to lock waiting.",
    color: "amber",
    endpoint: "/purchase/postgres",
  },
  redis: {
    name: "Redis Lock",
    tech: "Go + Redis Lua Script",
    description: "Atomic in-memory counter. Fast and safe for high traffic.",
    color: "emerald",
    endpoint: "/purchase/redis",
  },
};

// --- Components ---

// 1. Tech Badge
const TechBadge = ({ icon: Icon, label, color }: { icon: LucideIcon; label: string; color: string }) => (
  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-white/50 backdrop-blur-sm shadow-sm transition-transform hover:scale-105 ${color}`}>
    <Icon className="w-4 h-4" />
    <span className="text-xs font-bold tracking-wide">{label}</span>
  </div>
);

// 2. Architecture Visualizer
const ArchitectureVisualizer = ({ mode, isRunning }: { mode: Mode; isRunning: boolean }) => {
  const getDbBorderColor = () => {
    if (mode === 'redis') return 'border-emerald-500';
    if (mode === 'naive') return 'border-rose-500';
    return 'border-amber-500';
  };

  const getDbIcon = () => {
    if (mode === 'redis') return <Zap className="w-6 h-6 text-emerald-600" />;
    if (mode === 'naive') return <Database className="w-6 h-6 text-rose-600" />;
    return <Database className="w-6 h-6 text-amber-600" />;
  };

  const getPacketColor = () => {
    if (mode === 'redis') return 'bg-emerald-500';
    return 'bg-amber-500';
  };

  return (
    <div className="relative h-48 w-full bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex items-center justify-between px-8 md:px-16">
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

      {/* User Node */}
      <div className="relative z-10 flex flex-col items-center gap-2">
        <div className="w-12 h-12 rounded-xl bg-white border-2 border-slate-300 shadow-sm flex items-center justify-center">
          <Globe className="w-6 h-6 text-slate-500" />
        </div>
        <span className="text-xs font-semibold text-slate-500">Clients</span>
      </div>

      {/* Line 1 (Client -> API) */}
      <div className="flex-1 h-0.5 bg-slate-200 relative mx-4">
        {isRunning && (
          <motion.div
            className="absolute top-1/2 -mt-1 w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"
            initial={{ left: "0%" }}
            animate={{ left: "100%" }}
            transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
          />
        )}
      </div>

      {/* Backend Node */}
      <div className="relative z-10 flex flex-col items-center gap-2">
        <div className="w-14 h-14 rounded-xl border-2 shadow-sm flex items-center justify-center bg-white border-blue-500">
          <Server className="w-7 h-7 text-blue-600" />
        </div>
        <span className="text-xs font-bold text-blue-700">Go API</span>
      </div>

      {/* Line 2 (API -> DB) */}
      <div className="flex-1 h-0.5 bg-slate-200 relative mx-4">
        {isRunning && (
          <motion.div
            className={`absolute top-1/2 -mt-1 w-2 h-2 rounded-full shadow-lg ${getPacketColor()}`}
            initial={{ left: "0%" }}
            animate={{ left: "100%" }}
            transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
          />
        )}
      </div>

      {/* DB/Cache Node */}
      <div className="relative z-10 flex flex-col items-center gap-2">
        <div className={`w-12 h-12 rounded-xl border-2 shadow-sm flex items-center justify-center bg-white ${getDbBorderColor()}`}>
          {getDbIcon()}
        </div>
        <span className={`text-xs font-bold ${mode === 'redis' ? 'text-emerald-700' : mode === 'naive' ? 'text-rose-700' : 'text-amber-700'}`}>
          {mode === 'redis' ? 'Redis' : 'Postgres'}
        </span>
      </div>
    </div>
  );
};

// 3. Technical Explainer
const TechnicalExplainer = () => {
  return (
    <section className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Card 1: Naive */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all">
        <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center mb-4">
          <AlertTriangle className="w-5 h-5 text-rose-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">The Race Condition</h3>
        <p className="text-sm text-slate-500 mb-4 leading-relaxed">
          The "Naive" approach reads stock, checks if it&apos;s &gt; 0, and then writes stock - 1. In high concurrency,
          multiple threads read the <b>same value</b> before anyone writes.
        </p>
        <div className="bg-slate-900 rounded-lg p-3 overflow-hidden">
          <pre className="text-[10px] font-mono text-rose-300 whitespace-pre-wrap">
            {`// Bad Code 
stock = db.Query("SELECT stock")
if stock > 0 {
  db.Exec("UPDATE stock-1")
}`}
          </pre>
        </div>
      </div>

      {/* Card 2: Postgres */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all">
        <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center mb-4">
          <Lock className="w-5 h-5 text-amber-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">Pessimistic Locking</h3>
        <p className="text-sm text-slate-500 mb-4 leading-relaxed">
          Using <code className="bg-slate-100 px-1 rounded text-slate-700">FOR UPDATE</code> locks the row in Postgres.
          Transactions must <b>wait</b> until the lock is released. Safe (ACID) but slow.
        </p>
        <div className="bg-slate-900 rounded-lg p-3 overflow-hidden">
          <pre className="text-[10px] font-mono text-amber-300 whitespace-pre-wrap">
            {`// SQL Transaction
BEGIN;
SELECT * FROM items 
WHERE id=1 FOR UPDATE;
UPDATE items SET stock=stock-1;
COMMIT;`}
          </pre>
        </div>
      </div>

      {/* Card 3: Redis */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all">
        <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center mb-4">
          <Zap className="w-5 h-5 text-emerald-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">Redis Atomicity</h3>
        <p className="text-sm text-slate-500 mb-4 leading-relaxed">
          Redis is single-threaded. Operations like <code className="bg-slate-100 px-1 rounded text-slate-700">DECR</code> happen atomically.
          We use Redis as a high-speed &quot;gatekeeper&quot; before hitting the DB.
        </p>
        <div className="bg-slate-900 rounded-lg p-3 overflow-hidden">
          <pre className="text-[10px] font-mono text-emerald-300 whitespace-pre-wrap">
            {`// Redis Lua Script
local stock = redis.call("get", k)
if stock > 0 then
  return redis.call("decr", k)
end
return -1`}
          </pre>
        </div>
      </div>
    </section>
  );
};

// --- Main Dashboard Component ---

export default function Dashboard() {
  const [selectedMode, setSelectedMode] = useState<Mode>("redis");
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [requestCount, setRequestCount] = useState(1000);
  const [concurrency, setConcurrency] = useState(100);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch { }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 500);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const handleModeChange = async (mode: Mode) => {
    if (mode !== selectedMode && !isRunning) {
      setSelectedMode(mode);
      try {
        await fetch(`${API_URL}/reset`, { method: "POST" });
        await new Promise(r => setTimeout(r, 100));
        await fetchStats();
      } catch (e) { console.error(e); }
    }
  };

  const handleReset = async () => {
    try {
      await fetch(`${API_URL}/reset`, { method: "POST" });
      await fetchStats();
    } catch (e) { console.error(e); }
  };

  const runAttack = async () => {
    setIsRunning(true);
    const startTime = Date.now();
    const config = modeConfig[selectedMode];
    let successCount = 0;
    let failCount = 0;
    let totalLatency = 0;

    const makeRequest = async () => {
      const start = Date.now();
      try {
        const res = await fetch(`${API_URL}${config.endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: Math.floor(Math.random() * 10000), product_id: 1 }),
        });
        totalLatency += Date.now() - start;
        if (res.ok) successCount++; else failCount++;
      } catch {
        failCount++;
        totalLatency += Date.now() - start;
      }
    };

    const runBatch = async (tasks: (() => Promise<void>)[], batchSize: number) => {
      for (let i = 0; i < tasks.length; i += batchSize) {
        await Promise.all(tasks.slice(i, i + batchSize).map(t => t()));
      }
    };

    const tasks = Array(requestCount).fill(null).map(() => makeRequest);
    await runBatch(tasks, concurrency);

    const duration = Date.now() - startTime;
    await new Promise(r => setTimeout(r, 200));
    const statsRes = await fetch(`${API_URL}/stats`);
    const freshStats = await statsRes.json();

    const initialStock = 100;
    const actualOrderCount = freshStats.order_count ?? successCount;
    const oversellAmount = actualOrderCount > initialStock ? actualOrderCount - initialStock : 0;
    const dbStockNegative = (freshStats.db_stock ?? 0) < 0 ? Math.abs(freshStats.db_stock) : 0;
    const totalOversells = Math.max(oversellAmount, dbStockNegative);

    setTestResults(prev => [{
      mode: selectedMode,
      totalRequests: requestCount,
      successCount,
      failCount,
      avgLatency: totalLatency / requestCount,
      finalStock: freshStats.db_stock ?? 0,
      oversells: totalOversells,
      duration,
      throughput: Math.round(requestCount / (duration / 1000))
    }, ...prev]);

    setStats(freshStats);
    setIsRunning(false);
  };

  const stockColor = (stats?.db_stock ?? 0) === 0 ? "text-rose-500" : (stats?.db_stock ?? 0) < 20 ? "text-amber-500" : "text-slate-900";

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans p-4 md:p-8">

      {/* Header */}
      <header className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-600" />
            High-Concurrency Simulator
          </h1>
          <p className="text-sm text-slate-500 mt-1">Real-time race condition & locking visualization</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <TechBadge icon={Code2} label="Golang" color="border-cyan-200 text-cyan-700 bg-cyan-50" />
          <TechBadge icon={Database} label="PostgreSQL" color="border-blue-200 text-blue-700 bg-blue-50" />
          <TechBadge icon={Zap} label="Redis" color="border-rose-200 text-rose-700 bg-rose-50" />
          <TechBadge icon={Layers} label="Next.js" color="border-slate-200 text-slate-700 bg-slate-50" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* LEFT COLUMN: Controls & Visuals */}
          <div className="lg:col-span-8 flex flex-col gap-6">

            {/* Visualizer */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-slate-400" />
                  Select Strategy
                </h2>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  {(Object.keys(modeConfig) as Mode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => handleModeChange(m)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${selectedMode === m ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      {modeConfig[m].name}
                    </button>
                  ))}
                </div>
              </div>

              <ArchitectureVisualizer mode={selectedMode} isRunning={isRunning} />

              <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 p-1.5 rounded-full ${selectedMode === 'naive' ? 'bg-rose-100 text-rose-600' : selectedMode === 'postgres' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                    {selectedMode === 'naive' ? <AlertTriangle className="w-4 h-4" /> : selectedMode === 'postgres' ? <Lock className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{modeConfig[selectedMode].tech}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{modeConfig[selectedMode].description}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Results Feed */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 pl-1">Benchmarks</h3>
              <AnimatePresence>
                {testResults.map((res, i) => {
                  const isFail = res.oversells > 0;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${modeConfig[res.mode].color === 'emerald' ? 'bg-emerald-500' : modeConfig[res.mode].color === 'amber' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                          <span className="font-bold text-slate-900">{modeConfig[res.mode].name}</span>
                          <span className="text-xs text-slate-400">| {res.totalRequests} reqs @ {res.throughput.toLocaleString()}/sec</span>
                        </div>
                        {isFail ? (
                          <span className="px-2 py-1 bg-rose-50 text-rose-700 text-xs font-bold rounded border border-rose-100 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> {res.oversells} Oversold
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded border border-emerald-100 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> Safe
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-4 gap-4 border-t border-slate-100 pt-4">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-400">Latency</p>
                          <p className="text-lg font-bold text-slate-700">{res.avgLatency.toFixed(0)}ms</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-400">Orders Filled</p>
                          <p className={`text-lg font-bold ${res.successCount > 100 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {res.successCount}<span className="text-slate-400 text-sm">/100</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-400">Rejected</p>
                          <p className="text-lg font-bold text-slate-500">{res.failCount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-400">Exec Time</p>
                          <p className="text-lg font-bold text-slate-700">{(res.duration / 1000).toFixed(2)}s</p>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* RIGHT COLUMN: Live Monitor */}
          <div className="lg:col-span-4 flex flex-col gap-4">

            {/* Product & Stock Monitor - COMPACT VERSION */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden group">

              {/* Product Image Section - Reduced Height */}
              <div className="relative h-64 bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4 border-b border-slate-100">
                <div className="absolute top-3 right-3 z-10">
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-rose-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-full shadow-lg animate-pulse">
                    <Zap className="w-3 h-3 fill-white" /> Flash Sale
                  </span>
                </div>
                <img
                  src={PRODUCT_IMAGE}
                  alt="iPhone 15 Pro"
                  className="h-full w-full object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-105"
                />
              </div>

              {/* Product Info - Tighter Spacing */}
              <div className="p-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 leading-tight">iPhone 15 Pro Max</h3>
                    <p className="text-xs font-medium text-slate-500 mt-1">Natural Titanium · 256GB</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-slate-900">$999</p>
                    <p className="text-[10px] font-bold text-slate-400 line-through">$1,199</p>
                  </div>
                </div>

                {/* Stock Counter */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Inventory</span>
                    <div className={`w-2 h-2 rounded-full ${stats?.db_stock ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  </div>

                  <div className="flex items-baseline gap-1">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={stats?.db_stock}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`text-4xl font-black tracking-tighter tabular-nums ${stockColor}`}
                      >
                        {stats?.db_stock ?? 0}
                      </motion.div>
                    </AnimatePresence>
                    <span className="text-base font-bold text-slate-400">/ 100</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
                    <motion.div
                      className={`h-full ${stats?.db_stock && stats.db_stock < 20 ? 'bg-rose-500' : 'bg-blue-600'}`}
                      animate={{ width: `${Math.max(0, Math.min(100, (stats?.db_stock ?? 0)))}%` }}
                      transition={{ type: "spring", stiffness: 50 }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Control Panel - Immediately Below */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Requests</label>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Concurrency</label>
                </div>
                <div className="flex gap-3">
                  <input type="number" value={requestCount} onChange={e => setRequestCount(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500" />
                  <input type="number" value={concurrency} onChange={e => setConcurrency(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-blue-500" />
                </div>
              </div>

              <button
                onClick={runAttack}
                disabled={isRunning}
                className={`w-full py-3 rounded-xl font-bold text-white shadow-lg shadow-blue-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 ${isRunning ? 'bg-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:to-indigo-500'}`}
              >
                {isRunning ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
                {isRunning ? 'Running...' : 'Launch Attack'}
              </button>

              <button
                onClick={handleReset}
                className="w-full mt-2 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Latency</p>
                <p className="text-lg font-bold text-slate-900">{stats?.avg_latency_ms?.toFixed(0) ?? 0}ms</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Processed</p>
                <p className="text-lg font-bold text-slate-900">{stats?.order_count?.toLocaleString() ?? 0}</p>
              </div>
            </div>

          </div>
        </div>

        {/* Technical Deep Dive Section */}
        <div className="mt-16 mb-8 border-t border-slate-200 pt-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-slate-900 rounded-lg">
              <FileCode className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Technical Deep Dive</h2>
          </div>
          <TechnicalExplainer />
        </div>

      </main>
    </div>
  );
}