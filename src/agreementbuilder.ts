/* =====================================================================
   agreementbuilder.ts — envelope Templates (route #/agreementbuilder, reached
   from Settings ▸ Agreements).

   The rich-text builder is retired. A template is now what DocuSign means by one:
   uploaded PDF documents + (from phase 2) placed tabs + roles, stored as v3 JSON
   in thisOrg.agreementTemplates.bodyJson. Template source PDFs live in the org
   document library's "Agreement Templates" folder (apiUploadTemplateDoc).

   Legacy authored (v1/v2) templates are listed read-only, tagged, and can be
   archived — never edited, because the editor that understood them is gone.

   This phase: list, create-by-upload, add/remove docs, archive. Roles + tab
   placement land with the phase-2 designer.
   ===================================================================== */

interface TplState { list: any[] | null; loading: boolean; error: string | null; editing: any | null; }
const TPL: TplState = { list: null, loading: false, error: null, editing: null };

async function tplLoad(force = false): Promise<void> {
  if (TPL.loading) return;
  if (TPL.list && !force) return;
  TPL.loading = true; TPL.error = null;
  try { TPL.list = await apiListAgreementTemplates() || []; }
  catch (e: any) { TPL.error = e && e.message ? e.message : String(e); }
  TPL.loading = false;
  if (location.hash.indexOf('agreementbuilder') >= 0) render();
}

function viewAgreementBuilder(): string {
  if (TPL.editing) { setTimeout(envRenderThumbs, 0); return shell('', tplEditor(TPL.editing)); }
  if (TPL.list === null) { if (!TPL.loading && !TPL.error) tplLoad(); return shell('', TPL.error ? errorCard(TPL.error) : loadingCard('Loading templates…')); }
  return shell('', tplListView());
}

function tplIsV3(t: any): boolean { return !!(t && t.bodyJson && t.bodyJson.schemaVersion === 3); }

function tplListView(): string {
  const head = `<div class="page-head"><div><h1>Agreement Templates</h1><p>Reusable envelopes: upload the PDFs once, place fields once, send many times.</p></div>
    <div><a class="btn ghost" href="#/settings">${ic('chevR', 14)} Settings</a> <button class="btn primary" onclick="tplNew()">${ic('plus', 15)} New template</button></div></div>`;
  const rows = (TPL.list || []).map((t: any) => {
    const v3 = tplIsV3(t);
    const cls = t.status === 'Active' ? 'ok' : t.status === 'Archived' ? 'muted' : 'draft';
    const docs = v3 ? (t.bodyJson.documents || []).length + ' PDF' + ((t.bodyJson.documents || []).length === 1 ? '' : 's') : 'authored (legacy)';
    return `<tr class="${v3 ? 'clickable' : ''}" ${v3 ? `onclick="tplEdit('${esc(t.entryId)}')"` : ''}>
      <td><b>${esc(t.name)}</b>${t.description ? `<div class="meta">${esc(t.description)}</div>` : ''}</td>
      <td>${esc(t.category || '—')}</td>
      <td>${esc(docs)}${v3 ? '' : ' <span class="pill muted" title="Made in the retired rich-text builder. Read-only — rebuild it as an upload-based template.">legacy</span>'}</td>
      <td><span class="pill ${cls}">${esc(t.status || 'Draft')}</span></td>
      <td>${t.status !== 'Archived' ? `<button class="btn ghost sm" onclick="event.stopPropagation();tplArchive('${esc(t.entryId)}')">Archive</button>` : ''}</td>
    </tr>`;
  }).join('');
  if (!rows) {
    return head + `<div class="card"><div class="empty"><div class="ico">${ic('fileText', 22)}</div><b>No templates yet</b><p>Upload the PDFs for your first reusable agreement packet.</p></div></div>`;
  }
  return head + `<div class="tbl-wrap"><table><thead class="rich"><tr><th>Template</th><th>Category</th><th>Documents</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function tplNew(): void {
  TPL.editing = {
    entryId: null, name: '', description: '', status: 'Draft', category: 'Other',
    bodyJson: { schemaVersion: 3, documents: [], roles: [], tabs: [], anchors: [] },
  };
  render();
}

function tplEdit(entryId: string): void {
  const t = (TPL.list || []).find((x: any) => x.entryId === entryId);
  if (!t || !tplIsV3(t)) return;
  TPL.editing = JSON.parse(JSON.stringify(t));
  render();
}

function tplCancel(): void { TPL.editing = null; render(); }

async function tplArchive(entryId: string): Promise<void> {
  if (!confirm('Archive this template? It will stop appearing when sending.')) return;
  try {
    await apiSetAgreementTemplateStatus(entryId, 'Archived');
    await tplLoad(true);
  } catch (e: any) { toast('Archive failed: ' + (e && e.message ? e.message : String(e))); }
}

function tplEditor(t: any): string {
  const b = t.bodyJson;
  // These are the platform option list's values ("Agreement Category") — the field
  // rejects anything else, and there is no MCP for this org to extend the list.
  const cats = ['Engagement Letter', 'Fee Agreement', 'Consent / ROI', 'Other'];
  const catOpts = cats.map(x => `<option value="${esc(x)}"${t.category === x ? ' selected' : ''}>${esc(x)}</option>`).join('');
  const statuses = ['Draft', 'Active', 'Archived'];
  const stOpts = statuses.map(x => `<option value="${esc(x)}"${t.status === x ? ' selected' : ''}>${esc(x)}</option>`).join('');
  const docs = (b.documents || []);
  const docRows = docs.length ? docs.map((d: any, i: number) => `
    <div class="env-doc">
      <canvas class="env-thumb" data-thumb="${esc(d.sourceUrl)}" width="72" height="93"></canvas>
      <div class="env-doc-body"><b>${esc(d.name)}</b><div class="meta">${d.pages ? d.pages + ' pages' : 'PDF'}</div></div>
      <div class="env-doc-acts"><button class="ico-mini danger" title="Remove" onclick="tplRemoveDoc(${i})">${ic('trash', 14)}</button></div>
    </div>`).join('')
    : `<p class="meta">No documents yet — upload the PDFs this template sends.</p>`;

  return `<div class="page-head"><div><h1>${t.entryId ? 'Edit' : 'New'} Template</h1><p>Upload the packet's PDFs. Field placement opens here in the next phase.</p></div>
      <div>${t.entryId ? `<a class="btn outline" href="#/designer/tpl/${esc(t.entryId)}">${ic('edit', 15)} Place fields${(b.tabs || []).length ? ' (' + b.tabs.length + ')' : ''}</a>` : ''}
      <button class="btn ghost" onclick="tplCancel()">${ic('x', 14)} Cancel</button>
      <button class="btn primary" onclick="tplSave()" id="tpl-save">${ic('save', 15)} Save</button></div></div>
    <div class="agb-grid">
      <div class="agb-side">
        <div class="card">
          <div class="field"><label>Name</label><input id="tpl-name" value="${esc(t.name || '')}" placeholder="Admissions Packet"></div>
          <div class="field"><label>Description</label><input id="tpl-desc" value="${esc(t.description || '')}" placeholder="Short description"></div>
          <div class="field"><label>Category</label><select id="tpl-cat">${catOpts}</select></div>
          <div class="field"><label>Status</label><select id="tpl-status">${stOpts}</select></div>
        </div>
      </div>
      <div class="agb-main">
        <div class="card">
          <div class="agb-side-h">Documents</div>
          ${docRows}
          <button class="btn outline sm" onclick="tplPickPdf()">${ic('upload', 14)} Add PDF</button>
        </div>
      </div>
    </div>`;
}

function tplPickPdf(): void {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'application/pdf'; input.multiple = true;
  input.onchange = async () => {
    const files = Array.from(input.files || []);
    for (const f of files) {
      if (f.size > 25 * 1024 * 1024) { toast(f.name + ' is over the 25 MB limit.'); continue; }
      try {
        const b64 = await envFileToBase64(f);
        let pages = 0;
        try { const pdf = await pdfOpen(URL.createObjectURL(f)); pages = pdf.numPages; try { pdf.destroy(); } catch (_e) { /* */ } } catch (_e) { /* */ }
        const name = f.name.replace(/\.pdf$/i, '');
        const res = await apiUploadTemplateDoc(name, b64);
        TPL.editing.bodyJson.documents.push({
          id: 'd' + (TPL.editing.bodyJson.documents.length + 1) + '_' + Math.random().toString(36).slice(2, 8),
          name: name, order: TPL.editing.bodyJson.documents.length + 1,
          sourceUrl: res.url, pages: pages, kind: 'pdf',
        });
        render();
      } catch (e: any) { toast('Upload failed: ' + (e && e.message ? e.message : String(e))); }
    }
  };
  input.click();
}

function tplRemoveDoc(i: number): void {
  // The org-library PDF is left in place: another template version may reference
  // it, and library documents attach by name — deleting is a phase-7 cleanup.
  TPL.editing.bodyJson.documents.splice(i, 1);
  TPL.editing.bodyJson.documents.forEach((d: any, n: number) => { d.order = n + 1; });
  render();
}

async function tplSave(): Promise<void> {
  const t = TPL.editing; if (!t) return;
  const name = (document.getElementById('tpl-name') as HTMLInputElement).value.trim();
  if (!name) { toast('Give the template a name.'); return; }
  if (!(t.bodyJson.documents || []).length) { toast('Upload at least one PDF.'); return; }
  const fields = {
    name: name,
    description: (document.getElementById('tpl-desc') as HTMLInputElement).value.trim(),
    category: (document.getElementById('tpl-cat') as HTMLSelectElement).value,
    status: (document.getElementById('tpl-status') as HTMLSelectElement).value,
    bodyJson: t.bodyJson,
  };
  const btn = document.getElementById('tpl-save') as HTMLButtonElement | null;
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  try {
    await apiSaveAgreementTemplate(t.entryId, fields);
    TPL.editing = null;
    await tplLoad(true);
    toast('Template saved.');
  } catch (e: any) {
    if (btn) { btn.disabled = false; btn.innerHTML = ic('save', 15) + ' Save'; }
    toast('Save failed: ' + (e && e.message ? e.message : String(e)));
  }
}
