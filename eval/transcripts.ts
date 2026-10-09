/**
 * September 2026 phone transcripts T01–T20 (from Aangan_Sep_2026_Enquiries.pdf), with the
 * expected verdicts from the brief. Front-desk lines are labelled AGENT so the same parser and
 * price guard run on them as on a Vaani call.
 */
export type Case = { id: string; date: string; phone: string; transcript: string; expected: string; note?: string; secondCall?: { date: string; transcript: string } };

export const CASES: Case[] = [
  { id: "T01", date: "2026-09-02T10:23:00+05:30", phone: "+919800000001", expected: "qualified", transcript: `
AGENT: Good morning, Aangan Studio.
USER: Hi, I'm Priya. I got your number from a friend — Shruti Joshi. She had her flat done by you in Aundh.
AGENT: Of course — thank you for calling. What are you looking to do?
USER: We have a 3BHK in Kothrud — Dahanukar Colony. We bought it two years ago and it still looks like the builder flat. We want to redo the whole thing — kitchen, living room, both bedrooms.
AGENT: That sounds like a complete redesign. How big is the apartment?
USER: About 1,400 sq ft carpet.
AGENT: And your timeline?
USER: We'd like to be done by March. We're in no rush.
AGENT: Perfect. Are you the owner?
USER: Yes — myself and my husband. He knows we're calling and is happy to go ahead.
AGENT: Lovely. Can I take your number and schedule a consultation?
USER: Sure.` },
  { id: "T02", date: "2026-09-03T14:41:00+05:30", phone: "+919800000002", expected: "qualified", transcript: `
AGENT: Good afternoon, Aangan Studio.
USER: Hi. I was looking at your work on Instagram. I have a 2BHK in Wakad — can you tell me roughly how much something like that would cost?
AGENT: Our pricing depends on the materials and the scope — the best way to get a clear picture is a consultation with one of our designers. What are you planning to do?
USER: Full redesign — modular kitchen, wardrobes, living room, both bedrooms. About 950 sq ft.
AGENT: Good scope. What's your timeline?
USER: We move in November — so maybe starting design from October?
AGENT: That works well. Shall I set up a consultation?
USER: Yes, but can you give me a rough ballpark first? Even a range?
AGENT: I genuinely can't — it varies quite a bit based on materials. Giving you a number without seeing the site would be misleading. The designer will go through all of that with you.
USER: Okay, fair enough. Let's book it.` },
  { id: "T03", date: "2026-09-03T16:15:00+05:30", phone: "+919800000003", expected: "declined", note: "area", transcript: `
AGENT: Good afternoon, Aangan Studio.
USER: Hello, I saw your work on LinkedIn. My name is Suresh Patil. I'm in Nashik — would you be able to take on a project here? I want to redo my home office and study.
AGENT: Thank you for calling. We only work in Pune and PCMC at the moment — we don't have the vendor network to take on projects outside Pune.
USER: Not even for a smaller project?
AGENT: Even for a smaller project, our execution depends on our contractors being on-site. I'm sorry we can't help.
USER: Alright, understood. Thanks.` },
  { id: "T04", date: "2026-09-04T11:07:00+05:30", phone: "+919800000004", expected: "declined", note: "advice only", transcript: `
AGENT: Good morning, Aangan Studio.
USER: Hi — can someone come and give us some ideas for our living room? We're not planning to do the full thing right now. Just want suggestions on colours, furniture arrangement, what to change.
AGENT: We're a full-service studio — our projects include design and execution together. We don't do advisory or consultation-only visits. If you're planning a full redesign with execution, we'd be a great fit.
USER: Oh I see. No, we're just exploring for now. Maybe later.
AGENT: Of course — feel free to call back when you're ready to go ahead with a full project.` },
  { id: "T05", date: "2026-09-05T10:52:00+05:30", phone: "+919800000005", expected: "qualified", transcript: `
AGENT: Good morning, Aangan Studio.
USER: Hi, this is Aarti Mehta. Vikram Agarwal asked me to call — he's a close friend of Nikhil's.
AGENT: Of course, thank you. What are you looking for?
USER: We have a 4BHK in Koregaon Park — about 2,400 sq ft carpet. Complete redesign. New flooring, kitchen, all four bedrooms. We've already moved out temporarily.
AGENT: That's a significant project. Do you have a timeline?
USER: We want to move back in by February. About 4 months.
AGENT: That should work well. Would you prefer a site visit for the consultation?
USER: Yes please — Vikram said your team does that.
AGENT: Absolutely. Can I check your availability for early next week?` },
  { id: "T06", date: "2026-09-05T15:28:00+05:30", phone: "+919800000006", expected: "qualified", transcript: `
AGENT: Good afternoon, Aangan Studio.
USER: Hi, I'm calling about a commercial project. We're a startup — just got our first proper office space in Baner. About 800 sq ft. We need workstations for 20 people, a small cabin, a meeting room, and a break area.
AGENT: We do commercial fitouts up to about 3,000 sq ft. What's the state of the space right now?
USER: Bare shell — just columns and floor. Nothing else.
AGENT: Full fitout from scratch. And the timeline?
USER: We want to be operational by December. Our team is working from home currently.
AGENT: December is doable. Are you the decision-maker for this?
USER: Yes, I'm the founder.
AGENT: Perfect. Let's set up a consultation.` },
  { id: "T07", date: "2026-09-08T09:44:00+05:30", phone: "+919800000007", expected: "nurture", note: "timeline, retry November", transcript: `
AGENT: Good morning, Aangan Studio.
USER: Hello — I want to redo my living room and kitchen before Diwali. Can you take it up?
AGENT: Diwali is about three weeks away. Our design phase alone takes 3–4 weeks, and execution follows. We couldn't do justice to a project in that time.
USER: Even just the living room?
AGENT: Even so — a room redesign with execution takes at least 8–10 weeks from start to finish. We wouldn't want to rush it.
USER: What if I start after Diwali?
AGENT: A November start would work well. Shall I note your details for that?
USER: Let me think and call back.` },
  { id: "T08", date: "2026-09-09T22:47:00+05:30", phone: "+919800000008", expected: "missed", note: "missed call — no transcript; now answered by the agent", transcript: "" },
  { id: "T09", date: "2026-09-10T11:32:00+05:30", phone: "+919800000009", expected: "complaint", transcript: `
AGENT: Good morning, Aangan Studio.
USER: I need to speak to someone right now. My project has been going for three months and my designer hasn't replied in five days. This is not acceptable.
AGENT: I'm very sorry. Can I take your name and project details?
USER: Sheetal Deshpande. My designer is Aryan. Flat in Viman Nagar — 2BHK. I've sent three messages and called twice.
AGENT: Sheetal, I'm getting this to our project team right now. Would you prefer to hold for two minutes, or should I have someone senior call you back within 15 minutes?
USER: Callback. And I want it from Nikhil or a senior person — not just whoever picks up.
AGENT: Noted. I'll make sure of that.` },
  { id: "T10", date: "2026-09-11T14:04:00+05:30", phone: "+919800000010", expected: "declined", note: "volunteered budget", transcript: `
AGENT: Good afternoon, Aangan Studio.
USER: Hi. I have a 1BHK in Kharadi — about 550 sq ft. I want to do the kitchen and one bedroom. My budget is 1 to 1.5 lakh maximum for everything. Is that possible with you?
AGENT: I appreciate you sharing that. For a kitchen redesign and a bedroom with full execution — materials, furniture, and contractor work — 1 to 1.5 lakh would be significantly below what a project of that scope would cost with us.
USER: Even for one bedroom?
AGENT: Even for one room. I wouldn't want to bring you to a consultation if the numbers don't align. I'd suggest checking with local contractors who work at that price point.
USER: Okay, thank you for being straight.` },
  { id: "T11", date: "2026-09-12T10:18:00+05:30", phone: "+919800000011", expected: "qualified", transcript: `
AGENT: Good morning, Aangan Studio.
USER: Hi — I have a question. I'm in a rented apartment. Can you still take up a project?
AGENT: It depends on the scope. What are you looking to do?
USER: It's a 2BHK in Baner. I've been here a year, I have a 3-year lease, and the place is quite bare. I want to properly design the living room, bedroom, and kitchen — no structural changes, just design and fittings.
AGENT: That's fine — we've done rented apartments before. For the kitchen we'd do a modular unit that can come out cleanly. The rest is largely flooring, lighting, and furniture — all reversible. Have you checked with your landlord?
USER: Yes — they're fine with it as long as we don't break walls.
AGENT: Perfect. No wall-breaking from us. Shall we set up a consultation?
USER: Yes please.` },
  { id: "T12", date: "2026-09-15T10:05:00+05:30", phone: "+919800000012", expected: "qualified", transcript: `
AGENT: Good morning, Aangan Studio.
USER: I'm calling about a villa project in Kalyani Nagar. My name is Anand Sharma. The property is about 5,500 sq ft — ground plus two floors. Full end-to-end design.
AGENT: That's a significant project. Is this a new property or an existing home?
USER: New construction. Possession was last month. Completely empty.
AGENT: And your timeline?
USER: March next year to move in. No rush.
AGENT: Good time to start. Would you like our principal designer to come to site for the first consultation?
USER: Yes — this week or next if possible.
AGENT: Let me check the calendar and revert by end of day.` },
  { id: "T13", date: "2026-09-16T12:19:00+05:30", phone: "+919800000013", expected: "qualified", transcript: `
AGENT: Good afternoon, Aangan Studio.
USER: Hi — I want to redo my flat in Aundh. 3BHK, about 1,100 sq ft. What might it cost?
AGENT: Our pricing depends on the materials and scope — the designers go through that at the consultation. What are you planning?
USER: Kitchen, wardrobes in both bedrooms, living room. But seriously — can't you give me even a rough range? I just want to know if we're in the same ballpark.
AGENT: I really can't give a number that would mean anything without seeing the site and the spec. The difference between a standard and a premium kitchen alone can be 3× the cost. The designer will give you a proper number by the end of it.
USER: Fine. Let's book then.
AGENT: Perfect. What days work for you?` },
  { id: "T14", date: "2026-09-17T11:41:00+05:30", phone: "+919800000014", expected: "qualified", note: "parents decide", transcript: `
AGENT: Good morning, Aangan Studio.
USER: Hi — I wanted to inquire about an interior project for my parents. They have a 3BHK in Hadapsar — new possession. They want a proper design.
AGENT: That sounds good. Will your parents be involved in the decision?
USER: Yes — I'm doing the initial checking. They don't really use phones much. I'll tell them about the consultation and they'll decide.
AGENT: Sure — just so we know: your parents would be at the consultation, right? Our designers like to understand the brief directly from the people who'll live in the space.
USER: Yes, they would come. I'm just calling to see if it's worth pursuing.
AGENT: Absolutely. Should I note your details and explain what the consultation involves?
USER: Please.` },
  { id: "T15", date: "2026-09-18T15:12:00+05:30", phone: "+919800000015", expected: "qualified", transcript: `
AGENT: Good afternoon, Aangan Studio.
USER: Hi, I'm Smita. I'm getting possession of my flat in Undri in about six weeks. 2BHK, 875 sq ft. I want to start the design right away.
AGENT: Six weeks is just enough lead time to get the design finalised before execution begins. What are you planning?
USER: Full home — kitchen, wardrobes, living room. The full package.
AGENT: Good scope. Are you the owner?
USER: Yes — my husband and I. He said to go ahead and book the consultation.
AGENT: Can we see the site in its current state, or do you need to wait for possession?
USER: We can go now — the builder will let us in.
AGENT: Even better. Let me get a designer's availability.` },
  { id: "T16", date: "2026-09-19T10:38:00+05:30", phone: "+919800000016", expected: "qualified", note: "priority: previously dropped", transcript: `
AGENT: Good afternoon, Aangan Studio.
USER: Hi — I'd called on Monday about a project. Someone said they'd get back to me. It's been two days.
AGENT: I'm very sorry. Can I get your name?
USER: Girish Nair. I called Monday afternoon. I told someone about my 3BHK in Viman Nagar and gave my number.
AGENT: I apologise — I don't see a note. Can you give me your details again? I'll book the consultation directly now so it doesn't slip again.
USER: This is not a good sign if you forget before you even start.
AGENT: You're absolutely right, and I'm sorry. Let me make this right now.` },
  { id: "T17", date: "2026-09-22T14:14:00+05:30", phone: "+919800000017", expected: "qualified", note: "merged (two calls)", transcript: `
AGENT: Good afternoon, Aangan Studio.
USER: Hi, I wanted to inquire about —`,
    secondCall: { date: "2026-09-22T14:16:00+05:30", transcript: `
AGENT: Good afternoon, Aangan Studio.
USER: Hi — I called just now and got cut off. I'm Ritu Kapoor from Pimple Saudagar. 3BHK, about 1,050 sq ft. We've been here two years but never properly did the interiors. We want to start now.
AGENT: Thanks for calling back. Pimple Saudagar is in our service area. What are you looking to do?
USER: Kitchen, wardrobes, living room. We moved in with builder furniture and it's very basic.
AGENT: Standard full-home scope. Timeline?
USER: Ideally done by March. Plenty of time.
AGENT: Perfect. Let me book a consultation.` } },
  { id: "T18", date: "2026-09-23T11:55:00+05:30", phone: "+919800000018", expected: "hold_designer_confirm", note: "designer to confirm, pending Nikhil", transcript: `
AGENT: Good morning, Aangan Studio.
USER: Hi — I run a small coworking space. I have a 180 sq ft pod I want to make look really nice. Good lighting, a nice desk, some storage. Can you help?
AGENT: Our commercial projects are typically 500 sq ft or more. A 180 sq ft pod is below our minimum scope.
USER: Not even for a smaller fee?
AGENT: It's not about the fee — it's that our design and execution team is set up for a certain scale.
USER: Fair enough. Thanks.` },
  { id: "T19", date: "2026-09-24T16:02:00+05:30", phone: "+919800000019", expected: "declined", note: "restaurant", transcript: `
AGENT: Good afternoon, Aangan Studio.
USER: Hi — I'm planning to open a restaurant in Koregaon Park. I've seen your work and I love it. Would you be able to design the interiors?
AGENT: We appreciate you reaching out. Restaurant and hospitality interiors are outside our current scope — we focus on residential and office spaces.
USER: Do you know anyone you could refer?
AGENT: I don't have a specific referral I could make confidently, but searching for hospitality interior designers in Pune would give you more relevant options.
USER: Alright, thanks.` },
  { id: "T20", date: "2026-09-25T09:15:00+05:30", phone: "+919800000020", expected: "qualified", transcript: `
AGENT: Good morning, Aangan Studio.
USER: Good morning. I'm Pooja. I have a 2BHK in Magarpatta — Cybercity area. We've been wanting to properly design the interiors for a while. Kitchen, both bedrooms, living room. About 900 sq ft.
AGENT: Good scope for us. How soon are you looking to start?
USER: We're flexible — a January start for execution would be ideal.
AGENT: That works well. Are you the owner?
USER: Yes — my husband and I. We both want to be at the consultation.
AGENT: Excellent. Can I book that now?
USER: Please.` },
];
