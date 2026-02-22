// ============================================================
// FOUNDER MATH LAB — Explorable Explanation
// Single React JSX artifact — all components inline
// ============================================================
//
// AI Integration Config:
//   AI_PROVIDER = "anthropic" | "openai" | "none"
//
// To enable Anthropic Claude coaching:
//   1. Set AI_PROVIDER = "anthropic"
//   2. Before loading the app: window.ANTHROPIC_API_KEY = "sk-ant-..."
//
// To enable OpenAI coaching:
//   1. Set AI_PROVIDER = "openai"
//   2. Before loading the app: window.OPENAI_API_KEY = "sk-..."
//
// If AI_PROVIDER = "none", the coach uses deterministic heuristics.
// The app fully functions without any API key.
// ============================================================

import React, {
  useState, useMemo, useCallback, useRef, useEffect, memo,
} from 'react';

// ── AI Config ───────────────────────────────────────────────
const AI_PROVIDER = 'none'; // "anthropic" | "openai" | "none"
const AI_MODELS = { anthropic: 'claude-opus-4-5', openai: 'gpt-4o-mini' };

// ── Formatters ───────────────────────────────────────────────
const fmt = {
  currency: (n) => {
    if (n == null || isNaN(n)) return '$—';
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
    return `${sign}$${abs.toFixed(0)}`;
  },
  pct: (n, d = 1) => `${Number(n).toFixed(d)}%`,
  months: (n) => `${Math.round(n)} mo`,
  ratio: (n) => `${Number(n).toFixed(1)}x`,
  num: (n) => Number(n).toLocaleString(),
};

// ── Default State (mediocre ~42 score to start) ───────────────
const DEFAULTS = {
  market: {
    tam: 5_000_000_000,   // $5B — OK but not massive
    samPct: 15,            // 15% reachable
    somPct: 8,             // 8% SOM — suspiciously optimistic → Warning
    horizon: 5,            // 5 years
    targetARR: 10_000_000, // $10M ARR goal
  },
  unit: {
    price: 99,             // $99/mo — low for B2B
    billing: 'monthly',    // 'monthly' | 'annual'
    grossMargin: 55,       // 55% — below SaaS norms (70%+)
    cac: 800,              // $800 CAC — high for this price
    churnMonthly: 5,       // 5% monthly churn — painful
  },
  runway: {
    startingCash: 1_500_000,   // $1.5M seed
    totalMonthlyBurn: 120_000, // $120K/mo burn
    burnHeadcount: 60,         // 60% headcount
    burnInfra: 20,             // 20% infra
    burnOps: 20,               // 20% ops
    monthlyRevenue: 15_000,    // $15K MRR
    revenueGrowthMoM: 8,       // 8% MoM growth
    fundraiseMonth: 0,         // no planned raise
    fundraiseAmount: 0,
    safeCapPercent: 20,        // 20% SAFE dilution
    optionPool: 15,            // 15% option pool
  },
};

// ── Scoring Engine ────────────────────────────────────────────
// Returns { score: 0-100, flags: [{id, module, severity, msg, detail, fix}] }
// Heuristics are investor-grade rules of thumb, not magic formulas.
function computeScore(market, unit, runway) {
  const flags = [];
  let score = 0;

  // ── MODULE 1: Market ──────────────────────────────────────
  const sam = market.tam * (market.samPct / 100);
  const som = sam * (market.somPct / 100);

  // TAM size: venture requires meaningful exit potential
  if (market.tam >= 10_000_000_000) score += 20;
  else if (market.tam >= 1_000_000_000) score += 13;
  else {
    flags.push({
      id: 'tam_small', module: 1, severity: 'critical',
      msg: 'TAM too small for venture',
      detail: `$${(market.tam / 1e6).toFixed(0)}M TAM limits exit size. VCs need $1B+ markets.`,
      fix: 'Reframe your market. Think total category, not initial niche.',
    });
  }

  // SOM realism: capturing >10% of SAM quickly is a red flag
  if (market.somPct <= 5) score += 15;
  else if (market.somPct <= 10) score += 8;
  else {
    flags.push({
      id: 'som_high', module: 1, severity: 'warning',
      msg: `SOM ${market.somPct}% of SAM is aggressive`,
      detail: `Most B2B SaaS companies capture 3–8% of SAM in 5 years.`,
      fix: `Drop SOM to 5–8% and back it with a clear GTM sequence.`,
    });
  }

  // SOM absolute: should be meaningful
  if (som >= 100_000_000) score += 10;
  else if (som >= 30_000_000) score += 5;
  else {
    flags.push({
      id: 'som_abs', module: 1, severity: 'warning',
      msg: `SOM ${fmt.currency(som)} too small`,
      detail: 'Venture-backed startups need a path to $100M+ revenue.',
      fix: 'Expand TAM definition or justify why a larger share is reachable.',
    });
  }

  // ── MODULE 2: Unit Economics ──────────────────────────────
  const monthlyPrice = unit.billing === 'monthly' ? unit.price : unit.price / 12;
  const grossRevPerMonth = monthlyPrice * (unit.grossMargin / 100);
  const churnRate = unit.churnMonthly / 100;
  const ltv = churnRate > 0 ? grossRevPerMonth / churnRate : 999_999;
  const payback = grossRevPerMonth > 0 ? unit.cac / grossRevPerMonth : 999;
  const ltvCac = unit.cac > 0 ? ltv / unit.cac : 0;
  const avgLifespanMonths = churnRate > 0 ? 1 / churnRate : 999;

  // LTV/CAC: the core SaaS efficiency metric
  if (ltvCac >= 5) score += 20;
  else if (ltvCac >= 3) score += 12;
  else if (ltvCac >= 2) score += 5;
  else {
    flags.push({
      id: 'ltvcac_low', module: 2, severity: 'critical',
      msg: `LTV/CAC ${fmt.ratio(ltvCac)} — below minimum`,
      detail: 'Below 3x means you spend more acquiring customers than you recover in profit.',
      fix: 'Raise price, reduce churn, or cut CAC. Target 3x minimum, 5x for A-round.',
    });
  }

  // Payback period: shorter = better capital efficiency
  if (payback <= 6) score += 15;
  else if (payback <= 12) score += 8;
  else {
    flags.push({
      id: 'payback_long', module: 2, severity: 'warning',
      msg: `Payback ${Math.round(payback)} months`,
      detail: `It takes ${Math.round(payback)} months to recover CAC. >12mo is a cash flow risk.`,
      fix: 'Lower CAC via product-led growth, or raise price/reduce COGS.',
    });
  }

  // Gross margin: SaaS should be 70–80%+
  if (unit.grossMargin >= 70) score += 10;
  else if (unit.grossMargin >= 60) score += 5;
  else {
    flags.push({
      id: 'margin_low', module: 2, severity: 'warning',
      msg: `Gross margin ${unit.grossMargin}% — below SaaS norm`,
      detail: 'SaaS benchmarks: 70–80%+. Lower margin limits R&D and S&M investment.',
      fix: 'Audit COGS (support, hosting, third-party). Consider pricing strategy.',
    });
  }

  // High churn destroys LTV
  if (unit.churnMonthly >= 5) {
    flags.push({
      id: 'churn_high', module: 2, severity: 'warning',
      msg: `Monthly churn ${unit.churnMonthly}% — very high`,
      detail: `${unit.churnMonthly}% monthly = ${(100 - Math.pow(1 - unit.churnMonthly / 100, 12) * 100).toFixed(0)}% annual churn.`,
      fix: 'Invest in onboarding and customer success. Target <2% monthly for B2B.',
    });
  }

  // ── MODULE 3: Runway ──────────────────────────────────────
  let cash = runway.startingCash;
  let rev = runway.monthlyRevenue;
  let runwayMonths = 24; // assume survives if not found
  let breakevenMonth = null;
  const cashData = [cash];

  for (let m = 1; m <= 24; m++) {
    const netBurn = runway.totalMonthlyBurn - rev;
    cash -= netBurn;
    if (m === runway.fundraiseMonth && runway.fundraiseAmount > 0) {
      cash += runway.fundraiseAmount;
    }
    cashData.push(cash);
    if (cash <= 0 && runwayMonths === 24) runwayMonths = m - 1;
    if (netBurn <= 0 && breakevenMonth === null) breakevenMonth = m;
    rev *= 1 + runway.revenueGrowthMoM / 100;
  }

  const totalDilution = runway.safeCapPercent + runway.optionPool;
  const founderOwnership = Math.max(0, 100 - totalDilution);

  // Runway adequacy: 18+ months to close next round
  if (runwayMonths >= 18) score += 20;
  else if (runwayMonths >= 12) score += 10;
  else if (runwayMonths >= 6) score += 3;
  else {
    flags.push({
      id: 'runway_critical', module: 3, severity: 'critical',
      msg: `Only ${runwayMonths} months of runway`,
      detail: 'Fundraising takes 3–6 months. Under 12 months is an emergency.',
      fix: 'Cut burn aggressively, or start Series A prep immediately.',
    });
  }

  if (runwayMonths < 18) {
    flags.push({
      id: 'runway_short', module: 3, severity: 'warning',
      msg: `Runway ${runwayMonths} mo — target 18+`,
      detail: 'Less than 18 months means you may need to raise under pressure.',
      fix: 'Reduce burn, accelerate revenue, or plan a bridge round.',
    });
  }

  // Breakeven path
  if (breakevenMonth !== null && breakevenMonth <= 24) score += 10;
  else {
    flags.push({
      id: 'no_breakeven', module: 3, severity: 'warning',
      msg: 'No breakeven in 24 months',
      detail: 'No path to cash-flow positive without additional funding.',
      fix: 'Increase MoM growth rate or reduce burn to find breakeven.',
    });
  }

  // Dilution: founders should retain meaningful equity
  if (totalDilution <= 25) score += 5;
  else if (totalDilution <= 35) { /* neutral */ }
  else {
    flags.push({
      id: 'dilution_heavy', module: 3, severity: 'warning',
      msg: `${totalDilution}% total dilution — aggressive`,
      detail: `Founders at ${founderOwnership.toFixed(0)}% after seed. Heavy option pool eats returns.`,
      fix: 'Negotiate tighter SAFE cap or smaller option pool at hire.',
    });
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    flags,
    derived: { sam, som, ltv, payback, ltvCac, avgLifespanMonths, runwayMonths, breakevenMonth, cashData, founderOwnership, totalDilution },
  };
}

// ── Module completion heuristic ───────────────────────────────
// A module is "done" when its score contribution and flags are healthy
function checkModuleComplete(moduleId, flags, score) {
  const moduleFlags = flags.filter(f => f.module === moduleId);
  const hasCritical = moduleFlags.some(f => f.severity === 'critical');
  // Module-specific thresholds
  return !hasCritical && score >= 65;
}

// ═══════════════════════════════════════════════════════════════
// PARAMETER CELL — the tactile heart of the app
// Drag up/down to change value, double-click to type directly,
// arrow keys for keyboard accessibility.
// ═══════════════════════════════════════════════════════════════
const ParameterCell = memo(({
  label, value, onChange,
  min = 0, max = Infinity, step = 1,
  dragSensitivity = 40, // px per step
  format, unit,
  hint,
}) => {
  const [editing, setEditing] = useState(false);
  const [editStr, setEditStr] = useState('');
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const startY = useRef(0);
  const startVal = useRef(0);
  const inputRef = useRef(null);

  const displayVal = format ? format(value) : fmt.num(value);
  const clamp = useCallback((v) => {
    const snapped = Math.round(v / step) * step;
    return Math.max(min, Math.min(max, snapped));
  }, [min, max, step]);

  // Mouse drag handler
  const handleMouseDown = useCallback((e) => {
    if (editing) return;
    e.preventDefault();
    startY.current = e.clientY;
    startVal.current = value;
    setDragging(true);
  }, [editing, value]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const pixelDelta = startY.current - e.clientY; // up = positive
      const valueDelta = (pixelDelta / dragSensitivity) * step;
      onChange(clamp(startVal.current + valueDelta));
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, clamp, step, dragSensitivity, onChange]);

  // Double-click → inline edit
  const handleDoubleClick = useCallback(() => {
    setEditStr(String(value));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 10);
  }, [value]);

  const commitEdit = useCallback(() => {
    const cleaned = editStr.replace(/[$,%BMKbmk\s]/g, '');
    let parsed = parseFloat(cleaned);
    // Handle B/M/K suffix
    if (/[Bb]$/.test(editStr)) parsed *= 1e9;
    else if (/[Mm]$/.test(editStr)) parsed *= 1e6;
    else if (/[Kk]$/.test(editStr)) parsed *= 1e3;
    if (!isNaN(parsed)) onChange(clamp(parsed));
    setEditing(false);
  }, [editStr, clamp, onChange]);

  const handleKeyDown = useCallback((e) => {
    if (editing) {
      if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
      if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
      return;
    }
    if (e.key === 'ArrowUp') { e.preventDefault(); onChange(clamp(value + step)); }
    if (e.key === 'ArrowDown') { e.preventDefault(); onChange(clamp(value - step)); }
  }, [editing, commitEdit, clamp, value, step, onChange]);

  const isActive = dragging || hovered;

  return (
    <div
      tabIndex={0}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
        padding: '12px 14px',
        background: dragging
          ? 'rgba(99,102,241,0.12)'
          : isActive
          ? 'rgba(255,255,255,0.04)'
          : 'rgba(255,255,255,0.025)',
        border: `1px solid ${dragging ? 'rgba(99,102,241,0.55)' : isActive ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: '9px',
        cursor: dragging ? 'ns-resize' : 'ns-resize',
        userSelect: 'none',
        transition: 'background 0.15s, border-color 0.15s',
        outline: 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
      title={hint || 'Drag up/down to adjust · Double-click to type · Arrow keys to nudge'}
    >
      {/* Focus ring glow */}
      {dragging && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '9px',
          boxShadow: 'inset 0 0 0 1px rgba(99,102,241,0.4)',
          pointerEvents: 'none',
        }} />
      )}

      <span style={{
        fontSize: '10px',
        color: '#5a5870',
        textTransform: 'uppercase',
        letterSpacing: '0.09em',
        fontWeight: 600,
        fontFamily: 'DM Sans, sans-serif',
      }}>
        {label}
      </span>

      {editing ? (
        <input
          ref={inputRef}
          value={editStr}
          onChange={(e) => setEditStr(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '20px',
            fontWeight: 700,
            color: '#e8e4dc',
            width: '100%',
            padding: 0,
          }}
        />
      ) : (
        <span style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '20px',
          fontWeight: 700,
          color: '#e8e4dc',
          lineHeight: 1.1,
          display: 'flex',
          alignItems: 'baseline',
          gap: '4px',
        }}>
          {displayVal}
          {unit && (
            <span style={{ fontSize: '11px', color: '#4b5568', fontWeight: 400 }}>{unit}</span>
          )}
        </span>
      )}

      {/* Drag hint strip */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginTop: '2px',
      }}>
        <span style={{ fontSize: '9px', color: '#30303d', fontFamily: 'DM Sans, sans-serif' }}>
          ↕ drag · dbl-click to edit
        </span>
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════
// TOGGLE BUTTON (for billing mode, etc.)
// ═══════════════════════════════════════════════════════════════
const Toggle = ({ value, options, onChange }) => (
  <div style={{
    display: 'inline-flex',
    background: '#0d0d10',
    border: '1px solid #1d1d25',
    borderRadius: '7px',
    padding: '2px',
    gap: '2px',
  }}>
    {options.map(opt => (
      <button
        key={opt.value}
        onClick={() => onChange(opt.value)}
        style={{
          padding: '5px 12px',
          borderRadius: '5px',
          border: 'none',
          background: value === opt.value ? '#6366f1' : 'transparent',
          color: value === opt.value ? '#fff' : '#4b5568',
          fontSize: '11px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.15s',
          letterSpacing: '0.04em',
        }}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

// ═══════════════════════════════════════════════════════════════
// CONCEPT CARD
// ═══════════════════════════════════════════════════════════════
const ConceptCard = memo(({ term, definition, why, accent = '#6366f1' }) => (
  <div style={{
    padding: '14px 16px',
    background: `${accent}08`,
    border: `1px solid ${accent}20`,
    borderRadius: '10px',
    borderLeft: `3px solid ${accent}60`,
  }}>
    <div style={{
      fontSize: '11px',
      fontWeight: 700,
      color: accent,
      marginBottom: '5px',
      textTransform: 'uppercase',
      letterSpacing: '0.07em',
    }}>
      {term}
    </div>
    <div style={{
      fontSize: '12px',
      color: '#8a8898',
      lineHeight: 1.6,
      marginBottom: why ? '6px' : 0,
    }}>
      {definition}
    </div>
    {why && (
      <div style={{ fontSize: '11px', color: `${accent}cc`, fontStyle: 'italic' }}>
        ↗ {why}
      </div>
    )}
  </div>
));

// ═══════════════════════════════════════════════════════════════
// OUTPUT TABLE ROW
// ═══════════════════════════════════════════════════════════════
const OutputRow = memo(({ label, value, status = 'neutral', sublabel }) => {
  const palette = {
    good: { text: '#4ade80', bg: '#052e1618', border: '#16a34a25' },
    warn: { text: '#fbbf24', bg: '#78350f18', border: '#d9770025' },
    bad: { text: '#f87171', bg: '#7f1d1d18', border: '#dc262625' },
    neutral: { text: '#9ca3af', bg: 'transparent', border: 'transparent' },
  };
  const c = palette[status] || palette.neutral;

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '9px 14px',
      borderBottom: '1px solid #13131a',
    }}>
      <div>
        <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.3 }}>{label}</div>
        {sublabel && <div style={{ fontSize: '10px', color: '#3a3a4a', marginTop: '1px' }}>{sublabel}</div>}
      </div>
      <div style={{
        fontSize: '13px',
        fontWeight: 700,
        color: c.text,
        fontFamily: 'JetBrains Mono, monospace',
        padding: '3px 9px',
        borderRadius: '5px',
        background: c.bg,
        border: `1px solid ${c.border}`,
        transition: 'all 0.2s',
      }}>
        {value}
      </div>
    </div>
  );
});

const OutputTable = memo(({ rows }) => (
  <div style={{
    border: '1px solid #1d1d25',
    borderRadius: '10px',
    overflow: 'hidden',
    background: '#0b0b0f',
  }}>
    {rows.map((r, i) => <OutputRow key={i} {...r} />)}
  </div>
));

// ═══════════════════════════════════════════════════════════════
// FLAGS PANEL
// ═══════════════════════════════════════════════════════════════
const FlagsPanel = memo(({ flags, moduleId }) => {
  const relevant = flags.filter(f => f.module === moduleId);

  if (relevant.length === 0) {
    return (
      <div style={{
        padding: '12px 16px',
        background: '#052e1615',
        border: '1px solid #16a34a30',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span style={{ fontSize: '14px' }}>✓</span>
        <span style={{ fontSize: '12px', color: '#4ade80' }}>No issues for this module</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {relevant.map(f => {
        const palette = {
          critical: { bg: '#7f1d1d18', border: '#dc262625', tag: '#ef4444', tagBg: '#7f1d1d30' },
          warning: { bg: '#78350f18', border: '#d9770025', tag: '#f59e0b', tagBg: '#78350f30' },
          info: { bg: '#1e1b4b18', border: '#4f46e525', tag: '#818cf8', tagBg: '#1e1b4b30' },
        };
        const c = palette[f.severity] || palette.info;

        return (
          <div key={f.id} style={{
            padding: '12px 14px',
            background: c.bg,
            border: `1px solid ${c.border}`,
            borderRadius: '9px',
          }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <span style={{
                fontSize: '9px',
                padding: '3px 7px',
                borderRadius: '4px',
                background: c.tagBg,
                color: c.tag,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                whiteSpace: 'nowrap',
                marginTop: '2px',
                flexShrink: 0,
              }}>
                {f.severity}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#ddd8d0', marginBottom: '3px' }}>{f.msg}</div>
                <div style={{ fontSize: '11px', color: '#5a5870', lineHeight: 1.5, marginBottom: '5px' }}>{f.detail}</div>
                <div style={{ fontSize: '11px', color: '#818cf8' }}>→ {f.fix}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════
// SVG FUNNEL CHART (Module 1)
// ═══════════════════════════════════════════════════════════════
const FunnelChart = memo(({ tam, sam, som }) => {
  const MAX_W = 300;
  const bars = [
    { label: 'TAM', sublabel: 'Total Addressable Market', value: tam, w: MAX_W, color: '#312e81', glow: '#4338ca' },
    { label: 'SAM', sublabel: 'Serviceable Addressable', value: sam, w: Math.max(18, (sam / tam) * MAX_W), color: '#4f46e5', glow: '#6366f1' },
    { label: 'SOM', sublabel: 'Serviceable Obtainable', value: som, w: Math.max(10, (som / tam) * MAX_W), color: '#818cf8', glow: '#a5b4fc' },
  ];

  return (
    <div>
      <div style={{ fontSize: '10px', color: '#4b5568', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>
        Market Funnel
      </div>
      {bars.map(b => (
        <div key={b.label} style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', alignItems: 'baseline' }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af' }}>{b.label}</span>
              <span style={{ fontSize: '10px', color: '#3a3a4a', marginLeft: '6px' }}>{b.sublabel}</span>
            </div>
            <span style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', color: '#e8e4dc', fontWeight: 600 }}>
              {fmt.currency(b.value)}
            </span>
          </div>
          <div style={{ height: '22px', background: '#111118', borderRadius: '5px', overflow: 'hidden', position: 'relative' }}>
            <div style={{
              height: '100%',
              width: `${b.w}px`,
              background: `linear-gradient(90deg, ${b.color}, ${b.glow})`,
              borderRadius: '5px',
              transition: 'width 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: `0 0 12px ${b.glow}30`,
            }} />
          </div>
        </div>
      ))}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════
// ARR TIMELINE (Module 1)  — SVG line chart
// ═══════════════════════════════════════════════════════════════
const ARRTimeline = memo(({ som, horizon, targetARR }) => {
  const W = 310, H = 130, PAD = { t: 14, r: 16, b: 26, l: 14 };
  const IW = W - PAD.l - PAD.r;
  const IH = H - PAD.t - PAD.b;

  // Simple linear ramp: reach ~40% of SOM by end of horizon
  const pts = Array.from({ length: horizon + 1 }, (_, i) => ({
    year: i,
    arr: i === 0 ? 0 : (som * 0.4 * (i / horizon)),
  }));

  const maxVal = Math.max(...pts.map(p => p.arr), targetARR) * 1.25;
  const tx = (y) => PAD.l + (y / horizon) * IW;
  const ty = (v) => PAD.t + IH - (v / maxVal) * IH;

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${tx(p.year).toFixed(1)},${ty(p.arr).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${tx(horizon).toFixed(1)},${(PAD.t + IH).toFixed(1)} L${tx(0).toFixed(1)},${(PAD.t + IH).toFixed(1)}Z`;

  const targetYPos = ty(targetARR);

  return (
    <div>
      <div style={{ fontSize: '10px', color: '#4b5568', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
        ARR Trajectory (simplified)
      </div>
      <svg width={W} height={H} style={{ overflow: 'visible', display: 'block' }}>
        <defs>
          <linearGradient id="arrArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="arrLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#a5b4fc" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map(f => (
          <line key={f}
            x1={PAD.l} x2={W - PAD.r}
            y1={ty(maxVal * f)} y2={ty(maxVal * f)}
            stroke="#1a1a25" strokeWidth="1"
          />
        ))}

        {/* Target line */}
        {targetARR > 0 && (
          <>
            <line x1={PAD.l} x2={W - PAD.r} y1={targetYPos} y2={targetYPos}
              stroke="#f59e0b" strokeWidth="1" strokeDasharray="5,4" opacity="0.7" />
            <text x={W - PAD.r - 2} y={targetYPos - 4} fill="#f59e0b" fontSize="9" textAnchor="end" opacity="0.8">
              Goal {fmt.currency(targetARR)}
            </text>
          </>
        )}

        {/* Area + Line */}
        <path d={areaPath} fill="url(#arrArea)" />
        <path d={linePath} fill="none" stroke="url(#arrLine)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Data points */}
        {pts.map(p => (
          <g key={p.year}>
            <circle cx={tx(p.year)} cy={ty(p.arr)} r="4" fill="#818cf8" />
            <circle cx={tx(p.year)} cy={ty(p.arr)} r="2" fill="#0b0b0f" />
          </g>
        ))}

        {/* Year labels */}
        {pts.map(p => (
          <text key={p.year} x={tx(p.year)} y={H - 4} fill="#3a3a4a" fontSize="9" textAnchor="middle">
            Y{p.year}
          </text>
        ))}

        {/* Value labels on right axis */}
        {[0.5, 1].map(f => (
          <text key={f} x={PAD.l - 2} y={ty(maxVal * f) + 4} fill="#3a3a4a" fontSize="8" textAnchor="end">
            {fmt.currency(maxVal * f)}
          </text>
        ))}
      </svg>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════
// LTV/CAC CHART (Module 2)
// ═══════════════════════════════════════════════════════════════
const LTVCACChart = memo(({ ltv, cac, payback }) => {
  const cappedLtv = Math.min(ltv, cac * 10); // cap visual at 10x for readability
  const maxVal = Math.max(cappedLtv, cac) * 1.15;
  const ltvW = (cappedLtv / maxVal) * 280;
  const cacW = (cac / maxVal) * 280;
  const ratio = cac > 0 ? ltv / cac : 0;
  const ratioColor = ratio >= 5 ? '#4ade80' : ratio >= 3 ? '#fbbf24' : '#f87171';

  return (
    <div>
      <div style={{ fontSize: '10px', color: '#4b5568', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>
        LTV vs CAC
      </div>

      {[
        { label: 'LTV', sublabel: 'Lifetime Value (gross profit)', value: ltv > 99999 ? '>$100K' : fmt.currency(ltv), barW: ltvW, color: '#16a34a', glow: '#4ade80' },
        { label: 'CAC', sublabel: 'Customer Acquisition Cost', value: fmt.currency(cac), barW: cacW, color: '#991b1b', glow: '#f87171' },
      ].map(bar => (
        <div key={bar.label} style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af' }}>{bar.label}</span>
              <span style={{ fontSize: '10px', color: '#3a3a4a', marginLeft: '6px' }}>{bar.sublabel}</span>
            </div>
            <span style={{ fontSize: '13px', fontFamily: 'JetBrains Mono, monospace', color: '#e8e4dc', fontWeight: 700 }}>
              {bar.value}
            </span>
          </div>
          <div style={{ height: '18px', background: '#111118', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${bar.barW}px`,
              background: `linear-gradient(90deg, ${bar.color}, ${bar.glow})`,
              borderRadius: '4px',
              transition: 'width 0.3s ease',
              boxShadow: `0 0 8px ${bar.glow}25`,
            }} />
          </div>
        </div>
      ))}

      {/* Ratio badge */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 14px',
        background: `${ratioColor}10`,
        border: `1px solid ${ratioColor}30`,
        borderRadius: '8px',
        marginTop: '4px',
      }}>
        <span style={{ fontSize: '11px', color: '#6b7280' }}>LTV/CAC</span>
        <span style={{
          fontSize: '22px',
          fontWeight: 800,
          color: ratioColor,
          fontFamily: 'JetBrains Mono, monospace',
          letterSpacing: '-0.02em',
          transition: 'color 0.3s',
        }}>
          {ratio.toFixed(1)}×
        </span>
        <span style={{ fontSize: '10px', color: ratioColor, opacity: 0.7 }}>
          {ratio >= 5 ? '⚡ Excellent' : ratio >= 3 ? '↗ Acceptable' : '⚠ Below threshold'}
        </span>
      </div>

      {/* Payback bar */}
      <div style={{ marginTop: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
          <span style={{ fontSize: '11px', color: '#6b7280' }}>Payback Period</span>
          <span style={{
            fontSize: '12px',
            fontFamily: 'JetBrains Mono, monospace',
            color: payback <= 6 ? '#4ade80' : payback <= 12 ? '#fbbf24' : '#f87171',
            fontWeight: 700,
          }}>
            {Math.min(payback, 99).toFixed(1)} mo
          </span>
        </div>
        <div style={{ height: '8px', background: '#111118', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute',
            left: 0, top: 0, bottom: 0,
            width: `${Math.min(100, (payback / 24) * 100)}%`,
            background: payback <= 6 ? '#16a34a' : payback <= 12 ? '#d97706' : '#dc2626',
            borderRadius: '4px',
            transition: 'width 0.3s, background 0.3s',
          }} />
          {/* 12-month marker */}
          <div style={{
            position: 'absolute',
            left: `${(12 / 24) * 100}%`,
            top: 0, bottom: 0,
            width: '1px',
            background: '#ffffff40',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
          <span style={{ fontSize: '8px', color: '#2a2a35' }}>0</span>
          <span style={{ fontSize: '8px', color: '#3a3a4a' }}>12mo target</span>
          <span style={{ fontSize: '8px', color: '#2a2a35' }}>24mo</span>
        </div>
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════
// BATTLE METER (Module 2)
// ═══════════════════════════════════════════════════════════════
const BattleMeter = memo(({ ltvCac, payback, grossMargin, churnMonthly }) => {
  const checks = [
    { label: 'LTV/CAC ≥ 3×', pass: ltvCac >= 3, tier: 1 },
    { label: 'LTV/CAC ≥ 5×', pass: ltvCac >= 5, tier: 2 },
    { label: 'Payback ≤ 12 mo', pass: payback <= 12, tier: 1 },
    { label: 'Payback ≤ 6 mo', pass: payback <= 6, tier: 2 },
    { label: 'GM ≥ 60%', pass: grossMargin >= 60, tier: 1 },
    { label: 'GM ≥ 70%', pass: grossMargin >= 70, tier: 2 },
    { label: 'Churn < 3% mo', pass: churnMonthly < 3, tier: 1 },
    { label: 'Churn < 2% mo', pass: churnMonthly < 2, tier: 2 },
  ];

  const passedT1 = checks.filter(c => c.tier === 1 && c.pass).length;
  const totalT1 = checks.filter(c => c.tier === 1).length;
  const health = Math.round((passedT1 / totalT1) * 100);
  const color = health >= 75 ? '#4ade80' : health >= 50 ? '#fbbf24' : '#f87171';
  const label = health >= 75 ? 'Strong' : health >= 50 ? 'Needs Work' : 'Struggling';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
        <div style={{ fontSize: '10px', color: '#4b5568', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Unit Economics Health
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{
            fontSize: '24px',
            fontWeight: 800,
            color,
            fontFamily: 'JetBrains Mono, monospace',
            transition: 'color 0.3s',
          }}>{health}%</span>
          <span style={{ fontSize: '11px', color }}>{label}</span>
        </div>
      </div>

      {/* Health bar */}
      <div style={{ height: '6px', background: '#111118', borderRadius: '3px', marginBottom: '14px', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${health}%`,
          background: `linear-gradient(90deg, ${color}80, ${color})`,
          borderRadius: '3px',
          transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1), background 0.3s',
          boxShadow: `0 0 8px ${color}50`,
        }} />
      </div>

      {/* Check badges */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
        {checks.map(c => (
          <div key={c.label} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 9px',
            borderRadius: '5px',
            background: c.pass
              ? (c.tier === 2 ? '#052e1630' : '#052e1618')
              : '#111118',
            border: `1px solid ${c.pass ? (c.tier === 2 ? '#16a34a50' : '#16a34a28') : '#1d1d25'}`,
            transition: 'all 0.2s',
          }}>
            <span style={{ fontSize: '10px', color: c.pass ? '#4ade80' : '#3a3a4a' }}>
              {c.pass ? '✓' : '·'}
            </span>
            <span style={{ fontSize: '10px', color: c.pass ? '#86efac' : '#3a3a4a' }}>
              {c.label}
            </span>
            {c.tier === 2 && c.pass && (
              <span style={{ fontSize: '8px', color: '#fbbf24' }}>★</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════
// CASH FLOW CHART (Module 3)  — SVG area chart
// ═══════════════════════════════════════════════════════════════
const CashFlowChart = memo(({ cashData, fundraiseMonth, fundraiseAmount }) => {
  const W = 320, H = 150, PAD = { t: 14, r: 20, b: 26, l: 8 };
  const IW = W - PAD.l - PAD.r;
  const IH = H - PAD.t - PAD.b;

  const maxCash = Math.max(...cashData, 0);
  const minCash = Math.min(...cashData, 0);
  const range = maxCash - minCash || 1;
  const months = cashData.length - 1;

  const tx = (m) => PAD.l + (m / months) * IW;
  const ty = (v) => PAD.t + IH - ((v - minCash) / range) * IH;
  const zeroY = ty(0);

  const linePath = cashData.map((c, i) => `${i === 0 ? 'M' : 'L'}${tx(i).toFixed(1)},${ty(c).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${tx(months).toFixed(1)},${(PAD.t + IH).toFixed(1)} L${tx(0).toFixed(1)},${(PAD.t + IH).toFixed(1)}Z`;

  // Find where cash hits zero for dead zone visualization
  const deathMonth = cashData.findIndex((c, i) => i > 0 && c <= 0);

  return (
    <div>
      <div style={{ fontSize: '10px', color: '#4b5568', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
        Cash Balance — 24 Months
      </div>
      <svg width={W} height={H} style={{ overflow: 'visible', display: 'block' }}>
        <defs>
          <linearGradient id="cashArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="cashLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="60%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#a5b4fc" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f}
            x1={PAD.l} x2={W - PAD.r}
            y1={ty(maxCash * f)} y2={ty(maxCash * f)}
            stroke="#151520" strokeWidth="1"
          />
        ))}

        {/* Zero / death line */}
        <line x1={PAD.l} x2={W - PAD.r} y1={zeroY} y2={zeroY}
          stroke="#dc2626" strokeWidth="1.5" strokeDasharray="5,4" opacity="0.7" />
        <text x={W - PAD.r} y={zeroY - 4} fill="#dc2626" fontSize="9" textAnchor="end" opacity="0.7">
          $0 death line
        </text>

        {/* Cash area + line */}
        <path d={areaPath} fill="url(#cashArea)" />
        <path d={linePath} fill="none" stroke="url(#cashLine)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Fundraise marker */}
        {fundraiseMonth > 0 && fundraiseMonth <= months && fundraiseAmount > 0 && (
          <g>
            <line
              x1={tx(fundraiseMonth)} x2={tx(fundraiseMonth)}
              y1={PAD.t} y2={PAD.t + IH}
              stroke="#f59e0b" strokeWidth="1" strokeDasharray="3,3" opacity="0.5"
            />
            <circle cx={tx(fundraiseMonth)} cy={ty(cashData[fundraiseMonth] || 0)} r="5" fill="#f59e0b" />
            <circle cx={tx(fundraiseMonth)} cy={ty(cashData[fundraiseMonth] || 0)} r="2" fill="#0b0b0f" />
            <text x={tx(fundraiseMonth) + 6} y={ty(cashData[fundraiseMonth] || 0) - 6} fill="#f59e0b" fontSize="9">
              +{fmt.currency(fundraiseAmount)}
            </text>
          </g>
        )}

        {/* Death marker */}
        {deathMonth > 0 && (
          <g>
            <line x1={tx(deathMonth)} x2={tx(deathMonth)} y1={PAD.t} y2={PAD.t + IH}
              stroke="#dc2626" strokeWidth="1" opacity="0.5" />
            <text x={tx(deathMonth)} y={PAD.t + IH + 14} fill="#dc2626" fontSize="9" textAnchor="middle">
              💀M{deathMonth}
            </text>
          </g>
        )}

        {/* Month labels */}
        {[0, 6, 12, 18, 24].map(m => (
          <text key={m} x={tx(m)} y={H - 4} fill="#2a2a35" fontSize="9" textAnchor="middle">M{m}</text>
        ))}
      </svg>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════
// OWNERSHIP DONUT (Module 3)
// ═══════════════════════════════════════════════════════════════
const OwnershipDonut = memo(({ safeCapPercent, optionPool }) => {
  const investors = Math.min(safeCapPercent, 80);
  const pool = Math.min(optionPool, 80 - investors);
  const founders = Math.max(0, 100 - investors - pool);

  const slices = [
    { label: 'Founders', value: founders, color: '#6366f1', glow: '#818cf8' },
    { label: 'Investors (SAFE)', value: investors, color: '#f59e0b', glow: '#fbbf24' },
    { label: 'Option Pool', value: pool, color: '#22c55e', glow: '#4ade80' },
  ].filter(s => s.value > 0);

  const CX = 65, CY = 65, R = 52, HOLE = 32;
  let angle = -Math.PI / 2;

  const arcPath = (cx, cy, r, startA, sweep) => {
    if (sweep >= 2 * Math.PI - 0.001) {
      return `M${cx},${cy - r} A${r},${r},0,1,1,${cx - 0.01},${cy - r}Z`;
    }
    const x1 = cx + r * Math.cos(startA);
    const y1 = cy + r * Math.sin(startA);
    const x2 = cx + r * Math.cos(startA + sweep);
    const y2 = cy + r * Math.sin(startA + sweep);
    const large = sweep > Math.PI ? 1 : 0;
    return `M${cx},${cy} L${x1},${y1} A${r},${r},0,${large},1,${x2},${y2}Z`;
  };

  const arcs = slices.map(s => {
    const start = angle;
    const sweep = (s.value / 100) * 2 * Math.PI;
    angle += sweep;
    return { ...s, start, sweep };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
      <svg width={130} height={130}>
        <defs>
          {arcs.map(a => (
            <radialGradient key={a.label} id={`grad-${a.label}`}>
              <stop offset="0%" stopColor={a.glow} stopOpacity="0.9" />
              <stop offset="100%" stopColor={a.color} stopOpacity="0.85" />
            </radialGradient>
          ))}
        </defs>
        {arcs.map(a => (
          <path
            key={a.label}
            d={arcPath(CX, CY, R, a.start, a.sweep)}
            fill={`url(#grad-${a.label})`}
          />
        ))}
        {/* Donut hole */}
        <circle cx={CX} cy={CY} r={HOLE} fill="#080809" />
        <text x={CX} y={CY - 6} textAnchor="middle" fill="#e8e4dc" fontSize="16" fontWeight="800" fontFamily="JetBrains Mono, monospace">
          {founders.toFixed(0)}%
        </text>
        <text x={CX} y={CY + 10} textAnchor="middle" fill="#4b5568" fontSize="9" fontFamily="DM Sans, sans-serif">
          founders
        </text>
      </svg>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {slices.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '10px', height: '10px',
              borderRadius: '3px',
              background: s.color,
              flexShrink: 0,
              boxShadow: `0 0 6px ${s.glow}50`,
            }} />
            <div>
              <div style={{ fontSize: '10px', color: '#6b7280' }}>{s.label}</div>
              <div style={{
                fontSize: '14px',
                fontWeight: 700,
                color: s.color,
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                {s.value.toFixed(1)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════
// SCORE HEADER — fixed top bar
// ═══════════════════════════════════════════════════════════════
const ScoreHeader = memo(({ score, prevScore, flags, currentModule, setModule, moduleCompletion }) => {
  const scoreColor = score >= 80 ? '#4ade80' : score >= 60 ? '#fbbf24' : score >= 40 ? '#fb923c' : '#f87171';
  const criticals = flags.filter(f => f.severity === 'critical').length;
  const warnings = flags.filter(f => f.severity === 'warning').length;

  const modules = [
    { id: 1, label: 'Market Size' },
    { id: 2, label: 'Unit Economics' },
    { id: 3, label: 'Runway + Dilution' },
  ];

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      zIndex: 200,
      background: 'rgba(8,8,9,0.92)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid #1a1a25',
      padding: '0 28px',
      height: '58px',
      display: 'flex',
      alignItems: 'center',
      gap: '0',
    }}>
      {/* Wordmark */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginRight: '28px',
        flexShrink: 0,
      }}>
        <div style={{
          width: '26px', height: '26px',
          background: 'linear-gradient(135deg, #4f46e5, #818cf8)',
          borderRadius: '6px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '14px', fontWeight: 900, color: '#fff',
        }}>
          ∑
        </div>
        <span style={{
          fontSize: '13px',
          fontWeight: 700,
          color: '#c8c4bc',
          letterSpacing: '-0.01em',
          fontFamily: 'DM Sans, sans-serif',
        }}>
          Founder Math Lab
        </span>
      </div>

      {/* Module tabs */}
      <div style={{ display: 'flex', gap: '2px', flex: 1 }}>
        {modules.map(m => {
          const isActive = currentModule === m.id;
          const isDone = moduleCompletion[m.id];
          return (
            <button
              key={m.id}
              onClick={() => setModule(m.id)}
              style={{
                padding: '6px 16px',
                borderRadius: '7px',
                border: 'none',
                background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
                color: isDone ? '#4ade80' : isActive ? '#a5b4fc' : '#3a3a4a',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'DM Sans, sans-serif',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                letterSpacing: '0.01em',
                transition: 'all 0.15s',
                borderBottom: isActive ? '2px solid #6366f1' : '2px solid transparent',
                outline: 'none',
              }}
            >
              <span style={{
                width: '18px', height: '18px',
                borderRadius: '50%',
                background: isDone ? '#16a34a' : isActive ? '#6366f1' : '#1a1a25',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '9px',
                fontWeight: 800,
                color: isDone || isActive ? '#fff' : '#3a3a4a',
                flexShrink: 0,
                transition: 'all 0.2s',
              }}>
                {isDone ? '✓' : m.id}
              </span>
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Score + flags */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
        {criticals > 0 && (
          <div style={{
            fontSize: '11px',
            color: '#f87171',
            background: '#7f1d1d20',
            padding: '4px 10px',
            borderRadius: '6px',
            border: '1px solid #dc262630',
            fontWeight: 600,
          }}>
            ⚠ {criticals} critical
          </div>
        )}
        {warnings > 0 && (
          <div style={{
            fontSize: '11px',
            color: '#fbbf24',
            background: '#78350f18',
            padding: '4px 10px',
            borderRadius: '6px',
            border: '1px solid #d9770025',
            fontWeight: 600,
          }}>
            {warnings} warning{warnings > 1 ? 's' : ''}
          </div>
        )}

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '9px', color: '#3a3a4a', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '1px' }}>
            Investor Score
          </div>
          <div style={{
            fontSize: '26px',
            fontWeight: 800,
            color: scoreColor,
            fontFamily: 'JetBrains Mono, monospace',
            lineHeight: 1,
            letterSpacing: '-0.03em',
            transition: 'color 0.4s',
          }}>
            {score}
          </div>
        </div>
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════
// AI COACH PANEL
// ═══════════════════════════════════════════════════════════════
const CoachPanel = memo(({ score, flags, marketState, unitState, runwayState, derived }) => {
  const [open, setOpen] = useState(false);
  const [advice, setAdvice] = useState('');
  const [loading, setLoading] = useState(false);
  const [asked, setAsked] = useState(false);

  const getAdvice = async () => {
    setLoading(true);
    setAsked(true);

    if (AI_PROVIDER === 'none') {
      // Deterministic coaching based on flags and score
      await new Promise(r => setTimeout(r, 600)); // simulated thinking
      const criticals = flags.filter(f => f.severity === 'critical');
      const warnings = flags.filter(f => f.severity === 'warning');
      const topFlags = [...criticals, ...warnings].slice(0, 4);

      if (score >= 80) {
        setAdvice(
          `Your metrics are investor-grade. Here's how to go further:\n\n` +
          `• Stress-test with conservative assumptions (half the growth rate).\n` +
          `• Model what happens if CAC doubles — a common post-PMF reality.\n` +
          `• Build a 3-scenario DCF: bear, base, bull — investors will ask for it.`
        );
      } else if (topFlags.length === 0) {
        setAdvice(`Score ${score}/100 — decent foundation. Focus on:\n\n• Improving unit economics to hit LTV/CAC ≥ 5×.\n• Extending runway past 18 months.\n• Sharpening SAM/SOM narrative with bottom-up data.`);
      } else {
        const tips = topFlags.map(f => `• ${f.msg} → ${f.fix}`).join('\n');
        setAdvice(`Score ${score}/100. Address these in priority order:\n\n${tips}`);
      }
      setLoading(false);
      return;
    }

    // Build minimal state summary for AI (keep tokens low)
    const summary = {
      score,
      flags: flags.map(f => `[${f.severity}] ${f.msg}`),
      market: { tamB: (marketState.tam / 1e9).toFixed(1), somPct: marketState.somPct },
      unit: {
        price: unitState.price,
        gm: unitState.grossMargin,
        cac: unitState.cac,
        churn: unitState.churnMonthly,
        ltvCac: derived.ltvCac?.toFixed(1),
        payback: derived.payback?.toFixed(0),
      },
      runway: { months: derived.runwayMonths, breakevenMo: derived.breakevenMonth },
    };

    const prompt = `You are an angel investor coach reviewing a startup pitch deck. The founder's model shows:\n${JSON.stringify(summary, null, 2)}\n\nGive exactly 3 concise, specific, actionable tips to improve their Investor Readiness Score. Use bullet points. Reference actual numbers. Be direct.`;

    try {
      if (AI_PROVIDER === 'anthropic') {
        const apiKey = typeof window !== 'undefined' ? window.ANTHROPIC_API_KEY : '';
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: AI_MODELS.anthropic,
            max_tokens: 320,
            messages: [{ role: 'user', content: prompt }],
          }),
        });
        const data = await res.json();
        setAdvice(data.content?.[0]?.text || 'No response received.');
      } else if (AI_PROVIDER === 'openai') {
        const apiKey = typeof window !== 'undefined' ? window.OPENAI_API_KEY : '';
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: AI_MODELS.openai,
            max_tokens: 320,
            messages: [{ role: 'user', content: prompt }],
          }),
        });
        const data = await res.json();
        setAdvice(data.choices?.[0]?.message?.content || 'No response received.');
      }
    } catch (err) {
      setAdvice(`Failed to reach AI: ${err.message}. Check your API key and CORS settings.`);
    }

    setLoading(false);
  };

  return (
    <>
      {/* Toggle tab */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed',
          right: open ? '292px' : 0,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 300,
          width: '32px',
          height: '80px',
          background: '#1a1a25',
          border: '1px solid #2a2a35',
          borderRight: open ? '1px solid #2a2a35' : 'none',
          borderRadius: '8px 0 0 8px',
          cursor: 'pointer',
          color: '#818cf8',
          fontSize: '15px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'right 0.3s ease',
          writingMode: 'vertical-lr',
          letterSpacing: '0.05em',
          outline: 'none',
        }}
        title="AI Coach"
      >
        🤖
      </button>

      {/* Panel */}
      <div style={{
        position: 'fixed',
        right: open ? 0 : '-292px',
        top: '58px',
        bottom: 0,
        width: '292px',
        background: '#0b0b0f',
        borderLeft: '1px solid #1a1a25',
        transition: 'right 0.3s cubic-bezier(0.4,0,0.2,1)',
        zIndex: 250,
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 18px',
        overflowY: 'auto',
      }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#c8c4bc', marginBottom: '4px' }}>
          AI Coach
          <span style={{
            fontSize: '9px',
            color: '#3a3a4a',
            marginLeft: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            {AI_PROVIDER === 'none' ? 'deterministic' : AI_PROVIDER}
          </span>
        </div>
        <div style={{ fontSize: '11px', color: '#3a3a4a', lineHeight: 1.5, marginBottom: '16px' }}>
          Reads your current numbers and flags, gives targeted suggestions.
        </div>

        <button
          onClick={getAdvice}
          disabled={loading}
          style={{
            padding: '10px 16px',
            background: loading ? '#1d1d25' : 'linear-gradient(135deg, #4f46e5, #6366f1)',
            border: 'none',
            borderRadius: '8px',
            color: loading ? '#4b5568' : '#fff',
            fontSize: '13px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            marginBottom: '16px',
            transition: 'all 0.2s',
            letterSpacing: '0.02em',
          }}
        >
          {loading ? '⟳ Analyzing...' : asked ? '↺ Ask Again' : '→ Ask Coach'}
        </button>

        {advice && !loading && (
          <div style={{
            fontSize: '12px',
            color: '#8a8898',
            lineHeight: 1.75,
            whiteSpace: 'pre-wrap',
            background: '#111118',
            padding: '14px',
            borderRadius: '8px',
            border: '1px solid #1a1a25',
            flex: 1,
          }}>
            {advice}
          </div>
        )}

        {!asked && (
          <div style={{
            fontSize: '11px',
            color: '#2a2a35',
            lineHeight: 1.6,
            marginTop: 'auto',
            paddingTop: '20px',
          }}>
            Current score: <span style={{ color: '#4b5568', fontFamily: 'JetBrains Mono, monospace' }}>{score}/100</span>
            <br />
            Flags: <span style={{ color: '#4b5568' }}>{flags.length} total</span>
          </div>
        )}
      </div>
    </>
  );
});

// ═══════════════════════════════════════════════════════════════
// MODULE SHELL — wraps each module with consistent layout
// ═══════════════════════════════════════════════════════════════
const ModuleShell = ({ title, goal, children }) => (
  <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '28px 24px 60px' }}>
    <div style={{ marginBottom: '24px' }}>
      <h2 style={{
        fontSize: '22px',
        fontWeight: 800,
        color: '#e8e4dc',
        letterSpacing: '-0.03em',
        marginBottom: '6px',
        fontFamily: 'DM Sans, sans-serif',
      }}>
        {title}
      </h2>
      <p style={{ fontSize: '13px', color: '#4b5568', lineHeight: 1.6, maxWidth: '560px' }}>
        {goal}
      </p>
    </div>
    {children}
  </div>
);

// ─── Section label ────────────────────────────────────────────
const SectionLabel = ({ children }) => (
  <div style={{
    fontSize: '10px',
    fontWeight: 700,
    color: '#3a3a4a',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    marginBottom: '10px',
    marginTop: '6px',
  }}>
    {children}
  </div>
);

// ─── Divider ──────────────────────────────────────────────────
const Divider = () => (
  <div style={{ height: '1px', background: '#14141c', margin: '20px 0' }} />
);

// ═══════════════════════════════════════════════════════════════
// MODULE 1: MARKET SIZE EXPLORER
// ═══════════════════════════════════════════════════════════════
const MarketModule = ({ state, dispatch, flags, derived }) => {
  const { tam, samPct, somPct, horizon, targetARR } = state;
  const { sam, som } = derived;

  // Status helpers
  const somStatus = (v) => v >= 100_000_000 ? 'good' : v >= 30_000_000 ? 'warn' : 'bad';
  const tamStatus = (v) => v >= 10e9 ? 'good' : v >= 1e9 ? 'warn' : 'bad';

  return (
    <ModuleShell
      title="01 — Market Size Explorer"
      goal="Define the universe your startup plays in. Investors need to believe a venture-scale outcome is geometrically possible from your addressable market."
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px' }}>

        {/* LEFT: Params + Concepts */}
        <div>
          <SectionLabel>Parameters — drag to adjust</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
            <ParameterCell
              label="TAM"
              value={tam}
              onChange={(v) => dispatch({ type: 'SET_MARKET', field: 'tam', value: v })}
              min={100_000_000} max={1_000_000_000_000}
              step={500_000_000} dragSensitivity={30}
              format={fmt.currency}
              hint="Total Addressable Market — the entire pie"
            />
            <ParameterCell
              label="SAM %"
              value={samPct}
              onChange={(v) => dispatch({ type: 'SET_MARKET', field: 'samPct', value: v })}
              min={1} max={80}
              step={1} dragSensitivity={20}
              format={(v) => fmt.pct(v)}
              unit="of TAM"
              hint="Serviceable Addressable Market — what you can realistically reach"
            />
            <ParameterCell
              label="SOM %"
              value={somPct}
              onChange={(v) => dispatch({ type: 'SET_MARKET', field: 'somPct', value: v })}
              min={0.5} max={30}
              step={0.5} dragSensitivity={25}
              format={(v) => fmt.pct(v)}
              unit="of SAM"
              hint="Serviceable Obtainable Market — realistic capture in your horizon"
            />
            <ParameterCell
              label="Horizon"
              value={horizon}
              onChange={(v) => dispatch({ type: 'SET_MARKET', field: 'horizon', value: v })}
              min={1} max={10}
              step={1} dragSensitivity={30}
              unit="years"
              hint="Time horizon for your projections"
            />
            <div style={{ gridColumn: '1 / -1' }}>
              <ParameterCell
                label="ARR Goal"
                value={targetARR}
                onChange={(v) => dispatch({ type: 'SET_MARKET', field: 'targetARR', value: v })}
                min={100_000} max={1_000_000_000}
                step={1_000_000} dragSensitivity={30}
                format={fmt.currency}
                hint="Your target Annual Recurring Revenue by end of horizon"
              />
            </div>
          </div>

          <SectionLabel>Outputs</SectionLabel>
          <OutputTable rows={[
            {
              label: 'SAM', value: fmt.currency(sam),
              status: sam >= 1e9 ? 'good' : sam >= 200e6 ? 'warn' : 'bad',
              sublabel: `${samPct}% of TAM`,
            },
            {
              label: 'SOM', value: fmt.currency(som),
              status: somStatus(som),
              sublabel: `${somPct}% of SAM`,
            },
            {
              label: 'ARR at Y3 (implied)', value: fmt.currency(som * 0.4 * (Math.min(3, horizon) / horizon)),
              status: som * 0.24 >= targetARR ? 'good' : 'warn',
              sublabel: 'Simplified ramp',
            },
            {
              label: 'Venture Viability',
              value: som >= 100e6 ? 'Strong ✓' : som >= 30e6 ? 'Marginal' : 'Weak ✗',
              status: som >= 100e6 ? 'good' : som >= 30e6 ? 'warn' : 'bad',
              sublabel: 'SOM ≥ $100M → venture-scale',
            },
          ]} />

          <Divider />

          <SectionLabel>Flags</SectionLabel>
          <FlagsPanel flags={flags} moduleId={1} />
        </div>

        {/* RIGHT: Visuals + Concepts */}
        <div>
          <div style={{
            background: '#0b0b0f',
            border: '1px solid #1a1a25',
            borderRadius: '12px',
            padding: '18px',
            marginBottom: '16px',
          }}>
            <FunnelChart tam={tam} sam={sam} som={som} />
          </div>

          <div style={{
            background: '#0b0b0f',
            border: '1px solid #1a1a25',
            borderRadius: '12px',
            padding: '18px',
            marginBottom: '20px',
          }}>
            <ARRTimeline som={som} horizon={horizon} targetARR={targetARR} />
          </div>

          <SectionLabel>Key Concepts</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <ConceptCard
              term="TAM / SAM / SOM"
              definition="TAM is everyone who could theoretically buy. SAM is who you can actually reach with your model. SOM is what you can realistically capture in your horizon."
              why="VCs use this to sanity-check whether a $1B outcome is geometrically possible."
              accent="#6366f1"
            />
            <ConceptCard
              term="SOM Realism"
              definition="Most B2B SaaS companies capture 3–8% of SAM in 5 years. Claiming 20% without a clear channel strategy raises red flags."
              why="Investors compare your SOM% to category benchmarks and comparable companies."
              accent="#f59e0b"
            />
            <ConceptCard
              term="Venture Scale"
              definition="For a VC to make returns, you need a plausible path to $100M+ ARR. That means SOM ≥ $100M and a market that compounds."
              why="A fund returning 3× needs its winners to be 10–30× investments."
              accent="#22c55e"
            />
          </div>
        </div>
      </div>
    </ModuleShell>
  );
};

// ═══════════════════════════════════════════════════════════════
// MODULE 2: UNIT ECONOMICS BATTLE
// ═══════════════════════════════════════════════════════════════
const UnitEconomicsModule = ({ state, dispatch, flags, derived }) => {
  const { price, billing, grossMargin, cac, churnMonthly } = state;
  const { ltv, payback, ltvCac, avgLifespanMonths } = derived;

  const monthlyPrice = billing === 'monthly' ? price : price / 12;
  const annualChurn = (1 - Math.pow(1 - churnMonthly / 100, 12)) * 100;
  const retention = 100 - churnMonthly;
  const contribMarginPerCustomer = monthlyPrice * (grossMargin / 100);

  return (
    <ModuleShell
      title="02 — Unit Economics Battle"
      goal="Every customer should be worth significantly more than they cost to acquire. Master LTV, CAC, and payback — the holy trinity of SaaS health."
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px' }}>

        {/* LEFT */}
        <div>
          <SectionLabel>Parameters — drag to adjust</SectionLabel>

          {/* Billing toggle */}
          <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '11px', color: '#4b5568' }}>Billing:</span>
            <Toggle
              value={billing}
              options={[{ value: 'monthly', label: 'Monthly' }, { value: 'annual', label: 'Annual' }]}
              onChange={(v) => dispatch({ type: 'SET_UNIT', field: 'billing', value: v })}
            />
            {billing === 'annual' && (
              <span style={{ fontSize: '10px', color: '#4b5568' }}>
                (÷12 = {fmt.currency(price / 12)}/mo effective)
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
            <ParameterCell
              label={billing === 'annual' ? 'Price / year' : 'Price / month'}
              value={price}
              onChange={(v) => dispatch({ type: 'SET_UNIT', field: 'price', value: v })}
              min={10} max={50_000}
              step={billing === 'annual' ? 100 : 10} dragSensitivity={25}
              format={(v) => `$${v.toLocaleString()}`}
              unit={billing === 'annual' ? '/yr' : '/mo'}
              hint="What you charge per customer"
            />
            <ParameterCell
              label="Gross Margin"
              value={grossMargin}
              onChange={(v) => dispatch({ type: 'SET_UNIT', field: 'grossMargin', value: v })}
              min={10} max={95}
              step={1} dragSensitivity={25}
              format={(v) => fmt.pct(v)}
              hint="Revenue minus COGS (hosting, support, etc.)"
            />
            <ParameterCell
              label="CAC"
              value={cac}
              onChange={(v) => dispatch({ type: 'SET_UNIT', field: 'cac', value: v })}
              min={10} max={100_000}
              step={50} dragSensitivity={20}
              format={fmt.currency}
              hint="All-in cost to acquire one customer (sales + marketing)"
            />
            <ParameterCell
              label="Monthly Churn"
              value={churnMonthly}
              onChange={(v) => dispatch({ type: 'SET_UNIT', field: 'churnMonthly', value: v })}
              min={0.1} max={25}
              step={0.5} dragSensitivity={25}
              format={(v) => fmt.pct(v)}
              unit="/mo"
              hint="% of customers who cancel each month"
            />
          </div>

          <SectionLabel>Outputs</SectionLabel>
          <OutputTable rows={[
            {
              label: 'LTV (Gross Profit)',
              value: ltv > 999_000 ? '>$1M' : fmt.currency(ltv),
              status: ltvCac >= 5 ? 'good' : ltvCac >= 3 ? 'warn' : 'bad',
              sublabel: `Avg lifespan: ${Math.min(avgLifespanMonths, 99).toFixed(0)} months`,
            },
            {
              label: 'LTV / CAC',
              value: fmt.ratio(ltvCac),
              status: ltvCac >= 5 ? 'good' : ltvCac >= 3 ? 'warn' : 'bad',
              sublabel: '≥3× baseline · ≥5× Series A',
            },
            {
              label: 'CAC Payback',
              value: `${Math.min(payback, 99).toFixed(1)} months`,
              status: payback <= 6 ? 'good' : payback <= 12 ? 'warn' : 'bad',
              sublabel: '≤12mo acceptable · ≤6mo excellent',
            },
            {
              label: 'Contribution Margin / Customer',
              value: `${fmt.currency(contribMarginPerCustomer)}/mo`,
              status: contribMarginPerCustomer > 200 ? 'good' : contribMarginPerCustomer > 50 ? 'warn' : 'bad',
              sublabel: 'Gross profit per customer per month',
            },
            {
              label: 'Annual Churn',
              value: fmt.pct(annualChurn),
              status: annualChurn < 15 ? 'good' : annualChurn < 30 ? 'warn' : 'bad',
              sublabel: `Monthly retention: ${retention}%`,
            },
          ]} />

          <Divider />

          <SectionLabel>Flags</SectionLabel>
          <FlagsPanel flags={flags} moduleId={2} />
        </div>

        {/* RIGHT */}
        <div>
          <div style={{
            background: '#0b0b0f',
            border: '1px solid #1a1a25',
            borderRadius: '12px',
            padding: '18px',
            marginBottom: '16px',
          }}>
            <LTVCACChart ltv={ltv} cac={cac} payback={payback} />
          </div>

          <div style={{
            background: '#0b0b0f',
            border: '1px solid #1a1a25',
            borderRadius: '12px',
            padding: '18px',
            marginBottom: '20px',
          }}>
            <BattleMeter ltvCac={ltvCac} payback={payback} grossMargin={grossMargin} churnMonthly={churnMonthly} />
          </div>

          <SectionLabel>Key Concepts</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <ConceptCard
              term="LTV — Lifetime Value"
              definition="How much gross profit one customer generates before churning. LTV = (Monthly Price × Gross Margin%) ÷ Monthly Churn Rate."
              why="Higher LTV = more budget for acquisition. Every churn point matters exponentially."
              accent="#22c55e"
            />
            <ConceptCard
              term="CAC — Customer Acquisition Cost"
              definition="Total sales + marketing spend divided by new customers in a period. Fully-loaded CAC includes salaries, tools, ads."
              why="VCs benchmark CAC against LTV. Below 3× LTV/CAC signals broken economics."
              accent="#ef4444"
            />
            <ConceptCard
              term="Payback Period"
              definition="Months to recover CAC from gross profit. Payback = CAC ÷ (Monthly Price × Gross Margin%)."
              why="Long payback = capital-intensive growth. >18mo is a Series A risk flag."
              accent="#f59e0b"
            />
            <ConceptCard
              term="Churn vs Retention"
              definition="5% monthly churn = 46% annual churn — half your customers gone per year. Best SaaS: <1% monthly, often with negative churn via expansion revenue."
              why="Churn is the silent killer. 1% improvement in churn can 2× LTV."
              accent="#818cf8"
            />
          </div>
        </div>
      </div>
    </ModuleShell>
  );
};

// ═══════════════════════════════════════════════════════════════
// MODULE 3: RUNWAY + DILUTION VISUALIZER
// ═══════════════════════════════════════════════════════════════
const RunwayModule = ({ state, dispatch, flags, derived }) => {
  const {
    startingCash, totalMonthlyBurn,
    burnHeadcount, burnInfra, burnOps,
    monthlyRevenue, revenueGrowthMoM,
    fundraiseMonth, fundraiseAmount,
    safeCapPercent, optionPool,
  } = state;

  const {
    runwayMonths, breakevenMonth, cashData, founderOwnership, totalDilution,
  } = derived;

  const netBurn = totalMonthlyBurn - monthlyRevenue;

  return (
    <ModuleShell
      title="03 — Runway + Dilution Visualizer"
      goal="Time is your most finite resource. Model your burn rate, revenue ramp, and how fundraising dilutes your stake — before you sign anything."
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px' }}>

        {/* LEFT */}
        <div>
          <SectionLabel>Cash & Burn</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
            <ParameterCell
              label="Starting Cash"
              value={startingCash}
              onChange={(v) => dispatch({ type: 'SET_RUNWAY', field: 'startingCash', value: v })}
              min={100_000} max={50_000_000}
              step={250_000} dragSensitivity={25}
              format={fmt.currency}
              hint="Total capital raised (seed, angels, SAFE)"
            />
            <ParameterCell
              label="Monthly Burn"
              value={totalMonthlyBurn}
              onChange={(v) => dispatch({ type: 'SET_RUNWAY', field: 'totalMonthlyBurn', value: v })}
              min={5_000} max={5_000_000}
              step={10_000} dragSensitivity={20}
              format={fmt.currency}
              unit="/mo"
              hint="Total operating expenses per month"
            />
          </div>

          {/* Burn breakdown */}
          <div style={{
            background: '#0b0b0f',
            border: '1px solid #1a1a25',
            borderRadius: '10px',
            padding: '14px',
            marginBottom: '16px',
          }}>
            <div style={{ fontSize: '10px', color: '#3a3a4a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
              Burn Breakdown ({burnHeadcount + burnInfra + burnOps}%)
            </div>
            {[
              { label: 'Headcount', field: 'burnHeadcount', value: burnHeadcount, color: '#6366f1' },
              { label: 'Infrastructure', field: 'burnInfra', value: burnInfra, color: '#22c55e' },
              { label: 'Operations', field: 'burnOps', value: burnOps, color: '#f59e0b' },
            ].map(b => (
              <div key={b.field} style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#4b5568' }}>{b.label}</span>
                  <span style={{ fontSize: '11px', color: b.color, fontFamily: 'JetBrains Mono, monospace' }}>
                    {b.value}% · {fmt.currency(totalMonthlyBurn * b.value / 100)}/mo
                  </span>
                </div>
                <input
                  type="range" min={0} max={90} step={5} value={b.value}
                  onChange={(e) => dispatch({ type: 'SET_RUNWAY', field: b.field, value: Number(e.target.value) })}
                  style={{
                    width: '100%', height: '4px',
                    accentColor: b.color, cursor: 'pointer',
                  }}
                />
              </div>
            ))}
          </div>

          <SectionLabel>Revenue</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
            <ParameterCell
              label="Starting MRR"
              value={monthlyRevenue}
              onChange={(v) => dispatch({ type: 'SET_RUNWAY', field: 'monthlyRevenue', value: v })}
              min={0} max={5_000_000}
              step={5_000} dragSensitivity={25}
              format={fmt.currency}
              unit="/mo"
            />
            <ParameterCell
              label="MoM Growth"
              value={revenueGrowthMoM}
              onChange={(v) => dispatch({ type: 'SET_RUNWAY', field: 'revenueGrowthMoM', value: v })}
              min={0} max={50}
              step={1} dragSensitivity={25}
              format={(v) => fmt.pct(v)}
              unit="MoM"
              hint="Monthly revenue growth rate"
            />
          </div>

          <SectionLabel>Fundraise Event (optional)</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
            <ParameterCell
              label="Raise in Month"
              value={fundraiseMonth}
              onChange={(v) => dispatch({ type: 'SET_RUNWAY', field: 'fundraiseMonth', value: v })}
              min={0} max={24}
              step={1} dragSensitivity={30}
              unit="mo"
              hint="Month 0 = no raise planned"
            />
            <ParameterCell
              label="Raise Amount"
              value={fundraiseAmount}
              onChange={(v) => dispatch({ type: 'SET_RUNWAY', field: 'fundraiseAmount', value: v })}
              min={0} max={20_000_000}
              step={250_000} dragSensitivity={25}
              format={fmt.currency}
              hint="New capital received in that month"
            />
          </div>

          <SectionLabel>Dilution Assumptions</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
            <ParameterCell
              label="SAFE / Equity %"
              value={safeCapPercent}
              onChange={(v) => dispatch({ type: 'SET_RUNWAY', field: 'safeCapPercent', value: v })}
              min={0} max={50}
              step={1} dragSensitivity={25}
              format={(v) => fmt.pct(v)}
              hint="Investor ownership after seed conversion"
            />
            <ParameterCell
              label="Option Pool"
              value={optionPool}
              onChange={(v) => dispatch({ type: 'SET_RUNWAY', field: 'optionPool', value: v })}
              min={0} max={30}
              step={1} dragSensitivity={25}
              format={(v) => fmt.pct(v)}
              hint="Employee equity reserved in cap table"
            />
          </div>

          <SectionLabel>Outputs</SectionLabel>
          <OutputTable rows={[
            {
              label: 'Net Monthly Burn',
              value: `${netBurn > 0 ? '-' : '+'}${fmt.currency(Math.abs(netBurn))}/mo`,
              status: netBurn < 0 ? 'good' : netBurn < totalMonthlyBurn * 0.5 ? 'warn' : 'bad',
              sublabel: netBurn <= 0 ? 'Cash flow positive!' : `Burning ${fmt.currency(netBurn)}/mo net`,
            },
            {
              label: 'Runway',
              value: `${runwayMonths} months`,
              status: runwayMonths >= 18 ? 'good' : runwayMonths >= 12 ? 'warn' : 'bad',
              sublabel: `≥18mo target · ≥12mo minimum`,
            },
            {
              label: 'Breakeven Month',
              value: breakevenMonth ? `Month ${breakevenMonth}` : 'Beyond 24mo',
              status: breakevenMonth && breakevenMonth <= 18 ? 'good' : breakevenMonth ? 'warn' : 'bad',
              sublabel: 'When revenue covers all burn',
            },
            {
              label: 'Founder Ownership',
              value: fmt.pct(founderOwnership),
              status: founderOwnership >= 65 ? 'good' : founderOwnership >= 50 ? 'warn' : 'bad',
              sublabel: `After ${safeCapPercent}% SAFE + ${optionPool}% pool`,
            },
            {
              label: 'Total Dilution',
              value: fmt.pct(totalDilution),
              status: totalDilution <= 25 ? 'good' : totalDilution <= 35 ? 'warn' : 'bad',
              sublabel: 'Investors + option pool combined',
            },
          ]} />

          <Divider />

          <SectionLabel>Flags</SectionLabel>
          <FlagsPanel flags={flags} moduleId={3} />
        </div>

        {/* RIGHT */}
        <div>
          <div style={{
            background: '#0b0b0f',
            border: '1px solid #1a1a25',
            borderRadius: '12px',
            padding: '18px',
            marginBottom: '16px',
          }}>
            <CashFlowChart
              cashData={cashData}
              fundraiseMonth={fundraiseMonth}
              fundraiseAmount={fundraiseAmount}
            />
          </div>

          <div style={{
            background: '#0b0b0f',
            border: '1px solid #1a1a25',
            borderRadius: '12px',
            padding: '18px',
            marginBottom: '20px',
          }}>
            <div style={{ fontSize: '10px', color: '#4b5568', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>
              Cap Table After Seed
            </div>
            <OwnershipDonut safeCapPercent={safeCapPercent} optionPool={optionPool} />
          </div>

          <SectionLabel>Key Concepts</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <ConceptCard
              term="Runway"
              definition="How long until you run out of cash at the current burn rate. Runway = Cash ÷ Net Monthly Burn. Always count from today's net burn, not gross."
              why="Fundraising takes 3–6 months. 18+ months gives you room to raise from strength, not desperation."
              accent="#6366f1"
            />
            <ConceptCard
              term="Burn Rate"
              definition="Net burn = total expenses minus revenue. A company with $200K expenses and $80K revenue burns $120K/mo net. Track both gross and net."
              why="Investors watch burn multiple: net burn ÷ new ARR added. <1.5× is efficient."
              accent="#f87171"
            />
            <ConceptCard
              term="Cash Trough"
              definition="The lowest point your cash balance reaches before revenue growth outpaces burn. Common for fast-growing startups to see a J-curve."
              why="Know your trough in advance. If it goes negative, you need a bridge or revenue acceleration."
              accent="#fbbf24"
            />
            <ConceptCard
              term="Dilution"
              definition="Selling equity reduces your ownership percentage. SAFE notes convert at valuation caps. Option pools are typically 10–20% of fully-diluted shares."
              why="Every round dilutes. Model downstream dilution now — a 20% seed can become 60% over 3 rounds."
              accent="#22c55e"
            />
          </div>
        </div>
      </div>
    </ModuleShell>
  );
};

// ═══════════════════════════════════════════════════════════════
// INTRO SCREEN
// ═══════════════════════════════════════════════════════════════
const IntroScreen = ({ onStart }) => (
  <div style={{
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: '28px',
    padding: '40px',
    background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(99,102,241,0.08) 0%, transparent 70%)',
  }}>
    <div style={{ textAlign: 'center', maxWidth: '480px' }}>
      <div style={{
        width: '52px', height: '52px',
        background: 'linear-gradient(135deg, #4338ca, #818cf8)',
        borderRadius: '14px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '26px', fontWeight: 900, color: '#fff',
        margin: '0 auto 24px',
        boxShadow: '0 0 40px rgba(99,102,241,0.3)',
      }}>
        ∑
      </div>
      <h1 style={{
        fontSize: '36px',
        fontWeight: 900,
        color: '#e8e4dc',
        letterSpacing: '-0.04em',
        marginBottom: '12px',
        lineHeight: 1.1,
      }}>
        Founder Math Lab
      </h1>
      <p style={{
        fontSize: '15px',
        color: '#4b5568',
        lineHeight: 1.65,
        marginBottom: '32px',
      }}>
        Learn investor-grade numeric reasoning by touching real numbers —
        drag assumptions, watch consequences, earn your score.
      </p>

      <div style={{
        display: 'flex',
        gap: '10px',
        justifyContent: 'center',
        marginBottom: '36px',
        flexWrap: 'wrap',
      }}>
        {['Market Size', 'Unit Economics', 'Runway & Dilution'].map((m, i) => (
          <div key={m} style={{
            padding: '6px 14px',
            borderRadius: '6px',
            background: '#111118',
            border: '1px solid #1a1a25',
            fontSize: '12px',
            color: '#6b7280',
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
          }}>
            <span style={{
              width: '18px', height: '18px',
              borderRadius: '50%',
              background: '#1d1d2a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '9px', color: '#818cf8', fontWeight: 700,
            }}>{i + 1}</span>
            {m}
          </div>
        ))}
      </div>

      <button
        onClick={onStart}
        style={{
          padding: '14px 36px',
          background: 'linear-gradient(135deg, #4338ca, #6366f1)',
          border: 'none',
          borderRadius: '10px',
          color: '#fff',
          fontSize: '15px',
          fontWeight: 700,
          cursor: 'pointer',
          letterSpacing: '0.01em',
          boxShadow: '0 0 30px rgba(99,102,241,0.35)',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 40px rgba(99,102,241,0.5)'; }}
        onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 0 30px rgba(99,102,241,0.35)'; }}
      >
        Start Exploring →
      </button>

      <p style={{ fontSize: '11px', color: '#2a2a35', marginTop: '20px' }}>
        Every number is draggable. Every change teaches.
      </p>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [screen, setScreen] = useState('intro'); // 'intro' | 'modules'
  const [currentModule, setCurrentModule] = useState(1);
  const [market, setMarket] = useState(DEFAULTS.market);
  const [unit, setUnit] = useState(DEFAULTS.unit);
  const [runway, setRunway] = useState(DEFAULTS.runway);

  // Unified dispatch
  const dispatch = useCallback((action) => {
    switch (action.type) {
      case 'SET_MARKET':
        setMarket(prev => ({ ...prev, [action.field]: action.value }));
        break;
      case 'SET_UNIT':
        setUnit(prev => ({ ...prev, [action.field]: action.value }));
        break;
      case 'SET_RUNWAY':
        setRunway(prev => ({ ...prev, [action.field]: action.value }));
        break;
    }
  }, []);

  // ── Memoized score + derived ─────────────────────────────────
  const { score, flags, derived } = useMemo(() => {
    return computeScore(market, unit, runway);
  }, [market, unit, runway]);

  // ── Module completion ────────────────────────────────────────
  const moduleCompletion = useMemo(() => ({
    1: checkModuleComplete(1, flags, score),
    2: checkModuleComplete(2, flags, score),
    3: checkModuleComplete(3, flags, score),
  }), [flags, score]);

  if (screen === 'intro') {
    return <IntroScreen onStart={() => setScreen('modules')} />;
  }

  return (
    <div style={{ minHeight: '100vh', paddingTop: '58px' }}>
      <ScoreHeader
        score={score}
        flags={flags}
        currentModule={currentModule}
        setModule={setCurrentModule}
        moduleCompletion={moduleCompletion}
      />

      {/* Module content */}
      <div style={{ position: 'relative' }}>
        {currentModule === 1 && (
          <MarketModule
            state={market}
            dispatch={dispatch}
            flags={flags}
            derived={derived}
          />
        )}
        {currentModule === 2 && (
          <UnitEconomicsModule
            state={unit}
            dispatch={dispatch}
            flags={flags}
            derived={derived}
          />
        )}
        {currentModule === 3 && (
          <RunwayModule
            state={runway}
            dispatch={dispatch}
            flags={flags}
            derived={derived}
          />
        )}
      </div>

      {/* Bottom navigation */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        background: 'rgba(8,8,9,0.9)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid #1a1a25',
        padding: '12px 28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 100,
      }}>
        <button
          onClick={() => setCurrentModule(m => Math.max(1, m - 1))}
          disabled={currentModule === 1}
          style={{
            padding: '8px 18px',
            background: currentModule === 1 ? 'transparent' : '#111118',
            border: '1px solid #1a1a25',
            borderRadius: '7px',
            color: currentModule === 1 ? '#2a2a35' : '#6b7280',
            fontSize: '12px',
            cursor: currentModule === 1 ? 'default' : 'pointer',
            fontWeight: 600,
          }}
        >
          ← Previous
        </button>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {[1, 2, 3].map(n => (
            <div key={n} style={{
              width: n === currentModule ? '24px' : '8px',
              height: '8px',
              borderRadius: '4px',
              background: moduleCompletion[n] ? '#22c55e' : n === currentModule ? '#6366f1' : '#1a1a25',
              transition: 'all 0.3s',
              cursor: 'pointer',
            }} onClick={() => setCurrentModule(n)} />
          ))}
        </div>

        <button
          onClick={() => setCurrentModule(m => Math.min(3, m + 1))}
          disabled={currentModule === 3}
          style={{
            padding: '8px 18px',
            background: currentModule === 3 ? 'transparent' : 'linear-gradient(135deg, #4338ca, #6366f1)',
            border: currentModule === 3 ? '1px solid #1a1a25' : 'none',
            borderRadius: '7px',
            color: currentModule === 3 ? '#2a2a35' : '#fff',
            fontSize: '12px',
            cursor: currentModule === 3 ? 'default' : 'pointer',
            fontWeight: 600,
          }}
        >
          Next →
        </button>
      </div>

      {/* AI Coach */}
      <CoachPanel
        score={score}
        flags={flags}
        marketState={market}
        unitState={unit}
        runwayState={runway}
        derived={derived}
      />
    </div>
  );
}
