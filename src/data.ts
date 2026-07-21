/* =====================================================================
   data.ts — types + hard-coded demo data.
   Fully fictional (no real PHI). Swap for endpoint calls later: this is
   the single seam where the app stops being mock-backed.
   ===================================================================== */

interface Contact { first: string; last: string; rel: string; email: string; cell: string; primary?: boolean; decision?: boolean; signer?: boolean; payer?: boolean; }
interface Placement { program: string; status: string; loc: string; referred: string; admitted: string; discharged: string; notes: string; }
interface Doc { title: string; type: string; date: string; source: string; }
interface Comm { type: string; date: string; subject: string; body: string; personal: boolean; author: string; }
interface Task { title: string; due: string; status: string; assignee: string; }
interface Demo { pronouns: string; race: string; ethnicity: string; city: string; state: string; }
interface Client {
  id: string; first: string; last: string; dob: string; gender: string; status: string; grade: string;
  source: string; sourceName: string; summary: string; concerns: string[]; demo: Demo;
  contacts: Contact[]; documents: Doc[]; communications: Comm[]; placements: Placement[]; tasks: Task[];
  // Optional fields populated from live records (name + conInfo forms via the maestro).
  prefName?: string; email?: string; cell?: string; homePhone?: string; homeZip?: string; viewUrl?: string;
  // Same-origin URL of the uploaded record photo (name form, DocumentLinkField),
  // or '' when none. Drives the record's top-left photo and the edit-form thumb.
  photoUrl?: string;
  // Which Individual category this record is: 'client' | 'inquiry' | 'alumni'.
  // Set when the record is loaded into its store; drives the New-button action.
  entity?: string;
  // The full raw maestro record (every catalog field, flat). The editable form
  // sections read/write straight off this so we don't have to mirror every
  // backend field in the Client interface. null for demo-only clients.
  raw?: { [key: string]: any };
}
interface Program {
  id: string; name: string; type: string; loc: string; ages: string;
  pops: string[]; levels: string[]; concerns: string[]; bluestep: boolean; status: string; desc: string;
}

const ME = { first: 'Dana', last: 'Whitfield', agency: 'Whitfield Educational Consulting', badge: 'WEC' };

function contact(first: string, last: string, rel: string, email: string, cell: string, flags: Partial<Contact> = {}): Contact {
  return { first, last, rel, email, cell, ...flags };
}
function placement(program: string, status: string, loc: string, referred: string, admitted: string, discharged: string, notes: string): Placement {
  return { program, status, loc, referred, admitted, discharged, notes };
}
function doc(title: string, type: string, date: string, source: string): Doc { return { title, type, date, source }; }
function comm(type: string, date: string, subject: string, body: string, personal = false): Comm {
  return { type, date, subject, body, personal, author: 'Dana Whitfield' };
}
function task(title: string, due: string, status: string): Task { return { title, due, status, assignee: 'Dana Whitfield' }; }

/* status -> pill class */
const CLIENT_STATUS: Record<string, string> = {
  'Inquiry':'muted','Engaged':'primary','Assessing':'primary','Researching':'warning',
  'Placed':'success','Aftercare':'success','On Hold':'muted','Closed':'muted'
};
const PLC_STATUS: Record<string, string> = {
  'Researching':'muted','Referred':'primary','Application Sent':'warning','Admitted':'success',
  'In Program':'success','Transitioned':'muted','Declined':'muted'
};

const CLIENTS: Client[] = [
 {
  id:'c1',first:'Maya',last:'Bennett',dob:'2009-04-12',gender:'Female',status:'Placed',grade:'10',
  source:'Therapist',sourceName:'Dr. Lena Ortiz',
  summary:'15yo presenting with depression and school refusal following a family relocation. Bright, artistic, strong rapport with mother. Currently thriving at a residential placement after a difficult wilderness transition.',
  concerns:['Depression','Anxiety','School Refusal'],
  demo:{pronouns:'She/Her',race:'White',ethnicity:'Not Hispanic or Latino',city:'Boulder',state:'CO'},
  contacts:[
    contact('Rebecca','Bennett','Mother','rebecca.b@example.com','(720) 555-0142',{primary:true,decision:true,signer:true,payer:true}),
    contact('Mark','Bennett','Father','mark.b@example.com','(720) 555-0188',{}),
  ],
  documents:[
    doc('Neuropsychological Evaluation','Psych/Neuropsych Eval','2025-09-02','Dr. Lena Ortiz'),
    doc('Parent Application (completed)','Parent Application','2025-09-10','Family'),
    doc('High School Transcript','Academic Records','2025-08-22','Fairview HS'),
    doc('Wilderness Discharge Summary','Discharge Summary','2026-01-15','Cedar Ridge Wilderness'),
  ],
  communications:[
    comm('Call','2026-06-18','Weekly check-in with mom','Maya settling in well at Northstar. Mom reports first positive phone call in months.'),
    comm('Note','2026-05-30','Treatment team update','Therapist notes measurable progress on depression scales.'),
    comm('Email','2026-04-12','Intro to admissions','Sent referral packet to Northstar admissions.'),
    comm('Note','2026-03-02','Personal impression','Family dynamic is the key lever here — keep mom close.',true),
  ],
  placements:[
    placement('Cedar Ridge Wilderness','Transitioned','Wilderness / Assessment','2025-10-01','2025-10-08','2026-01-15','Stabilization + assessment phase.'),
    placement('Northstar Academy','In Program','Residential Treatment','2026-01-20','2026-02-01','','Long-term residential placement. Strong fit.'),
  ],
  tasks:[
    task('Request 30-day treatment update from Northstar','2026-07-02','Open'),
    task('Schedule parent coaching call','2026-06-28','Open'),
  ],
 },
 {
  id:'c2',first:'Ethan',last:'Caldwell',dob:'2008-11-03',gender:'Male',status:'Researching',grade:'11',
  source:'Educational Consultant',sourceName:'Referral — colleague',
  summary:'16yo with escalating defiance and early substance use. Parents divorced; coordinating between two households. Actively researching dual-diagnosis programs.',
  concerns:['Defiance','Substance Use','ADHD'],
  demo:{pronouns:'He/Him',race:'White',ethnicity:'Hispanic or Latino',city:'Denver',state:'CO'},
  contacts:[
    contact('Susan','Caldwell','Mother','susan.c@example.com','(303) 555-0119',{primary:true,decision:true,signer:true}),
    contact('Raymond','Caldwell','Father','ray.c@example.com','(303) 555-0177',{payer:true}),
  ],
  documents:[
    doc('Psychiatric Evaluation','Psych/Neuropsych Eval','2026-05-18','Dr. P. Shah'),
    doc('Parent Application (completed)','Parent Application','2026-06-01','Family'),
  ],
  communications:[
    comm('Call','2026-06-20','Program options review','Walked parents through three dual-diagnosis candidates.'),
    comm('Email','2026-06-10','Records request','Requested updated psychiatric eval from Dr. Shah.'),
  ],
  placements:[
    placement('Summit Trails Recovery','Referred','Dual-Diagnosis RTC','2026-06-22','','','Awaiting admissions decision.'),
  ],
  tasks:[
    task('Follow up with Summit Trails admissions','2026-06-27','Open'),
    task('Collect father co-sign on agreement','2026-06-29','Open'),
  ],
 },
 {
  id:'c3',first:'Olivia',last:'Park',dob:'2010-02-27',gender:'Female',status:'Engaged',grade:'9',
  source:'School',sourceName:'Westbrook Counselor',
  summary:'14yo with an eating disorder and anxiety. Newly engaged; gathering assessments before program research begins.',
  concerns:['Eating Disorder','Anxiety'],
  demo:{pronouns:'She/Her',race:'Asian',ethnicity:'Not Hispanic or Latino',city:'Fort Collins',state:'CO'},
  contacts:[
    contact('Grace','Park','Mother','grace.p@example.com','(970) 555-0150',{primary:true,decision:true,signer:true,payer:true}),
  ],
  documents:[doc('Engagement Agreement (signed)','Agreement (signed)','2026-06-15','Family')],
  communications:[comm('Call','2026-06-15','Intake call','Completed initial intake. Family motivated and ready.')],
  placements:[],
  tasks:[task('Order comprehensive psych eval','2026-07-01','Open'),task('Send parent application link','2026-06-26','Open')],
 },
 {id:'c4',first:'Liam',last:'Foster',dob:'2009-07-19',gender:'Male',status:'Inquiry',grade:'10',source:'Online Search',sourceName:'Website',summary:'New inquiry — initial parent call pending.',concerns:['Anxiety'],demo:{pronouns:'He/Him',race:'Black or African American',ethnicity:'Not Hispanic or Latino',city:'Aurora',state:'CO'},contacts:[contact('Denise','Foster','Mother','denise.f@example.com','(303) 555-0211',{primary:true})],documents:[],communications:[comm('Email','2026-06-24','Inbound inquiry','Parent requested a consultation via website form.')],placements:[],tasks:[task('Schedule discovery call','2026-06-27','Open')]},
 {id:'c5',first:'Sophia',last:'Nguyen',dob:'2008-05-08',gender:'Female',status:'Aftercare',grade:'12',source:'Therapist',sourceName:'Dr. Kim',summary:'17yo successfully transitioned home; monitoring aftercare and college planning.',concerns:['Depression','Trauma'],demo:{pronouns:'She/Her',race:'Asian',ethnicity:'Not Hispanic or Latino',city:'Lakewood',state:'CO'},contacts:[contact('Helen','Nguyen','Mother','helen.n@example.com','(303) 555-0233',{primary:true,signer:true,payer:true})],documents:[doc('Discharge Summary','Discharge Summary','2026-04-30','Northstar Academy')],communications:[comm('Call','2026-06-12','Aftercare check-in','Stable at home, attending outpatient weekly.')],placements:[placement('Northstar Academy','Transitioned','Residential','2025-06-01','2025-06-10','2026-04-30','Completed program successfully.')],tasks:[task('Quarterly aftercare check-in','2026-09-01','Open')]},
 {id:'c6',first:'Noah',last:'Rivera',dob:'2009-12-01',gender:'Male',status:'Assessing',grade:'10',source:'Psychiatrist',sourceName:'Dr. Alvarez',summary:'15yo undergoing assessment; awaiting neuropsych results before program search.',concerns:['Aggression','ADHD'],demo:{pronouns:'He/Him',race:'White',ethnicity:'Hispanic or Latino',city:'Pueblo',state:'CO'},contacts:[contact('Maria','Rivera','Mother','maria.r@example.com','(719) 555-0144',{primary:true,decision:true,signer:true,payer:true})],documents:[doc('Parent Application (completed)','Parent Application','2026-06-08','Family')],communications:[comm('Note','2026-06-19','Assessment status','Neuropsych scheduled for early July.')],placements:[],tasks:[task('Confirm neuropsych appointment','2026-07-03','Open')]},
 {id:'c7',first:'Ava',last:'Mitchell',dob:'2010-09-14',gender:'Female',status:'Closed',grade:'9',source:'Family/Friend',sourceName:'Referral',summary:'Case closed — family chose local outpatient route.',concerns:['Anxiety'],demo:{pronouns:'She/Her',race:'White',ethnicity:'Not Hispanic or Latino',city:'Longmont',state:'CO'},contacts:[contact('Karen','Mitchell','Mother','karen.m@example.com','(720) 555-0299',{primary:true})],documents:[],communications:[comm('Note','2026-03-10','Case closed','Family opted for local outpatient care.')],placements:[],tasks:[]},
 {id:'c8',first:'Mason',last:'Brooks',dob:'2008-03-22',gender:'Male',status:'Placed',grade:'11',source:'Educational Consultant',sourceName:'Self',summary:'16yo placed at a therapeutic boarding school after a strong match on academics and clinical fit.',concerns:['Depression','School Refusal'],demo:{pronouns:'He/Him',race:'White',ethnicity:'Not Hispanic or Latino',city:'Greeley',state:'CO'},contacts:[contact('Lisa','Brooks','Mother','lisa.b@example.com','(970) 555-0312',{primary:true,signer:true,payer:true})],documents:[doc('Parent Application (completed)','Parent Application','2026-02-12','Family'),doc('Transcript','Academic Records','2026-02-01','Central HS')],communications:[comm('Call','2026-06-05','Monthly update','Mason doing well academically; clinical team pleased.')],placements:[placement('Birchwood Academy','In Program','Therapeutic Boarding School','2026-03-01','2026-03-12','','Excellent academic + clinical fit.')],tasks:[task('Request quarterly academic report','2026-08-01','Open')]},
 {id:'c9',first:'Isabella',last:'Reyes',dob:'2009-01-30',gender:'Female',status:'Engaged',grade:'10',source:'Therapist',sourceName:'Dr. Owens',summary:'15yo with social anxiety and emerging self-harm. Family engaged; beginning program research.',concerns:['Anxiety','Self-Harm'],demo:{pronouns:'She/Her',race:'White',ethnicity:'Hispanic or Latino',city:'Castle Rock',state:'CO'},contacts:[contact('Diana','Reyes','Mother','diana.r@example.com','(303) 555-0356',{primary:true,decision:true,signer:true,payer:true})],documents:[doc('Clinical Assessment','Clinical Assessment','2026-06-09','Dr. Owens')],communications:[comm('Call','2026-06-21','Engagement call','Reviewed process and timeline with mom.')],placements:[],tasks:[task('Build initial program shortlist','2026-07-05','Open')]},
 {id:'c10',first:'Jackson',last:'Lee',dob:'2008-08-17',gender:'Male',status:'Researching',grade:'12',source:'School',sourceName:'College Counselor',summary:'17yo with anxiety and motivation challenges; researching gap-year and transitional options.',concerns:['Anxiety','Motivation'],demo:{pronouns:'He/Him',race:'Asian',ethnicity:'Not Hispanic or Latino',city:'Centennial',state:'CO'},contacts:[contact('Grace','Lee','Mother','grace.lee@example.com','(720) 555-0401',{primary:true,signer:true}),contact('David','Lee','Father','david.lee@example.com','(720) 555-0402',{decision:true,payer:true})],documents:[doc('Parent Application (in progress)','Parent Application','2026-06-20','Family')],communications:[comm('Email','2026-06-22','Gap-year options','Shared two transitional living candidates.')],placements:[placement('Ironwood Transitions','Researching','Transitional Living','','','','Exploring fit for young-adult transition.')],tasks:[task('Send transitional living comparison','2026-07-01','Open')]},
];

const PROGRAMS: Program[] = [
 {id:'p1',name:'Northstar Academy',type:'Residential Treatment',loc:'Provo, UT',ages:'13–18',pops:['Female','Adolescent'],levels:['Residential'],concerns:['Depression','Anxiety','Trauma'],bluestep:true,status:'Claimed',desc:'Long-term residential treatment for adolescent girls with a strong academic program and family-systems clinical model.'},
 {id:'p2',name:'Cedar Ridge Wilderness',type:'Wilderness',loc:'Loa, UT',ages:'13–17',pops:['All genders','Adolescent'],levels:['Wilderness','Assessment'],concerns:['Defiance','Substance Use','Depression'],bluestep:true,status:'Claimed',desc:'Wilderness therapy and assessment program emphasizing stabilization and a clear clinical hand-off.'},
 {id:'p3',name:'Summit Trails Recovery',type:'Dual-Diagnosis RTC',loc:'Boise, ID',ages:'14–18',pops:['Male','Adolescent'],levels:['Residential','Detox'],concerns:['Substance Use','ADHD','Defiance'],bluestep:false,status:'Seeded',desc:'Dual-diagnosis residential program treating co-occurring substance use and mental health.'},
 {id:'p4',name:'Birchwood Academy',type:'Therapeutic Boarding School',loc:'Asheville, NC',ages:'14–18',pops:['All genders','Adolescent'],levels:['Boarding School'],concerns:['Depression','School Refusal','Anxiety'],bluestep:true,status:'Claimed',desc:'Accredited therapeutic boarding school blending college-prep academics with clinical support.'},
 {id:'p5',name:'Willow Creek RTC',type:'Residential Treatment',loc:'Bend, OR',ages:'12–17',pops:['Female','Adolescent'],levels:['Residential'],concerns:['Eating Disorder','Anxiety','Trauma'],bluestep:false,status:'Seeded',desc:'Specialized residential care for eating disorders and complex trauma in adolescent girls.'},
 {id:'p6',name:'Ironwood Transitions',type:'Transitional Living',loc:'St. George, UT',ages:'17–22',pops:['Male','Young adult'],levels:['Transitional Living'],concerns:['Substance Use','Depression'],bluestep:false,status:'Consultant-edited',desc:'Young-adult transitional living focused on independence, accountability, and aftercare.'},
];
