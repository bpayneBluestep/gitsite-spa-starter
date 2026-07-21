let BIQ_OPEN = false;
let BIQ_BUSY = false;
let BIQ_FORCE_GLOBAL = false;
let BIQ_MSGS = [];
function biqProgramName(id) {
  try {
    if (typeof PROGRAM_DETAIL !== "undefined" && PROGRAM_DETAIL[id] && PROGRAM_DETAIL[id].programName) return PROGRAM_DETAIL[id].programName;
    if (typeof PROGRAM_STORE !== "undefined" && PROGRAM_STORE) {
      for (const p of PROGRAM_STORE) if (p.id === id) return p.programName || "";
    }
  } catch (_e) {
  }
  return "";
}
function biqContext() {
  const hash = location.hash.replace(/^#/, "") || "/dashboard";
  const parts = hash.split("/").filter(Boolean);
  const page = parts[0] || "dashboard";
  let clientId = "", clientName = "", programId = "", programName = "";
  if (page === "clients" && parts[1]) {
    clientId = decodeURIComponent(parts[1]);
    const c = typeof findClient === "function" ? findClient(clientId) : void 0;
    if (c) clientName = ((c.first || "") + " " + (c.last || "")).trim();
  } else if (page === "programs" && parts[1]) {
    programId = decodeURIComponent(parts[1]);
    programName = biqProgramName(programId);
  }
  const scope = clientId && !BIQ_FORCE_GLOBAL ? "client" : "global";
  let focus = "none";
  if (clientId && !BIQ_FORCE_GLOBAL) focus = "client";
  else if (programId && !BIQ_FORCE_GLOBAL) focus = "program";
  const programFilter = page === "programs" && !programId && typeof progBiqPayload === "function" ? progBiqPayload() : null;
  return { page, scope, clientId, clientName, programId, programName, focus, programFilter };
}
function biqMd(src) {
  const inline = (t) => {
    let s = esc(t);
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, url) => {
      const isHash = url.charAt(0) === "#";
      const attrs = isHash ? "" : ' target="_blank" rel="noopener"';
      return '<a href="' + url + '"' + attrs + ">" + label + "</a>";
    });
    return s;
  };
  const lines = String(src == null ? "" : src).split("\n");
  let html = "";
  let inList = false;
  const closeList = () => {
    if (inList) {
      html += "</ul>";
      inList = false;
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) {
      closeList();
      continue;
    }
    let m;
    if (m = t.match(/^#{1,3}\s+(.*)/)) {
      closeList();
      html += "<h4>" + inline(m[1]) + "</h4>";
      continue;
    }
    if (m = t.match(/^[-*]\s+(.*)/)) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += "<li>" + inline(m[1]) + "</li>";
      continue;
    }
    closeList();
    html += "<p>" + inline(t) + "</p>";
  }
  closeList();
  return html;
}
function biqThreadHtml(ctx) {
  if (!BIQ_MSGS.length && !BIQ_BUSY) {
    let who;
    let examples;
    if (ctx.focus === "client") {
      who = "Ask me anything about <b>" + esc(ctx.clientName || "this client") + "</b> \u2014 their profile, contacts, or what their files say.";
      examples = ["Summarize this client", "Who are the contacts?", "What do the files say about their history?"];
    } else if (ctx.focus === "program") {
      who = "Ask me anything about <b>" + esc(ctx.programName || "this program") + "</b> \u2014 its profile, my rating and notes, or the files I\u2019ve saved.";
      examples = ["Summarize this program", "What did I rate this and why?", "What are my notes from the tour?"];
    } else if (ctx.page === "programs" && ctx.programFilter && ctx.programFilter.active) {
      const n = ctx.programFilter.count;
      who = "Ask me about the <b>" + n + " program" + (n === 1 ? "" : "s") + "</b> matching your filters \u2014 compare, rank, or find the best fit among them.";
      examples = ["Compare these on length of stay and cost", "Which of these best fit a 15-year-old with trauma?", "Which take insurance?"];
    } else if (ctx.page === "programs") {
      who = "Ask me about the program directory \u2014 search it, or dig into the programs you\u2019ve rated and noted.";
      examples = ["Which programs have I rated 5 stars?", "My highly-rated programs that treat OCD", "Find wilderness programs in Utah"];
    } else {
      who = "Ask me about your caseload \u2014 find clients, compare them, or dig into any client\u2019s files.";
      examples = ["How many clients do I have?", "Which clients have no contacts yet?", "Find clients named Jordan"];
    }
    return '<div class="biq-empty">' + ic("sparkle", 26) + "<p>" + who + '</p><div class="biq-examples">' + examples.map((e) => '<button class="biq-eg" onclick="biqAsk(this)">' + esc(e) + "</button>").join("") + "</div></div>";
  }
  let html = "";
  for (let i = 0; i < BIQ_MSGS.length; i++) {
    const m = BIQ_MSGS[i];
    if (m.role === "user") {
      html += '<div class="biq-msg biq-user"><div class="biq-bubble">' + esc(m.content).replace(/\n/g, "<br>") + "</div></div>";
    } else {
      const body = m.error ? '<div class="biq-bubble biq-err">' + ic("alert", 15) + "<span>" + esc(m.content) + "</span></div>" : '<div class="biq-bubble">' + biqMd(m.content) + "</div>";
      html += '<div class="biq-msg biq-bot">' + body + "</div>";
    }
  }
  if (BIQ_BUSY) {
    html += '<div class="biq-msg biq-bot"><div class="biq-bubble biq-thinking"><span></span><span></span><span></span></div></div>';
  }
  return html;
}
function biqRender() {
  const root = document.getElementById("__biq-root");
  if (!root) return;
  const ctx = biqContext();
  const fab = '<button class="biq-fab" title="Ask BlueIQ" aria-label="Ask BlueIQ" onclick="biqToggle()"><span class="biq-fab-label">BlueIQ</span></button>';
  let chip;
  let toggle = "";
  if (ctx.clientId) {
    chip = ctx.focus === "client" ? "Asking about <b>" + esc(ctx.clientName || "this client") + "</b>" : "Asking across <b>all clients</b>";
    toggle = '<button class="biq-scope-toggle" onclick="biqToggleScope()">' + (ctx.focus === "client" ? "Ask across all clients" : "Focus this client") + "</button>";
  } else if (ctx.programId) {
    chip = ctx.focus === "program" ? "Asking about <b>" + esc(ctx.programName || "this program") + "</b>" : "Asking across <b>all programs</b>";
    toggle = '<button class="biq-scope-toggle" onclick="biqToggleScope()">' + (ctx.focus === "program" ? "Ask across all programs" : "Focus this program") + "</button>";
  } else if (ctx.page === "programs") {
    chip = ctx.programFilter && ctx.programFilter.active ? "Asking about your <b>" + ctx.programFilter.count + " filtered program" + (ctx.programFilter.count === 1 ? "" : "s") + "</b>" : "Asking across <b>all programs</b>";
  } else {
    chip = "Asking across <b>all clients</b>";
  }
  const capActive = !!BIQ_CAP;
  const threadInner = capActive ? biqCapHtml() : biqThreadHtml(ctx);
  const composer = capActive ? "" : `<div class="biq-composer"><div class="biq-cap-bar"><button class="biq-capbtn" title="Capture a note" onclick="biqCapStart('input')">` + ic("plus", 15) + `<span>Capture a note</span></button><button class="biq-capbtn biq-capbtn-mic" title="Dictate a note" aria-label="Dictate a note" onclick="biqCapStart('record')">` + biqMic(16) + '</button></div><div class="biq-composer-row"><textarea id="biq-input" rows="1" placeholder="Ask BlueIQ\u2026" ' + (BIQ_BUSY ? "disabled " : "") + 'onkeydown="biqKey(event)"></textarea><button class="biq-send" title="Send" ' + (BIQ_BUSY ? "disabled " : "") + 'onclick="biqSend()">' + ic("send", 18) + "</button></div></div>";
  const panel = '<div class="biq-panel' + (BIQ_OPEN ? " open" : "") + '" role="dialog" aria-label="BlueIQ assistant"><div class="biq-head"><div class="biq-title"><span class="biq-shimmer">BlueIQ</span></div><div class="biq-head-actions">' + (!capActive && BIQ_MSGS.length ? '<button class="biq-icon" title="New conversation" onclick="biqReset()">' + ic("plus", 17) + "</button>" : "") + '<button class="biq-icon" title="Close" onclick="biqToggle()">' + ic("x", 18) + "</button></div></div>" + (capActive ? "" : '<div class="biq-scope"><span class="biq-chip">' + chip + "</span>" + toggle + "</div>") + '<div class="biq-thread' + (capActive ? " biq-thread-cap" : "") + '" id="biq-thread">' + threadInner + "</div>" + composer + "</div>";
  root.innerHTML = fab + panel;
  if (BIQ_OPEN) {
    const thread = document.getElementById("biq-thread");
    if (thread && !capActive) thread.scrollTop = thread.scrollHeight;
    if (capActive && BIQ_CAP) {
      const capText = document.getElementById(BIQ_CAP.stage === "manual" ? "biq-m-text" : "biq-cap-text");
      if (capText) capText.focus();
    } else {
      const input = document.getElementById("biq-input");
      if (input && !BIQ_BUSY) input.focus();
    }
  }
}
function biqToggle() {
  BIQ_OPEN = !BIQ_OPEN;
  biqRender();
}
function biqToggleScope() {
  BIQ_FORCE_GLOBAL = !BIQ_FORCE_GLOBAL;
  biqRender();
}
function biqReset() {
  BIQ_MSGS = [];
  biqRender();
}
function biqKey(ev) {
  if (ev.key === "Enter" && !ev.shiftKey) {
    ev.preventDefault();
    biqSend();
  }
}
function biqAsk(btn) {
  const input = document.getElementById("biq-input");
  if (input) input.value = btn.textContent || "";
  biqSend();
}
async function biqSend() {
  if (BIQ_BUSY) return;
  const input = document.getElementById("biq-input");
  const q = input ? input.value.trim() : "";
  if (!q) return;
  const ctx = biqContext();
  const history = BIQ_MSGS.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content }));
  BIQ_MSGS.push({ role: "user", content: q });
  if (input) input.value = "";
  BIQ_BUSY = true;
  biqRender();
  try {
    const data = await apiBlueiqChat(
      ctx.scope,
      ctx.clientId,
      q,
      history,
      ctx.focus === "program" ? ctx.programId : "",
      ctx.focus === "program" ? ctx.programName : "",
      ctx.programFilter || null
    );
    BIQ_MSGS.push({
      role: "assistant",
      content: data && data.assistantMessage ? data.assistantMessage : "(No answer was returned.)"
    });
  } catch (e) {
    BIQ_MSGS.push({ role: "assistant", content: e && e.message ? e.message : String(e), error: true });
  } finally {
    BIQ_BUSY = false;
    biqRender();
  }
}
let BIQ_CAP = null;
let BIQ_NOTE_META = null;
let BIQ_NOTE_META_LOADING = false;
let BIQ_MREC = null;
let BIQ_MSTREAM = null;
let BIQ_MCHUNKS = [];
let BIQ_MMIME = "";
let BIQ_RTIMER = null;
let BIQ_RSTART = 0;
const BIQ_RCAP = 120;
function biqMic(sz) {
  return '<svg viewBox="0 0 24 24" width="' + sz + '" height="' + sz + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/></svg>';
}
function biqKindIcon(kind) {
  return kind === "program" ? ic("building", 15) : ic("user", 15);
}
function biqToday() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
function biqIsTour(noteType) {
  return /tour/i.test(noteType || "");
}
function biqFmtSecs(s) {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return m + ":" + (ss < 10 ? "0" : "") + ss;
}
function biqCapBlocked(env) {
  return !!(env && (env.creditLimitReached || env.creditCheckFailed || env.blueiqDisabled));
}
function biqMeta(path) {
  if (!BIQ_NOTE_META) return [];
  const parts = path.split(".");
  let cur = BIQ_NOTE_META;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in cur) cur = cur[p];
    else return [];
  }
  return Array.isArray(cur) ? cur.filter((x) => typeof x === "string" && x.trim()) : [];
}
async function biqLoadNoteMeta() {
  if (BIQ_NOTE_META || BIQ_NOTE_META_LOADING) return;
  BIQ_NOTE_META_LOADING = true;
  try {
    BIQ_NOTE_META = await apiNoteMeta();
  } catch (_e) {
    BIQ_NOTE_META = {};
  } finally {
    BIQ_NOTE_META_LOADING = false;
    if (BIQ_CAP) biqRender();
  }
}
function biqCapClients() {
  const out = [];
  const seen = {};
  const stores = [
    typeof CLIENT_STORE !== "undefined" ? CLIENT_STORE : null,
    typeof INQUIRY_STORE !== "undefined" ? INQUIRY_STORE : null,
    typeof ALUMNI_STORE !== "undefined" ? ALUMNI_STORE : null
  ];
  stores.forEach((s) => (s || []).forEach((c) => {
    const nm = ((c.first || "") + " " + (c.last || "")).trim();
    if (nm && c.id && !seen[c.id]) {
      seen[c.id] = true;
      out.push({ id: String(c.id), name: nm });
    }
  }));
  return out;
}
function biqCapPrograms() {
  const store = typeof PROGRAM_STORE !== "undefined" ? PROGRAM_STORE : null;
  return (store || []).map((p) => ({ id: String(p.id), name: p.programName || "" })).filter((x) => x.name);
}
function biqCapVocab() {
  const seen = {};
  const out = [];
  const add = (n) => {
    n = (n || "").trim();
    const k = n.toLowerCase();
    if (n && !seen[k]) {
      seen[k] = true;
      out.push(n);
    }
  };
  biqCapClients().forEach((c) => add(c.name));
  biqCapPrograms().forEach((p) => add(p.name));
  return out.slice(0, 200);
}
function biqCapEnsureStores() {
  const jobs = [];
  try {
    if (typeof CLIENT_STORE !== "undefined" && CLIENT_STORE === null && typeof loadClients === "function") jobs.push(loadClients());
    if (typeof INQUIRY_STORE !== "undefined" && INQUIRY_STORE === null && typeof loadInquiries === "function") jobs.push(loadInquiries());
    if (typeof ALUMNI_STORE !== "undefined" && ALUMNI_STORE === null && typeof loadAlumni === "function") jobs.push(loadAlumni());
    if (typeof PROGRAM_STORE !== "undefined" && PROGRAM_STORE === null && typeof loadPrograms === "function") jobs.push(loadPrograms());
  } catch (_e) {
  }
  if (jobs.length) Promise.all(jobs).then(() => {
    if (BIQ_CAP) biqRender();
  }).catch(() => {
  });
}
function biqEmptyEdit() {
  return {
    targetKind: "client",
    writeAction: "addCommunication",
    targetId: "",
    targetName: "",
    noteType: "",
    tourFormat: "",
    type: "",
    priority: "",
    date: "",
    tourDate: "",
    dueDate: "",
    body: "",
    subject: "",
    title: "",
    contact: "",
    picking: true
  };
}
function biqCapStart(mode) {
  BIQ_CAP = {
    stage: "input",
    rawText: "",
    error: "",
    source: "text",
    draft: null,
    edit: biqEmptyEdit(),
    extractedTasks: [],
    dateProvenance: "",
    pickIndex: {},
    pickQuery: "",
    savedRefs: [],
    failedTasks: [],
    extractedSaved: 0,
    savedDest: null,
    manualBlock: ""
  };
  BIQ_OPEN = true;
  biqLoadNoteMeta();
  biqCapEnsureStores();
  if (mode === "record") biqCapRecord();
  else biqRender();
}
function biqCapCancel() {
  biqStopTimer();
  try {
    if (BIQ_MREC && BIQ_MREC.state !== "inactive") BIQ_MREC.stop();
  } catch (_e) {
  }
  biqStopStream();
  BIQ_MREC = null;
  BIQ_CAP = null;
  biqRender();
}
function biqCapBackToInput() {
  if (!BIQ_CAP) return;
  BIQ_CAP.error = "";
  BIQ_CAP.stage = "input";
  biqRender();
}
function biqPickMime() {
  const cands = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported) {
    for (const m of cands) {
      try {
        if (MediaRecorder.isTypeSupported(m)) return m;
      } catch (_e) {
      }
    }
  }
  return "";
}
async function biqCapRecord() {
  if (!BIQ_CAP) return;
  const ta = document.getElementById("biq-cap-text");
  if (ta) BIQ_CAP.rawText = ta.value;
  BIQ_CAP.error = "";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    BIQ_MSTREAM = stream;
    BIQ_MCHUNKS = [];
    BIQ_MMIME = biqPickMime();
    const rec = BIQ_MMIME ? new MediaRecorder(stream, { mimeType: BIQ_MMIME }) : new MediaRecorder(stream);
    BIQ_MREC = rec;
    rec.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) BIQ_MCHUNKS.push(ev.data);
    };
    rec.onstop = () => {
      biqCapProcessRecording();
    };
    rec.start();
    BIQ_RSTART = Date.now();
    if (!BIQ_CAP) return;
    BIQ_CAP.stage = "recording";
    biqRender();
    biqStartTimer();
  } catch (err) {
    if (!BIQ_CAP) return;
    BIQ_CAP.error = "Microphone unavailable: " + (err && err.message ? err.message : String(err));
    BIQ_CAP.stage = "input";
    biqRender();
  }
}
function biqStartTimer() {
  biqStopTimer();
  BIQ_RTIMER = setInterval(() => {
    const secs = Math.floor((Date.now() - BIQ_RSTART) / 1e3);
    const el = document.getElementById("biq-rec-timer");
    if (el) el.textContent = biqFmtSecs(secs);
    if (secs >= BIQ_RCAP) biqCapStopRec();
  }, 250);
}
function biqStopTimer() {
  if (BIQ_RTIMER) {
    clearInterval(BIQ_RTIMER);
    BIQ_RTIMER = null;
  }
}
function biqStopStream() {
  if (BIQ_MSTREAM) {
    try {
      BIQ_MSTREAM.getTracks().forEach((t) => t.stop());
    } catch (_e) {
    }
    BIQ_MSTREAM = null;
  }
}
function biqCapStopRec() {
  biqStopTimer();
  try {
    if (BIQ_MREC && BIQ_MREC.state !== "inactive") BIQ_MREC.stop();
  } catch (_e) {
  }
}
function biqBlobToB64(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error || new Error("read error"));
    fr.onload = () => {
      const r = String(fr.result || "");
      const i = r.indexOf(",");
      resolve(i >= 0 ? r.slice(i + 1) : r);
    };
    fr.readAsDataURL(blob);
  });
}
async function biqCapProcessRecording() {
  if (!BIQ_CAP) {
    biqStopStream();
    return;
  }
  const mime = BIQ_MMIME || BIQ_MREC && BIQ_MREC.mimeType || "audio/webm";
  biqStopStream();
  const blob = new Blob(BIQ_MCHUNKS, { type: mime });
  BIQ_MCHUNKS = [];
  if (!blob.size) {
    BIQ_CAP.error = "No audio was captured. Try again.";
    BIQ_CAP.stage = "input";
    biqRender();
    return;
  }
  BIQ_CAP.stage = "transcribing";
  biqRender();
  let b64 = "";
  try {
    b64 = await biqBlobToB64(blob);
  } catch (_e) {
    if (!BIQ_CAP) return;
    BIQ_CAP.error = "Could not read the recording.";
    BIQ_CAP.stage = "input";
    biqRender();
    return;
  }
  try {
    const env = await apiBlueiqTranscribe(b64, mime, biqCapVocab());
    if (!BIQ_CAP) return;
    if (env && env.ok && env.data && typeof env.data.transcript === "string") {
      const tx = env.data.transcript.trim();
      const prior = (BIQ_CAP.rawText || "").trim();
      BIQ_CAP.rawText = prior ? prior + "\n" + tx : tx;
      BIQ_CAP.source = "voice";
      if (!BIQ_CAP.rawText.trim()) {
        BIQ_CAP.error = "I didn't catch anything. Try again, or type your note.";
        BIQ_CAP.stage = "input";
        biqRender();
      } else {
        biqCapCompose();
      }
    } else if (biqCapBlocked(env)) {
      biqCapEnterManual(env && env.error);
    } else {
      BIQ_CAP.error = env && env.error ? env.error : "Transcription failed. Type your note instead, or try again.";
      BIQ_CAP.stage = "input";
      biqRender();
    }
  } catch (err) {
    if (!BIQ_CAP) return;
    BIQ_CAP.error = err && err.message ? err.message : String(err);
    BIQ_CAP.stage = "input";
    biqRender();
  }
}
async function biqCapCompose() {
  if (!BIQ_CAP) return;
  const ta = document.getElementById("biq-cap-text");
  if (ta) BIQ_CAP.rawText = ta.value;
  const raw = (BIQ_CAP.rawText || "").trim();
  if (!raw) {
    BIQ_CAP.error = "Type or dictate a note first.";
    biqRender();
    return;
  }
  BIQ_CAP.error = "";
  BIQ_CAP.stage = "composing";
  biqRender();
  const ctx = biqContext();
  try {
    const env = await apiBlueiqCompose({
      rawText: raw,
      source: BIQ_CAP.source || "text",
      scope: ctx.scope,
      clientId: ctx.clientId || "",
      programId: ctx.programId || "",
      programName: ctx.programName || ""
    });
    if (!BIQ_CAP) return;
    if (env && env.ok && env.data && env.data.draft) {
      biqCapInitDraft(env.data.draft);
      BIQ_CAP.stage = "draft";
      biqRender();
    } else if (biqCapBlocked(env)) {
      biqCapEnterManual(env && env.error);
    } else {
      BIQ_CAP.error = env && env.error ? env.error : "BlueIQ could not read your note. Edit it and try again.";
      BIQ_CAP.stage = "input";
      biqRender();
    }
  } catch (err) {
    if (!BIQ_CAP) return;
    BIQ_CAP.error = err && err.message ? err.message : String(err);
    BIQ_CAP.stage = "input";
    biqRender();
  }
}
function biqCapInitDraft(d) {
  if (!BIQ_CAP) return;
  const cap = BIQ_CAP;
  cap.draft = d;
  const f = d && d.fields || {};
  const tgt = d && d.target || {};
  const kind = d && d.targetKind === "program" ? "program" : "client";
  const wa = d && d.writeAction || (kind === "program" ? "addProgramNote" : "addCommunication");
  let body = "";
  if (wa === "addProgramNote") body = f.body || "";
  else if (wa === "addTask") body = f.details || "";
  else body = f.notes || f.body || "";
  const locked = !d.unfiled && !!tgt.id && tgt.confidence !== "low";
  cap.pickIndex = {};
  cap.pickQuery = "";
  cap.edit = {
    targetKind: kind,
    writeAction: wa,
    targetId: locked ? tgt.id || "" : "",
    targetName: locked ? tgt.name || "" : "",
    noteType: f.noteType || "",
    tourFormat: f.tourFormat || "",
    type: f.type || "",
    priority: f.priority || "",
    date: f.date || f.dueDate || "",
    tourDate: f.tourDate || f.date || "",
    dueDate: f.dueDate || f.date || "",
    body,
    subject: f.subject || "",
    title: f.title || "",
    contact: f.contact || "",
    picking: !locked
  };
  if (tgt.id) cap.pickIndex[tgt.id] = tgt.name || "";
  (tgt.alternatives || []).forEach((a) => {
    if (a && a.id) cap.pickIndex[a.id] = a.name || "";
  });
  cap.dateProvenance = d && d.dateProvenance || "";
  const ex = d && d.extractedTasks || [];
  cap.extractedTasks = ex.map((t) => ({ title: t.title || "", details: t.details || "", dueDate: t.dueDate || "", on: t.defaultOn !== false }));
}
function biqCapEnterManual(blockMsg) {
  if (!BIQ_CAP) return;
  const cap = BIQ_CAP;
  const ctx = biqContext();
  const kind = ctx.programId && !ctx.clientId ? "program" : "client";
  cap.manualBlock = blockMsg || "BlueIQ interpretation is paused (out of monthly credits). You can still file this note manually.";
  cap.pickIndex = {};
  cap.pickQuery = "";
  const tid = kind === "program" ? ctx.programId || "" : ctx.clientId || "";
  const tnm = kind === "program" ? ctx.programName || "" : ctx.clientName || "";
  if (tid) cap.pickIndex[tid] = tnm;
  cap.edit = {
    targetKind: kind,
    writeAction: kind === "program" ? "addProgramNote" : "addCommunication",
    targetId: tid,
    targetName: tnm,
    noteType: "",
    tourFormat: "",
    type: "",
    priority: "",
    date: biqToday(),
    tourDate: biqToday(),
    dueDate: "",
    body: "",
    subject: "",
    title: "",
    contact: "",
    picking: !tid
  };
  cap.stage = "manual";
  biqRender();
}
function biqCapManualKind(kind) {
  if (!BIQ_CAP) return;
  const ta = document.getElementById("biq-m-text");
  if (ta) BIQ_CAP.rawText = ta.value;
  BIQ_CAP.edit.targetKind = kind;
  BIQ_CAP.edit.writeAction = kind === "program" ? "addProgramNote" : "addCommunication";
  BIQ_CAP.edit.targetId = "";
  BIQ_CAP.edit.targetName = "";
  BIQ_CAP.edit.picking = true;
  BIQ_CAP.pickQuery = "";
  biqRender();
}
async function biqCapManualSave() {
  if (!BIQ_CAP) return;
  const cap = BIQ_CAP;
  const ta = document.getElementById("biq-m-text");
  if (ta) cap.rawText = ta.value;
  const ty = document.getElementById("biq-m-type");
  const type = ty ? String(ty.value) : "";
  const e = cap.edit;
  const body = (cap.rawText || "").trim();
  if (!e.targetId) {
    cap.error = "Choose where to file this first.";
    biqRender();
    return;
  }
  if (!body) {
    cap.error = "Write your note first.";
    biqRender();
    return;
  }
  cap.error = "";
  cap.stage = "saving";
  biqRender();
  const refs = [];
  try {
    if (e.targetKind === "program") {
      const created = await apiCaptureAddProgramNote(e.targetId, { cachedName: e.targetName }, { body, noteType: type }, cap.rawText || "");
      refs.push({ kind: "programNote", targetId: e.targetId, entryId: String(created && created.entryId || "") });
    } else {
      const created = await apiCaptureAddCommunication(e.targetId, { notes: body, type, date: biqToday() }, cap.rawText || "");
      refs.push({ kind: "communication", targetId: e.targetId, entryId: String(created && created.entryId || "") });
    }
  } catch (err) {
    cap.error = err && err.message ? err.message : String(err);
    cap.stage = "manual";
    biqRender();
    return;
  }
  cap.savedRefs = refs;
  cap.failedTasks = [];
  cap.extractedSaved = 0;
  cap.savedDest = { kind: e.targetKind, id: e.targetId, name: e.targetName };
  cap.stage = "saved";
  biqRender();
}
function biqCapPickChoose(id) {
  if (!BIQ_CAP) return;
  const nm = BIQ_CAP.pickIndex[id] || id;
  BIQ_CAP.edit.targetId = id;
  BIQ_CAP.edit.targetName = nm;
  BIQ_CAP.edit.picking = false;
  BIQ_CAP.error = "";
  biqRender();
}
function biqCapChangeTarget() {
  if (!BIQ_CAP) return;
  biqCapSync();
  BIQ_CAP.edit.picking = true;
  BIQ_CAP.pickQuery = "";
  biqRender();
}
function biqCapPickFilter() {
  if (!BIQ_CAP) return;
  const inp = document.getElementById("biq-pick-input");
  const q = inp ? inp.value : "";
  BIQ_CAP.pickQuery = q;
  const list = document.getElementById("biq-pick-list");
  if (list) list.innerHTML = biqCapPickListHtml(BIQ_CAP.edit.targetKind, q);
}
function biqCapPickListHtml(kind, q) {
  const cap = BIQ_CAP;
  if (!cap) return "";
  const q2 = (q || "").toLowerCase().trim();
  const items = kind === "program" ? biqCapPrograms() : biqCapClients();
  let list = items;
  if (q2) list = items.filter((x) => x.name.toLowerCase().indexOf(q2) >= 0);
  list = list.slice(0, 30);
  if (!list.length) return '<div class="biq-pick-empty">' + (items.length ? "No matches." : "Loading\u2026") + "</div>";
  return list.map((x) => {
    cap.pickIndex[x.id] = x.name;
    return `<button class="biq-pick-item" onclick="biqCapPickChoose('` + esc(x.id) + `')">` + esc(x.name) + "</button>";
  }).join("");
}
function biqCapPicker(kind) {
  const cap = BIQ_CAP;
  if (!cap) return "";
  const label = kind === "program" ? "program" : "client";
  let chips = "";
  const d = cap.draft;
  if (d && d.target) {
    const seen = {};
    const cand = [];
    if (d.target.id) cand.push({ id: d.target.id, name: d.target.name });
    (d.target.alternatives || []).forEach((a) => cand.push(a));
    cand.forEach((a) => {
      if (a && a.id && !seen[a.id]) {
        seen[a.id] = true;
        cap.pickIndex[a.id] = a.name || "";
        chips += `<button class="biq-alt" onclick="biqCapPickChoose('` + esc(a.id) + `')">` + esc(a.name || a.id) + "</button>";
      }
    });
  }
  return '<div class="biq-pick"><input id="biq-pick-input" class="biq-in biq-pick-input" placeholder="Search ' + label + 's\u2026" value="' + esc(cap.pickQuery || "") + '" oninput="biqCapPickFilter()">' + (chips ? '<div class="biq-alts">' + chips + "</div>" : "") + '<div class="biq-pick-list" id="biq-pick-list">' + biqCapPickListHtml(kind, cap.pickQuery || "") + "</div></div>";
}
function biqCapSync() {
  if (!BIQ_CAP) return;
  const e = BIQ_CAP.edit;
  const v = (id) => {
    const el = document.getElementById(id);
    return el ? String(el.value) : null;
  };
  let x;
  if ((x = v("biq-d-body")) !== null) e.body = x;
  if ((x = v("biq-d-subject")) !== null) e.subject = x;
  if ((x = v("biq-d-title")) !== null) e.title = x;
  if ((x = v("biq-d-contact")) !== null) e.contact = x;
  if ((x = v("biq-d-date")) !== null) e.date = x;
  if ((x = v("biq-d-tourdate")) !== null) e.tourDate = x;
  if ((x = v("biq-d-duedate")) !== null) e.dueDate = x;
  if ((x = v("biq-d-notetype")) !== null) e.noteType = x;
  if ((x = v("biq-d-commtype")) !== null) e.type = x;
  if ((x = v("biq-d-tourformat")) !== null) e.tourFormat = x;
  if ((x = v("biq-d-priority")) !== null) e.priority = x;
  for (let i = 0; i < BIQ_CAP.extractedTasks.length; i++) {
    const cb = document.getElementById("biq-task-" + i);
    if (cb) BIQ_CAP.extractedTasks[i].on = cb.checked;
  }
}
function biqCapNoteTypeChange() {
  if (!BIQ_CAP) return;
  biqCapSync();
  biqRender();
}
async function biqCapSave() {
  if (!BIQ_CAP) return;
  biqCapSync();
  const cap = BIQ_CAP;
  const e = cap.edit;
  if (!e.targetId) {
    cap.error = "Choose where to file this first.";
    biqRender();
    return;
  }
  cap.error = "";
  cap.stage = "saving";
  biqRender();
  const transcript = cap.rawText || "";
  const refs = [];
  try {
    if (e.writeAction === "addProgramNote") {
      const fields = { body: e.body, noteType: e.noteType };
      if (biqIsTour(e.noteType)) {
        if (e.tourDate) fields.tourDate = e.tourDate;
        if (e.tourFormat) fields.tourFormat = e.tourFormat;
      }
      const created = await apiCaptureAddProgramNote(e.targetId, { cachedName: e.targetName }, fields, transcript);
      refs.push({ kind: "programNote", targetId: e.targetId, entryId: String(created && created.entryId || "") });
    } else if (e.writeAction === "addTask") {
      const created = await apiCaptureAddTask(e.targetId, { title: e.title, details: e.body, dueDate: e.dueDate, priority: e.priority }, transcript);
      refs.push({ kind: "task", targetId: e.targetId, entryId: String(created && created.entryId || "") });
    } else {
      const created = await apiCaptureAddCommunication(e.targetId, { notes: e.body, subject: e.subject, type: e.type, date: e.date, contact: e.contact }, transcript);
      refs.push({ kind: "communication", targetId: e.targetId, entryId: String(created && created.entryId || "") });
    }
  } catch (err) {
    cap.error = err && err.message ? err.message : String(err);
    cap.stage = "draft";
    biqRender();
    return;
  }
  let extractedSaved = 0;
  const failed = [];
  if (cap.draft && cap.draft.targetKind === "client" && e.targetKind === "client") {
    for (let i = 0; i < cap.extractedTasks.length; i++) {
      const t = cap.extractedTasks[i];
      if (!t.on) continue;
      try {
        const ct = await apiCaptureAddTask(e.targetId, { title: t.title, details: t.details, dueDate: t.dueDate, priority: "" }, transcript);
        refs.push({ kind: "task", targetId: e.targetId, entryId: String(ct && ct.entryId || "") });
        extractedSaved++;
      } catch (_e) {
        failed.push(t);
      }
    }
  }
  cap.savedRefs = refs;
  cap.failedTasks = failed;
  cap.extractedSaved = extractedSaved;
  cap.savedDest = { kind: e.targetKind, id: e.targetId, name: e.targetName };
  cap.stage = "saved";
  biqRender();
}
async function biqCapRetryTasks() {
  if (!BIQ_CAP || !BIQ_CAP.failedTasks.length) return;
  const cap = BIQ_CAP;
  const dest = cap.savedDest;
  if (!dest) return;
  const pending = cap.failedTasks.slice();
  cap.failedTasks = [];
  biqRender();
  const still = [];
  for (const t of pending) {
    try {
      const ct = await apiCaptureAddTask(dest.id, { title: t.title, details: t.details, dueDate: t.dueDate, priority: "" }, cap.rawText || "");
      cap.savedRefs.push({ kind: "task", targetId: dest.id, entryId: String(ct && ct.entryId || "") });
      cap.extractedSaved++;
    } catch (_e) {
      still.push(t);
    }
  }
  cap.failedTasks = still;
  biqRender();
}
async function biqCapUndo() {
  if (!BIQ_CAP || !BIQ_CAP.savedRefs.length) return;
  const cap = BIQ_CAP;
  const refs = cap.savedRefs.slice();
  cap.stage = "saving";
  biqRender();
  for (const r of refs) {
    if (!r.entryId) continue;
    try {
      if (r.kind === "programNote") await apiDeleteProgramNote(r.targetId, r.entryId);
      else if (r.kind === "communication") await apiDeleteCommunication(r.targetId, r.entryId);
      else if (r.kind === "task") await apiDeleteTask(r.targetId, r.entryId);
    } catch (_e) {
    }
  }
  if (typeof toast === "function") toast("Undone \u2014 nothing was saved.");
  cap.savedRefs = [];
  cap.failedTasks = [];
  cap.error = "";
  cap.stage = "input";
  biqRender();
}
function biqCapErr() {
  return BIQ_CAP && BIQ_CAP.error ? '<div class="biq-cap-error">' + ic("alert", 14) + "<span>" + esc(BIQ_CAP.error) + "</span></div>" : "";
}
function biqCapBusy(label) {
  return '<div class="biq-cap-busy"><div class="biq-spin"></div><p>' + esc(label) + "</p></div>";
}
function biqCapRow(label, inner) {
  return '<div class="biq-frow"><label class="biq-flbl">' + esc(label) + '</label><div class="biq-fctl">' + inner + "</div></div>";
}
function biqCapField(id, opts, cur, onchange) {
  if (!opts || !opts.length) {
    return '<input id="' + id + '" class="biq-in" value="' + esc(cur) + '"' + (onchange ? ' oninput="' + onchange + '"' : "") + ">";
  }
  let o = '<option value=""></option>';
  let has = false;
  opts.forEach((v) => {
    if (v === cur) has = true;
    o += '<option value="' + esc(v) + '"' + (v === cur ? " selected" : "") + ">" + esc(v) + "</option>";
  });
  if (cur && !has) o += '<option value="' + esc(cur) + '" selected>' + esc(cur) + "</option>";
  return '<select id="' + id + '" class="biq-in"' + (onchange ? ' onchange="' + onchange + '"' : "") + ">" + o + "</select>";
}
function biqCapDestPrefix() {
  if (!BIQ_CAP) return "Note";
  const e = BIQ_CAP.edit;
  if (e.writeAction === "addProgramNote") return e.noteType ? e.noteType + " note" : "Program note";
  if (e.writeAction === "addTask") return "Task";
  return e.type ? e.type : "Communication";
}
function biqCapInputHtml() {
  const cap = BIQ_CAP;
  if (!cap) return "";
  return biqCapErr() + '<textarea id="biq-cap-text" class="biq-in biq-ta biq-cap-text" rows="6">' + esc(cap.rawText || "") + '</textarea><div class="biq-cap-btns"><button class="biq-btn biq-btn-mic" onclick="biqCapRecord()">' + biqMic(16) + ' Dictate</button><button class="biq-btn biq-btn-primary" onclick="biqCapCompose()">Create draft ' + ic("chevR", 15) + "</button></div>";
}
function biqCapRecHtml() {
  return '<div class="biq-rec"><div class="biq-rec-dot"></div><div class="biq-rec-timer" id="biq-rec-timer">0:00</div><p class="biq-rec-hint">Listening\u2026</p><button class="biq-btn biq-btn-stop" onclick="biqCapStopRec()">Stop &amp; transcribe</button></div>';
}
function biqCapDraftHtml() {
  const cap = BIQ_CAP;
  if (!cap) return "";
  const e = cap.edit;
  const d = cap.draft || {};
  const kind = e.targetKind;
  let dest;
  if (e.picking) {
    dest = '<div class="biq-dest-block"><div class="biq-dest-lbl">File this to a ' + (kind === "program" ? "program" : "client") + ":</div>" + biqCapPicker(kind) + "</div>";
  } else {
    const conf = d.target && d.target.confidence || "";
    const confHint = conf ? '<span class="biq-conf biq-conf-' + esc(conf) + '">' + esc(conf) + " match</span>" : "";
    dest = '<div class="biq-dest"><div class="biq-dest-main">' + biqKindIcon(kind) + " <b>" + esc(biqCapDestPrefix()) + '</b> \u2192 <span class="biq-dest-name">' + esc(e.targetName || "\u2014") + "</span> " + confHint + '</div><button class="biq-change" onclick="biqCapChangeTarget()">change</button></div>';
  }
  const prov = cap.dateProvenance ? '<span class="biq-prov">' + esc(cap.dateProvenance) + "</span>" : "";
  let fields = "";
  if (e.writeAction === "addProgramNote") {
    fields += biqCapRow("Note type", biqCapField("biq-d-notetype", PROGRAM_NOTE_TYPES, e.noteType, "biqCapNoteTypeChange()"));
    if (biqIsTour(e.noteType)) {
      fields += biqCapRow("Tour date", '<input type="date" id="biq-d-tourdate" class="biq-in" value="' + esc(e.tourDate) + '">' + prov);
      fields += biqCapRow("Tour format", biqCapField("biq-d-tourformat", TOUR_FORMATS, e.tourFormat, ""));
    }
    fields += biqCapRow("Note", '<textarea id="biq-d-body" class="biq-in biq-ta" rows="5">' + esc(e.body) + "</textarea>");
  } else if (e.writeAction === "addTask") {
    fields += biqCapRow("Title", '<input id="biq-d-title" class="biq-in" value="' + esc(e.title) + '">');
    fields += biqCapRow("Priority", biqCapField("biq-d-priority", TASK_PRIORITIES, e.priority, ""));
    fields += biqCapRow("Due date", '<input type="date" id="biq-d-duedate" class="biq-in" value="' + esc(e.dueDate) + '">' + prov);
    fields += biqCapRow("Details", '<textarea id="biq-d-body" class="biq-in biq-ta" rows="5">' + esc(e.body) + "</textarea>");
  } else {
    fields += biqCapRow("Channel", biqCapField("biq-d-commtype", COMM_TYPES, e.type, ""));
    fields += biqCapRow("Summary", '<input id="biq-d-subject" class="biq-in" value="' + esc(e.subject) + '">');
    fields += biqCapRow("Spoke with", '<input id="biq-d-contact" class="biq-in" value="' + esc(e.contact) + '">');
    fields += biqCapRow("Date", '<input type="date" id="biq-d-date" class="biq-in" value="' + esc(e.date) + '">' + prov);
    fields += biqCapRow("Note", '<textarea id="biq-d-body" class="biq-in biq-ta" rows="5">' + esc(e.body) + "</textarea>");
  }
  let tasks = "";
  if (cap.extractedTasks.length) {
    if (e.targetKind === "client") {
      let rows = "";
      for (let i = 0; i < cap.extractedTasks.length; i++) {
        const t = cap.extractedTasks[i];
        rows += '<label class="biq-task"><input type="checkbox" id="biq-task-' + i + '"' + (t.on ? " checked" : "") + "><span>" + esc(t.title) + (t.dueDate ? " <em>" + esc(t.dueDate) + "</em>" : "") + "</span></label>";
      }
      tasks = '<div class="biq-tasks"><div class="biq-tasks-h">Follow-up tasks</div>' + rows + "</div>";
    } else {
      let rows = "";
      cap.extractedTasks.forEach((t) => {
        rows += '<div class="biq-task biq-task-ro"><span>' + esc(t.title) + (t.dueDate ? " <em>" + esc(t.dueDate) + "</em>" : "") + "</span></div>";
      });
      tasks = '<div class="biq-tasks"><div class="biq-tasks-h">Follow-up tasks</div><p class="biq-note">Pick a client to file these.</p>' + rows + "</div>";
    }
  }
  const saveLbl = "Save to " + (e.targetName || "\u2026");
  const btns = '<div class="biq-cap-btns"><button class="biq-btn biq-btn-primary"' + (e.targetId ? "" : " disabled") + ' onclick="biqCapSave()">' + ic("check", 15) + " " + esc(saveLbl) + '</button><button class="biq-btn biq-btn-ghost" onclick="biqCapBackToInput()">Cancel</button></div>';
  return biqCapErr() + dest + '<div class="biq-fields">' + fields + "</div>" + tasks + btns;
}
function biqCapManualHtml() {
  const cap = BIQ_CAP;
  if (!cap) return "";
  const e = cap.edit;
  const banner = '<div class="biq-cap-banner">' + ic("info", 14) + "<span>" + esc(cap.manualBlock || "") + "</span></div>";
  const kindToggle = '<div class="biq-kindtoggle"><button class="biq-kindbtn' + (e.targetKind === "client" ? " active" : "") + `" onclick="biqCapManualKind('client')">Client</button><button class="biq-kindbtn` + (e.targetKind === "program" ? " active" : "") + `" onclick="biqCapManualKind('program')">Program</button></div>`;
  const dest = e.picking ? '<div class="biq-dest-block"><div class="biq-dest-lbl">File to a ' + (e.targetKind === "program" ? "program" : "client") + ":</div>" + biqCapPicker(e.targetKind) + "</div>" : '<div class="biq-dest"><div class="biq-dest-main">' + biqKindIcon(e.targetKind) + ' <span class="biq-dest-name">' + esc(e.targetName || "\u2014") + '</span></div><button class="biq-change" onclick="biqCapChangeTarget()">change</button></div>';
  const typeOpts = e.targetKind === "program" ? PROGRAM_NOTE_TYPES : COMM_TYPES;
  const typeRow = biqCapRow(e.targetKind === "program" ? "Note type" : "Channel", biqCapField("biq-m-type", typeOpts, "", ""));
  const textRow = biqCapRow("Note", '<textarea id="biq-m-text" class="biq-in biq-ta" rows="6">' + esc(cap.rawText || "") + "</textarea>");
  const saveLbl = "Save to " + (e.targetName || "\u2026");
  const btns = '<div class="biq-cap-btns"><button class="biq-btn biq-btn-primary"' + (e.targetId ? "" : " disabled") + ' onclick="biqCapManualSave()">' + ic("check", 15) + " " + esc(saveLbl) + '</button><button class="biq-btn biq-btn-ghost" onclick="biqCapCancel()">Cancel</button></div>';
  return banner + biqCapErr() + kindToggle + dest + '<div class="biq-fields">' + typeRow + textRow + "</div>" + btns;
}
function biqCapSavedHtml() {
  const cap = BIQ_CAP;
  if (!cap || !cap.savedDest) return "";
  const dest = cap.savedDest;
  const link = dest.kind === "client" ? "#/clients/" + encodeURIComponent(dest.id) : "#/programs/" + encodeURIComponent(dest.id);
  const fail = cap.failedTasks.length ? '<div class="biq-cap-warn">' + ic("alert", 14) + "<span>Note saved. " + cap.failedTasks.length + " task" + (cap.failedTasks.length === 1 ? "" : "s") + ' failed \u2014 <button class="biq-linkbtn" onclick="biqCapRetryTasks()">retry</button></span></div>' : "";
  const extra = cap.extractedSaved ? '<div class="biq-saved-sub">+ ' + cap.extractedSaved + " follow-up task" + (cap.extractedSaved === 1 ? "" : "s") + " created</div>" : "";
  return '<div class="biq-saved"><div class="biq-saved-ico">' + ic("check", 34) + '</div><div class="biq-saved-msg">Saved to <b>' + esc(dest.name) + "</b></div>" + extra + fail + '<div class="biq-cap-btns"><a class="biq-btn biq-btn-primary" href="' + link + '" onclick="biqCapCancel()">' + ic("external", 15) + " Open " + esc(dest.name) + `</a><button class="biq-btn biq-btn-ghost" onclick="biqCapUndo()">Undo</button></div><div class="biq-cap-btns2"><button class="biq-linkbtn" onclick="biqCapStart('input')">Capture another</button><button class="biq-linkbtn" onclick="biqCapCancel()">Done</button></div></div>`;
}
function biqCapHtml() {
  const cap = BIQ_CAP;
  if (!cap) return "";
  let inner;
  switch (cap.stage) {
    case "recording":
      inner = biqCapRecHtml();
      break;
    case "transcribing":
      inner = biqCapBusy("Transcribing\u2026");
      break;
    case "composing":
      inner = biqCapBusy("Reading your note\u2026");
      break;
    case "draft":
      inner = biqCapDraftHtml();
      break;
    case "saving":
      inner = biqCapBusy("Saving\u2026");
      break;
    case "saved":
      inner = biqCapSavedHtml();
      break;
    case "manual":
      inner = biqCapManualHtml();
      break;
    default:
      inner = biqCapInputHtml();
  }
  const head = '<div class="biq-cap-head"><button class="biq-cap-back" title="Back to chat" aria-label="Back to chat" onclick="biqCapCancel()">' + ic("chevL", 16) + '</button><span class="biq-cap-title"><span class="biq-shimmer">Capture</span>&nbsp;a note</span></div>';
  return '<div class="biq-cap">' + head + inner + "</div>";
}
async function biqInit() {
  if (document.getElementById("__biq-root")) return;
  let show = true;
  try {
    const status = await apiBlueiqStatus();
    if (status && status.enabled === false) show = false;
  } catch (_e) {
    show = true;
  }
  if (!show) return;
  if (document.getElementById("__biq-root")) return;
  const root = document.createElement("div");
  root.id = "__biq-root";
  document.body.appendChild(root);
  biqRender();
  window.addEventListener("hashchange", () => {
    BIQ_FORCE_GLOBAL = false;
    if (BIQ_OPEN) biqRender();
  });
}
if (document.readyState !== "loading") biqInit();
else document.addEventListener("DOMContentLoaded", biqInit);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiY2hhdGJvdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICBjaGF0Ym90LnRzIFx1MjAxNCBCbHVlSVEgZmxvYXRpbmcgYXNzaXN0YW50LlxuXG4gICBBIGxhdW5jaGVyIGJ1YmJsZSAoYm90dG9tLXJpZ2h0KSB0aGF0IGV4cGFuZHMgaW50byBhIHJpZ2h0LWRvY2tlZCBwYW5lbCxcbiAgIHByZXNlbnQgb24gRVZFUlkgcGFnZS4gQ29udGV4dC1hd2FyZTogb24gYSBjbGllbnQgcmVjb3JkIGl0IHNjb3BlcyB0byB0aGF0XG4gICBjbGllbnQ7IGVsc2V3aGVyZSBpdCBhc2tzIGNhc2Vsb2FkLXdpZGUuIENvbnZlcnNhdGlvbnMgYXJlIGVwaGVtZXJhbFxuICAgKGluLW1lbW9yeSBvbmx5IFx1MjAxNCBubyBwZXJzaXN0ZW5jZSkuIFRhbGtzIHRvIC9iL2JsdWVpcSB2aWEgYXBpLnRzLlxuXG4gICBNb3VudGVkIGluICNfX2JpcS1yb290IG9uIDxib2R5PiwgTk9UIGluc2lkZSAjYXBwIFx1MjAxNCBtYWluLnRzJ3MgcmVuZGVyKClcbiAgIHdpcGVzICNhcHAgb24gZXZlcnkgcm91dGUgY2hhbmdlLCBzbyB0aGUgYnViYmxlIG11c3QgbGl2ZSBvdXRzaWRlIGl0LlxuXG4gICBCcmFuZCBpcyBcIkJsdWVJUVwiOyBuZXZlciBzdXJmYWNlIHRoZSB3b3JkIFwiQUlcIiBpbiBVSSBjb3B5LlxuICAgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG5cbmludGVyZmFjZSBCaXFNc2cge1xuICByb2xlOiAndXNlcicgfCAnYXNzaXN0YW50JztcbiAgY29udGVudDogc3RyaW5nO1xuICBlcnJvcj86IGJvb2xlYW47XG59XG5cbmxldCBCSVFfT1BFTiA9IGZhbHNlO1xubGV0IEJJUV9CVVNZID0gZmFsc2U7XG5sZXQgQklRX0ZPUkNFX0dMT0JBTCA9IGZhbHNlOyAgICAgICAvLyB1c2VyIGJyb2FkZW5lZCB0byBhbGwtY2xpZW50cy9hbGwtcHJvZ3JhbXMgd2hpbGUgb24gYSByZWNvcmRcbmxldCBCSVFfTVNHUzogQmlxTXNnW10gPSBbXTtcblxuLy8gTG9vayB1cCBhIHByb2dyYW0ncyBkaXNwbGF5IG5hbWUgZnJvbSB3aGF0ZXZlcidzIGFscmVhZHkgbG9hZGVkICh0aGUgb3BlblxuLy8gZGV0YWlsIHJlY29yZCwgZWxzZSB0aGUgZGlyZWN0b3J5IHN0b3JlKS4gRW1wdHkgc3RyaW5nIGlmIG5vdCBmb3VuZCB5ZXQuXG5mdW5jdGlvbiBiaXFQcm9ncmFtTmFtZShpZDogc3RyaW5nKTogc3RyaW5nIHtcbiAgdHJ5IHtcbiAgICBpZiAodHlwZW9mIFBST0dSQU1fREVUQUlMICE9PSAndW5kZWZpbmVkJyAmJiBQUk9HUkFNX0RFVEFJTFtpZF0gJiYgUFJPR1JBTV9ERVRBSUxbaWRdLnByb2dyYW1OYW1lKSByZXR1cm4gUFJPR1JBTV9ERVRBSUxbaWRdLnByb2dyYW1OYW1lO1xuICAgIGlmICh0eXBlb2YgUFJPR1JBTV9TVE9SRSAhPT0gJ3VuZGVmaW5lZCcgJiYgUFJPR1JBTV9TVE9SRSkge1xuICAgICAgZm9yIChjb25zdCBwIG9mIFBST0dSQU1fU1RPUkUpIGlmIChwLmlkID09PSBpZCkgcmV0dXJuIHAucHJvZ3JhbU5hbWUgfHwgJyc7XG4gICAgfVxuICB9IGNhdGNoIChfZSkgeyAvKiBub3QgbG9hZGVkIHlldCAqLyB9XG4gIHJldHVybiAnJztcbn1cblxuLy8gRGVyaXZlIGNvbnRleHQgZnJvbSB0aGUgaGFzaCByb3V0ZSAocmVhZCBsaXZlIGVhY2ggdGltZTsgdGhlIGJ1YmJsZSBsaXZlc1xuLy8gb3V0c2lkZSB0aGUgcmVuZGVyIGZsb3cpLiBgZm9jdXNgID0gd2hhdCBhIGJhcmUgcXVlc3Rpb24gZGVmYXVsdHMgdG86XG4vLyAgICdjbGllbnQnICBcdTIxOTIgYSBjbGllbnQgcmVjb3JkIChzZXJ2ZXItYm91bmQgY2xpZW50SWQsIGNsaWVudCB0b29scylcbi8vICAgJ3Byb2dyYW0nIFx1MjE5MiBhIHByb2dyYW0gcmVjb3JkIChnbG9iYWwgc2NvcGUgKyBhIHByb2dyYW0gZm9jdXMgaGludClcbi8vICAgJ25vbmUnICAgIFx1MjE5MiBhIGxpc3QvZGFzaGJvYXJkIChnbG9iYWw7IGxhYmVsIHJlZmxlY3RzIGNsaWVudHMgdnMgcHJvZ3JhbXMpXG5mdW5jdGlvbiBiaXFDb250ZXh0KCk6IHsgcGFnZTogc3RyaW5nOyBzY29wZTogJ2NsaWVudCcgfCAnZ2xvYmFsJzsgY2xpZW50SWQ6IHN0cmluZzsgY2xpZW50TmFtZTogc3RyaW5nOyBwcm9ncmFtSWQ6IHN0cmluZzsgcHJvZ3JhbU5hbWU6IHN0cmluZzsgZm9jdXM6ICdjbGllbnQnIHwgJ3Byb2dyYW0nIHwgJ25vbmUnOyBwcm9ncmFtRmlsdGVyOiBhbnkgfSB7XG4gIGNvbnN0IGhhc2ggPSBsb2NhdGlvbi5oYXNoLnJlcGxhY2UoL14jLywgJycpIHx8ICcvZGFzaGJvYXJkJztcbiAgY29uc3QgcGFydHMgPSBoYXNoLnNwbGl0KCcvJykuZmlsdGVyKEJvb2xlYW4pO1xuICBjb25zdCBwYWdlID0gcGFydHNbMF0gfHwgJ2Rhc2hib2FyZCc7XG4gIGxldCBjbGllbnRJZCA9ICcnLCBjbGllbnROYW1lID0gJycsIHByb2dyYW1JZCA9ICcnLCBwcm9ncmFtTmFtZSA9ICcnO1xuICBpZiAocGFnZSA9PT0gJ2NsaWVudHMnICYmIHBhcnRzWzFdKSB7XG4gICAgY2xpZW50SWQgPSBkZWNvZGVVUklDb21wb25lbnQocGFydHNbMV0pO1xuICAgIGNvbnN0IGMgPSAodHlwZW9mIGZpbmRDbGllbnQgPT09ICdmdW5jdGlvbicpID8gZmluZENsaWVudChjbGllbnRJZCkgOiB1bmRlZmluZWQ7XG4gICAgaWYgKGMpIGNsaWVudE5hbWUgPSAoKGMuZmlyc3QgfHwgJycpICsgJyAnICsgKGMubGFzdCB8fCAnJykpLnRyaW0oKTtcbiAgfSBlbHNlIGlmIChwYWdlID09PSAncHJvZ3JhbXMnICYmIHBhcnRzWzFdKSB7XG4gICAgcHJvZ3JhbUlkID0gZGVjb2RlVVJJQ29tcG9uZW50KHBhcnRzWzFdKTtcbiAgICBwcm9ncmFtTmFtZSA9IGJpcVByb2dyYW1OYW1lKHByb2dyYW1JZCk7XG4gIH1cbiAgLy8gQSBjbGllbnQgcmVjb3JkIGJpbmRzIHNlcnZlci1zaWRlIChzY29wZSAnY2xpZW50Jyk7IGEgcHJvZ3JhbSByZWNvcmQgc3RheXNcbiAgLy8gJ2dsb2JhbCcgKHByb2dyYW0gdG9vbHMgdGFrZSBhbiBpZCkgYnV0IGNhcnJpZXMgYSBmb2N1cyBoaW50LlxuICBjb25zdCBzY29wZTogJ2NsaWVudCcgfCAnZ2xvYmFsJyA9IChjbGllbnRJZCAmJiAhQklRX0ZPUkNFX0dMT0JBTCkgPyAnY2xpZW50JyA6ICdnbG9iYWwnO1xuICBsZXQgZm9jdXM6ICdjbGllbnQnIHwgJ3Byb2dyYW0nIHwgJ25vbmUnID0gJ25vbmUnO1xuICBpZiAoY2xpZW50SWQgJiYgIUJJUV9GT1JDRV9HTE9CQUwpIGZvY3VzID0gJ2NsaWVudCc7XG4gIGVsc2UgaWYgKHByb2dyYW1JZCAmJiAhQklRX0ZPUkNFX0dMT0JBTCkgZm9jdXMgPSAncHJvZ3JhbSc7XG4gIC8vIE9uIHRoZSBwcm9ncmFtcyBMSVNUIChub3QgYSBzcGVjaWZpYyBwcm9ncmFtKSwgcGFzcyB0aGUgY29uc3VsdGFudCdzIGFjdGl2ZVxuICAvLyBmaWx0ZXJzIHNvIEJsdWVJUSBjYW4gYW5zd2VyIGFib3V0IGp1c3QgdGhlIHNob3J0bGlzdCB0aGV5J3JlIGxvb2tpbmcgYXQuXG4gIGNvbnN0IHByb2dyYW1GaWx0ZXIgPSAocGFnZSA9PT0gJ3Byb2dyYW1zJyAmJiAhcHJvZ3JhbUlkICYmIHR5cGVvZiBwcm9nQmlxUGF5bG9hZCA9PT0gJ2Z1bmN0aW9uJykgPyBwcm9nQmlxUGF5bG9hZCgpIDogbnVsbDtcbiAgcmV0dXJuIHsgcGFnZSwgc2NvcGUsIGNsaWVudElkLCBjbGllbnROYW1lLCBwcm9ncmFtSWQsIHByb2dyYW1OYW1lLCBmb2N1cywgcHJvZ3JhbUZpbHRlciB9O1xufVxuXG4vLyAtLS0tIG1pbmltYWwgbWFya2Rvd24gXHUyMTkyIHNhZmUgSFRNTCAoaGVhZGVycywgYm9sZC9pdGFsaWMvY29kZSwgbGlua3MsIGxpc3RzKSAtLS0tXG5mdW5jdGlvbiBiaXFNZChzcmM6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IGlubGluZSA9ICh0OiBzdHJpbmcpOiBzdHJpbmcgPT4ge1xuICAgIGxldCBzID0gZXNjKHQpO1xuICAgIHMgPSBzLnJlcGxhY2UoL1xcKlxcKihbXipdKylcXCpcXCovZywgJzxzdHJvbmc+JDE8L3N0cm9uZz4nKTtcbiAgICBzID0gcy5yZXBsYWNlKC9cXCooW14qXSspXFwqL2csICc8ZW0+JDE8L2VtPicpO1xuICAgIHMgPSBzLnJlcGxhY2UoL2AoW15gXSspYC9nLCAnPGNvZGU+JDE8L2NvZGU+Jyk7XG4gICAgcyA9IHMucmVwbGFjZSgvXFxbKFteXFxdXSspXFxdXFwoKFteKVxcc10rKVxcKS9nLCAoX206IHN0cmluZywgbGFiZWw6IHN0cmluZywgdXJsOiBzdHJpbmcpID0+IHtcbiAgICAgIGNvbnN0IGlzSGFzaCA9IHVybC5jaGFyQXQoMCkgPT09ICcjJztcbiAgICAgIGNvbnN0IGF0dHJzID0gaXNIYXNoID8gJycgOiAnIHRhcmdldD1cIl9ibGFua1wiIHJlbD1cIm5vb3BlbmVyXCInO1xuICAgICAgcmV0dXJuICc8YSBocmVmPVwiJyArIHVybCArICdcIicgKyBhdHRycyArICc+JyArIGxhYmVsICsgJzwvYT4nO1xuICAgIH0pO1xuICAgIHJldHVybiBzO1xuICB9O1xuICBjb25zdCBsaW5lcyA9IFN0cmluZyhzcmMgPT0gbnVsbCA/ICcnIDogc3JjKS5zcGxpdCgnXFxuJyk7XG4gIGxldCBodG1sID0gJyc7XG4gIGxldCBpbkxpc3QgPSBmYWxzZTtcbiAgY29uc3QgY2xvc2VMaXN0ID0gKCkgPT4geyBpZiAoaW5MaXN0KSB7IGh0bWwgKz0gJzwvdWw+JzsgaW5MaXN0ID0gZmFsc2U7IH0gfTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IHQgPSBsaW5lc1tpXS50cmltKCk7XG4gICAgaWYgKCF0KSB7IGNsb3NlTGlzdCgpOyBjb250aW51ZTsgfVxuICAgIGxldCBtOiBSZWdFeHBNYXRjaEFycmF5IHwgbnVsbDtcbiAgICBpZiAoKG0gPSB0Lm1hdGNoKC9eI3sxLDN9XFxzKyguKikvKSkpIHsgY2xvc2VMaXN0KCk7IGh0bWwgKz0gJzxoND4nICsgaW5saW5lKG1bMV0pICsgJzwvaDQ+JzsgY29udGludWU7IH1cbiAgICBpZiAoKG0gPSB0Lm1hdGNoKC9eWy0qXVxccysoLiopLykpKSB7IGlmICghaW5MaXN0KSB7IGh0bWwgKz0gJzx1bD4nOyBpbkxpc3QgPSB0cnVlOyB9IGh0bWwgKz0gJzxsaT4nICsgaW5saW5lKG1bMV0pICsgJzwvbGk+JzsgY29udGludWU7IH1cbiAgICBjbG9zZUxpc3QoKTtcbiAgICBodG1sICs9ICc8cD4nICsgaW5saW5lKHQpICsgJzwvcD4nO1xuICB9XG4gIGNsb3NlTGlzdCgpO1xuICByZXR1cm4gaHRtbDtcbn1cblxuLy8gLS0tLSByZW5kZXIgLS0tLVxuZnVuY3Rpb24gYmlxVGhyZWFkSHRtbChjdHg6IHsgZm9jdXM6ICdjbGllbnQnIHwgJ3Byb2dyYW0nIHwgJ25vbmUnOyBwYWdlOiBzdHJpbmc7IGNsaWVudE5hbWU6IHN0cmluZzsgcHJvZ3JhbU5hbWU6IHN0cmluZzsgcHJvZ3JhbUZpbHRlcjogYW55IH0pOiBzdHJpbmcge1xuICBpZiAoIUJJUV9NU0dTLmxlbmd0aCAmJiAhQklRX0JVU1kpIHtcbiAgICBsZXQgd2hvOiBzdHJpbmc7XG4gICAgbGV0IGV4YW1wbGVzOiBzdHJpbmdbXTtcbiAgICBpZiAoY3R4LmZvY3VzID09PSAnY2xpZW50Jykge1xuICAgICAgd2hvID0gJ0FzayBtZSBhbnl0aGluZyBhYm91dCA8Yj4nICsgZXNjKGN0eC5jbGllbnROYW1lIHx8ICd0aGlzIGNsaWVudCcpICsgJzwvYj4gXHUyMDE0IHRoZWlyIHByb2ZpbGUsIGNvbnRhY3RzLCBvciB3aGF0IHRoZWlyIGZpbGVzIHNheS4nO1xuICAgICAgZXhhbXBsZXMgPSBbJ1N1bW1hcml6ZSB0aGlzIGNsaWVudCcsICdXaG8gYXJlIHRoZSBjb250YWN0cz8nLCAnV2hhdCBkbyB0aGUgZmlsZXMgc2F5IGFib3V0IHRoZWlyIGhpc3Rvcnk/J107XG4gICAgfSBlbHNlIGlmIChjdHguZm9jdXMgPT09ICdwcm9ncmFtJykge1xuICAgICAgd2hvID0gJ0FzayBtZSBhbnl0aGluZyBhYm91dCA8Yj4nICsgZXNjKGN0eC5wcm9ncmFtTmFtZSB8fCAndGhpcyBwcm9ncmFtJykgKyAnPC9iPiBcdTIwMTQgaXRzIHByb2ZpbGUsIG15IHJhdGluZyBhbmQgbm90ZXMsIG9yIHRoZSBmaWxlcyBJXHUyMDE5dmUgc2F2ZWQuJztcbiAgICAgIGV4YW1wbGVzID0gWydTdW1tYXJpemUgdGhpcyBwcm9ncmFtJywgJ1doYXQgZGlkIEkgcmF0ZSB0aGlzIGFuZCB3aHk/JywgJ1doYXQgYXJlIG15IG5vdGVzIGZyb20gdGhlIHRvdXI/J107XG4gICAgfSBlbHNlIGlmIChjdHgucGFnZSA9PT0gJ3Byb2dyYW1zJyAmJiBjdHgucHJvZ3JhbUZpbHRlciAmJiBjdHgucHJvZ3JhbUZpbHRlci5hY3RpdmUpIHtcbiAgICAgIGNvbnN0IG4gPSBjdHgucHJvZ3JhbUZpbHRlci5jb3VudDtcbiAgICAgIHdobyA9ICdBc2sgbWUgYWJvdXQgdGhlIDxiPicgKyBuICsgJyBwcm9ncmFtJyArIChuID09PSAxID8gJycgOiAncycpICsgJzwvYj4gbWF0Y2hpbmcgeW91ciBmaWx0ZXJzIFx1MjAxNCBjb21wYXJlLCByYW5rLCBvciBmaW5kIHRoZSBiZXN0IGZpdCBhbW9uZyB0aGVtLic7XG4gICAgICBleGFtcGxlcyA9IFsnQ29tcGFyZSB0aGVzZSBvbiBsZW5ndGggb2Ygc3RheSBhbmQgY29zdCcsICdXaGljaCBvZiB0aGVzZSBiZXN0IGZpdCBhIDE1LXllYXItb2xkIHdpdGggdHJhdW1hPycsICdXaGljaCB0YWtlIGluc3VyYW5jZT8nXTtcbiAgICB9IGVsc2UgaWYgKGN0eC5wYWdlID09PSAncHJvZ3JhbXMnKSB7XG4gICAgICB3aG8gPSAnQXNrIG1lIGFib3V0IHRoZSBwcm9ncmFtIGRpcmVjdG9yeSBcdTIwMTQgc2VhcmNoIGl0LCBvciBkaWcgaW50byB0aGUgcHJvZ3JhbXMgeW91XHUyMDE5dmUgcmF0ZWQgYW5kIG5vdGVkLic7XG4gICAgICBleGFtcGxlcyA9IFsnV2hpY2ggcHJvZ3JhbXMgaGF2ZSBJIHJhdGVkIDUgc3RhcnM/JywgJ015IGhpZ2hseS1yYXRlZCBwcm9ncmFtcyB0aGF0IHRyZWF0IE9DRCcsICdGaW5kIHdpbGRlcm5lc3MgcHJvZ3JhbXMgaW4gVXRhaCddO1xuICAgIH0gZWxzZSB7XG4gICAgICB3aG8gPSAnQXNrIG1lIGFib3V0IHlvdXIgY2FzZWxvYWQgXHUyMDE0IGZpbmQgY2xpZW50cywgY29tcGFyZSB0aGVtLCBvciBkaWcgaW50byBhbnkgY2xpZW50XHUyMDE5cyBmaWxlcy4nO1xuICAgICAgZXhhbXBsZXMgPSBbJ0hvdyBtYW55IGNsaWVudHMgZG8gSSBoYXZlPycsICdXaGljaCBjbGllbnRzIGhhdmUgbm8gY29udGFjdHMgeWV0PycsICdGaW5kIGNsaWVudHMgbmFtZWQgSm9yZGFuJ107XG4gICAgfVxuICAgIHJldHVybiAnPGRpdiBjbGFzcz1cImJpcS1lbXB0eVwiPicgKyBpYygnc3BhcmtsZScsIDI2KSArICc8cD4nICsgd2hvICsgJzwvcD4nXG4gICAgICArICc8ZGl2IGNsYXNzPVwiYmlxLWV4YW1wbGVzXCI+JyArIGV4YW1wbGVzLm1hcChlID0+ICc8YnV0dG9uIGNsYXNzPVwiYmlxLWVnXCIgb25jbGljaz1cImJpcUFzayh0aGlzKVwiPicgKyBlc2MoZSkgKyAnPC9idXR0b24+Jykuam9pbignJykgKyAnPC9kaXY+PC9kaXY+JztcbiAgfVxuICBsZXQgaHRtbCA9ICcnO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IEJJUV9NU0dTLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgbSA9IEJJUV9NU0dTW2ldO1xuICAgIGlmIChtLnJvbGUgPT09ICd1c2VyJykge1xuICAgICAgaHRtbCArPSAnPGRpdiBjbGFzcz1cImJpcS1tc2cgYmlxLXVzZXJcIj48ZGl2IGNsYXNzPVwiYmlxLWJ1YmJsZVwiPicgKyBlc2MobS5jb250ZW50KS5yZXBsYWNlKC9cXG4vZywgJzxicj4nKSArICc8L2Rpdj48L2Rpdj4nO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBib2R5ID0gbS5lcnJvclxuICAgICAgICA/ICc8ZGl2IGNsYXNzPVwiYmlxLWJ1YmJsZSBiaXEtZXJyXCI+JyArIGljKCdhbGVydCcsIDE1KSArICc8c3Bhbj4nICsgZXNjKG0uY29udGVudCkgKyAnPC9zcGFuPjwvZGl2PidcbiAgICAgICAgOiAnPGRpdiBjbGFzcz1cImJpcS1idWJibGVcIj4nICsgYmlxTWQobS5jb250ZW50KSArICc8L2Rpdj4nO1xuICAgICAgaHRtbCArPSAnPGRpdiBjbGFzcz1cImJpcS1tc2cgYmlxLWJvdFwiPicgKyBib2R5ICsgJzwvZGl2Pic7XG4gICAgfVxuICB9XG4gIGlmIChCSVFfQlVTWSkge1xuICAgIGh0bWwgKz0gJzxkaXYgY2xhc3M9XCJiaXEtbXNnIGJpcS1ib3RcIj48ZGl2IGNsYXNzPVwiYmlxLWJ1YmJsZSBiaXEtdGhpbmtpbmdcIj48c3Bhbj48L3NwYW4+PHNwYW4+PC9zcGFuPjxzcGFuPjwvc3Bhbj48L2Rpdj48L2Rpdj4nO1xuICB9XG4gIHJldHVybiBodG1sO1xufVxuXG5mdW5jdGlvbiBiaXFSZW5kZXIoKTogdm9pZCB7XG4gIGNvbnN0IHJvb3QgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnX19iaXEtcm9vdCcpO1xuICBpZiAoIXJvb3QpIHJldHVybjtcbiAgY29uc3QgY3R4ID0gYmlxQ29udGV4dCgpO1xuXG4gIC8vIExhdW5jaGVyIChhbHdheXMgcHJlc2VudDsgaGlkZGVuIHZpYSBDU1Mgd2hlbiB0aGUgcGFuZWwgaXMgb3BlbikuXG4gIGNvbnN0IGZhYiA9ICc8YnV0dG9uIGNsYXNzPVwiYmlxLWZhYlwiIHRpdGxlPVwiQXNrIEJsdWVJUVwiIGFyaWEtbGFiZWw9XCJBc2sgQmx1ZUlRXCIgb25jbGljaz1cImJpcVRvZ2dsZSgpXCI+PHNwYW4gY2xhc3M9XCJiaXEtZmFiLWxhYmVsXCI+Qmx1ZUlRPC9zcGFuPjwvYnV0dG9uPic7XG5cbiAgLy8gU2NvcGUgY2hpcCArIChvbiBhIHJlY29yZCkgYSBicm9hZGVuL25hcnJvdyB0b2dnbGUuIE9uIGEgcHJvZ3JhbSBwYWdlIHRoZVxuICAvLyBsYWJlbCByZWZsZWN0cyBwcm9ncmFtcyAobm90IGNsaWVudHMpOyBhIHBsYWluIHByb2dyYW1zIGxpc3QgcmVhZHMgXCJhbGwgcHJvZ3JhbXNcIi5cbiAgbGV0IGNoaXA6IHN0cmluZztcbiAgbGV0IHRvZ2dsZSA9ICcnO1xuICBpZiAoY3R4LmNsaWVudElkKSB7XG4gICAgY2hpcCA9IGN0eC5mb2N1cyA9PT0gJ2NsaWVudCdcbiAgICAgID8gJ0Fza2luZyBhYm91dCA8Yj4nICsgZXNjKGN0eC5jbGllbnROYW1lIHx8ICd0aGlzIGNsaWVudCcpICsgJzwvYj4nXG4gICAgICA6ICdBc2tpbmcgYWNyb3NzIDxiPmFsbCBjbGllbnRzPC9iPic7XG4gICAgdG9nZ2xlID0gJzxidXR0b24gY2xhc3M9XCJiaXEtc2NvcGUtdG9nZ2xlXCIgb25jbGljaz1cImJpcVRvZ2dsZVNjb3BlKClcIj4nXG4gICAgICArIChjdHguZm9jdXMgPT09ICdjbGllbnQnID8gJ0FzayBhY3Jvc3MgYWxsIGNsaWVudHMnIDogJ0ZvY3VzIHRoaXMgY2xpZW50JykgKyAnPC9idXR0b24+JztcbiAgfSBlbHNlIGlmIChjdHgucHJvZ3JhbUlkKSB7XG4gICAgY2hpcCA9IGN0eC5mb2N1cyA9PT0gJ3Byb2dyYW0nXG4gICAgICA/ICdBc2tpbmcgYWJvdXQgPGI+JyArIGVzYyhjdHgucHJvZ3JhbU5hbWUgfHwgJ3RoaXMgcHJvZ3JhbScpICsgJzwvYj4nXG4gICAgICA6ICdBc2tpbmcgYWNyb3NzIDxiPmFsbCBwcm9ncmFtczwvYj4nO1xuICAgIHRvZ2dsZSA9ICc8YnV0dG9uIGNsYXNzPVwiYmlxLXNjb3BlLXRvZ2dsZVwiIG9uY2xpY2s9XCJiaXFUb2dnbGVTY29wZSgpXCI+J1xuICAgICAgKyAoY3R4LmZvY3VzID09PSAncHJvZ3JhbScgPyAnQXNrIGFjcm9zcyBhbGwgcHJvZ3JhbXMnIDogJ0ZvY3VzIHRoaXMgcHJvZ3JhbScpICsgJzwvYnV0dG9uPic7XG4gIH0gZWxzZSBpZiAoY3R4LnBhZ2UgPT09ICdwcm9ncmFtcycpIHtcbiAgICBjaGlwID0gKGN0eC5wcm9ncmFtRmlsdGVyICYmIGN0eC5wcm9ncmFtRmlsdGVyLmFjdGl2ZSlcbiAgICAgID8gJ0Fza2luZyBhYm91dCB5b3VyIDxiPicgKyBjdHgucHJvZ3JhbUZpbHRlci5jb3VudCArICcgZmlsdGVyZWQgcHJvZ3JhbScgKyAoY3R4LnByb2dyYW1GaWx0ZXIuY291bnQgPT09IDEgPyAnJyA6ICdzJykgKyAnPC9iPidcbiAgICAgIDogJ0Fza2luZyBhY3Jvc3MgPGI+YWxsIHByb2dyYW1zPC9iPic7XG4gIH0gZWxzZSB7XG4gICAgY2hpcCA9ICdBc2tpbmcgYWNyb3NzIDxiPmFsbCBjbGllbnRzPC9iPic7XG4gIH1cblxuICAvLyBXaGlsZSBhIGNhcHR1cmUgc2Vzc2lvbiBpcyBhY3RpdmUsIHRoZSB0aHJlYWQgYXJlYSBob3N0cyB0aGUgY2FwdHVyZSBVSSBhbmRcbiAgLy8gdGhlIGNoYXQgY29tcG9zZXIgaXMgcmVwbGFjZWQgYnkgdGhlIGNhcHR1cmUgZmxvdydzIG93biBjb250cm9scy4gVGhlIGNoYXRcbiAgLy8gdGhyZWFkIChCSVFfTVNHUykgaXMgcHJlc2VydmVkIHVudG91Y2hlZCBcdTIwMTQgQ2FuY2VsL2JhY2sgcmVzdG9yZXMgaXQuXG4gIGNvbnN0IGNhcEFjdGl2ZSA9ICEhQklRX0NBUDtcbiAgY29uc3QgdGhyZWFkSW5uZXIgPSBjYXBBY3RpdmUgPyBiaXFDYXBIdG1sKCkgOiBiaXFUaHJlYWRIdG1sKGN0eCk7XG4gIGNvbnN0IGNvbXBvc2VyID0gY2FwQWN0aXZlID8gJycgOlxuICAgICc8ZGl2IGNsYXNzPVwiYmlxLWNvbXBvc2VyXCI+J1xuICAgICAgKyAnPGRpdiBjbGFzcz1cImJpcS1jYXAtYmFyXCI+J1xuICAgICAgICArICc8YnV0dG9uIGNsYXNzPVwiYmlxLWNhcGJ0blwiIHRpdGxlPVwiQ2FwdHVyZSBhIG5vdGVcIiBvbmNsaWNrPVwiYmlxQ2FwU3RhcnQoXFwnaW5wdXRcXCcpXCI+JyArIGljKCdwbHVzJywgMTUpICsgJzxzcGFuPkNhcHR1cmUgYSBub3RlPC9zcGFuPjwvYnV0dG9uPidcbiAgICAgICAgKyAnPGJ1dHRvbiBjbGFzcz1cImJpcS1jYXBidG4gYmlxLWNhcGJ0bi1taWNcIiB0aXRsZT1cIkRpY3RhdGUgYSBub3RlXCIgYXJpYS1sYWJlbD1cIkRpY3RhdGUgYSBub3RlXCIgb25jbGljaz1cImJpcUNhcFN0YXJ0KFxcJ3JlY29yZFxcJylcIj4nICsgYmlxTWljKDE2KSArICc8L2J1dHRvbj4nXG4gICAgICArICc8L2Rpdj4nXG4gICAgICArICc8ZGl2IGNsYXNzPVwiYmlxLWNvbXBvc2VyLXJvd1wiPidcbiAgICAgICAgKyAnPHRleHRhcmVhIGlkPVwiYmlxLWlucHV0XCIgcm93cz1cIjFcIiBwbGFjZWhvbGRlcj1cIkFzayBCbHVlSVFcdTIwMjZcIiAnICsgKEJJUV9CVVNZID8gJ2Rpc2FibGVkICcgOiAnJykgKyAnb25rZXlkb3duPVwiYmlxS2V5KGV2ZW50KVwiPjwvdGV4dGFyZWE+J1xuICAgICAgICArICc8YnV0dG9uIGNsYXNzPVwiYmlxLXNlbmRcIiB0aXRsZT1cIlNlbmRcIiAnICsgKEJJUV9CVVNZID8gJ2Rpc2FibGVkICcgOiAnJykgKyAnb25jbGljaz1cImJpcVNlbmQoKVwiPicgKyBpYygnc2VuZCcsIDE4KSArICc8L2J1dHRvbj4nXG4gICAgICArICc8L2Rpdj4nXG4gICAgKyAnPC9kaXY+JztcblxuICBjb25zdCBwYW5lbCA9XG4gICAgJzxkaXYgY2xhc3M9XCJiaXEtcGFuZWwnICsgKEJJUV9PUEVOID8gJyBvcGVuJyA6ICcnKSArICdcIiByb2xlPVwiZGlhbG9nXCIgYXJpYS1sYWJlbD1cIkJsdWVJUSBhc3Npc3RhbnRcIj4nXG4gICAgICArICc8ZGl2IGNsYXNzPVwiYmlxLWhlYWRcIj4nXG4gICAgICAgICsgJzxkaXYgY2xhc3M9XCJiaXEtdGl0bGVcIj48c3BhbiBjbGFzcz1cImJpcS1zaGltbWVyXCI+Qmx1ZUlRPC9zcGFuPjwvZGl2PidcbiAgICAgICAgKyAnPGRpdiBjbGFzcz1cImJpcS1oZWFkLWFjdGlvbnNcIj4nXG4gICAgICAgICAgKyAoIWNhcEFjdGl2ZSAmJiBCSVFfTVNHUy5sZW5ndGggPyAnPGJ1dHRvbiBjbGFzcz1cImJpcS1pY29uXCIgdGl0bGU9XCJOZXcgY29udmVyc2F0aW9uXCIgb25jbGljaz1cImJpcVJlc2V0KClcIj4nICsgaWMoJ3BsdXMnLCAxNykgKyAnPC9idXR0b24+JyA6ICcnKVxuICAgICAgICAgICsgJzxidXR0b24gY2xhc3M9XCJiaXEtaWNvblwiIHRpdGxlPVwiQ2xvc2VcIiBvbmNsaWNrPVwiYmlxVG9nZ2xlKClcIj4nICsgaWMoJ3gnLCAxOCkgKyAnPC9idXR0b24+J1xuICAgICAgICArICc8L2Rpdj4nXG4gICAgICArICc8L2Rpdj4nXG4gICAgICArIChjYXBBY3RpdmUgPyAnJyA6ICc8ZGl2IGNsYXNzPVwiYmlxLXNjb3BlXCI+PHNwYW4gY2xhc3M9XCJiaXEtY2hpcFwiPicgKyBjaGlwICsgJzwvc3Bhbj4nICsgdG9nZ2xlICsgJzwvZGl2PicpXG4gICAgICArICc8ZGl2IGNsYXNzPVwiYmlxLXRocmVhZCcgKyAoY2FwQWN0aXZlID8gJyBiaXEtdGhyZWFkLWNhcCcgOiAnJykgKyAnXCIgaWQ9XCJiaXEtdGhyZWFkXCI+JyArIHRocmVhZElubmVyICsgJzwvZGl2PidcbiAgICAgICsgY29tcG9zZXJcbiAgICArICc8L2Rpdj4nO1xuXG4gIHJvb3QuaW5uZXJIVE1MID0gZmFiICsgcGFuZWw7XG5cbiAgaWYgKEJJUV9PUEVOKSB7XG4gICAgY29uc3QgdGhyZWFkID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2JpcS10aHJlYWQnKTtcbiAgICBpZiAodGhyZWFkICYmICFjYXBBY3RpdmUpIHRocmVhZC5zY3JvbGxUb3AgPSB0aHJlYWQuc2Nyb2xsSGVpZ2h0O1xuICAgIGlmIChjYXBBY3RpdmUgJiYgQklRX0NBUCkge1xuICAgICAgLy8gRm9jdXMgdGhlIGFjdGl2ZSBlZGl0YWJsZSBzdXJmYWNlIHNvIHRoZSBjb25zdWx0YW50IGNhbiB0eXBlIGltbWVkaWF0ZWx5LlxuICAgICAgY29uc3QgY2FwVGV4dCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKEJJUV9DQVAuc3RhZ2UgPT09ICdtYW51YWwnID8gJ2JpcS1tLXRleHQnIDogJ2JpcS1jYXAtdGV4dCcpIGFzIEhUTUxUZXh0QXJlYUVsZW1lbnQgfCBudWxsO1xuICAgICAgaWYgKGNhcFRleHQpIGNhcFRleHQuZm9jdXMoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgaW5wdXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYmlxLWlucHV0JykgYXMgSFRNTFRleHRBcmVhRWxlbWVudCB8IG51bGw7XG4gICAgICBpZiAoaW5wdXQgJiYgIUJJUV9CVVNZKSBpbnB1dC5mb2N1cygpO1xuICAgIH1cbiAgfVxufVxuXG4vLyAtLS0tIGFjdGlvbnMgKGdsb2JhbCBzbyBpbmxpbmUgb25jbGljay9vbmtleWRvd24gY2FuIHJlYWNoIHRoZW0pIC0tLS1cbmZ1bmN0aW9uIGJpcVRvZ2dsZSgpOiB2b2lkIHsgQklRX09QRU4gPSAhQklRX09QRU47IGJpcVJlbmRlcigpOyB9XG5mdW5jdGlvbiBiaXFUb2dnbGVTY29wZSgpOiB2b2lkIHsgQklRX0ZPUkNFX0dMT0JBTCA9ICFCSVFfRk9SQ0VfR0xPQkFMOyBiaXFSZW5kZXIoKTsgfVxuZnVuY3Rpb24gYmlxUmVzZXQoKTogdm9pZCB7IEJJUV9NU0dTID0gW107IGJpcVJlbmRlcigpOyB9XG5cbmZ1bmN0aW9uIGJpcUtleShldjogS2V5Ym9hcmRFdmVudCk6IHZvaWQge1xuICBpZiAoZXYua2V5ID09PSAnRW50ZXInICYmICFldi5zaGlmdEtleSkgeyBldi5wcmV2ZW50RGVmYXVsdCgpOyBiaXFTZW5kKCk7IH1cbn1cblxuLy8gQ2xpY2sgYW4gZXhhbXBsZSBwcm9tcHQgXHUyMTkyIGZpbGwgKyBzZW5kLlxuZnVuY3Rpb24gYmlxQXNrKGJ0bjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgY29uc3QgaW5wdXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYmlxLWlucHV0JykgYXMgSFRNTFRleHRBcmVhRWxlbWVudCB8IG51bGw7XG4gIGlmIChpbnB1dCkgaW5wdXQudmFsdWUgPSBidG4udGV4dENvbnRlbnQgfHwgJyc7XG4gIGJpcVNlbmQoKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gYmlxU2VuZCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKEJJUV9CVVNZKSByZXR1cm47XG4gIGNvbnN0IGlucHV0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2JpcS1pbnB1dCcpIGFzIEhUTUxUZXh0QXJlYUVsZW1lbnQgfCBudWxsO1xuICBjb25zdCBxID0gaW5wdXQgPyBpbnB1dC52YWx1ZS50cmltKCkgOiAnJztcbiAgaWYgKCFxKSByZXR1cm47XG5cbiAgY29uc3QgY3R4ID0gYmlxQ29udGV4dCgpO1xuICAvLyBQcmlvciB0dXJucyAoZXhjbHVkZSBlcnJvcnMpIGJlY29tZSB0aGUgaGlzdG9yeTsgdGhlbiB0aGlzIHF1ZXN0aW9uLlxuICBjb25zdCBoaXN0b3J5ID0gQklRX01TR1MuZmlsdGVyKG0gPT4gIW0uZXJyb3IpLm1hcChtID0+ICh7IHJvbGU6IG0ucm9sZSwgY29udGVudDogbS5jb250ZW50IH0pKTtcblxuICBCSVFfTVNHUy5wdXNoKHsgcm9sZTogJ3VzZXInLCBjb250ZW50OiBxIH0pO1xuICBpZiAoaW5wdXQpIGlucHV0LnZhbHVlID0gJyc7XG4gIEJJUV9CVVNZID0gdHJ1ZTtcbiAgYmlxUmVuZGVyKCk7XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgYXBpQmx1ZWlxQ2hhdChjdHguc2NvcGUsIGN0eC5jbGllbnRJZCwgcSwgaGlzdG9yeSxcbiAgICAgIGN0eC5mb2N1cyA9PT0gJ3Byb2dyYW0nID8gY3R4LnByb2dyYW1JZCA6ICcnLFxuICAgICAgY3R4LmZvY3VzID09PSAncHJvZ3JhbScgPyBjdHgucHJvZ3JhbU5hbWUgOiAnJyxcbiAgICAgIGN0eC5wcm9ncmFtRmlsdGVyIHx8IG51bGwpO1xuICAgIEJJUV9NU0dTLnB1c2goe1xuICAgICAgcm9sZTogJ2Fzc2lzdGFudCcsXG4gICAgICBjb250ZW50OiAoZGF0YSAmJiBkYXRhLmFzc2lzdGFudE1lc3NhZ2UpID8gZGF0YS5hc3Npc3RhbnRNZXNzYWdlIDogJyhObyBhbnN3ZXIgd2FzIHJldHVybmVkLiknLFxuICAgIH0pO1xuICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICBCSVFfTVNHUy5wdXNoKHsgcm9sZTogJ2Fzc2lzdGFudCcsIGNvbnRlbnQ6IChlICYmIGUubWVzc2FnZSkgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSksIGVycm9yOiB0cnVlIH0pO1xuICB9IGZpbmFsbHkge1xuICAgIEJJUV9CVVNZID0gZmFsc2U7XG4gICAgYmlxUmVuZGVyKCk7XG4gIH1cbn1cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICBCbHVlSVEgTk9URSBDQVBUVVJFIFx1MjAxNCBqb3Qgb3IgZGljdGF0ZSBhIHJhdyBub3RlIFx1MjE5MiBCbHVlSVEgdHVybnMgaXQgaW50byBhblxuICAgZWRpdGFibGUgRFJBRlQgb2YgYSBDUk0gZW50cnkgKHByb2dyYW0gbm90ZSwgY29tbXVuaWNhdGlvbiwgb3IgdGFzaykuIFRoZVxuICAgY29uc3VsdGFudCByZXZpZXdzL2VkaXRzLCB0aGVuIFNhdmUgd3JpdGVzIGl0LiBOT1RISU5HIGlzIHdyaXR0ZW4gdW50aWwgU2F2ZS5cbiAgIFRoZSB3aG9sZSBzZXNzaW9uIGxpdmVzIGluIEJJUV9DQVAgKGluLW1lbW9yeSwgZXBoZW1lcmFsIGxpa2UgdGhlIGNoYXQpLlxuICAgQnJhbmQgcnVsZTogbmV2ZXIgc3VyZmFjZSB0aGUgd29yZCBcIkFJXCIgXHUyMDE0IHRoaXMgaXMgQmx1ZUlRLlxuICAgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG5cbmludGVyZmFjZSBCaXFDYXBFZGl0IHtcbiAgdGFyZ2V0S2luZDogJ2NsaWVudCcgfCAncHJvZ3JhbSc7XG4gIHdyaXRlQWN0aW9uOiBzdHJpbmc7ICAgICAgICAgICAgICAgICAvLyBhZGRQcm9ncmFtTm90ZSB8IGFkZENvbW11bmljYXRpb24gfCBhZGRUYXNrXG4gIHRhcmdldElkOiBzdHJpbmc7IHRhcmdldE5hbWU6IHN0cmluZztcbiAgbm90ZVR5cGU6IHN0cmluZzsgdG91ckZvcm1hdDogc3RyaW5nO1xuICB0eXBlOiBzdHJpbmc7IHByaW9yaXR5OiBzdHJpbmc7ICAgICAgLy8gdHlwZSA9IGNvbW11bmljYXRpb24gY2hhbm5lbFxuICBkYXRlOiBzdHJpbmc7IHRvdXJEYXRlOiBzdHJpbmc7IGR1ZURhdGU6IHN0cmluZztcbiAgYm9keTogc3RyaW5nOyBzdWJqZWN0OiBzdHJpbmc7IHRpdGxlOiBzdHJpbmc7IGNvbnRhY3Q6IHN0cmluZztcbiAgcGlja2luZzogYm9vbGVhbjsgICAgICAgICAgICAgICAgICAgIC8vIHRhcmdldCBwaWNrZXIgaXMgb3BlbiAobm90IHlldCBsb2NrZWQpXG59XG5pbnRlcmZhY2UgQmlxQ2FwVGFzayB7IHRpdGxlOiBzdHJpbmc7IGRldGFpbHM6IHN0cmluZzsgZHVlRGF0ZTogc3RyaW5nOyBvbjogYm9vbGVhbjsgfVxuaW50ZXJmYWNlIEJpcVNhdmVkUmVmIHsga2luZDogJ3Byb2dyYW1Ob3RlJyB8ICdjb21tdW5pY2F0aW9uJyB8ICd0YXNrJzsgdGFyZ2V0SWQ6IHN0cmluZzsgZW50cnlJZDogc3RyaW5nOyB9XG5pbnRlcmZhY2UgQmlxQ2FwIHtcbiAgc3RhZ2U6ICdpbnB1dCcgfCAncmVjb3JkaW5nJyB8ICd0cmFuc2NyaWJpbmcnIHwgJ2NvbXBvc2luZycgfCAnZHJhZnQnIHwgJ3NhdmluZycgfCAnc2F2ZWQnIHwgJ21hbnVhbCc7XG4gIHJhd1RleHQ6IHN0cmluZzsgZXJyb3I6IHN0cmluZzsgc291cmNlOiBzdHJpbmc7XG4gIGRyYWZ0OiBhbnk7IGVkaXQ6IEJpcUNhcEVkaXQ7XG4gIGV4dHJhY3RlZFRhc2tzOiBCaXFDYXBUYXNrW107IGRhdGVQcm92ZW5hbmNlOiBzdHJpbmc7XG4gIHBpY2tJbmRleDogUmVjb3JkPHN0cmluZywgc3RyaW5nPjsgcGlja1F1ZXJ5OiBzdHJpbmc7XG4gIHNhdmVkUmVmczogQmlxU2F2ZWRSZWZbXTsgZmFpbGVkVGFza3M6IEJpcUNhcFRhc2tbXTsgZXh0cmFjdGVkU2F2ZWQ6IG51bWJlcjtcbiAgc2F2ZWREZXN0OiB7IGtpbmQ6ICdjbGllbnQnIHwgJ3Byb2dyYW0nOyBpZDogc3RyaW5nOyBuYW1lOiBzdHJpbmcgfSB8IG51bGw7XG4gIG1hbnVhbEJsb2NrOiBzdHJpbmc7XG59XG5sZXQgQklRX0NBUDogQmlxQ2FwIHwgbnVsbCA9IG51bGw7XG5cbi8vIEFsbG93ZWQgU2luZ2xlU2VsZWN0IGRpc3BsYXktbmFtZSBsaXN0cyBmb3IgdGhlIG5vdGUgZHJvcGRvd25zIChjYWNoZWQpLlxubGV0IEJJUV9OT1RFX01FVEE6IGFueSA9IG51bGw7XG5sZXQgQklRX05PVEVfTUVUQV9MT0FESU5HID0gZmFsc2U7XG5cbi8vIE1lZGlhUmVjb3JkZXIgc2Vzc2lvbiBzdGF0ZSAoc2VwYXJhdGUgZnJvbSByZW5kZXI7IHRoZSBwYW5lbCBqdXN0IHJlZmxlY3RzIGl0KS5cbmxldCBCSVFfTVJFQzogTWVkaWFSZWNvcmRlciB8IG51bGwgPSBudWxsO1xubGV0IEJJUV9NU1RSRUFNOiBNZWRpYVN0cmVhbSB8IG51bGwgPSBudWxsO1xubGV0IEJJUV9NQ0hVTktTOiBCbG9iUGFydFtdID0gW107XG5sZXQgQklRX01NSU1FID0gJyc7XG5sZXQgQklRX1JUSU1FUjogYW55ID0gbnVsbDtcbmxldCBCSVFfUlNUQVJUID0gMDtcbmNvbnN0IEJJUV9SQ0FQID0gMTIwOyAgICAgICAgICAgICAgICAgIC8vIGhhcmQgY2FwIG9uIGEgZGljdGF0aW9uIChzZWNvbmRzKVxuXG4vLyAtLS0tIHNtYWxsIGlubGluZSBnbHlwaHMgKGljb25zLnRzIGhhcyBubyBtaWMpIC0tLS1cbmZ1bmN0aW9uIGJpcU1pYyhzejogbnVtYmVyKTogc3RyaW5nIHtcbiAgcmV0dXJuICc8c3ZnIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiB3aWR0aD1cIicgKyBzeiArICdcIiBoZWlnaHQ9XCInICsgc3ogKyAnXCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PHBhdGggZD1cIk0xMiAyYTMgMyAwIDAgMC0zIDN2N2EzIDMgMCAwIDAgNiAwVjVhMyAzIDAgMCAwLTMtM3pcIi8+PHBhdGggZD1cIk0xOSAxMHYyYTcgNyAwIDAgMS0xNCAwdi0yXCIvPjxwYXRoIGQ9XCJNMTIgMTl2M1wiLz48L3N2Zz4nO1xufVxuZnVuY3Rpb24gYmlxS2luZEljb24oa2luZDogJ2NsaWVudCcgfCAncHJvZ3JhbScpOiBzdHJpbmcgeyByZXR1cm4ga2luZCA9PT0gJ3Byb2dyYW0nID8gaWMoJ2J1aWxkaW5nJywgMTUpIDogaWMoJ3VzZXInLCAxNSk7IH1cbmZ1bmN0aW9uIGJpcVRvZGF5KCk6IHN0cmluZyB7IHJldHVybiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkuc2xpY2UoMCwgMTApOyB9XG5mdW5jdGlvbiBiaXFJc1RvdXIobm90ZVR5cGU6IHN0cmluZyk6IGJvb2xlYW4geyByZXR1cm4gL3RvdXIvaS50ZXN0KG5vdGVUeXBlIHx8ICcnKTsgfVxuZnVuY3Rpb24gYmlxRm10U2VjcyhzOiBudW1iZXIpOiBzdHJpbmcgeyBjb25zdCBtID0gTWF0aC5mbG9vcihzIC8gNjApOyBjb25zdCBzcyA9IHMgJSA2MDsgcmV0dXJuIG0gKyAnOicgKyAoc3MgPCAxMCA/ICcwJyA6ICcnKSArIHNzOyB9XG5mdW5jdGlvbiBiaXFDYXBCbG9ja2VkKGVudjogYW55KTogYm9vbGVhbiB7IHJldHVybiAhIShlbnYgJiYgKGVudi5jcmVkaXRMaW1pdFJlYWNoZWQgfHwgZW52LmNyZWRpdENoZWNrRmFpbGVkIHx8IGVudi5ibHVlaXFEaXNhYmxlZCkpOyB9XG5cbi8vIC0tLS0gbm90ZS1tZXRhIG9wdGlvbiBsaXN0cyAtLS0tXG5mdW5jdGlvbiBiaXFNZXRhKHBhdGg6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgaWYgKCFCSVFfTk9URV9NRVRBKSByZXR1cm4gW107XG4gIGNvbnN0IHBhcnRzID0gcGF0aC5zcGxpdCgnLicpO1xuICBsZXQgY3VyOiBhbnkgPSBCSVFfTk9URV9NRVRBO1xuICBmb3IgKGNvbnN0IHAgb2YgcGFydHMpIHsgaWYgKGN1ciAmJiB0eXBlb2YgY3VyID09PSAnb2JqZWN0JyAmJiBwIGluIGN1cikgY3VyID0gY3VyW3BdOyBlbHNlIHJldHVybiBbXTsgfVxuICByZXR1cm4gQXJyYXkuaXNBcnJheShjdXIpID8gY3VyLmZpbHRlcigoeDogYW55KSA9PiB0eXBlb2YgeCA9PT0gJ3N0cmluZycgJiYgeC50cmltKCkpIDogW107XG59XG5hc3luYyBmdW5jdGlvbiBiaXFMb2FkTm90ZU1ldGEoKTogUHJvbWlzZTx2b2lkPiB7XG4gIGlmIChCSVFfTk9URV9NRVRBIHx8IEJJUV9OT1RFX01FVEFfTE9BRElORykgcmV0dXJuO1xuICBCSVFfTk9URV9NRVRBX0xPQURJTkcgPSB0cnVlO1xuICB0cnkgeyBCSVFfTk9URV9NRVRBID0gYXdhaXQgYXBpTm90ZU1ldGEoKTsgfVxuICBjYXRjaCAoX2UpIHsgQklRX05PVEVfTUVUQSA9IHt9OyB9ICAgICAgICAgLy8gZmFpbCBzb2Z0IFx1MjE5MiBmcmVlLXRleHQgaW5wdXRzXG4gIGZpbmFsbHkgeyBCSVFfTk9URV9NRVRBX0xPQURJTkcgPSBmYWxzZTsgaWYgKEJJUV9DQVApIGJpcVJlbmRlcigpOyB9XG59XG5cbi8vIC0tLS0gZGF0YSBzb3VyY2VzIGZvciB0aGUgdGFyZ2V0IHBpY2tlciArIGRpY3RhdGlvbiB2b2NhYiAtLS0tXG5mdW5jdGlvbiBiaXFDYXBDbGllbnRzKCk6IHsgaWQ6IHN0cmluZzsgbmFtZTogc3RyaW5nIH1bXSB7XG4gIGNvbnN0IG91dDogeyBpZDogc3RyaW5nOyBuYW1lOiBzdHJpbmcgfVtdID0gW107XG4gIGNvbnN0IHNlZW46IFJlY29yZDxzdHJpbmcsIGJvb2xlYW4+ID0ge307XG4gIGNvbnN0IHN0b3JlcyA9IFtcbiAgICAodHlwZW9mIENMSUVOVF9TVE9SRSAhPT0gJ3VuZGVmaW5lZCcpID8gQ0xJRU5UX1NUT1JFIDogbnVsbCxcbiAgICAodHlwZW9mIElOUVVJUllfU1RPUkUgIT09ICd1bmRlZmluZWQnKSA/IElOUVVJUllfU1RPUkUgOiBudWxsLFxuICAgICh0eXBlb2YgQUxVTU5JX1NUT1JFICE9PSAndW5kZWZpbmVkJykgPyBBTFVNTklfU1RPUkUgOiBudWxsLFxuICBdO1xuICBzdG9yZXMuZm9yRWFjaChzID0+IChzIHx8IFtdKS5mb3JFYWNoKChjOiBhbnkpID0+IHtcbiAgICBjb25zdCBubSA9ICgoYy5maXJzdCB8fCAnJykgKyAnICcgKyAoYy5sYXN0IHx8ICcnKSkudHJpbSgpO1xuICAgIGlmIChubSAmJiBjLmlkICYmICFzZWVuW2MuaWRdKSB7IHNlZW5bYy5pZF0gPSB0cnVlOyBvdXQucHVzaCh7IGlkOiBTdHJpbmcoYy5pZCksIG5hbWU6IG5tIH0pOyB9XG4gIH0pKTtcbiAgcmV0dXJuIG91dDtcbn1cbmZ1bmN0aW9uIGJpcUNhcFByb2dyYW1zKCk6IHsgaWQ6IHN0cmluZzsgbmFtZTogc3RyaW5nIH1bXSB7XG4gIGNvbnN0IHN0b3JlID0gKHR5cGVvZiBQUk9HUkFNX1NUT1JFICE9PSAndW5kZWZpbmVkJykgPyBQUk9HUkFNX1NUT1JFIDogbnVsbDtcbiAgcmV0dXJuIChzdG9yZSB8fCBbXSkubWFwKChwOiBhbnkpID0+ICh7IGlkOiBTdHJpbmcocC5pZCksIG5hbWU6IHAucHJvZ3JhbU5hbWUgfHwgJycgfSkpLmZpbHRlcih4ID0+IHgubmFtZSk7XG59XG4vLyBDbGllbnQgKyBwcm9ncmFtIHByb3BlciBub3VucyBiaWFzIHRoZSB0cmFuc2NyaXB0aW9uIHRvd2FyZCBjb3JyZWN0IHNwZWxsaW5nLlxuZnVuY3Rpb24gYmlxQ2FwVm9jYWIoKTogc3RyaW5nW10ge1xuICBjb25zdCBzZWVuOiBSZWNvcmQ8c3RyaW5nLCBib29sZWFuPiA9IHt9O1xuICBjb25zdCBvdXQ6IHN0cmluZ1tdID0gW107XG4gIGNvbnN0IGFkZCA9IChuOiBzdHJpbmcpID0+IHsgbiA9IChuIHx8ICcnKS50cmltKCk7IGNvbnN0IGsgPSBuLnRvTG93ZXJDYXNlKCk7IGlmIChuICYmICFzZWVuW2tdKSB7IHNlZW5ba10gPSB0cnVlOyBvdXQucHVzaChuKTsgfSB9O1xuICBiaXFDYXBDbGllbnRzKCkuZm9yRWFjaChjID0+IGFkZChjLm5hbWUpKTtcbiAgYmlxQ2FwUHJvZ3JhbXMoKS5mb3JFYWNoKHAgPT4gYWRkKHAubmFtZSkpO1xuICByZXR1cm4gb3V0LnNsaWNlKDAsIDIwMCk7XG59XG4vLyBLaWNrIG9mZiBhbnkgc3RvcmUgbG9hZHMgdGhlIHBpY2tlcnMvdm9jYWIgbmVlZCwgcmUtcmVuZGVyaW5nIHRoZSBjYXB0dXJlIFVJXG4vLyB3aGVuIHRoZXkgYXJyaXZlIChzdG9yZSBsb2FkZXJzIGNhbGwgdGhlIFNQQSByZW5kZXIoKSwgbm90IGJpcVJlbmRlcigpKS5cbmZ1bmN0aW9uIGJpcUNhcEVuc3VyZVN0b3JlcygpOiB2b2lkIHtcbiAgY29uc3Qgam9iczogUHJvbWlzZTxhbnk+W10gPSBbXTtcbiAgdHJ5IHtcbiAgICBpZiAodHlwZW9mIENMSUVOVF9TVE9SRSAhPT0gJ3VuZGVmaW5lZCcgJiYgQ0xJRU5UX1NUT1JFID09PSBudWxsICYmIHR5cGVvZiBsb2FkQ2xpZW50cyA9PT0gJ2Z1bmN0aW9uJykgam9icy5wdXNoKGxvYWRDbGllbnRzKCkpO1xuICAgIGlmICh0eXBlb2YgSU5RVUlSWV9TVE9SRSAhPT0gJ3VuZGVmaW5lZCcgJiYgSU5RVUlSWV9TVE9SRSA9PT0gbnVsbCAmJiB0eXBlb2YgbG9hZElucXVpcmllcyA9PT0gJ2Z1bmN0aW9uJykgam9icy5wdXNoKGxvYWRJbnF1aXJpZXMoKSk7XG4gICAgaWYgKHR5cGVvZiBBTFVNTklfU1RPUkUgIT09ICd1bmRlZmluZWQnICYmIEFMVU1OSV9TVE9SRSA9PT0gbnVsbCAmJiB0eXBlb2YgbG9hZEFsdW1uaSA9PT0gJ2Z1bmN0aW9uJykgam9icy5wdXNoKGxvYWRBbHVtbmkoKSk7XG4gICAgaWYgKHR5cGVvZiBQUk9HUkFNX1NUT1JFICE9PSAndW5kZWZpbmVkJyAmJiBQUk9HUkFNX1NUT1JFID09PSBudWxsICYmIHR5cGVvZiBsb2FkUHJvZ3JhbXMgPT09ICdmdW5jdGlvbicpIGpvYnMucHVzaChsb2FkUHJvZ3JhbXMoKSk7XG4gIH0gY2F0Y2ggKF9lKSB7IC8qIHN0b3JlcyBub3QgcHJlc2VudCAqLyB9XG4gIGlmIChqb2JzLmxlbmd0aCkgUHJvbWlzZS5hbGwoam9icykudGhlbigoKSA9PiB7IGlmIChCSVFfQ0FQKSBiaXFSZW5kZXIoKTsgfSkuY2F0Y2goKCkgPT4geyAvKiBpZ25vcmUgKi8gfSk7XG59XG5cbi8vIC0tLS0gc2Vzc2lvbiBsaWZlY3ljbGUgLS0tLVxuZnVuY3Rpb24gYmlxRW1wdHlFZGl0KCk6IEJpcUNhcEVkaXQge1xuICByZXR1cm4ge1xuICAgIHRhcmdldEtpbmQ6ICdjbGllbnQnLCB3cml0ZUFjdGlvbjogJ2FkZENvbW11bmljYXRpb24nLCB0YXJnZXRJZDogJycsIHRhcmdldE5hbWU6ICcnLFxuICAgIG5vdGVUeXBlOiAnJywgdG91ckZvcm1hdDogJycsIHR5cGU6ICcnLCBwcmlvcml0eTogJycsXG4gICAgZGF0ZTogJycsIHRvdXJEYXRlOiAnJywgZHVlRGF0ZTogJycsIGJvZHk6ICcnLCBzdWJqZWN0OiAnJywgdGl0bGU6ICcnLCBjb250YWN0OiAnJywgcGlja2luZzogdHJ1ZSxcbiAgfTtcbn1cbmZ1bmN0aW9uIGJpcUNhcFN0YXJ0KG1vZGU6IHN0cmluZyk6IHZvaWQge1xuICBCSVFfQ0FQID0ge1xuICAgIHN0YWdlOiAnaW5wdXQnLCByYXdUZXh0OiAnJywgZXJyb3I6ICcnLCBzb3VyY2U6ICd0ZXh0JywgZHJhZnQ6IG51bGwsIGVkaXQ6IGJpcUVtcHR5RWRpdCgpLFxuICAgIGV4dHJhY3RlZFRhc2tzOiBbXSwgZGF0ZVByb3ZlbmFuY2U6ICcnLCBwaWNrSW5kZXg6IHt9LCBwaWNrUXVlcnk6ICcnLFxuICAgIHNhdmVkUmVmczogW10sIGZhaWxlZFRhc2tzOiBbXSwgZXh0cmFjdGVkU2F2ZWQ6IDAsIHNhdmVkRGVzdDogbnVsbCwgbWFudWFsQmxvY2s6ICcnLFxuICB9O1xuICBCSVFfT1BFTiA9IHRydWU7XG4gIGJpcUxvYWROb3RlTWV0YSgpO1xuICBiaXFDYXBFbnN1cmVTdG9yZXMoKTtcbiAgaWYgKG1vZGUgPT09ICdyZWNvcmQnKSBiaXFDYXBSZWNvcmQoKTtcbiAgZWxzZSBiaXFSZW5kZXIoKTtcbn1cbmZ1bmN0aW9uIGJpcUNhcENhbmNlbCgpOiB2b2lkIHtcbiAgYmlxU3RvcFRpbWVyKCk7XG4gIHRyeSB7IGlmIChCSVFfTVJFQyAmJiBCSVFfTVJFQy5zdGF0ZSAhPT0gJ2luYWN0aXZlJykgQklRX01SRUMuc3RvcCgpOyB9IGNhdGNoIChfZSkgeyAvKiBpZ25vcmUgKi8gfVxuICBiaXFTdG9wU3RyZWFtKCk7XG4gIEJJUV9NUkVDID0gbnVsbDtcbiAgQklRX0NBUCA9IG51bGw7XG4gIGJpcVJlbmRlcigpO1xufVxuZnVuY3Rpb24gYmlxQ2FwQmFja1RvSW5wdXQoKTogdm9pZCB7IGlmICghQklRX0NBUCkgcmV0dXJuOyBCSVFfQ0FQLmVycm9yID0gJyc7IEJJUV9DQVAuc3RhZ2UgPSAnaW5wdXQnOyBiaXFSZW5kZXIoKTsgfVxuXG4vLyAtLS0tIHJlY29yZGluZyAtLS0tXG5mdW5jdGlvbiBiaXFQaWNrTWltZSgpOiBzdHJpbmcge1xuICBjb25zdCBjYW5kcyA9IFsnYXVkaW8vd2VibTtjb2RlY3M9b3B1cycsICdhdWRpby93ZWJtJywgJ2F1ZGlvL29nZztjb2RlY3M9b3B1cycsICdhdWRpby9tcDQnXTtcbiAgaWYgKHR5cGVvZiBNZWRpYVJlY29yZGVyICE9PSAndW5kZWZpbmVkJyAmJiAoTWVkaWFSZWNvcmRlciBhcyBhbnkpLmlzVHlwZVN1cHBvcnRlZCkge1xuICAgIGZvciAoY29uc3QgbSBvZiBjYW5kcykgeyB0cnkgeyBpZiAoKE1lZGlhUmVjb3JkZXIgYXMgYW55KS5pc1R5cGVTdXBwb3J0ZWQobSkpIHJldHVybiBtOyB9IGNhdGNoIChfZSkgeyAvKiBpZ25vcmUgKi8gfSB9XG4gIH1cbiAgcmV0dXJuICcnO1xufVxuYXN5bmMgZnVuY3Rpb24gYmlxQ2FwUmVjb3JkKCk6IFByb21pc2U8dm9pZD4ge1xuICBpZiAoIUJJUV9DQVApIHJldHVybjtcbiAgY29uc3QgdGEgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYmlxLWNhcC10ZXh0JykgYXMgSFRNTFRleHRBcmVhRWxlbWVudCB8IG51bGw7XG4gIGlmICh0YSkgQklRX0NBUC5yYXdUZXh0ID0gdGEudmFsdWU7ICAgLy8ga2VlcCBhbnkgdHlwZWQgdGV4dFxuICBCSVFfQ0FQLmVycm9yID0gJyc7XG4gIHRyeSB7XG4gICAgY29uc3Qgc3RyZWFtID0gYXdhaXQgbmF2aWdhdG9yLm1lZGlhRGV2aWNlcy5nZXRVc2VyTWVkaWEoeyBhdWRpbzogdHJ1ZSB9KTtcbiAgICBCSVFfTVNUUkVBTSA9IHN0cmVhbTsgQklRX01DSFVOS1MgPSBbXTsgQklRX01NSU1FID0gYmlxUGlja01pbWUoKTtcbiAgICBjb25zdCByZWMgPSBCSVFfTU1JTUUgPyBuZXcgTWVkaWFSZWNvcmRlcihzdHJlYW0sIHsgbWltZVR5cGU6IEJJUV9NTUlNRSB9KSA6IG5ldyBNZWRpYVJlY29yZGVyKHN0cmVhbSk7XG4gICAgQklRX01SRUMgPSByZWM7XG4gICAgcmVjLm9uZGF0YWF2YWlsYWJsZSA9IChldjogQmxvYkV2ZW50KSA9PiB7IGlmIChldi5kYXRhICYmIGV2LmRhdGEuc2l6ZSA+IDApIEJJUV9NQ0hVTktTLnB1c2goZXYuZGF0YSk7IH07XG4gICAgcmVjLm9uc3RvcCA9ICgpID0+IHsgYmlxQ2FwUHJvY2Vzc1JlY29yZGluZygpOyB9O1xuICAgIHJlYy5zdGFydCgpO1xuICAgIEJJUV9SU1RBUlQgPSBEYXRlLm5vdygpO1xuICAgIGlmICghQklRX0NBUCkgcmV0dXJuO1xuICAgIEJJUV9DQVAuc3RhZ2UgPSAncmVjb3JkaW5nJztcbiAgICBiaXFSZW5kZXIoKTtcbiAgICBiaXFTdGFydFRpbWVyKCk7XG4gIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgaWYgKCFCSVFfQ0FQKSByZXR1cm47XG4gICAgQklRX0NBUC5lcnJvciA9ICdNaWNyb3Bob25lIHVuYXZhaWxhYmxlOiAnICsgKChlcnIgJiYgZXJyLm1lc3NhZ2UpID8gZXJyLm1lc3NhZ2UgOiBTdHJpbmcoZXJyKSk7XG4gICAgQklRX0NBUC5zdGFnZSA9ICdpbnB1dCc7XG4gICAgYmlxUmVuZGVyKCk7XG4gIH1cbn1cbmZ1bmN0aW9uIGJpcVN0YXJ0VGltZXIoKTogdm9pZCB7XG4gIGJpcVN0b3BUaW1lcigpO1xuICBCSVFfUlRJTUVSID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgIGNvbnN0IHNlY3MgPSBNYXRoLmZsb29yKChEYXRlLm5vdygpIC0gQklRX1JTVEFSVCkgLyAxMDAwKTtcbiAgICBjb25zdCBlbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdiaXEtcmVjLXRpbWVyJyk7XG4gICAgaWYgKGVsKSBlbC50ZXh0Q29udGVudCA9IGJpcUZtdFNlY3Moc2Vjcyk7XG4gICAgaWYgKHNlY3MgPj0gQklRX1JDQVApIGJpcUNhcFN0b3BSZWMoKTtcbiAgfSwgMjUwKTtcbn1cbmZ1bmN0aW9uIGJpcVN0b3BUaW1lcigpOiB2b2lkIHsgaWYgKEJJUV9SVElNRVIpIHsgY2xlYXJJbnRlcnZhbChCSVFfUlRJTUVSKTsgQklRX1JUSU1FUiA9IG51bGw7IH0gfVxuZnVuY3Rpb24gYmlxU3RvcFN0cmVhbSgpOiB2b2lkIHtcbiAgaWYgKEJJUV9NU1RSRUFNKSB7IHRyeSB7IEJJUV9NU1RSRUFNLmdldFRyYWNrcygpLmZvckVhY2godCA9PiB0LnN0b3AoKSk7IH0gY2F0Y2ggKF9lKSB7IC8qIGlnbm9yZSAqLyB9IEJJUV9NU1RSRUFNID0gbnVsbDsgfVxufVxuZnVuY3Rpb24gYmlxQ2FwU3RvcFJlYygpOiB2b2lkIHtcbiAgYmlxU3RvcFRpbWVyKCk7XG4gIHRyeSB7IGlmIChCSVFfTVJFQyAmJiBCSVFfTVJFQy5zdGF0ZSAhPT0gJ2luYWN0aXZlJykgQklRX01SRUMuc3RvcCgpOyB9IGNhdGNoIChfZSkgeyAvKiBpZ25vcmUgKi8gfVxufVxuZnVuY3Rpb24gYmlxQmxvYlRvQjY0KGJsb2I6IEJsb2IpOiBQcm9taXNlPHN0cmluZz4ge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGNvbnN0IGZyID0gbmV3IEZpbGVSZWFkZXIoKTtcbiAgICBmci5vbmVycm9yID0gKCkgPT4gcmVqZWN0KGZyLmVycm9yIHx8IG5ldyBFcnJvcigncmVhZCBlcnJvcicpKTtcbiAgICBmci5vbmxvYWQgPSAoKSA9PiB7IGNvbnN0IHIgPSBTdHJpbmcoZnIucmVzdWx0IHx8ICcnKTsgY29uc3QgaSA9IHIuaW5kZXhPZignLCcpOyByZXNvbHZlKGkgPj0gMCA/IHIuc2xpY2UoaSArIDEpIDogcik7IH07XG4gICAgZnIucmVhZEFzRGF0YVVSTChibG9iKTtcbiAgfSk7XG59XG5hc3luYyBmdW5jdGlvbiBiaXFDYXBQcm9jZXNzUmVjb3JkaW5nKCk6IFByb21pc2U8dm9pZD4ge1xuICBpZiAoIUJJUV9DQVApIHsgYmlxU3RvcFN0cmVhbSgpOyByZXR1cm47IH1cbiAgY29uc3QgbWltZSA9IEJJUV9NTUlNRSB8fCAoQklRX01SRUMgJiYgQklRX01SRUMubWltZVR5cGUpIHx8ICdhdWRpby93ZWJtJztcbiAgYmlxU3RvcFN0cmVhbSgpO1xuICBjb25zdCBibG9iID0gbmV3IEJsb2IoQklRX01DSFVOS1MsIHsgdHlwZTogbWltZSB9KTtcbiAgQklRX01DSFVOS1MgPSBbXTtcbiAgaWYgKCFibG9iLnNpemUpIHsgQklRX0NBUC5lcnJvciA9ICdObyBhdWRpbyB3YXMgY2FwdHVyZWQuIFRyeSBhZ2Fpbi4nOyBCSVFfQ0FQLnN0YWdlID0gJ2lucHV0JzsgYmlxUmVuZGVyKCk7IHJldHVybjsgfVxuICBCSVFfQ0FQLnN0YWdlID0gJ3RyYW5zY3JpYmluZyc7IGJpcVJlbmRlcigpO1xuICBsZXQgYjY0ID0gJyc7XG4gIHRyeSB7IGI2NCA9IGF3YWl0IGJpcUJsb2JUb0I2NChibG9iKTsgfVxuICBjYXRjaCAoX2UpIHsgaWYgKCFCSVFfQ0FQKSByZXR1cm47IEJJUV9DQVAuZXJyb3IgPSAnQ291bGQgbm90IHJlYWQgdGhlIHJlY29yZGluZy4nOyBCSVFfQ0FQLnN0YWdlID0gJ2lucHV0JzsgYmlxUmVuZGVyKCk7IHJldHVybjsgfVxuICB0cnkge1xuICAgIGNvbnN0IGVudiA9IGF3YWl0IGFwaUJsdWVpcVRyYW5zY3JpYmUoYjY0LCBtaW1lLCBiaXFDYXBWb2NhYigpKTtcbiAgICBpZiAoIUJJUV9DQVApIHJldHVybjtcbiAgICBpZiAoZW52ICYmIGVudi5vayAmJiBlbnYuZGF0YSAmJiB0eXBlb2YgZW52LmRhdGEudHJhbnNjcmlwdCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGNvbnN0IHR4ID0gZW52LmRhdGEudHJhbnNjcmlwdC50cmltKCk7XG4gICAgICBjb25zdCBwcmlvciA9IChCSVFfQ0FQLnJhd1RleHQgfHwgJycpLnRyaW0oKTtcbiAgICAgIEJJUV9DQVAucmF3VGV4dCA9IHByaW9yID8gKHByaW9yICsgJ1xcbicgKyB0eCkgOiB0eDsgICAvLyBmb2xkIGluIGFueSB0ZXh0IHRoZXknZCB0eXBlZFxuICAgICAgQklRX0NBUC5zb3VyY2UgPSAndm9pY2UnO1xuICAgICAgaWYgKCFCSVFfQ0FQLnJhd1RleHQudHJpbSgpKSB7ICAgLy8gbm90aGluZyBjYW1lIGJhY2sgXHUyMDE0IGxldCB0aGVtIHRyeSBhZ2FpblxuICAgICAgICBCSVFfQ0FQLmVycm9yID0gXCJJIGRpZG4ndCBjYXRjaCBhbnl0aGluZy4gVHJ5IGFnYWluLCBvciB0eXBlIHlvdXIgbm90ZS5cIjtcbiAgICAgICAgQklRX0NBUC5zdGFnZSA9ICdpbnB1dCc7XG4gICAgICAgIGJpcVJlbmRlcigpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYmlxQ2FwQ29tcG9zZSgpOyAgICAgICAgICAgICAgIC8vIGRpY3RhdGlvbiBnb2VzIHN0cmFpZ2h0IGludG8gbm90ZSBnZW5lcmF0aW9uXG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChiaXFDYXBCbG9ja2VkKGVudikpIHtcbiAgICAgIGJpcUNhcEVudGVyTWFudWFsKGVudiAmJiBlbnYuZXJyb3IpO1xuICAgIH0gZWxzZSB7XG4gICAgICBCSVFfQ0FQLmVycm9yID0gKGVudiAmJiBlbnYuZXJyb3IpID8gZW52LmVycm9yIDogJ1RyYW5zY3JpcHRpb24gZmFpbGVkLiBUeXBlIHlvdXIgbm90ZSBpbnN0ZWFkLCBvciB0cnkgYWdhaW4uJztcbiAgICAgIEJJUV9DQVAuc3RhZ2UgPSAnaW5wdXQnO1xuICAgICAgYmlxUmVuZGVyKCk7XG4gICAgfVxuICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgIGlmICghQklRX0NBUCkgcmV0dXJuO1xuICAgIEJJUV9DQVAuZXJyb3IgPSAoZXJyICYmIGVyci5tZXNzYWdlKSA/IGVyci5tZXNzYWdlIDogU3RyaW5nKGVycik7XG4gICAgQklRX0NBUC5zdGFnZSA9ICdpbnB1dCc7XG4gICAgYmlxUmVuZGVyKCk7XG4gIH1cbn1cblxuLy8gLS0tLSBjb21wb3NlIChyYXcgdGV4dCBcdTIxOTIgZWRpdGFibGUgZHJhZnQpIC0tLS1cbmFzeW5jIGZ1bmN0aW9uIGJpcUNhcENvbXBvc2UoKTogUHJvbWlzZTx2b2lkPiB7XG4gIGlmICghQklRX0NBUCkgcmV0dXJuO1xuICBjb25zdCB0YSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdiaXEtY2FwLXRleHQnKSBhcyBIVE1MVGV4dEFyZWFFbGVtZW50IHwgbnVsbDtcbiAgaWYgKHRhKSBCSVFfQ0FQLnJhd1RleHQgPSB0YS52YWx1ZTtcbiAgY29uc3QgcmF3ID0gKEJJUV9DQVAucmF3VGV4dCB8fCAnJykudHJpbSgpO1xuICBpZiAoIXJhdykgeyBCSVFfQ0FQLmVycm9yID0gJ1R5cGUgb3IgZGljdGF0ZSBhIG5vdGUgZmlyc3QuJzsgYmlxUmVuZGVyKCk7IHJldHVybjsgfVxuICBCSVFfQ0FQLmVycm9yID0gJyc7IEJJUV9DQVAuc3RhZ2UgPSAnY29tcG9zaW5nJzsgYmlxUmVuZGVyKCk7XG4gIGNvbnN0IGN0eCA9IGJpcUNvbnRleHQoKTtcbiAgdHJ5IHtcbiAgICBjb25zdCBlbnYgPSBhd2FpdCBhcGlCbHVlaXFDb21wb3NlKHtcbiAgICAgIHJhd1RleHQ6IHJhdywgc291cmNlOiBCSVFfQ0FQLnNvdXJjZSB8fCAndGV4dCcsXG4gICAgICBzY29wZTogY3R4LnNjb3BlLCBjbGllbnRJZDogY3R4LmNsaWVudElkIHx8ICcnLCBwcm9ncmFtSWQ6IGN0eC5wcm9ncmFtSWQgfHwgJycsIHByb2dyYW1OYW1lOiBjdHgucHJvZ3JhbU5hbWUgfHwgJycsXG4gICAgfSk7XG4gICAgaWYgKCFCSVFfQ0FQKSByZXR1cm47XG4gICAgaWYgKGVudiAmJiBlbnYub2sgJiYgZW52LmRhdGEgJiYgZW52LmRhdGEuZHJhZnQpIHtcbiAgICAgIGJpcUNhcEluaXREcmFmdChlbnYuZGF0YS5kcmFmdCk7XG4gICAgICBCSVFfQ0FQLnN0YWdlID0gJ2RyYWZ0JztcbiAgICAgIGJpcVJlbmRlcigpO1xuICAgIH0gZWxzZSBpZiAoYmlxQ2FwQmxvY2tlZChlbnYpKSB7XG4gICAgICBiaXFDYXBFbnRlck1hbnVhbChlbnYgJiYgZW52LmVycm9yKTtcbiAgICB9IGVsc2Uge1xuICAgICAgQklRX0NBUC5lcnJvciA9IChlbnYgJiYgZW52LmVycm9yKSA/IGVudi5lcnJvciA6ICdCbHVlSVEgY291bGQgbm90IHJlYWQgeW91ciBub3RlLiBFZGl0IGl0IGFuZCB0cnkgYWdhaW4uJztcbiAgICAgIEJJUV9DQVAuc3RhZ2UgPSAnaW5wdXQnO1xuICAgICAgYmlxUmVuZGVyKCk7XG4gICAgfVxuICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgIGlmICghQklRX0NBUCkgcmV0dXJuO1xuICAgIEJJUV9DQVAuZXJyb3IgPSAoZXJyICYmIGVyci5tZXNzYWdlKSA/IGVyci5tZXNzYWdlIDogU3RyaW5nKGVycik7XG4gICAgQklRX0NBUC5zdGFnZSA9ICdpbnB1dCc7XG4gICAgYmlxUmVuZGVyKCk7XG4gIH1cbn1cbmZ1bmN0aW9uIGJpcUNhcEluaXREcmFmdChkOiBhbnkpOiB2b2lkIHtcbiAgaWYgKCFCSVFfQ0FQKSByZXR1cm47XG4gIGNvbnN0IGNhcCA9IEJJUV9DQVA7XG4gIGNhcC5kcmFmdCA9IGQ7XG4gIGNvbnN0IGYgPSAoZCAmJiBkLmZpZWxkcykgfHwge307XG4gIGNvbnN0IHRndCA9IChkICYmIGQudGFyZ2V0KSB8fCB7fTtcbiAgY29uc3Qga2luZDogJ2NsaWVudCcgfCAncHJvZ3JhbScgPSAoZCAmJiBkLnRhcmdldEtpbmQgPT09ICdwcm9ncmFtJykgPyAncHJvZ3JhbScgOiAnY2xpZW50JztcbiAgY29uc3Qgd2EgPSAoZCAmJiBkLndyaXRlQWN0aW9uKSB8fCAoa2luZCA9PT0gJ3Byb2dyYW0nID8gJ2FkZFByb2dyYW1Ob3RlJyA6ICdhZGRDb21tdW5pY2F0aW9uJyk7XG4gIGxldCBib2R5ID0gJyc7XG4gIGlmICh3YSA9PT0gJ2FkZFByb2dyYW1Ob3RlJykgYm9keSA9IGYuYm9keSB8fCAnJztcbiAgZWxzZSBpZiAod2EgPT09ICdhZGRUYXNrJykgYm9keSA9IGYuZGV0YWlscyB8fCAnJztcbiAgZWxzZSBib2R5ID0gZi5ub3RlcyB8fCBmLmJvZHkgfHwgJyc7XG4gIC8vIExvY2tlZCA9IGEgY29uZmlkZW50LCBmaWxlZCB0YXJnZXQuIFVuZmlsZWQgb3IgbG93LWNvbmZpZGVuY2UgZm9yY2VzIGEgcGljay5cbiAgY29uc3QgbG9ja2VkID0gIWQudW5maWxlZCAmJiAhIXRndC5pZCAmJiB0Z3QuY29uZmlkZW5jZSAhPT0gJ2xvdyc7XG4gIGNhcC5waWNrSW5kZXggPSB7fTtcbiAgY2FwLnBpY2tRdWVyeSA9ICcnO1xuICBjYXAuZWRpdCA9IHtcbiAgICB0YXJnZXRLaW5kOiBraW5kLCB3cml0ZUFjdGlvbjogd2EsXG4gICAgdGFyZ2V0SWQ6IGxvY2tlZCA/ICh0Z3QuaWQgfHwgJycpIDogJycsIHRhcmdldE5hbWU6IGxvY2tlZCA/ICh0Z3QubmFtZSB8fCAnJykgOiAnJyxcbiAgICBub3RlVHlwZTogZi5ub3RlVHlwZSB8fCAnJywgdG91ckZvcm1hdDogZi50b3VyRm9ybWF0IHx8ICcnLFxuICAgIHR5cGU6IGYudHlwZSB8fCAnJywgcHJpb3JpdHk6IGYucHJpb3JpdHkgfHwgJycsXG4gICAgZGF0ZTogZi5kYXRlIHx8IGYuZHVlRGF0ZSB8fCAnJywgdG91ckRhdGU6IGYudG91ckRhdGUgfHwgZi5kYXRlIHx8ICcnLCBkdWVEYXRlOiBmLmR1ZURhdGUgfHwgZi5kYXRlIHx8ICcnLFxuICAgIGJvZHk6IGJvZHksIHN1YmplY3Q6IGYuc3ViamVjdCB8fCAnJywgdGl0bGU6IGYudGl0bGUgfHwgJycsIGNvbnRhY3Q6IGYuY29udGFjdCB8fCAnJyxcbiAgICBwaWNraW5nOiAhbG9ja2VkLFxuICB9O1xuICBpZiAodGd0LmlkKSBjYXAucGlja0luZGV4W3RndC5pZF0gPSB0Z3QubmFtZSB8fCAnJztcbiAgKCh0Z3QuYWx0ZXJuYXRpdmVzIHx8IFtdKSBhcyBhbnlbXSkuZm9yRWFjaChhID0+IHsgaWYgKGEgJiYgYS5pZCkgY2FwLnBpY2tJbmRleFthLmlkXSA9IGEubmFtZSB8fCAnJzsgfSk7XG4gIGNhcC5kYXRlUHJvdmVuYW5jZSA9IChkICYmIGQuZGF0ZVByb3ZlbmFuY2UpIHx8ICcnO1xuICBjb25zdCBleCA9ICgoZCAmJiBkLmV4dHJhY3RlZFRhc2tzKSB8fCBbXSkgYXMgYW55W107XG4gIGNhcC5leHRyYWN0ZWRUYXNrcyA9IGV4Lm1hcCh0ID0+ICh7IHRpdGxlOiB0LnRpdGxlIHx8ICcnLCBkZXRhaWxzOiB0LmRldGFpbHMgfHwgJycsIGR1ZURhdGU6IHQuZHVlRGF0ZSB8fCAnJywgb246IHQuZGVmYXVsdE9uICE9PSBmYWxzZSB9KSk7XG59XG5cbi8vIC0tLS0gbWFudWFsIG1vZGUgKGNyZWRpdHMgYmxvY2tlZCBcdTIxOTIgdGhlIHdvcmRzIG11c3Qgc3RpbGwgYmUgZmlsZWFibGUpIC0tLS1cbmZ1bmN0aW9uIGJpcUNhcEVudGVyTWFudWFsKGJsb2NrTXNnPzogc3RyaW5nKTogdm9pZCB7XG4gIGlmICghQklRX0NBUCkgcmV0dXJuO1xuICBjb25zdCBjYXAgPSBCSVFfQ0FQO1xuICBjb25zdCBjdHggPSBiaXFDb250ZXh0KCk7XG4gIGNvbnN0IGtpbmQ6ICdjbGllbnQnIHwgJ3Byb2dyYW0nID0gKGN0eC5wcm9ncmFtSWQgJiYgIWN0eC5jbGllbnRJZCkgPyAncHJvZ3JhbScgOiAnY2xpZW50JztcbiAgY2FwLm1hbnVhbEJsb2NrID0gYmxvY2tNc2cgfHwgJ0JsdWVJUSBpbnRlcnByZXRhdGlvbiBpcyBwYXVzZWQgKG91dCBvZiBtb250aGx5IGNyZWRpdHMpLiBZb3UgY2FuIHN0aWxsIGZpbGUgdGhpcyBub3RlIG1hbnVhbGx5Lic7XG4gIGNhcC5waWNrSW5kZXggPSB7fTsgY2FwLnBpY2tRdWVyeSA9ICcnO1xuICBjb25zdCB0aWQgPSBraW5kID09PSAncHJvZ3JhbScgPyAoY3R4LnByb2dyYW1JZCB8fCAnJykgOiAoY3R4LmNsaWVudElkIHx8ICcnKTtcbiAgY29uc3QgdG5tID0ga2luZCA9PT0gJ3Byb2dyYW0nID8gKGN0eC5wcm9ncmFtTmFtZSB8fCAnJykgOiAoY3R4LmNsaWVudE5hbWUgfHwgJycpO1xuICBpZiAodGlkKSBjYXAucGlja0luZGV4W3RpZF0gPSB0bm07XG4gIGNhcC5lZGl0ID0ge1xuICAgIHRhcmdldEtpbmQ6IGtpbmQsIHdyaXRlQWN0aW9uOiBraW5kID09PSAncHJvZ3JhbScgPyAnYWRkUHJvZ3JhbU5vdGUnIDogJ2FkZENvbW11bmljYXRpb24nLFxuICAgIHRhcmdldElkOiB0aWQsIHRhcmdldE5hbWU6IHRubSxcbiAgICBub3RlVHlwZTogJycsIHRvdXJGb3JtYXQ6ICcnLCB0eXBlOiAnJywgcHJpb3JpdHk6ICcnLFxuICAgIGRhdGU6IGJpcVRvZGF5KCksIHRvdXJEYXRlOiBiaXFUb2RheSgpLCBkdWVEYXRlOiAnJyxcbiAgICBib2R5OiAnJywgc3ViamVjdDogJycsIHRpdGxlOiAnJywgY29udGFjdDogJycsIHBpY2tpbmc6ICF0aWQsXG4gIH07XG4gIGNhcC5zdGFnZSA9ICdtYW51YWwnO1xuICBiaXFSZW5kZXIoKTtcbn1cbmZ1bmN0aW9uIGJpcUNhcE1hbnVhbEtpbmQoa2luZDogJ2NsaWVudCcgfCAncHJvZ3JhbScpOiB2b2lkIHtcbiAgaWYgKCFCSVFfQ0FQKSByZXR1cm47XG4gIGNvbnN0IHRhID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2JpcS1tLXRleHQnKSBhcyBIVE1MVGV4dEFyZWFFbGVtZW50IHwgbnVsbDtcbiAgaWYgKHRhKSBCSVFfQ0FQLnJhd1RleHQgPSB0YS52YWx1ZTtcbiAgQklRX0NBUC5lZGl0LnRhcmdldEtpbmQgPSBraW5kO1xuICBCSVFfQ0FQLmVkaXQud3JpdGVBY3Rpb24gPSBraW5kID09PSAncHJvZ3JhbScgPyAnYWRkUHJvZ3JhbU5vdGUnIDogJ2FkZENvbW11bmljYXRpb24nO1xuICBCSVFfQ0FQLmVkaXQudGFyZ2V0SWQgPSAnJzsgQklRX0NBUC5lZGl0LnRhcmdldE5hbWUgPSAnJzsgQklRX0NBUC5lZGl0LnBpY2tpbmcgPSB0cnVlO1xuICBCSVFfQ0FQLnBpY2tRdWVyeSA9ICcnO1xuICBiaXFSZW5kZXIoKTtcbn1cbmFzeW5jIGZ1bmN0aW9uIGJpcUNhcE1hbnVhbFNhdmUoKTogUHJvbWlzZTx2b2lkPiB7XG4gIGlmICghQklRX0NBUCkgcmV0dXJuO1xuICBjb25zdCBjYXAgPSBCSVFfQ0FQO1xuICBjb25zdCB0YSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdiaXEtbS10ZXh0JykgYXMgSFRNTFRleHRBcmVhRWxlbWVudCB8IG51bGw7XG4gIGlmICh0YSkgY2FwLnJhd1RleHQgPSB0YS52YWx1ZTtcbiAgY29uc3QgdHkgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYmlxLW0tdHlwZScpIGFzIEhUTUxTZWxlY3RFbGVtZW50IHwgSFRNTElucHV0RWxlbWVudCB8IG51bGw7XG4gIGNvbnN0IHR5cGUgPSB0eSA/IFN0cmluZyh0eS52YWx1ZSkgOiAnJztcbiAgY29uc3QgZSA9IGNhcC5lZGl0O1xuICBjb25zdCBib2R5ID0gKGNhcC5yYXdUZXh0IHx8ICcnKS50cmltKCk7XG4gIGlmICghZS50YXJnZXRJZCkgeyBjYXAuZXJyb3IgPSAnQ2hvb3NlIHdoZXJlIHRvIGZpbGUgdGhpcyBmaXJzdC4nOyBiaXFSZW5kZXIoKTsgcmV0dXJuOyB9XG4gIGlmICghYm9keSkgeyBjYXAuZXJyb3IgPSAnV3JpdGUgeW91ciBub3RlIGZpcnN0Lic7IGJpcVJlbmRlcigpOyByZXR1cm47IH1cbiAgY2FwLmVycm9yID0gJyc7IGNhcC5zdGFnZSA9ICdzYXZpbmcnOyBiaXFSZW5kZXIoKTtcbiAgY29uc3QgcmVmczogQmlxU2F2ZWRSZWZbXSA9IFtdO1xuICB0cnkge1xuICAgIGlmIChlLnRhcmdldEtpbmQgPT09ICdwcm9ncmFtJykge1xuICAgICAgY29uc3QgY3JlYXRlZCA9IGF3YWl0IGFwaUNhcHR1cmVBZGRQcm9ncmFtTm90ZShlLnRhcmdldElkLCB7IGNhY2hlZE5hbWU6IGUudGFyZ2V0TmFtZSB9LCB7IGJvZHk6IGJvZHksIG5vdGVUeXBlOiB0eXBlIH0sIGNhcC5yYXdUZXh0IHx8ICcnKTtcbiAgICAgIHJlZnMucHVzaCh7IGtpbmQ6ICdwcm9ncmFtTm90ZScsIHRhcmdldElkOiBlLnRhcmdldElkLCBlbnRyeUlkOiBTdHJpbmcoKGNyZWF0ZWQgJiYgY3JlYXRlZC5lbnRyeUlkKSB8fCAnJykgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGNyZWF0ZWQgPSBhd2FpdCBhcGlDYXB0dXJlQWRkQ29tbXVuaWNhdGlvbihlLnRhcmdldElkLCB7IG5vdGVzOiBib2R5LCB0eXBlOiB0eXBlLCBkYXRlOiBiaXFUb2RheSgpIH0sIGNhcC5yYXdUZXh0IHx8ICcnKTtcbiAgICAgIHJlZnMucHVzaCh7IGtpbmQ6ICdjb21tdW5pY2F0aW9uJywgdGFyZ2V0SWQ6IGUudGFyZ2V0SWQsIGVudHJ5SWQ6IFN0cmluZygoY3JlYXRlZCAmJiBjcmVhdGVkLmVudHJ5SWQpIHx8ICcnKSB9KTtcbiAgICB9XG4gIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgY2FwLmVycm9yID0gKGVyciAmJiBlcnIubWVzc2FnZSkgPyBlcnIubWVzc2FnZSA6IFN0cmluZyhlcnIpO1xuICAgIGNhcC5zdGFnZSA9ICdtYW51YWwnOyBiaXFSZW5kZXIoKTsgcmV0dXJuO1xuICB9XG4gIGNhcC5zYXZlZFJlZnMgPSByZWZzOyBjYXAuZmFpbGVkVGFza3MgPSBbXTsgY2FwLmV4dHJhY3RlZFNhdmVkID0gMDtcbiAgY2FwLnNhdmVkRGVzdCA9IHsga2luZDogZS50YXJnZXRLaW5kLCBpZDogZS50YXJnZXRJZCwgbmFtZTogZS50YXJnZXROYW1lIH07XG4gIGNhcC5zdGFnZSA9ICdzYXZlZCc7IGJpcVJlbmRlcigpO1xufVxuXG4vLyAtLS0tIHRhcmdldCBwaWNrZXIgKHNoYXJlZCBieSBkcmFmdCArIG1hbnVhbCkgLS0tLVxuZnVuY3Rpb24gYmlxQ2FwUGlja0Nob29zZShpZDogc3RyaW5nKTogdm9pZCB7XG4gIGlmICghQklRX0NBUCkgcmV0dXJuO1xuICBjb25zdCBubSA9IEJJUV9DQVAucGlja0luZGV4W2lkXSB8fCBpZDtcbiAgQklRX0NBUC5lZGl0LnRhcmdldElkID0gaWQ7IEJJUV9DQVAuZWRpdC50YXJnZXROYW1lID0gbm07IEJJUV9DQVAuZWRpdC5waWNraW5nID0gZmFsc2U7XG4gIEJJUV9DQVAuZXJyb3IgPSAnJztcbiAgYmlxUmVuZGVyKCk7XG59XG5mdW5jdGlvbiBiaXFDYXBDaGFuZ2VUYXJnZXQoKTogdm9pZCB7XG4gIGlmICghQklRX0NBUCkgcmV0dXJuO1xuICBiaXFDYXBTeW5jKCk7XG4gIEJJUV9DQVAuZWRpdC5waWNraW5nID0gdHJ1ZTsgQklRX0NBUC5waWNrUXVlcnkgPSAnJztcbiAgYmlxUmVuZGVyKCk7XG59XG4vLyBSZS1maWx0ZXIgdGhlIHBpY2tlciBsaXN0IGluIHBsYWNlIChrZWVwcyBpbnB1dCBmb2N1cy9jYXJldCkuXG5mdW5jdGlvbiBiaXFDYXBQaWNrRmlsdGVyKCk6IHZvaWQge1xuICBpZiAoIUJJUV9DQVApIHJldHVybjtcbiAgY29uc3QgaW5wID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2JpcS1waWNrLWlucHV0JykgYXMgSFRNTElucHV0RWxlbWVudCB8IG51bGw7XG4gIGNvbnN0IHEgPSBpbnAgPyBpbnAudmFsdWUgOiAnJztcbiAgQklRX0NBUC5waWNrUXVlcnkgPSBxO1xuICBjb25zdCBsaXN0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2JpcS1waWNrLWxpc3QnKTtcbiAgaWYgKGxpc3QpIGxpc3QuaW5uZXJIVE1MID0gYmlxQ2FwUGlja0xpc3RIdG1sKEJJUV9DQVAuZWRpdC50YXJnZXRLaW5kLCBxKTtcbn1cbmZ1bmN0aW9uIGJpcUNhcFBpY2tMaXN0SHRtbChraW5kOiAnY2xpZW50JyB8ICdwcm9ncmFtJywgcTogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgY2FwID0gQklRX0NBUDsgaWYgKCFjYXApIHJldHVybiAnJztcbiAgY29uc3QgcTIgPSAocSB8fCAnJykudG9Mb3dlckNhc2UoKS50cmltKCk7XG4gIGNvbnN0IGl0ZW1zID0ga2luZCA9PT0gJ3Byb2dyYW0nID8gYmlxQ2FwUHJvZ3JhbXMoKSA6IGJpcUNhcENsaWVudHMoKTtcbiAgbGV0IGxpc3QgPSBpdGVtcztcbiAgaWYgKHEyKSBsaXN0ID0gaXRlbXMuZmlsdGVyKHggPT4geC5uYW1lLnRvTG93ZXJDYXNlKCkuaW5kZXhPZihxMikgPj0gMCk7XG4gIGxpc3QgPSBsaXN0LnNsaWNlKDAsIDMwKTtcbiAgaWYgKCFsaXN0Lmxlbmd0aCkgcmV0dXJuICc8ZGl2IGNsYXNzPVwiYmlxLXBpY2stZW1wdHlcIj4nICsgKGl0ZW1zLmxlbmd0aCA/ICdObyBtYXRjaGVzLicgOiAnTG9hZGluZ1x1MjAyNicpICsgJzwvZGl2Pic7XG4gIHJldHVybiBsaXN0Lm1hcCh4ID0+IHsgY2FwLnBpY2tJbmRleFt4LmlkXSA9IHgubmFtZTsgcmV0dXJuICc8YnV0dG9uIGNsYXNzPVwiYmlxLXBpY2staXRlbVwiIG9uY2xpY2s9XCJiaXFDYXBQaWNrQ2hvb3NlKFxcJycgKyBlc2MoeC5pZCkgKyAnXFwnKVwiPicgKyBlc2MoeC5uYW1lKSArICc8L2J1dHRvbj4nOyB9KS5qb2luKCcnKTtcbn1cbmZ1bmN0aW9uIGJpcUNhcFBpY2tlcihraW5kOiAnY2xpZW50JyB8ICdwcm9ncmFtJyk6IHN0cmluZyB7XG4gIGNvbnN0IGNhcCA9IEJJUV9DQVA7IGlmICghY2FwKSByZXR1cm4gJyc7XG4gIGNvbnN0IGxhYmVsID0ga2luZCA9PT0gJ3Byb2dyYW0nID8gJ3Byb2dyYW0nIDogJ2NsaWVudCc7XG4gIC8vIFN1Z2dlc3RlZCB0YXJnZXQgKyBhbHRlcm5hdGl2ZXMgYmVjb21lIG9uZS10YXAgY2hpcHMgKGRyYWZ0IG1vZGUgb25seSkuXG4gIGxldCBjaGlwcyA9ICcnO1xuICBjb25zdCBkID0gY2FwLmRyYWZ0O1xuICBpZiAoZCAmJiBkLnRhcmdldCkge1xuICAgIGNvbnN0IHNlZW46IFJlY29yZDxzdHJpbmcsIGJvb2xlYW4+ID0ge307XG4gICAgY29uc3QgY2FuZDogYW55W10gPSBbXTtcbiAgICBpZiAoZC50YXJnZXQuaWQpIGNhbmQucHVzaCh7IGlkOiBkLnRhcmdldC5pZCwgbmFtZTogZC50YXJnZXQubmFtZSB9KTtcbiAgICAoKGQudGFyZ2V0LmFsdGVybmF0aXZlcyB8fCBbXSkgYXMgYW55W10pLmZvckVhY2goYSA9PiBjYW5kLnB1c2goYSkpO1xuICAgIGNhbmQuZm9yRWFjaChhID0+IHtcbiAgICAgIGlmIChhICYmIGEuaWQgJiYgIXNlZW5bYS5pZF0pIHtcbiAgICAgICAgc2VlblthLmlkXSA9IHRydWU7IGNhcC5waWNrSW5kZXhbYS5pZF0gPSBhLm5hbWUgfHwgJyc7XG4gICAgICAgIGNoaXBzICs9ICc8YnV0dG9uIGNsYXNzPVwiYmlxLWFsdFwiIG9uY2xpY2s9XCJiaXFDYXBQaWNrQ2hvb3NlKFxcJycgKyBlc2MoYS5pZCkgKyAnXFwnKVwiPicgKyBlc2MoYS5uYW1lIHx8IGEuaWQpICsgJzwvYnV0dG9uPic7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbiAgcmV0dXJuICc8ZGl2IGNsYXNzPVwiYmlxLXBpY2tcIj4nXG4gICAgKyAnPGlucHV0IGlkPVwiYmlxLXBpY2staW5wdXRcIiBjbGFzcz1cImJpcS1pbiBiaXEtcGljay1pbnB1dFwiIHBsYWNlaG9sZGVyPVwiU2VhcmNoICcgKyBsYWJlbCArICdzXHUyMDI2XCIgdmFsdWU9XCInICsgZXNjKGNhcC5waWNrUXVlcnkgfHwgJycpICsgJ1wiIG9uaW5wdXQ9XCJiaXFDYXBQaWNrRmlsdGVyKClcIj4nXG4gICAgKyAoY2hpcHMgPyAoJzxkaXYgY2xhc3M9XCJiaXEtYWx0c1wiPicgKyBjaGlwcyArICc8L2Rpdj4nKSA6ICcnKVxuICAgICsgJzxkaXYgY2xhc3M9XCJiaXEtcGljay1saXN0XCIgaWQ9XCJiaXEtcGljay1saXN0XCI+JyArIGJpcUNhcFBpY2tMaXN0SHRtbChraW5kLCBjYXAucGlja1F1ZXJ5IHx8ICcnKSArICc8L2Rpdj4nXG4gICAgKyAnPC9kaXY+Jztcbn1cblxuLy8gLS0tLSByZWFkIGV2ZXJ5IHByZXNlbnQgZWRpdGFibGUgY29udHJvbCBiYWNrIGludG8gZWRpdCBzdGF0ZSAoY2FsbCBiZWZvcmVcbi8vIGFueSByZS1yZW5kZXIgb3Igc2F2ZSBzbyB0eXBlZCBlZGl0cyBzdXJ2aXZlKSAtLS0tXG5mdW5jdGlvbiBiaXFDYXBTeW5jKCk6IHZvaWQge1xuICBpZiAoIUJJUV9DQVApIHJldHVybjtcbiAgY29uc3QgZSA9IEJJUV9DQVAuZWRpdDtcbiAgY29uc3QgdiA9IChpZDogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCA9PiB7IGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoaWQpIGFzIGFueTsgcmV0dXJuIGVsID8gU3RyaW5nKGVsLnZhbHVlKSA6IG51bGw7IH07XG4gIGxldCB4OiBzdHJpbmcgfCBudWxsO1xuICBpZiAoKHggPSB2KCdiaXEtZC1ib2R5JykpICE9PSBudWxsKSBlLmJvZHkgPSB4O1xuICBpZiAoKHggPSB2KCdiaXEtZC1zdWJqZWN0JykpICE9PSBudWxsKSBlLnN1YmplY3QgPSB4O1xuICBpZiAoKHggPSB2KCdiaXEtZC10aXRsZScpKSAhPT0gbnVsbCkgZS50aXRsZSA9IHg7XG4gIGlmICgoeCA9IHYoJ2JpcS1kLWNvbnRhY3QnKSkgIT09IG51bGwpIGUuY29udGFjdCA9IHg7XG4gIGlmICgoeCA9IHYoJ2JpcS1kLWRhdGUnKSkgIT09IG51bGwpIGUuZGF0ZSA9IHg7XG4gIGlmICgoeCA9IHYoJ2JpcS1kLXRvdXJkYXRlJykpICE9PSBudWxsKSBlLnRvdXJEYXRlID0geDtcbiAgaWYgKCh4ID0gdignYmlxLWQtZHVlZGF0ZScpKSAhPT0gbnVsbCkgZS5kdWVEYXRlID0geDtcbiAgaWYgKCh4ID0gdignYmlxLWQtbm90ZXR5cGUnKSkgIT09IG51bGwpIGUubm90ZVR5cGUgPSB4O1xuICBpZiAoKHggPSB2KCdiaXEtZC1jb21tdHlwZScpKSAhPT0gbnVsbCkgZS50eXBlID0geDtcbiAgaWYgKCh4ID0gdignYmlxLWQtdG91cmZvcm1hdCcpKSAhPT0gbnVsbCkgZS50b3VyRm9ybWF0ID0geDtcbiAgaWYgKCh4ID0gdignYmlxLWQtcHJpb3JpdHknKSkgIT09IG51bGwpIGUucHJpb3JpdHkgPSB4O1xuICBmb3IgKGxldCBpID0gMDsgaSA8IEJJUV9DQVAuZXh0cmFjdGVkVGFza3MubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBjYiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdiaXEtdGFzay0nICsgaSkgYXMgSFRNTElucHV0RWxlbWVudCB8IG51bGw7XG4gICAgaWYgKGNiKSBCSVFfQ0FQLmV4dHJhY3RlZFRhc2tzW2ldLm9uID0gY2IuY2hlY2tlZDtcbiAgfVxufVxuZnVuY3Rpb24gYmlxQ2FwTm90ZVR5cGVDaGFuZ2UoKTogdm9pZCB7IGlmICghQklRX0NBUCkgcmV0dXJuOyBiaXFDYXBTeW5jKCk7IGJpcVJlbmRlcigpOyB9XG5cbi8vIC0tLS0gc2F2ZSAtLS0tXG5hc3luYyBmdW5jdGlvbiBiaXFDYXBTYXZlKCk6IFByb21pc2U8dm9pZD4ge1xuICBpZiAoIUJJUV9DQVApIHJldHVybjtcbiAgYmlxQ2FwU3luYygpO1xuICBjb25zdCBjYXAgPSBCSVFfQ0FQO1xuICBjb25zdCBlID0gY2FwLmVkaXQ7XG4gIGlmICghZS50YXJnZXRJZCkgeyBjYXAuZXJyb3IgPSAnQ2hvb3NlIHdoZXJlIHRvIGZpbGUgdGhpcyBmaXJzdC4nOyBiaXFSZW5kZXIoKTsgcmV0dXJuOyB9XG4gIGNhcC5lcnJvciA9ICcnOyBjYXAuc3RhZ2UgPSAnc2F2aW5nJzsgYmlxUmVuZGVyKCk7XG4gIGNvbnN0IHRyYW5zY3JpcHQgPSBjYXAucmF3VGV4dCB8fCAnJztcbiAgY29uc3QgcmVmczogQmlxU2F2ZWRSZWZbXSA9IFtdO1xuICAvLyAxKSB0aGUgbWFpbiBub3RlIFx1MjAxNCBuZXZlciByb2xsZWQgYmFjayBvbmNlIGl0IGxhbmRzLlxuICB0cnkge1xuICAgIGlmIChlLndyaXRlQWN0aW9uID09PSAnYWRkUHJvZ3JhbU5vdGUnKSB7XG4gICAgICBjb25zdCBmaWVsZHM6IGFueSA9IHsgYm9keTogZS5ib2R5LCBub3RlVHlwZTogZS5ub3RlVHlwZSB9O1xuICAgICAgLy8gdG91ckRhdGUvdG91ckZvcm1hdCBvbmx5IGFwcGx5IHRvIFRvdXIgbm90ZXM7IGEgZ2VuZXJhbCBub3RlJ3MgZGF0ZSBpcyBjcmVhdGVkQXQuXG4gICAgICBpZiAoYmlxSXNUb3VyKGUubm90ZVR5cGUpKSB7XG4gICAgICAgIGlmIChlLnRvdXJEYXRlKSBmaWVsZHMudG91ckRhdGUgPSBlLnRvdXJEYXRlO1xuICAgICAgICBpZiAoZS50b3VyRm9ybWF0KSBmaWVsZHMudG91ckZvcm1hdCA9IGUudG91ckZvcm1hdDtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGNyZWF0ZWQgPSBhd2FpdCBhcGlDYXB0dXJlQWRkUHJvZ3JhbU5vdGUoZS50YXJnZXRJZCwgeyBjYWNoZWROYW1lOiBlLnRhcmdldE5hbWUgfSwgZmllbGRzLCB0cmFuc2NyaXB0KTtcbiAgICAgIHJlZnMucHVzaCh7IGtpbmQ6ICdwcm9ncmFtTm90ZScsIHRhcmdldElkOiBlLnRhcmdldElkLCBlbnRyeUlkOiBTdHJpbmcoKGNyZWF0ZWQgJiYgY3JlYXRlZC5lbnRyeUlkKSB8fCAnJykgfSk7XG4gICAgfSBlbHNlIGlmIChlLndyaXRlQWN0aW9uID09PSAnYWRkVGFzaycpIHtcbiAgICAgIGNvbnN0IGNyZWF0ZWQgPSBhd2FpdCBhcGlDYXB0dXJlQWRkVGFzayhlLnRhcmdldElkLCB7IHRpdGxlOiBlLnRpdGxlLCBkZXRhaWxzOiBlLmJvZHksIGR1ZURhdGU6IGUuZHVlRGF0ZSwgcHJpb3JpdHk6IGUucHJpb3JpdHkgfSwgdHJhbnNjcmlwdCk7XG4gICAgICByZWZzLnB1c2goeyBraW5kOiAndGFzaycsIHRhcmdldElkOiBlLnRhcmdldElkLCBlbnRyeUlkOiBTdHJpbmcoKGNyZWF0ZWQgJiYgY3JlYXRlZC5lbnRyeUlkKSB8fCAnJykgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGNyZWF0ZWQgPSBhd2FpdCBhcGlDYXB0dXJlQWRkQ29tbXVuaWNhdGlvbihlLnRhcmdldElkLCB7IG5vdGVzOiBlLmJvZHksIHN1YmplY3Q6IGUuc3ViamVjdCwgdHlwZTogZS50eXBlLCBkYXRlOiBlLmRhdGUsIGNvbnRhY3Q6IGUuY29udGFjdCB9LCB0cmFuc2NyaXB0KTtcbiAgICAgIHJlZnMucHVzaCh7IGtpbmQ6ICdjb21tdW5pY2F0aW9uJywgdGFyZ2V0SWQ6IGUudGFyZ2V0SWQsIGVudHJ5SWQ6IFN0cmluZygoY3JlYXRlZCAmJiBjcmVhdGVkLmVudHJ5SWQpIHx8ICcnKSB9KTtcbiAgICB9XG4gIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgY2FwLmVycm9yID0gKGVyciAmJiBlcnIubWVzc2FnZSkgPyBlcnIubWVzc2FnZSA6IFN0cmluZyhlcnIpO1xuICAgIGNhcC5zdGFnZSA9ICdkcmFmdCc7IGJpcVJlbmRlcigpOyByZXR1cm47XG4gIH1cbiAgLy8gMikgb2ZmZXJlZCBmb2xsb3ctdXAgdGFza3MgXHUyMDE0IG9ubHkgd2hlbiB0aGUgbWFpbiB0YXJnZXQgaXMgYSBjbGllbnQgKHRhc2tzXG4gIC8vICAgIGxpdmUgb24gY2xpZW50cykuIEEgZmFpbHVyZSBoZXJlIG5ldmVyIHJvbGxzIGJhY2sgdGhlIHNhdmVkIG5vdGUuXG4gIGxldCBleHRyYWN0ZWRTYXZlZCA9IDA7XG4gIGNvbnN0IGZhaWxlZDogQmlxQ2FwVGFza1tdID0gW107XG4gIGlmIChjYXAuZHJhZnQgJiYgY2FwLmRyYWZ0LnRhcmdldEtpbmQgPT09ICdjbGllbnQnICYmIGUudGFyZ2V0S2luZCA9PT0gJ2NsaWVudCcpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNhcC5leHRyYWN0ZWRUYXNrcy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgdCA9IGNhcC5leHRyYWN0ZWRUYXNrc1tpXTtcbiAgICAgIGlmICghdC5vbikgY29udGludWU7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBjdCA9IGF3YWl0IGFwaUNhcHR1cmVBZGRUYXNrKGUudGFyZ2V0SWQsIHsgdGl0bGU6IHQudGl0bGUsIGRldGFpbHM6IHQuZGV0YWlscywgZHVlRGF0ZTogdC5kdWVEYXRlLCBwcmlvcml0eTogJycgfSwgdHJhbnNjcmlwdCk7XG4gICAgICAgIHJlZnMucHVzaCh7IGtpbmQ6ICd0YXNrJywgdGFyZ2V0SWQ6IGUudGFyZ2V0SWQsIGVudHJ5SWQ6IFN0cmluZygoY3QgJiYgY3QuZW50cnlJZCkgfHwgJycpIH0pO1xuICAgICAgICBleHRyYWN0ZWRTYXZlZCsrO1xuICAgICAgfSBjYXRjaCAoX2UpIHsgZmFpbGVkLnB1c2godCk7IH1cbiAgICB9XG4gIH1cbiAgY2FwLnNhdmVkUmVmcyA9IHJlZnM7IGNhcC5mYWlsZWRUYXNrcyA9IGZhaWxlZDsgY2FwLmV4dHJhY3RlZFNhdmVkID0gZXh0cmFjdGVkU2F2ZWQ7XG4gIGNhcC5zYXZlZERlc3QgPSB7IGtpbmQ6IGUudGFyZ2V0S2luZCwgaWQ6IGUudGFyZ2V0SWQsIG5hbWU6IGUudGFyZ2V0TmFtZSB9O1xuICBjYXAuc3RhZ2UgPSAnc2F2ZWQnOyBiaXFSZW5kZXIoKTtcbn1cbmFzeW5jIGZ1bmN0aW9uIGJpcUNhcFJldHJ5VGFza3MoKTogUHJvbWlzZTx2b2lkPiB7XG4gIGlmICghQklRX0NBUCB8fCAhQklRX0NBUC5mYWlsZWRUYXNrcy5sZW5ndGgpIHJldHVybjtcbiAgY29uc3QgY2FwID0gQklRX0NBUDtcbiAgY29uc3QgZGVzdCA9IGNhcC5zYXZlZERlc3Q7XG4gIGlmICghZGVzdCkgcmV0dXJuO1xuICBjb25zdCBwZW5kaW5nID0gY2FwLmZhaWxlZFRhc2tzLnNsaWNlKCk7XG4gIGNhcC5mYWlsZWRUYXNrcyA9IFtdOyBiaXFSZW5kZXIoKTtcbiAgY29uc3Qgc3RpbGw6IEJpcUNhcFRhc2tbXSA9IFtdO1xuICBmb3IgKGNvbnN0IHQgb2YgcGVuZGluZykge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBjdCA9IGF3YWl0IGFwaUNhcHR1cmVBZGRUYXNrKGRlc3QuaWQsIHsgdGl0bGU6IHQudGl0bGUsIGRldGFpbHM6IHQuZGV0YWlscywgZHVlRGF0ZTogdC5kdWVEYXRlLCBwcmlvcml0eTogJycgfSwgY2FwLnJhd1RleHQgfHwgJycpO1xuICAgICAgY2FwLnNhdmVkUmVmcy5wdXNoKHsga2luZDogJ3Rhc2snLCB0YXJnZXRJZDogZGVzdC5pZCwgZW50cnlJZDogU3RyaW5nKChjdCAmJiBjdC5lbnRyeUlkKSB8fCAnJykgfSk7XG4gICAgICBjYXAuZXh0cmFjdGVkU2F2ZWQrKztcbiAgICB9IGNhdGNoIChfZSkgeyBzdGlsbC5wdXNoKHQpOyB9XG4gIH1cbiAgY2FwLmZhaWxlZFRhc2tzID0gc3RpbGw7IGJpcVJlbmRlcigpO1xufVxuLy8gU2Vzc2lvbi1zY29wZWQgdW5kbyBcdTIwMTQgZGVsZXRlIHdoYXRldmVyIHRoaXMgY2FwdHVyZSBqdXN0IGNyZWF0ZWQuXG5hc3luYyBmdW5jdGlvbiBiaXFDYXBVbmRvKCk6IFByb21pc2U8dm9pZD4ge1xuICBpZiAoIUJJUV9DQVAgfHwgIUJJUV9DQVAuc2F2ZWRSZWZzLmxlbmd0aCkgcmV0dXJuO1xuICBjb25zdCBjYXAgPSBCSVFfQ0FQO1xuICBjb25zdCByZWZzID0gY2FwLnNhdmVkUmVmcy5zbGljZSgpO1xuICBjYXAuc3RhZ2UgPSAnc2F2aW5nJzsgYmlxUmVuZGVyKCk7XG4gIGZvciAoY29uc3QgciBvZiByZWZzKSB7XG4gICAgaWYgKCFyLmVudHJ5SWQpIGNvbnRpbnVlO1xuICAgIHRyeSB7XG4gICAgICBpZiAoci5raW5kID09PSAncHJvZ3JhbU5vdGUnKSBhd2FpdCBhcGlEZWxldGVQcm9ncmFtTm90ZShyLnRhcmdldElkLCByLmVudHJ5SWQpO1xuICAgICAgZWxzZSBpZiAoci5raW5kID09PSAnY29tbXVuaWNhdGlvbicpIGF3YWl0IGFwaURlbGV0ZUNvbW11bmljYXRpb24oci50YXJnZXRJZCwgci5lbnRyeUlkKTtcbiAgICAgIGVsc2UgaWYgKHIua2luZCA9PT0gJ3Rhc2snKSBhd2FpdCBhcGlEZWxldGVUYXNrKHIudGFyZ2V0SWQsIHIuZW50cnlJZCk7XG4gICAgfSBjYXRjaCAoX2UpIHsgLyogYmVzdCBlZmZvcnQgKi8gfVxuICB9XG4gIGlmICh0eXBlb2YgdG9hc3QgPT09ICdmdW5jdGlvbicpIHRvYXN0KCdVbmRvbmUgXHUyMDE0IG5vdGhpbmcgd2FzIHNhdmVkLicpO1xuICBjYXAuc2F2ZWRSZWZzID0gW107IGNhcC5mYWlsZWRUYXNrcyA9IFtdOyBjYXAuZXJyb3IgPSAnJzsgY2FwLnN0YWdlID0gJ2lucHV0JztcbiAgYmlxUmVuZGVyKCk7XG59XG5cbi8vIC0tLS0gY2FwdHVyZSByZW5kZXIgKGFsbCBzdGFnZXMpIC0tLS1cbmZ1bmN0aW9uIGJpcUNhcEVycigpOiBzdHJpbmcge1xuICByZXR1cm4gKEJJUV9DQVAgJiYgQklRX0NBUC5lcnJvcikgPyAnPGRpdiBjbGFzcz1cImJpcS1jYXAtZXJyb3JcIj4nICsgaWMoJ2FsZXJ0JywgMTQpICsgJzxzcGFuPicgKyBlc2MoQklRX0NBUC5lcnJvcikgKyAnPC9zcGFuPjwvZGl2PicgOiAnJztcbn1cbmZ1bmN0aW9uIGJpcUNhcEJ1c3kobGFiZWw6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiAnPGRpdiBjbGFzcz1cImJpcS1jYXAtYnVzeVwiPjxkaXYgY2xhc3M9XCJiaXEtc3BpblwiPjwvZGl2PjxwPicgKyBlc2MobGFiZWwpICsgJzwvcD48L2Rpdj4nO1xufVxuZnVuY3Rpb24gYmlxQ2FwUm93KGxhYmVsOiBzdHJpbmcsIGlubmVyOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gJzxkaXYgY2xhc3M9XCJiaXEtZnJvd1wiPjxsYWJlbCBjbGFzcz1cImJpcS1mbGJsXCI+JyArIGVzYyhsYWJlbCkgKyAnPC9sYWJlbD48ZGl2IGNsYXNzPVwiYmlxLWZjdGxcIj4nICsgaW5uZXIgKyAnPC9kaXY+PC9kaXY+Jztcbn1cbi8vIEEgPHNlbGVjdD4gZnJvbSBhbiBvcHRpb24gbGlzdCwgb3IgYSBmcmVlLXRleHQgPGlucHV0PiB3aGVuIHRoZSBsaXN0IGlzIGVtcHR5XG4vLyAoYSBmcmVzaCBvcmcgbWF5IGhhdmUgbm8gb3B0aW9ucyBjb25maWd1cmVkIHlldCkuIFByZXNlcnZlcyB0aGUgY3VycmVudCB2YWx1ZS5cbmZ1bmN0aW9uIGJpcUNhcEZpZWxkKGlkOiBzdHJpbmcsIG9wdHM6IHN0cmluZ1tdLCBjdXI6IHN0cmluZywgb25jaGFuZ2U6IHN0cmluZyk6IHN0cmluZyB7XG4gIGlmICghb3B0cyB8fCAhb3B0cy5sZW5ndGgpIHtcbiAgICByZXR1cm4gJzxpbnB1dCBpZD1cIicgKyBpZCArICdcIiBjbGFzcz1cImJpcS1pblwiIHZhbHVlPVwiJyArIGVzYyhjdXIpICsgJ1wiJyArIChvbmNoYW5nZSA/ICgnIG9uaW5wdXQ9XCInICsgb25jaGFuZ2UgKyAnXCInKSA6ICcnKSArICc+JztcbiAgfVxuICBsZXQgbyA9ICc8b3B0aW9uIHZhbHVlPVwiXCI+PC9vcHRpb24+JztcbiAgbGV0IGhhcyA9IGZhbHNlO1xuICBvcHRzLmZvckVhY2godiA9PiB7IGlmICh2ID09PSBjdXIpIGhhcyA9IHRydWU7IG8gKz0gJzxvcHRpb24gdmFsdWU9XCInICsgZXNjKHYpICsgJ1wiJyArICh2ID09PSBjdXIgPyAnIHNlbGVjdGVkJyA6ICcnKSArICc+JyArIGVzYyh2KSArICc8L29wdGlvbj4nOyB9KTtcbiAgaWYgKGN1ciAmJiAhaGFzKSBvICs9ICc8b3B0aW9uIHZhbHVlPVwiJyArIGVzYyhjdXIpICsgJ1wiIHNlbGVjdGVkPicgKyBlc2MoY3VyKSArICc8L29wdGlvbj4nO1xuICByZXR1cm4gJzxzZWxlY3QgaWQ9XCInICsgaWQgKyAnXCIgY2xhc3M9XCJiaXEtaW5cIicgKyAob25jaGFuZ2UgPyAoJyBvbmNoYW5nZT1cIicgKyBvbmNoYW5nZSArICdcIicpIDogJycpICsgJz4nICsgbyArICc8L3NlbGVjdD4nO1xufVxuZnVuY3Rpb24gYmlxQ2FwRGVzdFByZWZpeCgpOiBzdHJpbmcge1xuICBpZiAoIUJJUV9DQVApIHJldHVybiAnTm90ZSc7XG4gIGNvbnN0IGUgPSBCSVFfQ0FQLmVkaXQ7XG4gIGlmIChlLndyaXRlQWN0aW9uID09PSAnYWRkUHJvZ3JhbU5vdGUnKSByZXR1cm4gZS5ub3RlVHlwZSA/IChlLm5vdGVUeXBlICsgJyBub3RlJykgOiAnUHJvZ3JhbSBub3RlJztcbiAgaWYgKGUud3JpdGVBY3Rpb24gPT09ICdhZGRUYXNrJykgcmV0dXJuICdUYXNrJztcbiAgcmV0dXJuIGUudHlwZSA/IGUudHlwZSA6ICdDb21tdW5pY2F0aW9uJztcbn1cbmZ1bmN0aW9uIGJpcUNhcElucHV0SHRtbCgpOiBzdHJpbmcge1xuICBjb25zdCBjYXAgPSBCSVFfQ0FQOyBpZiAoIWNhcCkgcmV0dXJuICcnO1xuICByZXR1cm4gYmlxQ2FwRXJyKClcbiAgICArICc8dGV4dGFyZWEgaWQ9XCJiaXEtY2FwLXRleHRcIiBjbGFzcz1cImJpcS1pbiBiaXEtdGEgYmlxLWNhcC10ZXh0XCIgcm93cz1cIjZcIj4nICsgZXNjKGNhcC5yYXdUZXh0IHx8ICcnKSArICc8L3RleHRhcmVhPidcbiAgICArICc8ZGl2IGNsYXNzPVwiYmlxLWNhcC1idG5zXCI+J1xuICAgICAgKyAnPGJ1dHRvbiBjbGFzcz1cImJpcS1idG4gYmlxLWJ0bi1taWNcIiBvbmNsaWNrPVwiYmlxQ2FwUmVjb3JkKClcIj4nICsgYmlxTWljKDE2KSArICcgRGljdGF0ZTwvYnV0dG9uPidcbiAgICAgICsgJzxidXR0b24gY2xhc3M9XCJiaXEtYnRuIGJpcS1idG4tcHJpbWFyeVwiIG9uY2xpY2s9XCJiaXFDYXBDb21wb3NlKClcIj5DcmVhdGUgZHJhZnQgJyArIGljKCdjaGV2UicsIDE1KSArICc8L2J1dHRvbj4nXG4gICAgKyAnPC9kaXY+Jztcbn1cbmZ1bmN0aW9uIGJpcUNhcFJlY0h0bWwoKTogc3RyaW5nIHtcbiAgcmV0dXJuICc8ZGl2IGNsYXNzPVwiYmlxLXJlY1wiPidcbiAgICArICc8ZGl2IGNsYXNzPVwiYmlxLXJlYy1kb3RcIj48L2Rpdj4nXG4gICAgKyAnPGRpdiBjbGFzcz1cImJpcS1yZWMtdGltZXJcIiBpZD1cImJpcS1yZWMtdGltZXJcIj4wOjAwPC9kaXY+J1xuICAgICsgJzxwIGNsYXNzPVwiYmlxLXJlYy1oaW50XCI+TGlzdGVuaW5nXHUyMDI2PC9wPidcbiAgICArICc8YnV0dG9uIGNsYXNzPVwiYmlxLWJ0biBiaXEtYnRuLXN0b3BcIiBvbmNsaWNrPVwiYmlxQ2FwU3RvcFJlYygpXCI+U3RvcCAmYW1wOyB0cmFuc2NyaWJlPC9idXR0b24+J1xuICAgICsgJzwvZGl2Pic7XG59XG5mdW5jdGlvbiBiaXFDYXBEcmFmdEh0bWwoKTogc3RyaW5nIHtcbiAgY29uc3QgY2FwID0gQklRX0NBUDsgaWYgKCFjYXApIHJldHVybiAnJztcbiAgY29uc3QgZSA9IGNhcC5lZGl0O1xuICBjb25zdCBkID0gY2FwLmRyYWZ0IHx8IHt9O1xuICBjb25zdCBraW5kID0gZS50YXJnZXRLaW5kO1xuICAvLyBkZXN0aW5hdGlvbiByb3dcbiAgbGV0IGRlc3Q6IHN0cmluZztcbiAgaWYgKGUucGlja2luZykge1xuICAgIGRlc3QgPSAnPGRpdiBjbGFzcz1cImJpcS1kZXN0LWJsb2NrXCI+PGRpdiBjbGFzcz1cImJpcS1kZXN0LWxibFwiPkZpbGUgdGhpcyB0byBhICcgKyAoa2luZCA9PT0gJ3Byb2dyYW0nID8gJ3Byb2dyYW0nIDogJ2NsaWVudCcpICsgJzo8L2Rpdj4nICsgYmlxQ2FwUGlja2VyKGtpbmQpICsgJzwvZGl2Pic7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgY29uZiA9IChkLnRhcmdldCAmJiBkLnRhcmdldC5jb25maWRlbmNlKSB8fCAnJztcbiAgICBjb25zdCBjb25mSGludCA9IGNvbmYgPyAnPHNwYW4gY2xhc3M9XCJiaXEtY29uZiBiaXEtY29uZi0nICsgZXNjKGNvbmYpICsgJ1wiPicgKyBlc2MoY29uZikgKyAnIG1hdGNoPC9zcGFuPicgOiAnJztcbiAgICBkZXN0ID0gJzxkaXYgY2xhc3M9XCJiaXEtZGVzdFwiPjxkaXYgY2xhc3M9XCJiaXEtZGVzdC1tYWluXCI+JyArIGJpcUtpbmRJY29uKGtpbmQpICsgJyA8Yj4nICsgZXNjKGJpcUNhcERlc3RQcmVmaXgoKSkgKyAnPC9iPiBcdTIxOTIgPHNwYW4gY2xhc3M9XCJiaXEtZGVzdC1uYW1lXCI+JyArIGVzYyhlLnRhcmdldE5hbWUgfHwgJ1x1MjAxNCcpICsgJzwvc3Bhbj4gJyArIGNvbmZIaW50ICsgJzwvZGl2PjxidXR0b24gY2xhc3M9XCJiaXEtY2hhbmdlXCIgb25jbGljaz1cImJpcUNhcENoYW5nZVRhcmdldCgpXCI+Y2hhbmdlPC9idXR0b24+PC9kaXY+JztcbiAgfVxuICAvLyBmaWVsZHMgKGJ5IHdyaXRlQWN0aW9uKVxuICBjb25zdCBwcm92ID0gY2FwLmRhdGVQcm92ZW5hbmNlID8gJzxzcGFuIGNsYXNzPVwiYmlxLXByb3ZcIj4nICsgZXNjKGNhcC5kYXRlUHJvdmVuYW5jZSkgKyAnPC9zcGFuPicgOiAnJztcbiAgbGV0IGZpZWxkcyA9ICcnO1xuICBpZiAoZS53cml0ZUFjdGlvbiA9PT0gJ2FkZFByb2dyYW1Ob3RlJykge1xuICAgIGZpZWxkcyArPSBiaXFDYXBSb3coJ05vdGUgdHlwZScsIGJpcUNhcEZpZWxkKCdiaXEtZC1ub3RldHlwZScsIFBST0dSQU1fTk9URV9UWVBFUywgZS5ub3RlVHlwZSwgJ2JpcUNhcE5vdGVUeXBlQ2hhbmdlKCknKSk7XG4gICAgLy8gUHJvZ3JhbSBub3RlcyBvbmx5IGNhcnJ5IGEgdXNlciBkYXRlIHdoZW4gdGhleSdyZSBhIFRvdXIgKHRvdXJEYXRlKTsgYVxuICAgIC8vIGdlbmVyYWwgbm90ZSBpcyBkYXRlZCBieSBpdHMgc2VydmVyLXN0YW1wZWQgY3JlYXRlZEF0LCBzbyBubyBkYXRlIHJvdy5cbiAgICBpZiAoYmlxSXNUb3VyKGUubm90ZVR5cGUpKSB7XG4gICAgICBmaWVsZHMgKz0gYmlxQ2FwUm93KCdUb3VyIGRhdGUnLCAnPGlucHV0IHR5cGU9XCJkYXRlXCIgaWQ9XCJiaXEtZC10b3VyZGF0ZVwiIGNsYXNzPVwiYmlxLWluXCIgdmFsdWU9XCInICsgZXNjKGUudG91ckRhdGUpICsgJ1wiPicgKyBwcm92KTtcbiAgICAgIGZpZWxkcyArPSBiaXFDYXBSb3coJ1RvdXIgZm9ybWF0JywgYmlxQ2FwRmllbGQoJ2JpcS1kLXRvdXJmb3JtYXQnLCBUT1VSX0ZPUk1BVFMsIGUudG91ckZvcm1hdCwgJycpKTtcbiAgICB9XG4gICAgZmllbGRzICs9IGJpcUNhcFJvdygnTm90ZScsICc8dGV4dGFyZWEgaWQ9XCJiaXEtZC1ib2R5XCIgY2xhc3M9XCJiaXEtaW4gYmlxLXRhXCIgcm93cz1cIjVcIj4nICsgZXNjKGUuYm9keSkgKyAnPC90ZXh0YXJlYT4nKTtcbiAgfSBlbHNlIGlmIChlLndyaXRlQWN0aW9uID09PSAnYWRkVGFzaycpIHtcbiAgICBmaWVsZHMgKz0gYmlxQ2FwUm93KCdUaXRsZScsICc8aW5wdXQgaWQ9XCJiaXEtZC10aXRsZVwiIGNsYXNzPVwiYmlxLWluXCIgdmFsdWU9XCInICsgZXNjKGUudGl0bGUpICsgJ1wiPicpO1xuICAgIGZpZWxkcyArPSBiaXFDYXBSb3coJ1ByaW9yaXR5JywgYmlxQ2FwRmllbGQoJ2JpcS1kLXByaW9yaXR5JywgVEFTS19QUklPUklUSUVTLCBlLnByaW9yaXR5LCAnJykpO1xuICAgIGZpZWxkcyArPSBiaXFDYXBSb3coJ0R1ZSBkYXRlJywgJzxpbnB1dCB0eXBlPVwiZGF0ZVwiIGlkPVwiYmlxLWQtZHVlZGF0ZVwiIGNsYXNzPVwiYmlxLWluXCIgdmFsdWU9XCInICsgZXNjKGUuZHVlRGF0ZSkgKyAnXCI+JyArIHByb3YpO1xuICAgIGZpZWxkcyArPSBiaXFDYXBSb3coJ0RldGFpbHMnLCAnPHRleHRhcmVhIGlkPVwiYmlxLWQtYm9keVwiIGNsYXNzPVwiYmlxLWluIGJpcS10YVwiIHJvd3M9XCI1XCI+JyArIGVzYyhlLmJvZHkpICsgJzwvdGV4dGFyZWE+Jyk7XG4gIH0gZWxzZSB7XG4gICAgZmllbGRzICs9IGJpcUNhcFJvdygnQ2hhbm5lbCcsIGJpcUNhcEZpZWxkKCdiaXEtZC1jb21tdHlwZScsIENPTU1fVFlQRVMsIGUudHlwZSwgJycpKTtcbiAgICBmaWVsZHMgKz0gYmlxQ2FwUm93KCdTdW1tYXJ5JywgJzxpbnB1dCBpZD1cImJpcS1kLXN1YmplY3RcIiBjbGFzcz1cImJpcS1pblwiIHZhbHVlPVwiJyArIGVzYyhlLnN1YmplY3QpICsgJ1wiPicpO1xuICAgIGZpZWxkcyArPSBiaXFDYXBSb3coJ1Nwb2tlIHdpdGgnLCAnPGlucHV0IGlkPVwiYmlxLWQtY29udGFjdFwiIGNsYXNzPVwiYmlxLWluXCIgdmFsdWU9XCInICsgZXNjKGUuY29udGFjdCkgKyAnXCI+Jyk7XG4gICAgZmllbGRzICs9IGJpcUNhcFJvdygnRGF0ZScsICc8aW5wdXQgdHlwZT1cImRhdGVcIiBpZD1cImJpcS1kLWRhdGVcIiBjbGFzcz1cImJpcS1pblwiIHZhbHVlPVwiJyArIGVzYyhlLmRhdGUpICsgJ1wiPicgKyBwcm92KTtcbiAgICBmaWVsZHMgKz0gYmlxQ2FwUm93KCdOb3RlJywgJzx0ZXh0YXJlYSBpZD1cImJpcS1kLWJvZHlcIiBjbGFzcz1cImJpcS1pbiBiaXEtdGFcIiByb3dzPVwiNVwiPicgKyBlc2MoZS5ib2R5KSArICc8L3RleHRhcmVhPicpO1xuICB9XG4gIC8vIGV4dHJhY3RlZCBmb2xsb3ctdXAgdGFza3NcbiAgbGV0IHRhc2tzID0gJyc7XG4gIGlmIChjYXAuZXh0cmFjdGVkVGFza3MubGVuZ3RoKSB7XG4gICAgaWYgKGUudGFyZ2V0S2luZCA9PT0gJ2NsaWVudCcpIHtcbiAgICAgIGxldCByb3dzID0gJyc7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNhcC5leHRyYWN0ZWRUYXNrcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCB0ID0gY2FwLmV4dHJhY3RlZFRhc2tzW2ldO1xuICAgICAgICByb3dzICs9ICc8bGFiZWwgY2xhc3M9XCJiaXEtdGFza1wiPjxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBpZD1cImJpcS10YXNrLScgKyBpICsgJ1wiJyArICh0Lm9uID8gJyBjaGVja2VkJyA6ICcnKSArICc+PHNwYW4+JyArIGVzYyh0LnRpdGxlKSArICh0LmR1ZURhdGUgPyAoJyA8ZW0+JyArIGVzYyh0LmR1ZURhdGUpICsgJzwvZW0+JykgOiAnJykgKyAnPC9zcGFuPjwvbGFiZWw+JztcbiAgICAgIH1cbiAgICAgIHRhc2tzID0gJzxkaXYgY2xhc3M9XCJiaXEtdGFza3NcIj48ZGl2IGNsYXNzPVwiYmlxLXRhc2tzLWhcIj5Gb2xsb3ctdXAgdGFza3M8L2Rpdj4nICsgcm93cyArICc8L2Rpdj4nO1xuICAgIH0gZWxzZSB7XG4gICAgICBsZXQgcm93cyA9ICcnO1xuICAgICAgY2FwLmV4dHJhY3RlZFRhc2tzLmZvckVhY2godCA9PiB7IHJvd3MgKz0gJzxkaXYgY2xhc3M9XCJiaXEtdGFzayBiaXEtdGFzay1yb1wiPjxzcGFuPicgKyBlc2ModC50aXRsZSkgKyAodC5kdWVEYXRlID8gKCcgPGVtPicgKyBlc2ModC5kdWVEYXRlKSArICc8L2VtPicpIDogJycpICsgJzwvc3Bhbj48L2Rpdj4nOyB9KTtcbiAgICAgIHRhc2tzID0gJzxkaXYgY2xhc3M9XCJiaXEtdGFza3NcIj48ZGl2IGNsYXNzPVwiYmlxLXRhc2tzLWhcIj5Gb2xsb3ctdXAgdGFza3M8L2Rpdj48cCBjbGFzcz1cImJpcS1ub3RlXCI+UGljayBhIGNsaWVudCB0byBmaWxlIHRoZXNlLjwvcD4nICsgcm93cyArICc8L2Rpdj4nO1xuICAgIH1cbiAgfVxuICBjb25zdCBzYXZlTGJsID0gJ1NhdmUgdG8gJyArIChlLnRhcmdldE5hbWUgfHwgJ1x1MjAyNicpO1xuICBjb25zdCBidG5zID0gJzxkaXYgY2xhc3M9XCJiaXEtY2FwLWJ0bnNcIj4nXG4gICAgKyAnPGJ1dHRvbiBjbGFzcz1cImJpcS1idG4gYmlxLWJ0bi1wcmltYXJ5XCInICsgKGUudGFyZ2V0SWQgPyAnJyA6ICcgZGlzYWJsZWQnKSArICcgb25jbGljaz1cImJpcUNhcFNhdmUoKVwiPicgKyBpYygnY2hlY2snLCAxNSkgKyAnICcgKyBlc2Moc2F2ZUxibCkgKyAnPC9idXR0b24+J1xuICAgICsgJzxidXR0b24gY2xhc3M9XCJiaXEtYnRuIGJpcS1idG4tZ2hvc3RcIiBvbmNsaWNrPVwiYmlxQ2FwQmFja1RvSW5wdXQoKVwiPkNhbmNlbDwvYnV0dG9uPidcbiAgICArICc8L2Rpdj4nO1xuICByZXR1cm4gYmlxQ2FwRXJyKCkgKyBkZXN0ICsgJzxkaXYgY2xhc3M9XCJiaXEtZmllbGRzXCI+JyArIGZpZWxkcyArICc8L2Rpdj4nICsgdGFza3MgKyBidG5zO1xufVxuZnVuY3Rpb24gYmlxQ2FwTWFudWFsSHRtbCgpOiBzdHJpbmcge1xuICBjb25zdCBjYXAgPSBCSVFfQ0FQOyBpZiAoIWNhcCkgcmV0dXJuICcnO1xuICBjb25zdCBlID0gY2FwLmVkaXQ7XG4gIGNvbnN0IGJhbm5lciA9ICc8ZGl2IGNsYXNzPVwiYmlxLWNhcC1iYW5uZXJcIj4nICsgaWMoJ2luZm8nLCAxNCkgKyAnPHNwYW4+JyArIGVzYyhjYXAubWFudWFsQmxvY2sgfHwgJycpICsgJzwvc3Bhbj48L2Rpdj4nO1xuICBjb25zdCBraW5kVG9nZ2xlID0gJzxkaXYgY2xhc3M9XCJiaXEta2luZHRvZ2dsZVwiPidcbiAgICArICc8YnV0dG9uIGNsYXNzPVwiYmlxLWtpbmRidG4nICsgKGUudGFyZ2V0S2luZCA9PT0gJ2NsaWVudCcgPyAnIGFjdGl2ZScgOiAnJykgKyAnXCIgb25jbGljaz1cImJpcUNhcE1hbnVhbEtpbmQoXFwnY2xpZW50XFwnKVwiPkNsaWVudDwvYnV0dG9uPidcbiAgICArICc8YnV0dG9uIGNsYXNzPVwiYmlxLWtpbmRidG4nICsgKGUudGFyZ2V0S2luZCA9PT0gJ3Byb2dyYW0nID8gJyBhY3RpdmUnIDogJycpICsgJ1wiIG9uY2xpY2s9XCJiaXFDYXBNYW51YWxLaW5kKFxcJ3Byb2dyYW1cXCcpXCI+UHJvZ3JhbTwvYnV0dG9uPidcbiAgICArICc8L2Rpdj4nO1xuICBjb25zdCBkZXN0ID0gZS5waWNraW5nXG4gICAgPyAnPGRpdiBjbGFzcz1cImJpcS1kZXN0LWJsb2NrXCI+PGRpdiBjbGFzcz1cImJpcS1kZXN0LWxibFwiPkZpbGUgdG8gYSAnICsgKGUudGFyZ2V0S2luZCA9PT0gJ3Byb2dyYW0nID8gJ3Byb2dyYW0nIDogJ2NsaWVudCcpICsgJzo8L2Rpdj4nICsgYmlxQ2FwUGlja2VyKGUudGFyZ2V0S2luZCkgKyAnPC9kaXY+J1xuICAgIDogJzxkaXYgY2xhc3M9XCJiaXEtZGVzdFwiPjxkaXYgY2xhc3M9XCJiaXEtZGVzdC1tYWluXCI+JyArIGJpcUtpbmRJY29uKGUudGFyZ2V0S2luZCkgKyAnIDxzcGFuIGNsYXNzPVwiYmlxLWRlc3QtbmFtZVwiPicgKyBlc2MoZS50YXJnZXROYW1lIHx8ICdcdTIwMTQnKSArICc8L3NwYW4+PC9kaXY+PGJ1dHRvbiBjbGFzcz1cImJpcS1jaGFuZ2VcIiBvbmNsaWNrPVwiYmlxQ2FwQ2hhbmdlVGFyZ2V0KClcIj5jaGFuZ2U8L2J1dHRvbj48L2Rpdj4nO1xuICBjb25zdCB0eXBlT3B0cyA9IGUudGFyZ2V0S2luZCA9PT0gJ3Byb2dyYW0nID8gUFJPR1JBTV9OT1RFX1RZUEVTIDogQ09NTV9UWVBFUztcbiAgY29uc3QgdHlwZVJvdyA9IGJpcUNhcFJvdyhlLnRhcmdldEtpbmQgPT09ICdwcm9ncmFtJyA/ICdOb3RlIHR5cGUnIDogJ0NoYW5uZWwnLCBiaXFDYXBGaWVsZCgnYmlxLW0tdHlwZScsIHR5cGVPcHRzLCAnJywgJycpKTtcbiAgY29uc3QgdGV4dFJvdyA9IGJpcUNhcFJvdygnTm90ZScsICc8dGV4dGFyZWEgaWQ9XCJiaXEtbS10ZXh0XCIgY2xhc3M9XCJiaXEtaW4gYmlxLXRhXCIgcm93cz1cIjZcIj4nICsgZXNjKGNhcC5yYXdUZXh0IHx8ICcnKSArICc8L3RleHRhcmVhPicpO1xuICBjb25zdCBzYXZlTGJsID0gJ1NhdmUgdG8gJyArIChlLnRhcmdldE5hbWUgfHwgJ1x1MjAyNicpO1xuICBjb25zdCBidG5zID0gJzxkaXYgY2xhc3M9XCJiaXEtY2FwLWJ0bnNcIj4nXG4gICAgKyAnPGJ1dHRvbiBjbGFzcz1cImJpcS1idG4gYmlxLWJ0bi1wcmltYXJ5XCInICsgKGUudGFyZ2V0SWQgPyAnJyA6ICcgZGlzYWJsZWQnKSArICcgb25jbGljaz1cImJpcUNhcE1hbnVhbFNhdmUoKVwiPicgKyBpYygnY2hlY2snLCAxNSkgKyAnICcgKyBlc2Moc2F2ZUxibCkgKyAnPC9idXR0b24+J1xuICAgICsgJzxidXR0b24gY2xhc3M9XCJiaXEtYnRuIGJpcS1idG4tZ2hvc3RcIiBvbmNsaWNrPVwiYmlxQ2FwQ2FuY2VsKClcIj5DYW5jZWw8L2J1dHRvbj4nXG4gICAgKyAnPC9kaXY+JztcbiAgcmV0dXJuIGJhbm5lciArIGJpcUNhcEVycigpICsga2luZFRvZ2dsZSArIGRlc3QgKyAnPGRpdiBjbGFzcz1cImJpcS1maWVsZHNcIj4nICsgdHlwZVJvdyArIHRleHRSb3cgKyAnPC9kaXY+JyArIGJ0bnM7XG59XG5mdW5jdGlvbiBiaXFDYXBTYXZlZEh0bWwoKTogc3RyaW5nIHtcbiAgY29uc3QgY2FwID0gQklRX0NBUDsgaWYgKCFjYXAgfHwgIWNhcC5zYXZlZERlc3QpIHJldHVybiAnJztcbiAgY29uc3QgZGVzdCA9IGNhcC5zYXZlZERlc3Q7XG4gIGNvbnN0IGxpbmsgPSBkZXN0LmtpbmQgPT09ICdjbGllbnQnID8gKCcjL2NsaWVudHMvJyArIGVuY29kZVVSSUNvbXBvbmVudChkZXN0LmlkKSkgOiAoJyMvcHJvZ3JhbXMvJyArIGVuY29kZVVSSUNvbXBvbmVudChkZXN0LmlkKSk7XG4gIGNvbnN0IGZhaWwgPSBjYXAuZmFpbGVkVGFza3MubGVuZ3RoXG4gICAgPyAoJzxkaXYgY2xhc3M9XCJiaXEtY2FwLXdhcm5cIj4nICsgaWMoJ2FsZXJ0JywgMTQpICsgJzxzcGFuPk5vdGUgc2F2ZWQuICcgKyBjYXAuZmFpbGVkVGFza3MubGVuZ3RoICsgJyB0YXNrJyArIChjYXAuZmFpbGVkVGFza3MubGVuZ3RoID09PSAxID8gJycgOiAncycpICsgJyBmYWlsZWQgXHUyMDE0IDxidXR0b24gY2xhc3M9XCJiaXEtbGlua2J0blwiIG9uY2xpY2s9XCJiaXFDYXBSZXRyeVRhc2tzKClcIj5yZXRyeTwvYnV0dG9uPjwvc3Bhbj48L2Rpdj4nKVxuICAgIDogJyc7XG4gIGNvbnN0IGV4dHJhID0gY2FwLmV4dHJhY3RlZFNhdmVkID8gKCc8ZGl2IGNsYXNzPVwiYmlxLXNhdmVkLXN1YlwiPisgJyArIGNhcC5leHRyYWN0ZWRTYXZlZCArICcgZm9sbG93LXVwIHRhc2snICsgKGNhcC5leHRyYWN0ZWRTYXZlZCA9PT0gMSA/ICcnIDogJ3MnKSArICcgY3JlYXRlZDwvZGl2PicpIDogJyc7XG4gIHJldHVybiAnPGRpdiBjbGFzcz1cImJpcS1zYXZlZFwiPidcbiAgICArICc8ZGl2IGNsYXNzPVwiYmlxLXNhdmVkLWljb1wiPicgKyBpYygnY2hlY2snLCAzNCkgKyAnPC9kaXY+J1xuICAgICsgJzxkaXYgY2xhc3M9XCJiaXEtc2F2ZWQtbXNnXCI+U2F2ZWQgdG8gPGI+JyArIGVzYyhkZXN0Lm5hbWUpICsgJzwvYj48L2Rpdj4nXG4gICAgKyBleHRyYSArIGZhaWxcbiAgICArICc8ZGl2IGNsYXNzPVwiYmlxLWNhcC1idG5zXCI+J1xuICAgICAgKyAnPGEgY2xhc3M9XCJiaXEtYnRuIGJpcS1idG4tcHJpbWFyeVwiIGhyZWY9XCInICsgbGluayArICdcIiBvbmNsaWNrPVwiYmlxQ2FwQ2FuY2VsKClcIj4nICsgaWMoJ2V4dGVybmFsJywgMTUpICsgJyBPcGVuICcgKyBlc2MoZGVzdC5uYW1lKSArICc8L2E+J1xuICAgICAgKyAnPGJ1dHRvbiBjbGFzcz1cImJpcS1idG4gYmlxLWJ0bi1naG9zdFwiIG9uY2xpY2s9XCJiaXFDYXBVbmRvKClcIj5VbmRvPC9idXR0b24+J1xuICAgICsgJzwvZGl2PidcbiAgICArICc8ZGl2IGNsYXNzPVwiYmlxLWNhcC1idG5zMlwiPidcbiAgICAgICsgJzxidXR0b24gY2xhc3M9XCJiaXEtbGlua2J0blwiIG9uY2xpY2s9XCJiaXFDYXBTdGFydChcXCdpbnB1dFxcJylcIj5DYXB0dXJlIGFub3RoZXI8L2J1dHRvbj4nXG4gICAgICArICc8YnV0dG9uIGNsYXNzPVwiYmlxLWxpbmtidG5cIiBvbmNsaWNrPVwiYmlxQ2FwQ2FuY2VsKClcIj5Eb25lPC9idXR0b24+J1xuICAgICsgJzwvZGl2PidcbiAgICArICc8L2Rpdj4nO1xufVxuZnVuY3Rpb24gYmlxQ2FwSHRtbCgpOiBzdHJpbmcge1xuICBjb25zdCBjYXAgPSBCSVFfQ0FQOyBpZiAoIWNhcCkgcmV0dXJuICcnO1xuICBsZXQgaW5uZXI6IHN0cmluZztcbiAgc3dpdGNoIChjYXAuc3RhZ2UpIHtcbiAgICBjYXNlICdyZWNvcmRpbmcnOiBpbm5lciA9IGJpcUNhcFJlY0h0bWwoKTsgYnJlYWs7XG4gICAgY2FzZSAndHJhbnNjcmliaW5nJzogaW5uZXIgPSBiaXFDYXBCdXN5KCdUcmFuc2NyaWJpbmdcdTIwMjYnKTsgYnJlYWs7XG4gICAgY2FzZSAnY29tcG9zaW5nJzogaW5uZXIgPSBiaXFDYXBCdXN5KCdSZWFkaW5nIHlvdXIgbm90ZVx1MjAyNicpOyBicmVhaztcbiAgICBjYXNlICdkcmFmdCc6IGlubmVyID0gYmlxQ2FwRHJhZnRIdG1sKCk7IGJyZWFrO1xuICAgIGNhc2UgJ3NhdmluZyc6IGlubmVyID0gYmlxQ2FwQnVzeSgnU2F2aW5nXHUyMDI2Jyk7IGJyZWFrO1xuICAgIGNhc2UgJ3NhdmVkJzogaW5uZXIgPSBiaXFDYXBTYXZlZEh0bWwoKTsgYnJlYWs7XG4gICAgY2FzZSAnbWFudWFsJzogaW5uZXIgPSBiaXFDYXBNYW51YWxIdG1sKCk7IGJyZWFrO1xuICAgIGRlZmF1bHQ6IGlubmVyID0gYmlxQ2FwSW5wdXRIdG1sKCk7XG4gIH1cbiAgY29uc3QgaGVhZCA9ICc8ZGl2IGNsYXNzPVwiYmlxLWNhcC1oZWFkXCI+J1xuICAgICsgJzxidXR0b24gY2xhc3M9XCJiaXEtY2FwLWJhY2tcIiB0aXRsZT1cIkJhY2sgdG8gY2hhdFwiIGFyaWEtbGFiZWw9XCJCYWNrIHRvIGNoYXRcIiBvbmNsaWNrPVwiYmlxQ2FwQ2FuY2VsKClcIj4nICsgaWMoJ2NoZXZMJywgMTYpICsgJzwvYnV0dG9uPidcbiAgICArICc8c3BhbiBjbGFzcz1cImJpcS1jYXAtdGl0bGVcIj48c3BhbiBjbGFzcz1cImJpcS1zaGltbWVyXCI+Q2FwdHVyZTwvc3Bhbj4mbmJzcDthIG5vdGU8L3NwYW4+J1xuICAgICsgJzwvZGl2Pic7XG4gIHJldHVybiAnPGRpdiBjbGFzcz1cImJpcS1jYXBcIj4nICsgaGVhZCArIGlubmVyICsgJzwvZGl2Pic7XG59XG5cbi8vIC0tLS0gYm9vdDogbW91bnQgdGhlIHBlcnNpc3RlbnQgcm9vdCBvbmNlLCBvdXRzaWRlICNhcHAgLS0tLVxuLy8gQmx1ZUlRIGlzIGEgcGVyLXVzZXIgb3B0LWluIHNlYXQsIHNvIHdlIG9ubHkgbW91bnQgdGhlIGFzc2lzdGFudCB3aGVuIGl0J3Ncbi8vIGVuYWJsZWQgZm9yIHRoZSBjdXJyZW50IHVzZXIuIFdlIERFRkFVTFQgVE8gU0hPV0lORyBhbmQgaGlkZSBvbmx5IG9uIGFuXG4vLyBleHBsaWNpdCBlbmFibGVkOmZhbHNlIFx1MjAxNCBhIHRyYW5zaWVudCBzdGF0dXMgZXJyb3IgbXVzdCBub3QgaGlkZSBhIHBhaWRcbi8vIHByb2R1Y3QgKHRoZSBlbmRwb2ludCBhbHJlYWR5IHJlcG9ydHMgZW5hYmxlZDp0cnVlIGZvciBnYXRlIGhpY2N1cHMpLlxuYXN5bmMgZnVuY3Rpb24gYmlxSW5pdCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdfX2JpcS1yb290JykpIHJldHVybjtcbiAgbGV0IHNob3cgPSB0cnVlO1xuICB0cnkge1xuICAgIGNvbnN0IHN0YXR1cyA9IGF3YWl0IGFwaUJsdWVpcVN0YXR1cygpO1xuICAgIGlmIChzdGF0dXMgJiYgc3RhdHVzLmVuYWJsZWQgPT09IGZhbHNlKSBzaG93ID0gZmFsc2U7XG4gIH0gY2F0Y2ggKF9lKSB7IHNob3cgPSB0cnVlOyB9XG4gIGlmICghc2hvdykgcmV0dXJuO1xuICBpZiAoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ19fYmlxLXJvb3QnKSkgcmV0dXJuOyAvLyBndWFyZCBhZ2FpbnN0IGEgcmFjZVxuICBjb25zdCByb290ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIHJvb3QuaWQgPSAnX19iaXEtcm9vdCc7XG4gIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQocm9vdCk7XG4gIGJpcVJlbmRlcigpO1xuICAvLyBOYXZpZ2F0aW5nIGJldHdlZW4gcm91dGVzIGNoYW5nZXMgc2NvcGUgXHUyMDE0IHJlZnJlc2ggdGhlIGNoaXAgaWYgb3BlbiwgYW5kXG4gIC8vIHJlc2V0IGEgbWFudWFsIGJyb2FkZW4gc28gZWFjaCBwYWdlIHN0YXJ0cyBhdCBpdHMgbmF0dXJhbCBzY29wZS5cbiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ2hhc2hjaGFuZ2UnLCAoKSA9PiB7IEJJUV9GT1JDRV9HTE9CQUwgPSBmYWxzZTsgaWYgKEJJUV9PUEVOKSBiaXFSZW5kZXIoKTsgfSk7XG59XG5cbmlmIChkb2N1bWVudC5yZWFkeVN0YXRlICE9PSAnbG9hZGluZycpIGJpcUluaXQoKTtcbmVsc2UgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsIGJpcUluaXQpO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBb0JBLElBQUksV0FBVztBQUNmLElBQUksV0FBVztBQUNmLElBQUksbUJBQW1CO0FBQ3ZCLElBQUksV0FBcUIsQ0FBQztBQUkxQixTQUFTLGVBQWUsSUFBb0I7QUFDMUMsTUFBSTtBQUNGLFFBQUksT0FBTyxtQkFBbUIsZUFBZSxlQUFlLEVBQUUsS0FBSyxlQUFlLEVBQUUsRUFBRSxZQUFhLFFBQU8sZUFBZSxFQUFFLEVBQUU7QUFDN0gsUUFBSSxPQUFPLGtCQUFrQixlQUFlLGVBQWU7QUFDekQsaUJBQVcsS0FBSyxjQUFlLEtBQUksRUFBRSxPQUFPLEdBQUksUUFBTyxFQUFFLGVBQWU7QUFBQSxJQUMxRTtBQUFBLEVBQ0YsU0FBUyxJQUFJO0FBQUEsRUFBdUI7QUFDcEMsU0FBTztBQUNUO0FBT0EsU0FBUyxhQUFtTTtBQUMxTSxRQUFNLE9BQU8sU0FBUyxLQUFLLFFBQVEsTUFBTSxFQUFFLEtBQUs7QUFD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
