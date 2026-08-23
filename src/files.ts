/* =====================================================================
   files.ts — the Drive-like Files section (multi-entry "files" form).

   Each file is an entry: { name, file(document), folder(path), timestamp }.
   Folders are encoded in the `folder` path ("/"-separated → subfolders). Empty
   folders persist as MARKER entries (folder set, no file). The folder tree is
   derived from every entry's folder path PLUS the org default folders
   (settings.files.defaultFolders). Navigate by double-clicking folders / the
   breadcrumb; drag a file onto a folder (or breadcrumb crumb) to move it.

   Backend: api.ts apiListFiles/apiAddFile/apiUpdateFile/apiDeleteFile +
   apiCreateFolder/apiRenameFolder/apiDeleteFolder.
   ===================================================================== */

interface FileDoc { hasFile: boolean; filename: string; url: string; contentType: string; size: number; thumbUrl: string; }
interface FileEntry {
  entryId: string; name: string; folder: string; timestamp: string; file: FileDoc;
  /* Synthesised by the maestro from agreements.signedPdf — shown here, stored on the
     agreement. Read-only: no rename, move or delete, because "delete" would mean
     destroying a signed document from a file browser. */
  virtual?: boolean;
  agreementEntryId?: string;
}

// Where signed agreements are filed. Must match AGREEMENTS_FOLDER in both the
// maestro and the AgreementSign ingester — the two write it, this reads it.
const AGREEMENTS_FOLDER = 'Agreements';

interface FilesState { list: FileEntry[] | null; loading: boolean; error: string | null; }
const FILES_CACHE: { [cid: string]: FilesState } = {};
// Current navigation location. `scope` decides which maestro endpoints back it
// ('client' → the client's files MEF; 'program' → a directory program's overlay
// files, resolved server-side). `cid` is the client id OR the directory program
// id. path '' = root. Reset when the host changes. See scope-aware wrappers below.
const FILES_VIEW: { scope: 'client' | 'program'; cid: string; path: string } = { scope: 'client', cid: '', path: '' };
const MAX_UPLOAD = 20;
const FILE_SIZE_CAP = 25 * 1024 * 1024; // 25 MB per file
let DRIVE_DRAG_FILE = ''; // entryId of the file being dragged

function filesState(cid: string): FilesState {
  if (!FILES_CACHE[cid]) FILES_CACHE[cid] = { list: null, loading: false, error: null };
  return FILES_CACHE[cid];
}

/* ---- scope-aware backend (client vs program) ----
   The Files UI is shared between the client record and the program record view.
   These route each call to the right maestro action based on FILES_VIEW.scope.
   Program add/create-folder pass the program display hints so a first upload can
   lazily create the overlay record (see PO_HINTS in programoverlay.ts). */
function filesApiList(id: string): Promise<any[]> {
  return FILES_VIEW.scope === 'program' ? apiListProgramFiles(id) : apiListFiles(id);
}
function filesApiAdd(id: string, payload: Record<string, unknown>): Promise<any> {
  return FILES_VIEW.scope === 'program' ? apiAddProgramFile(id, PO_HINTS[id] || {}, payload) : apiAddFile(id, payload);
}
function filesApiUpdate(id: string, entryId: string, fields: Record<string, unknown>): Promise<any> {
  return FILES_VIEW.scope === 'program' ? apiUpdateProgramFile(id, entryId, fields) : apiUpdateFile(id, entryId, fields);
}
function filesApiDelete(id: string, entryId: string): Promise<any> {
  return FILES_VIEW.scope === 'program' ? apiDeleteProgramFile(id, entryId) : apiDeleteFile(id, entryId);
}
function filesApiCreateFolder(id: string, path: string): Promise<any> {
  return FILES_VIEW.scope === 'program' ? apiCreateProgramFolder(id, PO_HINTS[id] || {}, path) : apiCreateFolder(id, path);
}
function filesApiRenameFolder(id: string, oldPath: string, newPath: string): Promise<any> {
  return FILES_VIEW.scope === 'program' ? apiRenameProgramFolder(id, oldPath, newPath) : apiRenameFolder(id, oldPath, newPath);
}
function filesApiDeleteFolder(id: string, path: string): Promise<any> {
  return FILES_VIEW.scope === 'program' ? apiDeleteProgramFolder(id, path) : apiDeleteFolder(id, path);
}

async function loadFiles(cid: string, force = false): Promise<void> {
  const st = filesState(cid);
  if (st.loading) return;
  if (st.list && !force) return;
  st.loading = true; st.error = null;
  try {
    const rows = await filesApiList(cid);
    st.list = (Array.isArray(rows) ? rows : []) as FileEntry[];
  } catch (e: any) {
    st.error = e && e.message ? e.message : String(e);
    st.list = null;
  } finally {
    st.loading = false;
    if (typeof render === 'function') render();
  }
}

/* ---- path helpers ---- */
function splitPath(p: string): string[] { return (p || '').split('/').filter(Boolean); }
function parentPath(p: string): string { const s = splitPath(p); s.pop(); return s.join('/'); }
function lastSeg(p: string): string { const s = splitPath(p); return s.length ? s[s.length - 1] : ''; }
function joinPath(parent: string, name: string): string { return parent ? parent + '/' + name : name; }

// Every folder path that exists for this client: default folders + every entry's
// folder, expanded so each path implies all of its ancestors.
function allFolderPaths(cid: string): { [path: string]: boolean } {
  const set: { [path: string]: boolean } = {};
  const add = (path: string) => {
    let cur = '';
    splitPath(path).forEach(seg => { cur = cur ? cur + '/' + seg : seg; set[cur] = true; });
  };
  // Org default folders seed the tree. Clients and programs each have their own
  // configurable set (settings.files.defaultFolders vs .programDefaultFolders).
  if (FILES_VIEW.scope === 'program') programDefaultFolders().forEach(add);
  else {
    defaultFolders().forEach(add);
    // Signed agreements always file here, so the folder exists whether or not this
    // client has one yet — an empty folder that is obviously the right place beats
    // a folder that materialises out of nowhere after the first signature. Not a
    // configurable default: the write side hardcodes it too (AGREEMENTS_FOLDER).
    add(AGREEMENTS_FOLDER);
  }
  const st = filesState(cid);
  (st.list || []).forEach(e => { if (e.folder) add(e.folder); });
  return set;
}

function subfoldersOf(cid: string, path: string): string[] {
  const set = allFolderPaths(cid);
  const out: string[] = [];
  for (const p in set) { if (Object.prototype.hasOwnProperty.call(set, p) && parentPath(p) === path && p !== '') out.push(p); }
  out.sort((a, b) => lastSeg(a).toLowerCase().localeCompare(lastSeg(b).toLowerCase()));
  return out;
}

function filesIn(cid: string, path: string): FileEntry[] {
  const st = filesState(cid);
  return (st.list || []).filter(e => e.file && e.file.hasFile && (e.folder || '') === path)
    .sort((a, b) => (a.name || a.file.filename || '').toLowerCase().localeCompare((b.name || b.file.filename || '').toLowerCase()));
}

function folderItemCount(cid: string, path: string): number {
  return subfoldersOf(cid, path).length + filesIn(cid, path).length;
}

/* ---- section view ----
   Shared between the client record (filesSection) and the program record view
   (programFilesSection). Both set FILES_VIEW.scope/cid then render filesBody. */
function filesSection(c: Client): string {
  if (FILES_VIEW.scope !== 'client' || FILES_VIEW.cid !== c.id) { FILES_VIEW.scope = 'client'; FILES_VIEW.cid = c.id; FILES_VIEW.path = ''; }
  if (!SETTINGS && !SETTINGS_LOADING) loadSettings(); // default folders come from settings
  const head = `<div class="section-head">
    <div><h3>Files</h3><p>Documents for ${esc(c.first)}, organized into folders. Drag files from your computer anywhere here to upload.</p></div>
    <span class="files-status" id="__filesStatus"></span>
  </div>`;
  return head + filesBody(c.id);
}

function programFilesSection(dpid: string): string {
  if (FILES_VIEW.scope !== 'program' || FILES_VIEW.cid !== dpid) { FILES_VIEW.scope = 'program'; FILES_VIEW.cid = dpid; FILES_VIEW.path = ''; }
  const head = `<div class="section-head">
    <div><h3>Files</h3><p>Documents and materials for this program, organized into folders. Drag files from your computer anywhere here to upload.</p></div>
    <span class="files-status" id="__filesStatus"></span>
  </div>`;
  return head + filesBody(dpid);
}

function filesBody(cid: string): string {
  const st = filesState(cid);

  if (st.list === null) {
    if (!st.loading && !st.error) loadFiles(cid);
    return st.error
      ? `<div class="card"><div class="empty"><div class="ico">${ic('alert', 22)}</div><b>Couldn't load files</b>
         <p>${esc(st.error)}</p><button class="btn primary" onclick="loadFiles('${esc(cid)}', true)">${ic('clock', 15)} Retry</button></div></div>`
      : `<div class="card"><div class="empty"><div class="ico">${ic('clock', 22)}</div><b>Loading files…</b></div></div>`;
  }

  const path = FILES_VIEW.path;
  const folders = subfoldersOf(cid, path);
  const files = filesIn(cid, path);

  // breadcrumb (drop targets too — drag a file onto a crumb to move it there)
  const segs = splitPath(path);
  let acc = '';
  const crumbs = [`<a class="fb-crumb" onclick="filesGo('')" ondragover="filesCrumbOver(event,this)" ondragleave="filesCrumbLeave(this)" ondrop="filesDropOnFolder(event,'')">${ic('folder', 14)} All files</a>`];
  segs.forEach(s => {
    acc = acc ? acc + '/' + s : s;
    const p = acc;
    crumbs.push(`<span class="fb-sep">${ic('chevR', 12)}</span><a class="fb-crumb" onclick="filesGo('${esc(p)}')" ondragover="filesCrumbOver(event,this)" ondragleave="filesCrumbLeave(this)" ondrop="filesDropOnFolder(event,'${esc(p)}')">${esc(s)}</a>`);
  });

  const toolbar = `<div class="files-bar">
    <div class="files-crumbs">${crumbs.join('')}</div>
    <span style="flex:1"></span>
    <button class="btn outline" onclick="newFolderPrompt()">${ic('folderPlus', 15)} New folder</button>
    <input type="file" multiple hidden id="__fileInput" onchange="onFilesPicked(this)">
    <button class="btn primary" onclick="document.getElementById('__fileInput').click()">${ic('upload', 15)} Upload</button>
  </div>`;

  let grid: string;
  if (!folders.length && !files.length) {
    grid = `<div class="empty drive-empty"><div class="ico">${ic('upload', 22)}</div>
      <b>Drag files here to upload</b><p>Drop files from your computer, or use the Upload button. You can also create a folder.</p>
      <button class="btn primary" onclick="document.getElementById('__fileInput').click()">${ic('upload', 15)} Upload files</button></div>`;
  } else {
    grid = `<div class="drive-grid">
      ${folders.map(f => folderTile(cid, f)).join('')}
      ${files.map(f => fileTile(f)).join('')}
    </div>`;
  }

  // The whole card is a desktop-file drop zone (distinct from the internal
  // file-tile drag used to move files between folders).
  const overlay = `<div class="files-drop-overlay"><div class="fdo-inner">${ic('upload', 30)}
    <div>Drop files to upload${path ? ' to “' + esc(lastSeg(path)) + '”' : ''}</div></div></div>`;
  return `<div class="card files-card" id="__filesCard"
      ondragover="filesZoneOver(event)" ondragleave="filesZoneLeave(event)" ondrop="filesZoneDrop(event)">
    ${overlay}${toolbar}${grid}
  </div>`;
}

function folderTile(cid: string, path: string): string {
  const n = folderItemCount(cid, path);
  return `<div class="drive-tile drive-folder" title="${esc(lastSeg(path))}"
      ondblclick="filesGo('${esc(path)}')"
      ondragover="filesFolderOver(event,this)" ondragleave="filesFolderLeave(this)" ondrop="filesDropOnFolder(event,'${esc(path)}')">
    <div class="dt-icon">${ic('folder', 30)}</div>
    <div class="dt-body">
      <div class="dt-name">${esc(lastSeg(path))}</div>
      <div class="dt-sub">${n} item${n === 1 ? '' : 's'}</div>
    </div>
    <div class="dt-acts">
      <button class="ico-mini" title="Rename" onclick="event.stopPropagation();renameFolderPrompt('${esc(path)}')">${ic('edit', 14)}</button>
      <button class="ico-mini danger" title="Delete" onclick="event.stopPropagation();deleteFolderPrompt('${esc(path)}')">${ic('trash', 14)}</button>
    </div>
  </div>`;
}

function fileTile(f: FileEntry): string {
  const thumb = f.file.thumbUrl
    ? `<img src="${esc(f.file.thumbUrl)}" alt="">`
    : `<div class="dt-fileicon">${ic('file', 30)}<span class="dt-ext">${esc(fileExt(f))}</span></div>`;
  const label = f.name || f.file.filename || 'Untitled';
  const date = fmtDate(f.timestamp) || '';
  // Size is unknown for a virtual entry (it isn't a files row), so the subtitle says
  // what the thing IS instead of padding it with a meaningless 0 B.
  const sub = f.virtual
    ? [date, 'Signed agreement'].filter(Boolean).join(' · ')
    : [date, humanSize(f.file.size)].filter(Boolean).join(' · ');

  // Virtual entries are not draggable and offer only Open — moving or deleting one
  // would have to act on the agreement, and the endpoint refuses either way.
  const acts = f.virtual
    ? `<button class="ico-mini" title="Open" onclick="event.stopPropagation();filesOpen('${esc(f.file.url)}')">${ic('download', 14)}</button>`
    : `<button class="ico-mini" title="Open" onclick="event.stopPropagation();filesOpen('${esc(f.file.url)}')">${ic('download', 14)}</button>
      <button class="ico-mini" title="Rename" onclick="event.stopPropagation();renameFilePrompt('${esc(f.entryId)}')">${ic('edit', 14)}</button>
      <button class="ico-mini danger" title="Delete" onclick="event.stopPropagation();deleteFilePrompt('${esc(f.entryId)}')">${ic('trash', 14)}</button>`;

  const drag = f.virtual ? '' :
    `draggable="true" ondragstart="filesDragStart(event,'${esc(f.entryId)}')" ondragend="filesDragEnd()"`;

  return `<div class="drive-tile drive-file${f.virtual ? ' drive-linked' : ''}" ${drag} title="${esc(label)}"
      ondblclick="filesOpen('${esc(f.file.url)}')">
    <div class="dt-thumb">${thumb}${f.virtual ? `<span class="dt-badge" title="Stored on the agreement">${ic('pen', 11)}</span>` : ''}</div>
    <div class="dt-body">
      <div class="dt-name">${esc(label)}</div>
      <div class="dt-sub">${esc(sub)}</div>
    </div>
    <div class="dt-acts">${acts}</div>
  </div>`;
}

function fileExt(f: FileEntry): string {
  const fn = f.file.filename || '';
  const m = /\.([a-z0-9]+)$/i.exec(fn);
  return m ? m[1].toUpperCase().slice(0, 4) : 'FILE';
}
function humanSize(bytes: number): string {
  if (!bytes || bytes < 0) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/* ---- navigation ---- */
function filesGo(path: string): void { FILES_VIEW.path = path; render(); }
/* Open a document in a tab instead of downloading it.

   The platform serves /download/<id>/<name> with Content-Disposition: attachment, so
   a plain window.open() saves the file even when Chrome is set to open PDFs inline.
   The field's own "Open files inline in the browser" setting does not help: that
   governs how BlueStep's Relate form UI renders its link, not what the download
   endpoint sends to us.

   Fetching the bytes and opening a blob URL drops the disposition header entirely.

   SECURITY — the reason this is an allowlist and not "just blob everything": a blob
   URL inherits the origin that created it. Opening a user-uploaded .html or .svg this
   way would execute its script as eccrmgitsite.bluestep.net, against the viewer's
   session. Only inert types get the blob treatment; everything else falls through to
   the normal URL and downloads, exactly as it does today. Do not add svg/html here. */
const INLINE_SAFE_TYPES: { [t: string]: boolean } = {
  'application/pdf': true,
  'image/png': true, 'image/jpeg': true, 'image/gif': true,
  'image/webp': true, 'image/bmp': true,
  'text/plain': true,
};
const INLINE_BY_EXT: { [ext: string]: string } = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', txt: 'text/plain',
};

function inlineTypeFor(url: string, served: string): string {
  const t = (served || '').split(';')[0].trim().toLowerCase();
  if (INLINE_SAFE_TYPES[t]) return t;
  // Some documents come back as octet-stream regardless of what they are, so fall
  // back to the extension — but only into the same allowlist.
  const m = /\.([a-z0-9]+)(?:[?#]|$)/i.exec(url);
  const byExt = m ? INLINE_BY_EXT[m[1].toLowerCase()] : '';
  return byExt || '';
}

function filesOpen(url: string): void {
  if (!url) return;
  // Open the tab NOW, synchronously. A window.open() after an await is treated as
  // unrequested by every popup blocker.
  const w = window.open('', '_blank');
  const bail = () => { if (w) { w.location.href = url; } else { window.open(url, '_blank'); } };

  fetch(url, { credentials: 'same-origin' })
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const type = inlineTypeFor(url, r.headers.get('Content-Type') || '');
      if (!type) throw new Error('not inline-safe');
      return r.blob().then(b => ({ b: b, type: type }));
    })
    .then(({ b, type }) => {
      const objUrl = URL.createObjectURL(new Blob([b], { type: type }));
      if (w) { w.location.href = objUrl; } else { window.open(objUrl, '_blank'); }
      // Revoking immediately kills the tab that is still loading it; a minute is long
      // enough for the viewer to have the bytes and short enough not to leak.
      setTimeout(() => URL.revokeObjectURL(objUrl), 60000);
    })
    .catch(bail);
}

/* ---- drag & drop (move a file into a folder) ---- */
function filesDragStart(e: DragEvent, entryId: string): void {
  DRIVE_DRAG_FILE = entryId;
  if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', entryId); } catch (_e) { /* */ } }
}
function filesDragEnd(): void { DRIVE_DRAG_FILE = ''; }
function filesFolderOver(e: DragEvent, el: HTMLElement): void { if (!DRIVE_DRAG_FILE) return; e.preventDefault(); el.classList.add('drop-hover'); }
function filesFolderLeave(el: HTMLElement): void { el.classList.remove('drop-hover'); }
function filesCrumbOver(e: DragEvent, el: HTMLElement): void { if (!DRIVE_DRAG_FILE) return; e.preventDefault(); el.classList.add('drop-hover'); }
function filesCrumbLeave(el: HTMLElement): void { el.classList.remove('drop-hover'); }

async function filesDropOnFolder(e: DragEvent, path: string): Promise<void> {
  e.preventDefault();
  const entryId = DRIVE_DRAG_FILE;
  DRIVE_DRAG_FILE = '';
  document.querySelectorAll('.drop-hover').forEach(el => el.classList.remove('drop-hover'));
  if (!entryId) return;
  const cid = FILES_VIEW.cid;
  const st = filesState(cid);
  const f = (st.list || []).filter(x => x.entryId === entryId)[0];
  if (!f || (f.folder || '') === path) return; // no-op if already there
  try {
    await filesApiUpdate(cid, entryId, { folder: path });
    await loadFiles(cid, true);
    toast('Moved to ' + (path ? lastSeg(path) : 'All files'));
  } catch (err: any) {
    toast('Move failed: ' + (err && err.message ? err.message : String(err)));
  }
}

/* ---- upload (multi-file, sequential, with progress) ---- */
function onFilesPicked(input: HTMLInputElement): void {
  const cid = FILES_VIEW.cid;
  const all = input.files ? Array.prototype.slice.call(input.files) as File[] : [];
  input.value = '';
  uploadFiles(cid, all);
}

// Is this an OS/desktop file drag (not an internal file-tile move)?
function isExternalFileDrag(e: DragEvent): boolean {
  if (DRIVE_DRAG_FILE) return false; // internal tile move in progress
  const dt = e.dataTransfer;
  if (!dt || !dt.types) return false;
  for (let i = 0; i < dt.types.length; i++) if (dt.types[i] === 'Files') return true;
  return false;
}
function filesZoneOver(e: DragEvent): void {
  if (!isExternalFileDrag(e)) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  const card = document.getElementById('__filesCard');
  if (card) card.classList.add('drag-over');
}
function filesZoneLeave(e: DragEvent): void {
  const card = document.getElementById('__filesCard');
  if (!card) return;
  const rel = e.relatedTarget as Node | null;
  if (rel && card.contains(rel)) return; // moving between children, still inside
  card.classList.remove('drag-over');
}
async function filesZoneDrop(e: DragEvent): Promise<void> {
  if (!isExternalFileDrag(e)) return;
  e.preventDefault();
  const card = document.getElementById('__filesCard');
  if (card) card.classList.remove('drag-over');
  const dt = e.dataTransfer;
  const files = dt && dt.files ? Array.prototype.slice.call(dt.files) as File[] : [];
  await uploadFiles(FILES_VIEW.cid, files);
}

async function uploadFiles(cid: string, all: File[]): Promise<void> {
  if (!cid || !all.length) return;

  const queue = all.slice(0, MAX_UPLOAD);
  const overCount = all.length - queue.length;
  const status = document.getElementById('__filesStatus');
  let done = 0, failed = 0;

  for (let i = 0; i < queue.length; i++) {
    const f = queue[i];
    if (status) status.textContent = 'Uploading ' + (i + 1) + ' of ' + queue.length + '…';
    if (f.size > FILE_SIZE_CAP) { failed++; continue; }
    try {
      const dataUrl = await fileToDataUrl(f); // shared helper (formedit.ts)
      const comma = dataUrl.indexOf(',');
      const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
      const baseName = (f.name || 'file').replace(/\.[^.]+$/, '') || (f.name || 'file');
      await filesApiAdd(cid, {
        name: baseName, folder: FILES_VIEW.path,
        dataBase64: b64, filename: f.name || 'file', contentType: f.type || 'application/octet-stream',
      });
      done++;
    } catch (_e) { failed++; }
  }
  if (status) status.textContent = '';
  await loadFiles(cid, true);
  let msg = done + ' file' + (done === 1 ? '' : 's') + ' uploaded';
  if (overCount) msg += ', ' + overCount + ' skipped (max ' + MAX_UPLOAD + ')';
  if (failed) msg += ', ' + failed + ' failed or too large';
  toast(msg);
}

/* ---- file actions ---- */
async function renameFilePrompt(entryId: string): Promise<void> {
  const cid = FILES_VIEW.cid;
  const st = filesState(cid);
  const f = (st.list || []).filter(x => x.entryId === entryId)[0];
  const cur = f ? (f.name || f.file.filename || '') : '';
  const next = window.prompt('Rename file', cur);
  if (next == null) return;
  const name = next.trim();
  if (!name || name === cur) return;
  try { await filesApiUpdate(cid, entryId, { name: name }); await loadFiles(cid, true); toast('Renamed'); }
  catch (e: any) { toast('Rename failed: ' + (e && e.message ? e.message : String(e))); }
}

async function deleteFilePrompt(entryId: string): Promise<void> {
  if (!window.confirm('Delete this file? This can\'t be undone.')) return;
  const cid = FILES_VIEW.cid;
  try { await filesApiDelete(cid, entryId); await loadFiles(cid, true); toast('File deleted'); }
  catch (e: any) { toast('Delete failed: ' + (e && e.message ? e.message : String(e))); }
}

/* ---- folder actions ---- */
async function newFolderPrompt(): Promise<void> {
  const cid = FILES_VIEW.cid;
  const name = window.prompt('New folder name', '');
  if (name == null) return;
  const clean = name.trim().replace(/\//g, ' ').trim(); // no slashes in a single segment name
  if (!clean) return;
  const path = joinPath(FILES_VIEW.path, clean);
  try { await filesApiCreateFolder(cid, path); await loadFiles(cid, true); toast('Folder created'); }
  catch (e: any) { toast('Couldn\'t create folder: ' + (e && e.message ? e.message : String(e))); }
}

async function renameFolderPrompt(path: string): Promise<void> {
  const cid = FILES_VIEW.cid;
  const cur = lastSeg(path);
  const next = window.prompt('Rename folder', cur);
  if (next == null) return;
  const clean = next.trim().replace(/\//g, ' ').trim();
  if (!clean || clean === cur) return;
  const newPath = joinPath(parentPath(path), clean);
  try { await filesApiRenameFolder(cid, path, newPath); await loadFiles(cid, true); toast('Folder renamed'); }
  catch (e: any) { toast('Rename failed: ' + (e && e.message ? e.message : String(e))); }
}

async function deleteFolderPrompt(path: string): Promise<void> {
  const cid = FILES_VIEW.cid;
  const count = folderItemCount(cid, path);
  const warn = count
    ? 'Delete folder "' + lastSeg(path) + '" and everything inside it (' + count + ' item' + (count === 1 ? '' : 's') + ')? This can\'t be undone.'
    : 'Delete the empty folder "' + lastSeg(path) + '"?';
  if (!window.confirm(warn)) return;
  try {
    await filesApiDeleteFolder(cid, path);
    // If we were inside the deleted folder, step back to its parent.
    if (FILES_VIEW.path === path || FILES_VIEW.path.indexOf(path + '/') === 0) FILES_VIEW.path = parentPath(path);
    await loadFiles(cid, true);
    toast('Folder deleted');
  } catch (e: any) { toast('Delete failed: ' + (e && e.message ? e.message : String(e))); }
}
