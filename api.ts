/* =====================================================================
   api.ts — the single seam between the SPA and the backend.
   Everything that creates/reads/updates/deletes data goes through the
   Master Maestro endpoint (/b/maestro) as a JSON action envelope:
     request : { action, ...fields }
     reply   : { ok:true, data } | { ok:false, error }
   Same-origin fetch — the BlueStep session cookie rides along automatically.
   ===================================================================== */

const MAESTRO_URL = '/b/maestro';

// POST an action to the maestro and return its `data`, or throw with the
// server's error message.
async function maestroPost(action: string, payload: Record<string, unknown>): Promise<any> {
  const res = await fetch(MAESTRO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: action, ...payload }),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch (_e) {
    throw new Error('Server returned a non-JSON response (HTTP ' + res.status + ').');
  }
  if (!json || json.ok !== true) {
    throw new Error(json && json.error ? json.error : 'Request failed (HTTP ' + res.status + ').');
  }
  return json.data;
}

// GET an action from the maestro and return its `data`, or throw.
async function maestroGet(action: string): Promise<any> {
  const res = await fetch(MAESTRO_URL + '?action=' + encodeURIComponent(action), { headers: { 'Accept': 'application/json' } });
  let json: any = null;
  try {
    json = await res.json();
  } catch (_e) {
    throw new Error('Server returned a non-JSON response (HTTP ' + res.status + ').');
  }
  if (!json || json.ok !== true) {
    throw new Error(json && json.error ? json.error : 'Request failed (HTTP ' + res.status + ').');
  }
  return json.data;
}

/* ---- BlueIQ assistant (separate endpoint /b/blueiq) ---- */
const BLUEIQ_URL = '/b/blueiq';

// POST an action to the BlueIQ endpoint; same envelope as the maestro
// ({ ok:true, data } | { ok:false, error }). Throws with the server's message.
async function blueiqPost(action: string, payload: Record<string, unknown>): Promise<any> {
  const res = await fetch(BLUEIQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: action, ...payload }),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch (_e) {
    throw new Error('BlueIQ returned a non-JSON response (HTTP ' + res.status + ').');
  }
  if (!json || json.ok !== true) {
    throw new Error(json && json.error ? json.error : 'BlueIQ request failed (HTTP ' + res.status + ').');
  }
  return json.data;
}

// Ask BlueIQ a question. `scope` is 'client' (bound to clientId) or 'global'
// (caseload-wide). `history` is the prior [{role,content}] turns. Resolves to
// { assistantMessage, toolCalls, usage }.
function apiBlueiqChat(scope: 'client' | 'global', clientId: string, question: string, history: { role: string; content: string }[], programId?: string, programName?: string, programFilter?: any): Promise<any> {
  return blueiqPost('chat', { scope: scope, clientId: clientId || '', question: question, history: history, programId: programId || '', programName: programName || '', programFilter: programFilter || null });
}

// Is BlueIQ enabled for the current user? Drives whether the assistant bubble
// mounts at all (BlueIQ is a per-user opt-in seat). Resolves to
// { enabled, allowed, reason, used, limit, remaining }.
function apiBlueiqStatus(): Promise<any> {
  return blueiqPost('status', {});
}

/* ---- BlueIQ note capture (transcribe + compose) ----
   These return the FULL envelope (never throw on ok:false) so the caller can
   branch on flags — a creditLimitReached compose can fall open to manual filing
   instead of surfacing as a hard error. */
async function blueiqPostRaw(action: string, payload: Record<string, unknown>): Promise<any> {
  const res = await fetch(BLUEIQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: action, ...payload }),
  });
  try { return await res.json(); }
  catch (_e) { return { ok: false, error: 'BlueIQ returned a non-JSON response (HTTP ' + res.status + ').' }; }
}
// Voice → transcript. `vocab` (client + program names) biases proper-noun spelling.
function apiBlueiqTranscribe(audioB64: string, mimeType: string, vocab: string[]): Promise<any> {
  return blueiqPostRaw('transcribe', { audio: audioB64, mimeType: mimeType, vocab: vocab || [] });
}
// Raw text → structured editable draft (nothing is written server-side).
function apiBlueiqCompose(payload: Record<string, unknown>): Promise<any> {
  return blueiqPostRaw('compose', payload);
}
// Allowed SingleSelect display-name values for note dropdowns (comm type, note
// type, tour format, task priority). Cached by the caller.
function apiNoteMeta(): Promise<any> {
  return maestroGet('noteMeta');
}

/* ---- Save a BlueIQ-captured note ---- adds capture provenance (capturedVia +
   verbatim sourceTranscript) as top-level keys; the maestro stamps them
   best-effort (no-op until the admin adds those fields to the forms). */
function apiCaptureAddCommunication(clientId: string, fields: Record<string, unknown>, transcript: string): Promise<any> {
  return maestroPost('addCommunication', { id: clientId, fields: fields, capturedVia: 'BlueIQ', sourceTranscript: transcript || '' });
}
function apiCaptureAddTask(clientId: string, fields: Record<string, unknown>, transcript: string): Promise<any> {
  return maestroPost('addTask', { id: clientId, fields: fields, capturedVia: 'BlueIQ', sourceTranscript: transcript || '' });
}
function apiCaptureAddProgramNote(dpid: string, hints: ProgramHints, fields: Record<string, unknown>, transcript: string): Promise<any> {
  return maestroPost('addProgramNote', { directoryProgramId: dpid, fields: fields, ...hints, capturedVia: 'BlueIQ', sourceTranscript: transcript || '' });
}

/* ---- BlueIQ admin (separate runAsSuper endpoint /b/blueiqAdmin) ----
   Firm-admin management of per-user BlueIQ seats. Every action is gated
   server-side to a BlueIQ admin (or global super). */
const BLUEIQ_ADMIN_URL = '/b/blueiqAdmin';

async function blueiqAdminPost(action: string, payload: Record<string, unknown>): Promise<any> {
  const res = await fetch(BLUEIQ_ADMIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: action, ...payload }),
  });
  let json: any = null;
  try { json = await res.json(); }
  catch (_e) { throw new Error('BlueIQ admin returned a non-JSON response (HTTP ' + res.status + ').'); }
  if (!json || json.ok !== true) {
    throw new Error(json && json.error ? json.error : 'BlueIQ admin request failed (HTTP ' + res.status + ').');
  }
  return json.data;
}

// Whether the current user may manage BlueIQ seats. { isSuper, isAdmin, enabled, user }.
function apiBlueiqAdminContext(): Promise<any> { return blueiqAdminPost('context', {}); }
// All org users merged with subscription state. { users:[…], defaultMonthlyCredits }.
function apiBlueiqListUsers(): Promise<any> { return blueiqAdminPost('listUsers', {}); }
// Upsert a user's seat. Only provided fields change.
function apiBlueiqSetSubscription(p: Record<string, unknown>): Promise<any> { return blueiqAdminPost('setSubscription', p); }
// Remove a user's seat entirely.
function apiBlueiqRemoveSubscription(userId: string): Promise<any> { return blueiqAdminPost('removeSubscription', { userId: userId }); }

// Create a Client record. Resolves to the full new record (all catalog fields).
function apiCreateClient(payload: Record<string, unknown>): Promise<any> {
  return maestroPost('createClient', payload);
}
// Create a person of a given category ('client' | 'inquiry' | 'alumni').
function apiCreatePerson(entity: string, payload: Record<string, unknown>): Promise<any> {
  const action = 'create' + entity.charAt(0).toUpperCase() + entity.slice(1);
  return maestroPost(action, payload);
}

// Update a Client record. Writes ONLY the keys in `fields` (partial save).
// Resolves to the full updated record.
function apiUpdateClient(id: string, fields: Record<string, unknown>): Promise<any> {
  return maestroPost('updateClient', { id: id, fields: fields });
}

// Permanently delete a Client record by full id. Irreversible on the server.
function apiDeleteClient(id: string): Promise<any> {
  return maestroPost('deleteClient', { id: id });
}

// Move a person between lifecycle stages ('inquiry' | 'client' | 'alumni'). The
// maestro reconciles the record's categories to the target stage's cumulative
// set. Returns { id, stage, changed, categories }.
function apiSetStage(id: string, stage: string): Promise<any> {
  return maestroPost('setStage', { id: id, stage: stage });
}

// List live Client records (raw rows from the maestro).
function apiListClients(): Promise<any[]> {
  return maestroGet('listClients');
}
// List live Inquiry / Alumni records (the other two Individual categories).
function apiListInquiries(): Promise<any[]> {
  return maestroGet('listInquiries');
}
function apiListAlumni(): Promise<any[]> {
  return maestroGet('listAlumni');
}

// Set (or clear) a Client's photo. `dataBase64` is RAW base64 (no data: prefix);
// pass '' to remove the photo. Resolves to the full updated record (with photo URL).
function apiSetClientPhoto(id: string, dataBase64: string, filename: string, contentType: string): Promise<any> {
  return maestroPost('uploadClientPhoto', { id: id, dataBase64: dataBase64, filename: filename, contentType: contentType });
}

// Set (or clear) the organization logo (a DocumentLinkField on the org record).
// `dataBase64` is RAW base64 (no data: prefix); pass '' to remove. Resolves to
// { logoUrl } — the same-origin image URL (or '' when cleared).
function apiUploadOrgLogo(dataBase64: string, filename: string, contentType: string): Promise<{ logoUrl: string }> {
  return maestroPost('uploadOrgLogo', { dataBase64: dataBase64, filename: filename, contentType: contentType });
}
function apiRemoveOrgLogo(): Promise<{ logoUrl: string }> {
  return maestroPost('uploadOrgLogo', { dataBase64: '' });
}

/* ---- contacts (multi-entry form on a client) ---- */
// All POST (the read needs the parent id in the body). Each contact carries an
// `entryId` (the MEF entry's full id) used to target updates/deletes.
function apiListContacts(clientId: string): Promise<any[]> {
  return maestroPost('listContacts', { id: clientId });
}
function apiAddContact(clientId: string, fields: Record<string, unknown>): Promise<any> {
  return maestroPost('addContact', { id: clientId, fields: fields });
}
function apiUpdateContact(clientId: string, entryId: string, fields: Record<string, unknown>): Promise<any> {
  return maestroPost('updateContact', { id: clientId, entryId: entryId, fields: fields });
}
function apiDeleteContact(clientId: string, entryId: string): Promise<any> {
  return maestroPost('deleteContact', { id: clientId, entryId: entryId });
}
// Set (or clear) one contact's photo. `dataBase64` is RAW base64; '' clears it.
function apiSetContactPhoto(clientId: string, entryId: string, dataBase64: string, filename: string, contentType: string): Promise<any> {
  return maestroPost('uploadContactPhoto', { id: clientId, entryId: entryId, dataBase64: dataBase64, filename: filename, contentType: contentType });
}

/* ---- communications (multi-entry "communications" form on a client) ----
   A simple communication log. Each entry carries an `entryId`. loggedBy/loggedAt
   are server-stamped on add (the logged-in user + the create instant). All POST
   (the read needs the parent id in the body). */
function apiListCommunications(clientId: string): Promise<any[]> {
  return maestroPost('listCommunications', { id: clientId });
}
function apiAddCommunication(clientId: string, fields: Record<string, unknown>): Promise<any> {
  return maestroPost('addCommunication', { id: clientId, fields: fields });
}
function apiUpdateCommunication(clientId: string, entryId: string, fields: Record<string, unknown>): Promise<any> {
  return maestroPost('updateCommunication', { id: clientId, entryId: entryId, fields: fields });
}
function apiDeleteCommunication(clientId: string, entryId: string): Promise<any> {
  return maestroPost('deleteCommunication', { id: clientId, entryId: entryId });
}

/* ---- tasks (multi-entry "tasks" form on a client) ---- */
function apiListTasks(clientId: string): Promise<any[]> {
  return maestroPost('listTasks', { id: clientId });
}
function apiAddTask(clientId: string, fields: Record<string, unknown>): Promise<any> {
  return maestroPost('addTask', { id: clientId, fields: fields });
}
function apiUpdateTask(clientId: string, entryId: string, fields: Record<string, unknown>): Promise<any> {
  return maestroPost('updateTask', { id: clientId, entryId: entryId, fields: fields });
}
function apiDeleteTask(clientId: string, entryId: string): Promise<any> {
  return maestroPost('deleteTask', { id: clientId, entryId: entryId });
}

/* ---- referrals (multi-entry "referrals" form on a client) ----
   Each entry references a directory program by programId (FK) + programName
   (snapshot). status/declineReason capture the accept/deny outcome. createdBy/
   createdAt are stamped server-side on add. All POST (the read needs the parent
   id in the body). */
function apiListReferrals(clientId: string): Promise<any[]> {
  return maestroPost('listReferrals', { id: clientId });
}
function apiAddReferral(clientId: string, fields: Record<string, unknown>): Promise<any> {
  return maestroPost('addReferral', { id: clientId, fields: fields });
}
function apiUpdateReferral(clientId: string, entryId: string, fields: Record<string, unknown>): Promise<any> {
  return maestroPost('updateReferral', { id: clientId, entryId: entryId, fields: fields });
}
function apiDeleteReferral(clientId: string, entryId: string): Promise<any> {
  return maestroPost('deleteReferral', { id: clientId, entryId: entryId });
}

/* ---- agreement templates (org-wide, on thisOrg.agreementTemplates) ---- */
function apiListAgreementTemplates(): Promise<any[]> {
  return maestroGet('listAgreementTemplates');
}
function apiGetAgreementTemplate(entryId: string): Promise<any> {
  return maestroPost('getAgreementTemplate', { entryId: entryId });
}
// entryId omitted -> create; present -> update.
function apiSaveAgreementTemplate(entryId: string | null, fields: Record<string, unknown>): Promise<any> {
  return maestroPost('saveAgreementTemplate', entryId ? { entryId: entryId, fields: fields } : { fields: fields });
}
function apiSetAgreementTemplateStatus(entryId: string, status: string): Promise<any> {
  return maestroPost('setAgreementTemplateStatus', { entryId: entryId, status: status });
}

/* ---- agreement instances (per-client "agreements" MEF) ---- */
function apiListAgreements(clientId: string): Promise<any[]> {
  return maestroPost('listAgreements', { id: clientId });
}
function apiGetAgreement(clientId: string, entryId: string): Promise<any> {
  return maestroPost('getAgreement', { id: clientId, entryId: entryId });
}
function apiCreateAgreement(clientId: string, templateRef: string, title: string, signers: any[]): Promise<any> {
  return maestroPost('createAgreement', { id: clientId, templateRef: templateRef, title: title, signers: signers });
}
function apiSendAgreement(clientId: string, entryId: string): Promise<any> {
  return maestroPost('sendAgreement', { id: clientId, entryId: entryId });
}
function apiVoidAgreement(clientId: string, entryId: string, reason: string): Promise<any> {
  return maestroPost('voidAgreement', { id: clientId, entryId: entryId, reason: reason });
}
function apiCountersignAgreement(clientId: string, entryId: string, signatureData: string): Promise<any> {
  return maestroPost('countersignAgreement', { id: clientId, entryId: entryId, signatureData: signatureData });
}
// Generate-or-serve the signed PDF on demand (PDF generation is off the signing
// path — it lives here, retryable, so a momentary converter hang never blocks signing).
function apiGetSignedPdf(clientId: string, entryId: string): Promise<any> {
  return maestroPost('getSignedPdf', { id: clientId, entryId: entryId });
}

/* ---- program overlay (Directory Layer 2: consultant-private data on a program) ----
   The SPA only holds the DIRECTORY program id; the maestro resolves it to a local
   overlay record (find-or-create). Hints (cached display + slug) let a first write
   seed the new overlay without a cross-org fetch. All POST. */
interface ProgramHints { directorySlug?: string; cachedName?: string; cachedLocation?: string; cachedType?: string; }
function apiGetProgramOverlay(dpid: string): Promise<any> {
  return maestroPost('getProgramOverlay', { directoryProgramId: dpid });
}
function apiSaveProgramOverlay(dpid: string, hints: ProgramHints, fields: Record<string, unknown>): Promise<any> {
  return maestroPost('saveProgramOverlay', { directoryProgramId: dpid, fields: fields, ...hints });
}
function apiListProgramNotes(dpid: string): Promise<any[]> {
  return maestroPost('listProgramNotes', { directoryProgramId: dpid });
}
function apiAddProgramNote(dpid: string, hints: ProgramHints, fields: Record<string, unknown>): Promise<any> {
  return maestroPost('addProgramNote', { directoryProgramId: dpid, fields: fields, ...hints });
}
function apiUpdateProgramNote(dpid: string, entryId: string, fields: Record<string, unknown>): Promise<any> {
  return maestroPost('updateProgramNote', { directoryProgramId: dpid, entryId: entryId, fields: fields });
}
function apiDeleteProgramNote(dpid: string, entryId: string): Promise<any> {
  return maestroPost('deleteProgramNote', { directoryProgramId: dpid, entryId: entryId });
}
// Upload/clear the program logo (a DocumentLinkField on the overlay). Empty
// dataBase64 clears it. Lazily creates the overlay.
function apiSetProgramLogo(dpid: string, hints: ProgramHints, payload: Record<string, unknown>): Promise<any> {
  return maestroPost('setProgramLogo', Object.assign({ directoryProgramId: dpid }, hints, payload));
}
/* program files — resolve directory id -> overlay record on the server, then reuse
   the generic file handlers. Used by the Files section (Phase C2). */
function apiListProgramFiles(dpid: string): Promise<any[]> {
  return maestroPost('listProgramFiles', { directoryProgramId: dpid });
}
function apiAddProgramFile(dpid: string, hints: ProgramHints, payload: Record<string, unknown>): Promise<any> {
  return maestroPost('addProgramFile', Object.assign({ directoryProgramId: dpid }, hints, payload));
}
function apiUpdateProgramFile(dpid: string, entryId: string, fields: Record<string, unknown>): Promise<any> {
  return maestroPost('updateProgramFile', { directoryProgramId: dpid, entryId: entryId, fields: fields });
}
function apiDeleteProgramFile(dpid: string, entryId: string): Promise<any> {
  return maestroPost('deleteProgramFile', { directoryProgramId: dpid, entryId: entryId });
}
function apiCreateProgramFolder(dpid: string, hints: ProgramHints, folder: string): Promise<any> {
  return maestroPost('createProgramFolder', { directoryProgramId: dpid, folder: folder, ...hints });
}
function apiRenameProgramFolder(dpid: string, oldPath: string, newPath: string): Promise<any> {
  return maestroPost('renameProgramFolder', { directoryProgramId: dpid, oldPath: oldPath, newPath: newPath });
}
function apiDeleteProgramFolder(dpid: string, folder: string): Promise<any> {
  return maestroPost('deleteProgramFolder', { directoryProgramId: dpid, folder: folder });
}

/* ---- email integration (Gmail/Outlook OAuth) ----
   Per-user connect actions run as the logged-in user; the org config actions
   (getEmailConfig/saveEmailConfig) are admin-facing. Secrets are never returned
   by getEmailConfig (write-only) — it reports only whether each is set. */
function apiEmailStatus(): Promise<any[]> {
  return maestroGet('emailStatus');
}
function apiEmailAuthUrl(provider: string): Promise<any> {
  return maestroPost('emailAuthUrl', { provider: provider });
}
function apiEmailDisconnect(provider: string): Promise<any> {
  return maestroPost('emailDisconnect', { provider: provider });
}
function apiGetEmailConfig(): Promise<any> {
  return maestroGet('getEmailConfig');
}
function apiSaveEmailConfig(cfg: Record<string, unknown>): Promise<any> {
  return maestroPost('saveEmailConfig', cfg);
}
// Send an email as the logged-in user through their connected mailbox, and log a
// Communication (type Email) on the client. Returns { messageId, communicationId?, commError? }.
function apiSendEmail(payload: Record<string, unknown>): Promise<any> {
  return maestroPost('sendEmail', payload);
}

/* ---- files & folders (multi-entry "files" form on a client) ---- */
function apiListFiles(clientId: string): Promise<any[]> {
  return maestroPost('listFiles', { id: clientId });
}
function apiAddFile(clientId: string, payload: Record<string, unknown>): Promise<any> {
  return maestroPost('addFile', Object.assign({ id: clientId }, payload));
}
function apiUpdateFile(clientId: string, entryId: string, fields: Record<string, unknown>): Promise<any> {
  return maestroPost('updateFile', { id: clientId, entryId: entryId, fields: fields });
}
function apiDeleteFile(clientId: string, entryId: string): Promise<any> {
  return maestroPost('deleteFile', { id: clientId, entryId: entryId });
}
function apiCreateFolder(clientId: string, folder: string): Promise<any> {
  return maestroPost('createFolder', { id: clientId, folder: folder });
}
function apiRenameFolder(clientId: string, oldPath: string, newPath: string): Promise<any> {
  return maestroPost('renameFolder', { id: clientId, oldPath: oldPath, newPath: newPath });
}
function apiDeleteFolder(clientId: string, path: string): Promise<any> {
  return maestroPost('deleteFolder', { id: clientId, path: path });
}

/* ---- parent application: template (org) + instances (per client) ---- */
// The application template (built in the Application Builder) lives as draft +
// published JSON on the org's `app` form. The builder reads getAppTemplate,
// auto-saves drafts, and publishes the live copy parents fill out.
function apiGetAppTemplate(): Promise<{ draft: any; published: any; lastUpdated: string; lastPublished: string }> {
  return maestroGet('getAppTemplate');
}
function apiSaveAppTemplate(template: any): Promise<any> {
  return maestroPost('saveAppTemplate', { template: template });
}
function apiPublishAppTemplate(template: any): Promise<any> {
  return maestroPost('publishAppTemplate', { template: template });
}

// Application instances are entries on the client's `application` MEF. Each
// carries an `entryId`, a `status` (Open/Complete/Closed), the token-gated
// public `url`, and (via getApplication) the submitted `rawdata`.
function apiListApplications(clientId: string): Promise<any[]> {
  return maestroPost('listApplications', { id: clientId });
}
function apiGetApplication(clientId: string, entryId: string): Promise<any> {
  return maestroPost('getApplication', { id: clientId, entryId: entryId });
}
function apiCreateApplication(clientId: string, notes?: string): Promise<any> {
  return maestroPost('createApplication', { id: clientId, notes: notes || '' });
}
function apiSetApplicationStatus(clientId: string, entryId: string, status: string): Promise<any> {
  return maestroPost('setApplicationStatus', { id: clientId, entryId: entryId, status: status });
}

/* ---- org settings (one JSON memo on the org record; feature-namespaced) ---- */
interface OrgSettings { [key: string]: any }
let SETTINGS: OrgSettings | null = null;     // null = not loaded yet
let SETTINGS_LOADING = false;

function apiGetSettings(): Promise<OrgSettings> { return maestroGet('getSettings'); }
function apiSaveSettings(settings: OrgSettings): Promise<OrgSettings> {
  return maestroPost('saveSettings', { settings: settings });
}

// Load org settings once, then re-render so settings-driven controls fill in.
async function loadSettings(): Promise<void> {
  if (SETTINGS || SETTINGS_LOADING) return;
  SETTINGS_LOADING = true;
  try { SETTINGS = await apiGetSettings(); }
  catch (_e) { SETTINGS = {}; } // fail soft — controls fall back to built-in defaults
  finally {
    SETTINGS_LOADING = false;
    // Org settings are authoritative for the color scheme — apply the saved
    // org palette now that it's loaded (refreshes the localStorage boot cache).
    if (typeof reconcileOrgTheme === 'function') reconcileOrgTheme(SETTINGS);
    if (typeof render === 'function') render();
  }
}

// "Other" is a hard-coded, always-last escape hatch in the relationship dropdown
// (NOT part of the user-defined list) — picking it reveals a free-text box.
const OTHER_RELATIONSHIP = 'Other';

// Built-in relationship choices used until/unless the org defines its own list
// in Settings (settings.contacts.relationships). "Other" is intentionally NOT
// here — it's appended by the control.
const DEFAULT_RELATIONSHIPS = [
  'Mother', 'Father', 'Stepmother', 'Stepfather', 'Legal Guardian', 'Grandparent', 'Sibling', 'Other Family',
  'Therapist', 'Psychiatrist', 'Psychologist', 'Referring Professional', 'Educational Consultant',
  'Case Manager', 'School Counselor', 'Attorney', 'Physician', 'Other Professional',
];

// The user-defined relationship list (settings or fallback), with any stray
// "Other" filtered out so the hard-coded one is never duplicated.
function relationshipOptions(): string[] {
  const s: any = SETTINGS;
  const fromSettings: string[] = s && s.contacts && Array.isArray(s.contacts.relationships)
    ? s.contacts.relationships.filter((x: any) => typeof x === 'string' && x.trim())
    : [];
  const list = fromSettings.length ? fromSettings : DEFAULT_RELATIONSHIPS;
  return list.filter(o => o.trim().toLowerCase() !== OTHER_RELATIONSHIP.toLowerCase());
}

// Built-in referral decline reasons used until/unless the org defines its own
// list in Settings (settings.referrals.declineReasons). The referral field is
// free-text (like relationship), so any settings value stores verbatim.
const DEFAULT_DECLINE_REASONS = [
  'Clinical fit', 'Acuity too high', 'No bed availability', 'Insurance not accepted',
  'Age or gender not served', 'Cost', 'Family declined', 'Other',
];

// The user-defined decline-reason list (settings or fallback).
function declineReasonOptions(): string[] {
  const s: any = SETTINGS;
  const fromSettings: string[] = s && s.referrals && Array.isArray(s.referrals.declineReasons)
    ? s.referrals.declineReasons.filter((x: any) => typeof x === 'string' && x.trim())
    : [];
  return fromSettings.length ? fromSettings : DEFAULT_DECLINE_REASONS;
}

// Org-wide default folders (settings.files.defaultFolders) — folders that
// auto-appear for every client. Empty array if none configured.
function defaultFolders(): string[] {
  const s: any = SETTINGS;
  return s && s.files && Array.isArray(s.files.defaultFolders)
    ? s.files.defaultFolders.filter((x: any) => typeof x === 'string' && x.trim())
    : [];
}
// Starter folders shown in the Settings editor until the org saves its own.
const DEFAULT_FOLDERS_SEED = ['Intake', 'Assessments', 'Medical', 'Academic', 'Legal', 'Financial', 'Correspondence'];

// Org-wide default folders for PROGRAM files (settings.files.programDefaultFolders)
// — a separate set from client folders, auto-appearing on every program's Files
// tab. Empty array if none configured.
function programDefaultFolders(): string[] {
  const s: any = SETTINGS;
  return s && s.files && Array.isArray(s.files.programDefaultFolders)
    ? s.files.programDefaultFolders.filter((x: any) => typeof x === 'string' && x.trim())
    : [];
}
// Program-oriented starter folders (tours, contracts, marketing collateral, …).
const PROGRAM_DEFAULT_FOLDERS_SEED = ['Tour Notes', 'Brochures', 'Contracts', 'Accreditation', 'Correspondence'];

// Fetch the select-field option lists so the edit forms can render dropdowns.
function apiClientMeta(): Promise<{ options: { [key: string]: string[] } }> {
  return maestroGet('clientMeta');
}

// Who's logged in (+ super flag + org name) — drives the toolbar chrome.
function apiSession(): Promise<Session> {
  return maestroGet('session');
}

/* ---- live client store (single source for the list + record view) ---- */
let CLIENT_STORE: Client[] | null = null;   // null = not loaded yet
let CLIENTS_LOADING = false;
let CLIENTS_ERROR: string | null = null;

// The Clients page is tabbed across the three Individual categories. Inquiries
// and Alumni get their own live stores, loaded the same way as Clients.
let INQUIRY_STORE: Client[] | null = null;
let INQUIRIES_LOADING = false;
let INQUIRIES_ERROR: string | null = null;
let ALUMNI_STORE: Client[] | null = null;
let ALUMNI_LOADING = false;
let ALUMNI_ERROR: string | null = null;

// Map a raw maestro record (name + conInfo + demographics fields) into the
// Client shape the UI renders. Display-oriented fields are pulled out for the
// list/summary/header; the full record is kept on `raw` for the edit forms.
function realToClient(r: any): Client {
  const race: string[] = Array.isArray(r.race) ? r.race : (r.race ? [String(r.race)] : []);
  return {
    id: String(r.id || r.shortId || ''),
    first: r.firstName || '', last: r.lastName || '',
    dob: r.dob || '', gender: r.gender || '', status: '', grade: '',
    source: '', sourceName: '',
    summary: '', concerns: [],
    demo: { pronouns: r.pronouns || '', race: race[0] || '', ethnicity: r.ethnicity || '', city: r.homeCity || '', state: r.homeState || '' },
    contacts: [], documents: [], communications: [], placements: [], tasks: [],
    prefName: r.prefName || '', email: r.email || '', cell: r.cell || '',
    homePhone: r.homePhone || '', homeZip: r.homeZip || '', viewUrl: r.viewUrl || '',
    photoUrl: r.photo || '',
    // Lifecycle stage from the maestro (categories → 'inquiry'|'client'|'alumni').
    // Falls back to 'client' for legacy rows; the per-store loaders also set it.
    entity: r.stage || 'client',
    raw: r,
  };
}

/* ---- select-field option metadata (for edit-form dropdowns) ---- */
let CLIENT_META: { options: { [key: string]: string[] } } | null = null;
let META_LOADING = false;

// Option names for a select field key, or [] until the meta has loaded.
function metaOptions(key: string): string[] {
  if (CLIENT_META && CLIENT_META.options && CLIENT_META.options[key]) return CLIENT_META.options[key];
  return [];
}

// Load the select-field option lists once, then re-render so dropdowns fill in.
async function loadClientMeta(): Promise<void> {
  if (META_LOADING || CLIENT_META) return;
  META_LOADING = true;
  try {
    CLIENT_META = await apiClientMeta();
  } catch (_e) {
    CLIENT_META = { options: {} }; // fail soft — selects fall back to current value only
  } finally {
    META_LOADING = false;
    if (typeof render === 'function') render();
  }
}

/* ---- logged-in session (toolbar: real name, super-only Tools, org label) ---- */
interface Session { loggedIn: boolean; firstName: string; lastName: string; fullName: string; isSuper: boolean; orgName: string; logoUrl: string; }
let SESSION: Session | null = null;

// Load the session once, then re-render so the toolbar shows the real user.
async function loadSession(): Promise<void> {
  if (SESSION) return;
  try {
    SESSION = await apiSession();
  } catch (_e) {
    SESSION = { loggedIn: false, firstName: '', lastName: '', fullName: '', isSuper: false, orgName: '', logoUrl: '' };
  }
  if (typeof render === 'function') render();
}

// Load (or reload) the live client list, then re-render. Safe to call from a
// view during render — it no-ops if already loaded (unless force) or in flight.
async function loadClients(force = false): Promise<void> {
  if (CLIENTS_LOADING) return;
  if (CLIENT_STORE && !force) return;
  CLIENTS_LOADING = true; CLIENTS_ERROR = null;
  try {
    const raw = await apiListClients();
    CLIENT_STORE = raw.map(realToClient);
  } catch (e: any) {
    CLIENTS_ERROR = e && e.message ? e.message : String(e);
    CLIENT_STORE = null;
  } finally {
    CLIENTS_LOADING = false;
    if (typeof render === 'function') render();
  }
}

// Load (or reload) the live Inquiry list, then re-render. Mirrors loadClients.
async function loadInquiries(force = false): Promise<void> {
  if (INQUIRIES_LOADING) return;
  if (INQUIRY_STORE && !force) return;
  INQUIRIES_LOADING = true; INQUIRIES_ERROR = null;
  try {
    const raw = await apiListInquiries();
    INQUIRY_STORE = raw.map(realToClient).map(c => { c.entity = 'inquiry'; return c; });
  } catch (e: any) {
    INQUIRIES_ERROR = e && e.message ? e.message : String(e);
    INQUIRY_STORE = null;
  } finally {
    INQUIRIES_LOADING = false;
    if (typeof render === 'function') render();
  }
}

// Load (or reload) the live Alumni list, then re-render. Mirrors loadClients.
async function loadAlumni(force = false): Promise<void> {
  if (ALUMNI_LOADING) return;
  if (ALUMNI_STORE && !force) return;
  ALUMNI_LOADING = true; ALUMNI_ERROR = null;
  try {
    const raw = await apiListAlumni();
    ALUMNI_STORE = raw.map(realToClient).map(c => { c.entity = 'alumni'; return c; });
  } catch (e: any) {
    ALUMNI_ERROR = e && e.message ? e.message : String(e);
    ALUMNI_STORE = null;
  } finally {
    ALUMNI_LOADING = false;
    if (typeof render === 'function') render();
  }
}

/* ---- live dashboard store (server-aggregated caseload overview) ---- */
// One GET to the maestro's `dashboard` action returns the whole rollup: stage
// counts, referral funnel + outcomes, task buckets + soonest open tasks, and
// recent communications. Cached like the list stores; Refresh forces a reload.
let DASHBOARD: any = null;   // null = not loaded yet
let DASHBOARD_LOADING = false;
let DASHBOARD_ERROR: string | null = null;

function apiDashboard(): Promise<any> {
  return maestroGet('dashboard');
}

// Load (or reload) the dashboard rollup, then re-render. Mirrors loadClients.
async function loadDashboard(force = false): Promise<void> {
  if (DASHBOARD_LOADING) return;
  if (DASHBOARD && !force) return;
  DASHBOARD_LOADING = true; DASHBOARD_ERROR = null;
  try {
    DASHBOARD = await apiDashboard();
  } catch (e: any) {
    DASHBOARD_ERROR = e && e.message ? e.message : String(e);
    DASHBOARD = null;
  } finally {
    DASHBOARD_LOADING = false;
    if (typeof render === 'function') render();
  }
}

// Kick off a dashboard load if it hasn't been fetched yet (called from render).
function ensureDashboard(): void {
  if (DASHBOARD === null && !DASHBOARD_LOADING && !DASHBOARD_ERROR) loadDashboard();
}

// ---- Program Directory (live, cross-org via the maestro proxy → /b/directory) ----
// The directory is a SEPARATE BlueStep org; the maestro proxies reads to it.
// listPrograms returns lean summaries (cards + filters); getProgram returns the
// full profile (narrative memos + parsed contacts) for the detail view.
interface DirProgram {
  id: string; shortId?: string; viewUrl?: string;
  programName: string; website?: string; aktProfile?: string; location?: string;
  states?: string[]; programType?: string[]; ageBand?: string[]; genderServed?: string[];
  agesRaw?: string; populationsRaw?: string; accreditationRaw?: string; insuranceRaw?: string;
  admissionsContact?: string; bluestepOrgRef?: boolean; crawlStatus?: string;
  overview?: string; clinicalModel?: string; levelsOfCare?: string; academics?: string;
  familyInvolvement?: string; admissionsCost?: string; accreditationOwnership?: string;
  sources?: string; contactsJson?: string; profileMarkdown?: string;
  contacts?: { general?: any; people?: any[]; sources?: string[] } | null;
  // Schema v2 structured fields (present in listPrograms summaries).
  setting?: string[]; levelOfCare?: string[]; specialties?: string[]; modalities?: string[];
  primaryFocus?: string; region?: string; locationState?: string; locationCity?: string;
  ageMin?: number | null; ageMax?: number | null; costPerMonthUSD?: number | null;
  insuranceAccepted?: boolean; insuranceNetworks?: string[]; fundingSources?: string[];
  accreditations?: string[]; approvedFundingLists?: string[]; hasAcademics?: boolean;
  natsapMember?: boolean; lgbtqAffirming?: boolean; dataSource?: string; verified?: boolean;
}

let PROGRAM_STORE: DirProgram[] | null = null;   // null = not loaded yet
let PROGRAMS_LOADING = false;
let PROGRAMS_ERROR: string | null = null;
const PROGRAM_DETAIL: { [id: string]: DirProgram } = {};
const PROGRAM_DETAIL_LOADING: { [id: string]: boolean } = {};
const PROGRAM_DETAIL_ERROR: { [id: string]: string } = {};
// Referrals TO a program (the other side of the client↔program relationship) —
// every referral across the caseload whose target is this directory program.
const PROGRAM_REFERRALS: { [id: string]: any[] } = {};
const PROGRAM_REFERRALS_LOADING: { [id: string]: boolean } = {};
const PROGRAM_REFERRALS_ERROR: { [id: string]: string } = {};

async function apiListPrograms(): Promise<DirProgram[]> { return await maestroGet('listPrograms'); }
async function apiGetProgram(id: string): Promise<DirProgram> { return await maestroPost('getProgram', { id: id }); }
// Referrals to one program, by its directory id (maestro matches on programId).
async function apiListProgramReferrals(id: string): Promise<any[]> { return await maestroPost('listAllReferrals', { program: id }); }

// Load (or reload) the live program summaries, then re-render. Safe to call from
// a view during render — no-ops if already loaded (unless force) or in flight.
async function loadPrograms(force = false): Promise<void> {
  if (PROGRAMS_LOADING) return;
  if (PROGRAM_STORE && !force) return;
  PROGRAMS_LOADING = true; PROGRAMS_ERROR = null;
  try {
    PROGRAM_STORE = await apiListPrograms();
  } catch (e: any) {
    PROGRAMS_ERROR = e && e.message ? e.message : String(e);
    PROGRAM_STORE = null;
  } finally {
    PROGRAMS_LOADING = false;
    if (typeof render === 'function') render();
  }
}

// Load one full program profile by id (cached), then re-render.
async function loadProgram(id: string, force = false): Promise<void> {
  if (PROGRAM_DETAIL_LOADING[id]) return;
  if (PROGRAM_DETAIL[id] && !force) return;
  PROGRAM_DETAIL_LOADING[id] = true; delete PROGRAM_DETAIL_ERROR[id];
  try {
    PROGRAM_DETAIL[id] = await apiGetProgram(id);
  } catch (e: any) {
    PROGRAM_DETAIL_ERROR[id] = e && e.message ? e.message : String(e);
  } finally {
    PROGRAM_DETAIL_LOADING[id] = false;
    if (typeof render === 'function') render();
  }
}

// Load (or reload) the referrals that have gone to one program, then re-render.
async function loadProgramReferrals(id: string, force = false): Promise<void> {
  if (PROGRAM_REFERRALS_LOADING[id]) return;
  if (PROGRAM_REFERRALS[id] && !force) return;
  PROGRAM_REFERRALS_LOADING[id] = true; delete PROGRAM_REFERRALS_ERROR[id];
  try {
    PROGRAM_REFERRALS[id] = await apiListProgramReferrals(id);
  } catch (e: any) {
    PROGRAM_REFERRALS_ERROR[id] = e && e.message ? e.message : String(e);
  } finally {
    PROGRAM_REFERRALS_LOADING[id] = false;
    if (typeof render === 'function') render();
  }
}
