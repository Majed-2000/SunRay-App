import { AccessibilityInfo } from 'react-native';
import { create } from 'zustand';

interface UiState {
  toast: string | null;
  showToast: (message: string) => void;
  clearToast: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

/** ~2 s for a short message, longer for a long one, capped at 6 s. */
export function toastDuration(message: string): number {
  return Math.min(6000, Math.max(2200, message.length * 60));
}

export const useUiStore = create<UiState>((set) => ({
  toast: null,
  showToast: (message) => {
    set({ toast: message });
    if (toastTimer) clearTimeout(toastTimer);
    // Long enough to read. A flat 1.9 s cut off the longer messages — the
    // reorder summary, the closed-store reason — mid-sentence.
    toastTimer = setTimeout(() => set({ toast: null }), toastDuration(message));
    // Screen readers: every error in the app is a toast, and none was spoken.
    AccessibilityInfo.announceForAccessibility(message);
  },
  clearToast: () => set({ toast: null }),
}));

/** Imperative helper usable outside React (e.g. inside store actions). */
export const toast = (message: string) => useUiStore.getState().showToast(message);
