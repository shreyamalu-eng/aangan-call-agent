import { q, one, setting } from "./db";

export type Filters = { outcome?: string; from?: string; to?: string; area?: string; tests?: string };

const where = (f: Filters, params: unknown[]) => {
  const w = ["(e.archived is not true)"];
  if (f.tests !== "1") w.push("(e.is_test is not true)");
  if (f.outcome) { params.push(f.outcome); w.push(`e.status = $${params.length}`); }
  if (f.area) { params.push(`%${f.area}%`); w.push(`e.locality ilike $${params.length}`); }
  if (f.from) { params.push(f.from); w.push(`c.started_at >= $${params.length}::date`); }
  if (f.to) { params.push(f.to); w.push(`c.started_at < ($${params.length}::date + 1)`); }
  return w.join(" and ");
};

/** Headline counts. Also run for the previous period to show change pills. */
export async function kpiCounts(f: Filters) {
  const params: unknown[] = [];
  const w = where(f, params);
  const [k] = await q<any>(`
    select count(c.id)::int as calls,
      count(*) filter (where c.answered_by = 'agent')::int as by_agent,
      count(*) filter (where not c.in_hours)::int as after_hours,
      count(*) filter (where e.status = 'qualified')::int as qualified,
      count(*) filter (where e.status = 'declined')::int as declined,
      count(*) filter (where e.status = 'nurture')::int as nurture,
      count(*) filter (where e.status = 'complaint')::int as complaints,
      count(*) filter (where e.status = 'hold_designer_confirm')::int as hold,
      count(*) filter (where e.status in ('non_enquiry','incomplete'))::int as other,
      count(*) filter (where c.state = 'failed')::int as failed,
      percentile_cont(0.5) within group (order by extract(epoch from (h.sent_at - c.ended_at))) filter (where h.sent_at is not null) as median_to_telegram_s,
      percentile_cont(0.5) within group (order by extract(epoch from (h.claimed_at - h.sent_at))) filter (where h.claimed_at is not null) as median_to_claim_s,
      count(distinct h.id) filter (where h.claimed_at is not null)::int as claimed,
      count(distinct h.id) filter (where h.sent_at is not null)::int as sent,
      count(distinct h.id) filter (where h.claimed_at is not null and h.claimed_at - h.sent_at <= interval '60 minutes')::int as claimed_60,
      count(distinct co.enquiry_id)::int as booked,
      count(*) filter (where v.price_figure_spoken)::int as price_slips
    from calls c
    join enquiries e on e.id = c.enquiry_id
    left join handoffs h on h.enquiry_id = e.id
    left join lateral (select price_figure_spoken from verdicts where call_id = c.id order by created_at desc limit 1) v on true
    left join (select distinct enquiry_id from consultations where status = 'booked') co on co.enquiry_id = e.id
    where ${w}`, params);
  return k;
}

export async function overview(f: Filters) {
  const params: unknown[] = [];
  const w = where(f, params);
  const k = await kpiCounts(f);
  const byHour = await q<{ hour: number; n: number; after: number }>(`
    select extract(hour from c.started_at at time zone 'Asia/Kolkata')::int as hour, count(*)::int as n,
           count(*) filter (where not c.in_hours)::int as after
    from calls c join enquiries e on e.id = c.enquiry_id where ${w} group by 1 order by 1`, params);
  const bySource = await q<{ k: string; n: number }>(`select coalesce(split_part(e.source,' ',1),'unknown') as k, count(*)::int as n from calls c join enquiries e on e.id = c.enquiry_id where ${w} and e.status = 'qualified' group by 1 order by 2 desc`, params);
  const byArea = await q<{ k: string; n: number }>(`select coalesce(e.locality,'unknown') as k, count(*)::int as n from calls c join enquiries e on e.id = c.enquiry_id where ${w} group by 1 order by 2 desc limit 8`, params);
  const declinedBy = await q<{ k: string; n: number }>(`select unnest(e.decline_criteria) as k, count(*)::int as n from calls c join enquiries e on e.id = c.enquiry_id where ${w} and e.status = 'declined' group by 1 order by 2 desc`, params);
  const [cost] = await q<any>(`select coalesce(sum(ce.amount_inr),0)::float as total, count(distinct ce.call_id)::int as calls
    from cost_events ce join calls c on c.id = ce.call_id join enquiries e on e.id = c.enquiry_id where ${w}`, params);
  const [signed] = await q<any>(`select count(distinct o.enquiry_id)::int as n, coalesce(sum(o.value_inr),0)::float as value from outcomes o join enquiries e on e.id = o.enquiry_id join calls c on c.enquiry_id = e.id where o.stage='signed' and ${w}`, params);
  const avg = Number(await setting("avg_project_value_inr", "1100000"));
  return { k, byHour, bySource, byArea, declinedBy, cost, signed, avg };
}

export async function attention() {
  return q<any>(`
    select e.id, e.status, e.locality, e.priority, h.sent_at, h.claimed_at, h.escalation_level, v.flags, c.started_at
    from enquiries e
    left join handoffs h on h.enquiry_id = e.id
    left join lateral (select flags from verdicts where enquiry_id = e.id order by created_at desc limit 1) v on true
    left join lateral (select started_at from calls where enquiry_id = e.id order by started_at desc limit 1) c on true
    where e.archived is not true and (
      (h.sent_at is not null and h.claimed_at is null and h.escalation_level >= 1)
      or e.status in ('complaint','hold_designer_confirm')
      or e.priority = 'previously_dropped'
      or 'price_figure_spoken' = any(v.flags) or 'frustrated' = any(v.flags) or 'wants_human' = any(v.flags)
    )
    order by (e.status = 'complaint') desc, c.started_at desc nulls last limit 20`);
}

export async function callList(f: Filters) {
  const params: unknown[] = [];
  const w = where(f, params);
  return q<any>(`
    select e.id, e.status, e.locality, e.segment, e.size_text, e.priority, e.is_test, e.follow_up_at, e.decline_criteria,
           c.id as call_id, c.started_at, c.duration_s, c.in_hours, c.state, c.error,
           h.claimed_by_name, h.claimed_at, h.sent_at, h.hubspot_deal_id, p.full_name, p.phone_e164,
           (select count(*) from calls x where x.enquiry_id = e.id)::int as call_count
    from calls c join enquiries e on e.id = c.enquiry_id
    left join handoffs h on h.enquiry_id = e.id
    left join people p on p.id = e.person_id
    where ${w} and c.id = (select id from calls x where x.enquiry_id = e.id order by started_at desc limit 1)
    order by c.started_at desc nulls last limit 200`, params);
}

export async function enquiryDetail(id: string) {
  const e = await one<any>(`select e.*, p.full_name, p.phone_e164, p.email, h.claimed_by_name, h.claimed_at, h.sent_at, h.passes, h.hubspot_deal_id, h.escalation_level
    from enquiries e left join people p on p.id = e.person_id left join handoffs h on h.enquiry_id = e.id where e.id = $1`, [id]);
  if (!e) return null;
  const calls = await q<any>(`select c.*, t.turns, t.summary, t.entities, t.dispositions from calls c left join transcripts t on t.call_id = c.id where c.enquiry_id = $1 order by c.started_at`, [id]);
  const verdict = await one<any>("select * from verdicts where enquiry_id = $1 order by created_at desc limit 1", [id]);
  const outcomes = await q<any>("select * from outcomes where enquiry_id = $1 order by set_at", [id]);
  const consults = await q<any>("select * from consultations where enquiry_id = $1 order by created_at", [id]);
  const cost = await one<any>("select coalesce(sum(amount_inr),0)::float as inr from cost_events ce join calls c on c.id = ce.call_id where c.enquiry_id = $1", [id]);
  return { e, calls, verdict, outcomes, consults, cost };
}

/** Qualified enquiries per IST day, for the pipeline chart. */
export async function qualifiedByDay(f: Filters) {
  const params: unknown[] = [];
  const w = where(f, params);
  return q<{ day: string; n: number }>(`
    select to_char((c.started_at at time zone 'Asia/Kolkata')::date, 'YYYY-MM-DD') as day, count(distinct e.id)::int as n
    from calls c join enquiries e on e.id = c.enquiry_id
    where ${w} and e.status = 'qualified' group by 1 order by 1`, params);
}

export async function firstCallDay() {
  const r = await one<{ d: string | null }>(`select to_char(min(started_at at time zone 'Asia/Kolkata')::date, 'YYYY-MM-DD') as d from calls`);
  return r?.d ?? null;
}

/** Qualified leads with their latest stage, for the Pipeline table. */
export async function qualifiedLeads(f: Filters) {
  const params: unknown[] = [];
  const w = where({ ...f, outcome: "qualified" }, params);
  return q<any>(`
    select e.id, e.locality, e.segment, e.size_text, e.is_test, c.started_at, h.claimed_by_name, h.sent_at, h.hubspot_deal_id,
           p.full_name, p.phone_e164,
           (select stage from outcomes o where o.enquiry_id = e.id order by set_at desc limit 1) as stage,
           (select booked_start from consultations co where co.enquiry_id = e.id and co.status = 'booked' order by created_at desc limit 1) as consult_at
    from calls c join enquiries e on e.id = c.enquiry_id
    left join handoffs h on h.enquiry_id = e.id
    left join people p on p.id = e.person_id
    where ${w} and c.id = (select id from calls x where x.enquiry_id = e.id order by started_at desc limit 1)
    order by c.started_at desc nulls last limit 200`, params);
}
