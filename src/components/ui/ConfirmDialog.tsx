"use client";
import { useCallback, useState, type ReactNode } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as destructive (delete / remove). */
  danger?: boolean;
}

/**
 * The one confirmation pattern for the app. Replaces `window.confirm`, which
 * looks nothing like PostCrisp and cannot be styled, sized or made
 * accessible. Usage:
 *
 *   const { confirm, confirmDialog } = useConfirm()
 *   if (!(await confirm({ title: 'Hide this?', message: '…' }))) return
 *   …
 *   {confirmDialog}
 */
export function useConfirm(): {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  confirmDialog: ReactNode;
} {
  const [state, setState] = useState<{ opts: ConfirmOptions; resolve: (ok: boolean) => void } | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ opts, resolve })),
    [],
  );

  const settle = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
  };

  const confirmDialog = state ? (
    <Modal isOpen onClose={() => settle(false)} title={state.opts.title}>
      <p className="text-sm text-zinc-300 mb-5">{state.opts.message}</p>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <Button variant="secondary" onClick={() => settle(false)}>
          {state.opts.cancelLabel ?? "Cancel"}
        </Button>
        <Button variant={state.opts.danger ? "danger" : "primary"} onClick={() => settle(true)} autoFocus>
          {state.opts.confirmLabel ?? "Confirm"}
        </Button>
      </div>
    </Modal>
  ) : null;

  return { confirm, confirmDialog };
}
