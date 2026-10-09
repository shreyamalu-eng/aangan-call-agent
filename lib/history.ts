/** Repeat-caller rules. Pure functions so they are unit-tested; the DB layer feeds them rows. */
export type PriorEnquiry = { id: string; status: string; created_at: string | Date; last_call_ended_at: string | Date | null; handed_off: boolean; claimed: boolean };

export const MERGE_WINDOW_MIN = 30;

/** T17: a call from the same number within 30 minutes of the last one continues that enquiry. */
export function mergeTarget(prior: PriorEnquiry[], startedAt: Date): string | null {
  for (const p of prior) {
    const end = p.last_call_ended_at ? new Date(p.last_call_ended_at) : new Date(p.created_at);
    const gapMin = (startedAt.getTime() - end.getTime()) / 60000;
    if (gapMin >= -1 && gapMin <= MERGE_WINDOW_MIN) return p.id;
  }
  return null;
}

/** T16: an earlier sales enquiry from this number that nobody followed up. */
export function previouslyDropped(prior: PriorEnquiry[], now: Date): boolean {
  return prior.some((p) => {
    const ageH = (now.getTime() - new Date(p.created_at).getTime()) / 36e5;
    if (ageH < 0.5) return false;
    if (["new", "incomplete"].includes(p.status)) return true;
    if (p.status === "qualified" && (!p.handed_off || !p.claimed) && ageH > 2) return true;
    return false;
  });
}
