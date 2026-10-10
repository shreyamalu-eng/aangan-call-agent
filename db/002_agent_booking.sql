-- Consultations booked by the voice agent during a call. The enquiry doesn't exist yet at that moment,
-- so the booking is saved with the caller's number / call reference and linked after the call is processed.
alter table consultations add column if not exists caller_phone text;
alter table consultations add column if not exists call_ref text;
alter table consultations add column if not exists booked_via text;
create index if not exists consultations_unlinked on consultations (created_at) where enquiry_id is null;
