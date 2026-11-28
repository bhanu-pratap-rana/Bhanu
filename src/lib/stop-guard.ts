// Whether a press on the composer's Stop button should stop the answer.
//
// Send and Stop share one spot: the moment a question is sent, Send becomes
// Stop under the pointer. A double-click on Send (common from people who
// double-click everything) would otherwise send and then abort the answer it
// just asked for. So a pointer press on Stop is ignored for a short window
// after the answer starts, and a multi-click that began on Send is ignored a
// little longer. Keyboard and assistive-technology activation (a click event
// with detail 0) always stops: there is no pointer to land by accident.

/** A pointer press on Stop this soon after sending is ignored. */
export const STOP_ARM_MS = 400;

/** The second or later click of a multi-click is ignored up to this long after sending. */
export const STOP_MULTI_CLICK_MS = 800;

export function acceptStopPress({
  clickCount,
  now,
  busySince,
}: Readonly<{
  /** The click event's `detail`: 0 for keyboard or AT, 1 single, 2+ multi-click. */
  clickCount: number;
  /** When the press happened (same clock as `busySince`). */
  now: number;
  /** When the answer started, or null when unknown. */
  busySince: number | null;
}>): boolean {
  if (clickCount <= 0 || busySince === null) return true;
  const elapsed = now - busySince;
  // A clock that reads earlier than the send cannot tell; never trap Stop.
  if (!(elapsed >= 0)) return true;
  if (elapsed < STOP_ARM_MS) return false;
  if (clickCount >= 2 && elapsed < STOP_MULTI_CLICK_MS) return false;
  return true;
}
