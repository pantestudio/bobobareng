(function(){
"use strict";
const CFG = window.BOBO_CONFIG || {};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const rp=n=>"Rp "+Math.round(n||0).toLocaleString("id-ID");
const jt=n=>"Rp "+((n||0)/1e6).toFixed(1).replace(".",",")+" jt";
const yen=n=>"¥"+Math.round(n).toLocaleString("en-US");
const DAYC={1:"#D01A2E",2:"#F0D9A6",3:"#A5141F",4:"#C97B63"}, DAYFG={1:"#FBF8F1",2:"#1B1411",3:"#F0D9A6",4:"#1B1411"};
const TIER={kere:"Kere Hore",rame:"Rame-Rame",sultan:"Agak Sultan"}, BIKE={bawa:"Bawa",sewa:"Sewa",tbd:"Belum tau"}, STAT={in:"Ikut",maybe:"Mikir",out:"Skip"};
const CATC={Bobo:"#D01A2E",Sepeda:"#F0D9A6",Koper:"#1B1411",Transport:"#C97B63",Makan:"#E9B8A8",Tiket:"#E8A39B","Lain-lain":"#C7BBA8",Refund:"#5E5348"};
const photo=n=>"photos/"+n+".jpg";

/* ---------- local session ---------- */
const store={get(k){try{return localStorage.getItem(k)}catch(_){return null}},set(k,v){try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(_){}}};
const S={online:!!(CFG.url&&CFG.key),state:"loading",members:[],ledger:[],bookings:[],config:{},weather:{},
  wa:store.get("bobo.wa"),admin:store.get("bobo.admin"),day:1,mapFocus:0,spotType:"all",spotDay:0};
const me=()=>S.wa?S.members.find(m=>m.wa===S.wa):null;

/* ---------- Supabase REST (no library) ---------- */
const H=()=>({apikey:CFG.key,Authorization:"Bearer "+CFG.key});
async function api(path,opt){const r=await fetch(CFG.url+"/rest/v1/"+path,Object.assign({headers:Object.assign({"Content-Type":"application/json"},H())},opt||{}));
  const txt=await r.text();let body=null;try{body=txt?JSON.parse(txt):null}catch(_){body=txt}
  if(!r.ok){const e=new Error((body&&body.message)||("HTTP "+r.status));e.code=body&&body.message;throw e}return body}
const rpc=(fn,args)=>api("rpc/"+fn,{method:"POST",body:JSON.stringify(args)});
const admin=(action,payload)=>rpc("fn_admin",{p_code:S.admin,p_action:action,p_payload:payload||{}});
async function load(){
  const [m,l,b,c,w]=await Promise.all([api("members?select=*&order=created_at"),api("ledger?select=*&order=date.desc,created_at.desc"),api("bookings?select=*&order=date"),api("config?select=*&id=eq.1"),api("weather?select=*")]);
  S.members=m||[];S.ledger=l||[];S.bookings=b||[];S.config=(c&&c[0])||{};S.weather={};(w||[]).forEach(x=>S.weather["d"+x.day]=x);
  S.state="ok";S.lastSync=new Date();
}
async function refresh(){if(!S.online)return;try{await load()}catch(e){S.state=S.state==="ok"?"stale":"err";console.warn(e)}renderAll()}
async function shrink(file){ // compress photos to keep uploads small
  if(!file.type.startsWith("image/")||file.type==="image/gif")return file;
  try{const bmp=await createImageBitmap(file);const k=Math.min(1,1600/Math.max(bmp.width,bmp.height));const cv=document.createElement("canvas");cv.width=Math.round(bmp.width*k);cv.height=Math.round(bmp.height*k);
    cv.getContext("2d").drawImage(bmp,0,0,cv.width,cv.height);return await new Promise(res=>cv.toBlob(b=>res(b||file),"image/jpeg",.82))}catch(_){return file}}
async function upload(file,folder){
  const f=await shrink(file);const ext=f.type==="application/pdf"?"pdf":f.type==="image/png"?"png":"jpg";
  const path=folder+"/"+Date.now()+"-"+Math.random().toString(36).slice(2,8)+"."+ext;
  const r=await fetch(CFG.url+"/storage/v1/object/uploads/"+path,{method:"POST",headers:Object.assign({"Content-Type":f.type||"image/jpeg","x-upsert":"false"},H()),body:f});
  if(!r.ok)throw new Error("upload "+r.status);return path}
const fileUrl=p=>p?CFG.url+"/storage/v1/object/public/uploads/"+p:"";

let toastT;
function toast(m){const t=$("#toast");t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,2800)}
async function act(fn,okMsg){try{const r=await fn();await refresh();if(okMsg)toast(okMsg);return r}catch(e){
  const m=String(e.message||"");toast(m.includes("not_admin")?"Admin code is wrong.":m.includes("not_member")?"Log in first.":m.includes("wa_check")||m.includes("members_wa_check")?"Check the WhatsApp number.":m.includes("duplicate")?"That WhatsApp number is already used.":"Couldn't save. Check your connection and try again.");console.warn(e)}}

/* ---------- routing ---------- */
const VIEWS=["home","rute","crew","dompet","spots"];
function route(){let v=(location.hash||"#home").slice(1);if(!VIEWS.includes(v))v="home";
  VIEWS.forEach(x=>{$("#v-"+x).hidden=x!==v});
  $$(".tabs a").forEach(a=>{if(a.dataset.tab===v)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")});
  window.scrollTo(0,0)}
window.addEventListener("hashchange",route);

/* ---------- time ---------- */
function left(ms){if(ms<=0)return null;return {d:Math.floor(ms/864e5),h:Math.floor(ms%864e5/36e5),m:Math.floor(ms%36e5/6e4),s:Math.floor(ms%6e4/1e3)}}
function fmtDate(iso,opt){return new Date(iso).toLocaleDateString("en-GB",Object.assign({timeZone:"Asia/Makassar",day:"numeric",month:"short"},opt||{}))}
function tick(){const now=Date.now(),t=left(new Date(DATA.tripStart)-now);
  $("#cdTrip").innerHTML=t?`<div><b>${t.d}</b><span>days</span></div><div><b>${String(t.h).padStart(2,"0")}</b><span>hrs</span></div><div><b>${String(t.m).padStart(2,"0")}</b><span>min</span></div><div><b>${String(t.s).padStart(2,"0")}</b><span>sec</span></div>`:`<div><b>GO</b><span>gaskeun</span></div>`;
  const nx=DATA.milestones.find(m=>new Date(m.at)>now);
  if(nx){const l=left(new Date(nx.at)-now),el=$("#nmLeft");if(el)el.textContent=l.d>0?`${l.d}d ${l.h}h ${l.m}m left`:`${l.h}h ${l.m}m ${l.s}s left`}}

/* ---------- derived ---------- */
const crewList=()=>S.members.filter(c=>c.name);
const dpVerified=id=>S.ledger.some(t=>t.dp_of===id);
function dpState(c){if(dpVerified(c.id))return "ok";const p=c.proof;if(p&&p.status==="rejected")return "rej";if(p&&p.status!=="verified")return "wait";return "none"}
function tally(field,keys){const t={};keys.forEach(k=>t[k]=0);crewList().filter(c=>c.status==="in").forEach(c=>{if(c[field] in t)t[c[field]]++});return t}
const sum=(a,f)=>a.reduce((s,x)=>s+(+f(x)||0),0);
const nIn=()=>crewList().filter(c=>c.status==="in").length;
function topTier(){const best=Object.entries(tally("tier",["kere","rame","sultan"])).sort((a,b)=>b[1]-a[1])[0];return best&&best[1]>0?best[0]:"rame"}
function est(n,tier,bike){const k=Math.min(8,Math.max(3,n||6));return DATA.price[k][tier][bike==="sewa"?"sewa":"bawa"]*DATA.rate}
function poolPart(n,tier,bike){const k=Math.min(8,Math.max(3,n||6)),p=DATA.price[k][tier],buf=(1+DATA.cont)*(1+DATA.fee);
  return {pool:(p.stay+2150+(bike==="sewa"?23600:0))*buf*DATA.rate,pocket:(p.food+p.fun+4500+1500+(bike==="sewa"?6400:9500))*buf*DATA.rate}}
const dpAmount=()=>+S.config.dp||DATA.dp;

/* ---------- HOME ---------- */
function renderHome(){
  const now=Date.now(),nx=DATA.milestones.find(m=>new Date(m.at)>now),m=me();
  const cta=!S.online?`<a class="btn" href="#crew">How to join</a>`:!m?`<a class="btn" href="#crew">Join + DP now</a>`:dpState(m)==="ok"?`<span class="pill ok">You're confirmed ✓</span>`:`<a class="btn" href="#crew">Pay DP</a>`;
  $("#nextMs").innerHTML=nx?`<div class="pad"><span class="mono">Next · ${esc(fmtDate(nx.at,{weekday:"short"}))}</span><h3>${esc(nx.title)}</h3><div class="left tabular" id="nmLeft"></div><p>${esc(nx.text)}</p><div>${cta}</div></div>`:"";
  const n=nIn(),paid=crewList().filter(c=>dpVerified(c.id)).length,tier=topTier();
  $("#homeStats").innerHTML=`<div><b>${S.state==="ok"?n:"–"}</b><span>Ikut</span></div><div><b>${S.state==="ok"?paid:"–"}</b><span>DP confirmed</span></div><div><b>${jt(est(n||6,tier,"bawa")).replace("Rp ","")}</b><span>/ orang · ${n||6} ppl · ${TIER[tier]}</span></div>`;
  $("#announce").innerHTML=S.config.announce?`<div class="announce">${esc(S.config.announce)}</div>`:"";
  $("#msList").innerHTML=DATA.milestones.map(x=>{const t=new Date(x.at),st=t<now?"done":(x===nx?"now":"");
    return `<li class="${st}"><div class="d">${esc(fmtDate(x.at,{weekday:"short"}))}<br>${t.getFullYear()}</div><div><h4>${esc(x.title)}</h4><p>${esc(x.text)}</p></div>${st==="done"?'<span class="pill no">Done</span>':st==="now"?'<span class="pill ink">Now</span>':""}</li>`}).join("");
  $("#homeLadder").innerHTML=DATA.days.map(d=>`<a href="#rute" data-day="${d.n}"><span class="n" style="color:${d.n===2?"#1B1411":DAYC[d.n]}">0${d.n}</span><span><span class="t">${esc(d.title)}</span><br><span class="mono muted">${esc(d.dlabel)} · ${esc(d.level)}</span></span><span class="k">${d.km} KM<br>+${d.up} M</span></a>`).join("");
}

/* ---------- RUTE ---------- */
const bars=n=>`<span class="bars">${[1,2,3,4,5].map(i=>`<i class="${i<=n?"on":""}"></i>`).join("")}</span>`;
function renderDayChips(){$("#dayChips").innerHTML=[`<button class="chip" data-d="0" aria-pressed="${S.mapFocus===0}">All</button>`].concat(DATA.days.map(d=>`<button class="chip" data-d="${d.n}" aria-pressed="${S.mapFocus===d.n}">Day ${d.n} · ${esc(d.dlabel)}</button>`)).join("")}
function focusMap(d){S.mapFocus=d;const m=$("#map");m.classList.toggle("focus",d>0);
  m.querySelectorAll(".rt").forEach(g=>g.classList.toggle("on",+g.dataset.day===d));
  m.querySelectorAll(".stop,.slab").forEach(g=>g.classList.toggle("off",d>0&&+g.dataset.day!==d));renderDayChips()}
function wxFor(d){const w=S.weather["d"+d.n];return w&&w.hi!=null?Object.assign({live:true,where:d.weather.where},w):Object.assign({live:false},d.weather)}
const climbBox=c=>`<div class="climb"><div class="h">Key climb · ${esc(c.name)}</div><div><span>Length</span><b>${esc(c.len)}</b></div><div><span>Avg</span><b>${esc(c.avg)}</b></div><div><span>Max</span><b>${esc(c.max)}</b></div><div><span>Top</span><b>${esc(c.top)}</b></div></div>`;
function renderDay(){
  const d=DATA.days.find(x=>x.n===S.day),col=DAYC[d.n],fg=DAYFG[d.n],w=wxFor(d);
  const spots=DATA.spots.filter(s=>s.day===d.n).slice(0,4),ins=DATA.inspo.filter(s=>s.day===d.n);
  $("#dayPanel").innerHTML=`
  <div class="dayhead"><div class="n" style="color:${d.n===2?"#1B1411":col}">0${d.n}</div><div><span class="mono">${esc(d.dlabel)} 2027</span><h2>${esc(d.title)}</h2></div></div>
  <div class="strip" style="background:${col};color:${fg}"><div><span>Level</span><b class="lv">${esc(d.level)}</b></div><div><span>Jarak</span><b>${d.km}<small style="font:700 12px var(--mono)"> KM</small></b></div><div><span>Nanjak</span><b>+${d.up}<small style="font:700 12px var(--mono)"> M</small></b></div></div>
  <div class="meters"><div><span class="mono">Capek ${d.capek}/5</span>${bars(d.capek)}</div><div><span class="mono">Seru ${d.seru}/5</span>${bars(d.seru)}</div></div>
  <p class="hook">${esc(d.hook)}</p>
  <div class="dphoto"><img src="${photo(d.photo)}" alt="${esc(d.title)}" loading="lazy"><span class="tag">Day ${d.n} vibe</span></div>
  ${d.climb?climbBox(d.climb):""}
  <div class="sub"><span>Elevation (approx) · km</span><span>Max grade ${esc(d.maxg)}</span></div>
  <div class="elev">${DATA.elev[d.n]}</div>
  <p class="note" style="margin-top:6px">Road: ${esc(d.surface)}</p>
  <div class="sub"><span>Weather · ${esc(w.where)}</span><span>${w.live?"Updated "+esc(w.updated||""):"Seasonal normal"}</span></div>
  <div class="wx"><b class="tabular">${w.hi}°/${w.lo}°</b><p>${w.live?esc(w.summary||""):`Early April normals. ~${w.rain}% chance of some rain. Pack a thin shell + arm warmers. The live forecast shows here closer to the trip.`}</p></div>
  <div class="sub"><span>Jadwal (simulated)</span><span>Sunrise ~05:45 · sunset ~18:25</span></div>
  <div class="sched"><ol>${d.sched.map(s=>`<li><span class="tm">${esc(s[0])}</span><span><b>${esc(s[1])}</b>${s[2]?`<span>${esc(s[2])}</span>`:""}</span></li>`).join("")}</ol></div>
  <div class="sub"><span>Spots this day</span><a href="#spots" data-spotday="${d.n}">All spots →</a></div>
  <div class="cards">${spots.map(spotCard).join("")}</div>
  ${ins.length?`<div class="sub"><span>Watch + read</span></div><div class="cards">${ins.map(inspoCard).join("")}</div>`:""}
  <div class="dnav">${d.n>1?`<button class="btn ghost small" data-goday="${d.n-1}">← Day ${d.n-1}</button>`:"<span></span>"}${d.n<4?`<button class="btn small" data-goday="${d.n+1}">Day ${d.n+1} →</button>`:""}</div>`;
}
function setDay(n){S.day=n;renderDay();focusMap(n)}
function openStop(id){const s=DATA.stops.find(x=>x.id===id);if(!s)return;const d=DATA.days.find(x=>x.n===s.day),near=DATA.spots.filter(x=>x.day===s.day).slice(0,2);
  openSheet(`Day ${s.day} · ${s.kind}`,`${s.photo?`<div class="dphoto" style="margin-top:0"><img src="${photo(s.photo)}" alt=""></div>`:""}
   <h3 class="disp" style="font-size:34px;margin-top:12px">${esc(s.name)}</h3><p class="hook" style="font-size:18px;margin-top:8px">${esc(s.note)}</p>
   ${s.kind==="climb"&&d.climb?climbBox(d.climb):""}
   <div class="strip" style="background:${DAYC[s.day]};color:${DAYFG[s.day]}"><div><span>Day ${s.day}</span><b class="lv">${esc(d.title)}</b></div><div><span>Day km</span><b>${d.km}</b></div><div><span>Capek</span><b>${d.capek}/5</b></div></div>
   <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px"><a class="btn" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.name.split(" ·")[0]+" Japan")}" target="_blank" rel="noopener">Open in Maps</a><button class="btn ghost" data-goday="${s.day}" data-close="1">See Day ${s.day}</button></div>
   ${near.length?`<div class="sub"><span>Nearby spots</span></div><div class="cards">${near.map(spotCard).join("")}</div>`:""}`)}

/* ---------- SPOTS ---------- */
const TYPES=[["all","All"],["makan","Makan"],["ngopi","Ngopi"],["onsen","Onsen"],["liat","Liat"],["media","Video + IG"]];
const spotCard=s=>`<a class="card t-${s.type}" href="${esc(s.url)}" target="_blank" rel="noopener"><div class="top2"><span>${esc(s.type)}</span><span>Day ${s.day}</span></div><div class="bd"><h4>${esc(s.name)}</h4><p>${esc(s.why)}</p><span class="pr">${esc(s.price)} · Maps ↗</span></div></a>`;
const inspoCard=s=>`<a class="card t-${s.type}" href="${esc(s.url)}" target="_blank" rel="noopener"><div class="top2"><span>${{video:"YouTube",ig:"Instagram",read:"Read"}[s.type]}</span><span>Day ${s.day}</span></div><div class="bd"><h4>${esc(s.title)}</h4><p>${esc(s.src)}</p><span class="pr">Open ↗</span></div></a>`;
function renderSpots(){
  $("#spotType").innerHTML=TYPES.map(([k,l])=>`<button class="chip" data-st="${k}" aria-pressed="${S.spotType===k}">${l}</button>`).join("");
  $("#spotDay").innerHTML=[0,1,2,3,4].map(n=>`<button class="chip" data-sd="${n}" aria-pressed="${S.spotDay===n}">${n?"Day "+n:"All days"}</button>`).join("");
  let h="";if(S.spotType!=="media")h+=DATA.spots.filter(s=>(S.spotType==="all"||s.type===S.spotType)&&(!S.spotDay||s.day===S.spotDay)).map(spotCard).join("");
  if(S.spotType==="all"||S.spotType==="media")h+=DATA.inspo.filter(s=>!S.spotDay||s.day===S.spotDay).map(inspoCard).join("");
  $("#spotCards").innerHTML=h||`<div class="empty">Nothing here for that filter.</div>`}

/* ---------- CREW ---------- */
function normWa(v){let d=String(v||"").replace(/\D/g,"");if(d.startsWith("0"))d="62"+d.slice(1);if(d.startsWith("8"))d="62"+d;return d}
function prettyWa(d){d=String(d||"");return d?"+"+d.slice(0,2)+" "+d.slice(2).replace(/(\d{3,4})(?=\d)/g,"$1 ").trim():""}
function setVal(id,v){const el=document.getElementById(id);if(el&&document.activeElement!==el&&!el.dataset.dirty)el.value=v??""}
function segSet(id,v){$$("#"+id+" button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.v===v)))}
function flightFlags(c){const out=[],fi=c.fin||{},fo=c.fout||{};
  if(fi.date)out.push(fi.date<"2027-04-04"||(fi.date==="2027-04-04"&&(!fi.time||fi.time<="09:30"))?`<span class="okc">Arr ✓</span>`:`<span class="warn">Arr late</span>`);
  if(fo.date)out.push(fo.date>"2027-04-07"||(fo.date==="2027-04-07"&&(!fo.time||fo.time>="18:30"))?`<span class="okc">Dep ✓</span>`:`<span class="warn">Dep early</span>`);
  return out.join(" ")}
function dpPill(c){const s=dpState(c);return s==="ok"?'<span class="pill ok">DP ✓</span>':s==="wait"?'<span class="pill wait">DP pending</span>':s==="rej"?'<span class="pill no">DP rejected</span>':'<span class="pill no">No DP</span>'}
function renderCrew(){
  const list=crewList(),m=me();
  $("#crewCount").textContent=S.state==="ok"?`${nIn()} ikut · ${list.length} total`:"";
  $("#crewGate").innerHTML=!S.online?`<div class="box pad"><h3 class="disp" style="font-size:26px">Not connected yet</h3><p class="note" style="margin-top:8px">The organiser still needs to add the database keys to config.js. Everything else on this page works.</p></div>`
    :S.state==="loading"?`<div class="empty">Loading crew…</div>`:S.state==="err"?`<div class="empty">Can't reach the server. Check your connection, then pull to refresh.</div>`:"";
  $("#regBox").hidden=!(S.online&&S.state!=="loading"&&!m);
  $("#meBox").hidden=!m;
  if(m){$("#meName").textContent=m.name;$("#meWa").textContent=prettyWa(m.wa);
    setVal("pfName",m.name);setVal("pfWa","0"+String(m.wa).slice(2));
    segSet("segStatus",m.status);segSet("segTier",m.tier);segSet("segBike",m.bike);
    const fi=m.fin||{},fo=m.fout||{};setVal("fiNo",fi.no);setVal("fiFrom",fi.from);setVal("fiDate",fi.date||"2027-04-04");setVal("fiTime",fi.time);
    setVal("foNo",fo.no);setVal("foTo",fo.to);setVal("foDate",fo.date||"2027-04-07");setVal("foTime",fo.time);setVal("flStatus",m.fl_status||"none");
    $("#dpPill").innerHTML=dpPill(m);const st=dpState(m);$("#proofForm").hidden=st==="ok";
    $("#proofNote").textContent=st==="wait"?"Proof received. Waiting for verification.":st==="rej"?"Your proof couldn't be matched. Upload a clearer screenshot or WhatsApp the organiser.":"";
    const wa=S.config.admin_wa;$("#qrisBtn").hidden=!wa;
    if(wa)$("#qrisBtn").href=`https://wa.me/${wa}?text=${encodeURIComponent(`Halo George, minta QRIS DP Bobo Bareng Jepang ${rp(dpAmount())} a/n ${m.name} 🙏`)}`;
  }
  $("#dpAmt").textContent=rp(dpAmount());
  $("#bankName").textContent=S.config.bank_name||"BCA";$("#bankAcct").textContent=S.config.bank_acct||"8400064491";$("#bankHolder").textContent=S.config.bank_holder||"George Widodo";
  const tl=(o,lab)=>{const mx=Math.max(1,...Object.values(o));return Object.entries(o).map(([k,v])=>`<div class="r"><span>${lab[k]}</span><span class="b"><i style="width:${v/mx*100}%"></i></span><span>${v}</span></div>`).join("")};
  $("#tallyTier").innerHTML=tl(tally("tier",["kere","rame","sultan"]),TIER);$("#tallyBike").innerHTML=tl(tally("bike",["bawa","sewa","tbd"]),BIKE);
  const isA=!!S.admin;
  $("#crewList").innerHTML=list.length?list.map(c=>{const fi=c.fin||{},fo=c.fout||{};
    return `<div class="member"><div class="av" style="background:${c.status==="in"?"#F0D9A6":c.status==="maybe"?"#E9B8A8":"#F3EEE4"}">${esc((c.name||"?").trim().charAt(0).toUpperCase())}</div><div style="min-width:0"><h4>${esc(c.name)}${m&&c.id===m.id?' <span class="mono muted">· you</span>':""}</h4>
    <button class="wa" data-copy="${esc(prettyWa(c.wa))}" style="background:none;border:0;padding:0;cursor:pointer">${esc(prettyWa(c.wa))}</button> <a class="mono muted" href="https://wa.me/${esc(c.wa)}" target="_blank" rel="noopener">WA ↗</a>
    <div class="row"><span class="pill ${c.status==="in"?"ok":c.status==="maybe"?"wait":"no"}">${STAT[c.status]||"–"}</span>${dpPill(c)}${c.tier?`<span class="pill">${TIER[c.tier]}</span>`:""}${c.bike?`<span class="pill">${BIKE[c.bike]}</span>`:""}</div>
    <div class="fl">✈ ${fi.no?esc(fi.no)+" "+esc(fi.from||"")+" → KIX "+esc(fi.date||"")+" "+esc(fi.time||""):"Arrival: –"}<br>✈ ${fo.no?"KIX → "+esc(fo.to||"")+" "+esc(fo.no)+" "+esc(fo.date||"")+" "+esc(fo.time||""):"Departure: –"}<br>${c.fl_status==="booked"?'<span class="okc">Booked</span>':c.fl_status==="hold"?'<span class="warn">Looking</span>':'<span class="muted">Not booked</span>'} ${flightFlags(c)}</div>
    ${isA?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">${dpState(c)!=="ok"?`<button class="btn small" data-markpaid="${esc(c.id)}">Mark DP paid</button>`:""}<button class="btn small ghost" data-delmember="${esc(c.id)}">Remove</button></div>`:""}</div></div>`}).join("")
    :`<div class="empty">${S.online?"Nobody yet. Be the first: join above.":"Crew list shows here once the app is connected."}</div>`;
  $("#adminBox").hidden=!isA;$("#adminLogin").hidden=isA||!S.online;
  const seen=store.get("bobo.seen")||"",newJ=isA?list.filter(c=>String(c.created_at||"")>seen):[];
  if(isA){const pc=list.filter(c=>dpState(c)==="wait").length,noDp=list.filter(c=>c.status==="in"&&dpState(c)!=="ok"&&dpState(c)!=="wait").length,noFl=list.filter(c=>c.status==="in"&&c.fl_status!=="booked").length;
    const row=(n,t)=>`<li><span class="n ${n?"":"z"}">${n}</span>${t}</li>`;
    $("#adminTodo").innerHTML=`<h3 class="disp" style="font-size:24px">Cek ini dulu · Your to-do</h3><ul style="list-style:none;margin:0;padding:0">${row(newJ.length,"new people joined since you last looked"+(newJ.length?": "+newJ.map(c=>esc(c.name)).join(", "):""))}${row(pc,"DP proofs waiting for you to verify (below)")}${row(noDp,"people who said Ikut but haven't paid DP yet")}${row(noFl,"people who said Ikut but haven't booked a flight")}</ul>${newJ.length?'<button class="btn small ghost" id="seenBtn" type="button" style="margin-top:8px">Got it, mark as seen</button>':'<p class="note" style="margin:8px 0 0">Nothing is sent to you automatically. Open the app to see this list.</p>'}`;
    const sb=$("#seenBtn");if(sb)sb.onclick=()=>{const mx=list.reduce((x,c)=>String(c.created_at||"")>x?String(c.created_at):x,"");store.set("bobo.seen",mx);renderAll()};}
  {const cl=document.querySelector('.tabs a[data-tab="crew"]');if(cl){let b=cl.querySelector(".badge");const cnt=isA?list.filter(c=>dpState(c)==="wait").length+newJ.length:0;if(cnt){if(!b){b=document.createElement("span");b.className="badge";cl.appendChild(b)}b.textContent=cnt}else if(b)b.remove()}}
  $("#gate-steps").hidden=!!m||isA;
  if(isA){const pend=list.filter(c=>dpState(c)==="wait");
    $("#pending").innerHTML=pend.length?pend.map(c=>`<div class="proof"><a href="${esc(fileUrl(c.proof.path))}" target="_blank" rel="noopener"><img src="${esc(fileUrl(c.proof.path))}" alt="Proof from ${esc(c.name)}"></a><div><b>${esc(c.name)}</b><div class="mono">${rp(c.proof.amount)} · ${esc(String(c.proof.at||"").slice(0,10))}</div><div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><button class="btn small" data-verify="${esc(c.id)}">Verify</button><button class="btn small ghost" data-reject="${esc(c.id)}">Reject</button></div></div></div>`).join(""):`<p class="note" style="color:var(--ink);margin-top:8px">No pending proofs.</p>`}
}

/* ---------- WALLET ---------- */
function renderWallet(){
  const L=S.ledger,ins=sum(L.filter(t=>t.kind==="in"),t=>t.amount),outs=sum(L.filter(t=>t.kind==="out"),t=>t.amount),saldo=ins-outs;
  const unpaid=sum(S.bookings.filter(b=>b.status!=="paid"),b=>b.cost);
  const crew=crewList().filter(c=>c.status==="in"),n=crew.length,tier=topTier();
  const target=sum(crew,c=>poolPart(n,tier,c.bike==="sewa"?"sewa":"bawa").pool);
  $("#wSaldo").textContent=rp(saldo);$("#wProg").style.width=(target?Math.min(100,ins/target*100):0)+"%";
  $("#wProgTxt").textContent=target?`${rp(ins)} collected of ${rp(target)} pool target (${n} ikut · ${TIER[tier]})`:"Pool target appears once people opt in.";
  $("#wGrid").innerHTML=`<div><span>Money in</span><b class="tabular">${rp(ins)}</b></div><div><span>Spent</span><b class="tabular">${rp(outs)}</b></div><div><span>Still to pay (bookings)</span><b class="tabular">${rp(unpaid)}</b></div><div><span>${saldo-unpaid<0?"Still to collect":"Left after bookings"}</span><b class="tabular" style="color:${saldo-unpaid<0?"var(--bad)":"inherit"}">${rp(Math.abs(saldo-unpaid))}</b></div>`;
  const byCat={};L.filter(t=>t.kind==="out").forEach(t=>byCat[t.cat||"Lain-lain"]=(byCat[t.cat||"Lain-lain"]||0)+(+t.amount||0));const tot=Object.values(byCat).reduce((a,b)=>a+b,0);
  $("#wCat").innerHTML=tot?Object.entries(byCat).map(([k,v])=>`<i title="${esc(k)}" style="width:${v/tot*100}%;background:${CATC[k]||"#C7BBA8"}"></i>`).join(""):"";
  $("#wCatLeg").innerHTML=tot?Object.entries(byCat).map(([k,v])=>`<span><i style="background:${CATC[k]||"#C7BBA8"}"></i>${esc(k)} ${jt(v)}</span>`).join(""):`<span class="muted">Nothing spent yet.</span>`;
  const m=me(),isA=!!S.admin;
  $("#wTx").innerHTML=L.length?L.map(t=>`<li><div><b>${esc(t.label)}</b><div class="mono muted">${esc(t.cat||"")} · ${esc(t.date||"")}${t.by_name?" · by "+esc(t.by_name):""}${t.receipt?` · <a href="${esc(fileUrl(t.receipt))}" target="_blank" rel="noopener">Receipt ↗</a>`:""}</div>${isA?`<button class="mine" data-deltx="${esc(t.id)}">Delete</button>`:m&&t.member_id===m.id&&t.kind==="out"&&!t.dp_of?`<button class="mine" data-delmine="${esc(t.id)}">Delete mine</button>`:""}</div><div class="amt ${t.kind==="in"?"in":""}">${t.kind==="in"?"+":"−"}${rp(t.amount)}</div></li>`).join("")
    :`<li style="display:block"><div class="empty">No money yet. Verified DPs, booking payments and crew expenses will be listed here.</div></li>`;
  $("#bkList").innerHTML=S.bookings.length?S.bookings.map(b=>`<li><div><b>${esc(b.title)}</b><div class="note">${esc(b.detail||"")}</div><div class="mono muted">${esc(b.cat||"")} · ${esc(b.date||"")}${b.link?` · <a href="${esc(b.link)}" target="_blank" rel="noopener">Link ↗</a>`:""}</div></div><div style="text-align:right"><span class="pill ${b.status==="paid"?"ok":b.status==="booked"?"wait":"no"}">${esc(b.status||"planned")}</span><div class="mono" style="margin-top:6px">${b.cost?rp(b.cost):"–"}</div>${b.estimate&&b.status==="planned"?'<div class="mono muted">estimate</div>':""}</div></li>`).join("")
    :`<li style="display:block"><div class="empty">Stays, bikes and luggage bookings appear here once made.</div></li>`;
  $("#expBox").hidden=!m;$("#txAdmin").hidden=!isA;$("#bkAdmin").hidden=!isA;$("#setAdmin").hidden=!isA;
  if(isA){const sel=$("#bkPick"),cur=sel.value;sel.innerHTML=`<option value="">+ New booking</option>`+S.bookings.map(b=>`<option value="${esc(b.id)}">${esc(b.title)}</option>`).join("");sel.value=cur;
    setVal("setWa",S.config.admin_wa?"0"+String(S.config.admin_wa).slice(2):"");setVal("setDp",S.config.dp);setVal("setBankName",S.config.bank_name);setVal("setAcct",S.config.bank_acct);setVal("setHolder",S.config.bank_holder);setVal("setAnn",S.config.announce)}
  renderCalc();
}
const C={n:6,tier:"rame",bike:"bawa"};
function renderCalc(){$("#cNv").textContent=C.n;const tot=est(C.n,C.tier,C.bike),sp=poolPart(C.n,C.tier,C.bike),p=DATA.price[C.n][C.tier];
  $("#cTot").textContent=jt(tot);
  $("#cSplit").innerHTML=`<div><span>Masuk kas (pool)</span><b class="tabular">${jt(sp.pool)}</b><p class="note">Bobo 3 malem${C.bike==="sewa"?", bike rental":""}, luggage. DP counts here.</p></div><div><span>Uang saku (yours)</span><b class="tabular">${jt(sp.pocket)}</b><p class="note">Food, trains, tickets, onsen, eSIM${C.bike==="bawa"?", bike box + rinko bag":""}.</p></div>`;
  $("#cWhy").innerHTML=`Bobo for 3 nights: ${yen(p.stay)} per person. Planned at <b>¥1 = Rp ${DATA.rate}</b> (today ~Rp ${DATA.rateNow}) + ${Math.round(DATA.cont*100)}% cadangan + ${Math.round(DATA.fee*100)}% transfer fees, priced for 2027 sakura peak. No markup. Leftover pool money is refunded evenly. Flights not included.`}

/* ---------- sheet + search ---------- */
function openSheet(k,html){$("#sheetKicker").textContent=k;$("#sheetBody").innerHTML=html;$("#sheet").hidden=false;$("#scrim").hidden=false;$("#sheet").scrollTop=0;$("#sheetClose").focus()}
function closeSheet(){$("#sheet").hidden=true;$("#scrim").hidden=true}
function index(){const r=[],go=(h,f)=>()=>{location.hash=h;if(f)f()};
  DATA.days.forEach(d=>r.push({k:"Day "+d.n,t:d.title,s:d.dlabel+" · "+d.km+" km · "+d.level,go:go("#rute",()=>setDay(d.n))}));
  DATA.stops.forEach(s=>r.push({k:"Stop · D"+s.day,t:s.name,s:s.note,go:go("#rute",()=>{setDay(s.day);openStop(s.id)})}));
  DATA.days.forEach(d=>d.sched.forEach(x=>r.push({k:"Jadwal · D"+d.n,t:x[0]+" "+x[1],s:x[2],go:go("#rute",()=>setDay(d.n))})));
  DATA.spots.forEach(s=>r.push({k:s.type+" · D"+s.day,t:s.name,s:s.why+" "+s.price,url:s.url}));
  DATA.inspo.forEach(s=>r.push({k:s.type+" · D"+s.day,t:s.title,s:s.src,url:s.url}));
  DATA.milestones.forEach(m=>r.push({k:"Deadline",t:m.title,s:fmtDate(m.at,{weekday:"short",year:"numeric"})+" · "+m.text,go:go("#home")}));
  crewList().forEach(c=>r.push({k:"Crew",t:c.name,s:(STAT[c.status]||"")+" · "+prettyWa(c.wa)+((c.fin&&c.fin.no)?" · "+c.fin.no:""),go:go("#crew")}));
  S.bookings.forEach(b=>r.push({k:"Booking",t:b.title,s:(b.status||"")+" · "+(b.detail||""),go:go("#dompet")}));
  S.ledger.forEach(t=>r.push({k:"Dompet",t:t.label,s:rp(t.amount)+" · "+(t.date||"")+(t.by_name?" · "+t.by_name:""),go:go("#dompet")}));
  [["Kere Hore","Hostel / capsule level","#dompet"],["Rame-Rame","Whole house split by crew","#dompet"],["Agak Sultan","Hotel + ryokan onsen","#dompet"],["DP · transfer BCA / QRIS","Pay in the Crew tab","#crew"],["Flights","Add yours in the Crew tab","#crew"],["Log expense","Dompet tab","#dompet"]].forEach(([t,s,h])=>r.push({k:"Info",t,s,go:go(h)}));
  return r}
let IDX=[];
function doSearch(){const q=$("#q").value.trim().toLowerCase(),out=q?IDX.filter(x=>(x.t+" "+x.s+" "+x.k).toLowerCase().includes(q)).slice(0,40):[];
  $("#qRes").innerHTML=q?(out.length?out.map(x=>`<a href="${x.url?esc(x.url):"#"}" ${x.url?'target="_blank" rel="noopener"':""} data-ri="${IDX.indexOf(x)}"><span class="k">${esc(x.k)}</span><span><b>${esc(x.t)}</b><span>${esc(x.s)}</span></span></a>`).join(""):`<p class="empty" style="margin-top:16px">No match for “${esc(q)}”. Try “onsen”, “ramen”, “Kuragari” or a name.</p>`)
    :`<p class="note" style="margin-top:16px">Try: onsen · mochi · Kuragari · Day 3 · DP · a crew name</p>`}

/* ---------- actions ---------- */
const upMe=patch=>rpc("fn_update_me",{p_wa:S.wa,p_patch:patch});
const num=v=>+String(v||"").replace(/\D/g,"")||0;
function copy(text,label){(navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(text):Promise.reject()).then(()=>toast((label||"Copied")+": "+text),()=>toast(text))}
function clean(ids){ids.forEach(i=>{const el=document.getElementById(i);if(el)delete el.dataset.dirty})}

function bind(){
  document.addEventListener("click",e=>{
    const t=e.target.closest("[data-goday],[data-d],[data-day],[data-st],[data-sd],[data-spotday],[data-copy],[data-verify],[data-reject],[data-markpaid],[data-delmember],[data-deltx],[data-delmine],[data-ri],.stop,.rt-hit");
    if(!t)return;
    if(t.dataset.ri!==undefined){const x=IDX[+t.dataset.ri];$("#search").hidden=true;if(x&&x.go){e.preventDefault();x.go()}return}
    if(t.classList.contains("stop")){openStop(t.dataset.stop);return}
    if(t.classList.contains("rt-hit")){setDay(+t.dataset.day);$("#dayPanel").scrollIntoView({behavior:"smooth",block:"start"});return}
    if(t.dataset.goday){if(t.dataset.close)closeSheet();setDay(+t.dataset.goday);$("#dayPanel").scrollIntoView({behavior:"smooth",block:"start"});return}
    if(t.dataset.d!==undefined&&t.closest("#dayChips")){const n=+t.dataset.d;focusMap(n);if(n)setDay(n);return}
    if(t.dataset.day&&t.closest("#homeLadder")){setDay(+t.dataset.day);return}
    if(t.dataset.st){S.spotType=t.dataset.st;renderSpots();return}
    if(t.dataset.sd!==undefined){S.spotDay=+t.dataset.sd;renderSpots();return}
    if(t.dataset.spotday){S.spotDay=+t.dataset.spotday;S.spotType="all";renderSpots();return}
    if(t.dataset.copy){copy(t.dataset.copy,"Number copied");return}
    if(t.dataset.verify){t.disabled=true;act(()=>admin("verify_dp",{member_id:t.dataset.verify}),"Verified. Added to the wallet.");return}
    if(t.dataset.reject){act(()=>admin("reject_dp",{member_id:t.dataset.reject}),"Marked as rejected.");return}
    if(t.dataset.markpaid){t.disabled=true;act(()=>admin("mark_dp_paid",{member_id:t.dataset.markpaid,amount:dpAmount()}),"DP marked paid.");return}
    if(t.dataset.delmember){if(t.dataset.armed){act(()=>admin("member_delete",{id:t.dataset.delmember}),"Removed.")}else{t.dataset.armed="1";t.textContent="Tap again to remove"}return}
    if(t.dataset.deltx){if(t.dataset.armed){act(()=>admin("ledger_delete",{id:t.dataset.deltx}),"Deleted.")}else{t.dataset.armed="1";t.textContent="Tap again to delete"}return}
    if(t.dataset.delmine){if(t.dataset.armed){act(()=>rpc("fn_delete_expense",{p_wa:S.wa,p_id:t.dataset.delmine}),"Deleted.")}else{t.dataset.armed="1";t.textContent="Tap again to delete"}return}
  });
  $("#map").addEventListener("keydown",e=>{const s=e.target.closest(".stop");if(s&&(e.key==="Enter"||e.key===" ")){e.preventDefault();openStop(s.dataset.stop)}});
  $("#sheetClose").onclick=closeSheet;$("#scrim").onclick=closeSheet;
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeSheet();$("#search").hidden=true}});
  $("#btnSearch").onclick=()=>{IDX=index();$("#search").hidden=false;$("#q").value="";doSearch();setTimeout(()=>$("#q").focus(),30)};
  $("#qClose").onclick=()=>$("#search").hidden=true;$("#q").oninput=doSearch;
  $("#zoomBtn").onclick=()=>{const w=$("#mapwrap");w.classList.toggle("zoom");$("#zoomBtn").textContent=w.classList.contains("zoom")?"Zoom −":"Zoom +"};
  $$("input,textarea,select").forEach(el=>el.addEventListener("input",()=>el.dataset.dirty="1"));

  $("#regForm").addEventListener("submit",e=>{e.preventDefault();const name=$("#regName").value.trim(),wa=normWa($("#regWa").value);
    if(wa.length<10||wa.length>15){toast("Check the WhatsApp number");return}
    act(async()=>{const r=await rpc("fn_login",{p_name:name,p_wa:wa});S.wa=r.wa;store.set("bobo.wa",r.wa);return r},"Masuk! Next: vote + DP")});
  $("#logoutBtn").onclick=()=>{S.wa=null;store.set("bobo.wa",null);renderAll();toast("Logged out")};
  $("#editProfileBtn").onclick=()=>{$("#profileForm").hidden=!$("#profileForm").hidden};
  $("#profileForm").addEventListener("submit",e=>{e.preventDefault();const name=$("#pfName").value.trim(),wa=normWa($("#pfWa").value);if(name.length<2||wa.length<10){toast("Check name and number");return}
    clean(["pfName","pfWa"]);$("#profileForm").hidden=true;
    act(async()=>{const r=await upMe({name,wa});S.wa=r.wa;store.set("bobo.wa",r.wa)},"Saved")});
  [["segStatus","status"],["segTier","tier"],["segBike","bike"]].forEach(([id,f])=>$("#"+id).addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;segSet(id,b.dataset.v);act(()=>upMe({[f]:b.dataset.v}),"Saved")}));
  $("#copyAmt").onclick=()=>copy(String(dpAmount()),"Amount copied");
  $("#copyAcct").onclick=()=>copy(S.config.bank_acct||"8400064491","Account copied");
  $("#proofBtn").onclick=async()=>{const f=$("#proofFile").files[0];if(!f){toast("Pick the screenshot first");return}
    $("#proofBtn").disabled=true;$("#proofNote").textContent="Uploading…";
    try{const path=await upload(f,"dp");await act(()=>rpc("fn_submit_proof",{p_wa:S.wa,p_path:path}),"Proof sent. Pending verification.")}
    catch(_){toast("Upload failed. Try a smaller screenshot or WhatsApp it to George.");$("#proofNote").textContent=""}
    finally{$("#proofBtn").disabled=false;$("#proofFile").value=""}};
  $("#flightForm").addEventListener("submit",e=>{e.preventDefault();const g=i=>document.getElementById(i).value.trim();
    clean(["fiNo","fiFrom","fiDate","fiTime","foNo","foTo","foDate","foTime","flStatus"]);
    act(()=>upMe({fin:{no:g("fiNo").toUpperCase(),from:g("fiFrom").toUpperCase(),date:g("fiDate"),time:g("fiTime")},fout:{no:g("foNo").toUpperCase(),to:g("foTo").toUpperCase(),date:g("foDate"),time:g("foTime")},fl_status:g("flStatus")}),"Flights saved")});

  const today=()=>new Date().toISOString().slice(0,10);
  $("#exDate").value=today();$("#txDate").value=today();
  $("#expForm").addEventListener("submit",async e=>{e.preventDefault();const amt=num($("#exAmt").value);if(!amt){toast("Add an amount");return}
    const btn=e.submitter||$("#expForm button");btn.disabled=true;let receipt=null;const f=$("#exFile").files[0];
    try{if(f)receipt=await upload(f,"receipts")}catch(_){toast("Receipt upload failed; saving without it")}
    await act(()=>rpc("fn_add_expense",{p_wa:S.wa,p_amount:amt,p_label:$("#exLabel").value.trim(),p_cat:$("#exCat").value,p_date:$("#exDate").value||null,p_receipt:receipt}),"Expense logged");
    $("#expForm").reset();$("#exDate").value=today();btn.disabled=false});
  $("#txForm").addEventListener("submit",async e=>{e.preventDefault();const amt=num($("#txAmt").value);if(!amt){toast("Add an amount");return}
    let receipt=null;const f=$("#txFile").files[0];try{if(f)receipt=await upload(f,"receipts")}catch(_){toast("Receipt upload failed; saving without it")}
    await act(()=>admin("ledger_add",{kind:$("#txKind").value,cat:$("#txCat").value,label:$("#txLabel").value.trim(),amount:amt,date:$("#txDate").value,receipt}),"Added to the wallet");
    $("#txForm").reset();$("#txDate").value=today()});
  $("#bkPick").onchange=()=>{const b=S.bookings.find(x=>x.id===$("#bkPick").value)||{};clean(["bkTitle","bkDetail","bkCost","bkDate","bkLink"]);
    $("#bkTitle").value=b.title||"";$("#bkDetail").value=b.detail||"";$("#bkCat").value=b.cat||"Bobo";$("#bkStatus").value=b.status||"planned";$("#bkCost").value=b.cost||"";$("#bkDate").value=b.date||"";$("#bkLink").value=b.link||""};
  $("#bkForm").addEventListener("submit",e=>{e.preventDefault();
    act(()=>admin("booking_upsert",{id:$("#bkPick").value,title:$("#bkTitle").value.trim(),detail:$("#bkDetail").value.trim(),cat:$("#bkCat").value,status:$("#bkStatus").value,cost:num($("#bkCost").value),date:$("#bkDate").value,link:$("#bkLink").value.trim(),estimate:$("#bkStatus").value==="planned"}),"Booking saved")});
  $("#setForm").addEventListener("submit",e=>{e.preventDefault();clean(["setWa","setDp","setBankName","setAcct","setHolder","setAnn"]);
    act(()=>admin("config_set",{admin_wa:normWa($("#setWa").value),dp:num($("#setDp").value)||dpAmount(),bank_name:$("#setBankName").value.trim(),bank_acct:$("#setAcct").value.replace(/\D/g,""),bank_holder:$("#setHolder").value.trim(),announce:$("#setAnn").value.trim()}),"Settings saved")});
  $("#adminForm").addEventListener("submit",async e=>{e.preventDefault();const code=$("#adminCode").value.trim();
    try{await rpc("fn_admin",{p_code:code,p_action:"check",p_payload:{}});S.admin=code;store.set("bobo.admin",code);$("#adminCode").value="";renderAll();toast("Admin mode on")}catch(_){toast("Admin code is wrong.")}});
  $("#adminOut").onclick=()=>{S.admin=null;store.set("bobo.admin",null);renderAll();toast("Admin mode off")};

  $("#cN").oninput=()=>{C.n=+$("#cN").value;renderCalc()};
  $("#cTier").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;C.tier=b.dataset.v;segSet("cTier",C.tier);renderCalc()});
  $("#cBike").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;C.bike=b.dataset.v;segSet("cBike",C.bike);renderCalc()});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh()});
}

function renderAll(){renderHome();renderCrew();renderWallet();renderDay();const m=me();$("#meChip").textContent=m?m.name.split(" ")[0]:"JOIN"}

route();bind();renderDayChips();renderDay();renderSpots();
if(!S.online)S.state="off";
renderAll();tick();setInterval(tick,1000);
if(S.online){refresh();setInterval(()=>{if(!document.hidden)refresh()},20000)}
})();
