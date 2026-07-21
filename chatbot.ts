/* =====================================================================
   chatbot.ts — BlueIQ floating assistant.

   A launcher bubble (bottom-right) that expands into a right-docked panel,
   present on EVERY page. Context-aware: on a client record it scopes to that
   client; elsewhere it asks caseload-wide. Conversations are ephemeral
   (in-memory only — no persistence). Talks to /b/blueiq via api.ts.

   Mounted in #__biq-root on <body>, NOT inside #app — main.ts's render()
   wipes #app on every route change, so the bubble must live outside it.

   Brand is "BlueIQ"; never surface the word "AI" in UI copy.
   ===================================================================== */

interface BiqMsg {
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
}

let BIQ_OPEN = false;
let BIQ_BUSY = false;
let BIQ_FORCE_GLOBAL = false;       // user broadened to all-clients/all-programs while on a record
let BIQ_MSGS: BiqMsg[] = [];

// Look up a program's display name from whatever's already loaded (the open
// detail record, else the directory store). Empty string if not found yet.
function biqProgramName(id: string): string {
  try {
    if (typeof PROGRAM_DETAIL !== 'undefined' && PROGRAM_DETAIL[id] && PROGRAM_DETAIL[id].programName) return PROGRAM_DETAIL[id].programName;
    if (typeof PROGRAM_STORE !== 'undefined' && PROGRAM_STORE) {
      for (const p of PROGRAM_STORE) if (p.id === id) return p.programName || '';
    }
  } catch (_e) { /* not loaded yet */ }
  return '';
}

// Derive context from the hash route (read live each time; the bubble lives
// outside the render flow). `focus` = what a bare question defaults to:
//   'client'  → a client record (server-bound clientId, client tools)
//   'program' → a program record (global scope + a program focus hint)
//   'none'    → a list/dashboard (global; label reflects clients vs programs)
function biqContext(): { page: string; scope: 'client' | 'global'; clientId: string; clientName: string; programId: string; programName: string; focus: 'client' | 'program' | 'none'; programFilter: any } {
  const hash = location.hash.replace(/^#/, '') || '/dashboard';
  const parts = hash.split('/').filter(Boolean);
  const page = parts[0] || 'dashboard';
  let clientId = '', clientName = '', programId = '', programName = '';
  if (page === 'clients' && parts[1]) {
    clientId = decodeURIComponent(parts[1]);
    const c = (typeof findClient === 'function') ? findClient(clientId) : undefined;
    if (c) clientName = ((c.first || '') + ' ' + (c.last || '')).trim();
  } else if (page === 'programs' && parts[1]) {
    programId = decodeURIComponent(parts[1]);
    programName = biqProgramName(programId);
  }
  // A client record binds server-side (scope 'client'); a program record stays
  // 'global' (program tools take an id) but carries a focus hint.
  const scope: 'client' | 'global' = (clientId && !BIQ_FORCE_GLOBAL) ? 'client' : 'global';
  let focus: 'client' | 'program' | 'none' = 'none';
  if (clientId && !BIQ_FORCE_GLOBAL) focus = 'client';
  else if (programId && !BIQ_FORCE_GLOBAL) focus = 'program';
  // On the programs LIST (not a specific program), pass the consultant's active
  // filters so BlueIQ can answer about just the shortlist they're looking at.
  const programFilter = (page === 'programs' && !programId && typeof progBiqPayload === 'function') ? progBiqPayload() : null;
  return { page, scope, clientId, clientName, programId, programName, focus, programFilter };
}

// ---- minimal markdown → safe HTML (headers, bold/italic/code, links, lists) ----
function biqMd(src: string): string {
  const inline = (t: string): string => {
    let s = esc(t);
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m: string, label: string, url: string) => {
      const isHash = url.charAt(0) === '#';
      const attrs = isHash ? '' : ' target="_blank" rel="noopener"';
      return '<a href="' + url + '"' + attrs + '>' + label + '</a>';
    });
    return s;
  };
  const lines = String(src == null ? '' : src).split('\n');
  let html = '';
  let inList = false;
  const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) { closeList(); continue; }
    let m: RegExpMatchArray | null;
    if ((m = t.match(/^#{1,3}\s+(.*)/))) { closeList(); html += '<h4>' + inline(m[1]) + '</h4>'; continue; }
    if ((m = t.match(/^[-*]\s+(.*)/))) { if (!inList) { html += '<ul>'; inList = true; } html += '<li>' + inline(m[1]) + '</li>'; continue; }
    closeList();
    html += '<p>' + inline(t) + '</p>';
  }
  closeList();
  return html;
}

// ---- render ----
function biqThreadHtml(ctx: { focus: 'client' | 'program' | 'none'; page: string; clientName: string; programName: string; programFilter: any }): string {
  if (!BIQ_MSGS.length && !BIQ_BUSY) {
    let who: string;
    let examples: string[];
    if (ctx.focus === 'client') {
      who = 'Ask me anything about <b>' + esc(ctx.clientName || 'this client') + '</b> — their profile, contacts, or what their files say.';
      examples = ['Summarize this client', 'Who are the contacts?', 'What do the files say about their history?'];
    } else if (ctx.focus === 'program') {
      who = 'Ask me anything about <b>' + esc(ctx.programName || 'this program') + '</b> — its profile, my rating and notes, or the files I’ve saved.';
      examples = ['Summarize this program', 'What did I rate this and why?', 'What are my notes from the tour?'];
    } else if (ctx.page === 'programs' && ctx.programFilter && ctx.programFilter.active) {
      const n = ctx.programFilter.count;
      who = 'Ask me about the <b>' + n + ' program' + (n === 1 ? '' : 's') + '</b> matching your filters — compare, rank, or find the best fit among them.';
      examples = ['Compare these on length of stay and cost', 'Which of these best fit a 15-year-old with trauma?', 'Which take insurance?'];
    } else if (ctx.page === 'programs') {
      who = 'Ask me about the program directory — search it, or dig into the programs you’ve rated and noted.';
      examples = ['Which programs have I rated 5 stars?', 'My highly-rated programs that treat OCD', 'Find wilderness programs in Utah'];
    } else {
      who = 'Ask me about your caseload — find clients, compare them, or dig into any client’s files.';
      examples = ['How many clients do I have?', 'Which clients have no contacts yet?', 'Find clients named Jordan'];
    }
    return '<div class="biq-empty">' + ic('sparkle', 26) + '<p>' + who + '</p>'
      + '<div class="biq-examples">' + examples.map(e => '<button class="biq-eg" onclick="biqAsk(this)">' + esc(e) + '</button>').join('') + '</div></div>';
  }
  let html = '';
  for (let i = 0; i < BIQ_MSGS.length; i++) {
    const m = BIQ_MSGS[i];
    if (m.role === 'user') {
      html += '<div class="biq-msg biq-user"><div class="biq-bubble">' + esc(m.content).replace(/\n/g, '<br>') + '</div></div>';
    } else {
      const body = m.error
        ? '<div class="biq-bubble biq-err">' + ic('alert', 15) + '<span>' + esc(m.content) + '</span></div>'
        : '<div class="biq-bubble">' + biqMd(m.content) + '</div>';
      html += '<div class="biq-msg biq-bot">' + body + '</div>';
    }
  }
  if (BIQ_BUSY) {
    html += '<div class="biq-msg biq-bot"><div class="biq-bubble biq-thinking"><span></span><span></span><span></span></div></div>';
  }
  return html;
}

function biqRender(): void {
  const root = document.getElementById('__biq-root');
  if (!root) return;
  const ctx = biqContext();

  // Launcher (always present; hidden via CSS when the panel is open).
  const fab = '<button class="biq-fab" title="Ask BlueIQ" aria-label="Ask BlueIQ" onclick="biqToggle()"><span class="biq-fab-label">BlueIQ</span></button>';

  // Scope chip + (on a record) a broaden/narrow toggle. On a program page the
  // label reflects programs (not clients); a plain programs list reads "all programs".
  let chip: string;
  let toggle = '';
  if (ctx.clientId) {
    chip = ctx.focus === 'client'
      ? 'Asking about <b>' + esc(ctx.clientName || 'this client') + '</b>'
      : 'Asking across <b>all clients</b>';
    toggle = '<button class="biq-scope-toggle" onclick="biqToggleScope()">'
      + (ctx.focus === 'client' ? 'Ask across all clients' : 'Focus this client') + '</button>';
  } else if (ctx.programId) {
    chip = ctx.focus === 'program'
      ? 'Asking about <b>' + esc(ctx.programName || 'this program') + '</b>'
      : 'Asking across <b>all programs</b>';
    toggle = '<button class="biq-scope-toggle" onclick="biqToggleScope()">'
      + (ctx.focus === 'program' ? 'Ask across all programs' : 'Focus this program') + '</button>';
  } else if (ctx.page === 'programs') {
    chip = (ctx.programFilter && ctx.programFilter.active)
      ? 'Asking about your <b>' + ctx.programFilter.count + ' filtered program' + (ctx.programFilter.count === 1 ? '' : 's') + '</b>'
      : 'Asking across <b>all programs</b>';
  } else {
    chip = 'Asking across <b>all clients</b>';
  }

  // While a capture session is active, the thread area hosts the capture UI and
  // the chat composer is replaced by the capture flow's own controls. The chat
  // thread (BIQ_MSGS) is preserved untouched — Cancel/back restores it.
  const capActive = !!BIQ_CAP;
  const threadInner = capActive ? biqCapHtml() : biqThreadHtml(ctx);
  const composer = capActive ? '' :
    '<div class="biq-composer">'
      + '<div class="biq-cap-bar">'
        + '<button class="biq-capbtn" title="Capture a note" onclick="biqCapStart(\'input\')">' + ic('plus', 15) + '<span>Capture a note</span></button>'
        + '<button class="biq-capbtn biq-capbtn-mic" title="Dictate a note" aria-label="Dictate a note" onclick="biqCapStart(\'record\')">' + biqMic(16) + '</button>'
      + '</div>'
      + '<div class="biq-composer-row">'
        + '<textarea id="biq-input" rows="1" placeholder="Ask BlueIQ…" ' + (BIQ_BUSY ? 'disabled ' : '') + 'onkeydown="biqKey(event)"></textarea>'
        + '<button class="biq-send" title="Send" ' + (BIQ_BUSY ? 'disabled ' : '') + 'onclick="biqSend()">' + ic('send', 18) + '</button>'
      + '</div>'
    + '</div>';

  const panel =
    '<div class="biq-panel' + (BIQ_OPEN ? ' open' : '') + '" role="dialog" aria-label="BlueIQ assistant">'
      + '<div class="biq-head">'
        + '<div class="biq-title"><span class="biq-shimmer">BlueIQ</span></div>'
        + '<div class="biq-head-actions">'
          + (!capActive && BIQ_MSGS.length ? '<button class="biq-icon" title="New conversation" onclick="biqReset()">' + ic('plus', 17) + '</button>' : '')
          + '<button class="biq-icon" title="Close" onclick="biqToggle()">' + ic('x', 18) + '</button>'
        + '</div>'
      + '</div>'
      + (capActive ? '' : '<div class="biq-scope"><span class="biq-chip">' + chip + '</span>' + toggle + '</div>')
      + '<div class="biq-thread' + (capActive ? ' biq-thread-cap' : '') + '" id="biq-thread">' + threadInner + '</div>'
      + composer
    + '</div>';

  root.innerHTML = fab + panel;

  if (BIQ_OPEN) {
    const thread = document.getElementById('biq-thread');
    if (thread && !capActive) thread.scrollTop = thread.scrollHeight;
    if (capActive && BIQ_CAP) {
      // Focus the active editable surface so the consultant can type immediately.
      const capText = document.getElementById(BIQ_CAP.stage === 'manual' ? 'biq-m-text' : 'biq-cap-text') as HTMLTextAreaElement | null;
      if (capText) capText.focus();
    } else {
      const input = document.getElementById('biq-input') as HTMLTextAreaElement | null;
      if (input && !BIQ_BUSY) input.focus();
    }
  }
}

// ---- actions (global so inline onclick/onkeydown can reach them) ----
function biqToggle(): void { BIQ_OPEN = !BIQ_OPEN; biqRender(); }
function biqToggleScope(): void { BIQ_FORCE_GLOBAL = !BIQ_FORCE_GLOBAL; biqRender(); }
function biqReset(): void { BIQ_MSGS = []; biqRender(); }

function biqKey(ev: KeyboardEvent): void {
  if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); biqSend(); }
}

// Click an example prompt → fill + send.
function biqAsk(btn: HTMLElement): void {
  const input = document.getElementById('biq-input') as HTMLTextAreaElement | null;
  if (input) input.value = btn.textContent || '';
  biqSend();
}

async function biqSend(): Promise<void> {
  if (BIQ_BUSY) return;
  const input = document.getElementById('biq-input') as HTMLTextAreaElement | null;
  const q = input ? input.value.trim() : '';
  if (!q) return;

  const ctx = biqContext();
  // Prior turns (exclude errors) become the history; then this question.
  const history = BIQ_MSGS.filter(m => !m.error).map(m => ({ role: m.role, content: m.content }));

  BIQ_MSGS.push({ role: 'user', content: q });
  if (input) input.value = '';
  BIQ_BUSY = true;
  biqRender();

  try {
    const data = await apiBlueiqChat(ctx.scope, ctx.clientId, q, history,
      ctx.focus === 'program' ? ctx.programId : '',
      ctx.focus === 'program' ? ctx.programName : '',
      ctx.programFilter || null);
    BIQ_MSGS.push({
      role: 'assistant',
      content: (data && data.assistantMessage) ? data.assistantMessage : '(No answer was returned.)',
    });
  } catch (e: any) {
    BIQ_MSGS.push({ role: 'assistant', content: (e && e.message) ? e.message : String(e), error: true });
  } finally {
    BIQ_BUSY = false;
    biqRender();
  }
}

/* =====================================================================
   BlueIQ NOTE CAPTURE — jot or dictate a raw note → BlueIQ turns it into an
   editable DRAFT of a CRM entry (program note, communication, or task). The
   consultant reviews/edits, then Save writes it. NOTHING is written until Save.
   The whole session lives in BIQ_CAP (in-memory, ephemeral like the chat).
   Brand rule: never surface the word "AI" — this is BlueIQ.
   ===================================================================== */

interface BiqCapEdit {
  targetKind: 'client' | 'program';
  writeAction: string;                 // addProgramNote | addCommunication | addTask
  targetId: string; targetName: string;
  noteType: string; tourFormat: string;
  type: string; priority: string;      // type = communication channel
  date: string; tourDate: string; dueDate: string;
  body: string; subject: string; title: string; contact: string;
  picking: boolean;                    // target picker is open (not yet locked)
}
interface BiqCapTask { title: string; details: string; dueDate: string; on: boolean; }
interface BiqSavedRef { kind: 'programNote' | 'communication' | 'task'; targetId: string; entryId: string; }
interface BiqCap {
  stage: 'input' | 'recording' | 'transcribing' | 'composing' | 'draft' | 'saving' | 'saved' | 'manual';
  rawText: string; error: string; source: string;
  draft: any; edit: BiqCapEdit;
  extractedTasks: BiqCapTask[]; dateProvenance: string;
  pickIndex: Record<string, string>; pickQuery: string;
  savedRefs: BiqSavedRef[]; failedTasks: BiqCapTask[]; extractedSaved: number;
  savedDest: { kind: 'client' | 'program'; id: string; name: string } | null;
  manualBlock: string;
}
let BIQ_CAP: BiqCap | null = null;

// Allowed SingleSelect display-name lists for the note dropdowns (cached).
let BIQ_NOTE_META: any = null;
let BIQ_NOTE_META_LOADING = false;

// MediaRecorder session state (separate from render; the panel just reflects it).
let BIQ_MREC: MediaRecorder | null = null;
let BIQ_MSTREAM: MediaStream | null = null;
let BIQ_MCHUNKS: BlobPart[] = [];
let BIQ_MMIME = '';
let BIQ_RTIMER: any = null;
let BIQ_RSTART = 0;
const BIQ_RCAP = 120;                  // hard cap on a dictation (seconds)

// ---- small inline glyphs (icons.ts has no mic) ----
function biqMic(sz: number): string {
  return '<svg viewBox="0 0 24 24" width="' + sz + '" height="' + sz + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/></svg>';
}
function biqKindIcon(kind: 'client' | 'program'): string { return kind === 'program' ? ic('building', 15) : ic('user', 15); }
function biqToday(): string { return new Date().toISOString().slice(0, 10); }
function biqIsTour(noteType: string): boolean { return /tour/i.test(noteType || ''); }
function biqFmtSecs(s: number): string { const m = Math.floor(s / 60); const ss = s % 60; return m + ':' + (ss < 10 ? '0' : '') + ss; }
function biqCapBlocked(env: any): boolean { return !!(env && (env.creditLimitReached || env.creditCheckFailed || env.blueiqDisabled)); }

// ---- note-meta option lists ----
function biqMeta(path: string): string[] {
  if (!BIQ_NOTE_META) return [];
  const parts = path.split('.');
  let cur: any = BIQ_NOTE_META;
  for (const p of parts) { if (cur && typeof cur === 'object' && p in cur) cur = cur[p]; else return []; }
  return Array.isArray(cur) ? cur.filter((x: any) => typeof x === 'string' && x.trim()) : [];
}
async function biqLoadNoteMeta(): Promise<void> {
  if (BIQ_NOTE_META || BIQ_NOTE_META_LOADING) return;
  BIQ_NOTE_META_LOADING = true;
  try { BIQ_NOTE_META = await apiNoteMeta(); }
  catch (_e) { BIQ_NOTE_META = {}; }         // fail soft → free-text inputs
  finally { BIQ_NOTE_META_LOADING = false; if (BIQ_CAP) biqRender(); }
}

// ---- data sources for the target picker + dictation vocab ----
function biqCapClients(): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = [];
  const seen: Record<string, boolean> = {};
  const stores = [
    (typeof CLIENT_STORE !== 'undefined') ? CLIENT_STORE : null,
    (typeof INQUIRY_STORE !== 'undefined') ? INQUIRY_STORE : null,
    (typeof ALUMNI_STORE !== 'undefined') ? ALUMNI_STORE : null,
  ];
  stores.forEach(s => (s || []).forEach((c: any) => {
    const nm = ((c.first || '') + ' ' + (c.last || '')).trim();
    if (nm && c.id && !seen[c.id]) { seen[c.id] = true; out.push({ id: String(c.id), name: nm }); }
  }));
  return out;
}
function biqCapPrograms(): { id: string; name: string }[] {
  const store = (typeof PROGRAM_STORE !== 'undefined') ? PROGRAM_STORE : null;
  return (store || []).map((p: any) => ({ id: String(p.id), name: p.programName || '' })).filter(x => x.name);
}
// Client + program proper nouns bias the transcription toward correct spelling.
function biqCapVocab(): string[] {
  const seen: Record<string, boolean> = {};
  const out: string[] = [];
  const add = (n: string) => { n = (n || '').trim(); const k = n.toLowerCase(); if (n && !seen[k]) { seen[k] = true; out.push(n); } };
  biqCapClients().forEach(c => add(c.name));
  biqCapPrograms().forEach(p => add(p.name));
  return out.slice(0, 200);
}
// Kick off any store loads the pickers/vocab need, re-rendering the capture UI
// when they arrive (store loaders call the SPA render(), not biqRender()).
function biqCapEnsureStores(): void {
  const jobs: Promise<any>[] = [];
  try {
    if (typeof CLIENT_STORE !== 'undefined' && CLIENT_STORE === null && typeof loadClients === 'function') jobs.push(loadClients());
    if (typeof INQUIRY_STORE !== 'undefined' && INQUIRY_STORE === null && typeof loadInquiries === 'function') jobs.push(loadInquiries());
    if (typeof ALUMNI_STORE !== 'undefined' && ALUMNI_STORE === null && typeof loadAlumni === 'function') jobs.push(loadAlumni());
    if (typeof PROGRAM_STORE !== 'undefined' && PROGRAM_STORE === null && typeof loadPrograms === 'function') jobs.push(loadPrograms());
  } catch (_e) { /* stores not present */ }
  if (jobs.length) Promise.all(jobs).then(() => { if (BIQ_CAP) biqRender(); }).catch(() => { /* ignore */ });
}

// ---- session lifecycle ----
function biqEmptyEdit(): BiqCapEdit {
  return {
    targetKind: 'client', writeAction: 'addCommunication', targetId: '', targetName: '',
    noteType: '', tourFormat: '', type: '', priority: '',
    date: '', tourDate: '', dueDate: '', body: '', subject: '', title: '', contact: '', picking: true,
  };
}
function biqCapStart(mode: string): void {
  BIQ_CAP = {
    stage: 'input', rawText: '', error: '', source: 'text', draft: null, edit: biqEmptyEdit(),
    extractedTasks: [], dateProvenance: '', pickIndex: {}, pickQuery: '',
    savedRefs: [], failedTasks: [], extractedSaved: 0, savedDest: null, manualBlock: '',
  };
  BIQ_OPEN = true;
  biqLoadNoteMeta();
  biqCapEnsureStores();
  if (mode === 'record') biqCapRecord();
  else biqRender();
}
function biqCapCancel(): void {
  biqStopTimer();
  try { if (BIQ_MREC && BIQ_MREC.state !== 'inactive') BIQ_MREC.stop(); } catch (_e) { /* ignore */ }
  biqStopStream();
  BIQ_MREC = null;
  BIQ_CAP = null;
  biqRender();
}
function biqCapBackToInput(): void { if (!BIQ_CAP) return; BIQ_CAP.error = ''; BIQ_CAP.stage = 'input'; biqRender(); }

// ---- recording ----
function biqPickMime(): string {
  const cands = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  if (typeof MediaRecorder !== 'undefined' && (MediaRecorder as any).isTypeSupported) {
    for (const m of cands) { try { if ((MediaRecorder as any).isTypeSupported(m)) return m; } catch (_e) { /* ignore */ } }
  }
  return '';
}
async function biqCapRecord(): Promise<void> {
  if (!BIQ_CAP) return;
  const ta = document.getElementById('biq-cap-text') as HTMLTextAreaElement | null;
  if (ta) BIQ_CAP.rawText = ta.value;   // keep any typed text
  BIQ_CAP.error = '';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    BIQ_MSTREAM = stream; BIQ_MCHUNKS = []; BIQ_MMIME = biqPickMime();
    const rec = BIQ_MMIME ? new MediaRecorder(stream, { mimeType: BIQ_MMIME }) : new MediaRecorder(stream);
    BIQ_MREC = rec;
    rec.ondataavailable = (ev: BlobEvent) => { if (ev.data && ev.data.size > 0) BIQ_MCHUNKS.push(ev.data); };
    rec.onstop = () => { biqCapProcessRecording(); };
    rec.start();
    BIQ_RSTART = Date.now();
    if (!BIQ_CAP) return;
    BIQ_CAP.stage = 'recording';
    biqRender();
    biqStartTimer();
  } catch (err: any) {
    if (!BIQ_CAP) return;
    BIQ_CAP.error = 'Microphone unavailable: ' + ((err && err.message) ? err.message : String(err));
    BIQ_CAP.stage = 'input';
    biqRender();
  }
}
function biqStartTimer(): void {
  biqStopTimer();
  BIQ_RTIMER = setInterval(() => {
    const secs = Math.floor((Date.now() - BIQ_RSTART) / 1000);
    const el = document.getElementById('biq-rec-timer');
    if (el) el.textContent = biqFmtSecs(secs);
    if (secs >= BIQ_RCAP) biqCapStopRec();
  }, 250);
}
function biqStopTimer(): void { if (BIQ_RTIMER) { clearInterval(BIQ_RTIMER); BIQ_RTIMER = null; } }
function biqStopStream(): void {
  if (BIQ_MSTREAM) { try { BIQ_MSTREAM.getTracks().forEach(t => t.stop()); } catch (_e) { /* ignore */ } BIQ_MSTREAM = null; }
}
function biqCapStopRec(): void {
  biqStopTimer();
  try { if (BIQ_MREC && BIQ_MREC.state !== 'inactive') BIQ_MREC.stop(); } catch (_e) { /* ignore */ }
}
function biqBlobToB64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error || new Error('read error'));
    fr.onload = () => { const r = String(fr.result || ''); const i = r.indexOf(','); resolve(i >= 0 ? r.slice(i + 1) : r); };
    fr.readAsDataURL(blob);
  });
}
async function biqCapProcessRecording(): Promise<void> {
  if (!BIQ_CAP) { biqStopStream(); return; }
  const mime = BIQ_MMIME || (BIQ_MREC && BIQ_MREC.mimeType) || 'audio/webm';
  biqStopStream();
  const blob = new Blob(BIQ_MCHUNKS, { type: mime });
  BIQ_MCHUNKS = [];
  if (!blob.size) { BIQ_CAP.error = 'No audio was captured. Try again.'; BIQ_CAP.stage = 'input'; biqRender(); return; }
  BIQ_CAP.stage = 'transcribing'; biqRender();
  let b64 = '';
  try { b64 = await biqBlobToB64(blob); }
  catch (_e) { if (!BIQ_CAP) return; BIQ_CAP.error = 'Could not read the recording.'; BIQ_CAP.stage = 'input'; biqRender(); return; }
  try {
    const env = await apiBlueiqTranscribe(b64, mime, biqCapVocab());
    if (!BIQ_CAP) return;
    if (env && env.ok && env.data && typeof env.data.transcript === 'string') {
      const tx = env.data.transcript.trim();
      const prior = (BIQ_CAP.rawText || '').trim();
      BIQ_CAP.rawText = prior ? (prior + '\n' + tx) : tx;   // fold in any text they'd typed
      BIQ_CAP.source = 'voice';
      if (!BIQ_CAP.rawText.trim()) {   // nothing came back — let them try again
        BIQ_CAP.error = "I didn't catch anything. Try again, or type your note.";
        BIQ_CAP.stage = 'input';
        biqRender();
      } else {
        biqCapCompose();               // dictation goes straight into note generation
      }
    } else if (biqCapBlocked(env)) {
      biqCapEnterManual(env && env.error);
    } else {
      BIQ_CAP.error = (env && env.error) ? env.error : 'Transcription failed. Type your note instead, or try again.';
      BIQ_CAP.stage = 'input';
      biqRender();
    }
  } catch (err: any) {
    if (!BIQ_CAP) return;
    BIQ_CAP.error = (err && err.message) ? err.message : String(err);
    BIQ_CAP.stage = 'input';
    biqRender();
  }
}

// ---- compose (raw text → editable draft) ----
async function biqCapCompose(): Promise<void> {
  if (!BIQ_CAP) return;
  const ta = document.getElementById('biq-cap-text') as HTMLTextAreaElement | null;
  if (ta) BIQ_CAP.rawText = ta.value;
  const raw = (BIQ_CAP.rawText || '').trim();
  if (!raw) { BIQ_CAP.error = 'Type or dictate a note first.'; biqRender(); return; }
  BIQ_CAP.error = ''; BIQ_CAP.stage = 'composing'; biqRender();
  const ctx = biqContext();
  try {
    const env = await apiBlueiqCompose({
      rawText: raw, source: BIQ_CAP.source || 'text',
      scope: ctx.scope, clientId: ctx.clientId || '', programId: ctx.programId || '', programName: ctx.programName || '',
    });
    if (!BIQ_CAP) return;
    if (env && env.ok && env.data && env.data.draft) {
      biqCapInitDraft(env.data.draft);
      BIQ_CAP.stage = 'draft';
      biqRender();
    } else if (biqCapBlocked(env)) {
      biqCapEnterManual(env && env.error);
    } else {
      BIQ_CAP.error = (env && env.error) ? env.error : 'BlueIQ could not read your note. Edit it and try again.';
      BIQ_CAP.stage = 'input';
      biqRender();
    }
  } catch (err: any) {
    if (!BIQ_CAP) return;
    BIQ_CAP.error = (err && err.message) ? err.message : String(err);
    BIQ_CAP.stage = 'input';
    biqRender();
  }
}
function biqCapInitDraft(d: any): void {
  if (!BIQ_CAP) return;
  const cap = BIQ_CAP;
  cap.draft = d;
  const f = (d && d.fields) || {};
  const tgt = (d && d.target) || {};
  const kind: 'client' | 'program' = (d && d.targetKind === 'program') ? 'program' : 'client';
  const wa = (d && d.writeAction) || (kind === 'program' ? 'addProgramNote' : 'addCommunication');
  let body = '';
  if (wa === 'addProgramNote') body = f.body || '';
  else if (wa === 'addTask') body = f.details || '';
  else body = f.notes || f.body || '';
  // Locked = a confident, filed target. Unfiled or low-confidence forces a pick.
  const locked = !d.unfiled && !!tgt.id && tgt.confidence !== 'low';
  cap.pickIndex = {};
  cap.pickQuery = '';
  cap.edit = {
    targetKind: kind, writeAction: wa,
    targetId: locked ? (tgt.id || '') : '', targetName: locked ? (tgt.name || '') : '',
    noteType: f.noteType || '', tourFormat: f.tourFormat || '',
    type: f.type || '', priority: f.priority || '',
    date: f.date || f.dueDate || '', tourDate: f.tourDate || f.date || '', dueDate: f.dueDate || f.date || '',
    body: body, subject: f.subject || '', title: f.title || '', contact: f.contact || '',
    picking: !locked,
  };
  if (tgt.id) cap.pickIndex[tgt.id] = tgt.name || '';
  ((tgt.alternatives || []) as any[]).forEach(a => { if (a && a.id) cap.pickIndex[a.id] = a.name || ''; });
  cap.dateProvenance = (d && d.dateProvenance) || '';
  const ex = ((d && d.extractedTasks) || []) as any[];
  cap.extractedTasks = ex.map(t => ({ title: t.title || '', details: t.details || '', dueDate: t.dueDate || '', on: t.defaultOn !== false }));
}

// ---- manual mode (credits blocked → the words must still be fileable) ----
function biqCapEnterManual(blockMsg?: string): void {
  if (!BIQ_CAP) return;
  const cap = BIQ_CAP;
  const ctx = biqContext();
  const kind: 'client' | 'program' = (ctx.programId && !ctx.clientId) ? 'program' : 'client';
  cap.manualBlock = blockMsg || 'BlueIQ interpretation is paused (out of monthly credits). You can still file this note manually.';
  cap.pickIndex = {}; cap.pickQuery = '';
  const tid = kind === 'program' ? (ctx.programId || '') : (ctx.clientId || '');
  const tnm = kind === 'program' ? (ctx.programName || '') : (ctx.clientName || '');
  if (tid) cap.pickIndex[tid] = tnm;
  cap.edit = {
    targetKind: kind, writeAction: kind === 'program' ? 'addProgramNote' : 'addCommunication',
    targetId: tid, targetName: tnm,
    noteType: '', tourFormat: '', type: '', priority: '',
    date: biqToday(), tourDate: biqToday(), dueDate: '',
    body: '', subject: '', title: '', contact: '', picking: !tid,
  };
  cap.stage = 'manual';
  biqRender();
}
function biqCapManualKind(kind: 'client' | 'program'): void {
  if (!BIQ_CAP) return;
  const ta = document.getElementById('biq-m-text') as HTMLTextAreaElement | null;
  if (ta) BIQ_CAP.rawText = ta.value;
  BIQ_CAP.edit.targetKind = kind;
  BIQ_CAP.edit.writeAction = kind === 'program' ? 'addProgramNote' : 'addCommunication';
  BIQ_CAP.edit.targetId = ''; BIQ_CAP.edit.targetName = ''; BIQ_CAP.edit.picking = true;
  BIQ_CAP.pickQuery = '';
  biqRender();
}
async function biqCapManualSave(): Promise<void> {
  if (!BIQ_CAP) return;
  const cap = BIQ_CAP;
  const ta = document.getElementById('biq-m-text') as HTMLTextAreaElement | null;
  if (ta) cap.rawText = ta.value;
  const ty = document.getElementById('biq-m-type') as HTMLSelectElement | HTMLInputElement | null;
  const type = ty ? String(ty.value) : '';
  const e = cap.edit;
  const body = (cap.rawText || '').trim();
  if (!e.targetId) { cap.error = 'Choose where to file this first.'; biqRender(); return; }
  if (!body) { cap.error = 'Write your note first.'; biqRender(); return; }
  cap.error = ''; cap.stage = 'saving'; biqRender();
  const refs: BiqSavedRef[] = [];
  try {
    if (e.targetKind === 'program') {
      const created = await apiCaptureAddProgramNote(e.targetId, { cachedName: e.targetName }, { body: body, noteType: type }, cap.rawText || '');
      refs.push({ kind: 'programNote', targetId: e.targetId, entryId: String((created && created.entryId) || '') });
    } else {
      const created = await apiCaptureAddCommunication(e.targetId, { notes: body, type: type, date: biqToday() }, cap.rawText || '');
      refs.push({ kind: 'communication', targetId: e.targetId, entryId: String((created && created.entryId) || '') });
    }
  } catch (err: any) {
    cap.error = (err && err.message) ? err.message : String(err);
    cap.stage = 'manual'; biqRender(); return;
  }
  cap.savedRefs = refs; cap.failedTasks = []; cap.extractedSaved = 0;
  cap.savedDest = { kind: e.targetKind, id: e.targetId, name: e.targetName };
  cap.stage = 'saved'; biqRender();
}

// ---- target picker (shared by draft + manual) ----
function biqCapPickChoose(id: string): void {
  if (!BIQ_CAP) return;
  const nm = BIQ_CAP.pickIndex[id] || id;
  BIQ_CAP.edit.targetId = id; BIQ_CAP.edit.targetName = nm; BIQ_CAP.edit.picking = false;
  BIQ_CAP.error = '';
  biqRender();
}
function biqCapChangeTarget(): void {
  if (!BIQ_CAP) return;
  biqCapSync();
  BIQ_CAP.edit.picking = true; BIQ_CAP.pickQuery = '';
  biqRender();
}
// Re-filter the picker list in place (keeps input focus/caret).
function biqCapPickFilter(): void {
  if (!BIQ_CAP) return;
  const inp = document.getElementById('biq-pick-input') as HTMLInputElement | null;
  const q = inp ? inp.value : '';
  BIQ_CAP.pickQuery = q;
  const list = document.getElementById('biq-pick-list');
  if (list) list.innerHTML = biqCapPickListHtml(BIQ_CAP.edit.targetKind, q);
}
function biqCapPickListHtml(kind: 'client' | 'program', q: string): string {
  const cap = BIQ_CAP; if (!cap) return '';
  const q2 = (q || '').toLowerCase().trim();
  const items = kind === 'program' ? biqCapPrograms() : biqCapClients();
  let list = items;
  if (q2) list = items.filter(x => x.name.toLowerCase().indexOf(q2) >= 0);
  list = list.slice(0, 30);
  if (!list.length) return '<div class="biq-pick-empty">' + (items.length ? 'No matches.' : 'Loading…') + '</div>';
  return list.map(x => { cap.pickIndex[x.id] = x.name; return '<button class="biq-pick-item" onclick="biqCapPickChoose(\'' + esc(x.id) + '\')">' + esc(x.name) + '</button>'; }).join('');
}
function biqCapPicker(kind: 'client' | 'program'): string {
  const cap = BIQ_CAP; if (!cap) return '';
  const label = kind === 'program' ? 'program' : 'client';
  // Suggested target + alternatives become one-tap chips (draft mode only).
  let chips = '';
  const d = cap.draft;
  if (d && d.target) {
    const seen: Record<string, boolean> = {};
    const cand: any[] = [];
    if (d.target.id) cand.push({ id: d.target.id, name: d.target.name });
    ((d.target.alternatives || []) as any[]).forEach(a => cand.push(a));
    cand.forEach(a => {
      if (a && a.id && !seen[a.id]) {
        seen[a.id] = true; cap.pickIndex[a.id] = a.name || '';
        chips += '<button class="biq-alt" onclick="biqCapPickChoose(\'' + esc(a.id) + '\')">' + esc(a.name || a.id) + '</button>';
      }
    });
  }
  return '<div class="biq-pick">'
    + '<input id="biq-pick-input" class="biq-in biq-pick-input" placeholder="Search ' + label + 's…" value="' + esc(cap.pickQuery || '') + '" oninput="biqCapPickFilter()">'
    + (chips ? ('<div class="biq-alts">' + chips + '</div>') : '')
    + '<div class="biq-pick-list" id="biq-pick-list">' + biqCapPickListHtml(kind, cap.pickQuery || '') + '</div>'
    + '</div>';
}

// ---- read every present editable control back into edit state (call before
// any re-render or save so typed edits survive) ----
function biqCapSync(): void {
  if (!BIQ_CAP) return;
  const e = BIQ_CAP.edit;
  const v = (id: string): string | null => { const el = document.getElementById(id) as any; return el ? String(el.value) : null; };
  let x: string | null;
  if ((x = v('biq-d-body')) !== null) e.body = x;
  if ((x = v('biq-d-subject')) !== null) e.subject = x;
  if ((x = v('biq-d-title')) !== null) e.title = x;
  if ((x = v('biq-d-contact')) !== null) e.contact = x;
  if ((x = v('biq-d-date')) !== null) e.date = x;
  if ((x = v('biq-d-tourdate')) !== null) e.tourDate = x;
  if ((x = v('biq-d-duedate')) !== null) e.dueDate = x;
  if ((x = v('biq-d-notetype')) !== null) e.noteType = x;
  if ((x = v('biq-d-commtype')) !== null) e.type = x;
  if ((x = v('biq-d-tourformat')) !== null) e.tourFormat = x;
  if ((x = v('biq-d-priority')) !== null) e.priority = x;
  for (let i = 0; i < BIQ_CAP.extractedTasks.length; i++) {
    const cb = document.getElementById('biq-task-' + i) as HTMLInputElement | null;
    if (cb) BIQ_CAP.extractedTasks[i].on = cb.checked;
  }
}
function biqCapNoteTypeChange(): void { if (!BIQ_CAP) return; biqCapSync(); biqRender(); }

// ---- save ----
async function biqCapSave(): Promise<void> {
  if (!BIQ_CAP) return;
  biqCapSync();
  const cap = BIQ_CAP;
  const e = cap.edit;
  if (!e.targetId) { cap.error = 'Choose where to file this first.'; biqRender(); return; }
  cap.error = ''; cap.stage = 'saving'; biqRender();
  const transcript = cap.rawText || '';
  const refs: BiqSavedRef[] = [];
  // 1) the main note — never rolled back once it lands.
  try {
    if (e.writeAction === 'addProgramNote') {
      const fields: any = { body: e.body, noteType: e.noteType };
      // tourDate/tourFormat only apply to Tour notes; a general note's date is createdAt.
      if (biqIsTour(e.noteType)) {
        if (e.tourDate) fields.tourDate = e.tourDate;
        if (e.tourFormat) fields.tourFormat = e.tourFormat;
      }
      const created = await apiCaptureAddProgramNote(e.targetId, { cachedName: e.targetName }, fields, transcript);
      refs.push({ kind: 'programNote', targetId: e.targetId, entryId: String((created && created.entryId) || '') });
    } else if (e.writeAction === 'addTask') {
      const created = await apiCaptureAddTask(e.targetId, { title: e.title, details: e.body, dueDate: e.dueDate, priority: e.priority }, transcript);
      refs.push({ kind: 'task', targetId: e.targetId, entryId: String((created && created.entryId) || '') });
    } else {
      const created = await apiCaptureAddCommunication(e.targetId, { notes: e.body, subject: e.subject, type: e.type, date: e.date, contact: e.contact }, transcript);
      refs.push({ kind: 'communication', targetId: e.targetId, entryId: String((created && created.entryId) || '') });
    }
  } catch (err: any) {
    cap.error = (err && err.message) ? err.message : String(err);
    cap.stage = 'draft'; biqRender(); return;
  }
  // 2) offered follow-up tasks — only when the main target is a client (tasks
  //    live on clients). A failure here never rolls back the saved note.
  let extractedSaved = 0;
  const failed: BiqCapTask[] = [];
  if (cap.draft && cap.draft.targetKind === 'client' && e.targetKind === 'client') {
    for (let i = 0; i < cap.extractedTasks.length; i++) {
      const t = cap.extractedTasks[i];
      if (!t.on) continue;
      try {
        const ct = await apiCaptureAddTask(e.targetId, { title: t.title, details: t.details, dueDate: t.dueDate, priority: '' }, transcript);
        refs.push({ kind: 'task', targetId: e.targetId, entryId: String((ct && ct.entryId) || '') });
        extractedSaved++;
      } catch (_e) { failed.push(t); }
    }
  }
  cap.savedRefs = refs; cap.failedTasks = failed; cap.extractedSaved = extractedSaved;
  cap.savedDest = { kind: e.targetKind, id: e.targetId, name: e.targetName };
  cap.stage = 'saved'; biqRender();
}
async function biqCapRetryTasks(): Promise<void> {
  if (!BIQ_CAP || !BIQ_CAP.failedTasks.length) return;
  const cap = BIQ_CAP;
  const dest = cap.savedDest;
  if (!dest) return;
  const pending = cap.failedTasks.slice();
  cap.failedTasks = []; biqRender();
  const still: BiqCapTask[] = [];
  for (const t of pending) {
    try {
      const ct = await apiCaptureAddTask(dest.id, { title: t.title, details: t.details, dueDate: t.dueDate, priority: '' }, cap.rawText || '');
      cap.savedRefs.push({ kind: 'task', targetId: dest.id, entryId: String((ct && ct.entryId) || '') });
      cap.extractedSaved++;
    } catch (_e) { still.push(t); }
  }
  cap.failedTasks = still; biqRender();
}
// Session-scoped undo — delete whatever this capture just created.
async function biqCapUndo(): Promise<void> {
  if (!BIQ_CAP || !BIQ_CAP.savedRefs.length) return;
  const cap = BIQ_CAP;
  const refs = cap.savedRefs.slice();
  cap.stage = 'saving'; biqRender();
  for (const r of refs) {
    if (!r.entryId) continue;
    try {
      if (r.kind === 'programNote') await apiDeleteProgramNote(r.targetId, r.entryId);
      else if (r.kind === 'communication') await apiDeleteCommunication(r.targetId, r.entryId);
      else if (r.kind === 'task') await apiDeleteTask(r.targetId, r.entryId);
    } catch (_e) { /* best effort */ }
  }
  if (typeof toast === 'function') toast('Undone — nothing was saved.');
  cap.savedRefs = []; cap.failedTasks = []; cap.error = ''; cap.stage = 'input';
  biqRender();
}

// ---- capture render (all stages) ----
function biqCapErr(): string {
  return (BIQ_CAP && BIQ_CAP.error) ? '<div class="biq-cap-error">' + ic('alert', 14) + '<span>' + esc(BIQ_CAP.error) + '</span></div>' : '';
}
function biqCapBusy(label: string): string {
  return '<div class="biq-cap-busy"><div class="biq-spin"></div><p>' + esc(label) + '</p></div>';
}
function biqCapRow(label: string, inner: string): string {
  return '<div class="biq-frow"><label class="biq-flbl">' + esc(label) + '</label><div class="biq-fctl">' + inner + '</div></div>';
}
// A <select> from an option list, or a free-text <input> when the list is empty
// (a fresh org may have no options configured yet). Preserves the current value.
function biqCapField(id: string, opts: string[], cur: string, onchange: string): string {
  if (!opts || !opts.length) {
    return '<input id="' + id + '" class="biq-in" value="' + esc(cur) + '"' + (onchange ? (' oninput="' + onchange + '"') : '') + '>';
  }
  let o = '<option value=""></option>';
  let has = false;
  opts.forEach(v => { if (v === cur) has = true; o += '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(v) + '</option>'; });
  if (cur && !has) o += '<option value="' + esc(cur) + '" selected>' + esc(cur) + '</option>';
  return '<select id="' + id + '" class="biq-in"' + (onchange ? (' onchange="' + onchange + '"') : '') + '>' + o + '</select>';
}
function biqCapDestPrefix(): string {
  if (!BIQ_CAP) return 'Note';
  const e = BIQ_CAP.edit;
  if (e.writeAction === 'addProgramNote') return e.noteType ? (e.noteType + ' note') : 'Program note';
  if (e.writeAction === 'addTask') return 'Task';
  return e.type ? e.type : 'Communication';
}
function biqCapInputHtml(): string {
  const cap = BIQ_CAP; if (!cap) return '';
  return biqCapErr()
    + '<textarea id="biq-cap-text" class="biq-in biq-ta biq-cap-text" rows="6">' + esc(cap.rawText || '') + '</textarea>'
    + '<div class="biq-cap-btns">'
      + '<button class="biq-btn biq-btn-mic" onclick="biqCapRecord()">' + biqMic(16) + ' Dictate</button>'
      + '<button class="biq-btn biq-btn-primary" onclick="biqCapCompose()">Create draft ' + ic('chevR', 15) + '</button>'
    + '</div>';
}
function biqCapRecHtml(): string {
  return '<div class="biq-rec">'
    + '<div class="biq-rec-dot"></div>'
    + '<div class="biq-rec-timer" id="biq-rec-timer">0:00</div>'
    + '<p class="biq-rec-hint">Listening…</p>'
    + '<button class="biq-btn biq-btn-stop" onclick="biqCapStopRec()">Stop &amp; transcribe</button>'
    + '</div>';
}
function biqCapDraftHtml(): string {
  const cap = BIQ_CAP; if (!cap) return '';
  const e = cap.edit;
  const d = cap.draft || {};
  const kind = e.targetKind;
  // destination row
  let dest: string;
  if (e.picking) {
    dest = '<div class="biq-dest-block"><div class="biq-dest-lbl">File this to a ' + (kind === 'program' ? 'program' : 'client') + ':</div>' + biqCapPicker(kind) + '</div>';
  } else {
    const conf = (d.target && d.target.confidence) || '';
    const confHint = conf ? '<span class="biq-conf biq-conf-' + esc(conf) + '">' + esc(conf) + ' match</span>' : '';
    dest = '<div class="biq-dest"><div class="biq-dest-main">' + biqKindIcon(kind) + ' <b>' + esc(biqCapDestPrefix()) + '</b> → <span class="biq-dest-name">' + esc(e.targetName || '—') + '</span> ' + confHint + '</div><button class="biq-change" onclick="biqCapChangeTarget()">change</button></div>';
  }
  // fields (by writeAction)
  const prov = cap.dateProvenance ? '<span class="biq-prov">' + esc(cap.dateProvenance) + '</span>' : '';
  let fields = '';
  if (e.writeAction === 'addProgramNote') {
    fields += biqCapRow('Note type', biqCapField('biq-d-notetype', PROGRAM_NOTE_TYPES, e.noteType, 'biqCapNoteTypeChange()'));
    // Program notes only carry a user date when they're a Tour (tourDate); a
    // general note is dated by its server-stamped createdAt, so no date row.
    if (biqIsTour(e.noteType)) {
      fields += biqCapRow('Tour date', '<input type="date" id="biq-d-tourdate" class="biq-in" value="' + esc(e.tourDate) + '">' + prov);
      fields += biqCapRow('Tour format', biqCapField('biq-d-tourformat', TOUR_FORMATS, e.tourFormat, ''));
    }
    fields += biqCapRow('Note', '<textarea id="biq-d-body" class="biq-in biq-ta" rows="5">' + esc(e.body) + '</textarea>');
  } else if (e.writeAction === 'addTask') {
    fields += biqCapRow('Title', '<input id="biq-d-title" class="biq-in" value="' + esc(e.title) + '">');
    fields += biqCapRow('Priority', biqCapField('biq-d-priority', TASK_PRIORITIES, e.priority, ''));
    fields += biqCapRow('Due date', '<input type="date" id="biq-d-duedate" class="biq-in" value="' + esc(e.dueDate) + '">' + prov);
    fields += biqCapRow('Details', '<textarea id="biq-d-body" class="biq-in biq-ta" rows="5">' + esc(e.body) + '</textarea>');
  } else {
    fields += biqCapRow('Channel', biqCapField('biq-d-commtype', COMM_TYPES, e.type, ''));
    fields += biqCapRow('Summary', '<input id="biq-d-subject" class="biq-in" value="' + esc(e.subject) + '">');
    fields += biqCapRow('Spoke with', '<input id="biq-d-contact" class="biq-in" value="' + esc(e.contact) + '">');
    fields += biqCapRow('Date', '<input type="date" id="biq-d-date" class="biq-in" value="' + esc(e.date) + '">' + prov);
    fields += biqCapRow('Note', '<textarea id="biq-d-body" class="biq-in biq-ta" rows="5">' + esc(e.body) + '</textarea>');
  }
  // extracted follow-up tasks
  let tasks = '';
  if (cap.extractedTasks.length) {
    if (e.targetKind === 'client') {
      let rows = '';
      for (let i = 0; i < cap.extractedTasks.length; i++) {
        const t = cap.extractedTasks[i];
        rows += '<label class="biq-task"><input type="checkbox" id="biq-task-' + i + '"' + (t.on ? ' checked' : '') + '><span>' + esc(t.title) + (t.dueDate ? (' <em>' + esc(t.dueDate) + '</em>') : '') + '</span></label>';
      }
      tasks = '<div class="biq-tasks"><div class="biq-tasks-h">Follow-up tasks</div>' + rows + '</div>';
    } else {
      let rows = '';
      cap.extractedTasks.forEach(t => { rows += '<div class="biq-task biq-task-ro"><span>' + esc(t.title) + (t.dueDate ? (' <em>' + esc(t.dueDate) + '</em>') : '') + '</span></div>'; });
      tasks = '<div class="biq-tasks"><div class="biq-tasks-h">Follow-up tasks</div><p class="biq-note">Pick a client to file these.</p>' + rows + '</div>';
    }
  }
  const saveLbl = 'Save to ' + (e.targetName || '…');
  const btns = '<div class="biq-cap-btns">'
    + '<button class="biq-btn biq-btn-primary"' + (e.targetId ? '' : ' disabled') + ' onclick="biqCapSave()">' + ic('check', 15) + ' ' + esc(saveLbl) + '</button>'
    + '<button class="biq-btn biq-btn-ghost" onclick="biqCapBackToInput()">Cancel</button>'
    + '</div>';
  return biqCapErr() + dest + '<div class="biq-fields">' + fields + '</div>' + tasks + btns;
}
function biqCapManualHtml(): string {
  const cap = BIQ_CAP; if (!cap) return '';
  const e = cap.edit;
  const banner = '<div class="biq-cap-banner">' + ic('info', 14) + '<span>' + esc(cap.manualBlock || '') + '</span></div>';
  const kindToggle = '<div class="biq-kindtoggle">'
    + '<button class="biq-kindbtn' + (e.targetKind === 'client' ? ' active' : '') + '" onclick="biqCapManualKind(\'client\')">Client</button>'
    + '<button class="biq-kindbtn' + (e.targetKind === 'program' ? ' active' : '') + '" onclick="biqCapManualKind(\'program\')">Program</button>'
    + '</div>';
  const dest = e.picking
    ? '<div class="biq-dest-block"><div class="biq-dest-lbl">File to a ' + (e.targetKind === 'program' ? 'program' : 'client') + ':</div>' + biqCapPicker(e.targetKind) + '</div>'
    : '<div class="biq-dest"><div class="biq-dest-main">' + biqKindIcon(e.targetKind) + ' <span class="biq-dest-name">' + esc(e.targetName || '—') + '</span></div><button class="biq-change" onclick="biqCapChangeTarget()">change</button></div>';
  const typeOpts = e.targetKind === 'program' ? PROGRAM_NOTE_TYPES : COMM_TYPES;
  const typeRow = biqCapRow(e.targetKind === 'program' ? 'Note type' : 'Channel', biqCapField('biq-m-type', typeOpts, '', ''));
  const textRow = biqCapRow('Note', '<textarea id="biq-m-text" class="biq-in biq-ta" rows="6">' + esc(cap.rawText || '') + '</textarea>');
  const saveLbl = 'Save to ' + (e.targetName || '…');
  const btns = '<div class="biq-cap-btns">'
    + '<button class="biq-btn biq-btn-primary"' + (e.targetId ? '' : ' disabled') + ' onclick="biqCapManualSave()">' + ic('check', 15) + ' ' + esc(saveLbl) + '</button>'
    + '<button class="biq-btn biq-btn-ghost" onclick="biqCapCancel()">Cancel</button>'
    + '</div>';
  return banner + biqCapErr() + kindToggle + dest + '<div class="biq-fields">' + typeRow + textRow + '</div>' + btns;
}
function biqCapSavedHtml(): string {
  const cap = BIQ_CAP; if (!cap || !cap.savedDest) return '';
  const dest = cap.savedDest;
  const link = dest.kind === 'client' ? ('#/clients/' + encodeURIComponent(dest.id)) : ('#/programs/' + encodeURIComponent(dest.id));
  const fail = cap.failedTasks.length
    ? ('<div class="biq-cap-warn">' + ic('alert', 14) + '<span>Note saved. ' + cap.failedTasks.length + ' task' + (cap.failedTasks.length === 1 ? '' : 's') + ' failed — <button class="biq-linkbtn" onclick="biqCapRetryTasks()">retry</button></span></div>')
    : '';
  const extra = cap.extractedSaved ? ('<div class="biq-saved-sub">+ ' + cap.extractedSaved + ' follow-up task' + (cap.extractedSaved === 1 ? '' : 's') + ' created</div>') : '';
  return '<div class="biq-saved">'
    + '<div class="biq-saved-ico">' + ic('check', 34) + '</div>'
    + '<div class="biq-saved-msg">Saved to <b>' + esc(dest.name) + '</b></div>'
    + extra + fail
    + '<div class="biq-cap-btns">'
      + '<a class="biq-btn biq-btn-primary" href="' + link + '" onclick="biqCapCancel()">' + ic('external', 15) + ' Open ' + esc(dest.name) + '</a>'
      + '<button class="biq-btn biq-btn-ghost" onclick="biqCapUndo()">Undo</button>'
    + '</div>'
    + '<div class="biq-cap-btns2">'
      + '<button class="biq-linkbtn" onclick="biqCapStart(\'input\')">Capture another</button>'
      + '<button class="biq-linkbtn" onclick="biqCapCancel()">Done</button>'
    + '</div>'
    + '</div>';
}
function biqCapHtml(): string {
  const cap = BIQ_CAP; if (!cap) return '';
  let inner: string;
  switch (cap.stage) {
    case 'recording': inner = biqCapRecHtml(); break;
    case 'transcribing': inner = biqCapBusy('Transcribing…'); break;
    case 'composing': inner = biqCapBusy('Reading your note…'); break;
    case 'draft': inner = biqCapDraftHtml(); break;
    case 'saving': inner = biqCapBusy('Saving…'); break;
    case 'saved': inner = biqCapSavedHtml(); break;
    case 'manual': inner = biqCapManualHtml(); break;
    default: inner = biqCapInputHtml();
  }
  const head = '<div class="biq-cap-head">'
    + '<button class="biq-cap-back" title="Back to chat" aria-label="Back to chat" onclick="biqCapCancel()">' + ic('chevL', 16) + '</button>'
    + '<span class="biq-cap-title"><span class="biq-shimmer">Capture</span>&nbsp;a note</span>'
    + '</div>';
  return '<div class="biq-cap">' + head + inner + '</div>';
}

// ---- boot: mount the persistent root once, outside #app ----
// BlueIQ is a per-user opt-in seat, so we only mount the assistant when it's
// enabled for the current user. We DEFAULT TO SHOWING and hide only on an
// explicit enabled:false — a transient status error must not hide a paid
// product (the endpoint already reports enabled:true for gate hiccups).
async function biqInit(): Promise<void> {
  if (document.getElementById('__biq-root')) return;
  let show = true;
  try {
    const status = await apiBlueiqStatus();
    if (status && status.enabled === false) show = false;
  } catch (_e) { show = true; }
  if (!show) return;
  if (document.getElementById('__biq-root')) return; // guard against a race
  const root = document.createElement('div');
  root.id = '__biq-root';
  document.body.appendChild(root);
  biqRender();
  // Navigating between routes changes scope — refresh the chip if open, and
  // reset a manual broaden so each page starts at its natural scope.
  window.addEventListener('hashchange', () => { BIQ_FORCE_GLOBAL = false; if (BIQ_OPEN) biqRender(); });
}

if (document.readyState !== 'loading') biqInit();
else document.addEventListener('DOMContentLoaded', biqInit);
