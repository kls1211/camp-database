let DATA = [];
let FILTERED = [];
let currentPage = 1;
const pageSize = 20;

document.addEventListener("DOMContentLoaded", async () => {
  const prefSel = document.getElementById("prefecture");
  prefSel.innerHTML = '<option value="">指定なし</option>' + (window.PREFS||[]).map(p=>`<option value="${p}">${p}</option>`).join("");

  const tempSelect = document.getElementById("tempValue");
  const temps = Array.from({length: 51}, (_,i)=> i-10); // -10..40
  tempSelect.innerHTML = '<option value="">指定なし</option>' + temps.map(t=>`<option value="${t}">${t}</option>`).join("");

  await loadDefaultData();

  document.getElementById("type").addEventListener("change", onTypeChange);
  document.getElementById("searchBtn").addEventListener("click", ()=> { runSearch(1, true); document.getElementById("searchBtn").classList.add('searched'); });
  document.getElementById("resetBtn").addEventListener("click", ()=>{ resetFilters(); const b=document.getElementById('resetBtn'); b.classList.add('active'); setTimeout(()=>b.classList.remove('active'), 400); });
  document.querySelectorAll(".tag-check").forEach(cb=> cb.addEventListener("change", ()=> runSearch(1)));
  document.getElementById("jsonInput").addEventListener("change", onJsonImport);
  document.getElementById("csvInput").addEventListener("change", onCsvImport);

  runSearch(1, true);
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
  runSearch(1);
}

function resetFilters(){
  document.getElementById("prefecture").value = "";
  document.getElementById("area").value = "";
  document.getElementById("tempMonth").value = "";
  document.getElementById("tempValue").value = "";
  document.getElementById("tempOp").value = "";
  document.getElementById("type").value = "";
  const freeParking = document.getElementById("freeParking");
  freeParking.value = "";
  freeParking.disabled = true;
  document.querySelectorAll(".tag-check").forEach(cb=> cb.checked = false);
  document.getElementById("searchBtn").classList.remove('searched');
  runSearch(1, true);
}

function getSelectedTags(){
  return Array.from(document.querySelectorAll(".tag-check:checked")).map(el=>el.value);
}

function runSearch(page=1, reset=false){
  if (reset){
    FILTERED = [];
  }
  currentPage = page;

  const prefecture = document.getElementById("prefecture").value;
  const area = document.getElementById("area").value.trim();
  const tempMonth = document.getElementById("tempMonth").value;
  const tempStr = document.getElementById("tempValue").value;
  const tempOp = document.getElementById("tempOp").value;
  const type = document.getElementById("type").value;
  const freeParking = document.getElementById("freeParking").value;
  const tags = getSelectedTags();

  FILTERED = DATA.filter(site => {
    const pref = site.prefecture || (site.location ? site.location.slice(0,3) : "");
    const region = site.area || site.location || "";

    if (prefecture && pref !== prefecture) return false;

    if (area){
      const hay = `${region}${site.name||""}`;
      if (!hay.includes(area)) return false;
    }

    if (tempStr !== ""){
      const targetMonth = tempMonth || "";
      let v = null;
      if (site.monthly_avg && targetMonth){
        v = Number(site.monthly_avg[String(targetMonth)]);
      }else if (!targetMonth && typeof site.avg_temp !== "undefined"){
        v = Number(site.avg_temp);
      }
      if (v===null || Number.isNaN(v)) return false;

      const t = Number(tempStr);
      if (tempOp === "gte" && !(v >= t)) return false;
      if (tempOp === "lt" && !(v < t)) return false;
      if (tempOp === "" && v !== t) return false;
    }

    if (type && site.type !== type) return false;

    if (type === "フリー" && freeParking){
      if ((site.free_parking || "") !== freeParking) return false;
    }

    if (tags.length){
      const stags = Array.isArray(site.tags) ? site.tags : parseTags(site.tags);
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

function parseTags(x){
  if (Array.isArray(x)) return x;
  if (typeof x === "string") return x.split(";").map(s=>s.trim()).filter(Boolean);
  return [];
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
    const tags = parseTags(site.tags).map(t=>`<span class="badge">${t}</span>`).join(" ");
    const freeNote = site.type === "フリー" && site.free_parking ? `（${site.free_parking}）` : "";
    const pref = site.prefecture || "";
    const region = site.area || site.location || "";
    card.innerHTML = `
      <h3>${escapeHtml(site.name || "")}</h3>
      <div class="meta">都道府県：${escapeHtml(pref)}</div>
      <div class="meta">地域名：${escapeHtml(region)}</div>
      <div class="meta">サイトタイプ：${escapeHtml(site.type || "")}${freeNote}</div>
      ${renderTemp(site)}
      <div class="badges">${tags}</div>
      <div class="links">
        ${site.website ? `<a href="${site.website}" target="_blank" rel="noopener">公式サイト</a>` : ""}
        ${site.map ? `<a href="${site.map}" target="_blank" rel="noopener">Google Map</a>` : ""}
      </div>
    `;
    list.appendChild(card);
  }
}

function renderTemp(site){
  const m = document.getElementById("tempMonth").value;
  if (m && site.monthly_avg && site.monthly_avg[String(m)]!=null){
    return `<div class="meta">気温（月平均 ${m}月）：${Number(site.monthly_avg[String(m)])}℃</div>`;
  }else if (typeof site.avg_temp !== "undefined"){
    return `<div class="meta">平均気温：${Number(site.avg_temp)}℃</div>`;
  }
  return "";
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
  return s.replace(/[&<>'"]/g, function(c){
    const map = {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'};
    return map[c];
  });
}

/* --- Importers --- */
async function onJsonImport(evt){
  const file = evt.target.files[0];
  if (!file) return;
  try{
    const text = await file.text();
    const arr = JSON.parse(text);
    if (!Array.isArray(arr)) throw new Error("JSONの最上位は配列にしてください。");
    DATA = normalizeRecords(arr);
    runSearch(1, true);
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
    const hasLocation = idx("location") !== -1;
    const hasPrefArea = idx("prefecture") !== -1 && idx("area") !== -1;
    if (!hasLocation && !hasPrefArea) throw new Error("CSVヘッダに prefecture+area もしくは location が必要です。");

    const required = ["name","type","avg_temp","free_parking","tags","website","map"];
    for (const r of required){
      if (idx(r) === -1) throw new Error("CSVヘッダに " + r + " が必要です。");
    }

    const arr = rows.map(line => {
      const cols = parseCsvLine(line, header.length);
      const prefecture = hasPrefArea ? cols[idx("prefecture")] : "";
      const area = hasPrefArea ? cols[idx("area")] : "";
      const location = hasLocation ? cols[idx("location")] : "";
      return {
        name: cols[idx("name")],
        prefecture,
        area,
        location,
        type: cols[idx("type")],
        avg_temp: Number(cols[idx("avg_temp")]),
        free_parking: cols[idx("free_parking")] || "",
        tags: (cols[idx("tags")] || "").split(";").map(s=>s.trim()).filter(Boolean),
        website: cols[idx("website")] || "",
        map: cols[idx("map")] || ""
      };
    });
    DATA = normalizeRecords(arr);
    runSearch(1, true);
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
  return arr.map(x=> {
    const pref = x.prefecture || (x.location ? x.location.slice(0,3) : "");
    const area = x.area || "";
    const monthly = x.monthly_avg || null;
    return {
      name: x.name || "",
      prefecture: pref,
      area: area || x.location || "",
      type: x.type || "",
      avg_temp: Number(x.avg_temp) || 0,
      monthly_avg: monthly,
      free_parking: x.free_parking || "",
      tags: Array.isArray(x.tags) ? x.tags : (typeof x.tags === "string" ? x.tags.split(";").map(s=>s.trim()).filter(Boolean) : []),
      website: x.website || "",
      map: x.map || ""
    };
  });
}
