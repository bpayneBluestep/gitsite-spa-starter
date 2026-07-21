const PDFLAB_BASE = "/b/pdfLab";
let PDFLAB_SIG_DRAWN = false;
function viewPdfLab() {
  const head = pageHead(
    "PDF Lab",
    "Feasibility spike for Agreements e-sign \u2014 native HTML\u2192PDF conversion + SHA-256 tamper-evidence hash, all on BlueStep. Throwaway test surface."
  );
  return shell("", head + `
    <div class="card pl-card">
      <div class="pl-grid">
        <div class="pl-left">
          <label class="pl-label">Agreement HTML
            <span class="muted">\u2014 edit freely; <code>{{SIGNATURE}}</code> is replaced with your drawing</span></label>
          <textarea id="pdflab-html" class="pl-html" spellcheck="false" placeholder="Loading sample template\u2026"></textarea>
        </div>
        <div class="pl-right">
          <label class="pl-label">Signature <span class="muted">\u2014 draw with mouse / finger</span></label>
          <canvas id="pdflab-sig" class="pl-sig" width="360" height="140"></canvas>
          <div class="pl-sig-actions">
            <button class="btn outline sm" onclick="pdfLabClearSig()">${ic("trash", 14)} Clear</button>
          </div>
          <button class="btn primary pl-go" onclick="pdfLabGenerate()">${ic("check", 15)} Generate PDF</button>
          <div id="pdflab-status" class="pl-status"></div>
          <div id="pdflab-result" class="pl-result" hidden></div>
        </div>
      </div>
    </div>`);
}
function pdfLabInit() {
  const ta = document.getElementById("pdflab-html");
  if (ta && !ta.value) {
    fetch(PDFLAB_BASE + "?action=sample", { credentials: "include" }).then((r) => r.json()).then((j) => {
      if (j && j.ok && j.data && j.data.html && ta && !ta.value) ta.value = j.data.html;
    }).catch(() => {
    });
  }
  pdfLabSetupCanvas();
}
function pdfLabSetupCanvas() {
  const cv = document.getElementById("pdflab-sig");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#12325a";
  let drawing = false, lx = 0, ly = 0;
  const pos = (e) => {
    const r = cv.getBoundingClientRect();
    const t = e.touches && e.touches[0] || e;
    return { x: (t.clientX - r.left) * (cv.width / r.width), y: (t.clientY - r.top) * (cv.height / r.height) };
  };
  const start = (e) => {
    drawing = true;
    const p = pos(e);
    lx = p.x;
    ly = p.y;
    e.preventDefault();
  };
  const move = (e) => {
    if (!drawing) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lx = p.x;
    ly = p.y;
    PDFLAB_SIG_DRAWN = true;
    e.preventDefault();
  };
  const end = () => {
    drawing = false;
  };
  cv.onmousedown = start;
  cv.onmousemove = move;
  window.onmouseup = end;
  cv.ontouchstart = start;
  cv.ontouchmove = move;
  cv.ontouchend = end;
}
function pdfLabClearSig() {
  const cv = document.getElementById("pdflab-sig");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  if (ctx) ctx.clearRect(0, 0, cv.width, cv.height);
  PDFLAB_SIG_DRAWN = false;
}
async function pdfLabGenerate() {
  const ta = document.getElementById("pdflab-html");
  const cv = document.getElementById("pdflab-sig");
  const status = document.getElementById("pdflab-status");
  const result = document.getElementById("pdflab-result");
  let html = ta ? ta.value : "";
  const sigTag = cv && PDFLAB_SIG_DRAWN ? '<img src="' + cv.toDataURL("image/png") + '" style="max-height:58px" />' : "";
  if (html) html = html.split("{{SIGNATURE}}").join(sigTag);
  if (status) status.textContent = "Generating\u2026";
  if (result) result.hidden = true;
  try {
    const r = await fetch(PDFLAB_BASE, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate", html })
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "Generation failed");
    const d = j.data;
    if (status) status.textContent = "";
    if (result) {
      result.hidden = false;
      const abs = d.fileUrl ? location.origin + d.fileUrl : "";
      const kb = d.bytes ? (d.bytes / 1024).toFixed(1) + " KB" : "";
      result.innerHTML = `<div class="pl-ok">${ic("check", 15)} PDF generated${kb ? " \u2014 " + kb : ""}${d.ms != null ? " in " + d.ms + " ms" : ""}</div>
         <div class="pl-hash"><b>SHA-256</b><code>${esc(d.hashHex || "")}</code></div>` + (abs ? `<button class="btn primary" onclick="window.open('${esc(abs)}','_blank')">${ic("chevR", 15)} Open PDF</button>` : `<div class="muted">No file URL returned.</div>`);
    }
  } catch (e) {
    if (status) status.textContent = "";
    if (result) {
      result.hidden = false;
      result.innerHTML = `<div class="pl-err">${ic("alert", 15)} ${esc(e && e.message ? e.message : String(e))}</div>`;
    }
  }
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsicGRmbGFiLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgIHBkZmxhYi50cyBcdTIwMTQgVEhST1dBV0FZIHNwaWtlIFVJIGZvciB0aGUgQWdyZWVtZW50cyAvIGUtc2lnbiBmZWFzaWJpbGl0eSB0ZXN0LlxuICAgQ2FsbHMgdGhlIHN0YW5kYWxvbmUgL2IvcGRmTGFiIGVuZHBvaW50IChuYXRpdmUgSFRNTFx1MjE5MlBERiArIFNIQS0yNTYpLiBSZWFjaGVkXG4gICBhdCAjL3BkZmxhYiwgbGF1bmNoZWQgZnJvbSB0aGUgc3VwZXItb25seSBUb29scyBtZW51LiBEZWxldGUgb25jZSB0aGUgcmVhbFxuICAgQWdyZWVtZW50cyBidWlsZCBzdGFydHMuXG4gICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cblxuY29uc3QgUERGTEFCX0JBU0UgPSAnL2IvcGRmTGFiJztcbmxldCBQREZMQUJfU0lHX0RSQVdOID0gZmFsc2U7XG5cbmZ1bmN0aW9uIHZpZXdQZGZMYWIoKTogc3RyaW5nIHtcbiAgY29uc3QgaGVhZCA9IHBhZ2VIZWFkKCdQREYgTGFiJyxcbiAgICAnRmVhc2liaWxpdHkgc3Bpa2UgZm9yIEFncmVlbWVudHMgZS1zaWduIFx1MjAxNCBuYXRpdmUgSFRNTFx1MjE5MlBERiBjb252ZXJzaW9uICsgU0hBLTI1NiB0YW1wZXItZXZpZGVuY2UgaGFzaCwgYWxsIG9uIEJsdWVTdGVwLiBUaHJvd2F3YXkgdGVzdCBzdXJmYWNlLicpO1xuICByZXR1cm4gc2hlbGwoJycsIGhlYWQgKyBgXG4gICAgPGRpdiBjbGFzcz1cImNhcmQgcGwtY2FyZFwiPlxuICAgICAgPGRpdiBjbGFzcz1cInBsLWdyaWRcIj5cbiAgICAgICAgPGRpdiBjbGFzcz1cInBsLWxlZnRcIj5cbiAgICAgICAgICA8bGFiZWwgY2xhc3M9XCJwbC1sYWJlbFwiPkFncmVlbWVudCBIVE1MXG4gICAgICAgICAgICA8c3BhbiBjbGFzcz1cIm11dGVkXCI+XHUyMDE0IGVkaXQgZnJlZWx5OyA8Y29kZT57e1NJR05BVFVSRX19PC9jb2RlPiBpcyByZXBsYWNlZCB3aXRoIHlvdXIgZHJhd2luZzwvc3Bhbj48L2xhYmVsPlxuICAgICAgICAgIDx0ZXh0YXJlYSBpZD1cInBkZmxhYi1odG1sXCIgY2xhc3M9XCJwbC1odG1sXCIgc3BlbGxjaGVjaz1cImZhbHNlXCIgcGxhY2Vob2xkZXI9XCJMb2FkaW5nIHNhbXBsZSB0ZW1wbGF0ZVx1MjAyNlwiPjwvdGV4dGFyZWE+XG4gICAgICAgIDwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzPVwicGwtcmlnaHRcIj5cbiAgICAgICAgICA8bGFiZWwgY2xhc3M9XCJwbC1sYWJlbFwiPlNpZ25hdHVyZSA8c3BhbiBjbGFzcz1cIm11dGVkXCI+XHUyMDE0IGRyYXcgd2l0aCBtb3VzZSAvIGZpbmdlcjwvc3Bhbj48L2xhYmVsPlxuICAgICAgICAgIDxjYW52YXMgaWQ9XCJwZGZsYWItc2lnXCIgY2xhc3M9XCJwbC1zaWdcIiB3aWR0aD1cIjM2MFwiIGhlaWdodD1cIjE0MFwiPjwvY2FudmFzPlxuICAgICAgICAgIDxkaXYgY2xhc3M9XCJwbC1zaWctYWN0aW9uc1wiPlxuICAgICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImJ0biBvdXRsaW5lIHNtXCIgb25jbGljaz1cInBkZkxhYkNsZWFyU2lnKClcIj4ke2ljKCd0cmFzaCcsIDE0KX0gQ2xlYXI8L2J1dHRvbj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8YnV0dG9uIGNsYXNzPVwiYnRuIHByaW1hcnkgcGwtZ29cIiBvbmNsaWNrPVwicGRmTGFiR2VuZXJhdGUoKVwiPiR7aWMoJ2NoZWNrJywgMTUpfSBHZW5lcmF0ZSBQREY8L2J1dHRvbj5cbiAgICAgICAgICA8ZGl2IGlkPVwicGRmbGFiLXN0YXR1c1wiIGNsYXNzPVwicGwtc3RhdHVzXCI+PC9kaXY+XG4gICAgICAgICAgPGRpdiBpZD1cInBkZmxhYi1yZXN1bHRcIiBjbGFzcz1cInBsLXJlc3VsdFwiIGhpZGRlbj48L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5gKTtcbn1cblxuLy8gQ2FsbGVkIGZyb20gbWFpbi50cyByZW5kZXIoKSBhZnRlciB0aGUgdmlldyBpcyBpbnNlcnRlZCAoY2FudmFzIG5lZWRzIGEgbGl2ZSBET00pLlxuZnVuY3Rpb24gcGRmTGFiSW5pdCgpOiB2b2lkIHtcbiAgY29uc3QgdGEgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGRmbGFiLWh0bWwnKSBhcyBIVE1MVGV4dEFyZWFFbGVtZW50IHwgbnVsbDtcbiAgaWYgKHRhICYmICF0YS52YWx1ZSkge1xuICAgIGZldGNoKFBERkxBQl9CQVNFICsgJz9hY3Rpb249c2FtcGxlJywgeyBjcmVkZW50aWFsczogJ2luY2x1ZGUnIH0pXG4gICAgICAudGhlbihyID0+IHIuanNvbigpKVxuICAgICAgLnRoZW4oaiA9PiB7IGlmIChqICYmIGoub2sgJiYgai5kYXRhICYmIGouZGF0YS5odG1sICYmIHRhICYmICF0YS52YWx1ZSkgdGEudmFsdWUgPSBqLmRhdGEuaHRtbDsgfSlcbiAgICAgIC5jYXRjaCgoKSA9PiB7IC8qIGVuZHBvaW50IGZhbGxzIGJhY2sgdG8gaXRzIG93biBzYW1wbGUgaWYgd2Ugc2VuZCBibGFuayAqLyB9KTtcbiAgfVxuICBwZGZMYWJTZXR1cENhbnZhcygpO1xufVxuXG5mdW5jdGlvbiBwZGZMYWJTZXR1cENhbnZhcygpOiB2b2lkIHtcbiAgY29uc3QgY3YgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGRmbGFiLXNpZycpIGFzIEhUTUxDYW52YXNFbGVtZW50IHwgbnVsbDtcbiAgaWYgKCFjdikgcmV0dXJuO1xuICBjb25zdCBjdHggPSBjdi5nZXRDb250ZXh0KCcyZCcpO1xuICBpZiAoIWN0eCkgcmV0dXJuO1xuICBjdHgubGluZVdpZHRoID0gMi4yOyBjdHgubGluZUNhcCA9ICdyb3VuZCc7IGN0eC5saW5lSm9pbiA9ICdyb3VuZCc7IGN0eC5zdHJva2VTdHlsZSA9ICcjMTIzMjVhJztcbiAgbGV0IGRyYXdpbmcgPSBmYWxzZSwgbHggPSAwLCBseSA9IDA7XG4gIGNvbnN0IHBvcyA9IChlOiBhbnkpID0+IHtcbiAgICBjb25zdCByID0gY3YuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgY29uc3QgdCA9IChlLnRvdWNoZXMgJiYgZS50b3VjaGVzWzBdKSB8fCBlO1xuICAgIHJldHVybiB7IHg6ICh0LmNsaWVudFggLSByLmxlZnQpICogKGN2LndpZHRoIC8gci53aWR0aCksIHk6ICh0LmNsaWVudFkgLSByLnRvcCkgKiAoY3YuaGVpZ2h0IC8gci5oZWlnaHQpIH07XG4gIH07XG4gIGNvbnN0IHN0YXJ0ID0gKGU6IGFueSkgPT4geyBkcmF3aW5nID0gdHJ1ZTsgY29uc3QgcCA9IHBvcyhlKTsgbHggPSBwLng7IGx5ID0gcC55OyBlLnByZXZlbnREZWZhdWx0KCk7IH07XG4gIGNvbnN0IG1vdmUgPSAoZTogYW55KSA9PiB7XG4gICAgaWYgKCFkcmF3aW5nKSByZXR1cm47XG4gICAgY29uc3QgcCA9IHBvcyhlKTtcbiAgICBjdHguYmVnaW5QYXRoKCk7IGN0eC5tb3ZlVG8obHgsIGx5KTsgY3R4LmxpbmVUbyhwLngsIHAueSk7IGN0eC5zdHJva2UoKTtcbiAgICBseCA9IHAueDsgbHkgPSBwLnk7IFBERkxBQl9TSUdfRFJBV04gPSB0cnVlOyBlLnByZXZlbnREZWZhdWx0KCk7XG4gIH07XG4gIGNvbnN0IGVuZCA9ICgpID0+IHsgZHJhd2luZyA9IGZhbHNlOyB9O1xuICBjdi5vbm1vdXNlZG93biA9IHN0YXJ0OyBjdi5vbm1vdXNlbW92ZSA9IG1vdmU7IHdpbmRvdy5vbm1vdXNldXAgPSBlbmQ7XG4gIGN2Lm9udG91Y2hzdGFydCA9IHN0YXJ0OyBjdi5vbnRvdWNobW92ZSA9IG1vdmU7IGN2Lm9udG91Y2hlbmQgPSBlbmQ7XG59XG5cbmZ1bmN0aW9uIHBkZkxhYkNsZWFyU2lnKCk6IHZvaWQge1xuICBjb25zdCBjdiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwZGZsYWItc2lnJykgYXMgSFRNTENhbnZhc0VsZW1lbnQgfCBudWxsO1xuICBpZiAoIWN2KSByZXR1cm47XG4gIGNvbnN0IGN0eCA9IGN2LmdldENvbnRleHQoJzJkJyk7XG4gIGlmIChjdHgpIGN0eC5jbGVhclJlY3QoMCwgMCwgY3Yud2lkdGgsIGN2LmhlaWdodCk7XG4gIFBERkxBQl9TSUdfRFJBV04gPSBmYWxzZTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gcGRmTGFiR2VuZXJhdGUoKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IHRhID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BkZmxhYi1odG1sJykgYXMgSFRNTFRleHRBcmVhRWxlbWVudCB8IG51bGw7XG4gIGNvbnN0IGN2ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BkZmxhYi1zaWcnKSBhcyBIVE1MQ2FudmFzRWxlbWVudCB8IG51bGw7XG4gIGNvbnN0IHN0YXR1cyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwZGZsYWItc3RhdHVzJyk7XG4gIGNvbnN0IHJlc3VsdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdwZGZsYWItcmVzdWx0JykgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuXG4gIGxldCBodG1sID0gdGEgPyB0YS52YWx1ZSA6ICcnO1xuICAvLyBJbmplY3QgdGhlIGRyYXduIHNpZ25hdHVyZSAoZGF0YS1VUkkgUE5HKSBpbnRvIHRoZSB7e1NJR05BVFVSRX19IHRva2VuLlxuICBjb25zdCBzaWdUYWcgPSAoY3YgJiYgUERGTEFCX1NJR19EUkFXTikgPyAnPGltZyBzcmM9XCInICsgY3YudG9EYXRhVVJMKCdpbWFnZS9wbmcnKSArICdcIiBzdHlsZT1cIm1heC1oZWlnaHQ6NThweFwiIC8+JyA6ICcnO1xuICBpZiAoaHRtbCkgaHRtbCA9IGh0bWwuc3BsaXQoJ3t7U0lHTkFUVVJFfX0nKS5qb2luKHNpZ1RhZyk7XG5cbiAgaWYgKHN0YXR1cykgc3RhdHVzLnRleHRDb250ZW50ID0gJ0dlbmVyYXRpbmdcdTIwMjYnO1xuICBpZiAocmVzdWx0KSByZXN1bHQuaGlkZGVuID0gdHJ1ZTtcbiAgdHJ5IHtcbiAgICBjb25zdCByID0gYXdhaXQgZmV0Y2goUERGTEFCX0JBU0UsIHtcbiAgICAgIG1ldGhvZDogJ1BPU1QnLCBjcmVkZW50aWFsczogJ2luY2x1ZGUnLFxuICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0sXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGFjdGlvbjogJ2dlbmVyYXRlJywgaHRtbDogaHRtbCB9KSxcbiAgICB9KTtcbiAgICBjb25zdCBqID0gYXdhaXQgci5qc29uKCk7XG4gICAgaWYgKCFqLm9rKSB0aHJvdyBuZXcgRXJyb3Ioai5lcnJvciB8fCAnR2VuZXJhdGlvbiBmYWlsZWQnKTtcbiAgICBjb25zdCBkID0gai5kYXRhO1xuICAgIGlmIChzdGF0dXMpIHN0YXR1cy50ZXh0Q29udGVudCA9ICcnO1xuICAgIGlmIChyZXN1bHQpIHtcbiAgICAgIHJlc3VsdC5oaWRkZW4gPSBmYWxzZTtcbiAgICAgIGNvbnN0IGFicyA9IGQuZmlsZVVybCA/IChsb2NhdGlvbi5vcmlnaW4gKyBkLmZpbGVVcmwpIDogJyc7XG4gICAgICBjb25zdCBrYiA9IGQuYnl0ZXMgPyAoZC5ieXRlcyAvIDEwMjQpLnRvRml4ZWQoMSkgKyAnIEtCJyA6ICcnO1xuICAgICAgcmVzdWx0LmlubmVySFRNTCA9XG4gICAgICAgIGA8ZGl2IGNsYXNzPVwicGwtb2tcIj4ke2ljKCdjaGVjaycsIDE1KX0gUERGIGdlbmVyYXRlZCR7a2IgPyAnIFx1MjAxNCAnICsga2IgOiAnJ30ke2QubXMgIT0gbnVsbCA/ICcgaW4gJyArIGQubXMgKyAnIG1zJyA6ICcnfTwvZGl2PlxuICAgICAgICAgPGRpdiBjbGFzcz1cInBsLWhhc2hcIj48Yj5TSEEtMjU2PC9iPjxjb2RlPiR7ZXNjKGQuaGFzaEhleCB8fCAnJyl9PC9jb2RlPjwvZGl2PmAgK1xuICAgICAgICAoYWJzXG4gICAgICAgICAgPyBgPGJ1dHRvbiBjbGFzcz1cImJ0biBwcmltYXJ5XCIgb25jbGljaz1cIndpbmRvdy5vcGVuKCcke2VzYyhhYnMpfScsJ19ibGFuaycpXCI+JHtpYygnY2hldlInLCAxNSl9IE9wZW4gUERGPC9idXR0b24+YFxuICAgICAgICAgIDogYDxkaXYgY2xhc3M9XCJtdXRlZFwiPk5vIGZpbGUgVVJMIHJldHVybmVkLjwvZGl2PmApO1xuICAgIH1cbiAgfSBjYXRjaCAoZTogYW55KSB7XG4gICAgaWYgKHN0YXR1cykgc3RhdHVzLnRleHRDb250ZW50ID0gJyc7XG4gICAgaWYgKHJlc3VsdCkge1xuICAgICAgcmVzdWx0LmhpZGRlbiA9IGZhbHNlO1xuICAgICAgcmVzdWx0LmlubmVySFRNTCA9IGA8ZGl2IGNsYXNzPVwicGwtZXJyXCI+JHtpYygnYWxlcnQnLCAxNSl9ICR7ZXNjKGUgJiYgZS5tZXNzYWdlID8gZS5tZXNzYWdlIDogU3RyaW5nKGUpKX08L2Rpdj5gO1xuICAgIH1cbiAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBT0EsTUFBTSxjQUFjO0FBQ3BCLElBQUksbUJBQW1CO0FBRXZCLFNBQVMsYUFBcUI7QUFDNUIsUUFBTSxPQUFPO0FBQUEsSUFBUztBQUFBLElBQ3BCO0FBQUEsRUFBK0k7QUFDakosU0FBTyxNQUFNLElBQUksT0FBTztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSx3RUFZOEMsR0FBRyxTQUFTLEVBQUUsQ0FBQztBQUFBO0FBQUEseUVBRWQsR0FBRyxTQUFTLEVBQUUsQ0FBQztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsV0FLN0U7QUFDWDtBQUdBLFNBQVMsYUFBbUI7QUFDMUIsUUFBTSxLQUFLLFNBQVMsZUFB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
