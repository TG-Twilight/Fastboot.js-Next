import { shallowRef } from "vue";

export interface ConfirmRequest {
  message: string;
  detail?: string;
  resolve: (ok: boolean) => void;
}

export const pendingConfirm = shallowRef<ConfirmRequest | null>(null);

/** Asks the user to confirm a destructive action. */
export function confirmAction(message: string, detail?: string): Promise<boolean> {
  pendingConfirm.value?.resolve(false);
  return new Promise((resolve) => {
    pendingConfirm.value = {
      message,
      detail,
      resolve: (ok) => {
        pendingConfirm.value = null;
        resolve(ok);
      }
    };
  });
}
