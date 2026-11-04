"use client";

import { useState } from "react";
import { compact, niceScale } from "@/lib/dashboard";

/**
 * Small dependency-free SVG charts for the société dashboard. Colors come
 * from the `--viz-*` tokens in globals.css (own light/dark steps), thin
 * marks with 4px rounded data-ends, recessive hairline grid, text in muted
 * ink (never the series color), legend always present for 2+ series.
 */

export interface BarSeries {
  key: string;
  label: string;
  color: string; // CSS color, e.g. "var(--viz-1)"
}

export interface BarDatum {
  label: string;
  values: number[]; // one per series
}

interface BarChartProps {
  data: BarDatum[];
  series: BarSeries[];
  locale: string;
  ariaLabel: string;
  formatValue?: (n: number) => string;
}

const W = 640;
const H = 220;
const PAD = { top: 12, right: 8, bottom: 26, left: 40 };

function topRoundedBar(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return "";
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

export function BarChart({ data, series, locale, ariaLabel, formatValue }: BarChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const fmt = formatValue ?? ((n: number) => n.toLocaleString(locale));

  const max = Math.max(0, ...data.flatMap((d) => d.values));
  const { top, ticks } = niceScale(max);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const band = plotW / Math.max(1, data.length);
  const barW = Math.min(14, (band * 0.7) / series.length - 2);
  const groupW = series.length * barW + (series.length - 1) * 2;
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={ariaLabel}
        className="h-auto w-full"
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              style={{ stroke: "var(--viz-grid)" }}
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={y(tick) + 3}
              textAnchor="end"
              fontSize={10}
              style={{ fill: "var(--viz-label)" }}
            >
              {tick === 0 ? "0" : compact(tick, locale)}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const gx = PAD.left + band * i + (band - groupW) / 2;
          return (
            <g key={i}>
              {hover === i && (
                <rect
                  x={PAD.left + band * i}
                  y={PAD.top}
                  width={band}
                  height={plotH}
                  rx={6}
                  style={{ fill: "var(--viz-grid)" }}
                  opacity={0.6}
                />
              )}
              {d.values.map((v, s) => {
                const h = (v / top) * plotH;
                return (
                  <path
                    key={s}
                    d={topRoundedBar(gx + s * (barW + 2), y(v), barW, h, 4)}
                    style={{ fill: series[s].color }}
                  />
                );
              })}
              <text
                x={PAD.left + band * i + band / 2}
                y={H - 8}
                textAnchor="middle"
                fontSize={10}
                style={{ fill: "var(--viz-label)" }}
              >
                {d.label}
              </text>
              <rect
                x={PAD.left + band * i}
                y={PAD.top}
                width={band}
                height={plotH + PAD.bottom}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
              />
            </g>
          );
        })}
      </svg>

      {hover !== null && data[hover] && (
        <div
          className="pointer-events-none absolute top-1 z-10 min-w-[120px] rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-md"
          style={{
            left: `${((PAD.left + band * hover + band / 2) / W) * 100}%`,
            transform: "translateX(-50%)",
          }}
        >
          <div className="mb-1 font-bold text-neutral-900">{data[hover].label}</div>
          {series.map((s, i) => (
            <div key={s.key} className="flex items-center justify-between gap-3 text-neutral-600">
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ background: s.color }}
                />
                {s.label}
              </span>
              <span className="font-semibold text-neutral-900">
                {fmt(data[hover!].values[i])}
              </span>
            </div>
          ))}
        </div>
      )}

      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-neutral-600">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}

      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th />
            {series.map((s) => (
              <th key={s.key}>{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={i}>
              <th>{d.label}</th>
              {d.values.map((v, s) => (
                <td key={s}>{fmt(v)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface DonutProps {
  slices: DonutSlice[];
  centerValue: string;
  centerLabel: string;
  ariaLabel: string;
}

export function Donut({ slices, centerValue, centerLabel, ariaLabel }: DonutProps) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = 52;
  const c = 2 * Math.PI * r;
  const gap = total > 0 && slices.filter((s) => s.value > 0).length > 1 ? 3 : 0;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <svg viewBox="0 0 140 140" role="img" aria-label={ariaLabel} className="h-36 w-36">
        <circle cx={70} cy={70} r={r} fill="none" strokeWidth={14} style={{ stroke: "var(--viz-track)" }} />
        {total > 0 &&
          slices.map((s) => {
            if (s.value <= 0) return null;
            const len = (s.value / total) * c;
            const dash = Math.max(0, len - gap);
            const el = (
              <circle
                key={s.key}
                cx={70}
                cy={70}
                r={r}
                fill="none"
                strokeWidth={14}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 70 70)"
                style={{ stroke: s.color }}
              >
                <title>{`${s.label}: ${s.value}`}</title>
              </circle>
            );
            offset += len;
            return el;
          })}
        <text
          x={70}
          y={68}
          textAnchor="middle"
          fontSize={22}
          fontWeight={800}
          style={{ fill: "currentColor" }}
          className="text-neutral-900"
        >
          {centerValue}
        </text>
        <text x={70} y={84} textAnchor="middle" fontSize={9} style={{ fill: "var(--viz-label)" }}>
          {centerLabel}
        </text>
      </svg>
      <ul className="flex w-full flex-col gap-1.5 text-xs text-neutral-600">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="font-bold text-neutral-900">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface GaugeProps {
  percent: number; // 0-100
  ariaLabel: string;
}

/** Half-circle progress gauge. Fill color carries state: low -> warn, high -> good. */
export function Gauge({ percent, ariaLabel }: GaugeProps) {
  const p = Math.max(0, Math.min(100, percent));
  const color = p >= 67 ? "var(--viz-good)" : p >= 34 ? "var(--viz-1)" : "var(--viz-warn)";
  const d = "M 15 75 A 55 55 0 0 1 125 75";
  return (
    <svg viewBox="0 0 140 90" role="img" aria-label={ariaLabel} className="mx-auto h-24 w-44">
      <path d={d} fill="none" strokeWidth={10} strokeLinecap="round" pathLength={100} style={{ stroke: "var(--viz-track)" }} />
      {p > 0 && (
        <path
          d={d}
          fill="none"
          strokeWidth={10}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${p} 100`}
          style={{ stroke: color }}
        />
      )}
      <text
        x={70}
        y={68}
        textAnchor="middle"
        fontSize={24}
        fontWeight={800}
        style={{ fill: "currentColor" }}
        className="text-neutral-900"
      >
        {Math.round(p)}%
      </text>
    </svg>
  );
}
