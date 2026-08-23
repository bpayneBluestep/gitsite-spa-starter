/* =====================================================================
   pdfgeo.ts — the ONE geometry model shared by the designer and the signing view.

   Tabs are stored in PDF POINTS with a TOP-LEFT origin, per page:
     { docId, page (1-based), x, y, w, h }  — x,y is the tab's top-left corner.

   The screen renders each page at some CSS width; the scale that converts between
   the two is cssWidth / pageWidthPt. Every surface that draws tabs derives pixel
   positions from points through THESE functions at render time — nothing ever
   stores pixels, which is what makes "zoom never drifts" true by construction
   rather than by testing.

   (PDF's native coordinate space is bottom-left-origin; the flip to top-left
   happens exactly once, in the phase-3 stamper, as pageHeightPt - y - h. Screen
   code never sees bottom-left coordinates.)
   ===================================================================== */

interface GeoPage { docId: string; page: number; wPt: number; hPt: number; }

/** Points -> CSS pixels at the scale a page is currently rendered at. */
function geoPtToPx(v: number, scale: number): number { return v * scale; }
/** CSS pixels -> points. */
function geoPxToPt(v: number, scale: number): number { return v / scale; }
/** The render scale for a page drawn at cssWidth. */
function geoScale(cssWidth: number, wPt: number): number { return cssWidth / wPt; }

/** Position a tab element over its page wrapper. Pixel-snapped so borders stay crisp. */
function geoApplyTabRect(el: HTMLElement, tab: { x: number; y: number; w: number; h: number }, scale: number): void {
  el.style.left = Math.round(geoPtToPx(tab.x, scale)) + 'px';
  el.style.top = Math.round(geoPtToPx(tab.y, scale)) + 'px';
  el.style.width = Math.round(geoPtToPx(tab.w, scale)) + 'px';
  el.style.height = Math.round(geoPtToPx(tab.h, scale)) + 'px';
}

/** Clamp a tab rect (points) inside its page (points). */
function geoClampTab(tab: { x: number; y: number; w: number; h: number }, wPt: number, hPt: number): void {
  tab.w = Math.min(tab.w, wPt);
  tab.h = Math.min(tab.h, hPt);
  tab.x = Math.max(0, Math.min(tab.x, wPt - tab.w));
  tab.y = Math.max(0, Math.min(tab.y, hPt - tab.h));
}

/* Default tab sizes in points, per type. One table, used by the designer for
   placement and by the signing view for minimum hit targets. */
const GEO_TAB_DEFAULTS: { [type: string]: { w: number; h: number } } = {
  signature: { w: 150, h: 34 },
  initials: { w: 48, h: 22 },
  dateSigned: { w: 84, h: 16 },
  name: { w: 130, h: 16 },
  text: { w: 150, h: 16 },
  checkbox: { w: 13, h: 13 },
  radioGroup: { w: 120, h: 54 },
  dropdown: { w: 130, h: 18 },
};

const GEO_TAB_LABELS: { [type: string]: string } = {
  signature: 'Signature', initials: 'Initials', dateSigned: 'Date signed',
  name: 'Name', text: 'Text', checkbox: 'Checkbox', radioGroup: 'Radio group',
  dropdown: 'Dropdown',
};

/* Recipient color assignments — index into this by recipient order-of-appearance.
   Chosen for contrast against white pages in both themes. */
const GEO_RECIPIENT_COLORS = ['#2563eb', '#d97706', '#0d9488', '#9333ea', '#dc2626', '#4d7c0f'];
function geoRecipientColor(i: number): string { return GEO_RECIPIENT_COLORS[i % GEO_RECIPIENT_COLORS.length]; }

/* ===== Anchor tagging (phase 5) =====
   Evaluate a template's auto-place rules against a pdf.js document's text layer.
   A rule places one tab beside EVERY occurrence of its matchText. Coordinates come
   back in PDF points, top-left origin — same contract as designer-placed tabs.
   Text items are grouped into lines by baseline (pdf.js splits runs arbitrarily),
   so a phrase split across items still matches; the x of the match start is
   interpolated inside its span by character fraction. */
async function geoAnchorTabs(pdf: any, docId: string, rules: any[],
  slotMap: (slot: string) => string | null): Promise<any[]> {
  const out: any[] = [];
  if (!rules || !rules.length) return out;
  // rule.occurrence (1-based, optional): place on only the Nth match in the document
  // — lets one repeated phrase ("Sponsor Signature:") feed different role slots.
  const seen: number[] = rules.map(() => 0);
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const pageH = page.getViewport({ scale: 1 }).height;
    const tc = await page.getTextContent();
    const lines: { [y: string]: any[] } = {};
    for (const it of (tc.items as any[])) {
      if (!it.str) continue;
      const y = Math.round(it.transform[5]);
      let key = String(y);
      for (const k in lines) { if (Math.abs(Number(k) - y) <= 2) { key = k; break; } }
      (lines[key] = lines[key] || []).push(it);
    }
    for (const k in lines) {
      const items = lines[k].slice().sort((a: any, b: any) => a.transform[4] - b.transform[4]);
      let lineStr = '';
      const spans: { start: number; x: number; w: number; h: number; len: number }[] = [];
      for (const it of items) {
        spans.push({ start: lineStr.length, x: it.transform[4], w: it.width, h: it.height || Math.abs(it.transform[3]) || 11, len: it.str.length });
        lineStr += it.str;
      }
      for (let ri = 0; ri < rules.length; ri++) {
        const rule = rules[ri];
        if (!rule || !rule.matchText) continue;
        let from = 0, idx: number;
        while ((idx = lineStr.indexOf(rule.matchText, from)) >= 0) {
          from = idx + rule.matchText.length;
          seen[ri]++;
          if (rule.occurrence && seen[ri] !== Number(rule.occurrence)) continue;
          const rid = slotMap(String(rule.roleSlot || ''));
          if (!rid) continue;
          const sp = spans.find(s2 => idx >= s2.start && idx < s2.start + s2.len) || spans[0];
          const frac = sp.len ? (idx - sp.start) / sp.len : 0;
          const mx = sp.x + sp.w * frac;
          const topY = pageH - Number(k) - (sp.h || 11);
          const def = GEO_TAB_DEFAULTS[rule.tabType] || GEO_TAB_DEFAULTS.text;
          out.push({
            id: 't_a' + Math.random().toString(36).slice(2, 10),
            docId: docId, page: p,
            x: mx + (Number(rule.dx) || 0), y: topY + (Number(rule.dy) || 0),
            w: Number(rule.w) || def.w, h: Number(rule.h) || def.h,
            type: rule.tabType || 'text', recipientId: rid,
            required: rule.required !== false, label: rule.label || '', options: [],
          });
        }
      }
    }
  }
  return out;
}
