let DATA = [];
let FILTERED = [];
let currentPage = 1;
const pageSize = 20;

document.addEventListener("DOMContentLoaded", async () => {
  const tempSelect = document.getElementById("tempValue");
  const temps = Array.from({length: 51}, (_,i)=> i-10); // -10..40
  tempSelect.innerHTML = '<option value="">指定なし</option>' + temps.map(t=>`<option value="${t}">${t}</option>`).join("");

  await loadDefaultData();

  document.getElementById("type").addEventListener("change", onTypeChange);
  document.getElementById("searchBtn").addEventListener("click", runSearch);
  document.querySelectorAll(".tag-check").forEach(cb=> cb.addEventListener("change", runSearch));
  document.getElementById("jsonInput").addEventListener("change", onJsonImport);
  document.getElementById("csvInput").addEventListener("change", onCsvImport);

  runSearch();
});

async function loadDefaultData(){
  try{
    const res = await fetch("data/campsites.json");
    DATA = await res.json();
  }catch(e){
    console.error(e);
    DATA = [];
  }
}

function onTypeChange(){
  const type = document.getElementById("type").value;
  const freeParking = document.getElementById("freeParking");
  freeParking.disabled = (type !== "フリー");
  if (freeParking.disabled) freeParking.value = "";
  runSearch();
}

function getSelectedTags(){
  return Array.from(document.querySelectorAll(".tag-check:checked")).map(el=>el.value);
}

function runSearch(page=1){
  currentPage = page;
  const location = document.getElementById("location").value.trim();
  const tempStr = document.getElementById("tempValue").value;
  const tempOp = document.getElementById("tempOp").value;
  const type = document.getElementById("type").value;
  const freeParking = document.getElementById("freeParking").value;
  const tags = getSelectedTags();

  FILTERED = DATA.filter(site => {
    if (location && !(`${site.location||""}${site.name||""}`.includes(location))) return false;

    if (tempStr !== ""){
      const t = Number(tempStr);
      const v = Number(site.avg_temp);
      if (tempOp === "gte" && !(v >= t)) return false;
      if (tempOp === "lt" && !(v < t)) return false;
      if (tempOp === ""){
        if (v !== t) return false;
      }
    }

    if (type && site.type !== type) return false;

    if (type === "フリー" && freeParking){
      if ((site.free_parking || "") !== freeParking) return false;
    }

    if (tags.length){
      const stags = Array.isArray(site.tags) ? site.tags : [];
      for (const tg of tags){
        if (!stags.includes(tg)) return false;
      }
    }

    return true;
  });

  renderSummary();
  renderResults();
  renderPagination();
}

function renderSummary(){
  const sum = document.getElementById("summary");
  sum.textContent = `該当件数：${FILTERED.length} 件`;
}

function renderResults(){
  const list = document.getElementById("results");
  list.innerHTML = "";
  const start = (currentPage-1) * pageSize;
  const end = start + pageSize;
  const pageItems = FILTERED.slice(start, end);

  if (!pageItems.length){
    list.innerHTML = '<p>該当するキャンプ場が見つかりませんでした。</p>';
    return;
  }

  for (const site of pageItems){
    const card = document.createElement("div");
    card.className = "card";
    const tags = (site.tags||[]).map(t=>`<span class="badge">${t}</span>`).join(" ");
    const freeNote = site.type === "フリー" && site.free_parking ? `（${site.free_parking}）` : "";
    card.innerHTML = `
      <h3>${escapeHtml(site.name || "")}</h3>
      <div class="meta">場所：${escapeHtml(site.location || "")}</div>
      <div class="meta">形態：${escapeHtml(site.type || "")}${freeNote}</div>
      <div class="meta">平均気温：${Number(site.avg_temp) || "-"}℃</div>
      <div class="badges">${tags}</div>
      <div class="links">
        ${site.website ? `<a href="${site.website}" target="_blank" rel="noopener">公式サイト</a>` : ""}
        ${site.map ? `<a href="${site.map}" target="_blank" rel="noopener">Google Map</a>` : ""}
      </div>
    `;
    list.appendChild(card);
  }
}

function renderPagination(){
  const nav = document.getElementById("pagination");
  nav.innerHTML = "";
  const total = FILTERED.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const info = document.createElement("div");
  info.className = "page-info";
  info.textContent = `${currentPage} / ${totalPages} ページ`;
  const prev = document.createElement("button");
  prev.className = "page-btn";
  prev.textContent = "前へ";
  prev.disabled = currentPage <= 1;
  prev.addEventListener("click", ()=> runSearch(currentPage-1));

  const next = document.createElement("button");
  next.className = "page-btn";
  next.textContent = "次へ";
  next.disabled = currentPage >= totalPages;
  next.addEventListener("click", ()=> runSearch(currentPage+1));

  nav.appendChild(prev);
  nav.appendChild(info);
  nav.appendChild(next);
}

function escapeHtml(s){
  return s.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

async function onJsonImport(evt){
  const file = evt.target.files[0];
  if (!file) return;
  try{
    const text = await file.text();
    const arr = JSON.parse(text);
    if (!Array.isArray(arr)) throw new Error("JSONの最上位は配列にしてください。");
    DATA = normalizeRecords(arr);
    runSearch(1);
    alert("JSONを読み込みました（" + DATA.length + " 件）。");
  }catch(e){
    alert("JSON読み込みエラー: " + e.message);
    console.error(e);
  }finally{
    evt.target.value = "";
  }
}

async function onCsvImport(evt){
  const file = evt.target.files[0];
  if (!file) return;
  try{
    const text = await file.text();
    const rows = text.split(/\r?\n/).filter(r=>r.trim().length>0);
    const header = rows.shift().split(",");
    const idx = (name)=> header.indexOf(name);
    const required = ["name","location","type","avg_temp","free_parking","tags","website","map"];
    for (const r of required){
      if (idx(r) === -1) throw new Error("CSVヘッダに " + r + " が必要です。");
    }
    const arr = rows.map(line => {
      const cols = parseCsvLine(line, header.length);
      return {
        name: cols[idx("name")],
        location: cols[idx("location")],
        type: cols[idx("type")],
        avg_temp: Number(cols[idx("avg_temp")]),
        free_parking: cols[idx("free_parking")] || "",
        tags: (cols[idx("tags")] || "").split(";").map(s=>s.trim()).filter(Boolean),
        website: cols[idx("website")] || "",
        map: cols[idx("map")] || ""
      };
    });
    DATA = normalizeRecords(arr);
    runSearch(1);
    alert("CSVを読み込みました（" + DATA.length + " 件）。");
  }catch(e){
    alert("CSV読み込みエラー: " + e.message);
    console.error(e);
  }finally{
    evt.target.value = "";
  }
}

function parseCsvLine(line, expectedCols){
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i=0;i<line.length;i++){
    const ch = line[i];
    if (ch === '"'){
      if (inQ && line[i+1] === '"'){ cur += '"'; i++; }
      else inQ = !inQ;
    }else if (ch === ',' && !inQ){
      out.push(cur); cur = "";
    }else{
      cur += ch;
    }
  }
  out.push(cur);
  while (out.length < expectedCols) out.push("");
  return out;
}

function normalizeRecords(arr){
  return arr.map(x=> ({
    name: x.name || "",
    location: x.location || "",
    type: x.type || "",
    avg_temp: Number(x.avg_temp) || 0,
    free_parking: x.free_parking || "",
    tags: Array.isArray(x.tags) ? x.tags : (typeof x.tags === "string" ? x.tags.split(";").map(s=>s.trim()).filter(Boolean) : []),
    website: x.website || "",
    map: x.map || ""
  }));
}
