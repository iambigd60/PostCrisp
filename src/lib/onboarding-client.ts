import type { OnboardingEventName } from './onboarding-event-names'

/**
 * The single client-side path into onboarding telemetry.
 *
 * Two properties matter, and the three hand-rolled copies this replaces had
 * neither:
 *
 * 1. `name` is typed against the union, so a typo is a compile error rather
 *    than a 400 the client throws away. The server validates the same union —
 *    a drift between the two silently drops events.
 * 2. A rejected request says so. The old copies ended in `.catch(() => {})`,
 *    which swallowed 400s, 401s and 5xx identically, so the only evidence of a
 *    completely dead pipeline was an empty table nobody was looking at.
 *
 * Still fire-and-forget and still incapable of throwing: nothing here may
 * block or break a stage transition. It only became loud, not blocking.
 *
 * Type-only import of the name union keeps @supabase/supabase-js out of the
 * client bundle — importing from onboarding-events.ts would pull it in.
 */
export function emitOnboardingEvent(
  name: OnboardingEventName,
  detail: Record<string, unknown> = {},
): void {
  void fetch('/api/onboarding/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, detail }),
    // handleLater and handleFinish emit and then navigate on the very next
    // line. Soft navigation usually lets an in-flight request finish, but a
    // hard navigation or a closed tab drops it — and those two paths carry the
    // session-ending events (snooze, completion) the funnel most depends on.
    // keepalive lets the browser finish the request past the teardown.
    keepalive: true,
  })
    .then((res) => {
      if (!res.ok) {
        console.warn('[onboarding] telemetry rejected', { name, status: res.status })
      }
    })
    .catch((err) => {
      console.warn('[onboarding] telemetry request failed', { name, err })
    })
}
