// Brew Journal (PWA) — no Mac needed.
// Works best when installed to Home Screen (Safari → Share → Add to Home Screen).

const STORAGE_KEY = "brewjournal_v1";
const ICONS = [
  "latteArt","icedLatte","cupcakeHeart",
  "espresso","blackMug","icedCoffee",
  "syrupBottle","strawDrink","cupcakeLeaf",
  "matchaCup","dessertCup","pourOver"
];

const state = {
  view: "calendar",          // calendar | bookmarks | settings
  monthAnchor: startOfMonth(new Date()),
  selectedDate: startOfDay(new Date()),
  draft: null                // editor draft
};

function loadData(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return { entries: {} };
    const data = JSON.parse(raw);
    if(!data.entries) data.entries = {};
    return data;
  }catch(e){
    return { entries: {} };
  }
}
function saveData(data){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

let data = loadData();

const app = document.getElementById("app");
const modalRoot = document.getElementById("modalRoot");

// ---------- Date helpers ----------
function pad2(n){ return String(n).padStart(2,"0"); }
function keyForDate(d){
  const dd = startOfDay(d);
  return `${dd.getFullYear()}-${pad2(dd.getMonth()+1)}-${pad2(dd.getDate())}`;
}
function dateFromKey(k){
  const [y,m,d] = k.split("-").map(Number);
  return new Date(y, m-1, d, 12, 0, 0); // noon to avoid DST edges
}
function startOfDay(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
function isToday(d){
  const t = startOfDay(new Date()).getTime();
  return startOfDay(d).getTime() === t;
}
function monthTitle(d){
  const m = d.toLocaleString(undefined, { month: "long" });
  return { year: String(d.getFullYear()), month: m };
}
function shortDate(d){
  return d.toLocaleDateString(undefined, { year:"numeric", month:"short", day:"numeric" });
}

// ---------- Rendering ----------
function render(){
  if(state.view === "calendar") renderCalendar();
  if(state.view === "bookmarks") renderBookmarks();
  if(state.view === "settings") renderSettings();
}

function topbarHTML({left, right}){
  return `
    <div class="topbar">
      <div class="side">${left || ""}</div>
      <div></div>
      <div class="side right">${right || ""}</div>
    </div>
  `;
}

function iconHTML(id, cls=""){
  return `<img class="${cls}" src="./icons/${id}.png" alt="" />`;
}


function renderCalendar(){
  const {year, month} = monthTitle(state.monthAnchor);
  const left = `<button class="iconBtn" id="goBookmarks" aria-label="Bookmarks">🔖</button>`;
  const right = `<button class="iconBtn" id="goSettings" aria-label="Settings">⚙️</button>`;

  const days = monthGrid(state.monthAnchor); // array of Date | null
  app.innerHTML = `
    ${topbarHTML({left, right})}

    <div class="monthTitle">
      <div class="year">${year}</div>
      <div class="month">${month}</div>
    </div>

    <div class="calendar">
      <div class="weekdays">
        ${["Su","Mo","Tu","We","Th","Fr","Sa"].map(w=>`<div style="text-align:center">${w}</div>`).join("")}
      </div>

      <div class="grid">
        ${days.map(d=>{
          if(!d) return `<div></div>`;
          const k = keyForDate(d);
          const entry = data.entries[k];
          return `
            <button class="day ${isToday(d) ? "today":""}" data-date="${k}">
              <div class="num">${d.getDate()}</div>
              <div class="cup">${entry ? iconHTML(entry.icon,"iconSmall") : ""}</div>
            </button>
          `;
        }).join("")}
      </div>
    </div>

    <button class="fab" id="fab" aria-label="Add">+</button>
  `;

  document.getElementById("goBookmarks").onclick = () => { state.view="bookmarks"; render(); };
  document.getElementById("goSettings").onclick  = () => { state.view="settings"; render(); };

  document.getElementById("fab").onclick = () => {
    state.selectedDate = startOfDay(new Date());
    openForDate(state.selectedDate);
  };

  app.querySelectorAll(".day").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const d = dateFromKey(btn.dataset.date);
      state.selectedDate = startOfDay(d);
      openForDate(state.selectedDate);
    });
  });

  // month navigation by swipe (optional: very minimal)
  enableMonthSwipe();
}

function enableMonthSwipe(){
  let x0 = null;
  app.addEventListener("touchstart", (e)=>{ x0 = e.touches[0].clientX; }, {passive:true});
  app.addEventListener("touchend", (e)=>{
    if(x0 == null) return;
    const x1 = e.changedTouches[0].clientX;
    const dx = x1 - x0;
    x0 = null;
    if(Math.abs(dx) < 80) return;
    state.monthAnchor = new Date(state.monthAnchor.getFullYear(), state.monthAnchor.getMonth() + (dx < 0 ? 1 : -1), 1);
    render();
  }, {passive:true});
}

function renderBookmarks(){
  const left = `<button class="iconBtn" id="back" aria-label="Back">←</button>`;
  const favs = Object.values(data.entries).filter(e=>e.isFavorite).sort((a,b)=>dateFromKey(b.dateKey)-dateFromKey(a.dateKey));

  app.innerHTML = `
    ${topbarHTML({left, right:""})}
    <div class="monthTitle">
      <div class="month">Bookmarks</div>
    </div>

    <div class="list">
      ${favs.length === 0 ? `<div class="small" style="padding:10px 6px;">No bookmarks yet. Mark an entry as favorite ✦</div>` : ""}
      ${favs.map(e=>{
        const d = dateFromKey(e.dateKey);
        return `
          <div class="card" data-date="${e.dateKey}">
            ${iconHTML(e.icon,"iconCard")}
            <div class="meta">
              <div class="d">${shortDate(d)}</div>
              ${e.place ? `<div class="s">${escapeHTML(e.place)}</div>` : `<div class="s"> </div>`}
              ${e.note ? `<div class="n">${escapeHTML(e.note)}</div>` : ``}
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  document.getElementById("back").onclick = () => { state.view="calendar"; render(); };

  app.querySelectorAll(".card").forEach(card=>{
    card.addEventListener("click", ()=>{
      const d = dateFromKey(card.dataset.date);
      state.selectedDate = startOfDay(d);
      openEditorForDate(state.selectedDate);
    });
  });
}

function renderSettings(){
  const left = `<button class="iconBtn" id="back" aria-label="Back">←</button>`;
  const {year, month} = monthTitle(state.monthAnchor);

  app.innerHTML = `
    ${topbarHTML({left, right:""})}
    <div class="monthTitle">
      <div class="month">Settings</div>
    </div>

    <div class="settings">
      <div class="block">
        <div class="h">Backup</div>
        <button class="btn" id="exportJSON">Export JSON backup</button>
        <div style="height:8px"></div>
        <label class="btn" style="display:block; text-align:center; cursor:pointer;">
          Import JSON backup
          <input id="importJSON" type="file" accept="application/json" style="display:none;">
        </label>
        <div class="small" style="margin-top:10px;">
          Tip: this is all local-first. Back up occasionally if you care about the history.
        </div>
      </div>

      <div class="block">
        <div class="h">Export</div>
        <button class="btn" id="exportPoster">Export month poster (SVG)</button>
        <div class="small" style="margin-top:10px;">
          Month: <b>${month} ${year}</b>
        </div>
      </div>

      <div class="block">
        <div class="h">Danger zone</div>
        <button class="btn danger" id="clearAll">Clear all data</button>
      </div>

      <div class="block">
        <div class="h">About</div>
        <div class="small">
          Brew Journal is a tiny coffee calendar for personal use.<br/>
          Install: Safari → Share → <b>Add to Home Screen</b>.<br/>
          Offline: works after first load (service worker cache).
        </div>
      </div>
    </div>
  `;

  document.getElementById("back").onclick = () => { state.view="calendar"; render(); };

  document.getElementById("exportJSON").onclick = exportJSONBackup;
  document.getElementById("importJSON").onchange = importJSONBackup;

  document.getElementById("exportPoster").onclick = () => exportMonthPosterSVG(state.monthAnchor);

  document.getElementById("clearAll").onclick = () => {
    if(confirm("Clear all entries? This cannot be undone.")){
      data = { entries: {} };
      saveData(data);
      alert("Cleared.");
      render();
    }
  };
}

// ---------- Month grid ----------
function monthGrid(monthAnchor){
  const y = monthAnchor.getFullYear();
  const m = monthAnchor.getMonth();
  const first = new Date(y,m,1);
  const last  = new Date(y,m+1,0);
  const leading = first.getDay(); // 0=Sun
  const daysInMonth = last.getDate();

  const out = [];
  for(let i=0;i<leading;i++) out.push(null);
  for(let d=1; d<=daysInMonth; d++){
    out.push(new Date(y,m,d));
  }
  while(out.length % 7 !== 0) out.push(null);
  return out;
}

// ---------- Open flows ----------
function openForDate(date){
  const k = keyForDate(date);
  if(data.entries[k]) openEditorForDate(date);
  else openPicker(date);
}

function openPicker(date, options = {}){
  const k = keyForDate(date);
  openModal(`
    <div class="sheet">
      <div class="sheetHeader">
        <div class="mini"><button id="close">✕</button></div>
        <div class="title">Pick your today’s coffee</div>
        <div class="mini"><button id="info">i</button></div>
      </div>
      <div class="sheetBody">
        <div class="pickGrid">
          ${ICONS.map(id=>`
            <button class="pickBtn" data-icon="${id}">
              ${iconHTML(id,"iconPick")}
            </button>
          `).join("")}
        </div>
      </div>
    </div>
  `);

  document.getElementById("close").onclick = closeModal;
  document.getElementById("info").onclick = () => {
    alert("Tap an icon to pin it to the day.\nAdd a note if you want — or don’t.");
  };
  modalRoot.querySelectorAll(".pickBtn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const icon = btn.dataset.icon;
      openEditor(date, icon, options.keepDraft ?? null);
    });
  });
}

function openEditorForDate(date){
  const k = keyForDate(date);
  const e = data.entries[k];
  if(!e){ openPicker(date); return; }
  openEditor(date, e.icon, {
    note: e.note || "",
    place: e.place || "",
    isFavorite: !!e.isFavorite,
    photo: e.photo || null,
    existing: true
  });
}

function openEditor(date, icon, keepDraft){
  const k = keyForDate(date);
  const existing = data.entries[k];

  // draft defaults
  const draft = keepDraft || {
    note: existing?.note || "",
    place: existing?.place || "",
    isFavorite: !!existing?.isFavorite,
    photo: existing?.photo || null,
    existing: !!existing
  };

  openModal(`
    <div class="sheet">
      <div class="sheetHeader">
        <div class="mini"><button id="close">✕</button></div>
        <div class="title">${shortDate(date)}</div>
        <div class="mini"><button id="change" title="Change icon">↻</button></div>
      </div>
      <div class="sheetBody">
        <div style="display:flex; gap:14px; align-items:center;">
          <div>${iconHTML(icon,"iconBig")}</div>
          <div style="flex:1;">
            <div class="small">A small record is enough.</div>
            <div class="small" style="margin-top:4px; opacity:0.65;">(You can edit later.)</div>
          </div>
        </div>

        <div class="formRow" style="margin-top:14px;">
          <div class="label">Favorite</div>
          <div class="tog">
            <input id="fav" type="checkbox" ${draft.isFavorite ? "checked":""}/>
            <span class="small">bookmark this day</span>
          </div>
        </div>

        <div class="formRow">
          <div class="label">Place</div>
          <input id="place" class="input" placeholder="optional" value="${escapeAttr(draft.place)}"/>
        </div>

        <div class="formRow" style="align-items:flex-start;">
          <div class="label" style="padding-top:10px;">Note</div>
          <textarea id="note" placeholder="optional">${escapeHTML(draft.note)}</textarea>
        </div>

        <div class="formRow" style="align-items:center;">
          <div class="label">Photo</div>
          <input id="photo" type="file" accept="image/*" />
        </div>

        <div id="preview" class="${draft.photo ? "preview" : "hidden"}">
          ${draft.photo ? `<img src="${draft.photo}" alt="photo preview"/>` : ""}
        </div>

        <div class="actions">
          ${draft.existing ? `<button class="btn danger" id="del">Delete</button>` : `<button class="btn" id="cancel">Cancel</button>`}
          <button class="btn primary" id="save">Save</button>
        </div>

        <div class="small" style="margin-top:12px; opacity:0.65;">
          Photo is stored locally in your browser storage. For long-term safety, export a JSON backup.
        </div>
      </div>
    </div>
  `);

  document.getElementById("close").onclick = closeModal;
  const cancelBtn = document.getElementById("cancel");
  if(cancelBtn) cancelBtn.onclick = closeModal;

  document.getElementById("change").onclick = () => {
    const keep = {
      note: document.getElementById("note").value || "",
      place: document.getElementById("place").value || "",
      isFavorite: document.getElementById("fav").checked,
      photo: getPreviewPhoto(),
      existing: draft.existing
    };
    closeModal(false);
    openPicker(date, { keepDraft: keep });
  };

  const photoInput = document.getElementById("photo");
  photoInput.onchange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    const dataUrl = await compressImageToDataURL(file, 1080, 0.82);
    const prev = document.getElementById("preview");
    prev.classList.remove("hidden");
    prev.classList.add("preview");
    prev.innerHTML = `<img src="${dataUrl}" alt="photo preview"/>`;
  };

  const del = document.getElementById("del");
  if(del){
    del.onclick = () => {
      if(confirm("Delete this entry?")){
        delete data.entries[k];
        saveData(data);
        closeModal();
        render(); // refresh calendar
      }
    };
  }

  document.getElementById("save").onclick = () => {
    const note = (document.getElementById("note").value || "").trimEnd();
    const place = (document.getElementById("place").value || "").trim();
    const isFavorite = document.getElementById("fav").checked;
    const photo = getPreviewPhoto();

    data.entries[k] = {
      id: existing?.id || cryptoRandomId(),
      dateKey: k,
      icon,
      note,
      place: place || null,
      isFavorite,
      photo: photo || null
    };
    saveData(data);
    closeModal();
    render();
  };
}

function getPreviewPhoto(){
  const img = modalRoot.querySelector("#preview img");
  return img ? img.getAttribute("src") : null;
}

// ---------- Modal helpers ----------
function openModal(innerHTML){
  modalRoot.innerHTML = innerHTML;
  modalRoot.classList.remove("hidden");

  // click outside to close
  modalRoot.onclick = (e) => {
    if(e.target === modalRoot) closeModal();
  };

  // escape to close
  window.addEventListener("keydown", escCloseOnce);
}
function escCloseOnce(e){
  if(e.key === "Escape") closeModal();
}
function closeModal(rerender=true){
  modalRoot.classList.add("hidden");
  modalRoot.innerHTML = "";
  window.removeEventListener("keydown", escCloseOnce);
  if(rerender) render();
}

// ---------- Backup / import ----------
function exportJSONBackup(){
  const stamp = new Date();
  const name = `brewjournal-backup-${stamp.getFullYear()}${pad2(stamp.getMonth()+1)}${pad2(stamp.getDate())}.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
  downloadBlob(blob, name);
}
function importJSONBackup(ev){
  const file = ev.target.files && ev.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const parsed = JSON.parse(String(reader.result || ""));
      if(!parsed.entries) throw new Error("Invalid backup file.");
      data = { entries: parsed.entries };
      saveData(data);
      alert("Imported.");
      render();
    }catch(e){
      alert("Could not import: " + (e.message || "invalid file"));
    }
  };
  reader.readAsText(file);
}

// ---------- Month poster (SVG) ----------

// ---------- Month poster (SVG with embedded PNG icons) ----------
const ICON_DATA_URL = {};
async function getIconDataURL(id){
  if(ICON_DATA_URL[id]) return ICON_DATA_URL[id];
  const res = await fetch(`./icons/${id}.png`, {cache:"force-cache"});
  const blob = await res.blob();
  const dataUrl = await new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.readAsDataURL(blob);
  });
  ICON_DATA_URL[id] = dataUrl;
  return dataUrl;
}

async function exportMonthPosterSVG(monthAnchor){
  const svg = await generateMonthPosterSVG(monthAnchor);
  const {year, month} = monthTitle(monthAnchor);
  const name = `brewjournal-poster-${year}-${month.toLowerCase()}.svg`;
  const blob = new Blob([svg], {type:"image/svg+xml"});
  downloadBlob(blob, name);
}

async function generateMonthPosterSVG(monthAnchor){
  const grid = monthGrid(monthAnchor);
  const {year, month} = monthTitle(monthAnchor);

  // Collect icons used this month
  const used = new Set();
  for(const d of grid){
    if(!d) continue;
    const e = data.entries[keyForDate(d)];
    if(e && e.icon) used.add(e.icon);
  }
  const iconIds = [...used];
  const iconMap = {};
  await Promise.all(iconIds.map(async (id)=>{ iconMap[id] = await getIconDataURL(id); }));

  // Layout
  const W = 1080, H = 1350;
  const pad = 90;
  const cellW = (W - pad*2) / 7;
  const cellH = 120;
  const top = 260;

  const cells = [];
  for(let i=0;i<grid.length;i++){
    const d = grid[i];
    if(!d) continue;
    const k = keyForDate(d);
    const e = data.entries[k];
    if(!e) continue;

    const col = i % 7;
    const row = Math.floor(i / 7);
    const cx = pad + col*cellW + cellW/2;
    const cy = top + row*cellH + 44;

    const size = 64 * 0.86; // rendered px in poster
    const x = cx - size/2;
    const y = cy - size/2;

    const href = iconMap[e.icon] || `./icons/${e.icon}.png`;
    cells.push(`
      <image href="${href}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${size.toFixed(1)}" height="${size.toFixed(1)}"
             preserveAspectRatio="xMidYMid meet" />
      <text x="${cx.toFixed(1)}" y="${(top + row*cellH + 102).toFixed(1)}"
            text-anchor="middle" font-family="American Typewriter, Courier New, monospace"
            font-size="22" fill="#1E2630" opacity="0.55">${d.getDate()}</text>
    `);
  }

  const weekday = ["Su","Mo","Tu","We","Th","Fr","Sa"].map((w, i)=> {
    const x = pad + i*cellW + cellW/2;
    return `<text x="${x.toFixed(1)}" y="${(top-18).toFixed(1)}"
            text-anchor="middle" font-family="American Typewriter, Courier New, monospace"
            font-size="22" fill="#1E2630" opacity="0.55">${w}</text>`;
  }).join("
");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="100%" height="100%" fill="#FBF6EE"/>

  <text x="${W/2}" y="120" text-anchor="middle"
        font-family="American Typewriter, Courier New, monospace"
        font-size="44" fill="#1E2630" opacity="0.9">${year}</text>

  <text x="${W/2}" y="180" text-anchor="middle"
        font-family="American Typewriter, Courier New, monospace"
        font-size="56" fill="#1E2630">${month}</text>

  ${weekday}

  ${cells.join("
")}

  <text x="${W/2}" y="${H-80}" text-anchor="middle"
        font-family="American Typewriter, Courier New, monospace"
        font-size="18" fill="#1E2630" opacity="0.5">Brew Journal • a month, told in cups</text>
</svg>`;
}


// ---------- Utilities ----------
function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 500);
}

function escapeHTML(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll("\"","&quot;")
    .replaceAll("'","&#39;");
}
function escapeAttr(s){
  return escapeHTML(s).replaceAll("\n"," ");
}

function cryptoRandomId(){
  // simple id; good enough for personal use
  const a = new Uint8Array(16);
  (crypto || window.msCrypto).getRandomValues(a);
  return Array.from(a).map(x=>x.toString(16).padStart(2,"0")).join("");
}

// Compress image to DataURL (JPEG)
function compressImageToDataURL(file, maxDim=1080, quality=0.82){
  return new Promise((resolve, reject)=>{
    const img = new Image();
    img.onload = () => {
      const w = img.width, h = img.height;
      const scale = Math.min(1, maxDim / Math.max(w,h));
      const cw = Math.round(w*scale);
      const ch = Math.round(h*scale);

      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, cw, ch);
      try{
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      }catch(e){
        resolve(null);
      }
    };
    img.onerror = reject;
    const reader = new FileReader();
    reader.onload = () => { img.src = String(reader.result); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------- Start ----------
render();

// If user returns later, keep current month stable
window.addEventListener("focus", ()=>{ data = loadData(); render(); });
