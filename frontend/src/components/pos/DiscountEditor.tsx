import { Button } from "../ui";
import type { DiscountDraft } from "../../pages/pos/types";

export function DiscountEditor({
  draft,
  onChange,
  onApply,
  onCancel,
  applyLabel,
  percentLabel,
  amountLabel,
}: {
  draft: DiscountDraft;
  onChange: (next: DiscountDraft) => void;
  onApply: () => void;
  onCancel: () => void;
  applyLabel: string;
  percentLabel: string;
  amountLabel: string;
}) {
  return (
    <div className="mt-2 space-y-2 rounded-md border border-line bg-paper px-2.5 py-2">
      <div className="flex gap-1">
        <Button
          variant={draft.type === "percent" ? "primary" : "quiet"}
          className="flex-1"
          onClick={() => onChange({ ...draft, type: "percent" })}
        >
          {percentLabel}
        </Button>
        <Button
          variant={draft.type === "amount" ? "primary" : "quiet"}
          className="flex-1"
          onClick={() => onChange({ ...draft, type: "amount" })}
        >
          {amountLabel}
        </Button>
      </div>
      <input
        className="w-full rounded-md border-[1.5px] border-line-2 bg-cream px-3 py-2 text-[14px] text-ink outline-none focus:border-ink"
        value={draft.value}
        onChange={(e) => onChange({ ...draft, value: e.target.value })}
        inputMode="decimal"
        autoFocus
      />
      <div className="flex gap-2">
        <Button variant="confirm" className="flex-1" onClick={onApply}>
          {applyLabel}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          ×
        </Button>
      </div>
    </div>
  );
}
