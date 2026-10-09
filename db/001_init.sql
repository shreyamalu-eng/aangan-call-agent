-- Aangan call agent: core schema (Neon Postgres)
-- PII (name, phone, email) lives only in `people`. Transcripts and verdicts never store a raw phone number.


create table if not exists people (
  id            uuid primary key default gen_random_uuid(),
  full_name     text,
  phone_e164    text,
  phone_hash    text unique,
  email         text,
  created_at    timestamptz not null default now()
);

create table if not exists designers (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  email             text,
  role              text not null default 'designer' check (role in ('designer','senior','front_desk_lead','founder','front_desk')),
  telegram_user_id  bigint unique,
  hubspot_owner_id  text,
  active            boolean not null default true
);

create table if not exists active_projects (
  id           uuid primary key default gen_random_uuid(),
  person_id    uuid references people(id),
  designer_id  uuid references designers(id),
  status       text not null default 'active',
  started_at   timestamptz default now()
);

create table if not exists localities (
  name      text primary key,
  aliases   text[] not null default '{}',
  zone      text not null check (zone in ('pune','pcmc','outside')),
  status    text not null check (status in ('in','out','confirm'))
);

create table if not exists enquiries (
  id                 uuid primary key default gen_random_uuid(),
  person_id          uuid references people(id),
  channel            text not null default 'phone' check (channel in ('phone','whatsapp','web_form')),
  source             text,
  segment            text,
  locality           text,
  area_status        text,
  size_text          text,
  scope_text         text,
  timeline_text      text,
  decision_text      text,
  likes              text,
  dislikes           text,
  preferred_slots    text,
  status             text not null default 'new'
                     check (status in ('new','qualified','declined','nurture','complaint','non_enquiry','hold_designer_confirm','incomplete')),
  decline_criteria   text[] not null default '{}',
  priority           text not null default 'normal' check (priority in ('normal','previously_dropped','urgent')),
  owner_designer_id  uuid references designers(id),
  follow_up_at       date,
  merged_into        uuid references enquiries(id),
  is_test            boolean not null default false,
  archived           boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists enquiries_person_idx on enquiries(person_id, created_at desc);
create index if not exists enquiries_status_idx on enquiries(status);

create table if not exists calls (
  id               uuid primary key default gen_random_uuid(),
  enquiry_id       uuid references enquiries(id),
  vaani_call_id    text unique,
  room_name        text,
  started_at       timestamptz,
  ended_at         timestamptz,
  duration_s       numeric,
  answered_by      text not null default 'agent' check (answered_by in ('agent','front_desk','voicemail','none')),
  in_hours         boolean,
  language         text,
  end_reason       text,
  recording_url    text,
  state            text not null default 'received'
                   check (state in ('received','processed','failed')),
  error            text,
  created_at       timestamptz not null default now()
);
create index if not exists calls_started_idx on calls(started_at desc);

create table if not exists transcripts (
  call_id        uuid primary key references calls(id) on delete cascade,
  turns          jsonb not null default '[]',
  summary        text,
  entities       jsonb not null default '{}',
  dispositions   jsonb not null default '{}'
);

create table if not exists verdicts (
  id                   uuid primary key default gen_random_uuid(),
  enquiry_id           uuid references enquiries(id),
  call_id              uuid references calls(id),
  engine               text not null,
  criteria             jsonb not null,
  outcome              text not null,
  flags                text[] not null default '{}',
  note_for_designer    text,
  fit_reasons          text[] not null default '{}',
  watch_outs           text[] not null default '{}',
  price_figure_spoken  boolean not null default false,
  price_hits           jsonb not null default '[]',
  tokens_in            int,
  tokens_out           int,
  created_at           timestamptz not null default now()
);

create table if not exists handoffs (
  id               uuid primary key default gen_random_uuid(),
  enquiry_id       uuid references enquiries(id) unique,
  tg_chat_id       text,
  tg_message_id    bigint,
  sent_at          timestamptz,
  claimed_by       uuid references designers(id),
  claimed_by_name  text,
  claimed_at       timestamptz,
  passes           jsonb not null default '[]',
  escalation_level int not null default 0,
  sla_breached     boolean not null default false,
  hubspot_deal_id  text,
  hubspot_contact_id text,
  email_id         text
);

create table if not exists consultations (
  id                uuid primary key default gen_random_uuid(),
  enquiry_id        uuid references enquiries(id),
  status            text not null default 'requested' check (status in ('requested','booked','cancelled')),
  preferred_slots   text,
  booked_start      timestamptz,
  calcom_booking_uid text,
  booked_by         text,
  created_at        timestamptz not null default now()
);

create table if not exists escalations (
  id              uuid primary key default gen_random_uuid(),
  enquiry_id      uuid references enquiries(id),
  reason          text not null,
  paged_at        timestamptz default now(),
  acknowledged_at timestamptz
);

create table if not exists outcomes (
  id          uuid primary key default gen_random_uuid(),
  enquiry_id  uuid references enquiries(id),
  stage       text not null check (stage in ('consultation_booked','consultation_done','proposal','signed','lost')),
  value_inr   numeric,
  set_by      text,
  set_at      timestamptz not null default now()
);

create table if not exists cost_events (
  id          uuid primary key default gen_random_uuid(),
  call_id     uuid references calls(id),
  provider    text not null,
  units       numeric,
  unit_type   text,
  amount_inr  numeric,
  basis       text not null check (basis in ('provider_reported','usage_x_rate','invoice_allocation')),
  occurred_at timestamptz not null default now()
);

create table if not exists settings (
  key    text primary key,
  value  text not null
);

create table if not exists webhook_events (
  id           uuid primary key default gen_random_uuid(),
  source       text not null,
  external_id  text,
  event        text,
  signature_ok boolean,
  payload      jsonb,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  error        text,
  unique (source, external_id, event)
);

create table if not exists health_checks (
  id         uuid primary key default gen_random_uuid(),
  checked_at timestamptz not null default now(),
  results    jsonb not null,
  ok         boolean not null
);

insert into settings(key, value) values
  ('avg_project_value_inr', '1100000'),
  ('vaani_rate_inr_per_min', '5.5'),
  ('low_budget_lakh_per_room', '2.5'),
  ('sla_l1_minutes', '15'),
  ('sla_l2_minutes', '30'),
  ('sla_breach_minutes', '60'),
  ('business_hours', '10:00-19:00'),
  ('llm_rate_inr_per_1k_tokens', '0.03')
on conflict (key) do nothing;
