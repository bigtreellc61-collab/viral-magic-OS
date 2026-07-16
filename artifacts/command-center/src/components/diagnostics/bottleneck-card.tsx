import { SeverityBadge } from "./severity-badge";
import { ResolutionStatusControl } from "./resolution-status-control";
import { RecommendationEditor } from "./recommendation-editor";
import { PriorityScoreDisplay } from "./priority-score-display";
import { cn } from "@/lib/utils";

interface BottleneckCardProps {
  scoreId: string;
  categoryLabel: string;
  categoryKey: string;
  categoryDescription?: string | null;
  currentPerformance: number | null;
  businessImpact: number | null;
  urgency: number | null;
  priorityScore: number | null;
  severity: string | null;
  evidence?: string | null;
  observations?: string | null;
  resolutionStatus: string;
  recommendation?: {
    id: string;
    systemGeneratedDraft: string | null;
    administratorFinalRecommendation: string | null;
    recommendationStatus: string;
  } | null;
  onResolutionChange?: (scoreId: string, status: string) => void;
  onRecommendationSave?: (recId: string, text: string) => void;
  onRecommendationApprove?: (recId: string, action: string) => void;
}

export function BottleneckCard({
  scoreId, categoryLabel, categoryDescription,
  currentPerformance, businessImpact, urgency,
  priorityScore, severity, evidence, observations, resolutionStatus,
  recommendation, onResolutionChange, onRecommendationSave, onRecommendationApprove,
}: BottleneckCardProps) {
  const isCriticalOrHigh = severity === "critical" || severity === "high";

  return (
    <div className={cn(
      "border rounded-lg bg-slate-800/50 space-y-4 p-4",
      severity === "critical" ? "border-red-500/40" :
      severity === "high" ? "border-orange-500/40" :
      severity === "moderate" ? "border-yellow-500/40" :
      "border-slate-700/50",
    )}>
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-200">{categoryLabel}</h4>
            {severity && <SeverityBadge severity={severity} />}
            {isCriticalOrHigh && (
              <span className="text-xs text-red-400 font-medium">⚠ Priority Bottleneck</span>
            )}
          </div>
          {categoryDescription && (
            <p className="text-xs text-slate-500 mt-0.5">{categoryDescription}</p>
          )}
        </div>
        <PriorityScoreDisplay priorityScore={priorityScore} severity={severity} />
      </div>

      {/* Score row */}
      {currentPerformance != null && (
        <div className="grid grid-cols-3 gap-3 bg-slate-700/30 rounded-lg p-3 text-center">
          <div>
            <div className="text-xs text-slate-500 mb-0.5">Performance</div>
            <div className="text-sm font-mono font-semibold text-slate-200">{Number(currentPerformance).toFixed(1)}/10</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-0.5">Impact</div>
            <div className="text-sm font-mono font-semibold text-slate-200">{Number(businessImpact).toFixed(1)}/5</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-0.5">Urgency</div>
            <div className="text-sm font-mono font-semibold text-slate-200">{Number(urgency).toFixed(1)}/5</div>
          </div>
        </div>
      )}

      {/* Evidence / observations */}
      {(evidence || observations) && (
        <div className="space-y-2">
          {evidence && (
            <div>
              <div className="text-xs font-medium text-slate-500 mb-1">Evidence</div>
              <p className="text-sm text-slate-300">{evidence}</p>
            </div>
          )}
          {observations && (
            <div>
              <div className="text-xs font-medium text-slate-500 mb-1">Observations</div>
              <p className="text-sm text-slate-300">{observations}</p>
            </div>
          )}
        </div>
      )}

      {/* Resolution */}
      <div className="border-t border-slate-700/50 pt-4">
        <ResolutionStatusControl
          scoreId={scoreId}
          currentStatus={resolutionStatus}
          onChange={onResolutionChange}
        />
      </div>

      {/* Recommendation */}
      {recommendation && (
        <div className="border-t border-slate-700/50 pt-4">
          <RecommendationEditor
            recommendation={recommendation}
            onSave={onRecommendationSave}
            onApprove={onRecommendationApprove}
          />
        </div>
      )}
    </div>
  );
}
