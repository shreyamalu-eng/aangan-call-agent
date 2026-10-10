/**
 * September 2026 WhatsApp threads (W01–W10) and web-form submissions (F01–F10)
 * from Aangan_Sep_2026_Enquiries.pdf, in the same shape as the phone cases.
 * Customer lines are USER, front-desk lines are AGENT, so the same parser,
 * verdict and price check run on every channel.
 * `expected` is the rubric reading (qualified.md); treat mismatches as findings to report, not to hide.
 */
export type InboundCase = {
  id: string;
  channel: "whatsapp" | "web_form";
  date: string;
  phone: string | null;
  name: string | null;
  transcript: string;
  expected: string;
  note?: string;
};

export const INBOUND: InboundCase[] = [
  // ---------------- WhatsApp ----------------
  { id: "W01", channel: "whatsapp", date: "2026-09-03T19:14:00+05:30", phone: "+919800001001", name: "Kiran Mazumdar", expected: "qualified", note: "after-hours message, no reply for 16 hours", transcript: `
USER: Hi, I got your number from Sonali Patel — you did her flat last year in Viman Nagar. We have a 4BHK in Viman Nagar and want to do the full interiors. Who should I speak to?
USER: Hi — following up on my message from yesterday?
AGENT: Hi Kiran, sorry for the delay — our WhatsApp is monitored from 10am. Thanks for reaching out, and for the referral from Sonali. What size is the flat, and when are you looking to start?
USER: About 1,800 sq ft carpet. We have possession already — flat is empty. Want to start as soon as possible. Design in October, execution starting November?
AGENT: That timeline works. Should I book a consultation — we can do a site visit to your flat.
USER: Yes please. Weekdays after 6pm or weekends only for us.` },
  { id: "W02", channel: "whatsapp", date: "2026-09-08T14:31:00+05:30", phone: "+919800001002", name: null, expected: "incomplete", note: "price-only question, never answered for 2 days", transcript: `
USER: hi, how much do you charge per sq ft for a 2bhk?
AGENT: Hi, sorry for the delay in responding. Our pricing depends on materials and scope — our designers go through all of this at a free consultation. Can you tell us about your project?` },
  { id: "W03", channel: "whatsapp", date: "2026-09-12T10:45:00+05:30", phone: "+919800001003", name: "Sunil Yadav", expected: "qualified", note: "Hindi", transcript: `
USER: Namaste. Mera flat hai Pimple Nilakh mein. 3BHK. Interior design karwana hai poora ghar. Budget bhi hai. Kaise contact karein?
AGENT: Namaste Sunil ji! Zaroor. Pimple Nilakh hamare service area mein hai. Aap kab available hain consultation ke liye? Humara designer aapke flat pe aa sakta hai.
USER: Koi bhi Saturday subah theek hai.
AGENT: Bilkul. Main Saturday 4 October ke liye note karti hoon — morning 10:30 AM. Confirm karo please.
USER: Confirm hai. Thanks.` },
  { id: "W04", channel: "whatsapp", date: "2026-09-15T15:18:00+05:30", phone: "+919800001004", name: "Chinmay Kulkarni", expected: "qualified", transcript: `
USER: Hello — do you take up commercial projects in Chinchwad? We have a 1,200 sq ft office space we want to fit out.
AGENT: Yes, Chinchwad is in our service area. We do office fitouts up to around 3,000 sq ft. What's the current state of the space?
USER: Bare shell. Just moved in. Need workstations for 30 people, two cabins, one meeting room.
AGENT: Good scope for us. When are you targeting to be operational?
USER: January if possible. Is that doable?
AGENT: Yes — if we start the design process in October, January is achievable. Want to book a site visit?
USER: Yes. Can you send me a calendar link?` },
  { id: "W05", channel: "whatsapp", date: "2026-09-20T18:44:00+05:30", phone: "+919800001005", name: "Meena Joshi", expected: "qualified", note: "Saturday after hours; lost after two follow-ups", transcript: `
USER: Hello — I wanted to inquire about getting my home designed. 2BHK in Baner. Please let me know if you can help and what the process is.
AGENT: Hi Meena, sorry for the delay — we're closed over the weekend. We'd love to help with your 2BHK in Baner. Can you tell me more about what you're looking to design?
AGENT: Hi Meena, just following up on my earlier message.` },
  { id: "W06", channel: "whatsapp", date: "2026-09-17T11:22:00+05:30", phone: "+919800001006", name: "Tanvi Kulkarni", expected: "qualified", transcript: `
USER: Hi — Ashok Bhosale asked me to message directly. We've just bought a 3BHK in Koregaon Park — possession next month. We want end-to-end design. Ashok said you're the best, so no need to look further.
AGENT: Hi Tanvi — Ashok's trust means a lot to us. Congratulations on the new flat! When's possession?
USER: October 15th.
AGENT: Perfect. Can we schedule a site visit for the week of October 20?
USER: Yes — 21st or 22nd works.` },
  { id: "W07", channel: "whatsapp", date: "2026-09-05T16:52:00+05:30", phone: "+919800001007", name: "Rohit Singh", expected: "declined", note: "gym — out of scope", transcript: `
USER: Hi — I'm opening a gym in Kothrud. About 2,500 sq ft. Would you design the interiors? Looking for something modern and high-energy.
AGENT: Hi Rohit — we focus on residential and office interiors. Gym and fitness spaces have specific requirements that we're not set up for. You'd need a specialist for this one. Sorry we can't help.
USER: Ok thanks.` },
  { id: "W08", channel: "whatsapp", date: "2026-09-10T08:44:00+05:30", phone: "+919800001008", name: "Pradeep Garg", expected: "qualified", note: "previously dropped — first message 4 days earlier got no reply", transcript: `
USER: Hello — I messaged 4 days ago about my flat in Aundh. No one replied. Is anyone monitoring this number?
AGENT: Hi Pradeep — I sincerely apologise. Please tell me about your project and I'll make sure we respond promptly.
USER: It was this number. 2BHK in Aundh. 850 sq ft. Full interiors. But now I'm not sure I want to work with a studio that doesn't reply for 4 days.
AGENT: I completely understand. If you're open to it, I'd like to connect you directly with our designer today — not in a few days. Would that work?
USER: Fine. Yes.` },
  { id: "W09", channel: "whatsapp", date: "2026-09-25T15:18:00+05:30", phone: "+919800001009", name: "Neha Deshpande", expected: "qualified", note: "3 photos attached", transcript: `
USER: Hi! I want to redo my living room in Aundh. Here's what it looks like. [3 photos attached]
USER: It's a 3BHK apartment. We want to start with the living room and dining area. Maybe the kitchen too.
AGENT: Hi Neha, sorry for the delay — the photos are great reference. We'd love to redesign the space. Is this a full execution project, or just design advice?
USER: Full execution — design, materials, furniture, all of it.
AGENT: Perfect, that's our scope. Location is Aundh?
USER: Yes — Sunderban area.` },
  { id: "W10", channel: "whatsapp", date: "2026-09-22T18:12:00+05:30", phone: "+919800001010", name: "Vivek Rao", expected: "nurture", note: "early-stage interest; re-engage in 4–6 weeks", transcript: `
USER: Hi — wanted to explore options for my home. Any brochure or portfolio you can share?
AGENT: Hi Vivek — you can see our portfolio on our website. What kind of project are you thinking about?
USER: 3BHK in Hinjewadi. But we're still early stage — just exploring.
AGENT: No problem. When you're ready to take it forward, feel free to call or message — happy to schedule a consultation.` },

  // ---------------- Web form ----------------
  { id: "F01", channel: "web_form", date: "2026-09-01T09:44:00+05:30", phone: "+919800002001", name: "Sumit Bhatt", expected: "qualified", transcript: `
USER: Project type: Residential — Full home. Location: Kalyani Nagar, Pune. Carpet area: ~920 sq ft (2BHK). Current state: Moved in 8 months ago with basic furniture. Want to redo the kitchen (modular), both bedrooms (wardrobes, storage, beds), living room, and add a home office corner. Timeline: Execution starting December, complete by February. Budget: Prefer not to mention — will discuss at consultation. How did you find us: Instagram. Notes: Both my wife and I will be at the consultation. We've wanted to do this for months and are now ready to commit.` },
  { id: "F02", channel: "web_form", date: "2026-09-04T19:12:00+05:30", phone: "+919800002002", name: "Laleh Contractor", expected: "qualified", transcript: `
USER: Project type: Residential — Partial (2 rooms). Location: Baner, Pune. Carpet area: 1,100 sq ft (3BHK — redesigning bedroom + living room only). Current state: Builder flat, very basic. Want to make the master bedroom and living room feel designed. Timeline: No specific deadline — whenever we can start. Budget: Not sure yet. Will discuss. How did you find us: Friend's recommendation (Priya Wadia). Notes: First time doing interiors professionally. Looking forward to understanding the process.` },
  { id: "F03", channel: "web_form", date: "2026-09-06T11:18:00+05:30", phone: "+919800002003", name: "Nilesh Dhamdhere", expected: "declined", note: "Talegaon — outside service area", transcript: `
USER: Project type: Residential — Full home. Location: Talegaon Dabhade, near Pune. Carpet area: ~1,400 sq ft (3BHK independent house). Current state: Just got possession. Need to do everything from scratch. Timeline: 3–4 months, flexible. Budget: 15–20 lakh for the full home. How did you find us: Google — "interior design Pune". Notes: I know Talegaon is a bit outside Pune — wanted to check if you can still take up the project.` },
  { id: "F04", channel: "web_form", date: "2026-09-09T14:37:00+05:30", phone: null, name: "Rajesh", expected: "incomplete", note: "price-only form, no project details", transcript: `
USER: Project type: Other. Location: Pune. Carpet area: (not filled). Current state: I want to know the cost of interior design. Timeline: as soon as possible. Budget: reasonable. How did you find us: WhatsApp forward. Notes: please call me.` },
  { id: "F05", channel: "web_form", date: "2026-09-11T10:05:00+05:30", phone: "+919800002005", name: "Sheena Menon", expected: "qualified", note: "commercial, 2,200 sq ft", transcript: `
USER: Project type: Commercial — Office. Location: Hinjewadi Phase 1, Pune. Carpet area: ~2,200 sq ft. Current state: Shell and core — just signed the lease. Planning fitout now. Timeline: Operational by January 15. Team of 60 will use the space. Budget: 60–80 lakh all-in (including furniture). How did you find us: Our CEO previously worked with you (Amey Joshi, Innov8 office in Baner). Notes: Need workstations for 55, four cabins, one boardroom, two meeting rooms, a lounge, and a pantry. Speed matters. We are ready to move fast.` },
  { id: "F06", channel: "web_form", date: "2026-09-14T20:52:00+05:30", phone: "+919800002006", name: "Preethi Nair", expected: "qualified", transcript: `
USER: Project type: Residential — Full home. Location: NIBM Road, Pune. Carpet area: ~1,950 sq ft (4BHK, ground floor). Current state: Lived here 5 years. Kitchen needs full replacement, master bedroom is okay, all other bedrooms need redoing, living room needs new flooring and design, want to add a proper study. Timeline: Planning to move out temporarily for execution — starting February 2027. Budget: 35–40 lakh for the above scope. Not flexible upward. How did you find us: Pune Mirror article (2024). Notes: We've shortlisted 3 studios. We'd like the consultation to include an honest conversation about whether your aesthetic matches ours — we love warm, earthy, minimal.` },
  { id: "F07", channel: "web_form", date: "2026-09-16T15:11:00+05:30", phone: null, name: null, expected: "incomplete", note: "anonymous price-list request", transcript: `
USER: Project type: (not selected). Location: Pune. Carpet area: (not filled). Current state: (not filled). Timeline: (not filled). Budget: (not filled). How did you find us: Instagram. Notes: I just wanted to know your per sq ft rate before deciding whether to enquire further. Can you email me the price list?` },
  { id: "F08", channel: "web_form", date: "2026-09-18T18:44:00+05:30", phone: "+919800002008", name: "Divya Hegde", expected: "declined", note: "needs it in 3 weeks — timeline", transcript: `
USER: Project type: Residential — Partial (living room + kitchen). Location: Wakad, Pune. Carpet area: ~875 sq ft (2BHK). Current state: We have guests arriving from the US in 3 weeks. We want to make the living room and kitchen look presentable before they arrive. Timeline: 3 weeks maximum. Budget: 4–5 lakh. How did you find us: Google. Notes: I know it's urgent but wanted to check if you can make it work.` },
  { id: "F09", channel: "web_form", date: "2026-09-20T11:30:00+05:30", phone: "+919800002009", name: "Amol Patil", expected: "qualified", transcript: `
USER: Project type: Residential — Full home. Location: Kondhwa, Pune. Carpet area: 1,150 sq ft (3BHK). Current state: Possession in August. Completely bare — builder handover. Timeline: Move in by March 2027. Budget: Will discuss at consultation. How did you find us: Referred by builder (Rohan Lifescapes). Notes: Ready to book a consultation at your earliest availability.` },
  { id: "F10", channel: "web_form", date: "2026-09-26T16:22:00+05:30", phone: "+919800002010", name: "Siddharth Gupta", expected: "qualified", transcript: `
USER: Project type: Residential — Full home + home office. Location: Aundh, Pune. Carpet area: ~1,300 sq ft (3BHK). Current state: Moved in 6 months ago, using builder furniture. Both my wife and I work from home full-time and need a dedicated workspace for each of us, plus a proper design for the rest of the flat. Timeline: Ready to start immediately. Design process can begin this month. Budget: 18–22 lakh for the full scope. How did you find us: LinkedIn. Notes: We're both product designers by profession, so we'll be opinionated. We want a collaborative process — not a studio that presents us with one option and calls it done.` },
];
