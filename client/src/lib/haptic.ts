/**
 * Shared haptic feedback utility for consistent vibration patterns across the app.
 * Uses the Vibration API (navigator.vibrate) which is supported on most Android browsers.
 * On unsupported devices (e.g. iOS Safari), calls are silently ignored.
 */

const canVibrate = () => typeof navigator !== "undefined" && "vibrate" in navigator;

const haptic = {
  /** Light tap – button press, toggle, minor action (15ms) */
  tap: () => canVibrate() && navigator.vibrate(15),

  /** Double tap – copy, share, secondary action ([15, 10, 15]ms) */
  doubleTap: () => canVibrate() && navigator.vibrate([15, 10, 15]),

  /** Success pulse – form submit, save, add to cart ([30, 30, 60]ms) */
  success: () => canVibrate() && navigator.vibrate([30, 30, 60]),

  /** Celebration – welcome bonus, big win, purchase complete ([30, 50, 80, 50, 30]ms) */
  celebration: () => canVibrate() && navigator.vibrate([30, 50, 80, 50, 30]),

  /** Grand celebration – jackpot, major milestone ([50, 30, 50, 30, 80, 40, 80, 40, 120, 50, 200, 60, 300]ms) */
  grandCelebration: () => canVibrate() && navigator.vibrate([50, 30, 50, 30, 80, 40, 80, 40, 120, 50, 200, 60, 300]),

  /** Spin start – roulette begins ([30, 20, 50, 20, 80]ms) */
  spinStart: () => canVibrate() && navigator.vibrate([30, 20, 50, 20, 80]),

  /** Spin tick – rhythmic pulse during spin (8ms) */
  tick: () => canVibrate() && navigator.vibrate(8),

  /** Spin result – normal result reveal ([60, 40, 80, 40, 120, 50, 200]ms) */
  result: () => canVibrate() && navigator.vibrate([60, 40, 80, 40, 120, 50, 200]),

  /** Warning – error, cancel confirmation ([80, 50, 80]ms) */
  warning: () => canVibrate() && navigator.vibrate([80, 50, 80]),

  /** Dismiss – close, x button (10ms) */
  dismiss: () => canVibrate() && navigator.vibrate(10),

  /** Stop any ongoing vibration */
  stop: () => canVibrate() && navigator.vibrate(0),
};

export default haptic;
