import { create } from 'zustand';

interface UiState {
  toast: string | null;
  showToast: (message: string) => void;
  clearToast: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useUiStore = create<UiState>((set) => ({
  toast: null,
  showToast: (message) => {
    set({ toast: message });
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => set({ toast: null }), 1900);
  },
  clearToast: () => set({ toast: null }),
}));

/** Imperative helper usable outside React (e.g. inside store actions). */
export const toast = (message: string) => useUiStore.getState().showToast(message);
