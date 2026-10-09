/** SLA clock. After-hours leads are claimable overnight, but escalations start at 10am IST (PLAN §6 Q7). */
export function slaStart(sentAt: Date): Date {
  const ist = new Date(sentAt.getTime() + 5.5 * 36e5);
  const h = ist.getUTCHours();
  if (h >= 10 && h < 19) return sentAt;
  const next = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + (h >= 19 ? 1 : 0), 10, 0) - 5.5 * 36e5);
  return next;
}
export function slaLevel(sentAt: Date, now: Date, l1 = 15, l2 = 30, breach = 60): 0 | 1 | 2 | 3 {
  const mins = (now.getTime() - slaStart(sentAt).getTime()) / 60000;
  return mins >= breach ? 3 : mins >= l2 ? 2 : mins >= l1 ? 1 : 0;
}
