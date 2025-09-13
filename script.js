let DATA=[],FILTERED=[];let currentPage=1;const pageSize=20;
document.addEventListener("DOMContentLoaded", async()=>{
  const prefSel=document.getElementById("prefecture");
  prefSel.innerHTML='<option value="">指定なし</option>'+ (window.PREFS||[]).map(p=>`<option value="${p}">${p}</option>`).join("");
  const tempSelect=document.getElementById("tempValue");
  const temps=Array.from({length:51},(_,i)=>i-10); // -10..40
  tempSelect.innerHTML='<option value="">指定なし</option>'+ temps.map(t=>`<option value="${t}">${t}</option>`).join("");
  await loadDefaultData();
  document.getElementById("type").addEventListener("change", onTypeChange);
  document.getElementById("searchBtn").addEventListener("click",()=>{ runSearch(1,true); document.getElementById("searchBtn").classList.add("searched"); });
  document.getElementById("resetBtn").addEventListener("click",()=>{ resetFilters(); const b=document.getElementById("resetBtn"); b.classList.add("active"); setTimeout(()=>b.classList.remove("active"), 400); });
  document.querySelectorAll(".tag-check").forEach(cb=> cb.addEventListener("change",()=> runSearch(1)));
  document.getElementById("jsonInput").addEventListener("change", onJsonImport);
  document.getElementById("csvInput").addEventListener("change", onCsvImport);
  runSearch(1,true);
});
async function loadDefaultData(){
  try{ const res=await fetch("data/japan_campsites.json?v=311"); DATA=await res.json(); }catch(e){ DATA=[]; }
}
function onTypeChange(){
  const type=document.getElementById("type").value;
  const freeParking=document.getElementById("freeParking");
  freeParking.disabled=(type!=="フリー"); if(freeParking.disabled) freeParking.value="";
  runSearch(1);
}
function resetFilters(){
  document.getElementById("prefecture").value=""; document.getElementById("area").value="";
  document.getElementById("tempMonth").value=""; document.getElementById("tempValue").value=""; document.getElementById("tempOp").value="";
  document.getElementById("type").value=""; const fp=document.getElementById("freeParking"); fp.value=""; fp.disabled=true;
  document.querySelectorAll(".tag-check").forEach(cb=> cb.checked=false);
  document.getElementById("searchBtn").classList.remove("searched"); runSearch(1,true);
}
function getSelectedTags(){ return Array.from(document.querySelectorAll(".tag-check:checked")).map(el=>el.value); }
function numOrNull(x){ if(x===null||x===undefined||x==="") return null; const n=Number(x); return Number.isFinite(n)? n : null; }
function mean(arr){ if(!arr||!arr.length) return null; const s=arr.reduce((a,b)=>a+b,0); return s/arr.length; }
function runSearch(page=1,reset=false){
  if(reset){ FILTERED=[]; } currentPage=page;
  const prefecture=document.getElementById("prefecture").value;
  const area=document.getElementById("area").value.trim();
  const tempMonth=document.getElementById("tempMonth").value; // "" or "1".."12"
  const tempStr=document.getElementById("tempValue").value;   // "" or number-like string
  const tempOp=document.getElementById("tempOp").value;       // "", "gte", "lt"
  const type=document.getElementById("type").value;
  const freeParking=document.getElementById("freeParking").value;
  const tags=getSelectedTags();

  FILTERED=DATA.filter(site=>{
    const pref=site.prefecture||"";
    const region=site.area||site.location||"";
    if(prefecture && pref!==prefecture) return false;
    if(area){ const hay=`${region}${site.name||""}`; if(!hay.includes(area)) return false; }

    // --- Temperature filtering (robust) ---
    if(tempStr!==""){
      const t = Number(tempStr);
      if(!Number.isFinite(t)) return false;

      let v = null;
      const mm = tempMonth? String(tempMonth): "";
      // When a month is selected
      if(mm){
        if(site.monthly_avg){
          // accept string or numeric keys
          const keyVal = site.monthly_avg[mm] ?? site.monthly_avg[Number(mm)];
          v = numOrNull(keyVal);
        }
      }else{
        // No month: use avg_temp if present and numeric; otherwise compute from monthly_avg
        const at = numOrNull(site.avg_temp);
        if(at!==null) v = at;
        else if(site.monthly_avg){
          const arr = Object.values(site.monthly_avg).map(numOrNull).filter(x=>x!==null);
          v = mean(arr);
        }
      }
      if(v===null) return false;

      if(tempOp==="gte" && !(v>=t)) return false;
      if(tempOp==="lt" && !(v<t)) return false;
      if(tempOp==="" && Math.abs(v - t) > 1e-9) return false; // exact match
    }

    if(type && site.type!==type) return false;
    if(type==="フリー" && freeParking){ if((site.free_parking||"")!==freeParking) return false; }
    if(tags.length){
      const stags=Array.isArray(site.tags)?site.tags:parseTags(site.tags);
      for(const tg of tags){ if(!stags.includes(tg)) return false; }
    }
    return true;
  });
  renderSummary(); renderResults(); renderPagination();
}
function parseTags(x){ if(Array.isArray(x)) return x; if(typeof x==="string") return x.split(";").map(s=>s.trim()).filter(Boolean); return []; }
function renderSummary(){ document.getElementById("summary").textContent=`該当件数：${FILTERED.length} 件`; }
function renderResults(){
  const list=document.getElementById("results"); list.innerHTML="";
  const start=(currentPage-1)*pageSize; const end=start+pageSize; const pageItems=FILTERED.slice(start,end);
  if(!pageItems.length){ list.innerHTML='<p>該当するキャンプ場が見つかりませんでした。</p>'; return; }
  for(const site of pageItems){
    const card=document.createElement("div"); card.className="card";
    const tags=parseTags(site.tags).map(t=>`<span class="badge">${t}</span>`).join(" ");
    const freeNote=site.type==="フリー" && site.free_parking?`（${site.free_parking}）`:"";
    const pref=site.prefecture||"未設定";
    const region=site.area||site.location||"";
    card.innerHTML=`
      <h3>${escapeHtml(site.name||"")}</h3>
      <div class="meta">都道府県：${escapeHtml(pref)}</div>
      <div class="meta">地域名：${escapeHtml(region)}</div>
      <div class="meta">サイトタイプ：${escapeHtml(site.type||"")}${freeNote}</div>
      ${renderTemp(site)}
      <div class="badges">${tags}</div>
      <div class="links">
        ${site.website?`<a href="${site.website}" target="_blank" rel="noopener">公式サイト</a>`:""}
        ${site.map?`<a href="${site.map}" target="_blank" rel="noopener">Google Map</a>`:""}
      </div>`;
    list.appendChild(card);
  }
}
function renderTemp(site){
  const m=document.getElementById("tempMonth").value;
  if(m && site.monthly_avg){
    const val = site.monthly_avg[String(m)] ?? site.monthly_avg[Number(m)];
    if(val!==undefined && val!==null && !Number.isNaN(Number(val))){
      return `<div class="meta">気温（月平均 ${m}月）：${Number(val)}℃</div>`;
    }
  }else if(site.avg_temp!==undefined && site.avg_temp!==null){
    return `<div class="meta">平均気温：${Number(site.avg_temp)}℃</div>`;
  }
  return "";
}
function renderPagination(){
  const nav=document.getElementById("pagination"); nav.innerHTML="";
  const total=FILTERED.length; const totalPages=Math.max(1, Math.ceil(total/pageSize));
  const info=document.createElement("div"); info.className="page-info"; info.textContent=`${currentPage} / ${totalPages} ページ`;
  const prev=document.createElement("button"); prev.className="page-btn"; prev.textContent="前へ"; prev.disabled=currentPage<=1; prev.addEventListener("click",()=> runSearch(currentPage-1));
  const next=document.createElement("button"); next.className="page-btn"; next.textContent="次へ"; next.disabled=currentPage>=totalPages; next.addEventListener("click",()=> runSearch(currentPage+1));
  nav.appendChild(prev); nav.appendChild(info); nav.appendChild(next);
}
function escapeHtml(s){ return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
async function onJsonImport(evt){ const f=evt.target.files[0]; if(!f) return;
  try{ const text=await f.text(); const arr=JSON.parse(text); if(!Array.isArray(arr)) throw new Error("JSONの最上位は配列にしてください。"); DATA=normalizeRecords(arr); runSearch(1,true); alert("JSONを読み込みました（"+DATA.length+" 件）。"); }catch(e){ alert("JSON読み込みエラー: "+e.message); console.error(e); } finally{ evt.target.value=""; } }
async function onCsvImport(evt){ const f=evt.target.files[0]; if(!f) return;
  try{
    const text=await f.text(); const rows=text.split(/\r?\n/).filter(r=>r.trim().length>0); const header=rows.shift().split(",");
    const idx=name=> header.indexOf(name);
    const hasLocation=idx("location")!==-1; const hasPrefArea=idx("prefecture")!==-1 && idx("area")!==-1;
    if(!hasLocation && !hasPrefArea) throw new Error("CSVヘッダに prefecture+area もしくは location が必要です。");
    const required=["name","type","avg_temp","free_parking","tags","website","map"]; for(const r of required){ if(idx(r)===-1) throw new Error("CSVヘッダに "+r+" が必要です。"); }
    const hasMonthly=Array.from({length:12},(_,i)=> idx("m"+(i+1))!==-1).some(Boolean);
    const arr=rows.map(line=>{
      const cols=parseCsvLine(line, header.length); const prefecture=hasPrefArea? cols[idx("prefecture")]: ""; const area=hasPrefArea? cols[idx("area")]: ""; const location=hasLocation? cols[idx("location")]: "";
      let monthly=null; if(hasMonthly){ monthly={}; for(let k=1;k<=12;k++){ const id=idx("m"+k); if(id!==-1 && cols[id] !== "") monthly[String(k)]=Number(cols[id]); } }
      return { name: cols[idx("name")], prefecture, area, location, type: cols[idx("type")], avg_temp: (cols[idx("avg_temp")]!==""? Number(cols[idx("avg_temp")]): null), monthly_avg: monthly,
        free_parking: cols[idx("free_parking")]||"", tags: (cols[idx("tags")]||"").split(";").map(s=>s.trim()).filter(Boolean), website: cols[idx("website")]||"", map: cols[idx("map")]||"" };
    });
    DATA=normalizeRecords(arr); runSearch(1,true); alert("CSVを読み込みました（"+DATA.length+" 件）。");
  }catch(e){ alert("CSV読み込みエラー: "+e.message); console.error(e); } finally{ evt.target.value=""; } }
function parseCsvLine(line, n){ const out=[]; let cur=""; let inQ=false; for(let i=0;i<line.length;i++){ const ch=line[i];
  if(ch=='"'){ if(inQ && line[i+1]=='"'){ cur+='"'; i++; } else inQ=!inQ; } else if(ch==',' && !inQ){ out.push(cur); cur=""; } else { cur+=ch; } } out.push(cur); while(out.length<n) out.push(""); return out; }
function normalizeRecords(arr){
  return arr.map(x=>{ const pref=x.prefecture || (x.location? x.location.slice(0,3): ""); const area=x.area || ""; const monthly=x.monthly_avg || null;
    // Ensure numbers are numbers or null
    let avg = (x.avg_temp===null||x.avg_temp===undefined||x.avg_temp==="") ? null : Number(x.avg_temp);
    if(avg!==null && !Number.isFinite(avg)) avg=null;
    return { name:x.name||"", prefecture:pref, area: area || x.location || "", type:x.type||"", avg_temp: avg, monthly_avg: monthly, free_parking:x.free_parking||"",
      tags: Array.isArray(x.tags)? x.tags: (typeof x.tags==="string"? x.tags.split(";").map(s=>s.trim()).filter(Boolean): []), website:x.website||"", map:x.map||"" }; });
}