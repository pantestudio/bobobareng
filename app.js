(function(){
"use strict";
const CFG = window.BOBO_CONFIG || {};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const rp=n=>"Rp "+Math.round(n||0).toLocaleString("id-ID");
const jt=n=>"Rp "+((n||0)/1e6).toFixed(1).replace(".",",")+" jt";
const yen=n=>"¥"+Math.round(n).toLocaleString("en-US");
const DAYC={1:"#D01A2E",2:"#F0D9A6",3:"#A5141F",4:"#C97B63"}, DAYFG={1:"#FBF8F1",2:"#1B1411",3:"#F0D9A6",4:"#1B1411"};
const TIER={kere:"Kere Hore",rame:"Rame-Rame",sultan:"Agak Sultan"}, BIKE={bawa:"Bawa",sewa:"Sewa",tbd:"Belum tau"};
const TIERSUB={kere:"Hostel / capsule beds, convenience-store breakfasts",rame:"Whole house split by the crew, local food",sultan:"Hotels + one ryokan night with onsen, nicer dinners"};
const STAY={hostel:["Hostel / capsule","Cheapest, shared rooms"],house:["Shared house","Whole house for the crew"],hotel:["Hotel","Own room"],ryokan:["Ryokan + onsen","Japanese inn, hot bath"],any:["Terserah","Anything works"]};
const STAYSHORT={hostel:"Hostel",house:"House",hotel:"Hotel",ryokan:"Ryokan",any:"Terserah"};
const BIKEQ={bawa:["Bawa sendiri","Bring my own bike (bike box on the plane)"],sewa:["Sewa di Osaka","Rent a road bike there"],tbd:["Belum tau","Decide by January"]};
const BAGS={light:["Ringan","1 backpack or small bag"],mid:["Sedang","Plus 1 small suitcase or duffel"],heavy:["Banyak","Big suitcase"]};
const PARTY={solo:["Sendiri","Just me"],partner:["Sama pasangan","Bringing my partner"],family:["Sama keluarga / teman","Bringing family or friends"]};
const RIDERS={yes:"Yes, they ride",no:"No, jalan-jalan aja",mix:"Some of them"};
const FROM=["DPS · Bali","CGK · Jakarta","SUB · Surabaya","KNO · Medan","UPG · Makassar","SIN · Singapore","Other"];
const AIRLINES=["Garuda Indonesia","Singapore Airlines","Scoot","Cathay Pacific","AirAsia X","Batik Air","Malaysia Airlines","Thai Airways","Japan Airlines","ANA","Jetstar","Philippine Airlines","Belum tau"];
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
  const m=String(e.message||"");toast(m.includes("not_admin")?"Admin code is wrong.":m.includes("not_member")?"Log in first.":m.includes("wa_check")?"That WhatsApp number didn't work. Type it like 0812 3456 7890, or with the country code like +65 9123 4567.":m.includes("duplicate")?"That WhatsApp number is already used.":"Couldn't save. Check your connection and try again.");console.warn(e)}}

/* ---------- routing ---------- */
const VIEWS=["home","rute","crew","dompet","spots","admin"];
function route(){let v=(location.hash||"#home").slice(1);if(!VIEWS.includes(v))v="home";
  VIEWS.forEach(x=>{$("#v-"+x).hidden=x!==v});
  $$(".tabs a").forEach(a=>{if(a.dataset.tab===v)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")});
  window.scrollTo(0,0)}
window.addEventListener("hashchange",route);

/* ---------- time ---------- */
function left(ms){if(ms<=0)return null;return {d:Math.floor(ms/864e5),h:Math.floor(ms%864e5/36e5),m:Math.floor(ms%36e5/6e4),s:Math.floor(ms%6e4/1e3)}}
function fmtDate(iso,opt){return new Date(iso).toLocaleDateString("en-GB",Object.assign({timeZone:"Asia/Makassar",day:"numeric",month:"short"},opt||{}))}
function tick(){const now=Date.now(),nx=DATA.milestones.find(m=>new Date(m.at)>now),t=nx?left(new Date(nx.at)-now):null;
  $("#cdLabel").textContent=nx?nx.title+" · closes in":"Gaskeun";$("#cdWhen").textContent=nx?fmtDate(nx.at,{weekday:"short",year:"numeric"})+" · "+new Date(nx.at).toLocaleTimeString("en-GB",{timeZone:"Asia/Makassar",hour:"2-digit",minute:"2-digit"})+" WITA":"";
  $("#cdTrip").innerHTML=t?`<div><b>${t.d}</b><span>days</span></div><div><b>${String(t.h).padStart(2,"0")}</b><span>hrs</span></div><div><b>${String(t.m).padStart(2,"0")}</b><span>min</span></div><div><b>${String(t.s).padStart(2,"0")}</b><span>sec</span></div>`:`<div><b>GO</b><span>gaskeun</span></div>`;
  if(nx){const l=t,el=$("#nmLeft");if(el)el.textContent=l.d>0?`${l.d}d ${l.h}h ${l.m}m left`:`${l.h}h ${l.m}m ${l.s}s left`}}

/* ---------- derived ---------- */
const crewList=()=>S.members.filter(c=>c.name);
const dpVerified=id=>S.ledger.some(t=>t.dp_of===id);
function dpState(c){if(dpVerified(c.id))return "ok";const p=c.proof;if(p&&p.status==="rejected")return "rej";if(p&&p.status!=="verified")return "wait";return "none"}
function stage(c){if(c.status==="out")return "out";const d=dpState(c);return d==="ok"?"going":d==="wait"?"pending":"joined"}
const active=()=>crewList().filter(c=>c.status!=="out");
const sum=(a,f)=>a.reduce((s,x)=>s+(+f(x)||0),0);
const nIn=()=>active().length;
function topTier(){const t={kere:0,rame:0,sultan:0};active().forEach(c=>((c.prefs||{}).budget||[]).forEach(v=>{if(v in t)t[v]++}));const best=Object.entries(t).sort((a,b)=>b[1]-a[1])[0];return best[1]>0?best[0]:"rame"}
function est(n,tier,bike){const k=Math.min(8,Math.max(3,n||6));return DATA.price[k][tier][bike==="sewa"?"sewa":"bawa"]*DATA.rate}
function poolPart(n,tier,bike){const k=Math.min(8,Math.max(3,n||6)),p=DATA.price[k][tier],buf=(1+DATA.cont)*(1+DATA.fee);
  return {pool:(p.stay+2150+(bike==="sewa"?23600:0))*buf*DATA.rate,pocket:(p.food+p.fun+4500+1500+(bike==="sewa"?6400:9500))*buf*DATA.rate}}
const dpAmount=()=>+S.config.dp||DATA.dp;

/* ---------- HOME ---------- */
function renderHome(){
  const now=Date.now(),nx=DATA.milestones.find(m=>new Date(m.at)>now),m=me();
  const sg=m?stage(m):"";const cta=!S.online?`<a class="btn" href="#crew">How to join</a>`:!m?`<a class="btn" href="#crew">Join now · 2 min</a>`:sg==="going"?`<span class="pill ok">You're going ✓</span>`:sg==="pending"?`<span class="pill wait">DP sent · waiting for George</span>`:`<a class="btn" href="#crew">Pay the DP</a>`;
  $("#nextMs").innerHTML=nx?`<div class="pad"><span class="mono">Next · ${esc(fmtDate(nx.at,{weekday:"short"}))}</span><h3>${esc(nx.title)}</h3><div class="left tabular" id="nmLeft"></div><p>${esc(nx.text)}</p><div>${cta}</div></div>`:"";
  const n=nIn(),paid=active().filter(c=>stage(c)==="going").length,tier=topTier();
  $("#homeStats").innerHTML=`<div><b>${S.state==="ok"?n:"–"}</b><span>Joined</span></div><div><b>${S.state==="ok"?paid:"–"}</b><span>Going ✓</span></div><div><b>${jt(est(n||6,tier,"bawa")).replace("Rp ","")}</b><span>/ orang · ${n||6} ppl · ${TIER[tier]}</span></div>`;
  $("#announce").innerHTML=S.config.announce?`<div class="announce">${esc(S.config.announce)}</div>`:"";
  $("#msList").innerHTML=DATA.milestones.map(x=>{const t=new Date(x.at),st=t<now?"done":(x===nx?"now":"");
    return `<li class="${st}"><div class="d">${esc(fmtDate(x.at,{weekday:"short"}))}<br>${t.getFullYear()}</div><div><h4>${esc(x.title)}</h4><p>${esc(x.text)}</p></div>${st==="done"?'<span class="pill no">Done</span>':st==="now"?'<span class="pill ink">Now</span>':""}</li>`}).join("");
  $("#homeLadder").innerHTML=DATA.days.map(d=>`<a href="#rute" data-day="${d.n}"><span class="n" style="color:${d.n===2?"#1B1411":DAYC[d.n]}">0${d.n}</span><span><span class="t">${esc(d.title)}</span><br><span class="mono muted">${esc(d.dlabel)} · ${esc(d.level)}</span></span><span class="k">${d.km} KM<br>+${d.up} M</span></a>`).join("");
}

/* ---------- RUTE ---------- */
const bars=n=>`<span class="bars">${[1,2,3,4,5].map(i=>`<i class="${i<=n?"on":""}"></i>`).join("")}</span>`;
function renderDayChips(){$("#dayChips").innerHTML=[`<button class="chip" data-d="0" aria-pressed="${S.mapFocus===0}">All</button>`].concat(DATA.days.map(d=>`<button class="chip" data-d="${d.n}" aria-pressed="${S.mapFocus===d.n}">Day ${d.n}</button>`)).join("")}
function focusMap(d){S.mapFocus=d;const m=$("#map");m.classList.toggle("focus",d>0);
  m.querySelectorAll(".rt").forEach(g=>g.classList.toggle("on",+g.dataset.day===d));
  m.querySelectorAll(".stop,.slab").forEach(g=>g.classList.toggle("off",d>0&&+g.dataset.day!==d));renderDayChips()}
function wxFor(d){const w=S.weather["d"+d.n];return w&&w.hi!=null?Object.assign({live:true,where:d.weather.where},w):Object.assign({live:false},d.weather)}
const climbBox=c=>`<div class="climb"><div class="h">Key climb · ${esc(c.name)}</div><div><span>Length</span><b>${esc(c.len)}</b></div><div><span>Avg</span><b>${esc(c.avg)}</b></div><div><span>Max</span><b>${esc(c.max)}</b></div><div><span>Top</span><b>${esc(c.top)}</b></div></div>`;
function renderDay(){
  const d=DATA.days.find(x=>x.n===S.day),col=DAYC[d.n],fg=DAYFG[d.n],w=wxFor(d);
  const spots=DATA.spots.filter(s=>s.day===d.n).slice(0,4),ins=DATA.inspo.filter(s=>s.day===d.n);
  $("#dayPanel").innerHTML=`
  <div class="dayhead"><div class="n" style="color:${d.n===2?"#1B1411":col}">0${d.n}</div><div><span class="mono">Day ${d.n} · ${esc(d.dlabel)}</span><h2>${esc(d.title)}</h2></div></div>
  <div class="strip" style="background:${col};color:${fg}"><div><span>Level</span><b class="lv">${esc(d.level)}</b></div><div><span>Jarak</span><b>${d.km}<small style="font:700 12px var(--mono)"> KM</small></b></div><div><span>Nanjak</span><b>+${d.up}<small style="font:700 12px var(--mono)"> M</small></b></div></div>
  <div class="meters"><div><span class="mono">Capek ${d.capek}/5</span>${bars(d.capek)}</div><div><span class="mono">Seru ${d.seru}/5</span>${bars(d.seru)}</div></div>
  <p class="hook">${esc(d.hook)}</p>
  <div class="dphoto"><img src="${photo(d.photo)}" alt="${esc(d.title)}" loading="lazy"><span class="tag">Day ${d.n} vibe</span></div>
  ${d.climb?climbBox(d.climb):""}
  <div class="sub"><span>Elevation (approx) · km</span><span>Max grade ${esc(d.maxg)}</span></div>
  <div class="elev">${DATA.elev[d.n]}</div>
  <p class="note" style="margin-top:6px">Road: ${esc(d.surface)}</p>
  <div class="sub"><span>Weather · ${esc(w.where)}</span><span>${w.live?"Updated "+esc(w.updated||""):"Seasonal normal"}</span></div>
  <div class="wx"><b class="tabular">${w.hi}°/${w.lo}°</b><p>${w.live?esc(w.summary||""):`Typical for early April. If we go in mid-March, expect ~4–5° colder. ~${w.rain}% chance of some rain. Pack a thin shell, arm warmers and gloves. The real forecast shows here closer to the trip.`}</p></div>
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
const STAGE={joined:["Pending · DP not paid","no"],pending:["Pending · DP being checked","wait"],going:["Going ✓","ok"],out:["Not going","no"]};
const stagePill=c=>{const s=STAGE[stage(c)];return `<span class="pill ${s[1]}">${s[0]}</span>`};
const P=c=>c.prefs||{};
const dShort=id=>{const d=DATA.tripDates.find(x=>x.id===id);return d?d.label.replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun) /g,""):id};
const lab=(map,k)=>k&&map[k]?map[k][0]:"–";
function partyText(c){const p=P(c);if(!p.party)return "–";if(p.party==="solo")return "Alone";return PARTY[p.party][0]+" · +"+(p.extra||1)+" ("+(RIDERS[p.riders]||"?")+")"}

function qHTML(p){
  const opt=(type,name,v,b,sm)=>`<label><input type="${type}" name="${p}${name}" value="${esc(v)}"><span><b>${esc(b)}</b>${sm?`<small>${esc(sm)}</small>`:""}</span></label>`;
  return `<div class="field"><label for="${p}Name">Your name</label><input id="${p}Name" autocomplete="name" maxlength="40" placeholder="e.g. Om Budi"></div>
  <div class="field"><label for="${p}Wa">WhatsApp number</label><input id="${p}Wa" inputmode="tel" autocomplete="tel" placeholder="0812 3456 7890"></div>
  <fieldset class="q" data-q="dates"><legend>1 · Which dates work?<small>Pick all that work for you · 4 days, 3 nights</small></legend><div class="opts">${DATA.tripDates.map(d=>opt("checkbox","Dates",d.id,d.label,d.sub)).join("")}</div></fieldset>
  <fieldset class="q" data-q="budget"><legend>2 · Budget you're OK with<small>Pick all · per person, in Japan, flights not included</small></legend><div class="opts">${["kere","rame","sultan"].map(t=>opt("checkbox","Budget",t,TIER[t]+" · ± "+jt(est(6,t,"bawa")),TIERSUB[t])).join("")}</div></fieldset>
  <fieldset class="q" data-q="stay"><legend>3 · Where do you like to sleep?</legend><div class="opts two">${Object.entries(STAY).map(([k,v])=>opt("radio","Stay",k,v[0],v[1])).join("")}</div></fieldset>
  <fieldset class="q" data-q="bike"><legend>4 · Sepeda</legend><div class="opts">${Object.entries(BIKEQ).map(([k,v])=>opt("radio","Bike",k,v[0],v[1])).join("")}</div></fieldset>
  <fieldset class="q" data-q="bags"><legend>5 · How much stuff are you bringing?<small>Besides the bike</small></legend><div class="opts">${Object.entries(BAGS).map(([k,v])=>opt("radio","Bags",k,v[0],v[1])).join("")}</div></fieldset>
  <fieldset class="q" data-q="party"><legend>6 · Coming alone or with someone?</legend><div class="opts">${Object.entries(PARTY).map(([k,v])=>opt("radio","Party",k,v[0],v[1])).join("")}</div>
    <div class="grid2" id="${p}ExtraBox" hidden style="gap:10px"><div class="field"><label for="${p}Extra">How many extra people?</label><select id="${p}Extra">${[1,2,3,4,5,6].map(n=>`<option>${n}</option>`).join("")}</select></div>
    <div class="field"><label for="${p}Riders">Do they ride too?</label><select id="${p}Riders">${Object.entries(RIDERS).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join("")}</select></div></div></fieldset>
  <fieldset class="q" data-q="flight"><legend>7 · Your flight plan<small>Best guess is fine</small></legend>
    <div class="callout">Flights are NOT included. Everyone books their own ticket.</div>
    <div class="grid2" style="gap:10px"><div class="field"><label for="${p}From">Flying from</label><select id="${p}From"><option value="">Pick one</option>${FROM.map(f=>`<option>${esc(f)}</option>`).join("")}</select></div>
    <div class="field"><label for="${p}Air">Likely airline</label><input id="${p}Air" list="airlines" maxlength="40" placeholder="e.g. Garuda, Scoot"></div></div></fieldset>`}
const radio=(p,n)=>{const r=document.querySelector(`input[name="${p}${n}"]:checked`);return r?r.value:""};
const checks=(p,n)=>$$(`input[name="${p}${n}"]:checked`).map(x=>x.value);
function syncExtra(p){$("#"+p+"ExtraBox").hidden=!["partner","family"].includes(radio(p,"Party"))}
function readQ(p){
  const q={name:$("#"+p+"Name").value.trim(),wa:normWa($("#"+p+"Wa").value),bike:radio(p,"Bike"),
    prefs:{dates:checks(p,"Dates"),budget:checks(p,"Budget"),stay:radio(p,"Stay"),bags:radio(p,"Bags"),party:radio(p,"Party"),
      extra:+$("#"+p+"Extra").value||0,riders:$("#"+p+"Riders").value,from:$("#"+p+"From").value,airline:$("#"+p+"Air").value.trim()}};
  if(q.prefs.party==="solo"){q.prefs.extra=0;q.prefs.riders=""}
  const miss=[];if(q.name.length<2)miss.push(["name","your name"]);if(q.wa.length<10||q.wa.length>15)miss.push(["wa","your WhatsApp number"]);
  if(!q.prefs.dates.length)miss.push(["dates","1 · dates"]);if(!q.prefs.budget.length)miss.push(["budget","2 · budget"]);if(!q.prefs.stay)miss.push(["stay","3 · sleep"]);
  if(!q.bike)miss.push(["bike","4 · sepeda"]);if(!q.prefs.bags)miss.push(["bags","5 · stuff"]);if(!q.prefs.party)miss.push(["party","6 · coming with"]);
  return {q,miss}}
function fillQ(p,m){const pr=P(m);
  $("#"+p+"Name").value=m.name||"";$("#"+p+"Wa").value=m.wa?"0"+String(m.wa).slice(2):"";
  $$(`input[name="${p}Dates"]`).forEach(x=>x.checked=(pr.dates||[]).includes(x.value));
  $$(`input[name="${p}Budget"]`).forEach(x=>x.checked=(pr.budget||[]).includes(x.value));
  [["Stay",pr.stay],["Bike",m.bike],["Bags",pr.bags],["Party",pr.party]].forEach(([n,v])=>$$(`input[name="${p}${n}"]`).forEach(x=>x.checked=x.value===v));
  $("#"+p+"Extra").value=String(pr.extra||1);$("#"+p+"Riders").value=pr.riders||"yes";$("#"+p+"From").value=pr.from||"";$("#"+p+"Air").value=pr.airline||"";syncExtra(p)}
function complain(p,miss){toast("Please fill in: "+miss.map(x=>x[1]).join(", "));
  const f=miss[0][0],el=f==="name"?$("#"+p+"Name"):f==="wa"?$("#"+p+"Wa"):document.querySelector(`#${p}Q [data-q="${f}"]`);if(el)el.scrollIntoView({behavior:"smooth",block:"center"})}
function answersDl(c){const p=P(c),fi=c.fin||{},fo=c.fout||{};
  const rows=[["Dates",(p.dates||[]).map(dShort).join(", ")||"–"],["Budget",(p.budget||[]).map(t=>TIER[t]).join(", ")||"–"],["Sleep",lab(STAY,p.stay)],["Sepeda",lab(BIKEQ,c.bike)],
    ["Stuff",lab(BAGS,p.bags)],["Coming",partyText(c)],["Flight plan",[p.from,p.airline].filter(Boolean).join(" · ")||"–"]];
  if(fi.no||fo.no)rows.push(["Flights",`${esc(fi.no||"?")} arr ${esc(fi.date||"")} ${esc(fi.time||"")} · ${esc(fo.no||"?")} dep ${esc(fo.date||"")} ${esc(fo.time||"")} · ${c.fl_status==="booked"?"booked":"not booked"}`]);
  return `<dl>${rows.map(([k,v])=>`<dt>${k}</dt><dd>${k==="Flights"?v:esc(v)}</dd>`).join("")}</dl>`}
let edDirty=false;
function tl(o,labels){const mx=Math.max(1,...Object.values(o));return Object.entries(o).map(([k,v])=>`<div class="r"><span>${esc(labels[k]||k)}</span><span class="b"><i style="width:${v/mx*100}%"></i></span><span>${v}</span></div>`).join("")}
const ORDER={going:0,pending:1,joined:2,out:3};
function renderCrew(){
  const list=crewList(),m=me(),act=active();
  $("#crewCount").textContent=S.state==="ok"?`${act.length} joined · ${act.filter(c=>stage(c)==="going").length} going`:"";
  $("#crewGate").innerHTML=!S.online?`<div class="box pad"><h3 class="disp" style="font-size:26px">Not connected yet</h3><p class="note" style="margin-top:8px">The organiser still needs to add the database keys to config.js.</p></div>`
    :S.state==="loading"?`<div class="empty">Loading crew…</div>`:S.state==="err"?`<div class="empty">Can't reach the server. Check your connection, then reload.</div>`:"";
  $("#regBox").hidden=!(S.online&&S.state!=="loading"&&!m);
  $("#meBox").hidden=!m;
  if(m){const sg=stage(m),idx=sg==="going"?2:sg==="pending"?1:0;
    $("#meName").textContent=m.name;
    const ix=sg==="going"?3:sg==="pending"?2:1;
    $("#meTrack").innerHTML=sg==="out"?`<div class="now" style="grid-column:1/-1"><b>Not going</b>You said you can't make it</div>`
      :[["Registered ✓","Form received"],[sg==="pending"||sg==="going"?"DP sent ✓":"Pay DP","Transfer + screenshot"],[sg==="going"?"Going ✓":"Approval",sg==="going"?"Approved by George":"George checks BCA"]].map((s,i)=>`<div class="${i<ix?"done":i===ix?"now":""}"><b>${s[0]}</b>${s[1]}</div>`).join("");
    $("#meBanner").hidden=!S.justJoined;
    if(S.justJoined)$("#meBanner").innerHTML=`<b>✓ Application received</b>You're registered, ${esc(m.name.split(" ")[0])}. Your status stays <b style="display:inline;font:inherit;text-transform:none">Pending</b> until your DP is paid and George approves it.`;
    const gw=S.config.admin_wa,pr=P(m);
    const msg=sg==="joined"?`Halo George, aku ${m.name} sudah daftar Bobo Bareng Jepang 🚴\nTanggal: ${(pr.dates||[]).map(dShort).join(", ")}\nBudget: ${(pr.budget||[]).map(t=>TIER[t]).join(", ")}\nDP Rp 3 jt segera aku transfer ke BCA.`
      :sg==="pending"?`Halo George, DP ${rp(dpAmount())} Bobo Bareng Jepang sudah aku transfer dan screenshot sudah aku upload di app. Tolong dicek ya 🙏\n- ${m.name}`:"";
    $("#waGeorge").hidden=!(gw&&msg);if(gw&&msg){$("#waGeorge").href=`https://wa.me/${gw}?text=${encodeURIComponent(msg)}`;$("#waGeorge").textContent=sg==="joined"?"Tell George you've joined (WhatsApp)":"Tell George you've paid (WhatsApp)"}
    $("#meNext").textContent=sg==="joined"?(dpState(m)==="rej"?"George couldn't find your transfer in BCA. Upload a clearer screenshot below, or WhatsApp him.":"Next: transfer the DP to the BCA account below, then upload the screenshot.")
      :sg==="pending"?"Screenshot received. George is checking BCA. You'll get a WhatsApp from him once you're approved.":sg==="going"?"You're going! Add your flight below once you've booked it.":"Changed your mind? Open My answers and tap “I'm back in”.";
    $("#dpBox").hidden=sg==="going"||sg==="out";
    $("#proofForm").hidden=sg!=="joined";
    const wa=S.config.admin_wa;$("#qrisBtn").hidden=!wa;$("#qrisNo").hidden=!!wa;
    if(wa)$("#qrisBtn").href=`https://wa.me/${wa}?text=${encodeURIComponent(`Halo George, minta QRIS DP Bobo Bareng Jepang ${rp(dpAmount())} a/n ${m.name} 🙏`)}`;
    $("#ansSum").innerHTML=`<div class="acard" style="margin-top:0">${answersDl(m)}</div>`;
    if(!edDirty)fillQ("ed",m);
    $("#outBtn").textContent=m.status==="out"?"I'm back in":"I can't make it";
    const fi=m.fin||{},fo=m.fout||{};setVal("fiNo",fi.no);setVal("fiFrom",fi.from);setVal("fiDate",fi.date);setVal("fiTime",fi.time);
    setVal("foNo",fo.no);setVal("foTo",fo.to);setVal("foDate",fo.date);setVal("foTime",fo.time);setVal("flStatus",m.fl_status||"none");
    $("#flBox").hidden=sg==="out";
  }
  $("#dpAmt").textContent=rp(dpAmount());
  $("#bankName").textContent=S.config.bank_name||"BCA";$("#bankAcct").textContent=S.config.bank_acct||"8400064491";$("#bankHolder").textContent=S.config.bank_holder||"George Widodo";
  const cnt=(keys,get)=>{const t={};keys.forEach(k=>t[k]=0);act.forEach(c=>{[].concat(get(c)||[]).forEach(v=>{if(v in t)t[v]++})});return t};
  $("#tallyDates").innerHTML=tl(cnt(DATA.tripDates.map(d=>d.id),c=>P(c).dates),Object.fromEntries(DATA.tripDates.map(d=>[d.id,dShort(d.id)])));
  $("#tallyBudget").innerHTML=tl(cnt(["kere","rame","sultan"],c=>P(c).budget),TIER);
  $("#tallyStay").innerHTML=tl(cnt(Object.keys(STAY),c=>P(c).stay),STAYSHORT);
  $("#tallyBike").innerHTML=tl(cnt(["bawa","sewa","tbd"],c=>c.bike),BIKE);
  const sorted=list.slice().sort((a,b)=>ORDER[stage(a)]-ORDER[stage(b)]);
  $("#crewList").innerHTML=sorted.length?sorted.map(c=>{const p=P(c),sg=stage(c);
    return `<div class="member"><div class="av" style="background:${sg==="going"?"var(--lime)":sg==="pending"?"var(--pink)":"var(--paper)"}">${esc((c.name||"?").trim().charAt(0).toUpperCase())}</div><div style="min-width:0"><h4>${esc(c.name)}${m&&c.id===m.id?' <span class="mono muted">· you</span>':""}</h4>
    <div class="row">${stagePill(c)}${c.bike?`<span class="pill">${BIKE[c.bike]}</span>`:""}</div>
    <div class="meta">${(p.dates||[]).length?"Dates: "+esc((p.dates||[]).map(dShort).join(", ")):""}${p.party&&p.party!=="solo"?" · "+esc(partyText(c)):""}</div></div></div>`}).join("")
    :`<div class="empty">${S.online?"Nobody yet. Be the first: fill the form above.":"Crew list shows here once the app is connected."}</div>`;
}

/* ---------- ADMIN ---------- */
function renderAdmin(){
  const isA=!!S.admin;$("#tabAdmin").hidden=!isA;$("#adminForm").hidden=isA||!S.online;$("#adminBox").hidden=!isA;
  const list=crewList(),seen=store.get("bobo.seen")||"",newJ=isA?list.filter(c=>String(c.created_at||"")>seen):[];
  const pend=list.filter(c=>stage(c)==="pending"),unpaid=list.filter(c=>stage(c)==="joined"),going=list.filter(c=>stage(c)==="going");
  {const tab=$("#tabAdmin");let b=tab.querySelector(".badge");const n=isA?pend.length+newJ.length:0;if(n){if(!b){b=document.createElement("span");b.className="badge";tab.appendChild(b)}b.textContent=n}else if(b)b.remove()}
  if(!isA)return;
  const row=(n,t)=>`<li><span class="n ${n?"":"z"}">${n}</span>${t}</li>`;
  $("#adminTodo").innerHTML=`<h3 class="disp" style="font-size:24px">Cek ini dulu · To-do</h3><ul style="list-style:none;margin:0;padding:0">
    ${row(pend.length,"screenshots waiting for you to approve")}${row(newJ.length,"new people since you last looked"+(newJ.length?": "+newJ.map(c=>esc(c.name)).join(", "):""))}
    ${row(unpaid.length,"joined but haven't sent the DP yet")}${row(going.length,"going (DP approved)")}</ul>
    ${newJ.length?'<button class="btn small ghost" id="seenBtn" type="button" style="margin-top:8px">Got it, mark as seen</button>':'<p class="note" style="margin:8px 0 0">The app doesn\'t send notifications. Check this page once a day.</p>'}`;
  const toApprove=pend.concat(unpaid);
  $("#approveList").innerHTML=toApprove.length?toApprove.map(c=>{const pr=c.proof&&c.proof.status==="pending"?c.proof:null;
    return `<div class="acard"><div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><h4>${esc(c.name)}</h4>${stagePill(c)}</div>
    <div class="mono" style="margin-top:6px"><a href="https://wa.me/${esc(c.wa)}" target="_blank" rel="noopener">${esc(prettyWa(c.wa))} · WhatsApp ↗</a></div>
    ${pr?`<a href="${esc(fileUrl(pr.path))}" target="_blank" rel="noopener"><img class="proofimg" src="${esc(fileUrl(pr.path))}" alt="DP screenshot from ${esc(c.name)}"></a><div class="mono" style="margin-top:6px">Screenshot · ${rp(pr.amount)} · ${esc(String(pr.at||"").slice(0,10))} · tap to enlarge</div>`:`<p class="note" style="margin:8px 0 0">No screenshot yet. If you already see their transfer in BCA (or got cash), you can still approve.</p>`}
    <div class="act"><button class="btn small" data-approve="${esc(c.id)}">Approve ✓</button>${pr?`<button class="btn small ghost" data-reject="${esc(c.id)}">Can't find it in BCA</button>`:""}</div></div>`}).join("")
    :`<p class="note" style="margin-top:10px">Nothing to approve right now.</p>`;
  const sorted=list.slice().sort((a,b)=>ORDER[stage(a)]-ORDER[stage(b)]);
  $("#answersList").innerHTML=sorted.length?sorted.map(c=>`<div class="acard"><div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><h4>${esc(c.name)}</h4>${stagePill(c)}</div>
    <div class="mono" style="margin-top:6px"><a href="https://wa.me/${esc(c.wa)}" target="_blank" rel="noopener">${esc(prettyWa(c.wa))} ↗</a> · joined ${esc(String(c.created_at||"").slice(0,10))}</div>${answersDl(c)}
    <div class="act">${stage(c)==="going"?`<button class="btn small ghost" data-unapprove="${esc(c.id)}">Undo approval</button>`:""}<button class="btn small ghost" data-delmember="${esc(c.id)}">Remove person</button></div></div>`).join("")
    :`<p class="note" style="margin-top:10px">Nobody has joined yet.</p>`;
  const sel=$("#bkPick"),cur=sel.value;sel.innerHTML=`<option value="">+ New booking</option>`+S.bookings.map(b=>`<option value="${esc(b.id)}">${esc(b.title)}</option>`).join("");sel.value=cur;$("#bkDel").hidden=!sel.value;
  setVal("setWa",S.config.admin_wa?"0"+String(S.config.admin_wa).slice(2):"");setVal("setDp",S.config.dp);setVal("setBankName",S.config.bank_name);setVal("setAcct",S.config.bank_acct);setVal("setHolder",S.config.bank_holder);setVal("setAnn",S.config.announce);
}
function csv(){const q=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
  const head=["Name","WhatsApp","Status","Dates","Budget","Sleep","Bike","Stuff","Coming with","Extra people","They ride","Flying from","Airline","Arrival flight","Arrival date","Departure flight","Departure date","Flight status","DP","Joined"];
  const rows=crewList().map(c=>{const p=P(c),fi=c.fin||{},fo=c.fout||{};return [c.name,"+"+c.wa,STAGE[stage(c)][0],(p.dates||[]).map(dShort).join(" / "),(p.budget||[]).map(t=>TIER[t]).join(" / "),lab(STAY,p.stay),lab(BIKEQ,c.bike),lab(BAGS,p.bags),lab(PARTY,p.party),p.extra||0,RIDERS[p.riders]||"",p.from,p.airline,fi.no,fi.date,fo.no,fo.date,c.fl_status,dpVerified(c.id)?"paid":"",String(c.created_at||"").slice(0,10)]});
  const blob=new Blob(["﻿"+[head].concat(rows).map(r=>r.map(q).join(",")).join("\n")],{type:"text/csv"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="bobo-bareng-crew.csv";document.body.appendChild(a);a.click();a.remove()}

/* ---------- WALLET ---------- */
function renderWallet(){
  const L=S.ledger,ins=sum(L.filter(t=>t.kind==="in"),t=>t.amount),outs=sum(L.filter(t=>t.kind==="out"),t=>t.amount),saldo=ins-outs;
  const unpaid=sum(S.bookings.filter(b=>b.status!=="paid"),b=>b.cost);
  const crew=active(),n=crew.length,tier=topTier();
  const target=sum(crew,c=>poolPart(n,tier,c.bike==="sewa"?"sewa":"bawa").pool);
  $("#wSaldo").textContent=rp(saldo);$("#wProg").style.width=(target?Math.min(100,ins/target*100):0)+"%";
  $("#wProgTxt").textContent=target?`${rp(ins)} collected of ${rp(target)} pool target (${n} joined · ${TIER[tier]})`:"Pool target appears once people opt in.";
  $("#wGrid").innerHTML=`<div><span>Money in</span><b class="tabular">${rp(ins)}</b></div><div><span>Spent</span><b class="tabular">${rp(outs)}</b></div><div><span>Still to pay (bookings)</span><b class="tabular">${rp(unpaid)}</b></div><div><span>${saldo-unpaid<0?"Still to collect":"Left after bookings"}</span><b class="tabular" style="color:${saldo-unpaid<0?"var(--bad)":"inherit"}">${rp(Math.abs(saldo-unpaid))}</b></div>`;
  const byCat={};L.filter(t=>t.kind==="out").forEach(t=>byCat[t.cat||"Lain-lain"]=(byCat[t.cat||"Lain-lain"]||0)+(+t.amount||0));const tot=Object.values(byCat).reduce((a,b)=>a+b,0);
  $("#wCat").innerHTML=tot?Object.entries(byCat).map(([k,v])=>`<i title="${esc(k)}" style="width:${v/tot*100}%;background:${CATC[k]||"#C7BBA8"}"></i>`).join(""):"";
  $("#wCatLeg").innerHTML=tot?Object.entries(byCat).map(([k,v])=>`<span><i style="background:${CATC[k]||"#C7BBA8"}"></i>${esc(k)} ${jt(v)}</span>`).join(""):`<span class="muted">Nothing spent yet.</span>`;
  const m=me(),isA=!!S.admin;
  $("#wTx").innerHTML=L.length?L.map(t=>`<li><div><b>${esc(t.label)}</b><div class="mono muted">${esc(t.cat||"")} · ${esc(t.date||"")}${t.by_name?" · by "+esc(t.by_name):""}${t.receipt?` · <a href="${esc(fileUrl(t.receipt))}" target="_blank" rel="noopener">Receipt ↗</a>`:""}</div>${isA?`<button class="mine" data-deltx="${esc(t.id)}">Delete</button>`:m&&t.member_id===m.id&&t.kind==="out"&&!t.dp_of?`<button class="mine" data-delmine="${esc(t.id)}">Delete mine</button>`:""}</div><div class="amt ${t.kind==="in"?"in":""}">${t.kind==="in"?"+":"−"}${rp(t.amount)}</div></li>`).join("")
    :`<li style="display:block"><div class="empty">No money yet. Verified DPs, booking payments and crew expenses will be listed here.</div></li>`;
  $("#bkList").innerHTML=S.bookings.length?S.bookings.map(b=>`<li><div><b>${esc(b.title)}</b><div class="note">${esc(b.detail||"")}</div><div class="mono muted">${esc(b.cat||"")} · ${esc(b.date||"")}${b.link?` · <a href="${esc(b.link)}" target="_blank" rel="noopener">Link ↗</a>`:""}</div></div><div style="text-align:right"><span class="pill ${b.status==="paid"?"ok":b.status==="booked"?"wait":"no"}">${esc(b.status||"planned")}</span><div class="mono" style="margin-top:6px">${b.cost?rp(b.cost):"–"}</div>${b.estimate&&b.status==="planned"?'<div class="mono muted">estimate</div>':""}</div></li>`).join("")
    :`<li style="display:block"><div class="empty">Stays, bikes and luggage bookings appear here once made.</div></li>`;
  $("#expBox").hidden=!m;
  renderCalc();
}
const C={n:6,tier:"rame",bike:"bawa"};
function renderCalc(){$("#cNv").textContent=C.n;const tot=est(C.n,C.tier,C.bike),sp=poolPart(C.n,C.tier,C.bike),p=DATA.price[C.n][C.tier];
  $("#cTot").textContent=jt(tot);
  $("#cSplit").innerHTML=`<div><span>Masuk kas (pool)</span><b class="tabular">${jt(sp.pool)}</b><p class="note">Bobo 3 malem${C.bike==="sewa"?", bike rental":""}, luggage. DP counts here.</p></div><div><span>Uang saku (yours)</span><b class="tabular">${jt(sp.pocket)}</b><p class="note">Food, trains, tickets, onsen, eSIM${C.bike==="bawa"?", bike box + rinko bag":""}.</p></div>`;
  $("#cWhy").innerHTML=`Bobo for 3 nights: ${yen(p.stay)} per person. Planned at <b>¥1 = Rp ${DATA.rate}</b> (today ~Rp ${DATA.rateNow}) + ${Math.round(DATA.cont*100)}% cadangan + ${Math.round(DATA.fee*100)}% transfer fees, priced at sakura-season rates (mid-March dates would likely come in cheaper). No markup. Leftover pool money is refunded evenly. Flights not included.`}

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
  crewList().forEach(c=>r.push({k:"Crew",t:c.name,s:STAGE[stage(c)][0]+((c.prefs&&c.prefs.dates)?" · "+c.prefs.dates.map(dShort).join(", "):""),go:go(S.admin?"#admin":"#crew")}));
  S.bookings.forEach(b=>r.push({k:"Booking",t:b.title,s:(b.status||"")+" · "+(b.detail||""),go:go("#dompet")}));
  S.ledger.forEach(t=>r.push({k:"Dompet",t:t.label,s:rp(t.amount)+" · "+(t.date||"")+(t.by_name?" · "+t.by_name:""),go:go("#dompet")}));
  [["Kere Hore","Hostel / capsule level","#dompet"],["Rame-Rame","Whole house split by crew","#dompet"],["Agak Sultan","Hotel + ryokan onsen","#dompet"],["DP · transfer BCA / QRIS","Pay in the Crew tab","#crew"],["Flights","Add yours in the Crew tab","#crew"],["Log expense","Dompet tab","#dompet"]].forEach(([t,s,h])=>r.push({k:"Info",t,s,go:go(h)}));
  return r}
let IDX=[];
function doSearch(){const q=$("#q").value.trim().toLowerCase(),out=q?IDX.filter(x=>(x.t+" "+x.s+" "+x.k).toLowerCase().includes(q)).slice(0,40):[];
  $("#qRes").innerHTML=q?(out.length?out.map(x=>`<a href="${x.url?esc(x.url):"#"}" ${x.url?'target="_blank" rel="noopener"':""} data-ri="${IDX.indexOf(x)}"><span class="k">${esc(x.k)}</span><span><b>${esc(x.t)}</b><span>${esc(x.s)}</span></span></a>`).join(""):`<p class="empty" style="margin-top:16px">No match for “${esc(q)}”. Try “onsen”, “ramen”, “Kuragari” or a name.</p>`)
    :`<p class="note" style="margin-top:16px">Try: onsen · mochi · Kuragari · Day 3 · DP · a crew name</p>`}

/* ---------- actions ---------- */
const appUrl=()=>location.origin+location.pathname;
function waTo(wa,text){try{window.open(`https://wa.me/${wa}?text=${encodeURIComponent(text)}`,"_blank","noopener")}catch(_){}}
const upMe=patch=>rpc("fn_update_me",{p_wa:S.wa,p_patch:patch});
const num=v=>+String(v||"").replace(/\D/g,"")||0;
function copy(text,label){(navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(text):Promise.reject()).then(()=>toast((label||"Copied")+": "+text),()=>toast(text))}
function clean(ids){ids.forEach(i=>{const el=document.getElementById(i);if(el)delete el.dataset.dirty})}

function bind(){
  document.addEventListener("click",e=>{
    const t=e.target.closest("[data-goday],[data-d],[data-day],[data-st],[data-sd],[data-spotday],[data-copy],[data-approve],[data-unapprove],[data-reject],[data-delmember],[data-deltx],[data-delmine],[data-ri],.stop,.rt-hit");
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
    if(t.dataset.approve){const c=S.members.find(x=>x.id===t.dataset.approve);if(!c)return;t.disabled=true;
      waTo(c.wa,`Halo ${c.name.split(" ")[0]}! DP Bobo Bareng Jepang kamu sudah aku terima ✓\nStatus kamu sekarang: GOING 🚴\nCek app: ${appUrl()}#crew`);
      const hasProof=c.proof&&c.proof.status==="pending";act(()=>hasProof?admin("verify_dp",{member_id:c.id}):admin("mark_dp_paid",{member_id:c.id,amount:dpAmount()}),c.name+" is Going ✓ · DP added to the Dompet");return}
    if(t.dataset.unapprove){if(t.dataset.armed){act(()=>admin("unverify_dp",{member_id:t.dataset.unapprove}),"Approval undone. DP removed from the Dompet.")}else{t.dataset.armed="1";t.textContent="Tap again to undo"}return}
    if(t.dataset.reject){if(t.dataset.armed){const c=S.members.find(x=>x.id===t.dataset.reject);if(c)waTo(c.wa,`Halo ${c.name.split(" ")[0]}, aku belum nemu transfer DP Bobo Bareng kamu di BCA. Boleh kirim ulang screenshot-nya atau cek lagi transfernya? 🙏`);act(()=>admin("reject_dp",{member_id:t.dataset.reject}),"Sent back. They'll see a note to re-upload or WhatsApp you.")}else{t.dataset.armed="1";t.textContent="Tap again to send back"}return}
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

  $("#regForm").addEventListener("submit",e=>{e.preventDefault();const {q,miss}=readQ("reg");if(miss.length){complain("reg",miss);return}
    const btn=$("#regForm button[type=submit]");btn.disabled=true;
    act(async()=>{const r=await rpc("fn_login",{p_name:q.name,p_wa:q.wa});S.wa=r.wa;store.set("bobo.wa",r.wa);await upMe({name:q.name,status:"in",bike:q.bike,prefs:q.prefs});S.justJoined=true},"Application received ✓").then(()=>{if(S.justJoined)$("#meBox").scrollIntoView({behavior:"smooth",block:"start"})}).finally(()=>btn.disabled=false)});
  $("#loginForm").addEventListener("submit",async e=>{e.preventDefault();const wa=normWa($("#loginWa").value);if(wa.length<10){toast("Check the WhatsApp number");return}
    try{const r=await rpc("fn_login",{p_name:"",p_wa:wa});S.wa=r.wa;store.set("bobo.wa",r.wa);await refresh();toast("Welcome back, "+r.name)}
    catch(_){toast("That number hasn't joined yet. Fill the form above.")}});
  ["reg","ed"].forEach(p=>document.getElementById(p+"Q").addEventListener("change",()=>{syncExtra(p);if(p==="ed")edDirty=true}));
  $("#edQ").addEventListener("input",()=>edDirty=true);
  $("#editForm").addEventListener("submit",e=>{e.preventDefault();const {q,miss}=readQ("ed");if(miss.length){complain("ed",miss);return}
    act(async()=>{const r=await upMe({name:q.name,wa:q.wa,bike:q.bike,prefs:q.prefs});S.wa=r.wa;store.set("bobo.wa",r.wa);edDirty=false},"Saved")});
  $("#outBtn").onclick=()=>{const m=me();if(!m)return;const back=m.status==="out";act(()=>upMe({status:back?"in":"out"}),back?"Welcome back!":"Got it. Marked as not going.")};
  $("#logoutBtn").onclick=()=>{S.wa=null;store.set("bobo.wa",null);renderAll();toast("Logged out on this phone")};
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
  $("#bkDel").onclick=()=>{const b=$("#bkDel"),id=$("#bkPick").value;if(!id)return;if(b.dataset.armed){delete b.dataset.armed;b.textContent="Delete booking";act(()=>admin("booking_delete",{id}),"Booking deleted").then(()=>{$("#bkPick").value="";$("#bkForm").reset()})}else{b.dataset.armed="1";b.textContent="Tap again to delete"}};
  $("#bkPick").onchange=()=>{$("#bkDel").hidden=!$("#bkPick").value;const b=S.bookings.find(x=>x.id===$("#bkPick").value)||{};clean(["bkTitle","bkDetail","bkCost","bkDate","bkLink"]);
    $("#bkTitle").value=b.title||"";$("#bkDetail").value=b.detail||"";$("#bkCat").value=b.cat||"Bobo";$("#bkStatus").value=b.status||"planned";$("#bkCost").value=b.cost||"";$("#bkDate").value=b.date||"";$("#bkLink").value=b.link||""};
  $("#bkForm").addEventListener("submit",e=>{e.preventDefault();
    act(()=>admin("booking_upsert",{id:$("#bkPick").value,title:$("#bkTitle").value.trim(),detail:$("#bkDetail").value.trim(),cat:$("#bkCat").value,status:$("#bkStatus").value,cost:num($("#bkCost").value),date:$("#bkDate").value,link:$("#bkLink").value.trim(),estimate:$("#bkStatus").value==="planned"}),"Booking saved")});
  $("#setForm").addEventListener("submit",e=>{e.preventDefault();clean(["setWa","setDp","setBankName","setAcct","setHolder","setAnn"]);
    act(()=>admin("config_set",{admin_wa:normWa($("#setWa").value),dp:num($("#setDp").value)||dpAmount(),bank_name:$("#setBankName").value.trim(),bank_acct:$("#setAcct").value.replace(/\D/g,""),bank_holder:$("#setHolder").value.trim(),announce:$("#setAnn").value.trim()}),"Settings saved")});
  $("#adminForm").addEventListener("submit",async e=>{e.preventDefault();const code=$("#adminCode").value.trim();
    try{await rpc("fn_admin",{p_code:code,p_action:"check",p_payload:{}});S.admin=code;store.set("bobo.admin",code);$("#adminCode").value="";store.set("bobo.seen",store.get("bobo.seen")||"");renderAll();toast("Admin mode on")}catch(_){toast("Admin code is wrong.")}});
  $("#adminOut").onclick=()=>{S.admin=null;store.set("bobo.admin",null);renderAll();location.hash="#home";toast("Admin mode off")};
  $("#csvBtn").onclick=csv;
  document.addEventListener("click",e=>{if(e.target.id==="seenBtn"){const mx=crewList().reduce((x,c)=>String(c.created_at||"")>x?String(c.created_at):x,"");store.set("bobo.seen",mx);renderAll()}});

  $("#cN").oninput=()=>{C.n=+$("#cN").value;renderCalc()};
  $("#cTier").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;C.tier=b.dataset.v;segSet("cTier",C.tier);renderCalc()});
  $("#cBike").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;C.bike=b.dataset.v;segSet("cBike",C.bike);renderCalc()});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh()});
}

function renderAll(){renderHome();renderCrew();renderAdmin();renderWallet();renderDay();const m=me();$("#meChip").textContent=m?m.name.split(" ")[0]:"JOIN"}

$("#regQ").innerHTML=qHTML("reg");$("#edQ").innerHTML=qHTML("ed");document.body.insertAdjacentHTML("beforeend",`<datalist id="airlines">${AIRLINES.map(a=>`<option value="${esc(a)}">`).join("")}</datalist>`);
route();bind();renderDayChips();renderDay();renderSpots();
if(!S.online)S.state="off";
renderAll();tick();setInterval(tick,1000);
if(S.online){refresh();setInterval(()=>{if(!document.hidden)refresh()},20000)}
})();
