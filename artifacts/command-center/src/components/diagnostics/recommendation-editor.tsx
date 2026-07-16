import { useState } from "react";
import { Check, Edit2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Recommendation {
  id: string;
  systemGeneratedDraft: string | null;
  administratorFinalRecommendation: string | null;
  recommendationStatus: string;
}

interface Props {
  recommendation: Recommendation;
  onSave?: (recId: string, text: string) => void;
  onApprove?: (recId: string, action: string) => void;
  disabled?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  edited: "Edited",
  approved: "Approved",
  rejected: "Rejected",
  implemented: "Implemented",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "text-slate-400",
  edited: "text-blue-400",
  approved: "text-emerald-400",
  rejected: "text-red-400",
  implemented: "text-purple-400",
};

export function RecommendationEditor({ recommendation, onSave, onApprove, disabled }: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(
    recommendation.administratorFinalRecommendation ?? recommendation.systemGeneratedDraft ?? "",
  );
  const [localStatus, setLocalStatus] = useState(recommendation.recommendationStatus);

  const displayText = recommendation.administratorFinalRecommendation ?? recommendation.systemGeneratedDraft;
  const isApproved = localStatus === "approved";
  const isImplemented = localStatus === "implemented";

  const handleSave = () => {
    onSave?.(recommendation.id, text);
    setLocalStatus("edited");
    setEditing(false);
  };

  const handleApprove = (action: string) => {
    onApprove?.(recommendation.id, action);
    if (action === "approve") setLocalStatus("approved");
    else if (action === "reject") setLocalStatus("rejected");
    else if (action === "mark_implemented") setLocalStatus("implemented");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h5 className="text-xs font-medium text-slate-400 uppercase tracking-wide">System Recommendation</h5>
        <div className="flex items-center gap-2">
          <span className={cn("text-xs font-medium", STATUS_COLORS[localStatus] ?? "text-slate-400")}>
            {STATUS_LABELS[localStatus] ?? localStatus}
          </span>
          {!disabled && !isApproved && !isImplemented && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="p-1 text-slate-400 hover:text-indigo-400 transition-colors"
              title="Edit recommendation"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            className="w-full bg-slate-700/50 border border-indigo-500/50 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Edit recommendation..."
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded transition-colors"
            >
              <Check className="w-3 h-3" /> Save
            </button>
            <button
              onClick={() => { setEditing(false); setText(recommendation.administratorFinalRecommendation ?? recommendation.systemGeneratedDraft ?? ""); }}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded transition-colors"
            >
              <X className="w-3 h-3" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-700/30 rounded p-3 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
          {displayText ?? <span className="text-slate-500 italic">No recommendation generated yet.</span>}
        </div>
      )}

      {/* Approval controls */}
      {!disabled && !editing && !isApproved && !isImplemented && displayText && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleApprove("approve")}
            className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/30 text-emerald-300 text-xs rounded transition-colors"
          >
            Approve
          </button>
          <button
            onClick={() => handleApprove("reject")}
            className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 text-red-300 text-xs rounded transition-colors"
          >
            Reject
          </button>
        </div>
      )}
      {!disabled && isApproved && (
        <button
          onClick={() => handleApprove("mark_implemented")}
          className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 text-purple-300 text-xs rounded transition-colors"
        >
          Mark Implemented
        </button>
      )}
    </div>
  );
}
