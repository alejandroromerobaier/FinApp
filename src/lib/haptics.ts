/**
 * Haptic feedback utility using the Navigator Vibration API.
 * Safely ignores desktop or unsupported devices without throwing errors.
 */
export const haptic = {
  /** Light pulse for toggles, tab switches, category selections (12ms) */
  light: () => {
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(12);
      }
    } catch {
      // Ignore unsupported browser errors
    }
  },

  /** Selection pulse for month and project selectors (12ms) */
  selection: () => {
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(12);
      }
    } catch {
      // Ignore unsupported browser errors
    }
  },

  /** Medium pulse for button clicks, actions, shortcuts (25ms) */
  medium: () => {
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(25);
      }
    } catch {}
  },

  /** Success rhythm for saving, creating, completing transactions */
  success: () => {
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([15, 60, 25]);
      }
    } catch {}
  },

  /** Warning/error pulse for validation alerts (dual short pulses) */
  error: () => {
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([30, 50, 30]);
      }
    } catch {}
  }
};
