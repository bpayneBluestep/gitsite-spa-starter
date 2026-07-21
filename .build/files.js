const FILES_CACHE = {};
const FILES_VIEW = { scope: "client", cid: "", path: "" };
const MAX_UPLOAD = 20;
const FILE_SIZE_CAP = 25 * 1024 * 1024;
let DRIVE_DRAG_FILE = "";
function filesState(cid) {
  if (!FILES_CACHE[cid]) FILES_CACHE[cid] = { list: null, loading: false, error: null };
  return FILES_CACHE[cid];
}
function filesApiList(id) {
  return FILES_VIEW.scope === "program" ? apiListProgramFiles(id) : apiListFiles(id);
}
function filesApiAdd(id, payload) {
  return FILES_VIEW.scope === "program" ? apiAddProgramFile(id, PO_HINTS[id] || {}, payload) : apiAddFile(id, payload);
}
function filesApiUpdate(id, entryId, fields) {
  return FILES_VIEW.scope === "program" ? apiUpdateProgramFile(id, entryId, fields) : apiUpdateFile(id, entryId, fields);
}
function filesApiDelete(id, entryId) {
  return FILES_VIEW.scope === "program" ? apiDeleteProgramFile(id, entryId) : apiDeleteFile(id, entryId);
}
function filesApiCreateFolder(id, path) {
  return FILES_VIEW.scope === "program" ? apiCreateProgramFolder(id, PO_HINTS[id] || {}, path) : apiCreateFolder(id, path);
}
function filesApiRenameFolder(id, oldPath, newPath) {
  return FILES_VIEW.scope === "program" ? apiRenameProgramFolder(id, oldPath, newPath) : apiRenameFolder(id, oldPath, newPath);
}
function filesApiDeleteFolder(id, path) {
  return FILES_VIEW.scope === "program" ? apiDeleteProgramFolder(id, path) : apiDeleteFolder(id, path);
}
async function loadFiles(cid, force = false) {
  const st = filesState(cid);
  if (st.loading) return;
  if (st.list && !force) return;
  st.loading = true;
  st.error = null;
  try {
    const rows = await filesApiList(cid);
    st.list = Array.isArray(rows) ? rows : [];
  } catch (e) {
    st.error = e && e.message ? e.message : String(e);
    st.list = null;
  } finally {
    st.loading = false;
    if (typeof render === "function") render();
  }
}
function splitPath(p) {
  return (p || "").split("/").filter(Boolean);
}
function parentPath(p) {
  const s = splitPath(p);
  s.pop();
  return s.join("/");
}
function lastSeg(p) {
  const s = splitPath(p);
  return s.length ? s[s.length - 1] : "";
}
function joinPath(parent, name) {
  return parent ? parent + "/" + name : name;
}
function allFolderPaths(cid) {
  const set = {};
  const add = (path) => {
    let cur = "";
    splitPath(path).forEach((seg) => {
      cur = cur ? cur + "/" + seg : seg;
      set[cur] = true;
    });
  };
  if (FILES_VIEW.scope === "program") programDefaultFolders().forEach(add);
  else defaultFolders().forEach(add);
  const st = filesState(cid);
  (st.list || []).forEach((e) => {
    if (e.folder) add(e.folder);
  });
  return set;
}
function subfoldersOf(cid, path) {
  const set = allFolderPaths(cid);
  const out = [];
  for (const p in set) {
    if (Object.prototype.hasOwnProperty.call(set, p) && parentPath(p) === path && p !== "") out.push(p);
  }
  out.sort((a, b) => lastSeg(a).toLowerCase().localeCompare(lastSeg(b).toLowerCase()));
  return out;
}
function filesIn(cid, path) {
  const st = filesState(cid);
  return (st.list || []).filter((e) => e.file && e.file.hasFile && (e.folder || "") === path).sort((a, b) => (a.name || a.file.filename || "").toLowerCase().localeCompare((b.name || b.file.filename || "").toLowerCase()));
}
function folderItemCount(cid, path) {
  return subfoldersOf(cid, path).length + filesIn(cid, path).length;
}
function filesSection(c) {
  if (FILES_VIEW.scope !== "client" || FILES_VIEW.cid !== c.id) {
    FILES_VIEW.scope = "client";
    FILES_VIEW.cid = c.id;
    FILES_VIEW.path = "";
  }
  if (!SETTINGS && !SETTINGS_LOADING) loadSettings();
  const head = `<div class="section-head">
    <div><h3>Files</h3><p>Documents for ${esc(c.first)}, organized into folders. Drag files from your computer anywhere here to upload.</p></div>
    <span class="files-status" id="__filesStatus"></span>
  </div>`;
  return head + filesBody(c.id);
}
function programFilesSection(dpid) {
  if (FILES_VIEW.scope !== "program" || FILES_VIEW.cid !== dpid) {
    FILES_VIEW.scope = "program";
    FILES_VIEW.cid = dpid;
    FILES_VIEW.path = "";
  }
  const head = `<div class="section-head">
    <div><h3>Files</h3><p>Documents and materials for this program, organized into folders. Drag files from your computer anywhere here to upload.</p></div>
    <span class="files-status" id="__filesStatus"></span>
  </div>`;
  return head + filesBody(dpid);
}
function filesBody(cid) {
  const st = filesState(cid);
  if (st.list === null) {
    if (!st.loading && !st.error) loadFiles(cid);
    return st.error ? `<div class="card"><div class="empty"><div class="ico">${ic("alert", 22)}</div><b>Couldn't load files</b>
         <p>${esc(st.error)}</p><button class="btn primary" onclick="loadFiles('${esc(cid)}', true)">${ic("clock", 15)} Retry</button></div></div>` : `<div class="card"><div class="empty"><div class="ico">${ic("clock", 22)}</div><b>Loading files\u2026</b></div></div>`;
  }
  const path = FILES_VIEW.path;
  const folders = subfoldersOf(cid, path);
  const files = filesIn(cid, path);
  const segs = splitPath(path);
  let acc = "";
  const crumbs = [`<a class="fb-crumb" onclick="filesGo('')" ondragover="filesCrumbOver(event,this)" ondragleave="filesCrumbLeave(this)" ondrop="filesDropOnFolder(event,'')">${ic("folder", 14)} All files</a>`];
  segs.forEach((s) => {
    acc = acc ? acc + "/" + s : s;
    const p = acc;
    crumbs.push(`<span class="fb-sep">${ic("chevR", 12)}</span><a class="fb-crumb" onclick="filesGo('${esc(p)}')" ondragover="filesCrumbOver(event,this)" ondragleave="filesCrumbLeave(this)" ondrop="filesDropOnFolder(event,'${esc(p)}')">${esc(s)}</a>`);
  });
  const toolbar = `<div class="files-bar">
    <div class="files-crumbs">${crumbs.join("")}</div>
    <span style="flex:1"></span>
    <button class="btn outline" onclick="newFolderPrompt()">${ic("folderPlus", 15)} New folder</button>
    <input type="file" multiple hidden id="__fileInput" onchange="onFilesPicked(this)">
    <button class="btn primary" onclick="document.getElementById('__fileInput').click()">${ic("upload", 15)} Upload</button>
  </div>`;
  let grid;
  if (!folders.length && !files.length) {
    grid = `<div class="empty drive-empty"><div class="ico">${ic("upload", 22)}</div>
      <b>Drag files here to upload</b><p>Drop files from your computer, or use the Upload button. You can also create a folder.</p>
      <button class="btn primary" onclick="document.getElementById('__fileInput').click()">${ic("upload", 15)} Upload files</button></div>`;
  } else {
    grid = `<div class="drive-grid">
      ${folders.map((f) => folderTile(cid, f)).join("")}
      ${files.map((f) => fileTile(f)).join("")}
    </div>`;
  }
  const overlay = `<div class="files-drop-overlay"><div class="fdo-inner">${ic("upload", 30)}
    <div>Drop files to upload${path ? " to \u201C" + esc(lastSeg(path)) + "\u201D" : ""}</div></div></div>`;
  return `<div class="card files-card" id="__filesCard"
      ondragover="filesZoneOver(event)" ondragleave="filesZoneLeave(event)" ondrop="filesZoneDrop(event)">
    ${overlay}${toolbar}${grid}
  </div>`;
}
function folderTile(cid, path) {
  const n = folderItemCount(cid, path);
  return `<div class="drive-tile drive-folder" title="${esc(lastSeg(path))}"
      ondblclick="filesGo('${esc(path)}')"
      ondragover="filesFolderOver(event,this)" ondragleave="filesFolderLeave(this)" ondrop="filesDropOnFolder(event,'${esc(path)}')">
    <div class="dt-icon">${ic("folder", 30)}</div>
    <div class="dt-body">
      <div class="dt-name">${esc(lastSeg(path))}</div>
      <div class="dt-sub">${n} item${n === 1 ? "" : "s"}</div>
    </div>
    <div class="dt-acts">
      <button class="ico-mini" title="Rename" onclick="event.stopPropagation();renameFolderPrompt('${esc(path)}')">${ic("edit", 14)}</button>
      <button class="ico-mini danger" title="Delete" onclick="event.stopPropagation();deleteFolderPrompt('${esc(path)}')">${ic("trash", 14)}</button>
    </div>
  </div>`;
}
function fileTile(f) {
  const thumb = f.file.thumbUrl ? `<img src="${esc(f.file.thumbUrl)}" alt="">` : `<div class="dt-fileicon">${ic("file", 30)}<span class="dt-ext">${esc(fileExt(f))}</span></div>`;
  const label = f.name || f.file.filename || "Untitled";
  const date = fmtDate(f.timestamp) || "";
  const sub = [date, humanSize(f.file.size)].filter(Boolean).join(" \xB7 ");
  return `<div class="drive-tile drive-file" draggable="true" title="${esc(label)}"
      ondragstart="filesDragStart(event,'${esc(f.entryId)}')" ondragend="filesDragEnd()"
      ondblclick="filesOpen('${esc(f.file.url)}')">
    <div class="dt-thumb">${thumb}</div>
    <div class="dt-body">
      <div class="dt-name">${esc(label)}</div>
      <div class="dt-sub">${esc(sub)}</div>
    </div>
    <div class="dt-acts">
      <button class="ico-mini" title="Open" onclick="event.stopPropagation();filesOpen('${esc(f.file.url)}')">${ic("download", 14)}</button>
      <button class="ico-mini" title="Rename" onclick="event.stopPropagation();renameFilePrompt('${esc(f.entryId)}')">${ic("edit", 14)}</button>
      <button class="ico-mini danger" title="Delete" onclick="event.stopPropagation();deleteFilePrompt('${esc(f.entryId)}')">${ic("trash", 14)}</button>
    </div>
  </div>`;
}
function fileExt(f) {
  const fn = f.file.filename || "";
  const m = /\.([a-z0-9]+)$/i.exec(fn);
  return m ? m[1].toUpperCase().slice(0, 4) : "FILE";
}
function humanSize(bytes) {
  if (!bytes || bytes < 0) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
function filesGo(path) {
  FILES_VIEW.path = path;
  render();
}
function filesOpen(url) {
  if (url) window.open(url, "_blank");
}
function filesDragStart(e, entryId) {
  DRIVE_DRAG_FILE = entryId;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", entryId);
    } catch (_e) {
    }
  }
}
function filesDragEnd() {
  DRIVE_DRAG_FILE = "";
}
function filesFolderOver(e, el) {
  if (!DRIVE_DRAG_FILE) return;
  e.preventDefault();
  el.classList.add("drop-hover");
}
function filesFolderLeave(el) {
  el.classList.remove("drop-hover");
}
function filesCrumbOver(e, el) {
  if (!DRIVE_DRAG_FILE) return;
  e.preventDefault();
  el.classList.add("drop-hover");
}
function filesCrumbLeave(el) {
  el.classList.remove("drop-hover");
}
async function filesDropOnFolder(e, path) {
  e.preventDefault();
  const entryId = DRIVE_DRAG_FILE;
  DRIVE_DRAG_FILE = "";
  document.querySelectorAll(".drop-hover").forEach((el) => el.classList.remove("drop-hover"));
  if (!entryId) return;
  const cid = FILES_VIEW.cid;
  const st = filesState(cid);
  const f = (st.list || []).filter((x) => x.entryId === entryId)[0];
  if (!f || (f.folder || "") === path) return;
  try {
    await filesApiUpdate(cid, entryId, { folder: path });
    await loadFiles(cid, true);
    toast("Moved to " + (path ? lastSeg(path) : "All files"));
  } catch (err) {
    toast("Move failed: " + (err && err.message ? err.message : String(err)));
  }
}
function onFilesPicked(input) {
  const cid = FILES_VIEW.cid;
  const all = input.files ? Array.prototype.slice.call(input.files) : [];
  input.value = "";
  uploadFiles(cid, all);
}
function isExternalFileDrag(e) {
  if (DRIVE_DRAG_FILE) return false;
  const dt = e.dataTransfer;
  if (!dt || !dt.types) return false;
  for (let i = 0; i < dt.types.length; i++) if (dt.types[i] === "Files") return true;
  return false;
}
function filesZoneOver(e) {
  if (!isExternalFileDrag(e)) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  const card = document.getElementById("__filesCard");
  if (card) card.classList.add("drag-over");
}
function filesZoneLeave(e) {
  const card = document.getElementById("__filesCard");
  if (!card) return;
  const rel = e.relatedTarget;
  if (rel && card.contains(rel)) return;
  card.classList.remove("drag-over");
}
async function filesZoneDrop(e) {
  if (!isExternalFileDrag(e)) return;
  e.preventDefault();
  const card = document.getElementById("__filesCard");
  if (card) card.classList.remove("drag-over");
  const dt = e.dataTransfer;
  const files = dt && dt.files ? Array.prototype.slice.call(dt.files) : [];
  await uploadFiles(FILES_VIEW.cid, files);
}
async function uploadFiles(cid, all) {
  if (!cid || !all.length) return;
  const queue = all.slice(0, MAX_UPLOAD);
  const overCount = all.length - queue.length;
  const status = document.getElementById("__filesStatus");
  let done = 0, failed = 0;
  for (let i = 0; i < queue.length; i++) {
    const f = queue[i];
    if (status) status.textContent = "Uploading " + (i + 1) + " of " + queue.length + "\u2026";
    if (f.size > FILE_SIZE_CAP) {
      failed++;
      continue;
    }
    try {
      const dataUrl = await fileToDataUrl(f);
      const comma = dataUrl.indexOf(",");
      const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
      const baseName = (f.name || "file").replace(/\.[^.]+$/, "") || (f.name || "file");
      await filesApiAdd(cid, {
        name: baseName,
        folder: FILES_VIEW.path,
        dataBase64: b64,
        filename: f.name || "file",
        contentType: f.type || "application/octet-stream"
      });
      done++;
    } catch (_e) {
      failed++;
    }
  }
  if (status) status.textContent = "";
  await loadFiles(cid, true);
  let msg = done + " file" + (done === 1 ? "" : "s") + " uploaded";
  if (overCount) msg += ", " + overCount + " skipped (max " + MAX_UPLOAD + ")";
  if (failed) msg += ", " + failed + " failed or too large";
  toast(msg);
}
async function renameFilePrompt(entryId) {
  const cid = FILES_VIEW.cid;
  const st = filesState(cid);
  const f = (st.list || []).filter((x) => x.entryId === entryId)[0];
  const cur = f ? f.name || f.file.filename || "" : "";
  const next = window.prompt("Rename file", cur);
  if (next == null) return;
  const name = next.trim();
  if (!name || name === cur) return;
  try {
    await filesApiUpdate(cid, entryId, { name });
    await loadFiles(cid, true);
    toast("Renamed");
  } catch (e) {
    toast("Rename failed: " + (e && e.message ? e.message : String(e)));
  }
}
async function deleteFilePrompt(entryId) {
  if (!window.confirm("Delete this file? This can't be undone.")) return;
  const cid = FILES_VIEW.cid;
  try {
    await filesApiDelete(cid, entryId);
    await loadFiles(cid, true);
    toast("File deleted");
  } catch (e) {
    toast("Delete failed: " + (e && e.message ? e.message : String(e)));
  }
}
async function newFolderPrompt() {
  const cid = FILES_VIEW.cid;
  const name = window.prompt("New folder name", "");
  if (name == null) return;
  const clean = name.trim().replace(/\//g, " ").trim();
  if (!clean) return;
  const path = joinPath(FILES_VIEW.path, clean);
  try {
    await filesApiCreateFolder(cid, path);
    await loadFiles(cid, true);
    toast("Folder created");
  } catch (e) {
    toast("Couldn't create folder: " + (e && e.message ? e.message : String(e)));
  }
}
async function renameFolderPrompt(path) {
  const cid = FILES_VIEW.cid;
  const cur = lastSeg(path);
  const next = window.prompt("Rename folder", cur);
  if (next == null) return;
  const clean = next.trim().replace(/\//g, " ").trim();
  if (!clean || clean === cur) return;
  const newPath = joinPath(parentPath(path), clean);
  try {
    await filesApiRenameFolder(cid, path, newPath);
    await loadFiles(cid, true);
    toast("Folder renamed");
  } catch (e) {
    toast("Rename failed: " + (e && e.message ? e.message : String(e)));
  }
}
async function deleteFolderPrompt(path) {
  const cid = FILES_VIEW.cid;
  const count = folderItemCount(cid, path);
  const warn = count ? 'Delete folder "' + lastSeg(path) + '" and everything inside it (' + count + " item" + (count === 1 ? "" : "s") + ")? This can't be undone." : 'Delete the empty folder "' + lastSeg(path) + '"?';
  if (!window.confirm(warn)) return;
  try {
    await filesApiDeleteFolder(cid, path);
    if (FILES_VIEW.path === path || FILES_VIEW.path.indexOf(path + "/") === 0) FILES_VIEW.path = parentPath(path);
    await loadFiles(cid, true);
    toast("Folder deleted");
  } catch (e) {
    toast("Delete failed: " + (e && e.message ? e.message : String(e)));
  }
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiZmlsZXMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgZmlsZXMudHMgXHUyMDE0IHRoZSBEcml2ZS1saWtlIEZpbGVzIHNlY3Rpb24gKG11bHRpLWVudHJ5IFwiZmlsZXNcIiBmb3JtKS5cblxuICAgRWFjaCBmaWxlIGlzIGFuIGVudHJ5OiB7IG5hbWUsIGZpbGUoZG9jdW1lbnQpLCBmb2xkZXIocGF0aCksIHRpbWVzdGFtcCB9LlxuICAgRm9sZGVycyBhcmUgZW5jb2RlZCBpbiB0aGUgYGZvbGRlcmAgcGF0aCAoXCIvXCItc2VwYXJhdGVkIFx1MjE5MiBzdWJmb2xkZXJzKS4gRW1wdHlcbiAgIGZvbGRlcnMgcGVyc2lzdCBhcyBNQVJLRVIgZW50cmllcyAoZm9sZGVyIHNldCwgbm8gZmlsZSkuIFRoZSBmb2xkZXIgdHJlZSBpc1xuICAgZGVyaXZlZCBmcm9tIGV2ZXJ5IGVudHJ5J3MgZm9sZGVyIHBhdGggUExVUyB0aGUgb3JnIGRlZmF1bHQgZm9sZGVyc1xuICAgKHNldHRpbmdzLmZpbGVzLmRlZmF1bHRGb2xkZXJzKS4gTmF2aWdhdGUgYnkgZG91YmxlLWNsaWNraW5nIGZvbGRlcnMgLyB0aGVcbiAgIGJyZWFkY3J1bWI7IGRyYWcgYSBmaWxlIG9udG8gYSBmb2xkZXIgKG9yIGJyZWFkY3J1bWIgY3J1bWIpIHRvIG1vdmUgaXQuXG5cbiAgIEJhY2tlbmQ6IGFwaS50cyBhcGlMaXN0RmlsZXMvYXBpQWRkRmlsZS9hcGlVcGRhdGVGaWxlL2FwaURlbGV0ZUZpbGUgK1xuICAgYXBpQ3JlYXRlRm9sZGVyL2FwaVJlbmFtZUZvbGRlci9hcGlEZWxldGVGb2xkZXIuXG4gICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cblxuaW50ZXJmYWNlIEZpbGVEb2MgeyBoYXNGaWxlOiBib29sZWFuOyBmaWxlbmFtZTogc3RyaW5nOyB1cmw6IHN0cmluZzsgY29udGVudFR5cGU6IHN0cmluZzsgc2l6ZTogbnVtYmVyOyB0aHVtYlVybDogc3RyaW5nOyB9XG5pbnRlcmZhY2UgRmlsZUVudHJ5IHsgZW50cnlJZDogc3RyaW5nOyBuYW1lOiBzdHJpbmc7IGZvbGRlcjogc3RyaW5nOyB0aW1lc3RhbXA6IHN0cmluZzsgZmlsZTogRmlsZURvYzsgfVxuXG5pbnRlcmZhY2UgRmlsZXNTdGF0ZSB7IGxpc3Q6IEZpbGVFbnRyeVtdIHwgbnVsbDsgbG9hZGluZzogYm9vbGVhbjsgZXJyb3I6IHN0cmluZyB8IG51bGw7IH1cbmNvbnN0IEZJTEVTX0NBQ0hFOiB7IFtjaWQ6IHN0cmluZ106IEZpbGVzU3RhdGUgfSA9IHt9O1xuLy8gQ3VycmVudCBuYXZpZ2F0aW9uIGxvY2F0aW9uLiBgc2NvcGVgIGRlY2lkZXMgd2hpY2ggbWFlc3RybyBlbmRwb2ludHMgYmFjayBpdFxuLy8gKCdjbGllbnQnIFx1MjE5MiB0aGUgY2xpZW50J3MgZmlsZXMgTUVGOyAncHJvZ3JhbScgXHUyMTkyIGEgZGlyZWN0b3J5IHByb2dyYW0ncyBvdmVybGF5XG4vLyBmaWxlcywgcmVzb2x2ZWQgc2VydmVyLXNpZGUpLiBgY2lkYCBpcyB0aGUgY2xpZW50IGlkIE9SIHRoZSBkaXJlY3RvcnkgcHJvZ3JhbVxuLy8gaWQuIHBhdGggJycgPSByb290LiBSZXNldCB3aGVuIHRoZSBob3N0IGNoYW5nZXMuIFNlZSBzY29wZS1hd2FyZSB3cmFwcGVycyBiZWxvdy5cbmNvbnN0IEZJTEVTX1ZJRVc6IHsgc2NvcGU6ICdjbGllbnQnIHwgJ3Byb2dyYW0nOyBjaWQ6IHN0cmluZzsgcGF0aDogc3RyaW5nIH0gPSB7IHNjb3BlOiAnY2xpZW50JywgY2lkOiAnJywgcGF0aDogJycgfTtcbmNvbnN0IE1BWF9VUExPQUQgPSAyMDtcbmNvbnN0IEZJTEVfU0laRV9DQVAgPSAyNSAqIDEwMjQgKiAxMDI0OyAvLyAyNSBNQiBwZXIgZmlsZVxubGV0IERSSVZFX0RSQUdfRklMRSA9ICcnOyAvLyBlbnRyeUlkIG9mIHRoZSBmaWxlIGJlaW5nIGRyYWdnZWRcblxuZnVuY3Rpb24gZmlsZXNTdGF0ZShjaWQ6IHN0cmluZyk6IEZpbGVzU3RhdGUge1xuICBpZiAoIUZJTEVTX0NBQ0hFW2NpZF0pIEZJTEVTX0NBQ0hFW2NpZF0gPSB7IGxpc3Q6IG51bGwsIGxvYWRpbmc6IGZhbHNlLCBlcnJvcjogbnVsbCB9O1xuICByZXR1cm4gRklMRVNfQ0FDSEVbY2lkXTtcbn1cblxuLyogLS0tLSBzY29wZS1hd2FyZSBiYWNrZW5kIChjbGllbnQgdnMgcHJvZ3JhbSkgLS0tLVxuICAgVGhlIEZpbGVzIFVJIGlzIHNoYXJlZCBiZXR3ZWVuIHRoZSBjbGllbnQgcmVjb3JkIGFuZCB0aGUgcHJvZ3JhbSByZWNvcmQgdmlldy5cbiAgIFRoZXNlIHJvdXRlIGVhY2ggY2FsbCB0byB0aGUgcmlnaHQgbWFlc3RybyBhY3Rpb24gYmFzZWQgb24gRklMRVNfVklFVy5zY29wZS5cbiAgIFByb2dyYW0gYWRkL2NyZWF0ZS1mb2xkZXIgcGFzcyB0aGUgcHJvZ3JhbSBkaXNwbGF5IGhpbnRzIHNvIGEgZmlyc3QgdXBsb2FkIGNhblxuICAgbGF6aWx5IGNyZWF0ZSB0aGUgb3ZlcmxheSByZWNvcmQgKHNlZSBQT19ISU5UUyBpbiBwcm9ncmFtb3ZlcmxheS50cykuICovXG5mdW5jdGlvbiBmaWxlc0FwaUxpc3QoaWQ6IHN0cmluZyk6IFByb21pc2U8YW55W10+IHtcbiAgcmV0dXJuIEZJTEVTX1ZJRVcuc2NvcGUgPT09ICdwcm9ncmFtJyA/IGFwaUxpc3RQcm9ncmFtRmlsZXMoaWQpIDogYXBpTGlzdEZpbGVzKGlkKTtcbn1cbmZ1bmN0aW9uIGZpbGVzQXBpQWRkKGlkOiBzdHJpbmcsIHBheWxvYWQ6IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogUHJvbWlzZTxhbnk+IHtcbiAgcmV0dXJuIEZJTEVTX1ZJRVcuc2NvcGUgPT09ICdwcm9ncmFtJyA/IGFwaUFkZFByb2dyYW1GaWxlKGlkLCBQT19ISU5UU1tpZF0gfHwge30sIHBheWxvYWQpIDogYXBpQWRkRmlsZShpZCwgcGF5bG9hZCk7XG59XG5mdW5jdGlvbiBmaWxlc0FwaVVwZGF0ZShpZDogc3RyaW5nLCBlbnRyeUlkOiBzdHJpbmcsIGZpZWxkczogUmVjb3JkPHN0cmluZywgdW5rbm93bj4pOiBQcm9taXNlPGFueT4ge1xuICByZXR1cm4gRklMRVNfVklFVy5zY29wZSA9PT0gJ3Byb2dyYW0nID8gYXBpVXBkYXRlUHJvZ3JhbUZpbGUoaWQsIGVudHJ5SWQsIGZpZWxkcykgOiBhcGlVcGRhdGVGaWxlKGlkLCBlbnRyeUlkLCBmaWVsZHMpO1xufVxuZnVuY3Rpb24gZmlsZXNBcGlEZWxldGUoaWQ6IHN0cmluZywgZW50cnlJZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgcmV0dXJuIEZJTEVTX1ZJRVcuc2NvcGUgPT09ICdwcm9ncmFtJyA/IGFwaURlbGV0ZVByb2dyYW1GaWxlKGlkLCBlbnRyeUlkKSA6IGFwaURlbGV0ZUZpbGUoaWQsIGVudHJ5SWQpO1xufVxuZnVuY3Rpb24gZmlsZXNBcGlDcmVhdGVGb2xkZXIoaWQ6IHN0cmluZywgcGF0aDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgcmV0dXJuIEZJTEVTX1ZJRVcuc2NvcGUgPT09ICdwcm9ncmFtJyA/IGFwaUNyZWF0ZVByb2dyYW1Gb2xkZXIoaWQsIFBPX0hJTlRTW2lkXSB8fCB7fSwgcGF0aCkgOiBhcGlDcmVhdGVGb2xkZXIoaWQsIHBhdGgpO1xufVxuZnVuY3Rpb24gZmlsZXNBcGlSZW5hbWVGb2xkZXIoaWQ6IHN0cmluZywgb2xkUGF0aDogc3RyaW5nLCBuZXdQYXRoOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICByZXR1cm4gRklMRVNfVklFVy5zY29wZSA9PT0gJ3Byb2dyYW0nID8gYXBpUmVuYW1lUHJvZ3JhbUZvbGRlcihpZCwgb2xkUGF0aCwgbmV3UGF0aCkgOiBhcGlSZW5hbWVGb2xkZXIoaWQsIG9sZFBhdGgsIG5ld1BhdGgpO1xufVxuZnVuY3Rpb24gZmlsZXNBcGlEZWxldGVGb2xkZXIoaWQ6IHN0cmluZywgcGF0aDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgcmV0dXJuIEZJTEVTX1ZJRVcuc2NvcGUgPT09ICdwcm9ncmFtJyA/IGFwaURlbGV0ZVByb2dyYW1Gb2xkZXIoaWQsIHBhdGgpIDogYXBpRGVsZXRlRm9sZGVyKGlkLCBwYXRoKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gbG9hZEZpbGVzKGNpZDogc3RyaW5nLCBmb3JjZSA9IGZhbHNlKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IHN0ID0gZmlsZXNTdGF0ZShjaWQpO1xuICBpZiAoc3QubG9hZGluZykgcmV0dXJuO1xuICBpZiAoc3QubGlzdCAmJiAhZm9yY2UpIHJldHVybjtcbiAgc3QubG9hZGluZyA9IHRydWU7IHN0LmVycm9yID0gbnVsbDtcbiAgdHJ5IHtcbiAgICBjb25zdCByb3dzID0gYXdhaXQgZmlsZXNBcGlMaXN0KGNpZCk7XG4gICAgc3QubGlzdCA9IChBcnJheS5pc0FycmF5KHJvd3MpID8gcm93cyA6IFtdKSBhcyBGaWxlRW50cnlbXTtcbiAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgc3QuZXJyb3IgPSBlICYmIGUubWVzc2FnZSA/IGUubWVzc2FnZSA6IFN0cmluZyhlKTtcbiAgICBzdC5saXN0ID0gbnVsbDtcbiAgfSBmaW5hbGx5IHtcbiAgICBzdC5sb2FkaW5nID0gZmFsc2U7XG4gICAgaWYgKHR5cGVvZiByZW5kZXIgPT09ICdmdW5jdGlvbicpIHJlbmRlcigpO1xuICB9XG59XG5cbi8qIC0tLS0gcGF0aCBoZWxwZXJzIC0tLS0gKi9cbmZ1bmN0aW9uIHNwbGl0UGF0aChwOiBzdHJpbmcpOiBzdHJpbmdbXSB7IHJldHVybiAocCB8fCAnJykuc3BsaXQoJy8nKS5maWx0ZXIoQm9vbGVhbik7IH1cbmZ1bmN0aW9uIHBhcmVudFBhdGgocDogc3RyaW5nKTogc3RyaW5nIHsgY29uc3QgcyA9IHNwbGl0UGF0aChwKTsgcy5wb3AoKTsgcmV0dXJuIHMuam9pbignLycpOyB9XG5mdW5jdGlvbiBsYXN0U2VnKHA6IHN0cmluZyk6IHN0cmluZyB7IGNvbnN0IHMgPSBzcGxpdFBhdGgocCk7IHJldHVybiBzLmxlbmd0aCA/IHNbcy5sZW5ndGggLSAxXSA6ICcnOyB9XG5mdW5jdGlvbiBqb2luUGF0aChwYXJlbnQ6IHN0cmluZywgbmFtZTogc3RyaW5nKTogc3RyaW5nIHsgcmV0dXJuIHBhcmVudCA/IHBhcmVudCArICcvJyArIG5hbWUgOiBuYW1lOyB9XG5cbi8vIEV2ZXJ5IGZvbGRlciBwYXRoIHRoYXQgZXhpc3RzIGZvciB0aGlzIGNsaWVudDogZGVmYXVsdCBmb2xkZXJzICsgZXZlcnkgZW50cnknc1xuLy8gZm9sZGVyLCBleHBhbmRlZCBzbyBlYWNoIHBhdGggaW1wbGllcyBhbGwgb2YgaXRzIGFuY2VzdG9ycy5cbmZ1bmN0aW9uIGFsbEZvbGRlclBhdGhzKGNpZDogc3RyaW5nKTogeyBbcGF0aDogc3RyaW5nXTogYm9vbGVhbiB9IHtcbiAgY29uc3Qgc2V0OiB7IFtwYXRoOiBzdHJpbmddOiBib29sZWFuIH0gPSB7fTtcbiAgY29uc3QgYWRkID0gKHBhdGg6IHN0cmluZykgPT4ge1xuICAgIGxldCBjdXIgPSAnJztcbiAgICBzcGxpdFBhdGgocGF0aCkuZm9yRWFjaChzZWcgPT4geyBjdXIgPSBjdXIgPyBjdXIgKyAnLycgKyBzZWcgOiBzZWc7IHNldFtjdXJdID0gdHJ1ZTsgfSk7XG4gIH07XG4gIC8vIE9yZyBkZWZhdWx0IGZvbGRlcnMgc2VlZCB0aGUgdHJlZS4gQ2xpZW50cyBhbmQgcHJvZ3JhbXMgZWFjaCBoYXZlIHRoZWlyIG93blxuICAvLyBjb25maWd1cmFibGUgc2V0IChzZXR0aW5ncy5maWxlcy5kZWZhdWx0Rm9sZGVycyB2cyAucHJvZ3JhbURlZmF1bHRGb2xkZXJzKS5cbiAgaWYgKEZJTEVTX1ZJRVcuc2NvcGUgPT09ICdwcm9ncmFtJykgcHJvZ3JhbURlZmF1bHRGb2xkZXJzKCkuZm9yRWFjaChhZGQpO1xuICBlbHNlIGRlZmF1bHRGb2xkZXJzKCkuZm9yRWFjaChhZGQpO1xuICBjb25zdCBzdCA9IGZpbGVzU3RhdGUoY2lkKTtcbiAgKHN0Lmxpc3QgfHwgW10pLmZvckVhY2goZSA9PiB7IGlmIChlLmZvbGRlcikgYWRkKGUuZm9sZGVyKTsgfSk7XG4gIHJldHVybiBzZXQ7XG59XG5cbmZ1bmN0aW9uIHN1YmZvbGRlcnNPZihjaWQ6IHN0cmluZywgcGF0aDogc3RyaW5nKTogc3RyaW5nW10ge1xuICBjb25zdCBzZXQgPSBhbGxGb2xkZXJQYXRocyhjaWQpO1xuICBjb25zdCBvdXQ6IHN0cmluZ1tdID0gW107XG4gIGZvciAoY29uc3QgcCBpbiBzZXQpIHsgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzZXQsIHApICYmIHBhcmVudFBhdGgocCkgPT09IHBhdGggJiYgcCAhPT0gJycpIG91dC5wdXNoKHApOyB9XG4gIG91dC5zb3J0KChhLCBiKSA9PiBsYXN0U2VnKGEpLnRvTG93ZXJDYXNlKCkubG9jYWxlQ29tcGFyZShsYXN0U2VnKGIpLnRvTG93ZXJDYXNlKCkpKTtcbiAgcmV0dXJuIG91dDtcbn1cblxuZnVuY3Rpb24gZmlsZXNJbihjaWQ6IHN0cmluZywgcGF0aDogc3RyaW5nKTogRmlsZUVudHJ5W10ge1xuICBjb25zdCBzdCA9IGZpbGVzU3RhdGUoY2lkKTtcbiAgcmV0dXJuIChzdC5saXN0IHx8IFtdKS5maWx0ZXIoZSA9PiBlLmZpbGUgJiYgZS5maWxlLmhhc0ZpbGUgJiYgKGUuZm9sZGVyIHx8ICcnKSA9PT0gcGF0aClcbiAgICAuc29ydCgoYSwgYikgPT4gKGEubmFtZSB8fCBhLmZpbGUuZmlsZW5hbWUgfHwgJycpLnRvTG93ZXJDYXNlKCkubG9jYWxlQ29tcGFyZSgoYi5uYW1lIHx8IGIuZmlsZS5maWxlbmFtZSB8fCAnJykudG9Mb3dlckNhc2UoKSkpO1xufVxuXG5mdW5jdGlvbiBmb2xkZXJJdGVtQ291bnQoY2lkOiBzdHJpbmcsIHBhdGg6IHN0cmluZyk6IG51bWJlciB7XG4gIHJldHVybiBzdWJmb2xkZXJzT2YoY2lkLCBwYXRoKS5sZW5ndGggKyBmaWxlc0luKGNpZCwgcGF0aCkubGVuZ3RoO1xufVxuXG4vKiAtLS0tIHNlY3Rpb24gdmlldyAtLS0tXG4gICBTaGFyZWQgYmV0d2VlbiB0aGUgY2xpZW50IHJlY29yZCAoZmlsZXNTZWN0aW9uKSBhbmQgdGhlIHByb2dyYW0gcmVjb3JkIHZpZXdcbiAgIChwcm9ncmFtRmlsZXNTZWN0aW9uKS4gQm90aCBzZXQgRklMRVNfVklFVy5zY29wZS9jaWQgdGhlbiByZW5kZXIgZmlsZXNCb2R5LiAqL1xuZnVuY3Rpb24gZmlsZXNTZWN0aW9uKGM6IENsaWVudCk6IHN0cmluZyB7XG4gIGlmIChGSUxFU19WSUVXLnNjb3BlICE9PSAnY2xpZW50JyB8fCBGSUxFU19WSUVXLmNpZCAhPT0gYy5pZCkgeyBGSUxFU19WSUVXLnNjb3BlID0gJ2NsaWVudCc7IEZJTEVTX1ZJRVcuY2lkID0gYy5pZDsgRklMRVNfVklFVy5wYXRoID0gJyc7IH1cbiAgaWYgKCFTRVRUSU5HUyAmJiAhU0VUVElOR1NfTE9BRElORykgbG9hZFNldHRpbmdzKCk7IC8vIGRlZmF1bHQgZm9sZGVycyBjb21lIGZyb20gc2V0dGluZ3NcbiAgY29uc3QgaGVhZCA9IGA8ZGl2IGNsYXNzPVwic2VjdGlvbi1oZWFkXCI+XG4gICAgPGRpdj48aDM+RmlsZXM8L2gzPjxwPkRvY3VtZW50cyBmb3IgJHtlc2MoYy5maXJzdCl9LCBvcmdhbml6ZWQgaW50byBmb2xkZXJzLiBEcmFnIGZpbGVzIGZyb20geW91ciBjb21wdXRlciBhbnl3aGVyZSBoZXJlIHRvIHVwbG9hZC48L3A+PC9kaXY+XG4gICAgPHNwYW4gY2xhc3M9XCJmaWxlcy1zdGF0dXNcIiBpZD1cIl9fZmlsZXNTdGF0dXNcIj48L3NwYW4+XG4gIDwvZGl2PmA7XG4gIHJldHVybiBoZWFkICsgZmlsZXNCb2R5KGMuaWQpO1xufVxuXG5mdW5jdGlvbiBwcm9ncmFtRmlsZXNTZWN0aW9uKGRwaWQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIGlmIChGSUxFU19WSUVXLnNjb3BlICE9PSAncHJvZ3JhbScgfHwgRklMRVNfVklFVy5jaWQgIT09IGRwaWQpIHsgRklMRVNfVklFVy5zY29wZSA9ICdwcm9ncmFtJzsgRklMRVNfVklFVy5jaWQgPSBkcGlkOyBGSUxFU19WSUVXLnBhdGggPSAnJzsgfVxuICBjb25zdCBoZWFkID0gYDxkaXYgY2xhc3M9XCJzZWN0aW9uLWhlYWRcIj5cbiAgICA8ZGl2PjxoMz5GaWxlczwvaDM+PHA+RG9jdW1lbnRzIGFuZCBtYXRlcmlhbHMgZm9yIHRoaXMgcHJvZ3JhbSwgb3JnYW5pemVkIGludG8gZm9sZGVycy4gRHJhZyBmaWxlcyBmcm9tIHlvdXIgY29tcHV0ZXIgYW55d2hlcmUgaGVyZSB0byB1cGxvYWQuPC9wPjwvZGl2PlxuICAgIDxzcGFuIGNsYXNzPVwiZmlsZXMtc3RhdHVzXCIgaWQ9XCJfX2ZpbGVzU3RhdHVzXCI+PC9zcGFuPlxuICA8L2Rpdj5gO1xuICByZXR1cm4gaGVhZCArIGZpbGVzQm9keShkcGlkKTtcbn1cblxuZnVuY3Rpb24gZmlsZXNCb2R5KGNpZDogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3Qgc3QgPSBmaWxlc1N0YXRlKGNpZCk7XG5cbiAgaWYgKHN0Lmxpc3QgPT09IG51bGwpIHtcbiAgICBpZiAoIXN0LmxvYWRpbmcgJiYgIXN0LmVycm9yKSBsb2FkRmlsZXMoY2lkKTtcbiAgICByZXR1cm4gc3QuZXJyb3JcbiAgICAgID8gYDxkaXYgY2xhc3M9XCJjYXJkXCI+PGRpdiBjbGFzcz1cImVtcHR5XCI+PGRpdiBjbGFzcz1cImljb1wiPiR7aWMoJ2FsZXJ0JywgMjIpfTwvZGl2PjxiPkNvdWxkbid0IGxvYWQgZmlsZXM8L2I+XG4gICAgICAgICA8cD4ke2VzYyhzdC5lcnJvcil9PC9wPjxidXR0b24gY2xhc3M9XCJidG4gcHJpbWFyeVwiIG9uY2xpY2s9XCJsb2FkRmlsZXMoJyR7ZXNjKGNpZCl9JywgdHJ1ZSlcIj4ke2ljKCdjbG9jaycsIDE1KX0gUmV0cnk8L2J1dHRvbj48L2Rpdj48L2Rpdj5gXG4gICAgICA6IGA8ZGl2IGNsYXNzPVwiY2FyZFwiPjxkaXYgY2xhc3M9XCJlbXB0eVwiPjxkaXYgY2xhc3M9XCJpY29cIj4ke2ljKCdjbG9jaycsIDIyKX08L2Rpdj48Yj5Mb2FkaW5nIGZpbGVzXHUyMDI2PC9iPjwvZGl2PjwvZGl2PmA7XG4gIH1cblxuICBjb25zdCBwYXRoID0gRklMRVNfVklFVy5wYXRoO1xuICBjb25zdCBmb2xkZXJzID0gc3ViZm9sZGVyc09mKGNpZCwgcGF0aCk7XG4gIGNvbnN0IGZpbGVzID0gZmlsZXNJbihjaWQsIHBhdGgpO1xuXG4gIC8vIGJyZWFkY3J1bWIgKGRyb3AgdGFyZ2V0cyB0b28gXHUyMDE0IGRyYWcgYSBmaWxlIG9udG8gYSBjcnVtYiB0byBtb3ZlIGl0IHRoZXJlKVxuICBjb25zdCBzZWdzID0gc3BsaXRQYXRoKHBhdGgpO1xuICBsZXQgYWNjID0gJyc7XG4gIGNvbnN0IGNydW1icyA9IFtgPGEgY2xhc3M9XCJmYi1jcnVtYlwiIG9uY2xpY2s9XCJmaWxlc0dvKCcnKVwiIG9uZHJhZ292ZXI9XCJmaWxlc0NydW1iT3ZlcihldmVudCx0aGlzKVwiIG9uZHJhZ2xlYXZlPVwiZmlsZXNDcnVtYkxlYXZlKHRoaXMpXCIgb25kcm9wPVwiZmlsZXNEcm9wT25Gb2xkZXIoZXZlbnQsJycpXCI+JHtpYygnZm9sZGVyJywgMTQpfSBBbGwgZmlsZXM8L2E+YF07XG4gIHNlZ3MuZm9yRWFjaChzID0+IHtcbiAgICBhY2MgPSBhY2MgPyBhY2MgKyAnLycgKyBzIDogcztcbiAgICBjb25zdCBwID0gYWNjO1xuICAgIGNydW1icy5wdXNoKGA8c3BhbiBjbGFzcz1cImZiLXNlcFwiPiR7aWMoJ2NoZXZSJywgMTIpfTwvc3Bhbj48YSBjbGFzcz1cImZiLWNydW1iXCIgb25jbGljaz1cImZpbGVzR28oJyR7ZXNjKHApfScpXCIgb25kcmFnb3Zlcj1cImZpbGVzQ3J1bWJPdmVyKGV2ZW50LHRoaXMpXCIgb25kcmFnbGVhdmU9XCJmaWxlc0NydW1iTGVhdmUodGhpcylcIiBvbmRyb3A9XCJmaWxlc0Ryb3BPbkZvbGRlcihldmVudCwnJHtlc2MocCl9JylcIj4ke2VzYyhzKX08L2E+YCk7XG4gIH0pO1xuXG4gIGNvbnN0IHRvb2xiYXIgPSBgPGRpdiBjbGFzcz1cImZpbGVzLWJhclwiPlxuICAgIDxkaXYgY2xhc3M9XCJmaWxlcy1jcnVtYnNcIj4ke2NydW1icy5qb2luKCcnKX08L2Rpdj5cbiAgICA8c3BhbiBzdHlsZT1cImZsZXg6MVwiPjwvc3Bhbj5cbiAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIG91dGxpbmVcIiBvbmNsaWNrPVwibmV3Rm9sZGVyUHJvbXB0KClcIj4ke2ljKCdmb2xkZXJQbHVzJywgMTUpfSBOZXcgZm9sZGVyPC9idXR0b24+XG4gICAgPGlucHV0IHR5cGU9XCJmaWxlXCIgbXVsdGlwbGUgaGlkZGVuIGlkPVwiX19maWxlSW5wdXRcIiBvbmNoYW5nZT1cIm9uRmlsZXNQaWNrZWQodGhpcylcIj5cbiAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIHByaW1hcnlcIiBvbmNsaWNrPVwiZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ19fZmlsZUlucHV0JykuY2xpY2soKVwiPiR7aWMoJ3VwbG9hZCcsIDE1KX0gVXBsb2FkPC9idXR0b24+XG4gIDwvZGl2PmA7XG5cbiAgbGV0IGdyaWQ6IHN0cmluZztcbiAgaWYgKCFmb2xkZXJzLmxlbmd0aCAmJiAhZmlsZXMubGVuZ3RoKSB7XG4gICAgZ3JpZCA9IGA8ZGl2IGNsYXNzPVwiZW1wdHkgZHJpdmUtZW1wdHlcIj48ZGl2IGNsYXNzPVwiaWNvXCI+JHtpYygndXBsb2FkJywgMjIpfTwvZGl2PlxuICAgICAgPGI+RHJhZyBmaWxlcyBoZXJlIHRvIHVwbG9hZDwvYj48cD5Ecm9wIGZpbGVzIGZyb20geW91ciBjb21wdXRlciwgb3IgdXNlIHRoZSBVcGxvYWQgYnV0dG9uLiBZb3UgY2FuIGFsc28gY3JlYXRlIGEgZm9sZGVyLjwvcD5cbiAgICAgIDxidXR0b24gY2xhc3M9XCJidG4gcHJpbWFyeVwiIG9uY2xpY2s9XCJkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnX19maWxlSW5wdXQnKS5jbGljaygpXCI+JHtpYygndXBsb2FkJywgMTUpfSBVcGxvYWQgZmlsZXM8L2J1dHRvbj48L2Rpdj5gO1xuICB9IGVsc2Uge1xuICAgIGdyaWQgPSBgPGRpdiBjbGFzcz1cImRyaXZlLWdyaWRcIj5cbiAgICAgICR7Zm9sZGVycy5tYXAoZiA9PiBmb2xkZXJUaWxlKGNpZCwgZikpLmpvaW4oJycpfVxuICAgICAgJHtmaWxlcy5tYXAoZiA9PiBmaWxlVGlsZShmKSkuam9pbignJyl9XG4gICAgPC9kaXY+YDtcbiAgfVxuXG4gIC8vIFRoZSB3aG9sZSBjYXJkIGlzIGEgZGVza3RvcC1maWxlIGRyb3Agem9uZSAoZGlzdGluY3QgZnJvbSB0aGUgaW50ZXJuYWxcbiAgLy8gZmlsZS10aWxlIGRyYWcgdXNlZCB0byBtb3ZlIGZpbGVzIGJldHdlZW4gZm9sZGVycykuXG4gIGNvbnN0IG92ZXJsYXkgPSBgPGRpdiBjbGFzcz1cImZpbGVzLWRyb3Atb3ZlcmxheVwiPjxkaXYgY2xhc3M9XCJmZG8taW5uZXJcIj4ke2ljKCd1cGxvYWQnLCAzMCl9XG4gICAgPGRpdj5Ecm9wIGZpbGVzIHRvIHVwbG9hZCR7cGF0aCA/ICcgdG8gXHUyMDFDJyArIGVzYyhsYXN0U2VnKHBhdGgpKSArICdcdTIwMUQnIDogJyd9PC9kaXY+PC9kaXY+PC9kaXY+YDtcbiAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwiY2FyZCBmaWxlcy1jYXJkXCIgaWQ9XCJfX2ZpbGVzQ2FyZFwiXG4gICAgICBvbmRyYWdvdmVyPVwiZmlsZXNab25lT3ZlcihldmVudClcIiBvbmRyYWdsZWF2ZT1cImZpbGVzWm9uZUxlYXZlKGV2ZW50KVwiIG9uZHJvcD1cImZpbGVzWm9uZURyb3AoZXZlbnQpXCI+XG4gICAgJHtvdmVybGF5fSR7dG9vbGJhcn0ke2dyaWR9XG4gIDwvZGl2PmA7XG59XG5cbmZ1bmN0aW9uIGZvbGRlclRpbGUoY2lkOiBzdHJpbmcsIHBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IG4gPSBmb2xkZXJJdGVtQ291bnQoY2lkLCBwYXRoKTtcbiAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwiZHJpdmUtdGlsZSBkcml2ZS1mb2xkZXJcIiB0aXRsZT1cIiR7ZXNjKGxhc3RTZWcocGF0aCkpfVwiXG4gICAgICBvbmRibGNsaWNrPVwiZmlsZXNHbygnJHtlc2MocGF0aCl9JylcIlxuICAgICAgb25kcmFnb3Zlcj1cImZpbGVzRm9sZGVyT3ZlcihldmVudCx0aGlzKVwiIG9uZHJhZ2xlYXZlPVwiZmlsZXNGb2xkZXJMZWF2ZSh0aGlzKVwiIG9uZHJvcD1cImZpbGVzRHJvcE9uRm9sZGVyKGV2ZW50LCcke2VzYyhwYXRoKX0nKVwiPlxuICAgIDxkaXYgY2xhc3M9XCJkdC1pY29uXCI+JHtpYygnZm9sZGVyJywgMzApfTwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJkdC1ib2R5XCI+XG4gICAgICA8ZGl2IGNsYXNzPVwiZHQtbmFtZVwiPiR7ZXNjKGxhc3RTZWcocGF0aCkpfTwvZGl2PlxuICAgICAgPGRpdiBjbGFzcz1cImR0LXN1YlwiPiR7bn0gaXRlbSR7biA9PT0gMSA/ICcnIDogJ3MnfTwvZGl2PlxuICAgIDwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJkdC1hY3RzXCI+XG4gICAgICA8YnV0dG9uIGNsYXNzPVwiaWNvLW1pbmlcIiB0aXRsZT1cIlJlbmFtZVwiIG9uY2xpY2s9XCJldmVudC5zdG9wUHJvcGFnYXRpb24oKTtyZW5hbWVGb2xkZXJQcm9tcHQoJyR7ZXNjKHBhdGgpfScpXCI+JHtpYygnZWRpdCcsIDE0KX08L2J1dHRvbj5cbiAgICAgIDxidXR0b24gY2xhc3M9XCJpY28tbWluaSBkYW5nZXJcIiB0aXRsZT1cIkRlbGV0ZVwiIG9uY2xpY2s9XCJldmVudC5zdG9wUHJvcGFnYXRpb24oKTtkZWxldGVGb2xkZXJQcm9tcHQoJyR7ZXNjKHBhdGgpfScpXCI+JHtpYygndHJhc2gnLCAxNCl9PC9idXR0b24+XG4gICAgPC9kaXY+XG4gIDwvZGl2PmA7XG59XG5cbmZ1bmN0aW9uIGZpbGVUaWxlKGY6IEZpbGVFbnRyeSk6IHN0cmluZyB7XG4gIGNvbnN0IHRodW1iID0gZi5maWxlLnRodW1iVXJsXG4gICAgPyBgPGltZyBzcmM9XCIke2VzYyhmLmZpbGUudGh1bWJVcmwpfVwiIGFsdD1cIlwiPmBcbiAgICA6IGA8ZGl2IGNsYXNzPVwiZHQtZmlsZWljb25cIj4ke2ljKCdmaWxlJywgMzApfTxzcGFuIGNsYXNzPVwiZHQtZXh0XCI+JHtlc2MoZmlsZUV4dChmKSl9PC9zcGFuPjwvZGl2PmA7XG4gIGNvbnN0IGxhYmVsID0gZi5uYW1lIHx8IGYuZmlsZS5maWxlbmFtZSB8fCAnVW50aXRsZWQnO1xuICBjb25zdCBkYXRlID0gZm10RGF0ZShmLnRpbWVzdGFtcCkgfHwgJyc7XG4gIGNvbnN0IHN1YiA9IFtkYXRlLCBodW1hblNpemUoZi5maWxlLnNpemUpXS5maWx0ZXIoQm9vbGVhbikuam9pbignIFx1MDBCNyAnKTtcbiAgcmV0dXJuIGA8ZGl2IGNsYXNzPVwiZHJpdmUtdGlsZSBkcml2ZS1maWxlXCIgZHJhZ2dhYmxlPVwidHJ1ZVwiIHRpdGxlPVwiJHtlc2MobGFiZWwpfVwiXG4gICAgICBvbmRyYWdzdGFydD1cImZpbGVzRHJhZ1N0YXJ0KGV2ZW50LCcke2VzYyhmLmVudHJ5SWQpfScpXCIgb25kcmFnZW5kPVwiZmlsZXNEcmFnRW5kKClcIlxuICAgICAgb25kYmxjbGljaz1cImZpbGVzT3BlbignJHtlc2MoZi5maWxlLnVybCl9JylcIj5cbiAgICA8ZGl2IGNsYXNzPVwiZHQtdGh1bWJcIj4ke3RodW1ifTwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJkdC1ib2R5XCI+XG4gICAgICA8ZGl2IGNsYXNzPVwiZHQtbmFtZVwiPiR7ZXNjKGxhYmVsKX08L2Rpdj5cbiAgICAgIDxkaXYgY2xhc3M9XCJkdC1zdWJcIj4ke2VzYyhzdWIpfTwvZGl2PlxuICAgIDwvZGl2PlxuICAgIDxkaXYgY2xhc3M9XCJkdC1hY3RzXCI+XG4gICAgICA8YnV0dG9uIGNsYXNzPVwiaWNvLW1pbmlcIiB0aXRsZT1cIk9wZW5cIiBvbmNsaWNrPVwiZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7ZmlsZXNPcGVuKCcke2VzYyhmLmZpbGUudXJsKX0nKVwiPiR7aWMoJ2Rvd25sb2FkJywgMTQpfTwvYnV0dG9uPlxuICAgICAgPGJ1dHRvbiBjbGFzcz1cImljby1taW5pXCIgdGl0bGU9XCJSZW5hbWVcIiBvbmNsaWNrPVwiZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7cmVuYW1lRmlsZVByb21wdCgnJHtlc2MoZi5lbnRyeUlkKX0nKVwiPiR7aWMoJ2VkaXQnLCAxNCl9PC9idXR0b24+XG4gICAgICA8YnV0dG9uIGNsYXNzPVwiaWNvLW1pbmkgZGFuZ2VyXCIgdGl0bGU9XCJEZWxldGVcIiBvbmNsaWNrPVwiZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7ZGVsZXRlRmlsZVByb21wdCgnJHtlc2MoZi5lbnRyeUlkKX0nKVwiPiR7aWMoJ3RyYXNoJywgMTQpfTwvYnV0dG9uPlxuICAgIDwvZGl2PlxuICA8L2Rpdj5gO1xufVxuXG5mdW5jdGlvbiBmaWxlRXh0KGY6IEZpbGVFbnRyeSk6IHN0cmluZyB7XG4gIGNvbnN0IGZuID0gZi5maWxlLmZpbGVuYW1lIHx8ICcnO1xuICBjb25zdCBtID0gL1xcLihbYS16MC05XSspJC9pLmV4ZWMoZm4pO1xuICByZXR1cm4gbSA/IG1bMV0udG9VcHBlckNhc2UoKS5zbGljZSgwLCA0KSA6ICdGSUxFJztcbn1cbmZ1bmN0aW9uIGh1bWFuU2l6ZShieXRlczogbnVtYmVyKTogc3RyaW5nIHtcbiAgaWYgKCFieXRlcyB8fCBieXRlcyA8IDApIHJldHVybiAnJztcbiAgaWYgKGJ5dGVzIDwgMTAyNCkgcmV0dXJuIGJ5dGVzICsgJyBCJztcbiAgaWYgKGJ5dGVzIDwgMTAyNCAqIDEwMjQpIHJldHVybiBNYXRoLnJvdW5kKGJ5dGVzIC8gMTAyNCkgKyAnIEtCJztcbiAgcmV0dXJuIChieXRlcyAvICgxMDI0ICogMTAyNCkpLnRvRml4ZWQoMSkgKyAnIE1CJztcbn1cblxuLyogLS0tLSBuYXZpZ2F0aW9uIC0tLS0gKi9cbmZ1bmN0aW9uIGZpbGVzR28ocGF0aDogc3RyaW5nKTogdm9pZCB7IEZJTEVTX1ZJRVcucGF0aCA9IHBhdGg7IHJlbmRlcigpOyB9XG5mdW5jdGlvbiBmaWxlc09wZW4odXJsOiBzdHJpbmcpOiB2b2lkIHsgaWYgKHVybCkgd2luZG93Lm9wZW4odXJsLCAnX2JsYW5rJyk7IH1cblxuLyogLS0tLSBkcmFnICYgZHJvcCAobW92ZSBhIGZpbGUgaW50byBhIGZvbGRlcikgLS0tLSAqL1xuZnVuY3Rpb24gZmlsZXNEcmFnU3RhcnQoZTogRHJhZ0V2ZW50LCBlbnRyeUlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgRFJJVkVfRFJBR19GSUxFID0gZW50cnlJZDtcbiAgaWYgKGUuZGF0YVRyYW5zZmVyKSB7IGUuZGF0YVRyYW5zZmVyLmVmZmVjdEFsbG93ZWQgPSAnbW92ZSc7IHRyeSB7IGUuZGF0YVRyYW5zZmVyLnNldERhdGEoJ3RleHQvcGxhaW4nLCBlbnRyeUlkKTsgfSBjYXRjaCAoX2UpIHsgLyogKi8gfSB9XG59XG5mdW5jdGlvbiBmaWxlc0RyYWdFbmQoKTogdm9pZCB7IERSSVZFX0RSQUdfRklMRSA9ICcnOyB9XG5mdW5jdGlvbiBmaWxlc0ZvbGRlck92ZXIoZTogRHJhZ0V2ZW50LCBlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHsgaWYgKCFEUklWRV9EUkFHX0ZJTEUpIHJldHVybjsgZS5wcmV2ZW50RGVmYXVsdCgpOyBlbC5jbGFzc0xpc3QuYWRkKCdkcm9wLWhvdmVyJyk7IH1cbmZ1bmN0aW9uIGZpbGVzRm9sZGVyTGVhdmUoZWw6IEhUTUxFbGVtZW50KTogdm9pZCB7IGVsLmNsYXNzTGlzdC5yZW1vdmUoJ2Ryb3AtaG92ZXInKTsgfVxuZnVuY3Rpb24gZmlsZXNDcnVtYk92ZXIoZTogRHJhZ0V2ZW50LCBlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHsgaWYgKCFEUklWRV9EUkFHX0ZJTEUpIHJldHVybjsgZS5wcmV2ZW50RGVmYXVsdCgpOyBlbC5jbGFzc0xpc3QuYWRkKCdkcm9wLWhvdmVyJyk7IH1cbmZ1bmN0aW9uIGZpbGVzQ3J1bWJMZWF2ZShlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHsgZWwuY2xhc3NMaXN0LnJlbW92ZSgnZHJvcC1ob3ZlcicpOyB9XG5cbmFzeW5jIGZ1bmN0aW9uIGZpbGVzRHJvcE9uRm9sZGVyKGU6IERyYWdFdmVudCwgcGF0aDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIGUucHJldmVudERlZmF1bHQoKTtcbiAgY29uc3QgZW50cnlJZCA9IERSSVZFX0RSQUdfRklMRTtcbiAgRFJJVkVfRFJBR19GSUxFID0gJyc7XG4gIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5kcm9wLWhvdmVyJykuZm9yRWFjaChlbCA9PiBlbC5jbGFzc0xpc3QucmVtb3ZlKCdkcm9wLWhvdmVyJykpO1xuICBpZiAoIWVudHJ5SWQpIHJldHVybjtcbiAgY29uc3QgY2lkID0gRklMRVNfVklFVy5jaWQ7XG4gIGNvbnN0IHN0ID0gZmlsZXNTdGF0ZShjaWQpO1xuICBjb25zdCBmID0gKHN0Lmxpc3QgfHwgW10pLmZpbHRlcih4ID0+IHguZW50cnlJZCA9PT0gZW50cnlJZClbMF07XG4gIGlmICghZiB8fCAoZi5mb2xkZXIgfHwgJycpID09PSBwYXRoKSByZXR1cm47IC8vIG5vLW9wIGlmIGFscmVhZHkgdGhlcmVcbiAgdHJ5IHtcbiAgICBhd2FpdCBmaWxlc0FwaVVwZGF0ZShjaWQsIGVudHJ5SWQsIHsgZm9sZGVyOiBwYXRoIH0pO1xuICAgIGF3YWl0IGxvYWRGaWxlcyhjaWQsIHRydWUpO1xuICAgIHRvYXN0KCdNb3ZlZCB0byAnICsgKHBhdGggPyBsYXN0U2VnKHBhdGgpIDogJ0FsbCBmaWxlcycpKTtcbiAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICB0b2FzdCgnTW92ZSBmYWlsZWQ6ICcgKyAoZXJyICYmIGVyci5tZXNzYWdlID8gZXJyLm1lc3NhZ2UgOiBTdHJpbmcoZXJyKSkpO1xuICB9XG59XG5cbi8qIC0tLS0gdXBsb2FkIChtdWx0aS1maWxlLCBzZXF1ZW50aWFsLCB3aXRoIHByb2dyZXNzKSAtLS0tICovXG5mdW5jdGlvbiBvbkZpbGVzUGlja2VkKGlucHV0OiBIVE1MSW5wdXRFbGVtZW50KTogdm9pZCB7XG4gIGNvbnN0IGNpZCA9IEZJTEVTX1ZJRVcuY2lkO1xuICBjb25zdCBhbGwgPSBpbnB1dC5maWxlcyA/IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGlucHV0LmZpbGVzKSBhcyBGaWxlW10gOiBbXTtcbiAgaW5wdXQudmFsdWUgPSAnJztcbiAgdXBsb2FkRmlsZXMoY2lkLCBhbGwpO1xufVxuXG4vLyBJcyB0aGlzIGFuIE9TL2Rlc2t0b3AgZmlsZSBkcmFnIChub3QgYW4gaW50ZXJuYWwgZmlsZS10aWxlIG1vdmUpP1xuZnVuY3Rpb24gaXNFeHRlcm5hbEZpbGVEcmFnKGU6IERyYWdFdmVudCk6IGJvb2xlYW4ge1xuICBpZiAoRFJJVkVfRFJBR19GSUxFKSByZXR1cm4gZmFsc2U7IC8vIGludGVybmFsIHRpbGUgbW92ZSBpbiBwcm9ncmVzc1xuICBjb25zdCBkdCA9IGUuZGF0YVRyYW5zZmVyO1xuICBpZiAoIWR0IHx8ICFkdC50eXBlcykgcmV0dXJuIGZhbHNlO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGR0LnR5cGVzLmxlbmd0aDsgaSsrKSBpZiAoZHQudHlwZXNbaV0gPT09ICdGaWxlcycpIHJldHVybiB0cnVlO1xuICByZXR1cm4gZmFsc2U7XG59XG5mdW5jdGlvbiBmaWxlc1pvbmVPdmVyKGU6IERyYWdFdmVudCk6IHZvaWQge1xuICBpZiAoIWlzRXh0ZXJuYWxGaWxlRHJhZyhlKSkgcmV0dXJuO1xuICBlLnByZXZlbnREZWZhdWx0KCk7XG4gIGlmIChlLmRhdGFUcmFuc2ZlcikgZS5kYXRhVHJhbnNmZXIuZHJvcEVmZmVjdCA9ICdjb3B5JztcbiAgY29uc3QgY2FyZCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdfX2ZpbGVzQ2FyZCcpO1xuICBpZiAoY2FyZCkgY2FyZC5jbGFzc0xpc3QuYWRkKCdkcmFnLW92ZXInKTtcbn1cbmZ1bmN0aW9uIGZpbGVzWm9uZUxlYXZlKGU6IERyYWdFdmVudCk6IHZvaWQge1xuICBjb25zdCBjYXJkID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ19fZmlsZXNDYXJkJyk7XG4gIGlmICghY2FyZCkgcmV0dXJuO1xuICBjb25zdCByZWwgPSBlLnJlbGF0ZWRUYXJnZXQgYXMgTm9kZSB8IG51bGw7XG4gIGlmIChyZWwgJiYgY2FyZC5jb250YWlucyhyZWwpKSByZXR1cm47IC8vIG1vdmluZyBiZXR3ZWVuIGNoaWxkcmVuLCBzdGlsbCBpbnNpZGVcbiAgY2FyZC5jbGFzc0xpc3QucmVtb3ZlKCdkcmFnLW92ZXInKTtcbn1cbmFzeW5jIGZ1bmN0aW9uIGZpbGVzWm9uZURyb3AoZTogRHJhZ0V2ZW50KTogUHJvbWlzZTx2b2lkPiB7XG4gIGlmICghaXNFeHRlcm5hbEZpbGVEcmFnKGUpKSByZXR1cm47XG4gIGUucHJldmVudERlZmF1bHQoKTtcbiAgY29uc3QgY2FyZCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdfX2ZpbGVzQ2FyZCcpO1xuICBpZiAoY2FyZCkgY2FyZC5jbGFzc0xpc3QucmVtb3ZlKCdkcmFnLW92ZXInKTtcbiAgY29uc3QgZHQgPSBlLmRhdGFUcmFuc2ZlcjtcbiAgY29uc3QgZmlsZXMgPSBkdCAmJiBkdC5maWxlcyA/IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGR0LmZpbGVzKSBhcyBGaWxlW10gOiBbXTtcbiAgYXdhaXQgdXBsb2FkRmlsZXMoRklMRVNfVklFVy5jaWQsIGZpbGVzKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gdXBsb2FkRmlsZXMoY2lkOiBzdHJpbmcsIGFsbDogRmlsZVtdKTogUHJvbWlzZTx2b2lkPiB7XG4gIGlmICghY2lkIHx8ICFhbGwubGVuZ3RoKSByZXR1cm47XG5cbiAgY29uc3QgcXVldWUgPSBhbGwuc2xpY2UoMCwgTUFYX1VQTE9BRCk7XG4gIGNvbnN0IG92ZXJDb3VudCA9IGFsbC5sZW5ndGggLSBxdWV1ZS5sZW5ndGg7XG4gIGNvbnN0IHN0YXR1cyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdfX2ZpbGVzU3RhdHVzJyk7XG4gIGxldCBkb25lID0gMCwgZmFpbGVkID0gMDtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IHF1ZXVlLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgZiA9IHF1ZXVlW2ldO1xuICAgIGlmIChzdGF0dXMpIHN0YXR1cy50ZXh0Q29udGVudCA9ICdVcGxvYWRpbmcgJyArIChpICsgMSkgKyAnIG9mICcgKyBxdWV1ZS5sZW5ndGggKyAnXHUyMDI2JztcbiAgICBpZiAoZi5zaXplID4gRklMRV9TSVpFX0NBUCkgeyBmYWlsZWQrKzsgY29udGludWU7IH1cbiAgICB0cnkge1xuICAgICAgY29uc3QgZGF0YVVybCA9IGF3YWl0IGZpbGVUb0RhdGFVcmwoZik7IC8vIHNoYXJlZCBoZWxwZXIgKGZvcm1lZGl0LnRzKVxuICAgICAgY29uc3QgY29tbWEgPSBkYXRhVXJsLmluZGV4T2YoJywnKTtcbiAgICAgIGNvbnN0IGI2NCA9IGNvbW1hID49IDAgPyBkYXRhVXJsLnNsaWNlKGNvbW1hICsgMSkgOiBkYXRhVXJsO1xuICAgICAgY29uc3QgYmFzZU5hbWUgPSAoZi5uYW1lIHx8ICdmaWxlJykucmVwbGFjZSgvXFwuW14uXSskLywgJycpIHx8IChmLm5hbWUgfHwgJ2ZpbGUnKTtcbiAgICAgIGF3YWl0IGZpbGVzQXBpQWRkKGNpZCwge1xuICAgICAgICBuYW1lOiBiYXNlTmFtZSwgZm9sZGVyOiBGSUxFU19WSUVXLnBhdGgsXG4gICAgICAgIGRhdGFCYXNlNjQ6IGI2NCwgZmlsZW5hbWU6IGYubmFtZSB8fCAnZmlsZScsIGNvbnRlbnRUeXBlOiBmLnR5cGUgfHwgJ2FwcGxpY2F0aW9uL29jdGV0LXN0cmVhbScsXG4gICAgICB9KTtcbiAgICAgIGRvbmUrKztcbiAgICB9IGNhdGNoIChfZSkgeyBmYWlsZWQrKzsgfVxuICB9XG4gIGlmIChzdGF0dXMpIHN0YXR1cy50ZXh0Q29udGVudCA9ICcnO1xuICBhd2FpdCBsb2FkRmlsZXMoY2lkLCB0cnVlKTtcbiAgbGV0IG1zZyA9IGRvbmUgKyAnIGZpbGUnICsgKGRvbmUgPT09IDEgPyAnJyA6ICdzJykgKyAnIHVwbG9hZGVkJztcbiAgaWYgKG92ZXJDb3VudCkgbXNnICs9ICcsICcgKyBvdmVyQ291bnQgKyAnIHNraXBwZWQgKG1heCAnICsgTUFYX1VQTE9BRCArICcpJztcbiAgaWYgKGZhaWxlZCkgbXNnICs9ICcsICcgKyBmYWlsZWQgKyAnIGZhaWxlZCBvciB0b28gbGFyZ2UnO1xuICB0b2FzdChtc2cpO1xufVxuXG4vKiAtLS0tIGZpbGUgYWN0aW9ucyAtLS0tICovXG5hc3luYyBmdW5jdGlvbiByZW5hbWVGaWxlUHJvbXB0KGVudHJ5SWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBjaWQgPSBGSUxFU19WSUVXLmNpZDtcbiAgY29uc3Qgc3QgPSBmaWxlc1N0YXRlKGNpZCk7XG4gIGNvbnN0IGYgPSAoc3QubGlzdCB8fCBbXSkuZmlsdGVyKHggPT4geC5lbnRyeUlkID09PSBlbnRyeUlkKVswXTtcbiAgY29uc3QgY3VyID0gZiA/IChmLm5hbWUgfHwgZi5maWxlLmZpbGVuYW1lIHx8ICcnKSA6ICcnO1xuICBjb25zdCBuZXh0ID0gd2luZG93LnByb21wdCgnUmVuYW1lIGZpbGUnLCBjdXIpO1xuICBpZiAobmV4dCA9PSBudWxsKSByZXR1cm47XG4gIGNvbnN0IG5hbWUgPSBuZXh0LnRyaW0oKTtcbiAgaWYgKCFuYW1lIHx8IG5hbWUgPT09IGN1cikgcmV0dXJuO1xuICB0cnkgeyBhd2FpdCBmaWxlc0FwaVVwZGF0ZShjaWQsIGVudHJ5SWQsIHsgbmFtZTogbmFtZSB9KTsgYXdhaXQgbG9hZEZpbGVzKGNpZCwgdHJ1ZSk7IHRvYXN0KCdSZW5hbWVkJyk7IH1cbiAgY2F0Y2ggKGU6IGFueSkgeyB0b2FzdCgnUmVuYW1lIGZhaWxlZDogJyArIChlICYmIGUubWVzc2FnZSA/IGUubWVzc2FnZSA6IFN0cmluZyhlKSkpOyB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGRlbGV0ZUZpbGVQcm9tcHQoZW50cnlJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIGlmICghd2luZG93LmNvbmZpcm0oJ0RlbGV0ZSB0aGlzIGZpbGU/IFRoaXMgY2FuXFwndCBiZSB1bmRvbmUuJykpIHJldHVybjtcbiAgY29uc3QgY2lkID0gRklMRVNfVklFVy5jaWQ7XG4gIHRyeSB7IGF3YWl0IGZpbGVzQXBpRGVsZXRlKGNpZCwgZW50cnlJZCk7IGF3YWl0IGxvYWRGaWxlcyhjaWQsIHRydWUpOyB0b2FzdCgnRmlsZSBkZWxldGVkJyk7IH1cbiAgY2F0Y2ggKGU6IGFueSkgeyB0b2FzdCgnRGVsZXRlIGZhaWxlZDogJyArIChlICYmIGUubWVzc2FnZSA/IGUubWVzc2FnZSA6IFN0cmluZyhlKSkpOyB9XG59XG5cbi8qIC0tLS0gZm9sZGVyIGFjdGlvbnMgLS0tLSAqL1xuYXN5bmMgZnVuY3Rpb24gbmV3Rm9sZGVyUHJvbXB0KCk6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBjaWQgPSBGSUxFU19WSUVXLmNpZDtcbiAgY29uc3QgbmFtZSA9IHdpbmRvdy5wcm9tcHQoJ05ldyBmb2xkZXIgbmFtZScsICcnKTtcbiAgaWYgKG5hbWUgPT0gbnVsbCkgcmV0dXJuO1xuICBjb25zdCBjbGVhbiA9IG5hbWUudHJpbSgpLnJlcGxhY2UoL1xcLy9nLCAnICcpLnRyaW0oKTsgLy8gbm8gc2xhc2hlcyBpbiBhIHNpbmdsZSBzZWdtZW50IG5hbWVcbiAgaWYgKCFjbGVhbikgcmV0dXJuO1xuICBjb25zdCBwYXRoID0gam9pblBhdGgoRklMRVNfVklFVy5wYXRoLCBjbGVhbik7XG4gIHRyeSB7IGF3YWl0IGZpbGVzQXBpQ3JlYXRlRm9sZGVyKGNpZCwgcGF0aCk7IGF3YWl0IGxvYWRGaWxlcyhjaWQsIHRydWUpOyB0b2FzdCgnRm9sZGVyIGNyZWF0ZWQnKTsgfVxuICBjYXRjaCAoZTogYW55KSB7IHRvYXN0KCdDb3VsZG5cXCd0IGNyZWF0ZSBmb2xkZXI6ICcgKyAoZSAmJiBlLm1lc3NhZ2UgPyBlLm1lc3NhZ2UgOiBTdHJpbmcoZSkpKTsgfVxufVxuXG5hc3luYyBmdW5jdGlvbiByZW5hbWVGb2xkZXJQcm9tcHQocGF0aDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IGNpZCA9IEZJTEVTX1ZJRVcuY2lkO1xuICBjb25zdCBjdXIgPSBsYXN0U2VnKHBhdGgpO1xuICBjb25zdCBuZXh0ID0gd2luZG93LnByb21wdCgnUmVuYW1lIGZvbGRlcicsIGN1cik7XG4gIGlmIChuZXh0ID09IG51bGwpIHJldHVybjtcbiAgY29uc3QgY2xlYW4gPSBuZXh0LnRyaW0oKS5yZXBsYWNlKC9cXC8vZywgJyAnKS50cmltKCk7XG4gIGlmICghY2xlYW4gfHwgY2xlYW4gPT09IGN1cikgcmV0dXJuO1xuICBjb25zdCBuZXdQYXRoID0gam9pblBhdGgocGFyZW50UGF0aChwYXRoKSwgY2xlYW4pO1xuICB0cnkgeyBhd2FpdCBmaWxlc0FwaVJlbmFtZUZvbGRlcihjaWQsIHBhdGgsIG5ld1BhdGgpOyBhd2FpdCBsb2FkRmlsZXMoY2lkLCB0cnVlKTsgdG9hc3QoJ0ZvbGRlciByZW5hbWVkJyk7IH1cbiAgY2F0Y2ggKGU6IGFueSkgeyB0b2FzdCgnUmVuYW1lIGZhaWxlZDogJyArIChlICYmIGUubWVzc2FnZSA/IGUubWVzc2FnZSA6IFN0cmluZyhlKSkpOyB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGRlbGV0ZUZvbGRlclByb21wdChwYXRoOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgY2lkID0gRklMRVNfVklFVy5jaWQ7XG4gIGNvbnN0IGNvdW50ID0gZm9sZGVySXRlbUNvdW50KGNpZCwgcGF0aCk7XG4gIGNvbnN0IHdhcm4gPSBjb3VudFxuICAgID8gJ0RlbGV0ZSBmb2xkZXIgXCInICsgbGFzdFNlZyhwYXRoKSArICdcIiBhbmQgZXZlcnl0aGluZyBpbnNpZGUgaXQgKCcgKyBjb3VudCArICcgaXRlbScgKyAoY291bnQgPT09IDEgPyAnJyA6ICdzJykgKyAnKT8gVGhpcyBjYW5cXCd0IGJlIHVuZG9uZS4nXG4gICAgOiAnRGVsZXRlIHRoZSBlbXB0eSBmb2xkZXIgXCInICsgbGFzdFNlZyhwYXRoKSArICdcIj8nO1xuICBpZiAoIXdpbmRvdy5jb25maXJtKHdhcm4pKSByZXR1cm47XG4gIHRyeSB7XG4gICAgYXdhaXQgZmlsZXNBcGlEZWxldGVGb2xkZXIoY2lkLCBwYXRoKTtcbiAgICAvLyBJZiB3ZSB3ZXJlIGluc2lkZSB0aGUgZGVsZXRlZCBmb2xkZXIsIHN0ZXAgYmFjayB0byBpdHMgcGFyZW50LlxuICAgIGlmIChGSUxFU19WSUVXLnBhdGggPT09IHBhdGggfHwgRklMRVNfVklFVy5wYXRoLmluZGV4T2YocGF0aCArICcvJykgPT09IDApIEZJTEVTX1ZJRVcucGF0aCA9IHBhcmVudFBhdGgocGF0aCk7XG4gICAgYXdhaXQgbG9hZEZpbGVzKGNpZCwgdHJ1ZSk7XG4gICAgdG9hc3QoJ0ZvbGRlciBkZWxldGVkJyk7XG4gIH0gY2F0Y2ggKGU6IGFueSkgeyB0b2FzdCgnRGVsZXRlIGZhaWxlZDogJyArIChlICYmIGUubWVzc2FnZSA/IGUubWVzc2FnZSA6IFN0cmluZyhlKSkpOyB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFrQkEsTUFBTSxjQUE2QyxDQUFDO0FBS3BELE1BQU0sYUFBeUUsRUFBRSxPQUFPLFVBQVUsS0FBSyxJQUFJLE1BQU0sR0FBRztBQUNwSCxNQUFNLGFBQWE7QUFDbkIsTUFBTSxnQkFBZ0IsS0FBSyxPQUFPO0FBQ2xDLElBQUksa0JBQWtCO0FBRXRCLFNBQVMsV0FBVyxLQUF5QjtBQUMzQyxNQUFJLENBQUMsWUFBWSxHQUFHLEVBQUcsYUFBWSxHQUFHLElBQUksRUFBRSxNQUFNLE1BQU0sU0FBUyxPQUFPLE9BQU8sS0FBSztBQUNwRixTQUFPLFlBQVksR0FBRztBQUN4QjtBQU9BLFNBQVMsYUFBYSxJQUE0QjtBQUNoRCxTQUFPLFdBQVcsVUFBVSxZQUFZLG9CQUFvQixFQUFFLElB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
