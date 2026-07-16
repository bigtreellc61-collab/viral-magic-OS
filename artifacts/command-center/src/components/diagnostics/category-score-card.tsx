import { useEffect, useState } from "react";
import { SeverityBadge } from "./severity-badge";
import {
  liveCalcPriorityScore,
  liveCalcSeverity,
  liveCalcPerformanceGap,
  SEVERITY_BAR_COLORS,
} from "@/lib/diagnostic-constants";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

export interface CategoryScoreData {
  categoryKey: string;
  categoryLabel: string;
  categoryDescription?: string | null;
  displayOrder?: number;
  currentPerformance: number | null;
  businessImpact: number | null;
  urgency: number | null;
  evidence?: string | null;
  observations?: string | null;
  notes?: string | null;
  recommendedAction?: string | null;
}

interface Props {
  data: CategoryScoreData;
  readonly?: boolean;
  onChange?: (updated: CategoryScoreData) => void;
}

function SliderInput({ label, value, min, max, step, onChange, readonly }: {
  label: string; value: number | null; min: number; max: number; step?: number;
  onChange: (v: number) => void; readonly?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="text-xs font-mono font-semibold text-slate-200 tabular-nums w-6 text-right">
          {value ?? "—"}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step ?? 0.5}
        value={value ?? min}
        disabled={readonly}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 appearance-none rounded-full bg-slate-700 accent-indigo-500 cursor-pointer disabled:opacity-50"
      />
      <div className="flex justify-between text-[10px] text-slate-600">
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  );
}

export function CategoryScoreCard({ data, readonly = false, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [local, setLocal] = useState<CategoryScoreData>(data);

  useEffect(() => { setLocal(data); }, [data]);

  const update = (partial: Partial<CategoryScoreData>) => {
    const updated = { ...local, ...partial };
    setLocal(updated);
    onChange?.(updated);
  };

  const hasScores = local.currentPerformance != null && local.businessImpact != null && local.urgency != null;
  const priorityScore = hasScores
    ? liveCalcPriorityScore(local.currentPerformance!, local.businessImpact!, local.urgency!)
    : null;
  const severity = priorityScore != null ? liveCalcSeverity(priorityScore) : null;
  const gap = local.currentPerformance != null ? liveCalcPerformanceGap(local.currentPerformance) : null;
  const barColor = severity ? SEVERITY_BAR_COLORS[severity] : "bg-slate-600";

  return (
    <div className={cn(
      "border rounded-lg bg-slate-800/50 transition-all",
      severity === "critical" ? "border-red-500/40" :
      severity === "high" ? "border-orange-500/40" :
      severity === "moderate" ? "border-yellow-500/40" :
      "border-slate-700/50",
    )}>
      {/* Header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-200">{local.categoryLabel}</span>
            {severity && <SeverityBadge severity={severity} />}
          </div>
          {local.categoryDescription && !expanded && (
            <p className="text-xs text-slate-500 mt-0.5 truncate">{local.categoryDescription}</p>
          )}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {hasScores ? (
            <div className="text-right">
              <div className="text-xs text-slate-500">Priority</div>
              <div className="text-sm font-semibold tabular-nums text-slate-200">
                {priorityScore?.toFixed(1)}
              </div>
            </div>
          ) : (
            <span className="text-xs text-slate-500">Not scored</span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </div>

      {/* Priority bar */}
      {priorityScore != null && (
        <div className="px-4 -mt-2 pb-2">
          <div className="h-1 w-full rounded-full bg-slate-700/50">
            <div
              className={cn("h-full rounded-full transition-all", barColor)}
              style={{ width: `${Math.min(100, (priorityScore / 250) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-700/50 pt-4 space-y-4">
          {local.categoryDescription && (
            <p className="text-xs text-slate-400 bg-slate-700/30 rounded p-2">{local.categoryDescription}</p>
          )}

          {/* Score sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SliderInput
              label="Current Performance (0–10)"
              value={local.currentPerformance}
              min={0} max={10} step={0.5}
              readonly={readonly}
              onChange={(v) => update({ currentPerformance: v })}
            />
            <SliderInput
              label="Business Impact (1–5)"
              value={local.businessImpact}
              min={1} max={5} step={0.5}
              readonly={readonly}
              onChange={(v) => update({ businessImpact: v })}
            />
            <SliderInput
              label="Urgency (1–5)"
              value={local.urgency}
              min={1} max={5} step={0.5}
              readonly={readonly}
              onChange={(v) => update({ urgency: v })}
            />
          </div>

          {/* Live preview */}
          {hasScores && (
            <div className="grid grid-cols-3 gap-3 bg-slate-700/30 rounded-lg p-3">
              <div className="text-center">
                <div className="text-xs text-slate-500 mb-0.5">Gap</div>
                <div className="text-sm font-mono font-semibold text-slate-200">{gap?.toFixed(1)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-slate-500 mb-0.5">Priority Score</div>
                <div className="text-sm font-mono font-semibold text-slate-200">{priorityScore?.toFixed(1)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-slate-500 mb-0.5">Severity</div>
                {severity && <SeverityBadge severity={severity} />}
              </div>
            </div>
          )}

          {/* Text fields */}
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Evidence / Current State</label>
              <textarea
                className="w-full bg-slate-700/50 border border-slate-600/50 rounded px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                rows={2}
                placeholder="What evidence supports this score?"
                value={local.evidence ?? ""}
                disabled={readonly}
                onChange={(e) => update({ evidence: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Observations</label>
              <textarea
                className="w-full bg-slate-700/50 border border-slate-600/50 rounded px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                rows={2}
                placeholder="Key observations from this area..."
                value={local.observations ?? ""}
                disabled={readonly}
                onChange={(e) => update({ observations: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Recommended Action</label>
              <textarea
                className="w-full bg-slate-700/50 border border-slate-600/50 rounded px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                rows={2}
                placeholder="Recommended next action..."
                value={local.recommendedAction ?? ""}
                disabled={readonly}
                onChange={(e) => update({ recommendedAction: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
