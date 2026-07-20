// Plain server-rendered SVG line chart: cumulative estimated $ P&L on this
// politician's priced trades vs. what an equal-sized S&P 500 position would
// have returned over the same windows. No client JS, no chart library --
// consistent with the rest of the app, and the data is small enough that a
// hand-built polyline is simpler than pulling in a dependency.
export type ChartPoint = {
  date: string;
  cumPnl: number;
  cumSpyPnl: number | null;
};

const WIDTH = 640;
const HEIGHT = 200;
const PAD_LEFT = 8;
const PAD_RIGHT = 8;
const PAD_TOP = 12;
const PAD_BOTTOM = 24;

export function PerformanceChart({ points }: { points: ChartPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-xl border border-zinc-200 text-sm text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
        Need at least 2 priced trades to chart a trend.
      </div>
    );
  }

  const allValues = points.flatMap((p) => [p.cumPnl, p.cumSpyPnl ?? p.cumPnl]);
  const min = Math.min(0, ...allValues);
  const max = Math.max(0, ...allValues);
  const range = max - min || 1;

  const innerW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const x = (i: number) => PAD_LEFT + (i / (points.length - 1)) * innerW;
  const y = (v: number) => PAD_TOP + innerH - ((v - min) / range) * innerH;
  const zeroY = y(0);

  const pnlPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.cumPnl).toFixed(1)}`).join(" ");

  const spyPoints = points.filter((p) => p.cumSpyPnl !== null);
  const spyPath =
    spyPoints.length >= 2
      ? points
          .map((p, i) => (p.cumSpyPnl !== null ? `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.cumSpyPnl).toFixed(1)}` : ""))
          .filter(Boolean)
          .join(" ")
      : null;

  const lastPnl = points[points.length - 1].cumPnl;
  const lastSpy = points[points.length - 1].cumSpyPnl;

  const fmt = (v: number) =>
    `${v >= 0 ? "+" : "-"}$${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Cumulative estimated P&L over time">
        {/* zero line */}
        <line x1={PAD_LEFT} y1={zeroY} x2={WIDTH - PAD_RIGHT} y2={zeroY} className="stroke-zinc-200 dark:stroke-zinc-800" strokeWidth={1} />
        {spyPath && (
          <path d={spyPath} fill="none" className="stroke-zinc-400 dark:stroke-zinc-600" strokeWidth={1.5} strokeDasharray="4 3" />
        )}
        <path
          d={pnlPath}
          fill="none"
          className={lastPnl >= 0 ? "stroke-emerald-500" : "stroke-red-500"}
          strokeWidth={2}
        />
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className={`h-0.5 w-4 rounded ${lastPnl >= 0 ? "bg-emerald-500" : "bg-red-500"}`} />
          Actual trades: <span className="font-medium text-zinc-700 dark:text-zinc-300">{fmt(lastPnl)}</span>
        </span>
        {lastSpy !== null && (
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded border-t-2 border-dashed border-zinc-400 dark:border-zinc-600" />
            If S&amp;P 500 instead: <span className="font-medium text-zinc-700 dark:text-zinc-300">{fmt(lastSpy)}</span>
          </span>
        )}
      </div>
    </div>
  );
}
