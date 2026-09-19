"use client";
import { useCallback, useState, type ReactNode } from "react";
import type { CrispTask } from "@/lib/crisp-engine-config";
import { creditCostForTask, SPEND_CONFIRM_THRESHOLD } from "@/lib/tools-meta";
import { Modal } from "./Modal";
import { Button } from "./Button";

/**
 * Price tag for an action. Reads the one canonical price table via the tool
 * registry, so pages never hard-code a credit number. Render it inside the
 * generate button (or beside it) so the user sees the cost before spending.
 */
export function CreditCost({ task, className = "" }: { task: CrispTask; className?: string }) {
  const cost = creditCostForTask(task);
  return (
    <span
      className={`inline-flex items-center rounded-md bg-black/20 px-1.5 py-0.5 text-xs font-semibold tracking-wide opacity-90 ${className}`}
      aria-label={`Costs ${cost} credit${cost === 1 ? "" : "s"}`}
    >
      {cost} {cost === 1 ? "credit" : "credits"}
    </span>
  );
}

/**
 * Confirmation step for expensive actions. Any task priced at
 * `SPEND_CONFIRM_THRESHOLD` or more asks before spending; cheaper tasks run
 * immediately. Usage:
 *
 *   const { confirmSpend, spendDialog } = useSpendConfirm('foundation-analysis')
 *   <Button onClick={() => confirmSpend(handleAnalyze)}>…</Button>
 *   {spendDialog}
 */
export function useSpendConfirm(task: CrispTask, label?: string): {
  confirmSpend: (run: () => void) => void;
  spendDialog: ReactNode;
} {
  const cost = creditCostForTask(task);
  const [pending, setPending] = useState<(() => void) | null>(null);

  const confirmSpend = useCallback(
    (run: () => void) => {
      if (cost < SPEND_CONFIRM_THRESHOLD) {
        run();
        return;
      }
      setPending(() => run);
    },
    [cost],
  );

  const close = () => setPending(null);
  const proceed = () => {
    const run = pending;
    setPending(null);
    run?.();
  };

  const spendDialog = (
    <Modal isOpen={pending !== null} onClose={close} title={`Spend ${cost} credits?`}>
      <p className="text-sm text-zinc-300 mb-5">
        {label ?? "This action"} costs <strong className="text-zinc-100">{cost} credits</strong>. Credits are
        deducted when the run starts and refunded automatically if it fails.
      </p>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <Button variant="secondary" onClick={close}>Cancel</Button>
        <Button onClick={proceed} autoFocus>Spend {cost} credits</Button>
      </div>
    </Modal>
  );

  return { confirmSpend, spendDialog };
}
