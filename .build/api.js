const MAESTRO_URL = "/b/maestro";
async function maestroPost(action, payload) {
  const res = await fetch(MAESTRO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload })
  });
  let json = null;
  try {
    json = await res.json();
  } catch (_e) {
    throw new Error("Server returned a non-JSON response (HTTP " + res.status + ").");
  }
  if (!json || json.ok !== true) {
    throw new Error(json && json.error ? json.error : "Request failed (HTTP " + res.status + ").");
  }
  return json.data;
}
async function maestroGet(action) {
  const res = await fetch(MAESTRO_URL + "?action=" + encodeURIComponent(action), { headers: { "Accept": "application/json" } });
  let json = null;
  try {
    json = await res.json();
  } catch (_e) {
    throw new Error("Server returned a non-JSON response (HTTP " + res.status + ").");
  }
  if (!json || json.ok !== true) {
    throw new Error(json && json.error ? json.error : "Request failed (HTTP " + res.status + ").");
  }
  return json.data;
}
const BLUEIQ_URL = "/b/blueiq";
async function blueiqPost(action, payload) {
  const res = await fetch(BLUEIQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload })
  });
  let json = null;
  try {
    json = await res.json();
  } catch (_e) {
    throw new Error("BlueIQ returned a non-JSON response (HTTP " + res.status + ").");
  }
  if (!json || json.ok !== true) {
    throw new Error(json && json.error ? json.error : "BlueIQ request failed (HTTP " + res.status + ").");
  }
  return json.data;
}
function apiBlueiqChat(scope, clientId, question, history, programId, programName, programFilter) {
  return blueiqPost("chat", { scope, clientId: clientId || "", question, history, programId: programId || "", programName: programName || "", programFilter: programFilter || null });
}
function apiBlueiqStatus() {
  return blueiqPost("status", {});
}
async function blueiqPostRaw(action, payload) {
  const res = await fetch(BLUEIQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload })
  });
  try {
    return await res.json();
  } catch (_e) {
    return { ok: false, error: "BlueIQ returned a non-JSON response (HTTP " + res.status + ")." };
  }
}
function apiBlueiqTranscribe(audioB64, mimeType, vocab) {
  return blueiqPostRaw("transcribe", { audio: audioB64, mimeType, vocab: vocab || [] });
}
function apiBlueiqCompose(payload) {
  return blueiqPostRaw("compose", payload);
}
function apiNoteMeta() {
  return maestroGet("noteMeta");
}
function apiCaptureAddCommunication(clientId, fields, transcript) {
  return maestroPost("addCommunication", { id: clientId, fields, capturedVia: "BlueIQ", sourceTranscript: transcript || "" });
}
function apiCaptureAddTask(clientId, fields, transcript) {
  return maestroPost("addTask", { id: clientId, fields, capturedVia: "BlueIQ", sourceTranscript: transcript || "" });
}
function apiCaptureAddProgramNote(dpid, hints, fields, transcript) {
  return maestroPost("addProgramNote", { directoryProgramId: dpid, fields, ...hints, capturedVia: "BlueIQ", sourceTranscript: transcript || "" });
}
const BLUEIQ_ADMIN_URL = "/b/blueiqAdmin";
async function blueiqAdminPost(action, payload) {
  const res = await fetch(BLUEIQ_ADMIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload })
  });
  let json = null;
  try {
    json = await res.json();
  } catch (_e) {
    throw new Error("BlueIQ admin returned a non-JSON response (HTTP " + res.status + ").");
  }
  if (!json || json.ok !== true) {
    throw new Error(json && json.error ? json.error : "BlueIQ admin request failed (HTTP " + res.status + ").");
  }
  return json.data;
}
function apiBlueiqAdminContext() {
  return blueiqAdminPost("context", {});
}
function apiBlueiqListUsers() {
  return blueiqAdminPost("listUsers", {});
}
function apiBlueiqSetSubscription(p) {
  return blueiqAdminPost("setSubscription", p);
}
function apiBlueiqRemoveSubscription(userId) {
  return blueiqAdminPost("removeSubscription", { userId });
}
function apiCreateClient(payload) {
  return maestroPost("createClient", payload);
}
function apiCreatePerson(entity, payload) {
  const action = "create" + entity.charAt(0).toUpperCase() + entity.slice(1);
  return maestroPost(action, payload);
}
function apiUpdateClient(id, fields) {
  return maestroPost("updateClient", { id, fields });
}
function apiDeleteClient(id) {
  return maestroPost("deleteClient", { id });
}
function apiSetStage(id, stage) {
  return maestroPost("setStage", { id, stage });
}
function apiListClients() {
  return maestroGet("listClients");
}
function apiListInquiries() {
  return maestroGet("listInquiries");
}
function apiListAlumni() {
  return maestroGet("listAlumni");
}
function apiSetClientPhoto(id, dataBase64, filename, contentType) {
  return maestroPost("uploadClientPhoto", { id, dataBase64, filename, contentType });
}
function apiUploadOrgLogo(dataBase64, filename, contentType) {
  return maestroPost("uploadOrgLogo", { dataBase64, filename, contentType });
}
function apiRemoveOrgLogo() {
  return maestroPost("uploadOrgLogo", { dataBase64: "" });
}
function apiListContacts(clientId) {
  return maestroPost("listContacts", { id: clientId });
}
function apiAddContact(clientId, fields) {
  return maestroPost("addContact", { id: clientId, fields });
}
function apiUpdateContact(clientId, entryId, fields) {
  return maestroPost("updateContact", { id: clientId, entryId, fields });
}
function apiDeleteContact(clientId, entryId) {
  return maestroPost("deleteContact", { id: clientId, entryId });
}
function apiSetContactPhoto(clientId, entryId, dataBase64, filename, contentType) {
  return maestroPost("uploadContactPhoto", { id: clientId, entryId, dataBase64, filename, contentType });
}
function apiListCommunications(clientId) {
  return maestroPost("listCommunications", { id: clientId });
}
function apiAddCommunication(clientId, fields) {
  return maestroPost("addCommunication", { id: clientId, fields });
}
function apiUpdateCommunication(clientId, entryId, fields) {
  return maestroPost("updateCommunication", { id: clientId, entryId, fields });
}
function apiDeleteCommunication(clientId, entryId) {
  return maestroPost("deleteCommunication", { id: clientId, entryId });
}
function apiListTasks(clientId) {
  return maestroPost("listTasks", { id: clientId });
}
function apiAddTask(clientId, fields) {
  return maestroPost("addTask", { id: clientId, fields });
}
function apiUpdateTask(clientId, entryId, fields) {
  return maestroPost("updateTask", { id: clientId, entryId, fields });
}
function apiDeleteTask(clientId, entryId) {
  return maestroPost("deleteTask", { id: clientId, entryId });
}
function apiListReferrals(clientId) {
  return maestroPost("listReferrals", { id: clientId });
}
function apiAddReferral(clientId, fields) {
  return maestroPost("addReferral", { id: clientId, fields });
}
function apiUpdateReferral(clientId, entryId, fields) {
  return maestroPost("updateReferral", { id: clientId, entryId, fields });
}
function apiDeleteReferral(clientId, entryId) {
  return maestroPost("deleteReferral", { id: clientId, entryId });
}
function apiListAgreementTemplates() {
  return maestroGet("listAgreementTemplates");
}
function apiGetAgreementTemplate(entryId) {
  return maestroPost("getAgreementTemplate", { entryId });
}
function apiSaveAgreementTemplate(entryId, fields) {
  return maestroPost("saveAgreementTemplate", entryId ? { entryId, fields } : { fields });
}
function apiSetAgreementTemplateStatus(entryId, status) {
  return maestroPost("setAgreementTemplateStatus", { entryId, status });
}
function apiListAgreements(clientId) {
  return maestroPost("listAgreements", { id: clientId });
}
function apiGetAgreement(clientId, entryId) {
  return maestroPost("getAgreement", { id: clientId, entryId });
}
function apiCreateAgreement(clientId, templateRef, title, signers) {
  return maestroPost("createAgreement", { id: clientId, templateRef, title, signers });
}
function apiSendAgreement(clientId, entryId) {
  return maestroPost("sendAgreement", { id: clientId, entryId });
}
function apiVoidAgreement(clientId, entryId, reason) {
  return maestroPost("voidAgreement", { id: clientId, entryId, reason });
}
function apiCountersignAgreement(clientId, entryId, signatureData) {
  return maestroPost("countersignAgreement", { id: clientId, entryId, signatureData });
}
function apiGetSignedPdf(clientId, entryId) {
  return maestroPost("getSignedPdf", { id: clientId, entryId });
}
function apiGetProgramOverlay(dpid) {
  return maestroPost("getProgramOverlay", { directoryProgramId: dpid });
}
function apiSaveProgramOverlay(dpid, hints, fields) {
  return maestroPost("saveProgramOverlay", { directoryProgramId: dpid, fields, ...hints });
}
function apiListProgramNotes(dpid) {
  return maestroPost("listProgramNotes", { directoryProgramId: dpid });
}
function apiAddProgramNote(dpid, hints, fields) {
  return maestroPost("addProgramNote", { directoryProgramId: dpid, fields, ...hints });
}
function apiUpdateProgramNote(dpid, entryId, fields) {
  return maestroPost("updateProgramNote", { directoryProgramId: dpid, entryId, fields });
}
function apiDeleteProgramNote(dpid, entryId) {
  return maestroPost("deleteProgramNote", { directoryProgramId: dpid, entryId });
}
function apiSetProgramLogo(dpid, hints, payload) {
  return maestroPost("setProgramLogo", Object.assign({ directoryProgramId: dpid }, hints, payload));
}
function apiListProgramFiles(dpid) {
  return maestroPost("listProgramFiles", { directoryProgramId: dpid });
}
function apiAddProgramFile(dpid, hints, payload) {
  return maestroPost("addProgramFile", Object.assign({ directoryProgramId: dpid }, hints, payload));
}
function apiUpdateProgramFile(dpid, entryId, fields) {
  return maestroPost("updateProgramFile", { directoryProgramId: dpid, entryId, fields });
}
function apiDeleteProgramFile(dpid, entryId) {
  return maestroPost("deleteProgramFile", { directoryProgramId: dpid, entryId });
}
function apiCreateProgramFolder(dpid, hints, folder) {
  return maestroPost("createProgramFolder", { directoryProgramId: dpid, folder, ...hints });
}
function apiRenameProgramFolder(dpid, oldPath, newPath) {
  return maestroPost("renameProgramFolder", { directoryProgramId: dpid, oldPath, newPath });
}
function apiDeleteProgramFolder(dpid, folder) {
  return maestroPost("deleteProgramFolder", { directoryProgramId: dpid, folder });
}
function apiEmailStatus() {
  return maestroGet("emailStatus");
}
function apiEmailAuthUrl(provider) {
  return maestroPost("emailAuthUrl", { provider });
}
function apiEmailDisconnect(provider) {
  return maestroPost("emailDisconnect", { provider });
}
function apiGetEmailConfig() {
  return maestroGet("getEmailConfig");
}
function apiSaveEmailConfig(cfg) {
  return maestroPost("saveEmailConfig", cfg);
}
function apiSendEmail(payload) {
  return maestroPost("sendEmail", payload);
}
function apiListFiles(clientId) {
  return maestroPost("listFiles", { id: clientId });
}
function apiAddFile(clientId, payload) {
  return maestroPost("addFile", Object.assign({ id: clientId }, payload));
}
function apiUpdateFile(clientId, entryId, fields) {
  return maestroPost("updateFile", { id: clientId, entryId, fields });
}
function apiDeleteFile(clientId, entryId) {
  return maestroPost("deleteFile", { id: clientId, entryId });
}
function apiCreateFolder(clientId, folder) {
  return maestroPost("createFolder", { id: clientId, folder });
}
function apiRenameFolder(clientId, oldPath, newPath) {
  return maestroPost("renameFolder", { id: clientId, oldPath, newPath });
}
function apiDeleteFolder(clientId, path) {
  return maestroPost("deleteFolder", { id: clientId, path });
}
function apiGetAppTemplate() {
  return maestroGet("getAppTemplate");
}
function apiSaveAppTemplate(template) {
  return maestroPost("saveAppTemplate", { template });
}
function apiPublishAppTemplate(template) {
  return maestroPost("publishAppTemplate", { template });
}
function apiListApplications(clientId) {
  return maestroPost("listApplications", { id: clientId });
}
function apiGetApplication(clientId, entryId) {
  return maestroPost("getApplication", { id: clientId, entryId });
}
function apiCreateApplication(clientId, notes) {
  return maestroPost("createApplication", { id: clientId, notes: notes || "" });
}
function apiSetApplicationStatus(clientId, entryId, status) {
  return maestroPost("setApplicationStatus", { id: clientId, entryId, status });
}
let SETTINGS = null;
let SETTINGS_LOADING = false;
function apiGetSettings() {
  return maestroGet("getSettings");
}
function apiSaveSettings(settings) {
  return maestroPost("saveSettings", { settings });
}
async function loadSettings() {
  if (SETTINGS || SETTINGS_LOADING) return;
  SETTINGS_LOADING = true;
  try {
    SETTINGS = await apiGetSettings();
  } catch (_e) {
    SETTINGS = {};
  } finally {
    SETTINGS_LOADING = false;
    if (typeof reconcileOrgTheme === "function") reconcileOrgTheme(SETTINGS);
    if (typeof render === "function") render();
  }
}
const OTHER_RELATIONSHIP = "Other";
const DEFAULT_RELATIONSHIPS = [
  "Mother",
  "Father",
  "Stepmother",
  "Stepfather",
  "Legal Guardian",
  "Grandparent",
  "Sibling",
  "Other Family",
  "Therapist",
  "Psychiatrist",
  "Psychologist",
  "Referring Professional",
  "Educational Consultant",
  "Case Manager",
  "School Counselor",
  "Attorney",
  "Physician",
  "Other Professional"
];
function relationshipOptions() {
  const s = SETTINGS;
  const fromSettings = s && s.contacts && Array.isArray(s.contacts.relationships) ? s.contacts.relationships.filter((x) => typeof x === "string" && x.trim()) : [];
  const list = fromSettings.length ? fromSettings : DEFAULT_RELATIONSHIPS;
  return list.filter((o) => o.trim().toLowerCase() !== OTHER_RELATIONSHIP.toLowerCase());
}
const DEFAULT_DECLINE_REASONS = [
  "Clinical fit",
  "Acuity too high",
  "No bed availability",
  "Insurance not accepted",
  "Age or gender not served",
  "Cost",
  "Family declined",
  "Other"
];
function declineReasonOptions() {
  const s = SETTINGS;
  const fromSettings = s && s.referrals && Array.isArray(s.referrals.declineReasons) ? s.referrals.declineReasons.filter((x) => typeof x === "string" && x.trim()) : [];
  return fromSettings.length ? fromSettings : DEFAULT_DECLINE_REASONS;
}
function defaultFolders() {
  const s = SETTINGS;
  return s && s.files && Array.isArray(s.files.defaultFolders) ? s.files.defaultFolders.filter((x) => typeof x === "string" && x.trim()) : [];
}
const DEFAULT_FOLDERS_SEED = ["Intake", "Assessments", "Medical", "Academic", "Legal", "Financial", "Correspondence"];
function programDefaultFolders() {
  const s = SETTINGS;
  return s && s.files && Array.isArray(s.files.programDefaultFolders) ? s.files.programDefaultFolders.filter((x) => typeof x === "string" && x.trim()) : [];
}
const PROGRAM_DEFAULT_FOLDERS_SEED = ["Tour Notes", "Brochures", "Contracts", "Accreditation", "Correspondence"];
function apiClientMeta() {
  return maestroGet("clientMeta");
}
function apiSession() {
  return maestroGet("session");
}
let CLIENT_STORE = null;
let CLIENTS_LOADING = false;
let CLIENTS_ERROR = null;
let INQUIRY_STORE = null;
let INQUIRIES_LOADING = false;
let INQUIRIES_ERROR = null;
let ALUMNI_STORE = null;
let ALUMNI_LOADING = false;
let ALUMNI_ERROR = null;
function realToClient(r) {
  const race = Array.isArray(r.race) ? r.race : r.race ? [String(r.race)] : [];
  return {
    id: String(r.id || r.shortId || ""),
    first: r.firstName || "",
    last: r.lastName || "",
    dob: r.dob || "",
    gender: r.gender || "",
    status: "",
    grade: "",
    source: "",
    sourceName: "",
    summary: "",
    concerns: [],
    demo: { pronouns: r.pronouns || "", race: race[0] || "", ethnicity: r.ethnicity || "", city: r.homeCity || "", state: r.homeState || "" },
    contacts: [],
    documents: [],
    communications: [],
    placements: [],
    tasks: [],
    prefName: r.prefName || "",
    email: r.email || "",
    cell: r.cell || "",
    homePhone: r.homePhone || "",
    homeZip: r.homeZip || "",
    viewUrl: r.viewUrl || "",
    photoUrl: r.photo || "",
    // Lifecycle stage from the maestro (categories → 'inquiry'|'client'|'alumni').
    // Falls back to 'client' for legacy rows; the per-store loaders also set it.
    entity: r.stage || "client",
    raw: r
  };
}
let CLIENT_META = null;
let META_LOADING = false;
function metaOptions(key) {
  if (CLIENT_META && CLIENT_META.options && CLIENT_META.options[key]) return CLIENT_META.options[key];
  return [];
}
async function loadClientMeta() {
  if (META_LOADING || CLIENT_META) return;
  META_LOADING = true;
  try {
    CLIENT_META = await apiClientMeta();
  } catch (_e) {
    CLIENT_META = { options: {} };
  } finally {
    META_LOADING = false;
    if (typeof render === "function") render();
  }
}
let SESSION = null;
async function loadSession() {
  if (SESSION) return;
  try {
    SESSION = await apiSession();
  } catch (_e) {
    SESSION = { loggedIn: false, firstName: "", lastName: "", fullName: "", isSuper: false, orgName: "", logoUrl: "" };
  }
  if (typeof render === "function") render();
}
async function loadClients(force = false) {
  if (CLIENTS_LOADING) return;
  if (CLIENT_STORE && !force) return;
  CLIENTS_LOADING = true;
  CLIENTS_ERROR = null;
  try {
    const raw = await apiListClients();
    CLIENT_STORE = raw.map(realToClient);
  } catch (e) {
    CLIENTS_ERROR = e && e.message ? e.message : String(e);
    CLIENT_STORE = null;
  } finally {
    CLIENTS_LOADING = false;
    if (typeof render === "function") render();
  }
}
async function loadInquiries(force = false) {
  if (INQUIRIES_LOADING) return;
  if (INQUIRY_STORE && !force) return;
  INQUIRIES_LOADING = true;
  INQUIRIES_ERROR = null;
  try {
    const raw = await apiListInquiries();
    INQUIRY_STORE = raw.map(realToClient).map((c) => {
      c.entity = "inquiry";
      return c;
    });
  } catch (e) {
    INQUIRIES_ERROR = e && e.message ? e.message : String(e);
    INQUIRY_STORE = null;
  } finally {
    INQUIRIES_LOADING = false;
    if (typeof render === "function") render();
  }
}
async function loadAlumni(force = false) {
  if (ALUMNI_LOADING) return;
  if (ALUMNI_STORE && !force) return;
  ALUMNI_LOADING = true;
  ALUMNI_ERROR = null;
  try {
    const raw = await apiListAlumni();
    ALUMNI_STORE = raw.map(realToClient).map((c) => {
      c.entity = "alumni";
      return c;
    });
  } catch (e) {
    ALUMNI_ERROR = e && e.message ? e.message : String(e);
    ALUMNI_STORE = null;
  } finally {
    ALUMNI_LOADING = false;
    if (typeof render === "function") render();
  }
}
let DASHBOARD = null;
let DASHBOARD_LOADING = false;
let DASHBOARD_ERROR = null;
function apiDashboard() {
  return maestroGet("dashboard");
}
async function loadDashboard(force = false) {
  if (DASHBOARD_LOADING) return;
  if (DASHBOARD && !force) return;
  DASHBOARD_LOADING = true;
  DASHBOARD_ERROR = null;
  try {
    DASHBOARD = await apiDashboard();
  } catch (e) {
    DASHBOARD_ERROR = e && e.message ? e.message : String(e);
    DASHBOARD = null;
  } finally {
    DASHBOARD_LOADING = false;
    if (typeof render === "function") render();
  }
}
function ensureDashboard() {
  if (DASHBOARD === null && !DASHBOARD_LOADING && !DASHBOARD_ERROR) loadDashboard();
}
let PROGRAM_STORE = null;
let PROGRAMS_LOADING = false;
let PROGRAMS_ERROR = null;
const PROGRAM_DETAIL = {};
const PROGRAM_DETAIL_LOADING = {};
const PROGRAM_DETAIL_ERROR = {};
const PROGRAM_REFERRALS = {};
const PROGRAM_REFERRALS_LOADING = {};
const PROGRAM_REFERRALS_ERROR = {};
async function apiListPrograms() {
  return await maestroGet("listPrograms");
}
async function apiGetProgram(id) {
  return await maestroPost("getProgram", { id });
}
async function apiListProgramReferrals(id) {
  return await maestroPost("listAllReferrals", { program: id });
}
async function loadPrograms(force = false) {
  if (PROGRAMS_LOADING) return;
  if (PROGRAM_STORE && !force) return;
  PROGRAMS_LOADING = true;
  PROGRAMS_ERROR = null;
  try {
    PROGRAM_STORE = await apiListPrograms();
  } catch (e) {
    PROGRAMS_ERROR = e && e.message ? e.message : String(e);
    PROGRAM_STORE = null;
  } finally {
    PROGRAMS_LOADING = false;
    if (typeof render === "function") render();
  }
}
async function loadProgram(id, force = false) {
  if (PROGRAM_DETAIL_LOADING[id]) return;
  if (PROGRAM_DETAIL[id] && !force) return;
  PROGRAM_DETAIL_LOADING[id] = true;
  delete PROGRAM_DETAIL_ERROR[id];
  try {
    PROGRAM_DETAIL[id] = await apiGetProgram(id);
  } catch (e) {
    PROGRAM_DETAIL_ERROR[id] = e && e.message ? e.message : String(e);
  } finally {
    PROGRAM_DETAIL_LOADING[id] = false;
    if (typeof render === "function") render();
  }
}
async function loadProgramReferrals(id, force = false) {
  if (PROGRAM_REFERRALS_LOADING[id]) return;
  if (PROGRAM_REFERRALS[id] && !force) return;
  PROGRAM_REFERRALS_LOADING[id] = true;
  delete PROGRAM_REFERRALS_ERROR[id];
  try {
    PROGRAM_REFERRALS[id] = await apiListProgramReferrals(id);
  } catch (e) {
    PROGRAM_REFERRALS_ERROR[id] = e && e.message ? e.message : String(e);
  } finally {
    PROGRAM_REFERRALS_LOADING[id] = false;
    if (typeof render === "function") render();
  }
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiYXBpLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgIGFwaS50cyBcdTIwMTQgdGhlIHNpbmdsZSBzZWFtIGJldHdlZW4gdGhlIFNQQSBhbmQgdGhlIGJhY2tlbmQuXG4gICBFdmVyeXRoaW5nIHRoYXQgY3JlYXRlcy9yZWFkcy91cGRhdGVzL2RlbGV0ZXMgZGF0YSBnb2VzIHRocm91Z2ggdGhlXG4gICBNYXN0ZXIgTWFlc3RybyBlbmRwb2ludCAoL2IvbWFlc3RybykgYXMgYSBKU09OIGFjdGlvbiBlbnZlbG9wZTpcbiAgICAgcmVxdWVzdCA6IHsgYWN0aW9uLCAuLi5maWVsZHMgfVxuICAgICByZXBseSAgIDogeyBvazp0cnVlLCBkYXRhIH0gfCB7IG9rOmZhbHNlLCBlcnJvciB9XG4gICBTYW1lLW9yaWdpbiBmZXRjaCBcdTIwMTQgdGhlIEJsdWVTdGVwIHNlc3Npb24gY29va2llIHJpZGVzIGFsb25nIGF1dG9tYXRpY2FsbHkuXG4gICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cblxuY29uc3QgTUFFU1RST19VUkwgPSAnL2IvbWFlc3Rybyc7XG5cbi8vIFBPU1QgYW4gYWN0aW9uIHRvIHRoZSBtYWVzdHJvIGFuZCByZXR1cm4gaXRzIGBkYXRhYCwgb3IgdGhyb3cgd2l0aCB0aGVcbi8vIHNlcnZlcidzIGVycm9yIG1lc3NhZ2UuXG5hc3luYyBmdW5jdGlvbiBtYWVzdHJvUG9zdChhY3Rpb246IHN0cmluZywgcGF5bG9hZDogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pOiBQcm9taXNlPGFueT4ge1xuICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChNQUVTVFJPX1VSTCwge1xuICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgYWN0aW9uOiBhY3Rpb24sIC4uLnBheWxvYWQgfSksXG4gIH0pO1xuICBsZXQganNvbjogYW55ID0gbnVsbDtcbiAgdHJ5IHtcbiAgICBqc29uID0gYXdhaXQgcmVzLmpzb24oKTtcbiAgfSBjYXRjaCAoX2UpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1NlcnZlciByZXR1cm5lZCBhIG5vbi1KU09OIHJlc3BvbnNlIChIVFRQICcgKyByZXMuc3RhdHVzICsgJykuJyk7XG4gIH1cbiAgaWYgKCFqc29uIHx8IGpzb24ub2sgIT09IHRydWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoanNvbiAmJiBqc29uLmVycm9yID8ganNvbi5lcnJvciA6ICdSZXF1ZXN0IGZhaWxlZCAoSFRUUCAnICsgcmVzLnN0YXR1cyArICcpLicpO1xuICB9XG4gIHJldHVybiBqc29uLmRhdGE7XG59XG5cbi8vIEdFVCBhbiBhY3Rpb24gZnJvbSB0aGUgbWFlc3RybyBhbmQgcmV0dXJuIGl0cyBgZGF0YWAsIG9yIHRocm93LlxuYXN5bmMgZnVuY3Rpb24gbWFlc3Ryb0dldChhY3Rpb246IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKE1BRVNUUk9fVVJMICsgJz9hY3Rpb249JyArIGVuY29kZVVSSUNvbXBvbmVudChhY3Rpb24pLCB7IGhlYWRlcnM6IHsgJ0FjY2VwdCc6ICdhcHBsaWNhdGlvbi9qc29uJyB9IH0pO1xuICBsZXQganNvbjogYW55ID0gbnVsbDtcbiAgdHJ5IHtcbiAgICBqc29uID0gYXdhaXQgcmVzLmpzb24oKTtcbiAgfSBjYXRjaCAoX2UpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1NlcnZlciByZXR1cm5lZCBhIG5vbi1KU09OIHJlc3BvbnNlIChIVFRQICcgKyByZXMuc3RhdHVzICsgJykuJyk7XG4gIH1cbiAgaWYgKCFqc29uIHx8IGpzb24ub2sgIT09IHRydWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoanNvbiAmJiBqc29uLmVycm9yID8ganNvbi5lcnJvciA6ICdSZXF1ZXN0IGZhaWxlZCAoSFRUUCAnICsgcmVzLnN0YXR1cyArICcpLicpO1xuICB9XG4gIHJldHVybiBqc29uLmRhdGE7XG59XG5cbi8qIC0tLS0gQmx1ZUlRIGFzc2lzdGFudCAoc2VwYXJhdGUgZW5kcG9pbnQgL2IvYmx1ZWlxKSAtLS0tICovXG5jb25zdCBCTFVFSVFfVVJMID0gJy9iL2JsdWVpcSc7XG5cbi8vIFBPU1QgYW4gYWN0aW9uIHRvIHRoZSBCbHVlSVEgZW5kcG9pbnQ7IHNhbWUgZW52ZWxvcGUgYXMgdGhlIG1hZXN0cm9cbi8vICh7IG9rOnRydWUsIGRhdGEgfSB8IHsgb2s6ZmFsc2UsIGVycm9yIH0pLiBUaHJvd3Mgd2l0aCB0aGUgc2VydmVyJ3MgbWVzc2FnZS5cbmFzeW5jIGZ1bmN0aW9uIGJsdWVpcVBvc3QoYWN0aW9uOiBzdHJpbmcsIHBheWxvYWQ6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogUHJvbWlzZTxhbnk+IHtcbiAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goQkxVRUlRX1VSTCwge1xuICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgYWN0aW9uOiBhY3Rpb24sIC4uLnBheWxvYWQgfSksXG4gIH0pO1xuICBsZXQganNvbjogYW55ID0gbnVsbDtcbiAgdHJ5IHtcbiAgICBqc29uID0gYXdhaXQgcmVzLmpzb24oKTtcbiAgfSBjYXRjaCAoX2UpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0JsdWVJUSByZXR1cm5lZCBhIG5vbi1KU09OIHJlc3BvbnNlIChIVFRQICcgKyByZXMuc3RhdHVzICsgJykuJyk7XG4gIH1cbiAgaWYgKCFqc29uIHx8IGpzb24ub2sgIT09IHRydWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoanNvbiAmJiBqc29uLmVycm9yID8ganNvbi5lcnJvciA6ICdCbHVlSVEgcmVxdWVzdCBmYWlsZWQgKEhUVFAgJyArIHJlcy5zdGF0dXMgKyAnKS4nKTtcbiAgfVxuICByZXR1cm4ganNvbi5kYXRhO1xufVxuXG4vLyBBc2sgQmx1ZUlRIGEgcXVlc3Rpb24uIGBzY29wZWAgaXMgJ2NsaWVudCcgKGJvdW5kIHRvIGNsaWVudElkKSBvciAnZ2xvYmFsJ1xuLy8gKGNhc2Vsb2FkLXdpZGUpLiBgaGlzdG9yeWAgaXMgdGhlIHByaW9yIFt7cm9sZSxjb250ZW50fV0gdHVybnMuIFJlc29sdmVzIHRvXG4vLyB7IGFzc2lzdGFudE1lc3NhZ2UsIHRvb2xDYWxscywgdXNhZ2UgfS5cbmZ1bmN0aW9uIGFwaUJsdWVpcUNoYXQoc2NvcGU6ICdjbGllbnQnIHwgJ2dsb2JhbCcsIGNsaWVudElkOiBzdHJpbmcsIHF1ZXN0aW9uOiBzdHJpbmcsIGhpc3Rvcnk6IHsgcm9sZTogc3RyaW5nOyBjb250ZW50OiBzdHJpbmcgfVtdLCBwcm9ncmFtSWQ/OiBzdHJpbmcsIHByb2dyYW1OYW1lPzogc3RyaW5nLCBwcm9ncmFtRmlsdGVyPzogYW55KTogUHJvbWlzZTxhbnk+IHtcbiAgcmV0dXJuIGJsdWVpcVBvc3QoJ2NoYXQnLCB7IHNjb3BlOiBzY29wZSwgY2xpZW50SWQ6IGNsaWVudElkIHx8ICcnLCBxdWVzdGlvbjogcXVlc3Rpb24sIGhpc3Rvcnk6IGhpc3RvcnksIHByb2dyYW1JZDogcHJvZ3JhbUlkIHx8ICcnLCBwcm9ncmFtTmFtZTogcHJvZ3JhbU5hbWUgfHwgJycsIHByb2dyYW1GaWx0ZXI6IHByb2dyYW1GaWx0ZXIgfHwgbnVsbCB9KTtcbn1cblxuLy8gSXMgQmx1ZUlRIGVuYWJsZWQgZm9yIHRoZSBjdXJyZW50IHVzZXI/IERyaXZlcyB3aGV0aGVyIHRoZSBhc3Npc3RhbnQgYnViYmxlXG4vLyBtb3VudHMgYXQgYWxsIChCbHVlSVEgaXMgYSBwZXItdXNlciBvcHQtaW4gc2VhdCkuIFJlc29sdmVzIHRvXG4vLyB7IGVuYWJsZWQsIGFsbG93ZWQsIHJlYXNvbiwgdXNlZCwgbGltaXQsIHJlbWFpbmluZyB9LlxuZnVuY3Rpb24gYXBpQmx1ZWlxU3RhdHVzKCk6IFByb21pc2U8YW55PiB7XG4gIHJldHVybiBibHVlaXFQb3N0KCdzdGF0dXMnLCB7fSk7XG59XG5cbi8qIC0tLS0gQmx1ZUlRIG5vdGUgY2FwdHVyZSAodHJhbnNjcmliZSArIGNvbXBvc2UpIC0tLS1cbiAgIFRoZXNlIHJldHVybiB0aGUgRlVMTCBlbnZlbG9wZSAobmV2ZXIgdGhyb3cgb24gb2s6ZmFsc2UpIHNvIHRoZSBjYWxsZXIgY2FuXG4gICBicmFuY2ggb24gZmxhZ3MgXHUyMDE0IGEgY3JlZGl0TGltaXRSZWFjaGVkIGNvbXBvc2UgY2FuIGZhbGwgb3BlbiB0byBtYW51YWwgZmlsaW5nXG4gICBpbnN0ZWFkIG9mIHN1cmZhY2luZyBhcyBhIGhhcmQgZXJyb3IuICovXG5hc3luYyBmdW5jdGlvbiBibHVlaXFQb3N0UmF3KGFjdGlvbjogc3RyaW5nLCBwYXlsb2FkOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IFByb21pc2U8YW55PiB7XG4gIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKEJMVUVJUV9VUkwsIHtcbiAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSxcbiAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGFjdGlvbjogYWN0aW9uLCAuLi5wYXlsb2FkIH0pLFxuICB9KTtcbiAgdHJ5IHsgcmV0dXJuIGF3YWl0IHJlcy5qc29uKCk7IH1cbiAgY2F0Y2ggKF9lKSB7IHJldHVybiB7IG9rOiBmYWxzZSwgZXJyb3I6ICdCbHVlSVEgcmV0dXJuZWQgYSBub24tSlNPTiByZXNwb25zZSAoSFRUUCAnICsgcmVzLnN0YXR1cyArICcpLicgfTsgfVxufVxuLy8gVm9pY2UgXHUyMTkyIHRyYW5zY3JpcHQuIGB2b2NhYmAgKGNsaWVudCArIHByb2dyYW0gbmFtZXMpIGJpYXNlcyBwcm9wZXItbm91biBzcGVsbGluZy5cbmZ1bmN0aW9uIGFwaUJsdWVpcVRyYW5zY3JpYmUoYXVkaW9CNjQ6IHN0cmluZywgbWltZVR5cGU6IHN0cmluZywgdm9jYWI6IHN0cmluZ1tdKTogUHJvbWlzZTxhbnk+IHtcbiAgcmV0dXJuIGJsdWVpcVBvc3RSYXcoJ3RyYW5zY3JpYmUnLCB7IGF1ZGlvOiBhdWRpb0I2NCwgbWltZVR5cGU6IG1pbWVUeXBlLCB2b2NhYjogdm9jYWIgfHwgW10gfSk7XG59XG4vLyBSYXcgdGV4dCBcdTIxOTIgc3RydWN0dXJlZCBlZGl0YWJsZSBkcmFmdCAobm90aGluZyBpcyB3cml0dGVuIHNlcnZlci1zaWRlKS5cbmZ1bmN0aW9uIGFwaUJsdWVpcUNvbXBvc2UocGF5bG9hZDogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pOiBQcm9taXNlPGFueT4ge1xuICByZXR1cm4gYmx1ZWlxUG9zdFJhdygnY29tcG9zZScsIHBheWxvYWQpO1xufVxuLy8gQWxsb3dlZCBTaW5nbGVTZWxlY3QgZGlzcGxheS1uYW1lIHZhbHVlcyBmb3Igbm90ZSBkcm9wZG93bnMgKGNvbW0gdHlwZSwgbm90ZVxuLy8gdHlwZSwgdG91ciBmb3JtYXQsIHRhc2sgcHJpb3JpdHkpLiBDYWNoZWQgYnkgdGhlIGNhbGxlci5cbmZ1bmN0aW9uIGFwaU5vdGVNZXRhKCk6IFByb21pc2U8YW55PiB7XG4gIHJldHVybiBtYWVzdHJvR2V0KCdub3RlTWV0YScpO1xufVxuXG4vKiAtLS0tIFNhdmUgYSBCbHVlSVEtY2FwdHVyZWQgbm90ZSAtLS0tIGFkZHMgY2FwdHVyZSBwcm92ZW5hbmNlIChjYXB0dXJlZFZpYSArXG4gICB2ZXJiYXRpbSBzb3VyY2VUcmFuc2NyaXB0KSBhcyB0b3AtbGV2ZWwga2V5czsgdGhlIG1hZXN0cm8gc3RhbXBzIHRoZW1cbiAgIGJlc3QtZWZmb3J0IChuby1vcCB1bnRpbCB0aGUgYWRtaW4gYWRkcyB0aG9zZSBmaWVsZHMgdG8gdGhlIGZvcm1zKS4gKi9cbmZ1bmN0aW9uIGFwaUNhcHR1cmVBZGRDb21tdW5pY2F0aW9uKGNsaWVudElkOiBzdHJpbmcsIGZpZWxkczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sIHRyYW5zY3JpcHQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gIHJldHVybiBtYWVzdHJvUG9zdCgnYWRkQ29tbXVuaWNhdGlvbicsIHsgaWQ6IGNsaWVudElkLCBmaWVsZHM6IGZpZWxkcywgY2FwdHVyZWRWaWE6ICdCbHVlSVEnLCBzb3VyY2VUcmFuc2NyaXB0OiB0cmFuc2NyaXB0IHx8ICcnIH0pO1xufVxuZnVuY3Rpb24gYXBpQ2FwdHVyZUFkZFRhc2soY2xpZW50SWQ6IHN0cmluZywgZmllbGRzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiwgdHJhbnNjcmlwdDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgcmV0dXJuIG1hZXN0cm9Qb3N0KCdhZGRUYXNrJywgeyBpZDogY2xpZW50SWQsIGZpZWxkczogZmllbGRzLCBjYXB0dXJlZFZpYTogJ0JsdWVJUScsIHNvdXJjZVRyYW5zY3JpcHQ6IHRyYW5zY3JpcHQgfHwgJycgfSk7XG59XG5mdW5jdGlvbiBhcGlDYXB0dXJlQWRkUHJvZ3JhbU5vdGUoZHBpZDogc3RyaW5nLCBoaW50czogUHJvZ3JhbUhpbnRzLCBmaWVsZHM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LCB0cmFuc2NyaXB0OiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICByZXR1cm4gbWFlc3Ryb1Bvc3QoJ2FkZFByb2dyYW1Ob3RlJywgeyBkaXJlY3RvcnlQcm9ncmFtSWQ6IGRwaWQsIGZpZWxkczogZmllbGRzLCAuLi5oaW50cywgY2FwdHVyZWRWaWE6ICdCbHVlSVEnLCBzb3VyY2VUcmFuc2NyaXB0OiB0cmFuc2NyaXB0IHx8ICcnIH0pO1xufVxuXG4vKiAtLS0tIEJsdWVJUSBhZG1pbiAoc2VwYXJhdGUgcnVuQXNTdXBlciBlbmRwb2ludCAvYi9ibHVlaXFBZG1pbikgLS0tLVxuICAgRmlybS1hZG1pbiBtYW5hZ2VtZW50IG9mIHBlci11c2VyIEJsdWVJUSBzZWF0cy4gRXZlcnkgYWN0aW9uIGlzIGdhdGVkXG4gICBzZXJ2ZXItc2lkZSB0byBhIEJsdWVJUSBhZG1pbiAob3IgZ2xvYmFsIHN1cGVyKS4gKi9cbmNvbnN0IEJMVUVJUV9BRE1JTl9VUkwgPSAnL2IvYmx1ZWlxQWRtaW4nO1xuXG5hc3luYyBmdW5jdGlvbiBibHVlaXFBZG1pblBvc3QoYWN0aW9uOiBzdHJpbmcsIHBheWxvYWQ6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogUHJvbWlzZTxhbnk+IHtcbiAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goQkxVRUlRX0FETUlOX1VSTCwge1xuICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgYWN0aW9uOiBhY3Rpb24sIC4uLnBheWxvYWQgfSksXG4gIH0pO1xuICBsZXQganNvbjogYW55ID0gbnVsbDtcbiAgdHJ5IHsganNvbiA9IGF3YWl0IHJlcy5qc29uKCk7IH1cbiAgY2F0Y2ggKF9lKSB7IHRocm93IG5ldyBFcnJvcignQmx1ZUlRIGFkbWluIHJldHVybmVkIGEgbm9uLUpTT04gcmVzcG9uc2UgKEhUVFAgJyArIHJlcy5zdGF0dXMgKyAnKS4nKTsgfVxuICBpZiAoIWpzb24gfHwganNvbi5vayAhPT0gdHJ1ZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihqc29uICYmIGpzb24uZXJyb3IgPyBqc29uLmVycm9yIDogJ0JsdWVJUSBhZG1pbiByZXF1ZXN0IGZhaWxlZCAoSFRUUCAnICsgcmVzLnN0YXR1cyArICcpLicpO1xuICB9XG4gIHJldHVybiBqc29uLmRhdGE7XG59XG5cbi8vIFdoZXRoZXIgdGhlIGN1cnJlbnQgdXNlciBtYXkgbWFuYWdlIEJsdWVJUSBzZWF0cy4geyBpc1N1cGVyLCBpc0FkbWluLCBlbmFibGVkLCB1c2VyIH0uXG5mdW5jdGlvbiBhcGlCbHVlaXFBZG1pbkNvbnRleHQoKTogUHJvbWlzZTxhbnk+IHsgcmV0dXJuIGJsdWVpcUFkbWluUG9zdCgnY29udGV4dCcsIHt9KTsgfVxuLy8gQWxsIG9yZyB1c2VycyBtZXJnZWQgd2l0aCBzdWJzY3JpcHRpb24gc3RhdGUuIHsgdXNlcnM6W1x1MjAyNl0sIGRlZmF1bHRNb250aGx5Q3JlZGl0cyB9LlxuZnVuY3Rpb24gYXBpQmx1ZWlxTGlzdFVzZXJzKCk6IFByb21pc2U8YW55PiB7IHJldHVybiBibHVlaXFBZG1pblBvc3QoJ2xpc3RVc2VycycsIHt9KTsgfVxuLy8gVXBzZXJ0IGEgdXNlcidzIHNlYXQuIE9ubHkgcHJvdmlkZWQgZmllbGRzIGNoYW5nZS5cbmZ1bmN0aW9uIGFwaUJsdWVpcVNldFN1YnNjcmlwdGlvbihwOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IFByb21pc2U8YW55PiB7IHJldHVybiBibHVlaXFBZG1pblBvc3QoJ3NldFN1YnNjcmlwdGlvbicsIHApOyB9XG4vLyBSZW1vdmUgYSB1c2VyJ3Mgc2VhdCBlbnRpcmVseS5cbmZ1bmN0aW9uIGFwaUJsdWVpcVJlbW92ZVN1YnNjcmlwdGlvbih1c2VySWQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7IHJldHVybiBibHVlaXFBZG1pblBvc3QoJ3JlbW92ZVN1YnNjcmlwdGlvbicsIHsgdXNlcklkOiB1c2VySWQgfSk7IH1cblxuLy8gQ3JlYXRlIGEgQ2xpZW50IHJlY29yZC4gUmVzb2x2ZXMgdG8gdGhlIGZ1bGwgbmV3IHJlY29yZCAoYWxsIGNhdGFsb2cgZmllbGRzKS5cbmZ1bmN0aW9uIGFwaUNyZWF0ZUNsaWVudChwYXlsb2FkOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IFByb21pc2U8YW55PiB7XG4gIHJldHVybiBtYWVzdHJvUG9zdCgnY3JlYXRlQ2xpZW50JywgcGF5bG9hZCk7XG59XG4vLyBDcmVhdGUgYSBwZXJzb24gb2YgYSBnaXZlbiBjYXRlZ29yeSAoJ2NsaWVudCcgfCAnaW5xdWlyeScgfCAnYWx1bW5pJykuXG5mdW5jdGlvbiBhcGlDcmVhdGVQZXJzb24oZW50aXR5OiBzdHJpbmcsIHBheWxvYWQ6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogUHJvbWlzZTxhbnk+IHtcbiAgY29uc3QgYWN0aW9uID0gJ2NyZWF0ZScgKyBlbnRpdHkuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBlbnRpdHkuc2xpY2UoMSk7XG4gIHJldHVybiBtYWVzdHJvUG9zdChhY3Rpb24sIHBheWxvYWQpO1xufVxuXG4vLyBVcGRhdGUgYSBDbGllbnQgcmVjb3JkLiBXcml0ZXMgT05MWSB0aGUga2V5cyBpbiBgZmllbGRzYCAocGFydGlhbCBzYXZlKS5cbi8vIFJlc29sdmVzIHRvIHRoZSBmdWxsIHVwZGF0ZWQgcmVjb3JkLlxuZnVuY3Rpb24gYXBpVXBkYXRlQ2xpZW50KGlkOiBzdHJpbmcsIGZpZWxkczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pOiBQcm9taXNlPGFueT4ge1xuICByZXR1cm4gbWFlc3Ryb1Bvc3QoJ3VwZGF0ZUNsaWVudCcsIHsgaWQ6IGlkLCBmaWVsZHM6IGZpZWxkcyB9KTtcbn1cblxuLy8gUGVybWFuZW50bHkgZGVsZXRlIGEgQ2xpZW50IHJlY29yZCBieSBmdWxsIGlkLiBJcnJldmVyc2libGUgb24gdGhlIHNlcnZlci5cbmZ1bmN0aW9uIGFwaURlbGV0ZUNsaWVudChpZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgcmV0dXJuIG1hZXN0cm9Qb3N0KCdkZWxldGVDbGllbnQnLCB7IGlkOiBpZCB9KTtcbn1cblxuLy8gTW92ZSBhIHBlcnNvbiBiZXR3ZWVuIGxpZmVjeWNsZSBzdGFnZXMgKCdpbnF1aXJ5JyB8ICdjbGllbnQnIHwgJ2FsdW1uaScpLiBUaGVcbi8vIG1hZXN0cm8gcmVjb25jaWxlcyB0aGUgcmVjb3JkJ3MgY2F0ZWdvcmllcyB0byB0aGUgdGFyZ2V0IHN0YWdlJ3MgY3VtdWxhdGl2ZVxuLy8gc2V0LiBSZXR1cm5zIHsgaWQsIHN0YWdlLCBjaGFuZ2VkLCBjYXRlZ29yaWVzIH0uXG5mdW5jdGlvbiBhcGlTZXRTdGFnZShpZDogc3RyaW5nLCBzdGFnZTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgcmV0dXJuIG1hZXN0cm9Qb3N0KCdzZXRTdGFnZScsIHsgaWQ6IGlkLCBzdGFnZTogc3RhZ2UgfSk7XG59XG5cbi8vIExpc3QgbGl2ZSBDbGllbnQgcmVjb3JkcyAocmF3IHJvd3MgZnJvbSB0aGUgbWFlc3RybykuXG5mdW5jdGlvbiBhcGlMaXN0Q2xpZW50cygpOiBQcm9taXNlPGFueVtdPiB7XG4gIHJldHVybiBtYWVzdHJvR2V0KCdsaXN0Q2xpZW50cycpO1xufVxuLy8gTGlzdCBsaXZlIElucXVpcnkgLyBBbHVtbmkgcmVjb3JkcyAodGhlIG90aGVyIHR3byBJbmRpdmlkdWFsIGNhdGVnb3JpZXMpLlxuZnVuY3Rpb24gYXBpTGlzdElucXVpcmllcygpOiBQcm9taXNlPGFueVtdPiB7XG4gIHJldHVybiBtYWVzdHJvR2V0KCdsaXN0SW5xdWlyaWVzJyk7XG59XG5mdW5jdGlvbiBhcGlMaXN0QWx1bW5pKCk6IFByb21pc2U8YW55W10+IHtcbiAgcmV0dXJuIG1hZXN0cm9HZXQoJ2xpc3RBbHVtbmknKTtcbn1cblxuLy8gU2V0IChvciBjbGVhcikgYSBDbGllbnQncyBwaG90by4gYGRhdGFCYXNlNjRgIGlzIFJBVyBiYXNlNjQgKG5vIGRhdGE6IHByZWZpeCk7XG4vLyBwYXNzICcnIHRvIHJlbW92ZSB0aGUgcGhvdG8uIFJlc29sdmVzIHRvIHRoZSBmdWxsIHVwZGF0ZWQgcmVjb3JkICh3aXRoIHBob3RvIFVSTCkuXG5mdW5jdGlvbiBhcGlTZXRDbGllbnRQaG90byhpZDogc3RyaW5nLCBkYXRhQmFzZTY0OiBzdHJpbmcsIGZpbGVuYW1lOiBzdHJpbmcsIGNvbnRlbnRUeXBlOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICByZXR1cm4gbWFlc3Ryb1Bvc3QoJ3VwbG9hZENsaWVudFBob3RvJywgeyBpZDogaWQsIGRhdGFCYXNlNjQ6IGRhdGFCYXNlNjQsIGZpbGVuYW1lOiBmaWxlbmFtZSwgY29udGVudFR5cGU6IGNvbnRlbnRUeXBlIH0pO1xufVxuXG4vLyBTZXQgKG9yIGNsZWFyKSB0aGUgb3JnYW5pemF0aW9uIGxvZ28gKGEgRG9jdW1lbnRMaW5rRmllbGQgb24gdGhlIG9yZyByZWNvcmQpLlxuLy8gYGRhdGFCYXNlNjRgIGlzIFJBVyBiYXNlNjQgKG5vIGRhdGE6IHByZWZpeCk7IHBhc3MgJycgdG8gcmVtb3ZlLiBSZXNvbHZlcyB0b1xuLy8geyBsb2dvVXJsIH0gXHUyMDE0IHRoZSBzYW1lLW9yaWdpbiBpbWFnZSBVUkwgKG9yICcnIHdoZW4gY2xlYXJlZCkuXG5mdW5jdGlvbiBhcGlVcGxvYWRPcmdMb2dvKGRhdGFCYXNlNjQ6IHN0cmluZywgZmlsZW5hbWU6IHN0cmluZywgY29udGVudFR5cGU6IHN0cmluZyk6IFByb21pc2U8eyBsb2dvVXJsOiBzdHJpbmcgfT4ge1xuICByZXR1cm4gbWFlc3Ryb1Bvc3QoJ3VwbG9hZE9yZ0xvZ28nLCB7IGRhdGFCYXNlNjQ6IGRhdGFCYXNlNjQsIGZpbGVuYW1lOiBmaWxlbmFtZSwgY29udGVudFR5cGU6IGNvbnRlbnRUeXBlIH0pO1xufVxuZnVuY3Rpb24gYXBpUmVtb3ZlT3JnTG9nbygpOiBQcm9taXNlPHsgbG9nb1VybDogc3RyaW5nIH0+IHtcbiAgcmV0dXJuIG1hZXN0cm9Qb3N0KCd1cGxvYWRPcmdMb2dvJywgeyBkYXRhQmFzZTY0OiAnJyB9KTtcbn1cblxuLyogLS0tLSBjb250YWN0cyAobXVsdGktZW50cnkgZm9ybSBvbiBhIGNsaWVudCkgLS0tLSAqL1xuLy8gQWxsIFBPU1QgKHRoZSByZWFkIG5lZWRzIHRoZSBwYXJlbnQgaWQgaW4gdGhlIGJvZHkpLiBFYWNoIGNvbnRhY3QgY2FycmllcyBhblxuLy8gYGVudHJ5SWRgICh0aGUgTUVGIGVudHJ5J3MgZnVsbCBpZCkgdXNlZCB0byB0YXJnZXQgdXBkYXRlcy9kZWxldGVzLlxuZnVuY3Rpb24gYXBpTGlzdENvbnRhY3RzKGNsaWVudElkOiBzdHJpbmcpOiBQcm9taXNlPGFueVtdPiB7XG4gIHJldHVybiBtYWVzdHJvUG9zdCgnbGlzdENvbnRhY3RzJywgeyBpZDogY2xpZW50SWQgfSk7XG59XG5mdW5jdGlvbiBhcGlBZGRDb250YWN0KGNsaWVudElkOiBzdHJpbmcsIGZpZWxkczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pOiBQcm9taXNlPGFueT4ge1xuICByZXR1cm4gbWFlc3Ryb1Bvc3QoJ2FkZENvbnRhY3QnLCB7IGlkOiBjbGllbnRJZCwgZmllbGRzOiBmaWVsZHMgfSk7XG59XG5mdW5jdGlvbiBhcGlVcGRhdGVDb250YWN0KGNsaWVudElkOiBzdHJpbmcsIGVudHJ5SWQ6IHN0cmluZywgZmllbGRzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IFByb21pc2U8YW55PiB7XG4gIHJldHVybiBtYWVzdHJvUG9zdCgndXBkYXRlQ29udGFjdCcsIHsgaWQ6IGNsaWVudElkLCBlbnRyeUlkOiBlbnRyeUlkLCBmaWVsZHM6IGZpZWxkcyB9KTtcbn1cbmZ1bmN0aW9uIGFwaURlbGV0ZUNvbnRhY3QoY2xpZW50SWQ6IHN0cmluZywgZW50cnlJZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgcmV0dXJuIG1hZXN0cm9Qb3N0KCdkZWxldGVDb250YWN0JywgeyBpZDogY2xpZW50SWQsIGVudHJ5SWQ6IGVudHJ5SWQgfSk7XG59XG4vLyBTZXQgKG9yIGNsZWFyKSBvbmUgY29udGFjdCdzIHBob3RvLiBgZGF0YUJhc2U2NGAgaXMgUkFXIGJhc2U2NDsgJycgY2xlYXJzIGl0LlxuZnVuY3Rpb24gYXBpU2V0Q29udGFjdFBob3RvKGNsaWVudElkOiBzdHJpbmcsIGVudHJ5SWQ6IHN0cmluZywgZGF0YUJhc2U2NDogc3RyaW5nLCBmaWxlbmFtZTogc3RyaW5nLCBjb250ZW50VHlwZTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgcmV0dXJuIG1hZXN0cm9Qb3N0KCd1cGxvYWRDb250YWN0UGhvdG8nLCB7IGlkOiBjbGllbnRJZCwgZW50cnlJZDogZW50cnlJZCwgZGF0YUJhc2U2NDogZGF0YUJhc2U2NCwgZmlsZW5hbWU6IGZpbGVuYW1lLCBjb250ZW50VHlwZTogY29udGVudFR5cGUgfSk7XG59XG5cbi8qIC0tLS0gY29tbXVuaWNhdGlvbnMgKG11bHRpLWVudHJ5IFwiY29tbXVuaWNhdGlvbnNcIiBmb3JtIG9uIGEgY2xpZW50KSAtLS0tXG4gICBBIHNpbXBsZSBjb21tdW5pY2F0aW9uIGxvZy4gRWFjaCBlbnRyeSBjYXJyaWVzIGFuIGBlbnRyeUlkYC4gbG9nZ2VkQnkvbG9nZ2VkQXRcbiAgIGFyZSBzZXJ2ZXItc3RhbXBlZCBvbiBhZGQgKHRoZSBsb2dnZWQtaW4gdXNlciArIHRoZSBjcmVhdGUgaW5zdGFudCkuIEFsbCBQT1NUXG4gICAodGhlIHJlYWQgbmVlZHMgdGhlIHBhcmVudCBpZCBpbiB0aGUgYm9keSkuICovXG5mdW5jdGlvbiBhcGlMaXN0Q29tbXVuaWNhdGlvbnMoY2xpZW50SWQ6IHN0cmluZyk6IFByb21pc2U8YW55W10+IHtcbiAgcmV0dXJuIG1hZXN0cm9Qb3N0KCdsaXN0Q29tbXVuaWNhdGlvbnMnLCB7IGlkOiBjbGllbnRJZCB9KTtcbn1cbmZ1bmN0aW9uIGFwaUFkZENvbW11bmljYXRpb24oY2xpZW50SWQ6IHN0cmluZywgZmllbGRzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IFByb21pc2U8YW55PiB7XG4gIHJldHVybiBtYWVzdHJvUG9zdCgnYWRkQ29tbXVuaWNhdGlvbicsIHsgaWQ6IGNsaWVudElkLCBmaWVsZHM6IGZpZWxkcyB9KTtcbn1cbmZ1bmN0aW9uIGFwaVVwZGF0ZUNvbW11bmljYXRpb24oY2xpZW50SWQ6IHN0cmluZywgZW50cnlJZDogc3RyaW5nLCBmaWVsZHM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogUHJvbWlzZTxhbnk+IHtcbiAgcmV0dXJuIG1hZXN0cm9Qb3N0KCd1cGRhdGVDb21tdW5pY2F0aW9uJywgeyBpZDogY2xpZW50SWQsIGVudHJ5SWQ6IGVudHJ5SWQsIGZpZWxkczogZmllbGRzIH0pO1xufVxuZnVuY3Rpb24gYXBpRGVsZXRlQ29tbXVuaWNhdGlvbihjbGllbnRJZDogc3RyaW5nLCBlbnRyeUlkOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICByZXR1cm4gbWFlc3Ryb1Bvc3QoJ2RlbGV0ZUNvbW11bmljYXRpb24nLCB7IGlkOiBjbGllbnRJZCwgZW50cnlJZDogZW50cnlJZCB9KTtcbn1cblxuLyogLS0tLSB0YXNrcyAobXVsdGktZW50cnkgXCJ0YXNrc1wiIGZvcm0gb24gYSBjbGllbnQpIC0tLS0gKi9cbmZ1bmN0aW9uIGFwaUxpc3RUYXNrcyhjbGllbnRJZDogc3RyaW5nKTogUHJvbWlzZTxhbnlbXT4ge1xuICByZXR1cm4gbWFlc3Ryb1Bvc3QoJ2xpc3RUYXNrcycsIHsgaWQ6IGNsaWVudElkIH0pO1xufVxuZnVuY3Rpb24gYXBpQWRkVGFzayhjbGllbnRJZDogc3RyaW5nLCBmaWVsZHM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogUHJvbWlzZTxhbnk+IHtcbiAgcmV0dXJuIG1hZXN0cm9Qb3N0KCdhZGRUYXNrJywgeyBpZDogY2xpZW50SWQsIGZpZWxkczogZmllbGRzIH0pO1xufVxuZnVuY3Rpb24gYXBpVXBkYXRlVGFzayhjbGllbnRJZDogc3RyaW5nLCBlbnRyeUlkOiBzdHJpbmcsIGZpZWxkczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pOiBQcm9taXNlPGFueT4ge1xuICByZXR1cm4gbWFlc3Ryb1Bvc3QoJ3VwZGF0ZVRhc2snLCB7IGlkOiBjbGllbnRJZCwgZW50cnlJZDogZW50cnlJZCwgZmllbGRzOiBmaWVsZHMgfSk7XG59XG5mdW5jdGlvbiBhcGlEZWxldGVUYXNrKGNsaWVudElkOiBzdHJpbmcsIGVudHJ5SWQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gIHJldHVybiBtYWVzdHJvUG9zdCgnZGVsZXRlVGFzaycsIHsgaWQ6IGNsaWVudElkLCBlbnRyeUlkOiBlbnRyeUlkIH0pO1xufVxuXG4vKiAtLS0tIHJlZmVycmFscyAobXVsdGktZW50cnkgXCJyZWZlcnJhbHNcIiBmb3JtIG9uIGEgY2xpZW50KSAtLS0tXG4gICBFYWNoIGVudHJ5IHJlZmVyZW5jZXMgYSBkaXJlY3RvcnkgcHJvZ3JhbSBieSBwcm9ncmFtSWQgKEZLKSArIHByb2dyYW1OYW1lXG4gICAoc25hcHNob3QpLiBzdGF0dXMvZGVjbGluZVJlYXNvbiBjYXB0dXJlIHRoZSBhY2NlcHQvZGVueSBvdXRjb21lLiBjcmVhdGVkQnkvXG4gICBjcmVhdGVkQXQgYXJlIHN0YW1wZWQgc2VydmVyLXNpZGUgb24gYWRkLiBBbGwgUE9TVCAodGhlIHJlYWQgbmVlZHMgdGhlIHBhcmVudFxuICAgaWQgaW4gdGhlIGJvZHkpLiAqL1xuZnVuY3Rpb24gYXBpTGlzdFJlZmVycmFscyhjbGllbnRJZDogc3RyaW5nKTogUHJvbWlzZTxhbnlbXT4ge1xuICByZXR1cm4gbWFlc3Ryb1Bvc3QoJ2xpc3RSZWZlcnJhbHMnLCB7IGlkOiBjbGllbnRJZCB9KTtcbn1cbmZ1bmN0aW9uIGFwaUFkZFJlZmVycmFsKGNsaWVudElkOiBzdHJpbmcsIGZpZWxkczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pOiBQcm9taXNlPGFueT4ge1xuICByZXR1cm4gbWFlc3Ryb1Bvc3QoJ2FkZFJlZmVycmFsJywgeyBpZDogY2xpZW50SWQsIGZpZWxkczogZmllbGRzIH0pO1xufVxuZnVuY3Rpb24gYXBpVXBkYXRlUmVmZXJyYWwoY2xpZW50SWQ6IHN0cmluZywgZW50cnlJZDogc3RyaW5nLCBmaWVsZHM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogUHJvbWlzZTxhbnk+IHtcbiAgcmV0dXJuIG1hZXN0cm9Qb3N0KCd1cGRhdGVSZWZlcnJhbCcsIHsgaWQ6IGNsaWVudElkLCBlbnRyeUlkOiBlbnRyeUlkLCBmaWVsZHM6IGZpZWxkcyB9KTtcbn1cbmZ1bmN0aW9uIGFwaURlbGV0ZVJlZmVycmFsKGNsaWVudElkOiBzdHJpbmcsIGVudHJ5SWQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gIHJldHVybiBtYWVzdHJvUG9zdCgnZGVsZXRlUmVmZXJyYWwnLCB7IGlkOiBjbGllbnRJZCwgZW50cnlJZDogZW50cnlJZCB9KTtcbn1cblxuLyogLS0tLSBhZ3JlZW1lbnQgdGVtcGxhdGVzIChvcmctd2lkZSwgb24gdGhpc09yZy5hZ3JlZW1lbnRUZW1wbGF0ZXMpIC0tLS0gKi9cbmZ1bmN0aW9uIGFwaUxpc3RBZ3JlZW1lbnRUZW1wbGF0ZXMoKTogUHJvbWlzZTxhbnlbXT4ge1xuICByZXR1cm4gbWFlc3Ryb0dldCgnbGlzdEFncmVlbWVudFRlbXBsYXRlcycpO1xufVxuZnVuY3Rpb24gYXBpR2V0QWdyZWVtZW50VGVtcGxhdGUoZW50cnlJZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgcmV0dXJuIG1hZXN0cm9Qb3N0KCdnZXRBZ3JlZW1lbnRUZW1wbGF0ZScsIHsgZW50cnlJZDogZW50cnlJZCB9KTtcbn1cbi8vIGVudHJ5SWQgb21pdHRlZCAtPiBjcmVhdGU7IHByZXNlbnQgLT4gdXBkYXRlLlxuZnVuY3Rpb24gYXBpU2F2ZUFncmVlbWVudFRlbXBsYXRlKGVudHJ5SWQ6IHN0cmluZyB8IG51bGwsIGZpZWxkczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pOiBQcm9taXNlPGFueT4ge1xuICByZXR1cm4gbWFlc3Ryb1Bvc3QoJ3NhdmVBZ3JlZW1lbnRUZW1wbGF0ZScsIGVudHJ5SWQgPyB7IGVudHJ5SWQ6IGVudHJ5SWQsIGZpZWxkczogZmllbGRzIH0gOiB7IGZpZWxkczogZmllbGRzIH0pO1xufVxuZnVuY3Rpb24gYXBpU2V0QWdyZWVtZW50VGVtcGxhdGVTdGF0dXMoZW50cnlJZDogc3RyaW5nLCBzdGF0dXM6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gIHJldHVybiBtYWVzdHJvUG9zdCgnc2V0QWdyZWVtZW50VGVtcGxhdGVTdGF0dXMnLCB7IGVudHJ5SWQ6IGVudHJ5SWQsIHN0YXR1czogc3RhdHVzIH0pO1xufVxuXG4vKiAtLS0tIGFncmVlbWVudCBpbnN0YW5jZXMgKHBlci1jbGllbnQgXCJhZ3JlZW1lbnRzXCIgTUVGKSAtLS0tICovXG5mdW5jdGlvbiBhcGlMaXN0QWdyZWVtZW50cyhjbGllbnRJZDogc3RyaW5nKTogUHJvbWlzZTxhbnlbXT4ge1xuICByZXR1cm4gbWFlc3Ryb1Bvc3QoJ2xpc3RBZ3JlZW1lbnRzJywgeyBpZDogY2xpZW50SWQgfSk7XG59XG5mdW5jdGlvbiBhcGlHZXRBZ3JlZW1lbnQoY2xpZW50SWQ6IHN0cmluZywgZW50cnlJZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgcmV0dXJuIG1hZXN0cm9Qb3N0KCdnZXRBZ3JlZW1lbnQnLCB7IGlkOiBjbGllbnRJZCwgZW50cnlJZDogZW50cnlJZCB9KTtcbn1cbmZ1bmN0aW9uIGFwaUNyZWF0ZUFncmVlbWVudChjbGllbnRJZDogc3RyaW5nLCB0ZW1wbGF0ZVJlZjogc3RyaW5nLCB0aXRsZTogc3RyaW5nLCBzaWduZXJzOiBhbnlbXSk6IFByb21pc2U8YW55PiB7XG4gIHJldHVybiBtYWVzdHJvUG9zdCgnY3JlYXRlQWdyZWVtZW50JywgeyBpZDogY2xpZW50SWQsIHRlbXBsYXRlUmVmOiB0ZW1wbGF0ZVJlZiwgdGl0bGU6IHRpdGxlLCBzaWduZXJzOiBzaWduZXJzIH0pO1xufVxuZnVuY3Rpb24gYXBpU2VuZEFncmVlbWVudChjbGllbnRJZDogc3RyaW5nLCBlbnRyeUlkOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICByZXR1cm4gbWFlc3Ryb1Bvc3QoJ3NlbmRBZ3JlZW1lbnQnLCB7IGlkOiBjbGllbnRJZCwgZW50cnlJZDogZW50cnlJZCB9KTtcbn1cbmZ1bmN0aW9uIGFwaVZvaWRBZ3JlZW1lbnQoY2xpZW50SWQ6IHN0cmluZywgZW50cnlJZDogc3RyaW5nLCByZWFzb246IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gIHJldHVybiBtYWVzdHJvUG9zdCgndm9pZEFncmVlbWVudCcsIHsgaWQ6IGNsaWVudElkLCBlbnRyeUlkOiBlbnRyeUlkLCByZWFzb246IHJlYXNvbiB9KTtcbn1cbmZ1bmN0aW9uIGFwaUNvdW50ZXJzaWduQWdyZWVtZW50KGNsaWVudElkOiBzdHJpbmcsIGVudHJ5SWQ6IHN0cmluZywgc2lnbmF0dXJlRGF0YTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgcmV0dXJuIG1hZXN0cm9Qb3N0KCdjb3VudGVyc2lnbkFncmVlbWVudCcsIHsgaWQ6IGNsaWVudElkLCBlbnRyeUlkOiBlbnRyeUlkLCBzaWduYXR1cmVEYXRhOiBzaWduYXR1cmVEYXRhIH0pO1xufVxuLy8gR2VuZXJhdGUtb3Itc2VydmUgdGhlIHNpZ25lZCBQREYgb24gZGVtYW5kIChQREYgZ2VuZXJhdGlvbiBpcyBvZmYgdGhlIHNpZ25pbmdcbi8vIHBhdGggXHUyMDE0IGl0IGxpdmVzIGhlcmUsIHJldHJ5YWJsZSwgc28gYSBtb21lbnRhcnkgY29udmVydGVyIGhhbmcgbmV2ZXIgYmxvY2tzIHNpZ25pbmcpLlxuZnVuY3Rpb24gYXBpR2V0U2lnbmVkUGRmKGNsaWVudElkOiBzdHJpbmcsIGVudHJ5SWQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gIHJldHVybiBtYWVzdHJvUG9zdCgnZ2V0U2lnbmVkUGRmJywgeyBpZDogY2xpZW50SWQsIGVudHJ5SWQ6IGVudHJ5SWQgfSk7XG59XG5cbi8qIC0tLS0gcHJvZ3JhbSBvdmVybGF5IChEaXJlY3RvcnkgTGF5ZXIgMjogY29uc3VsdGFudC1wcml2YXRlIGRhdGEgb24gYSBwcm9ncmFtKSAtLS0tXG4gICBUaGUgU1BBIG9ubHkgaG9sZHMgdGhlIERJUkVDVE9SWSBwcm9ncmFtIGlkOyB0aGUgbWFlc3RybyByZXNvbHZlcyBpdCB0byBhIGxvY2FsXG4gICBvdmVybGF5IHJlY29yZCAoZmluZC1vci1jcmVhdGUpLiBIaW50cyAoY2FjaGVkIGRpc3BsYXkgKyBzbHVnKSBsZXQgYSBmaXJzdCB3cml0ZVxuICAgc2VlZCB0aGUgbmV3IG92ZXJsYXkgd2l0aG91dCBhIGNyb3NzLW9yZyBmZXRjaC4gQWxsIFBPU1QuICovXG5pbnRlcmZhY2UgUHJvZ3JhbUhpbnRzIHsgZGlyZWN0b3J5U2x1Zz86IHN0cmluZzsgY2FjaGVkTmFtZT86IHN0cmluZzsgY2FjaGVkTG9jYXRpb24/OiBzdHJpbmc7IGNhY2hlZFR5cGU/OiBzdHJpbmc7IH1cbmZ1bmN0aW9uIGFwaUdldFByb2dyYW1PdmVybGF5KGRwaWQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gIHJldHVybiBtYWVzdHJvUG9zdCgnZ2V0UHJvZ3JhbU92ZXJsYXknLCB7IGRpcmVjdG9yeVByb2dyYW1JZDogZHBpZCB9KTtcbn1cbmZ1bmN0aW9uIGFwaVNhdmVQcm9ncmFtT3ZlcmxheShkcGlkOiBzdHJpbmcsIGhpbnRzOiBQcm9ncmFtSGludHMsIGZpZWxkczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pOiBQcm9taXNlPGFueT4ge1xuICByZXR1cm4gbWFlc3Ryb1Bvc3QoJ3NhdmVQcm9ncmFtT3ZlcmxheScsIHsgZGlyZWN0b3J5UHJvZ3JhbUlkOiBkcGlkLCBmaWVsZHM6IGZpZWxkcywgLi4uaGludHMgfSk7XG59XG5mdW5jdGlvbiBhcGlMaXN0UHJvZ3JhbU5vdGVzKGRwaWQ6IHN0cmluZyk6IFByb21pc2U8YW55W10+IHtcbiAgcmV0dXJuIG1hZXN0cm9Qb3N0KCdsaXN0UHJvZ3JhbU5vdGVzJywgeyBkaXJlY3RvcnlQcm9ncmFtSWQ6IGRwaWQgfSk7XG59XG5mdW5jdGlvbiBhcGlBZGRQcm9ncmFtTm90ZShkcGlkOiBzdHJpbmcsIGhpbnRzOiBQcm9ncmFtSGludHMsIGZpZWxkczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pOiBQcm9taXNlPGFueT4ge1xuICByZXR1cm4gbWFlc3Ryb1Bvc3QoJ2FkZFByb2dyYW1Ob3RlJywgeyBkaXJlY3RvcnlQcm9ncmFtSWQ6IGRwaWQsIGZpZWxkczogZmllbGRzLCAuLi5oaW50cyB9KTtcbn1cbmZ1bmN0aW9uIGFwaVVwZGF0ZVByb2dyYW1Ob3RlKGRwaWQ6IHN0cmluZywgZW50cnlJZDogc3RyaW5nLCBmaWVsZHM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogUHJvbWlzZTxhbnk+IHtcbiAgcmV0dXJuIG1hZXN0cm9Qb3N0KCd1cGRhdGVQcm9ncmFtTm90ZScsIHsgZGlyZWN0b3J5UHJvZ3JhbUlkOiBkcGlkLCBlbnRyeUlkOiBlbnRyeUlkLCBmaWVsZHM6IGZpZWxkcyB9KTtcbn1cbmZ1bmN0aW9uIGFwaURlbGV0ZVByb2dyYW1Ob3RlKGRwaWQ6IHN0cmluZywgZW50cnlJZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgcmV0dXJuIG1hZXN0cm9Qb3N0KCdkZWxldGVQcm9ncmFtTm90ZScsIHsgZGlyZWN0b3J5UHJvZ3JhbUlkOiBkcGlkLCBlbnRyeUlkOiBlbnRyeUlkIH0pO1xufVxuLy8gVXBsb2FkL2NsZWFyIHRoZSBwcm9ncmFtIGxvZ28gKGEgRG9jdW1lbnRMaW5rRmllbGQgb24gdGhlIG92ZXJsYXkpLiBFbXB0eVxuLy8gZGF0YUJhc2U2NCBjbGVhcnMgaXQuIExhemlseSBjcmVhdGVzIHRoZSBvdmVybGF5LlxuZnVuY3Rpb24gYXBpU2V0UHJvZ3JhbUxvZ28oZHBpZDogc3RyaW5nLCBoaW50czogUHJvZ3JhbUhpbnRzLCBwYXlsb2FkOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IFByb21pc2U8YW55PiB7XG4gIHJldHVybiBtYWVzdHJvUG9zdCgnc2V0UHJvZ3JhbUxvZ28nLCBPYmplY3QuYXNzaWduKHsgZGlyZWN0b3J5UHJvZ3JhbUlkOiBkcGlkIH0sIGhpbnRzLCBwYXlsb2FkKSk7XG59XG4vKiBwcm9ncmFtIGZpbGVzIFx1MjAxNCByZXNvbHZlIGRpcmVjdG9yeSBpZCAtPiBvdmVybGF5IHJlY29yZCBvbiB0aGUgc2VydmVyLCB0aGVuIHJldXNlXG4gICB0aGUgZ2VuZXJpYyBmaWxlIGhhbmRsZXJzLiBVc2VkIGJ5IHRoZSBGaWxlcyBzZWN0aW9uIChQaGFzZSBDMikuICovXG5mdW5jdGlvbiBhcGlMaXN0UHJvZ3JhbUZpbGVzKGRwaWQ6IHN0cmluZyk6IFByb21pc2U8YW55W10+IHtcbiAgcmV0dXJuIG1hZXN0cm9Qb3N0KCdsaXN0UHJvZ3JhbUZpbGVzJywgeyBkaXJlY3RvcnlQcm9ncmFtSWQ6IGRwaWQgfSk7XG59XG5mdW5jdGlvbiBhcGlBZGRQcm9ncmFtRmlsZShkcGlkOiBzdHJpbmcsIGhpbnRzOiBQcm9ncmFtSGludHMsIHBheWxvYWQ6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogUHJvbWlzZTxhbnk+IHtcbiAgcmV0dXJuIG1hZXN0cm9Qb3N0KCdhZGRQcm9ncmFtRmlsZScsIE9iamVjdC5hc3NpZ24oeyBkaXJlY3RvcnlQcm9ncmFtSWQ6IGRwaWQgfSwgaGludHMsIHBheWxvYWQpKTtcbn1cbmZ1bmN0aW9uIGFwaVVwZGF0ZVByb2dyYW1GaWxlKGRwaWQ6IHN0cmluZywgZW50cnlJZDogc3RyaW5nLCBmaWVsZHM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogUHJvbWlzZTxhbnk+IHtcbiAgcmV0dXJuIG1hZXN0cm9Qb3N0KCd1cGRhdGVQcm9ncmFtRmlsZScsIHsgZGlyZWN0b3J5UHJvZ3JhbUlkOiBkcGlkLCBlbnRyeUlkOiBlbnRyeUlkLCBmaWVsZHM6IGZpZWxkcyB9KTtcbn1cbmZ1bmN0aW9uIGFwaURlbGV0ZVByb2dyYW1GaWxlKGRwaWQ6IHN0cmluZywgZW50cnlJZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgcmV0dXJuIG1hZXN0cm9Qb3N0KCdkZWxldGVQcm9ncmFtRmlsZScsIHsgZGlyZWN0b3J5UHJvZ3JhbUlkOiBkcGlkLCBlbnRyeUlkOiBlbnRyeUlkIH0pO1xufVxuZnVuY3Rpb24gYXBpQ3JlYXRlUHJvZ3JhbUZvbGRlcihkcGlkOiBzdHJpbmcsIGhpbnRzOiBQcm9ncmFtSGludHMsIGZvbGRlcjogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgcmV0dXJuIG1hZXN0cm9Qb3N0KCdjcmVhdGVQcm9ncmFtRm9sZGVyJywgeyBkaXJlY3RvcnlQcm9ncmFtSWQ6IGRwaWQsIGZvbGRlcjogZm9sZGVyLCAuLi5oaW50cyB9KTtcbn1cbmZ1bmN0aW9uIGFwaVJlbmFtZVByb2dyYW1Gb2xkZXIoZHBpZDogc3RyaW5nLCBvbGRQYXRoOiBzdHJpbmcsIG5ld1BhdGg6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gIHJldHVybiBtYWVzdHJvUG9zdCgncmVuYW1lUHJvZ3JhbUZvbGRlcicsIHsgZGlyZWN0b3J5UHJvZ3JhbUlkOiBkcGlkLCBvbGRQYXRoOiBvbGRQYXRoLCBuZXdQYXRoOiBuZXdQYXRoIH0pO1xufVxuZnVuY3Rpb24gYXBpRGVsZXRlUHJvZ3JhbUZvbGRlcihkcGlkOiBzdHJpbmcsIGZvbGRlcjogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgcmV0dXJuIG1hZXN0cm9Qb3N0KCdkZWxldGVQcm9ncmFtRm9sZGVyJywgeyBkaXJlY3RvcnlQcm9ncmFtSWQ6IGRwaWQsIGZvbGRlcjogZm9sZGVyIH0pO1xufVxuXG4vKiAtLS0tIGVtYWlsIGludGVncmF0aW9uIChHbWFpbC9PdXRsb29rIE9BdXRoKSAtLS0tXG4gICBQZXItdXNlciBjb25uZWN0IGFjdGlvbnMgcnVuIGFzIHRoZSBsb2dnZWQtaW4gdXNlcjsgdGhlIG9yZyBjb25maWcgYWN0aW9uc1xuICAgKGdldEVtYWlsQ29uZmlnL3NhdmVFbWFpbENvbmZpZykgYXJlIGFkbWluLWZhY2luZy4gU2VjcmV0cyBhcmUgbmV2ZXIgcmV0dXJuZWRcbiAgIGJ5IGdldEVtYWlsQ29uZmlnICh3cml0ZS1vbmx5KSBcdTIwMTQgaXQgcmVwb3J0cyBvbmx5IHdoZXRoZXIgZWFjaCBpcyBzZXQuICovXG5mdW5jdGlvbiBhcGlFbWFpbFN0YXR1cygpOiBQcm9taXNlPGFueVtdPiB7XG4gIHJldHVybiBtYWVzdHJvR2V0KCdlbWFpbFN0YXR1cycpO1xufVxuZnVuY3Rpb24gYXBpRW1haWxBdXRoVXJsKHByb3ZpZGVyOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICByZXR1cm4gbWFlc3Ryb1Bvc3QoJ2VtYWlsQXV0aFVybCcsIHsgcHJvdmlkZXI6IHByb3ZpZGVyIH0pO1xufVxuZnVuY3Rpb24gYXBpRW1haWxEaXNjb25uZWN0KHByb3ZpZGVyOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICByZXR1cm4gbWFlc3Ryb1Bvc3QoJ2VtYWlsRGlzY29ubmVjdCcsIHsgcHJvdmlkZXI6IHByb3ZpZGVyIH0pO1xufVxuZnVuY3Rpb24gYXBpR2V0RW1haWxDb25maWcoKTogUHJvbWlzZTxhbnk+IHtcbiAgcmV0dXJuIG1hZXN0cm9HZXQoJ2dldEVtYWlsQ29uZmlnJyk7XG59XG5mdW5jdGlvbiBhcGlTYXZlRW1haWxDb25maWcoY2ZnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IFByb21pc2U8YW55PiB7XG4gIHJldHVybiBtYWVzdHJvUG9zdCgnc2F2ZUVtYWlsQ29uZmlnJywgY2ZnKTtcbn1cbi8vIFNlbmQgYW4gZW1haWwgYXMgdGhlIGxvZ2dlZC1pbiB1c2VyIHRocm91Z2ggdGhlaXIgY29ubmVjdGVkIG1haWxib3gsIGFuZCBsb2cgYVxuLy8gQ29tbXVuaWNhdGlvbiAodHlwZSBFbWFpbCkgb24gdGhlIGNsaWVudC4gUmV0dXJucyB7IG1lc3NhZ2VJZCwgY29tbXVuaWNhdGlvbklkPywgY29tbUVycm9yPyB9LlxuZnVuY3Rpb24gYXBpU2VuZEVtYWlsKHBheWxvYWQ6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogUHJvbWlzZTxhbnk+IHtcbiAgcmV0dXJuIG1hZXN0cm9Qb3N0KCdzZW5kRW1haWwnLCBwYXlsb2FkKTtcbn1cblxuLyogLS0tLSBmaWxlcyAmIGZvbGRlcnMgKG11bHRpLWVudHJ5IFwiZmlsZXNcIiBmb3JtIG9uIGEgY2xpZW50KSAtLS0tICovXG5mdW5jdGlvbiBhcGlMaXN0RmlsZXMoY2xpZW50SWQ6IHN0cmluZyk6IFByb21pc2U8YW55W10+IHtcbiAgcmV0dXJuIG1hZXN0cm9Qb3N0KCdsaXN0RmlsZXMnLCB7IGlkOiBjbGllbnRJZCB9KTtcbn1cbmZ1bmN0aW9uIGFwaUFkZEZpbGUoY2xpZW50SWQ6IHN0cmluZywgcGF5bG9hZDogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pOiBQcm9taXNlPGFueT4ge1xuICByZXR1cm4gbWFlc3Ryb1Bvc3QoJ2FkZEZpbGUnLCBPYmplY3QuYXNzaWduKHsgaWQ6IGNsaWVudElkIH0sIHBheWxvYWQpKTtcbn1cbmZ1bmN0aW9uIGFwaVVwZGF0ZUZpbGUoY2xpZW50SWQ6IHN0cmluZywgZW50cnlJZDogc3RyaW5nLCBmaWVsZHM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogUHJvbWlzZTxhbnk+IHtcbiAgcmV0dXJuIG1hZXN0cm9Qb3N0KCd1cGRhdGVGaWxlJywgeyBpZDogY2xpZW50SWQsIGVudHJ5SWQ6IGVudHJ5SWQsIGZpZWxkczogZmllbGRzIH0pO1xufVxuZnVuY3Rpb24gYXBpRGVsZXRlRmlsZShjbGllbnRJZDogc3RyaW5nLCBlbnRyeUlkOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICByZXR1cm4gbWFlc3Ryb1Bvc3QoJ2RlbGV0ZUZpbGUnLCB7IGlkOiBjbGllbnRJZCwgZW50cnlJZDogZW50cnlJZCB9KTtcbn1cbmZ1bmN0aW9uIGFwaUNyZWF0ZUZvbGRlcihjbGllbnRJZDogc3RyaW5nLCBmb2xkZXI6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gIHJldHVybiBtYWVzdHJvUG9zdCgnY3JlYXRlRm9sZGVyJywgeyBpZDogY2xpZW50SWQsIGZvbGRlcjogZm9sZGVyIH0pO1xufVxuZnVuY3Rpb24gYXBpUmVuYW1lRm9sZGVyKGNsaWVudElkOiBzdHJpbmcsIG9sZFBhdGg6IHN0cmluZywgbmV3UGF0aDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgcmV0dXJuIG1hZXN0cm9Qb3N0KCdyZW5hbWVGb2xkZXInLCB7IGlkOiBjbGllbnRJZCwgb2xkUGF0aDogb2xkUGF0aCwgbmV3UGF0aDogbmV3UGF0aCB9KTtcbn1cbmZ1bmN0aW9uIGFwaURlbGV0ZUZvbGRlcihjbGllbnRJZDogc3RyaW5nLCBwYXRoOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICByZXR1cm4gbWFlc3Ryb1Bvc3QoJ2RlbGV0ZUZvbGRlcicsIHsgaWQ6IGNsaWVudElkLCBwYXRoOiBwYXRoIH0pO1xufVxuXG4vKiAtLS0tIHBhcmVudCBhcHBsaWNhdGlvbjogdGVtcGxhdGUgKG9yZykgKyBpbnN0YW5jZXMgKHBlciBjbGllbnQpIC0tLS0gKi9cbi8vIFRoZSBhcHBsaWNhdGlvbiB0ZW1wbGF0ZSAoYnVpbHQgaW4gdGhlIEFwcGxpY2F0aW9uIEJ1aWxkZXIpIGxpdmVzIGFzIGRyYWZ0ICtcbi8vIHB1Ymxpc2hlZCBKU09OIG9uIHRoZSBvcmcncyBgYXBwYCBmb3JtLiBUaGUgYnVpbGRlciByZWFkcyBnZXRBcHBUZW1wbGF0ZSxcbi8vIGF1dG8tc2F2ZXMgZHJhZnRzLCBhbmQgcHVibGlzaGVzIHRoZSBsaXZlIGNvcHkgcGFyZW50cyBmaWxsIG91dC5cbmZ1bmN0aW9uIGFwaUdldEFwcFRlbXBsYXRlKCk6IFByb21pc2U8eyBkcmFmdDogYW55OyBwdWJsaXNoZWQ6IGFueTsgbGFzdFVwZGF0ZWQ6IHN0cmluZzsgbGFzdFB1Ymxpc2hlZDogc3RyaW5nIH0+IHtcbiAgcmV0dXJuIG1hZXN0cm9HZXQoJ2dldEFwcFRlbXBsYXRlJyk7XG59XG5mdW5jdGlvbiBhcGlTYXZlQXBwVGVtcGxhdGUodGVtcGxhdGU6IGFueSk6IFByb21pc2U8YW55PiB7XG4gIHJldHVybiBtYWVzdHJvUG9zdCgnc2F2ZUFwcFRlbXBsYXRlJywgeyB0ZW1wbGF0ZTogdGVtcGxhdGUgfSk7XG59XG5mdW5jdGlvbiBhcGlQdWJsaXNoQXBwVGVtcGxhdGUodGVtcGxhdGU6IGFueSk6IFByb21pc2U8YW55PiB7XG4gIHJldHVybiBtYWVzdHJvUG9zdCgncHVibGlzaEFwcFRlbXBsYXRlJywgeyB0ZW1wbGF0ZTogdGVtcGxhdGUgfSk7XG59XG5cbi8vIEFwcGxpY2F0aW9uIGluc3RhbmNlcyBhcmUgZW50cmllcyBvbiB0aGUgY2xpZW50J3MgYGFwcGxpY2F0aW9uYCBNRUYuIEVhY2hcbi8vIGNhcnJpZXMgYW4gYGVudHJ5SWRgLCBhIGBzdGF0dXNgIChPcGVuL0NvbXBsZXRlL0Nsb3NlZCksIHRoZSB0b2tlbi1nYXRlZFxuLy8gcHVibGljIGB1cmxgLCBhbmQgKHZpYSBnZXRBcHBsaWNhdGlvbikgdGhlIHN1Ym1pdHRlZCBgcmF3ZGF0YWAuXG5mdW5jdGlvbiBhcGlMaXN0QXBwbGljYXRpb25zKGNsaWVudElkOiBzdHJpbmcpOiBQcm9taXNlPGFueVtdPiB7XG4gIHJldHVybiBtYWVzdHJvUG9zdCgnbGlzdEFwcGxpY2F0aW9ucycsIHsgaWQ6IGNsaWVudElkIH0pO1xufVxuZnVuY3Rpb24gYXBpR2V0QXBwbGljYXRpb24oY2xpZW50SWQ6IHN0cmluZywgZW50cnlJZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgcmV0dXJuIG1hZXN0cm9Qb3N0KCdnZXRBcHBsaWNhdGlvbicsIHsgaWQ6IGNsaWVudElkLCBlbnRyeUlkOiBlbnRyeUlkIH0pO1xufVxuZnVuY3Rpb24gYXBpQ3JlYXRlQXBwbGljYXRpb24oY2xpZW50SWQ6IHN0cmluZywgbm90ZXM/OiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICByZXR1cm4gbWFlc3Ryb1Bvc3QoJ2NyZWF0ZUFwcGxpY2F0aW9uJywgeyBpZDogY2xpZW50SWQsIG5vdGVzOiBub3RlcyB8fCAnJyB9KTtcbn1cbmZ1bmN0aW9uIGFwaVNldEFwcGxpY2F0aW9uU3RhdHVzKGNsaWVudElkOiBzdHJpbmcsIGVudHJ5SWQ6IHN0cmluZywgc3RhdHVzOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICByZXR1cm4gbWFlc3Ryb1Bvc3QoJ3NldEFwcGxpY2F0aW9uU3RhdHVzJywgeyBpZDogY2xpZW50SWQsIGVudHJ5SWQ6IGVudHJ5SWQsIHN0YXR1czogc3RhdHVzIH0pO1xufVxuXG4vKiAtLS0tIG9yZyBzZXR0aW5ncyAob25lIEpTT04gbWVtbyBvbiB0aGUgb3JnIHJlY29yZDsgZmVhdHVyZS1uYW1lc3BhY2VkKSAtLS0tICovXG5pbnRlcmZhY2UgT3JnU2V0dGluZ3MgeyBba2V5OiBzdHJpbmddOiBhbnkgfVxubGV0IFNFVFRJTkdTOiBPcmdTZXR0aW5ncyB8IG51bGwgPSBudWxsOyAgICAgLy8gbnVsbCA9IG5vdCBsb2FkZWQgeWV0XG5sZXQgU0VUVElOR1NfTE9BRElORyA9IGZhbHNlO1xuXG5mdW5jdGlvbiBhcGlHZXRTZXR0aW5ncygpOiBQcm9taXNlPE9yZ1NldHRpbmdzPiB7IHJldHVybiBtYWVzdHJvR2V0KCdnZXRTZXR0aW5ncycpOyB9XG5mdW5jdGlvbiBhcGlTYXZlU2V0dGluZ3Moc2V0dGluZ3M6IE9yZ1NldHRpbmdzKTogUHJvbWlzZTxPcmdTZXR0aW5ncz4ge1xuICByZXR1cm4gbWFlc3Ryb1Bvc3QoJ3NhdmVTZXR0aW5ncycsIHsgc2V0dGluZ3M6IHNldHRpbmdzIH0pO1xufVxuXG4vLyBMb2FkIG9yZyBzZXR0aW5ncyBvbmNlLCB0aGVuIHJlLXJlbmRlciBzbyBzZXR0aW5ncy1kcml2ZW4gY29udHJvbHMgZmlsbCBpbi5cbmFzeW5jIGZ1bmN0aW9uIGxvYWRTZXR0aW5ncygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKFNFVFRJTkdTIHx8IFNFVFRJTkdTX0xPQURJTkcpIHJldHVybjtcbiAgU0VUVElOR1NfTE9BRElORyA9IHRydWU7XG4gIHRyeSB7IFNFVFRJTkdTID0gYXdhaXQgYXBpR2V0U2V0dGluZ3MoKTsgfVxuICBjYXRjaCAoX2UpIHsgU0VUVElOR1MgPSB7fTsgfSAvLyBmYWlsIHNvZnQgXHUyMDE0IGNvbnRyb2xzIGZhbGwgYmFjayB0byBidWlsdC1pbiBkZWZhdWx0c1xuICBmaW5hbGx5IHtcbiAgICBTRVRUSU5HU19MT0FESU5HID0gZmFsc2U7XG4gICAgLy8gT3JnIHNldHRpbmdzIGFyZSBhdXRob3JpdGF0aXZlIGZvciB0aGUgY29sb3Igc2NoZW1lIFx1MjAxNCBhcHBseSB0aGUgc2F2ZWRcbiAgICAvLyBvcmcgcGFsZXR0ZSBub3cgdGhhdCBpdCdzIGxvYWRlZCAocmVmcmVzaGVzIHRoZSBsb2NhbFN0b3JhZ2UgYm9vdCBjYWNoZSkuXG4gICAgaWYgKHR5cGVvZiByZWNvbmNpbGVPcmdUaGVtZSA9PT0gJ2Z1bmN0aW9uJykgcmVjb25jaWxlT3JnVGhlbWUoU0VUVElOR1MpO1xuICAgIGlmICh0eXBlb2YgcmVuZGVyID09PSAnZnVuY3Rpb24nKSByZW5kZXIoKTtcbiAgfVxufVxuXG4vLyBcIk90aGVyXCIgaXMgYSBoYXJkLWNvZGVkLCBhbHdheXMtbGFzdCBlc2NhcGUgaGF0Y2ggaW4gdGhlIHJlbGF0aW9uc2hpcCBkcm9wZG93blxuLy8gKE5PVCBwYXJ0IG9mIHRoZSB1c2VyLWRlZmluZWQgbGlzdCkgXHUyMDE0IHBpY2tpbmcgaXQgcmV2ZWFscyBhIGZyZWUtdGV4dCBib3guXG5jb25zdCBPVEhFUl9SRUxBVElPTlNISVAgPSAnT3RoZXInO1xuXG4vLyBCdWlsdC1pbiByZWxhdGlvbnNoaXAgY2hvaWNlcyB1c2VkIHVudGlsL3VubGVzcyB0aGUgb3JnIGRlZmluZXMgaXRzIG93biBsaXN0XG4vLyBpbiBTZXR0aW5ncyAoc2V0dGluZ3MuY29udGFjdHMucmVsYXRpb25zaGlwcykuIFwiT3RoZXJcIiBpcyBpbnRlbnRpb25hbGx5IE5PVFxuLy8gaGVyZSBcdTIwMTQgaXQncyBhcHBlbmRlZCBieSB0aGUgY29udHJvbC5cbmNvbnN0IERFRkFVTFRfUkVMQVRJT05TSElQUyA9IFtcbiAgJ01vdGhlcicsICdGYXRoZXInLCAnU3RlcG1vdGhlcicsICdTdGVwZmF0aGVyJywgJ0xlZ2FsIEd1YXJkaWFuJywgJ0dyYW5kcGFyZW50JywgJ1NpYmxpbmcnLCAnT3RoZXIgRmFtaWx5JyxcbiAgJ1RoZXJhcGlzdCcsICdQc3ljaGlhdHJpc3QnLCAnUHN5Y2hvbG9naXN0JywgJ1JlZmVycmluZyBQcm9mZXNzaW9uYWwnLCAnRWR1Y2F0aW9uYWwgQ29uc3VsdGFudCcsXG4gICdDYXNlIE1hbmFnZXInLCAnU2Nob29sIENvdW5zZWxvcicsICdBdHRvcm5leScsICdQaHlzaWNpYW4nLCAnT3RoZXIgUHJvZmVzc2lvbmFsJyxcbl07XG5cbi8vIFRoZSB1c2VyLWRlZmluZWQgcmVsYXRpb25zaGlwIGxpc3QgKHNldHRpbmdzIG9yIGZhbGxiYWNrKSwgd2l0aCBhbnkgc3RyYXlcbi8vIFwiT3RoZXJcIiBmaWx0ZXJlZCBvdXQgc28gdGhlIGhhcmQtY29kZWQgb25lIGlzIG5ldmVyIGR1cGxpY2F0ZWQuXG5mdW5jdGlvbiByZWxhdGlvbnNoaXBPcHRpb25zKCk6IHN0cmluZ1tdIHtcbiAgY29uc3QgczogYW55ID0gU0VUVElOR1M7XG4gIGNvbnN0IGZyb21TZXR0aW5nczogc3RyaW5nW10gPSBzICYmIHMuY29udGFjdHMgJiYgQXJyYXkuaXNBcnJheShzLmNvbnRhY3RzLnJlbGF0aW9uc2hpcHMpXG4gICAgPyBzLmNvbnRhY3RzLnJlbGF0aW9uc2hpcHMuZmlsdGVyKCh4OiBhbnkpID0+IHR5cGVvZiB4ID09PSAnc3RyaW5nJyAmJiB4LnRyaW0oKSlcbiAgICA6IFtdO1xuICBjb25zdCBsaXN0ID0gZnJvbVNldHRpbmdzLmxlbmd0aCA/IGZyb21TZXR0aW5ncyA6IERFRkFVTFRfUkVMQVRJT05TSElQUztcbiAgcmV0dXJuIGxpc3QuZmlsdGVyKG8gPT4gby50cmltKCkudG9Mb3dlckNhc2UoKSAhPT0gT1RIRVJfUkVMQVRJT05TSElQLnRvTG93ZXJDYXNlKCkpO1xufVxuXG4vLyBCdWlsdC1pbiByZWZlcnJhbCBkZWNsaW5lIHJlYXNvbnMgdXNlZCB1bnRpbC91bmxlc3MgdGhlIG9yZyBkZWZpbmVzIGl0cyBvd25cbi8vIGxpc3QgaW4gU2V0dGluZ3MgKHNldHRpbmdzLnJlZmVycmFscy5kZWNsaW5lUmVhc29ucykuIFRoZSByZWZlcnJhbCBmaWVsZCBpc1xuLy8gZnJlZS10ZXh0IChsaWtlIHJlbGF0aW9uc2hpcCksIHNvIGFueSBzZXR0aW5ncyB2YWx1ZSBzdG9yZXMgdmVyYmF0aW0uXG5jb25zdCBERUZBVUxUX0RFQ0xJTkVfUkVBU09OUyA9IFtcbiAgJ0NsaW5pY2FsIGZpdCcsICdBY3VpdHkgdG9vIGhpZ2gnLCAnTm8gYmVkIGF2YWlsYWJpbGl0eScsICdJbnN1cmFuY2Ugbm90IGFjY2VwdGVkJyxcbiAgJ0FnZSBvciBnZW5kZXIgbm90IHNlcnZlZCcsICdDb3N0JywgJ0ZhbWlseSBkZWNsaW5lZCcsICdPdGhlcicsXG5dO1xuXG4vLyBUaGUgdXNlci1kZWZpbmVkIGRlY2xpbmUtcmVhc29uIGxpc3QgKHNldHRpbmdzIG9yIGZhbGxiYWNrKS5cbmZ1bmN0aW9uIGRlY2xpbmVSZWFzb25PcHRpb25zKCk6IHN0cmluZ1tdIHtcbiAgY29uc3QgczogYW55ID0gU0VUVElOR1M7XG4gIGNvbnN0IGZyb21TZXR0aW5nczogc3RyaW5nW10gPSBzICYmIHMucmVmZXJyYWxzICYmIEFycmF5LmlzQXJyYXkocy5yZWZlcnJhbHMuZGVjbGluZVJlYXNvbnMpXG4gICAgPyBzLnJlZmVycmFscy5kZWNsaW5lUmVhc29ucy5maWx0ZXIoKHg6IGFueSkgPT4gdHlwZW9mIHggPT09ICdzdHJpbmcnICYmIHgudHJpbSgpKVxuICAgIDogW107XG4gIHJldHVybiBmcm9tU2V0dGluZ3MubGVuZ3RoID8gZnJvbVNldHRpbmdzIDogREVGQVVMVF9ERUNMSU5FX1JFQVNPTlM7XG59XG5cbi8vIE9yZy13aWRlIGRlZmF1bHQgZm9sZGVycyAoc2V0dGluZ3MuZmlsZXMuZGVmYXVsdEZvbGRlcnMpIFx1MjAxNCBmb2xkZXJzIHRoYXRcbi8vIGF1dG8tYXBwZWFyIGZvciBldmVyeSBjbGllbnQuIEVtcHR5IGFycmF5IGlmIG5vbmUgY29uZmlndXJlZC5cbmZ1bmN0aW9uIGRlZmF1bHRGb2xkZXJzKCk6IHN0cmluZ1tdIHtcbiAgY29uc3QgczogYW55ID0gU0VUVElOR1M7XG4gIHJldHVybiBzICYmIHMuZmlsZXMgJiYgQXJyYXkuaXNBcnJheShzLmZpbGVzLmRlZmF1bHRGb2xkZXJzKVxuICAgID8gcy5maWxlcy5kZWZhdWx0Rm9sZGVycy5maWx0ZXIoKHg6IGFueSkgPT4gdHlwZW9mIHggPT09ICdzdHJpbmcnICYmIHgudHJpbSgpKVxuICAgIDogW107XG59XG4vLyBTdGFydGVyIGZvbGRlcnMgc2hvd24gaW4gdGhlIFNldHRpbmdzIGVkaXRvciB1bnRpbCB0aGUgb3JnIHNhdmVzIGl0cyBvd24uXG5jb25zdCBERUZBVUxUX0ZPTERFUlNfU0VFRCA9IFsnSW50YWtlJywgJ0Fzc2Vzc21lbnRzJywgJ01lZGljYWwnLCAnQWNhZGVtaWMnLCAnTGVnYWwnLCAnRmluYW5jaWFsJywgJ0NvcnJlc3BvbmRlbmNlJ107XG5cbi8vIE9yZy13aWRlIGRlZmF1bHQgZm9sZGVycyBmb3IgUFJPR1JBTSBmaWxlcyAoc2V0dGluZ3MuZmlsZXMucHJvZ3JhbURlZmF1bHRGb2xkZXJzKVxuLy8gXHUyMDE0IGEgc2VwYXJhdGUgc2V0IGZyb20gY2xpZW50IGZvbGRlcnMsIGF1dG8tYXBwZWFyaW5nIG9uIGV2ZXJ5IHByb2dyYW0ncyBGaWxlc1xuLy8gdGFiLiBFbXB0eSBhcnJheSBpZiBub25lIGNvbmZpZ3VyZWQuXG5mdW5jdGlvbiBwcm9ncmFtRGVmYXVsdEZvbGRlcnMoKTogc3RyaW5nW10ge1xuICBjb25zdCBzOiBhbnkgPSBTRVRUSU5HUztcbiAgcmV0dXJuIHMgJiYgcy5maWxlcyAmJiBBcnJheS5pc0FycmF5KHMuZmlsZXMucHJvZ3JhbURlZmF1bHRGb2xkZXJzKVxuICAgID8gcy5maWxlcy5wcm9ncmFtRGVmYXVsdEZvbGRlcnMuZmlsdGVyKCh4OiBhbnkpID0+IHR5cGVvZiB4ID09PSAnc3RyaW5nJyAmJiB4LnRyaW0oKSlcbiAgICA6IFtdO1xufVxuLy8gUHJvZ3JhbS1vcmllbnRlZCBzdGFydGVyIGZvbGRlcnMgKHRvdXJzLCBjb250cmFjdHMsIG1hcmtldGluZyBjb2xsYXRlcmFsLCBcdTIwMjYpLlxuY29uc3QgUFJPR1JBTV9ERUZBVUxUX0ZPTERFUlNfU0VFRCA9IFsnVG91ciBOb3RlcycsICdCcm9jaHVyZXMnLCAnQ29udHJhY3RzJywgJ0FjY3JlZGl0YXRpb24nLCAnQ29ycmVzcG9uZGVuY2UnXTtcblxuLy8gRmV0Y2ggdGhlIHNlbGVjdC1maWVsZCBvcHRpb24gbGlzdHMgc28gdGhlIGVkaXQgZm9ybXMgY2FuIHJlbmRlciBkcm9wZG93bnMuXG5mdW5jdGlvbiBhcGlDbGllbnRNZXRhKCk6IFByb21pc2U8eyBvcHRpb25zOiB7IFtrZXk6IHN0cmluZ106IHN0cmluZ1tdIH0gfT4ge1xuICByZXR1cm4gbWFlc3Ryb0dldCgnY2xpZW50TWV0YScpO1xufVxuXG4vLyBXaG8ncyBsb2dnZWQgaW4gKCsgc3VwZXIgZmxhZyArIG9yZyBuYW1lKSBcdTIwMTQgZHJpdmVzIHRoZSB0b29sYmFyIGNocm9tZS5cbmZ1bmN0aW9uIGFwaVNlc3Npb24oKTogUHJvbWlzZTxTZXNzaW9uPiB7XG4gIHJldHVybiBtYWVzdHJvR2V0KCdzZXNzaW9uJyk7XG59XG5cbi8qIC0tLS0gbGl2ZSBjbGllbnQgc3RvcmUgKHNpbmdsZSBzb3VyY2UgZm9yIHRoZSBsaXN0ICsgcmVjb3JkIHZpZXcpIC0tLS0gKi9cbmxldCBDTElFTlRfU1RPUkU6IENsaWVudFtdIHwgbnVsbCA9IG51bGw7ICAgLy8gbnVsbCA9IG5vdCBsb2FkZWQgeWV0XG5sZXQgQ0xJRU5UU19MT0FESU5HID0gZmFsc2U7XG5sZXQgQ0xJRU5UU19FUlJPUjogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cbi8vIFRoZSBDbGllbnRzIHBhZ2UgaXMgdGFiYmVkIGFjcm9zcyB0aGUgdGhyZWUgSW5kaXZpZHVhbCBjYXRlZ29yaWVzLiBJbnF1aXJpZXNcbi8vIGFuZCBBbHVtbmkgZ2V0IHRoZWlyIG93biBsaXZlIHN0b3JlcywgbG9hZGVkIHRoZSBzYW1lIHdheSBhcyBDbGllbnRzLlxubGV0IElOUVVJUllfU1RPUkU6IENsaWVudFtdIHwgbnVsbCA9IG51bGw7XG5sZXQgSU5RVUlSSUVTX0xPQURJTkcgPSBmYWxzZTtcbmxldCBJTlFVSVJJRVNfRVJST1I6IHN0cmluZyB8IG51bGwgPSBudWxsO1xubGV0IEFMVU1OSV9TVE9SRTogQ2xpZW50W10gfCBudWxsID0gbnVsbDtcbmxldCBBTFVNTklfTE9BRElORyA9IGZhbHNlO1xubGV0IEFMVU1OSV9FUlJPUjogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cbi8vIE1hcCBhIHJhdyBtYWVzdHJvIHJlY29yZCAobmFtZSArIGNvbkluZm8gKyBkZW1vZ3JhcGhpY3MgZmllbGRzKSBpbnRvIHRoZVxuLy8gQ2xpZW50IHNoYXBlIHRoZSBVSSByZW5kZXJzLiBEaXNwbGF5LW9yaWVudGVkIGZpZWxkcyBhcmUgcHVsbGVkIG91dCBmb3IgdGhlXG4vLyBsaXN0L3N1bW1hcnkvaGVhZGVyOyB0aGUgZnVsbCByZWNvcmQgaXMga2VwdCBvbiBgcmF3YCBmb3IgdGhlIGVkaXQgZm9ybXMuXG5mdW5jdGlvbiByZWFsVG9DbGllbnQocjogYW55KTogQ2xpZW50IHtcbiAgY29uc3QgcmFjZTogc3RyaW5nW10gPSBBcnJheS5pc0FycmF5KHIucmFjZSkgPyByLnJhY2UgOiAoci5yYWNlID8gW1N0cmluZyhyLnJhY2UpXSA6IFtdKTtcbiAgcmV0dXJuIHtcbiAgICBpZDogU3RyaW5nKHIuaWQgfHwgci5zaG9ydElkIHx8ICcnKSxcbiAgICBmaXJzdDogci5maXJzdE5hbWUgfHwgJycsIGxhc3Q6IHIubGFzdE5hbWUgfHwgJycsXG4gICAgZG9iOiByLmRvYiB8fCAnJywgZ2VuZGVyOiByLmdlbmRlciB8fCAnJywgc3RhdHVzOiAnJywgZ3JhZGU6ICcnLFxuICAgIHNvdXJjZTogJycsIHNvdXJjZU5hbWU6ICcnLFxuICAgIHN1bW1hcnk6ICcnLCBjb25jZXJuczogW10sXG4gICAgZGVtbzogeyBwcm9ub3Vuczogci5wcm9ub3VucyB8fCAnJywgcmFjZTogcmFjZVswXSB8fCAnJywgZXRobmljaXR5OiByLmV0aG5pY2l0eSB8fCAnJywgY2l0eTogci5ob21lQ2l0eSB8fCAnJywgc3RhdGU6IHIuaG9tZVN0YXRlIHx8ICcnIH0sXG4gICAgY29udGFjdHM6IFtdLCBkb2N1bWVudHM6IFtdLCBjb21tdW5pY2F0aW9uczogW10sIHBsYWNlbWVudHM6IFtdLCB0YXNrczogW10sXG4gICAgcHJlZk5hbWU6IHIucHJlZk5hbWUgfHwgJycsIGVtYWlsOiByLmVtYWlsIHx8ICcnLCBjZWxsOiByLmNlbGwgfHwgJycsXG4gICAgaG9tZVBob25lOiByLmhvbWVQaG9uZSB8fCAnJywgaG9tZVppcDogci5ob21lWmlwIHx8ICcnLCB2aWV3VXJsOiByLnZpZXdVcmwgfHwgJycsXG4gICAgcGhvdG9Vcmw6IHIucGhvdG8gfHwgJycsXG4gICAgLy8gTGlmZWN5Y2xlIHN0YWdlIGZyb20gdGhlIG1hZXN0cm8gKGNhdGVnb3JpZXMgXHUyMTkyICdpbnF1aXJ5J3wnY2xpZW50J3wnYWx1bW5pJykuXG4gICAgLy8gRmFsbHMgYmFjayB0byAnY2xpZW50JyBmb3IgbGVnYWN5IHJvd3M7IHRoZSBwZXItc3RvcmUgbG9hZGVycyBhbHNvIHNldCBpdC5cbiAgICBlbnRpdHk6IHIuc3RhZ2UgfHwgJ2NsaWVudCcsXG4gICAgcmF3OiByLFxuICB9O1xufVxuXG4vKiAtLS0tIHNlbGVjdC1maWVsZCBvcHRpb24gbWV0YWRhdGEgKGZvciBlZGl0LWZvcm0gZHJvcGRvd25zKSAtLS0tICovXG5sZXQgQ0xJRU5UX01FVEE6IHsgb3B0aW9uczogeyBba2V5OiBzdHJpbmddOiBzdHJpbmdbXSB9IH0gfCBudWxsID0gbnVsbDtcbmxldCBNRVRBX0xPQURJTkcgPSBmYWxzZTtcblxuLy8gT3B0aW9uIG5hbWVzIGZvciBhIHNlbGVjdCBmaWVsZCBrZXksIG9yIFtdIHVudGlsIHRoZSBtZXRhIGhhcyBsb2FkZWQuXG5mdW5jdGlvbiBtZXRhT3B0aW9ucyhrZXk6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgaWYgKENMSUVOVF9NRVRBICYmIENMSUVOVF9NRVRBLm9wdGlvbnMgJiYgQ0xJRU5UX01FVEEub3B0aW9uc1trZXldKSByZXR1cm4gQ0xJRU5UX01FVEEub3B0aW9uc1trZXldO1xuICByZXR1cm4gW107XG59XG5cbi8vIExvYWQgdGhlIHNlbGVjdC1maWVsZCBvcHRpb24gbGlzdHMgb25jZSwgdGhlbiByZS1yZW5kZXIgc28gZHJvcGRvd25zIGZpbGwgaW4uXG5hc3luYyBmdW5jdGlvbiBsb2FkQ2xpZW50TWV0YSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKE1FVEFfTE9BRElORyB8fCBDTElFTlRfTUVUQSkgcmV0dXJuO1xuICBNRVRBX0xPQURJTkcgPSB0cnVlO1xuICB0cnkge1xuICAgIENMSUVOVF9NRVRBID0gYXdhaXQgYXBpQ2xpZW50TWV0YSgpO1xuICB9IGNhdGNoIChfZSkge1xuICAgIENMSUVOVF9NRVRBID0geyBvcHRpb25zOiB7fSB9OyAvLyBmYWlsIHNvZnQgXHUyMDE0IHNlbGVjdHMgZmFsbCBiYWNrIHRvIGN1cnJlbnQgdmFsdWUgb25seVxuICB9IGZpbmFsbHkge1xuICAgIE1FVEFfTE9BRElORyA9IGZhbHNlO1xuICAgIGlmICh0eXBlb2YgcmVuZGVyID09PSAnZnVuY3Rpb24nKSByZW5kZXIoKTtcbiAgfVxufVxuXG4vKiAtLS0tIGxvZ2dlZC1pbiBzZXNzaW9uICh0b29sYmFyOiByZWFsIG5hbWUsIHN1cGVyLW9ubHkgVG9vbHMsIG9yZyBsYWJlbCkgLS0tLSAqL1xuaW50ZXJmYWNlIFNlc3Npb24geyBsb2dnZWRJbjogYm9vbGVhbjsgZmlyc3ROYW1lOiBzdHJpbmc7IGxhc3ROYW1lOiBzdHJpbmc7IGZ1bGxOYW1lOiBzdHJpbmc7IGlzU3VwZXI6IGJvb2xlYW47IG9yZ05hbWU6IHN0cmluZzsgbG9nb1VybDogc3RyaW5nOyB9XG5sZXQgU0VTU0lPTjogU2Vzc2lvbiB8IG51bGwgPSBudWxsO1xuXG4vLyBMb2FkIHRoZSBzZXNzaW9uIG9uY2UsIHRoZW4gcmUtcmVuZGVyIHNvIHRoZSB0b29sYmFyIHNob3dzIHRoZSByZWFsIHVzZXIuXG5hc3luYyBmdW5jdGlvbiBsb2FkU2Vzc2lvbigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKFNFU1NJT04pIHJldHVybjtcbiAgdHJ5IHtcbiAgICBTRVNTSU9OID0gYXdhaXQgYXBpU2Vzc2lvbigpO1xuICB9IGNhdGNoIChfZSkge1xuICAgIFNFU1NJT04gPSB7IGxvZ2dlZEluOiBmYWxzZSwgZmlyc3ROYW1lOiAnJywgbGFzdE5hbWU6ICcnLCBmdWxsTmFtZTogJycsIGlzU3VwZXI6IGZhbHNlLCBvcmdOYW1lOiAnJywgbG9nb1VybDogJycgfTtcbiAgfVxuICBpZiAodHlwZW9mIHJlbmRlciA9PT0gJ2Z1bmN0aW9uJykgcmVuZGVyKCk7XG59XG5cbi8vIExvYWQgKG9yIHJlbG9hZCkgdGhlIGxpdmUgY2xpZW50IGxpc3QsIHRoZW4gcmUtcmVuZGVyLiBTYWZlIHRvIGNhbGwgZnJvbSBhXG4vLyB2aWV3IGR1cmluZyByZW5kZXIgXHUyMDE0IGl0IG5vLW9wcyBpZiBhbHJlYWR5IGxvYWRlZCAodW5sZXNzIGZvcmNlKSBvciBpbiBmbGlnaHQuXG5hc3luYyBmdW5jdGlvbiBsb2FkQ2xpZW50cyhmb3JjZSA9IGZhbHNlKTogUHJvbWlzZTx2b2lkPiB7XG4gIGlmIChDTElFTlRTX0xPQURJTkcpIHJldHVybjtcbiAgaWYgKENMSUVOVF9TVE9SRSAmJiAhZm9yY2UpIHJldHVybjtcbiAgQ0xJRU5UU19MT0FESU5HID0gdHJ1ZTsgQ0xJRU5UU19FUlJPUiA9IG51bGw7XG4gIHRyeSB7XG4gICAgY29uc3QgcmF3ID0gYXdhaXQgYXBpTGlzdENsaWVudHMoKTtcbiAgICBDTElFTlRfU1RPUkUgPSByYXcubWFwKHJlYWxUb0NsaWVudCk7XG4gIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgIENMSUVOVFNfRVJST1IgPSBlICYmIGUubWVzc2FnZSA/IGUubWVzc2FnZSA6IFN0cmluZyhlKTtcbiAgICBDTElFTlRfU1RPUkUgPSBudWxsO1xuICB9IGZpbmFsbHkge1xuICAgIENMSUVOVFNfTE9BRElORyA9IGZhbHNlO1xuICAgIGlmICh0eXBlb2YgcmVuZGVyID09PSAnZnVuY3Rpb24nKSByZW5kZXIoKTtcbiAgfVxufVxuXG4vLyBMb2FkIChvciByZWxvYWQpIHRoZSBsaXZlIElucXVpcnkgbGlzdCwgdGhlbiByZS1yZW5kZXIuIE1pcnJvcnMgbG9hZENsaWVudHMuXG5hc3luYyBmdW5jdGlvbiBsb2FkSW5xdWlyaWVzKGZvcmNlID0gZmFsc2UpOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKElOUVVJUklFU19MT0FESU5HKSByZXR1cm47XG4gIGlmIChJTlFVSVJZX1NUT1JFICYmICFmb3JjZSkgcmV0dXJuO1xuICBJTlFVSVJJRVNfTE9BRElORyA9IHRydWU7IElOUVVJUklFU19FUlJPUiA9IG51bGw7XG4gIHRyeSB7XG4gICAgY29uc3QgcmF3ID0gYXdhaXQgYXBpTGlzdElucXVpcmllcygpO1xuICAgIElOUVVJUllfU1RPUkUgPSByYXcubWFwKHJlYWxUb0NsaWVudCkubWFwKGMgPT4geyBjLmVudGl0eSA9ICdpbnF1aXJ5JzsgcmV0dXJuIGM7IH0pO1xuICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICBJTlFVSVJJRVNfRVJST1IgPSBlICYmIGUubWVzc2FnZSA/IGUubWVzc2FnZSA6IFN0cmluZyhlKTtcbiAgICBJTlFVSVJZX1NUT1JFID0gbnVsbDtcbiAgfSBmaW5hbGx5IHtcbiAgICBJTlFVSVJJRVNfTE9BRElORyA9IGZhbHNlO1xuICAgIGlmICh0eXBlb2YgcmVuZGVyID09PSAnZnVuY3Rpb24nKSByZW5kZXIoKTtcbiAgfVxufVxuXG4vLyBMb2FkIChvciByZWxvYWQpIHRoZSBsaXZlIEFsdW1uaSBsaXN0LCB0aGVuIHJlLXJlbmRlci4gTWlycm9ycyBsb2FkQ2xpZW50cy5cbmFzeW5jIGZ1bmN0aW9uIGxvYWRBbHVtbmkoZm9yY2UgPSBmYWxzZSk6IFByb21pc2U8dm9pZD4ge1xuICBpZiAoQUxVTU5JX0xPQURJTkcpIHJldHVybjtcbiAgaWYgKEFMVU1OSV9TVE9SRSAmJiAhZm9yY2UpIHJldHVybjtcbiAgQUxVTU5JX0xPQURJTkcgPSB0cnVlOyBBTFVNTklfRVJST1IgPSBudWxsO1xuICB0cnkge1xuICAgIGNvbnN0IHJhdyA9IGF3YWl0IGFwaUxpc3RBbHVtbmkoKTtcbiAgICBBTFVNTklfU1RPUkUgPSByYXcubWFwKHJlYWxUb0NsaWVudCkubWFwKGMgPT4geyBjLmVudGl0eSA9ICdhbHVtbmknOyByZXR1cm4gYzsgfSk7XG4gIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgIEFMVU1OSV9FUlJPUiA9IGUgJiYgZS5tZXNzYWdlID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpO1xuICAgIEFMVU1OSV9TVE9SRSA9IG51bGw7XG4gIH0gZmluYWxseSB7XG4gICAgQUxVTU5JX0xPQURJTkcgPSBmYWxzZTtcbiAgICBpZiAodHlwZW9mIHJlbmRlciA9PT0gJ2Z1bmN0aW9uJykgcmVuZGVyKCk7XG4gIH1cbn1cblxuLyogLS0tLSBsaXZlIGRhc2hib2FyZCBzdG9yZSAoc2VydmVyLWFnZ3JlZ2F0ZWQgY2FzZWxvYWQgb3ZlcnZpZXcpIC0tLS0gKi9cbi8vIE9uZSBHRVQgdG8gdGhlIG1hZXN0cm8ncyBgZGFzaGJvYXJkYCBhY3Rpb24gcmV0dXJucyB0aGUgd2hvbGUgcm9sbHVwOiBzdGFnZVxuLy8gY291bnRzLCByZWZlcnJhbCBmdW5uZWwgKyBvdXRjb21lcywgdGFzayBidWNrZXRzICsgc29vbmVzdCBvcGVuIHRhc2tzLCBhbmRcbi8vIHJlY2VudCBjb21tdW5pY2F0aW9ucy4gQ2FjaGVkIGxpa2UgdGhlIGxpc3Qgc3RvcmVzOyBSZWZyZXNoIGZvcmNlcyBhIHJlbG9hZC5cbmxldCBEQVNIQk9BUkQ6IGFueSA9IG51bGw7ICAgLy8gbnVsbCA9IG5vdCBsb2FkZWQgeWV0XG5sZXQgREFTSEJPQVJEX0xPQURJTkcgPSBmYWxzZTtcbmxldCBEQVNIQk9BUkRfRVJST1I6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXG5mdW5jdGlvbiBhcGlEYXNoYm9hcmQoKTogUHJvbWlzZTxhbnk+IHtcbiAgcmV0dXJuIG1hZXN0cm9HZXQoJ2Rhc2hib2FyZCcpO1xufVxuXG4vLyBMb2FkIChvciByZWxvYWQpIHRoZSBkYXNoYm9hcmQgcm9sbHVwLCB0aGVuIHJlLXJlbmRlci4gTWlycm9ycyBsb2FkQ2xpZW50cy5cbmFzeW5jIGZ1bmN0aW9uIGxvYWREYXNoYm9hcmQoZm9yY2UgPSBmYWxzZSk6IFByb21pc2U8dm9pZD4ge1xuICBpZiAoREFTSEJPQVJEX0xPQURJTkcpIHJldHVybjtcbiAgaWYgKERBU0hCT0FSRCAmJiAhZm9yY2UpIHJldHVybjtcbiAgREFTSEJPQVJEX0xPQURJTkcgPSB0cnVlOyBEQVNIQk9BUkRfRVJST1IgPSBudWxsO1xuICB0cnkge1xuICAgIERBU0hCT0FSRCA9IGF3YWl0IGFwaURhc2hib2FyZCgpO1xuICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICBEQVNIQk9BUkRfRVJST1IgPSBlICYmIGUubWVzc2FnZSA/IGUubWVzc2FnZSA6IFN0cmluZyhlKTtcbiAgICBEQVNIQk9BUkQgPSBudWxsO1xuICB9IGZpbmFsbHkge1xuICAgIERBU0hCT0FSRF9MT0FESU5HID0gZmFsc2U7XG4gICAgaWYgKHR5cGVvZiByZW5kZXIgPT09ICdmdW5jdGlvbicpIHJlbmRlcigpO1xuICB9XG59XG5cbi8vIEtpY2sgb2ZmIGEgZGFzaGJvYXJkIGxvYWQgaWYgaXQgaGFzbid0IGJlZW4gZmV0Y2hlZCB5ZXQgKGNhbGxlZCBmcm9tIHJlbmRlcikuXG5mdW5jdGlvbiBlbnN1cmVEYXNoYm9hcmQoKTogdm9pZCB7XG4gIGlmIChEQVNIQk9BUkQgPT09IG51bGwgJiYgIURBU0hCT0FSRF9MT0FESU5HICYmICFEQVNIQk9BUkRfRVJST1IpIGxvYWREYXNoYm9hcmQoKTtcbn1cblxuLy8gLS0tLSBQcm9ncmFtIERpcmVjdG9yeSAobGl2ZSwgY3Jvc3Mtb3JnIHZpYSB0aGUgbWFlc3RybyBwcm94eSBcdTIxOTIgL2IvZGlyZWN0b3J5KSAtLS0tXG4vLyBUaGUgZGlyZWN0b3J5IGlzIGEgU0VQQVJBVEUgQmx1ZVN0ZXAgb3JnOyB0aGUgbWFlc3RybyBwcm94aWVzIHJlYWRzIHRvIGl0LlxuLy8gbGlzdFByb2dyYW1zIHJldHVybnMgbGVhbiBzdW1tYXJpZXMgKGNhcmRzICsgZmlsdGVycyk7IGdldFByb2dyYW0gcmV0dXJucyB0aGVcbi8vIGZ1bGwgcHJvZmlsZSAobmFycmF0aXZlIG1lbW9zICsgcGFyc2VkIGNvbnRhY3RzKSBmb3IgdGhlIGRldGFpbCB2aWV3LlxuaW50ZXJmYWNlIERpclByb2dyYW0ge1xuICBpZDogc3RyaW5nOyBzaG9ydElkPzogc3RyaW5nOyB2aWV3VXJsPzogc3RyaW5nO1xuICBwcm9ncmFtTmFtZTogc3RyaW5nOyB3ZWJzaXRlPzogc3RyaW5nOyBha3RQcm9maWxlPzogc3RyaW5nOyBsb2NhdGlvbj86IHN0cmluZztcbiAgc3RhdGVzPzogc3RyaW5nW107IHByb2dyYW1UeXBlPzogc3RyaW5nW107IGFnZUJhbmQ/OiBzdHJpbmdbXTsgZ2VuZGVyU2VydmVkPzogc3RyaW5nW107XG4gIGFnZXNSYXc/OiBzdHJpbmc7IHBvcHVsYXRpb25zUmF3Pzogc3RyaW5nOyBhY2NyZWRpdGF0aW9uUmF3Pzogc3RyaW5nOyBpbnN1cmFuY2VSYXc/OiBzdHJpbmc7XG4gIGFkbWlzc2lvbnNDb250YWN0Pzogc3RyaW5nOyBibHVlc3RlcE9yZ1JlZj86IGJvb2xlYW47IGNyYXdsU3RhdHVzPzogc3RyaW5nO1xuICBvdmVydmlldz86IHN0cmluZzsgY2xpbmljYWxNb2RlbD86IHN0cmluZzsgbGV2ZWxzT2ZDYXJlPzogc3RyaW5nOyBhY2FkZW1pY3M/OiBzdHJpbmc7XG4gIGZhbWlseUludm9sdmVtZW50Pzogc3RyaW5nOyBhZG1pc3Npb25zQ29zdD86IHN0cmluZzsgYWNjcmVkaXRhdGlvbk93bmVyc2hpcD86IHN0cmluZztcbiAgc291cmNlcz86IHN0cmluZzsgY29udGFjdHNKc29uPzogc3RyaW5nOyBwcm9maWxlTWFya2Rvd24/OiBzdHJpbmc7XG4gIGNvbnRhY3RzPzogeyBnZW5lcmFsPzogYW55OyBwZW9wbGU/OiBhbnlbXTsgc291cmNlcz86IHN0cmluZ1tdIH0gfCBudWxsO1xuICAvLyBTY2hlbWEgdjIgc3RydWN0dXJlZCBmaWVsZHMgKHByZXNlbnQgaW4gbGlzdFByb2dyYW1zIHN1bW1hcmllcykuXG4gIHNldHRpbmc/OiBzdHJpbmdbXTsgbGV2ZWxPZkNhcmU/OiBzdHJpbmdbXTsgc3BlY2lhbHRpZXM/OiBzdHJpbmdbXTsgbW9kYWxpdGllcz86IHN0cmluZ1tdO1xuICBwcmltYXJ5Rm9jdXM/OiBzdHJpbmc7IHJlZ2lvbj86IHN0cmluZzsgbG9jYXRpb25TdGF0ZT86IHN0cmluZzsgbG9jYXRpb25DaXR5Pzogc3RyaW5nO1xuICBhZ2VNaW4/OiBudW1iZXIgfCBudWxsOyBhZ2VNYXg/OiBudW1iZXIgfCBudWxsOyBjb3N0UGVyTW9udGhVU0Q/OiBudW1iZXIgfCBudWxsO1xuICBpbnN1cmFuY2VBY2NlcHRlZD86IGJvb2xlYW47IGluc3VyYW5jZU5ldHdvcmtzPzogc3RyaW5nW107IGZ1bmRpbmdTb3VyY2VzPzogc3RyaW5nW107XG4gIGFjY3JlZGl0YXRpb25zPzogc3RyaW5nW107IGFwcHJvdmVkRnVuZGluZ0xpc3RzPzogc3RyaW5nW107IGhhc0FjYWRlbWljcz86IGJvb2xlYW47XG4gIG5hdHNhcE1lbWJlcj86IGJvb2xlYW47IGxnYnRxQWZmaXJtaW5nPzogYm9vbGVhbjsgZGF0YVNvdXJjZT86IHN0cmluZzsgdmVyaWZpZWQ/OiBib29sZWFuO1xufVxuXG5sZXQgUFJPR1JBTV9TVE9SRTogRGlyUHJvZ3JhbVtdIHwgbnVsbCA9IG51bGw7ICAgLy8gbnVsbCA9IG5vdCBsb2FkZWQgeWV0XG5sZXQgUFJPR1JBTVNfTE9BRElORyA9IGZhbHNlO1xubGV0IFBST0dSQU1TX0VSUk9SOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbmNvbnN0IFBST0dSQU1fREVUQUlMOiB7IFtpZDogc3RyaW5nXTogRGlyUHJvZ3JhbSB9ID0ge307XG5jb25zdCBQUk9HUkFNX0RFVEFJTF9MT0FESU5HOiB7IFtpZDogc3RyaW5nXTogYm9vbGVhbiB9ID0ge307XG5jb25zdCBQUk9HUkFNX0RFVEFJTF9FUlJPUjogeyBbaWQ6IHN0cmluZ106IHN0cmluZyB9ID0ge307XG4vLyBSZWZlcnJhbHMgVE8gYSBwcm9ncmFtICh0aGUgb3RoZXIgc2lkZSBvZiB0aGUgY2xpZW50XHUyMTk0cHJvZ3JhbSByZWxhdGlvbnNoaXApIFx1MjAxNFxuLy8gZXZlcnkgcmVmZXJyYWwgYWNyb3NzIHRoZSBjYXNlbG9hZCB3aG9zZSB0YXJnZXQgaXMgdGhpcyBkaXJlY3RvcnkgcHJvZ3JhbS5cbmNvbnN0IFBST0dSQU1fUkVGRVJSQUxTOiB7IFtpZDogc3RyaW5nXTogYW55W10gfSA9IHt9O1xuY29uc3QgUFJPR1JBTV9SRUZFUlJBTFNfTE9BRElORzogeyBbaWQ6IHN0cmluZ106IGJvb2xlYW4gfSA9IHt9O1xuY29uc3QgUFJPR1JBTV9SRUZFUlJBTFNfRVJST1I6IHsgW2lkOiBzdHJpbmddOiBzdHJpbmcgfSA9IHt9O1xuXG5hc3luYyBmdW5jdGlvbiBhcGlMaXN0UHJvZ3JhbXMoKTogUHJvbWlzZTxEaXJQcm9ncmFtW10+IHsgcmV0dXJuIGF3YWl0IG1hZXN0cm9HZXQoJ2xpc3RQcm9ncmFtcycpOyB9XG5hc3luYyBmdW5jdGlvbiBhcGlHZXRQcm9ncmFtKGlkOiBzdHJpbmcpOiBQcm9taXNlPERpclByb2dyYW0+IHsgcmV0dXJuIGF3YWl0IG1hZXN0cm9Qb3N0KCdnZXRQcm9ncmFtJywgeyBpZDogaWQgfSk7IH1cbi8vIFJlZmVycmFscyB0byBvbmUgcHJvZ3JhbSwgYnkgaXRzIGRpcmVjdG9yeSBpZCAobWFlc3RybyBtYXRjaGVzIG9uIHByb2dyYW1JZCkuXG5hc3luYyBmdW5jdGlvbiBhcGlMaXN0UHJvZ3JhbVJlZmVycmFscyhpZDogc3RyaW5nKTogUHJvbWlzZTxhbnlbXT4geyByZXR1cm4gYXdhaXQgbWFlc3Ryb1Bvc3QoJ2xpc3RBbGxSZWZlcnJhbHMnLCB7IHByb2dyYW06IGlkIH0pOyB9XG5cbi8vIExvYWQgKG9yIHJlbG9hZCkgdGhlIGxpdmUgcHJvZ3JhbSBzdW1tYXJpZXMsIHRoZW4gcmUtcmVuZGVyLiBTYWZlIHRvIGNhbGwgZnJvbVxuLy8gYSB2aWV3IGR1cmluZyByZW5kZXIgXHUyMDE0IG5vLW9wcyBpZiBhbHJlYWR5IGxvYWRlZCAodW5sZXNzIGZvcmNlKSBvciBpbiBmbGlnaHQuXG5hc3luYyBmdW5jdGlvbiBsb2FkUHJvZ3JhbXMoZm9yY2UgPSBmYWxzZSk6IFByb21pc2U8dm9pZD4ge1xuICBpZiAoUFJPR1JBTVNfTE9BRElORykgcmV0dXJuO1xuICBpZiAoUFJPR1JBTV9TVE9SRSAmJiAhZm9yY2UpIHJldHVybjtcbiAgUFJPR1JBTVNfTE9BRElORyA9IHRydWU7IFBST0dSQU1TX0VSUk9SID0gbnVsbDtcbiAgdHJ5IHtcbiAgICBQUk9HUkFNX1NUT1JFID0gYXdhaXQgYXBpTGlzdFByb2dyYW1zKCk7XG4gIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgIFBST0dSQU1TX0VSUk9SID0gZSAmJiBlLm1lc3NhZ2UgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSk7XG4gICAgUFJPR1JBTV9TVE9SRSA9IG51bGw7XG4gIH0gZmluYWxseSB7XG4gICAgUFJPR1JBTVNfTE9BRElORyA9IGZhbHNlO1xuICAgIGlmICh0eXBlb2YgcmVuZGVyID09PSAnZnVuY3Rpb24nKSByZW5kZXIoKTtcbiAgfVxufVxuXG4vLyBMb2FkIG9uZSBmdWxsIHByb2dyYW0gcHJvZmlsZSBieSBpZCAoY2FjaGVkKSwgdGhlbiByZS1yZW5kZXIuXG5hc3luYyBmdW5jdGlvbiBsb2FkUHJvZ3JhbShpZDogc3RyaW5nLCBmb3JjZSA9IGZhbHNlKTogUHJvbWlzZTx2b2lkPiB7XG4gIGlmIChQUk9HUkFNX0RFVEFJTF9MT0FESU5HW2lkXSkgcmV0dXJuO1xuICBpZiAoUFJPR1JBTV9ERVRBSUxbaWRdICYmICFmb3JjZSkgcmV0dXJuO1xuICBQUk9HUkFNX0RFVEFJTF9MT0FESU5HW2lkXSA9IHRydWU7IGRlbGV0ZSBQUk9HUkFNX0RFVEFJTF9FUlJPUltpZF07XG4gIHRyeSB7XG4gICAgUFJPR1JBTV9ERVRBSUxbaWRdID0gYXdhaXQgYXBpR2V0UHJvZ3JhbShpZCk7XG4gIH0gY2F0Y2ggKGU6IGFueSkge1xuICAgIFBST0dSQU1fREVUQUlMX0VSUk9SW2lkXSA9IGUgJiYgZS5tZXNzYWdlID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpO1xuICB9IGZpbmFsbHkge1xuICAgIFBST0dSQU1fREVUQUlMX0xPQURJTkdbaWRdID0gZmFsc2U7XG4gICAgaWYgKHR5cGVvZiByZW5kZXIgPT09ICdmdW5jdGlvbicpIHJlbmRlcigpO1xuICB9XG59XG5cbi8vIExvYWQgKG9yIHJlbG9hZCkgdGhlIHJlZmVycmFscyB0aGF0IGhhdmUgZ29uZSB0byBvbmUgcHJvZ3JhbSwgdGhlbiByZS1yZW5kZXIuXG5hc3luYyBmdW5jdGlvbiBsb2FkUHJvZ3JhbVJlZmVycmFscyhpZDogc3RyaW5nLCBmb3JjZSA9IGZhbHNlKTogUHJvbWlzZTx2b2lkPiB7XG4gIGlmIChQUk9HUkFNX1JFRkVSUkFMU19MT0FESU5HW2lkXSkgcmV0dXJuO1xuICBpZiAoUFJPR1JBTV9SRUZFUlJBTFNbaWRdICYmICFmb3JjZSkgcmV0dXJuO1xuICBQUk9HUkFNX1JFRkVSUkFMU19MT0FESU5HW2lkXSA9IHRydWU7IGRlbGV0ZSBQUk9HUkFNX1JFRkVSUkFMU19FUlJPUltpZF07XG4gIHRyeSB7XG4gICAgUFJPR1JBTV9SRUZFUlJBTFNbaWRdID0gYXdhaXQgYXBpTGlzdFByb2dyYW1SZWZlcnJhbHMoaWQpO1xuICB9IGNhdGNoIChlOiBhbnkpIHtcbiAgICBQUk9HUkFNX1JFRkVSUkFMU19FUlJPUltpZF0gPSBlICYmIGUubWVzc2FnZSA/IGUubWVzc2FnZSA6IFN0cmluZyhlKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBQUk9HUkFNX1JFRkVSUkFMU19MT0FESU5HW2lkXSA9IGZhbHNlO1xuICAgIGlmICh0eXBlb2YgcmVuZGVyID09PSAnZnVuY3Rpb24nKSByZW5kZXIoKTtcbiAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBU0EsTUFBTSxjQUFjO0FBSXBCLGVBQWUsWUFBWSxRQUFnQixTQUFnRDtBQUN6RixRQUFNLE1BQU0sTUFBTSxNQUFNLGFBQWE7QUFBQSxJQUNuQyxRQUFRO0FBQUEsSUFDUixTQUFTLEVBQUUsZ0JBQWdCLG1CQUFtQjtBQUFBLElBQzlDLE1BQU0sS0FBSyxVQUFVLEVBQUUsUUFBZ0IsR0FBRyxRQUFRLENBQUM7QUFBQSxFQUNyRCxDQUFDO0FBQ0QsTUFBSSxPQUFZO0FBQ2hCLE1BQUk7QUFDRixXQUFPLE1BQU0sSUFBSSxLQUFLO0FBQUEsRUFD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
