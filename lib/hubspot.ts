/**
 * HubSpot CRM v3 (service key / private-app token). Scopes needed:
 * crm.objects.contacts.read/write, crm.objects.deals.read/write, crm.objects.owners.read,
 * crm.schemas.contacts.read, crm.schemas.deals.read.
 * Only a summary and a dashboard link go to HubSpot; transcripts stay in Neon.
 */
import { fetchJson } from "./http";

const BASE = "https://api.hubapi.com";
const h = () => {
  const t = process.env.HUBSPOT_TOKEN;
  if (!t) throw new Error("HUBSPOT_TOKEN is not set");
  return { Authorization: `Bearer ${t}`, "Content-Type": "application/json" };
};

/** Stage keys -> HubSpot stage IDs. Defaults to HubSpot's built-in "Sales Pipeline" until the custom one exists. */
export function stageId(stage: "qualified" | "claimed" | "consultation_booked" | "consultation_done" | "proposal" | "won" | "lost") {
  const custom = process.env[`HUBSPOT_STAGE_${stage.toUpperCase()}`];
  if (custom) return custom;
  const defaults = { qualified: "appointmentscheduled", claimed: "qualifiedtobuy", consultation_booked: "presentationscheduled", consultation_done: "decisionmakerboughtin", proposal: "contractsent", won: "closedwon", lost: "closedlost" } as const;
  return defaults[stage];
}
const pipelineId = () => process.env.HUBSPOT_PIPELINE_ID || "default";

export async function upsertContact(p: { firstname: string | null; phone: string | null; email: string | null; locality: string | null; source: string | null }) {
  const props: Record<string, string> = {};
  if (p.firstname) props.firstname = p.firstname;
  if (p.phone) props.phone = p.phone;
  if (p.email) props.email = p.email;
  if (p.locality) props.city = `${p.locality}, Pune`;
  props.lifecyclestage = "salesqualifiedlead";
  const filters = p.email ? [{ propertyName: "email", operator: "EQ", value: p.email }] : p.phone ? [{ propertyName: "phone", operator: "EQ", value: p.phone }] : [];
  if (filters.length) {
    const found = await fetchJson<any>(`${BASE}/crm/v3/objects/contacts/search`, { method: "POST", headers: h(), body: JSON.stringify({ filterGroups: [{ filters }], limit: 1 }) });
    const id = found?.results?.[0]?.id;
    if (id) {
      await fetchJson(`${BASE}/crm/v3/objects/contacts/${id}`, { method: "PATCH", headers: h(), body: JSON.stringify({ properties: props }) });
      return id as string;
    }
  }
  const created = await fetchJson<any>(`${BASE}/crm/v3/objects/contacts`, { method: "POST", headers: h(), body: JSON.stringify({ properties: props }) });
  return created.id as string;
}

export async function createDeal(p: { name: string; amountInr: number; contactId: string; description: string; ownerId?: string | null; priority?: string }) {
  const properties: Record<string, string> = {
    dealname: p.name,
    pipeline: pipelineId(),
    dealstage: stageId("qualified"),
    amount: String(p.amountInr),
    deal_currency_code: "INR",
    description: p.description.slice(0, 5000),
    hs_priority: p.priority === "previously_dropped" ? "high" : "medium",
  };
  if (p.ownerId) properties.hubspot_owner_id = p.ownerId;
  const body = { properties, associations: [{ to: { id: p.contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }] }] };
  try {
    const r = await fetchJson<any>(`${BASE}/crm/v3/objects/deals`, { method: "POST", headers: h(), body: JSON.stringify(body) });
    return r.id as string;
  } catch (e) {
    // Portals without INR or hs_priority reject unknown values; retry with the core fields only.
    delete properties.deal_currency_code; delete properties.hs_priority;
    const r = await fetchJson<any>(`${BASE}/crm/v3/objects/deals`, { method: "POST", headers: h(), body: JSON.stringify({ ...body, properties }) });
    return r.id as string;
  }
}

export async function moveDeal(dealId: string, stage: Parameters<typeof stageId>[0], extra: Record<string, string> = {}) {
  return fetchJson(`${BASE}/crm/v3/objects/deals/${dealId}`, { method: "PATCH", headers: h(), body: JSON.stringify({ properties: { dealstage: stageId(stage), ...extra } }) });
}

export async function ownerIdForEmail(email: string | null | undefined) {
  if (!email) return null;
  try {
    const r = await fetchJson<any>(`${BASE}/crm/v3/owners?email=${encodeURIComponent(email)}&limit=1`, { headers: h() });
    return (r?.results?.[0]?.id as string) ?? null;
  } catch { return null; }
}

export async function ping() {
  await fetchJson(`${BASE}/crm/v3/objects/deals?limit=1`, { headers: h() });
  return true;
}
