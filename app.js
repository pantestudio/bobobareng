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
const AIRLINES=[["Scoot","via Singapore"],["Singapore Airlines","via Singapore"],["AirAsia / AirAsia X","via Kuala Lumpur"],["Batik Air","via Kuala Lumpur"],["Malaysia Airlines","via Kuala Lumpur"],["Garuda Indonesia","via Jakarta"],["Cathay Pacific","via Hong Kong"],["Hong Kong Airlines","via Hong Kong"],["Korean Air","via Seoul"],["Asiana Airlines","via Seoul"],["Jeju Air","via Seoul"],["China Airlines","via Taipei"],["EVA Air","via Taipei"],["Starlux Airlines","via Taipei"],["Thai Airways","via Bangkok"],["Thai Lion Air","via Bangkok"],["Vietnam Airlines","via Hanoi / Saigon"],["VietJet Air","via Saigon"],["Philippine Airlines","via Manila"],["Japan Airlines (JAL)","codeshare, via Singapore / Jakarta"],["ANA","codeshare, via Singapore / Jakarta"],["China Eastern / Juneyao","via Shanghai"],["China Southern","via Guangzhou"]];
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
  if(S.admin){try{S.visits=await rpc("fn_admin_visits",{p_code:S.admin})}catch(_){}try{const r=await rpc("fn_admin_seen",{p_code:S.admin});S.seen={};(r||[]).forEach(x=>S.seen[x.member_id]=x)}catch(_){}}
  S.state="ok";S.lastSync=new Date();
}
const _tch={};
function touch(v){if(!S.wa||S.admin||!S.online)return;const k=v||"app",n=Date.now();if(_tch[k]&&n-_tch[k]<60000)return;_tch[k]=n;rpc("fn_touch",{p_wa:S.wa,p_view:v||null}).catch(()=>{})}
const DEV=(()=>{let d=store.get("bobo.dev");if(!d||String(d).length<8){d=((crypto.randomUUID&&crypto.randomUUID())||String(Math.random()).slice(2)+Date.now()).replace(/-/g,"");store.set("bobo.dev",d)}return d})();
let vsid=null,vact=Date.now();
function visit(){if(S.admin||!S.online)return;if(Date.now()-vact>30*60000)vsid=null;vact=Date.now();
  let tz="";try{tz=Intl.DateTimeFormat().resolvedOptions().timeZone||""}catch(_){}
  rpc("fn_visit",{p_device:DEV,p_wa:S.wa||null,p_tz:tz,p_ua:navigator.userAgent,p_view:(location.hash||"#home").slice(1),p_sid:vsid}).then(r=>{if(r)vsid=r}).catch(()=>{})}
function ago(d){if(!d)return"never";const m=Math.round((Date.now()-new Date(d))/6e4);if(m<2)return"just now";if(m<60)return m+" min ago";const h=Math.round(m/60);if(h<24)return h+" h ago";const dd=Math.round(h/24);return dd+(dd===1?" day ago":" days ago")}
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
const VIEWS=["home","rute","crew","gear","dompet","spots","me","admin"];
function route(){let v=(location.hash||"#home").slice(1);const toLogin=v==="login";if(toLogin)v="crew";if(!VIEWS.includes(v))v="home";
  VIEWS.forEach(x=>{$("#v-"+x).hidden=x!==v});
  $$(".tabs a").forEach(a=>{if(a.dataset.tab===v)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")});
  touch(v);window.scrollTo(0,0);if(toLogin)setTimeout(()=>{const f=$("#loginForm");if(f&&!f.closest("[hidden]")){f.scrollIntoView({behavior:"smooth",block:"center"});$("#loginWa").focus()}},250)}
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
const PERSON=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4.2-6.5 8-6.5s7 2 8 6.5"/></svg>`;
function renderHello(){const m=me(),el=$("#hello");$("#helloWrap").hidden=!m;$("#nextMs").hidden=!!m;if(!m)return;
  const now=new Date(),sg=stage(m),g=gearOf(m),packed=packedOf(m),nx=DATA.milestones.find(x=>new Date(x.at)>now&&!(x.kind==="dp"&&sg!=="joined"));
  const dleft=d=>{const n=Math.ceil((new Date(d)-now)/864e5);return n<=0?"today":n===1?"tomorrow":n+" days left"};
  const dp=DATA.milestones.find(x=>x.kind==="dp"),fl=DATA.milestones.find(x=>x.kind==="flight"),bk=DATA.milestones.find(x=>x.kind==="bike");
  const A=[];
  A.push({done:true,t:"Registered for the trip",s:"Form received"});
  A.push(sg==="joined"?{t:`Transfer the ${rp(dpAmount())} DP + upload the screenshot`,s:`BCA ${S.config.bank_acct||"8400064491"} a/n ${S.config.bank_holder||"George Widodo"} · due ${fmtDate(dp.at,{weekday:"short"})} (${dleft(dp.at)})`,href:"#me",cta:"Pay"}
    :{done:true,t:"DP sent",s:sg==="going"?"Approved by George":"Screenshot received"});
  A.push(sg==="going"?{done:true,t:"You're GOING ✓",s:"DP approved"}:{t:"George approves your DP",s:sg==="pending"?"He's checking BCA. Nothing to do.":"After you transfer",wait:true});
  A.push(m.photo?{done:true,t:"Profile photo added"}:{t:"Add a profile photo",s:"So the crew knows who's who",href:"#me",cta:"Add"});
  A.push(m.bike==="bawa"||m.bike==="sewa"?{done:true,t:m.bike==="sewa"?"Renting a bike in Osaka":"Bringing your own bike"}:{t:"Decide: bawa or sewa your bike",s:bk?"By "+fmtDate(bk.at)+" so rentals can be booked":"",href:"#gear",cta:"Decide"});
  A.push(m.fl_status==="booked"?{done:true,t:"Flight booked"}:{t:"Book your flight + add it here",s:"Once dates are locked"+(fl?" · by "+fmtDate(fl.at):"")+" · not included",href:"#me",cta:"Add"});
  A.push(packed>=GITEMS.length?{done:true,t:"Everything packed"}:{t:`Packing list ${packed}/${GITEMS.length}`,s:"Tick things off as you pack",href:"#gear",cta:"Open"});
  const todo=A.filter(a=>!a.done),done=A.filter(a=>a.done);
  const li=a=>`<li class="${a.done?"done":""}"><span class="ck">${a.done?"✓":a.wait?"…":""}</span><span><b>${esc(a.t)}</b>${a.s?`<small>${esc(a.s)}</small>`:""}</span>${a.href&&!a.done?`<a class="btn small" href="${a.href}">${a.cta}</a>`:"<span></span>"}</li>`;
  const today=now.toLocaleDateString("en-GB",{timeZone:"Asia/Makassar",weekday:"long",day:"numeric",month:"long"});
  el.innerHTML=`<div class="hd"><a href="#me" aria-label="My profile" style="position:relative">${avatar(m)}${m.photo?"":`<span class="addph">+</span>`}</a><div><div class="mono">${esc(today)}</div><h3>Halo, ${esc(fname(m.name))}</h3></div></div>
   ${nx?`<div class="today">Next deadline: ${esc(nx.title)} · ${esc(fmtDate(nx.at,{weekday:"short"}))} (${dleft(nx.at)})</div>`:""}
   <ul>${todo.map(li).join("")}${done.map(li).join("")}</ul>`;
}
function renderVote(){const el=$("#voteCard"),act=S.state==="ok"?active():[],lock=DATA.milestones.find(x=>x.kind==="lock"),m=me();
  const rows=DATA.tripDates.map(d=>({d,who:act.filter(c=>((c.prefs||{}).dates||[]).includes(d.id))}));
  const mx=Math.max(1,...rows.map(r=>r.who.length)),top=Math.max(0,...rows.map(r=>r.who.length));
  const days=lock?Math.ceil((new Date(lock.at)-Date.now())/864e5):0;
  el.innerHTML=`<div class="vh"><h3>Dates vote</h3><span>${act.length} voted${lock&&days>0?`<br>closes ${esc(fmtDate(lock.at,{weekday:"short"}))} · ${days}d`:""}</span></div>
   <ol>${rows.map(r=>`<li class="${top>0&&r.who.length===top?"lead":""}"><div class="t"><b>${esc(r.d.label.replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun) /g,""))}</b><span class="n">${r.who.length} ${r.who.length===1?"vote":"votes"}</span></div><div class="bar"><i style="width:${r.who.length/mx*100}%"></i></div><small>${esc(r.d.sub)}</small>${r.who.length?`<div class="who">${r.who.map(c=>esc(fname(c.name))).join(", ")}</div>`:""}</li>`).join("")}</ol>
   <div class="ft">${m?`<a class="btn small ghost" href="#me" data-editdates="1">Change my dates</a>`:`<a class="btn small" href="#crew">Join + vote</a>`}<span class="note" style="margin:0">Pick all dates that work. Most votes wins.</span></div>`}
function renderHome(){renderHello();renderVote();
  const now=Date.now(),nx=DATA.milestones.find(m=>new Date(m.at)>now),m=me();
  const sg=m?stage(m):"";const cta=!S.online?`<a class="btn" href="#crew">How to join</a>`:!m?`<a class="btn" href="#crew">Join now · 2 min</a>`:sg==="going"?`<span class="pill ok">You're going ✓</span>`:sg==="pending"?`<span class="pill wait">DP sent · waiting for George</span>`:`<a class="btn" href="#crew">Pay the DP</a>`;
  $("#nextMs").innerHTML=nx?`<div class="pad"><span class="mono">Next · ${esc(fmtDate(nx.at,{weekday:"short"}))}</span><h3>${esc(nx.title)}</h3><div class="left tabular" id="nmLeft"></div><p>${esc(nx.text)}</p><div>${cta}</div></div>`:"";
  const n=nIn(),paid=active().filter(c=>stage(c)==="going").length,tier=topTier();
  $("#homeStats").innerHTML=`<div><b>${S.state==="ok"?n:"–"}</b><span>Joined</span></div><div><b>${S.state==="ok"?paid:"–"}</b><span>Going ✓</span></div><div><b>${jt(est(Math.max(n,6),tier,"bawa")).replace("Rp ","")}</b><span>est. / orang in Japan</span></div>`;
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
function fname(n){const w=String(n||"").trim().split(/\s+/);return /^(om|tante|pak|bu|ibu|bapak|ko|koh|ci|cik|mas|mbak|kak|bang)$/i.test(w[0])&&w[1]?w[0]+" "+w[1]:w[0]}
const fdate=d=>d?new Date(d+"T00:00:00").toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"}):"";
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
  <fieldset class="q" data-q="flight"><legend>7 · Which airline will you likely fly?<small>From Bali (DPS) · no direct flights to Osaka, all have 1 stop · best guess is fine</small></legend>
    <div class="callout">Flights are NOT included. Everyone books their own ticket.</div>
    <div class="field"><label for="${p}Air">Likely airline</label><select id="${p}Air"><option value="">Pick one</option>${AIRLINES.map(([a,v])=>`<option value="${esc(a)}">${esc(a)} · ${esc(v)}</option>`).join("")}<option value="Belum tau">Belum tau / cheapest one</option></select></div>
</fieldset>`}
const radio=(p,n)=>{const r=document.querySelector(`input[name="${p}${n}"]:checked`);return r?r.value:""};
const checks=(p,n)=>$$(`input[name="${p}${n}"]:checked`).map(x=>x.value);
function syncExtra(p){$("#"+p+"ExtraBox").hidden=!["partner","family"].includes(radio(p,"Party"))}
function readQ(p){
  const q={name:$("#"+p+"Name").value.trim(),wa:normWa($("#"+p+"Wa").value),bike:radio(p,"Bike"),
    prefs:{dates:checks(p,"Dates"),budget:checks(p,"Budget"),stay:radio(p,"Stay"),bags:radio(p,"Bags"),party:radio(p,"Party"),
      extra:+$("#"+p+"Extra").value||0,riders:$("#"+p+"Riders").value,from:"DPS",airline:$("#"+p+"Air").value}};
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
  $("#"+p+"Extra").value=String(pr.extra||1);$("#"+p+"Riders").value=pr.riders||"yes";{const sel=$("#"+p+"Air");if(pr.airline&&![...sel.options].some(o=>o.value===pr.airline))sel.insertAdjacentHTML("beforeend",`<option value="${esc(pr.airline)}">${esc(pr.airline)}</option>`);sel.value=pr.airline||""}syncExtra(p)}
function complain(p,miss){toast("Please fill in: "+miss.map(x=>x[1]).join(", "));
  const f=miss[0][0],el=f==="name"?$("#"+p+"Name"):f==="wa"?$("#"+p+"Wa"):document.querySelector(`#${p}Q [data-q="${f}"]`);if(el)el.scrollIntoView({behavior:"smooth",block:"center"})}
function answersDl(c){const p=P(c),fi=c.fin||{},fo=c.fout||{};
  const rows=[["Dates",(p.dates||[]).map(dShort).join(", ")||"–"],["Budget",(p.budget||[]).map(t=>TIER[t]).join(", ")||"–"],["Sleep",lab(STAY,p.stay)],["Sepeda",lab(BIKEQ,c.bike)],
    ["Stuff",lab(BAGS,p.bags)],["Coming",partyText(c)],["Airline",p.airline||"–"]];
  if(fi.no||fo.no){const leg=(x,lbl)=>x.no?`${lbl} ${esc(x.no)}${x.date?" · "+esc(fdate(x.date)):""}${x.time?" "+esc(x.time):""}`:`${lbl} not added`;
    rows.push(["Flights",`${leg(fi,"Land KIX")}<br>${leg(fo,"Leave KIX")}<br>${c.fl_status==="booked"?"✓ booked":c.fl_status==="hold"?"looking":"not booked yet"}`])}
  return `<dl>${rows.map(([k,v])=>`<dt>${k}</dt><dd>${k==="Flights"?v:esc(v)}</dd>`).join("")}</dl>`}
let edDirty=false;
function tl(o,labels){const mx=Math.max(1,...Object.values(o));return Object.entries(o).map(([k,v])=>`<div class="r"><span>${esc(labels[k]||k)}</span><span class="b"><i style="width:${v/mx*100}%"></i></span><span>${v}</span></div>`).join("")}
const ORDER={going:0,pending:1,joined:2,out:3};
function renderCrew(){
  const list=crewList(),m=me(),actv=active();
  $("#crewCount").textContent=S.state==="ok"?`${actv.length} joined · ${actv.filter(c=>stage(c)==="going").length} going`:"";
  $("#crewGate").innerHTML=!S.online?`<div class="box pad"><h3 class="disp" style="font-size:26px">Not connected yet</h3><p class="note" style="margin-top:8px">The organiser still needs to add the database keys to config.js.</p></div>`
    :S.state==="loading"?`<div class="empty">Loading crew…</div>`:S.state==="err"?`<div class="empty">Can't reach the server. Check your connection, then reload.</div>`:"";
  $("#regBox").hidden=!(S.online&&S.state!=="loading"&&!m);
  $("#meBox").hidden=!m;
  $("#crewMe").hidden=!m;if(m)$("#crewMe").innerHTML=`<span>You're in · ${stagePill(m)}</span><span class="mono">My profile →</span>`;
  $("#meGate").innerHTML=m?"":S.state==="loading"?`<div class="empty">Loading…</div>`:`<div class="box pad"><h3 class="disp" style="font-size:26px">Not logged in</h3><p class="note" style="margin:6px 0 12px">Join the trip, or log in with the WhatsApp number you joined with.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn small" href="#crew">Join</a><a class="btn small ghost" href="#login">Log in</a></div></div>`;
  if(m){const sg=stage(m),idx=sg==="going"?2:sg==="pending"?1:0;
    $("#meName").textContent=m.name;
    $("#mePhotoWrap").innerHTML=`${avatar(m,"avbig")}<input type="file" accept="image/*" id="mePhoto" hidden><span>${m.photo?"Change":"Add"} photo</span>`;
    $("#mePhoto").onchange=e=>pickPhoto(e,"profile");
    const ix=sg==="going"?3:sg==="pending"?2:1;
    $("#meTrack").innerHTML=sg==="out"?`<div class="now" style="grid-column:1/-1"><b>Not going</b>You said you can't make it</div>`
      :[["Joined ✓","Form received"],[sg==="pending"||sg==="going"?"DP sent ✓":"Pay DP","Transfer + screenshot"],[sg==="going"?"Going ✓":"Approval",sg==="going"?"Approved by George":"George checks BCA"]].map((s,i)=>`<div class="${i<ix?"done":i===ix?"now":""}"><b>${s[0]}</b>${s[1]}</div>`).join("");
    $("#meBanner").hidden=!S.justJoined;
    if(S.justJoined)$("#meBanner").innerHTML=`<b>✓ Application received</b>You're registered, ${esc(fname(m.name))}. Your status stays <b style="display:inline;font:inherit;text-transform:none">Pending</b> until your DP is paid and George approves it.`;
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
    const fi=m.fin||{},fo=m.fout||{};setVal("fiNo",fi.no);setVal("fiDate",fi.date);setVal("fiTime",fi.time);
    setVal("foNo",fo.no);setVal("foDate",fo.date);setVal("foTime",fo.time);setVal("flStatus",m.fl_status||"none");
    $("#flBox").hidden=sg==="out";
  }
  $("#dpAmt").textContent=rp(dpAmount());
  $("#bankName").textContent=S.config.bank_name||"BCA";$("#bankAcct").textContent=S.config.bank_acct||"8400064491";$("#bankHolder").textContent=S.config.bank_holder||"George Widodo";
  const cnt=(keys,get)=>{const t={};keys.forEach(k=>t[k]=0);actv.forEach(c=>{[].concat(get(c)||[]).forEach(v=>{if(v in t)t[v]++})});return t};
  $("#tallyBudget").innerHTML=tl(cnt(["kere","rame","sultan"],c=>P(c).budget),TIER);
  $("#tallyStay").innerHTML=tl(cnt(Object.keys(STAY),c=>P(c).stay),STAYSHORT);
  $("#tallyBike").innerHTML=tl(cnt(["bawa","sewa","tbd"],c=>c.bike),BIKE);
  const sorted=list.slice().sort((a,b)=>ORDER[stage(a)]-ORDER[stage(b)]);
  $("#crewList").innerHTML=sorted.length?sorted.map(c=>{const p=P(c),sg=stage(c);
    return `<button type="button" class="member" data-prof="${esc(c.id)}"><div class="av" style="background:${sg==="going"?"var(--lime)":sg==="pending"?"var(--pink)":"var(--paper)"}">${esc((c.name||"?").trim().charAt(0).toUpperCase())}</div><div style="min-width:0"><h4>${esc(c.name)}${m&&c.id===m.id?' <span class="mono muted">· you</span>':""}</h4>
    <div class="row">${stagePill(c)}${c.bike?`<span class="pill">${BIKE[c.bike]}</span>`:""}</div>
    <div class="meta">${(p.dates||[]).length?"Dates: "+esc((p.dates||[]).map(dShort).join(", ")):""}${p.party&&p.party!=="solo"?" · "+esc(partyText(c)):""}</div><span class="mono muted" style="display:block;margin-top:6px">View profile →</span></div></button>`}).join("")
    :`<div class="empty">${S.online?"Nobody yet. Be the first: fill the form above.":"Crew list shows here once the app is connected."}</div>`;
}

/* ---------- GEAR ---------- */
const GEAR=[
 ["Sepeda",[["bike","Road bike","Bawa in a bike box, or sewa in Osaka",1],["bikebox","Bike box / bag","For the flight (bawa only)"],["rinko","Rinko bag","Japan trains: bikes must be bagged"],["pedals","Pedals + cleats","Rental bikes usually come without",1],["helmet","Helmet","",1],["lights","Front + rear lights","Required after dark in Japan",1],["bell","Bell","Expected on Japanese roads"],["lock","Light lock","Konbini stops",1],["bottles","2 bottles",""],["tubes","2 spare tubes + levers",""],["pump","Mini pump","No CO2 on the plane, buy it in Japan"],["tool","Multi-tool",""],["garmin","Bike computer + charger","",1]]],
 ["Ride kit",[["kit","2 jerseys + 2 bibs","Wash at the bobo"],["gloves","Full-finger gloves","Mornings can be 4°C in March"],["armleg","Arm + knee warmers",""],["gilet","Gilet / windbreaker","Lake Biwa wind"],["rain","Rain jacket","~45% chance of some rain"],["base","Base layer",""],["shoes","Cycling shoes",""],["socks","Socks ×3",""],["cap","Cap / buff",""],["sunnies","Sunglasses",""],["sunscreen","Sunscreen",""],["chamois","Chamois cream",""]]],
 ["Off the bike",[["casual","2 casual outfits",""],["jacket","Warm jacket","Evenings are cold"],["walkshoes","Light walking shoes",""],["sleep","Sleepwear",""],["toilet","Toiletries","Onsen give towels"]]],
 ["Documents + money",[["passport","Passport","Valid 6+ months"],["vjw","Visit Japan Web QR","For immigration + customs"],["yen","Cash yen","Small shops are cash only"],["ic","ICOCA / Suica on phone","Trains + konbini"],["card","Credit card",""],["insurance","Travel insurance incl. cycling",""]]],
 ["Tech",[["phone","Phone + bar mount",""],["powerbank","Power bank","Carry-on only"],["esim","Japan eSIM",""],["adapter","Plug adapter","Japan uses flat 2-pin (Type A)"],["chargers","Chargers + cables",""]]],
 ["Health",[["meds","Personal meds",""],["firstaid","Plasters + painkillers",""],["fuel","Gels + electrolytes","Or konbini onigiri"]]]
];
const GROUP=[["floorpump","Floor pump","For the bobo, saves everyone's arms"],["toolkit","Workshop tool kit","Hex keys, torque key, chain tool"],["lube","Chain lube + rag",""],["firstaidbig","Group first aid kit",""],["spares","Team spares","Spare tire, tire boot, quick links"],["zip","Zip ties + tape",""],["plug","Multi-plug + extension","Charging 6 Garmins at once"],["speaker","Bluetooth speaker","Flex wajib"]];
const GITEMS=GEAR.flatMap(([c,l])=>l.map(i=>({id:i[0],name:i[1],note:i[2],rent:!!i[3],cat:c})));
let myGear=null,gearTimer=null;
const gearOf=c=>c.gear||{};
function packedOf(c){const it=(gearOf(c).items)||{};return GITEMS.filter(i=>it[i.id]&&it[i.id].p).length}
function modeOf(c,id){const it=((gearOf(c).items)||{})[id]||{};if(id==="bike")return c.bike==="sewa"?"sewa":c.bike==="bawa"?"bawa":(it.m||"");return it.m||""}
const avatar=(c,cls)=>c.photo?`<img class="${cls||"avp"}" src="${esc(fileUrl(c.photo))}" alt="${esc(c.name)}" loading="lazy">`:`<span class="${cls||"avp"} ini">${esc((c.name||"?").trim().charAt(0).toUpperCase())}</span>`;
function saveGear(){clearTimeout(gearTimer);gearTimer=setTimeout(()=>{const g=myGear;rpc("fn_update_me",{p_wa:S.wa,p_patch:{gear:g}}).then(()=>{if(myGear===g)myGear=null;refresh()}).catch(()=>toast("Couldn't save. Check your connection."))},700)}
function myG(){const m=me();if(!myGear)myGear=JSON.parse(JSON.stringify(gearOf(m)||{}));myGear.items=myGear.items||{};myGear.shared=myGear.shared||[];return myGear}
function renderGear(){
  const m=me(),list=crewList().filter(c=>c.status!=="out");
  $("#gearGate").innerHTML=m?"":`<div class="box pad"><h3 class="disp" style="font-size:24px">Your packing list lives here</h3><p class="note" style="margin:6px 0 10px">Join first, then tick off what you pack, mark what you'll rent, and add a photo of your bike.</p><a class="btn small" href="#crew">Join / log in</a></div>`;
  $("#myGear").hidden=!m;
  if(m){const g=myGear||gearOf(m),it=g.items||{},n=packedOf({gear:g}),tot=GITEMS.length;
    const typing=document.activeElement&&document.activeElement.id==="gBikeName";
    if(!typing){$("#gMe").innerHTML=`<div class="gme"><label class="phup" title="Change photo">${avatar(m,"avbig")}<input type="file" accept="image/*" id="gPhoto" hidden><span>${m.photo?"Change":"Add"} photo</span></label>
      <div style="min-width:0"><h3 class="disp" style="font-size:28px;overflow-wrap:anywhere">${esc(m.name)}</h3>
      <div class="field" style="margin-top:8px"><label for="gBikeName">My bike</label><input id="gBikeName" maxlength="60" placeholder="${m.bike==="sewa"?"Rental bike (Osaka)":"e.g. Canyon Aeroad, Specialized Tarmac"}" value="${esc(g.bikeName||"")}"></div></div></div>
      <div class="bikeph">${g.bikePhoto?`<img src="${esc(fileUrl(g.bikePhoto))}" alt="My bike">`:`<span>No bike photo yet</span>`}<label class="btn small ghost">${g.bikePhoto?"Change":"Add"} bike photo<input type="file" accept="image/*" id="gBikePhoto" hidden></label></div>
      <div class="sub"><span>Packed ${n} / ${tot}</span><span>${Math.round(n/tot*100)}%</span></div><div class="prog"><i style="width:${n/tot*100}%"></i></div>`;}
    $("#gearList").innerHTML=GEAR.map(([cat,items])=>`<div class="gcat"><div class="sub"><span>${esc(cat)}</span><span>${items.filter(i=>it[i[0]]&&it[i[0]].p).length}/${items.length}</span></div>`+
      items.map(([id,name,note,rent])=>{const st=it[id]||{},md=id==="bike"?modeOf(m,id):st.m||"";
        return `<div class="gi ${st.p?"on":""}"><label><input type="checkbox" data-gp="${id}" ${st.p?"checked":""}><span><b>${esc(name)}</b>${note?`<small>${esc(note)}</small>`:""}</span></label>${rent?`<div class="gseg"><button type="button" data-gm="${id}" data-v="bawa" aria-pressed="${md==="bawa"}">Bawa</button><button type="button" data-gm="${id}" data-v="sewa" aria-pressed="${md==="sewa"}">Sewa</button></div>`:""}</div>`}).join("")+`</div>`).join("");
    if(!typing){const bn=$("#gBikeName");bn.onchange=()=>{myG().bikeName=bn.value.trim();saveGear();toast("Saved")};
    $("#gPhoto").onchange=e=>pickPhoto(e,"profile");
    $("#gBikePhoto").onchange=e=>pickPhoto(e,"bike");}
  }
  const claims={};list.forEach(c=>((gearOf(c).shared)||[]).forEach(id=>(claims[id]=claims[id]||[]).push(c)));
  const mine=m?((myGear||gearOf(m)).shared||[]):[];
  $("#sharedList").innerHTML=GROUP.map(([id,name,note])=>{const who=(claims[id]||[]).filter(c=>!m||c.id!==m.id);if(mine.includes(id)&&m)who.unshift(m);
    return `<div class="gi ${who.length?"on":""}"><span style="flex:1;min-width:0"><b>${esc(name)}</b><small>${note?esc(note)+" · ":""}${who.length?"Bringing: "+who.map(c=>esc(fname(c.name))).join(", "):"Nobody yet"}</small></span>${m?`<button class="btn small ${mine.includes(id)?"":"ghost"}" type="button" data-gs="${id}">${mine.includes(id)?"I'm bringing ✓":"I'll bring it"}</button>`:""}</div>`}).join("");
  $("#gearCount").textContent=list.length?`${list.length} riders`:"";
  $("#crewWall").innerHTML=list.length?list.map(c=>{const g=gearOf(c),n=packedOf(c);
    return `<button class="wcard" type="button" data-prof="${esc(c.id)}">${g.bikePhoto?`<img class="wbike" src="${esc(fileUrl(g.bikePhoto))}" alt="" loading="lazy">`:`<span class="wbike none">${c.bike==="sewa"?"Sewa bike":"No bike photo"}</span>`}
      <span class="wrow">${avatar(c)}<span style="min-width:0"><b>${esc(c.name)}</b><small>${esc(g.bikeName||(c.bike==="sewa"?"Rental bike":c.bike==="bawa"?"Own bike":"Bike TBD"))}</small></span></span>
      <span class="wbar"><i style="width:${n/GITEMS.length*100}%"></i></span><small class="mono">Packed ${n}/${GITEMS.length}</small></button>`}).join("")
    :`<div class="empty">Crew profiles show up here once people join.</div>`;
}
function openProfile(id){const c=S.members.find(x=>x.id===id);if(!c)return;const g=gearOf(c),p=P(c),m=me();
  const rent=GITEMS.filter(i=>i.rent&&modeOf(c,i.id)==="sewa").map(i=>i.name),brings=((g.shared)||[]).map(s=>(GROUP.find(x=>x[0]===s)||[0,s])[1]);
  const n=packedOf(c),mine=m&&m.id===c.id;
  openSheet(mine?"Your profile":"Crew profile",`<div class="gme">${avatar(c,"avbig")}<div style="min-width:0"><h3 class="disp" style="font-size:30px;overflow-wrap:anywhere">${esc(c.name)}</h3><div style="margin-top:6px">${stagePill(c)}</div>
     ${mine?"":`<a class="btn small ghost" style="margin-top:8px" href="https://wa.me/${esc(c.wa)}" target="_blank" rel="noopener">WhatsApp ↗</a>`}</div></div>
   ${g.bikePhoto?`<div class="dphoto" style="margin-top:14px"><img src="${esc(fileUrl(g.bikePhoto))}" alt="${esc(c.name)}'s bike"><span class="tag">${esc(g.bikeName||"The bike")}</span></div>`:""}
   <div class="hl">
     <div><span>Sepeda</span><b>${esc(c.bike==="sewa"?"Sewa":c.bike==="bawa"?"Bawa":"Belum tau")}</b><small>${esc(g.bikeName||"")}</small></div>
     <div><span>Packed</span><b>${n}/${GITEMS.length}</b><small class="wbar" style="margin:4px 0 0;display:block"><i style="width:${n/GITEMS.length*100}%"></i></small></div>
     <div><span>Dates</span><b>${(p.dates||[]).length||"–"}</b><small>${esc((p.dates||[]).map(dShort).join(", "))}</small></div>
     <div><span>Coming</span><b>${p.party&&p.party!=="solo"?"+"+(p.extra||1):"Solo"}</b><small>${p.party&&p.party!=="solo"?esc(RIDERS[p.riders]||""):""}</small></div>
   </div>
   <div class="acard"><dl><dt>Budget</dt><dd>${esc((p.budget||[]).map(t=>TIER[t]).join(", ")||"–")}</dd><dt>Sleep</dt><dd>${esc(lab(STAY,p.stay))}</dd><dt>Airline</dt><dd>${esc(p.airline||"–")}</dd><dt>Flight</dt><dd>${c.fl_status==="booked"?"✓ Booked":c.fl_status==="hold"?"Looking":"Not booked yet"}${(c.fin||{}).no?" · lands "+esc(fdate(c.fin.date))+" "+esc(c.fin.time||""):""}</dd><dt>Renting</dt><dd>${esc(rent.join(", ")||"Nothing")}</dd><dt>Group gear</dt><dd>${esc(brings.join(", ")||"–")}</dd></dl></div>
   ${mine?`<a class="btn small" href="#me" data-close="1" style="margin-top:12px">Edit my profile</a>`:""}`)}

/* ---------- photo crop ---------- */
function cropImage(file,aspect,outW,title){return new Promise(res=>{const url=URL.createObjectURL(file),ov=document.createElement("div");ov.className="crop";
  ov.innerHTML=`<div class="cbox"><div class="mono" style="margin-bottom:10px">${esc(title)}</div><div class="cframe ${aspect===1?"round":""}" style="aspect-ratio:${aspect}"><img alt="" draggable="false"></div>
   <div class="zrow"><span>−</span><input type="range" min="1" max="4" step="0.01" value="1" aria-label="Zoom"><span>+</span></div><p class="note" style="text-align:center;margin:6px 0 12px">Drag to move · pinch or slide to zoom</p>
   <div class="x"><button class="btn ghost" type="button" data-c="0">Cancel</button><button class="btn" type="button" data-c="1">Use photo</button></div></div>`;
  document.body.appendChild(ov);const fr=ov.querySelector(".cframe"),img=fr.querySelector("img"),rng=ov.querySelector("input");
  let s=1,x=0,y=0,base=1,iw=0,ih=0,fw=0,fh=0;const pts=new Map();let last=null,pinch=null;
  const clamp=()=>{const w=iw*base*s,h=ih*base*s;x=Math.min(0,Math.max(fw-w,x));y=Math.min(0,Math.max(fh-h,y))};
  const apply=()=>{clamp();img.style.transform=`translate(${x}px,${y}px) scale(${s})`};
  const zoomTo=(ns,cx,cy)=>{ns=Math.min(4,Math.max(1,ns));x=cx-(cx-x)*ns/s;y=cy-(cy-y)*ns/s;s=ns;rng.value=s;apply()};
  img.onload=()=>{iw=img.naturalWidth;ih=img.naturalHeight;fw=fr.clientWidth;fh=fr.clientHeight;base=Math.max(fw/iw,fh/ih);img.style.width=iw*base+"px";img.style.height=ih*base+"px";x=(fw-iw*base)/2;y=(fh-ih*base)/2;apply()};
  img.src=url;
  rng.oninput=()=>zoomTo(+rng.value,fw/2,fh/2);
  fr.addEventListener("pointerdown",e=>{fr.setPointerCapture(e.pointerId);pts.set(e.pointerId,{x:e.clientX,y:e.clientY});last={x:e.clientX,y:e.clientY};if(pts.size===2){const [a,b]=[...pts.values()];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),s}}});
  fr.addEventListener("pointermove",e=>{if(!pts.has(e.pointerId))return;pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pts.size===2&&pinch){const [a,b]=[...pts.values()],r=fr.getBoundingClientRect();zoomTo(pinch.s*Math.hypot(a.x-b.x,a.y-b.y)/pinch.d,(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top);return}
    if(last){x+=e.clientX-last.x;y+=e.clientY-last.y;last={x:e.clientX,y:e.clientY};apply()}});
  const up=e=>{pts.delete(e.pointerId);if(pts.size<2)pinch=null;last=pts.size?[...pts.values()][0]:null};
  fr.addEventListener("pointerup",up);fr.addEventListener("pointercancel",up);
  ov.addEventListener("click",e=>{const b=e.target.closest("[data-c]");if(!b)return;
    const done=v=>{URL.revokeObjectURL(url);ov.remove();res(v)};
    if(b.dataset.c==="0")return done(null);
    const k=base*s,cv=document.createElement("canvas");cv.width=outW;cv.height=Math.round(outW/aspect);
    const cx=cv.getContext("2d");cx.fillStyle="#fff";cx.fillRect(0,0,cv.width,cv.height);cx.drawImage(img,-x/k,-y/k,fw/k,fh/k,0,0,cv.width,cv.height);
    cv.toBlob(bl=>done(bl),"image/jpeg",.86)})})}
async function pickPhoto(e,kind){const f=e.target.files[0];e.target.value="";if(!f)return;
  const bl=await cropImage(f,kind==="bike"?4/3:1,kind==="bike"?1600:800,kind==="bike"?"Crop your bike photo":"Crop your profile photo");if(!bl)return;
  toast("Uploading…");
  try{const p=await upload(bl,kind==="bike"?"bikes":"profiles");
    if(kind==="bike"){myG().bikePhoto=p;clearTimeout(gearTimer);await act(()=>upMe({gear:myG()}),"Bike photo saved");myGear=null}
    else await act(()=>upMe({photo:p}),"Profile photo saved")}
  catch(err){console.warn(err);toast("Upload failed. Try again on wifi.")}}

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
    ${newJ.length?'<button class="btn small ghost" id="seenBtn" type="button" style="margin-top:8px">Got it, mark as seen</button>':'<p class="note" style="margin:8px 0 0">No notifications. Check this page once a day.</p>'}`;
  {const sn=S.seen||{},rows=list.map(c=>({c,s:sn[c.id]})).sort((a,b)=>(b.s?+new Date(b.s.last_seen):0)-(a.s?+new Date(a.s.last_seen):0));
   const read=x=>{const v=(x.s&&x.s.views)||{};return ["home","rute","crew","gear","dompet"].filter(k=>v[k]).map(k=>k[0].toUpperCase()+k.slice(1)).join(" · ")||"–"};
   const V=S.visits||{recent:[]},mmss=x=>x>=60?Math.floor(x/60)+" min":(x||0)+" sec",tf=d=>new Date(d).toLocaleString("en-GB",{timeZone:"Asia/Makassar",weekday:"short",hour:"2-digit",minute:"2-digit"});
   $("#adminSeen").innerHTML=`<h3 class="disp" style="font-size:24px">Visits</h3><div class="acct" style="margin:8px 0"><div><b>${V.total||0}</b><small>visits</small></div><div><b>${V.devices||0}</b><small>devices</small></div><div><b>${V.today||0}</b><small>last 24h</small></div></div><p class="note" style="margin:0 0 8px">Average time spent: ${mmss(V.avg||0)}. Latest first, your time (WITA).</p>${(V.recent||[]).map(v=>`<div class="mono" style="padding:5px 0;border-top:1px solid var(--line)">${esc(tf(v.started))} · <b>${esc(v.name||"Unknown visitor")}</b> · ${esc(v.device_type||"")} · ${esc(v.tz||"?")} · ${mmss(v.seconds)} · ${esc(v.view||"")}</div>`).join("")||'<p class="note">No visits yet.</p>'}
   <h3 class="disp" style="font-size:24px;margin-top:18px">Who's opened it</h3><p class="note" style="margin:4px 0 8px">Logged-in crew only. Your own visits aren't counted.</p>`+(rows.length?rows.map(x=>`<div class="acard" style="padding:10px 12px"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(x.c.name)}</b><span class="mono">${x.s?esc(ago(x.s.last_seen)):"Not opened yet"}</span></div>${x.s?`<div class="mono" style="margin-top:4px">${x.s.opens}× opened · saw: ${esc(read(x))}${x.c.prefs&&(x.c.prefs.dates||[]).length?" · voted ✓":" · no vote yet"}</div>`:""}</div>`).join(""):`<p class="note">Nobody yet.</p>`)}
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
  const head=["Name","WhatsApp","Status","Dates","Budget","Sleep","Bike","Stuff","Coming with","Extra people","They ride","Airline","Arrival flight","Arrival date","Departure flight","Departure date","Flight status","DP","Joined"];
  const rows=crewList().map(c=>{const p=P(c),fi=c.fin||{},fo=c.fout||{};return [c.name,"+"+c.wa,STAGE[stage(c)][0],(p.dates||[]).map(dShort).join(" / "),(p.budget||[]).map(t=>TIER[t]).join(" / "),lab(STAY,p.stay),lab(BIKEQ,c.bike),lab(BAGS,p.bags),lab(PARTY,p.party),p.extra||0,RIDERS[p.riders]||"",p.airline,fi.no,fi.date,fo.no,fo.date,c.fl_status,dpVerified(c.id)?"paid":"",String(c.created_at||"").slice(0,10)]});
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
    const t=e.target.closest("[data-editdates],[data-goday],[data-d],[data-day],[data-st],[data-sd],[data-spotday],[data-copy],[data-approve],[data-unapprove],[data-reject],[data-delmember],[data-deltx],[data-delmine],[data-ri],.stop,.rt-hit");
    if(!t)return;
    if(t.dataset.editdates){setTimeout(()=>{const b=$("#ansBox");if(b){b.open=true;b.scrollIntoView({behavior:"smooth",block:"start"})}},250)}
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
      waTo(c.wa,`Halo ${fname(c.name)}! DP Bobo Bareng Jepang kamu sudah aku terima ✓\nStatus kamu sekarang: GOING 🚴\nCek app: ${appUrl()}#crew`);
      const hasProof=c.proof&&c.proof.status==="pending";act(()=>hasProof?admin("verify_dp",{member_id:c.id}):admin("mark_dp_paid",{member_id:c.id,amount:dpAmount()}),c.name+" is Going ✓ · DP added to the Dompet");return}
    if(t.dataset.unapprove){if(t.dataset.armed){act(()=>admin("unverify_dp",{member_id:t.dataset.unapprove}),"Approval undone. DP removed from the Dompet.")}else{t.dataset.armed="1";t.textContent="Tap again to undo"}return}
    if(t.dataset.reject){if(t.dataset.armed){const c=S.members.find(x=>x.id===t.dataset.reject);if(c)waTo(c.wa,`Halo ${fname(c.name)}, aku belum nemu transfer DP Bobo Bareng kamu di BCA. Boleh kirim ulang screenshot-nya atau cek lagi transfernya? 🙏`);act(()=>admin("reject_dp",{member_id:t.dataset.reject}),"Sent back. They'll see a note to re-upload or WhatsApp you.")}else{t.dataset.armed="1";t.textContent="Tap again to send back"}return}
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
    act(async()=>{const r=await rpc("fn_login",{p_name:q.name,p_wa:q.wa});S.wa=r.wa;store.set("bobo.wa",r.wa);store.set("bobo.known","1");await upMe({name:q.name,status:"in",bike:q.bike,prefs:q.prefs});S.justJoined=true},"Application received ✓").then(()=>{if(S.justJoined)location.hash="#me"}).finally(()=>btn.disabled=false)});
  $("#loginForm").addEventListener("submit",async e=>{e.preventDefault();const wa=normWa($("#loginWa").value);if(wa.length<10){toast("Check the WhatsApp number");return}
    try{const r=await rpc("fn_login",{p_name:"",p_wa:wa});S.wa=r.wa;store.set("bobo.wa",r.wa);store.set("bobo.known","1");await refresh();location.hash="#home";toast("Welcome back, "+r.name)}
    catch(_){toast("That number hasn't joined yet. Fill the form above.")}});
  ["reg","ed"].forEach(p=>document.getElementById(p+"Q").addEventListener("change",()=>{syncExtra(p);if(p==="ed")edDirty=true}));
  $("#edQ").addEventListener("input",()=>edDirty=true);
  $("#editForm").addEventListener("submit",e=>{e.preventDefault();const {q,miss}=readQ("ed");if(miss.length){complain("ed",miss);return}
    act(async()=>{const r=await upMe({name:q.name,wa:q.wa,bike:q.bike,prefs:q.prefs});S.wa=r.wa;store.set("bobo.wa",r.wa);store.set("bobo.known","1");edDirty=false},"Saved")});
  $("#outBtn").onclick=()=>{const m=me();if(!m)return;const back=m.status==="out";act(()=>upMe({status:back?"in":"out"}),back?"Welcome back!":"Got it. Marked as not going.")};
  $("#logoutTop").onclick=()=>$("#logoutBtn").click();
  $("#logoutBtn").onclick=()=>{S.wa=null;store.set("bobo.wa",null);renderAll();location.hash="#home";toast("Logged out on this phone")};
  $("#copyAmt").onclick=()=>copy(String(dpAmount()),"Amount copied");
  $("#copyAcct").onclick=()=>copy(S.config.bank_acct||"8400064491","Account copied");
  $("#proofBtn").onclick=async()=>{const f=$("#proofFile").files[0];if(!f){toast("Pick the screenshot first");return}
    $("#proofBtn").disabled=true;$("#proofNote").textContent="Uploading…";
    try{const path=await upload(f,"dp");await act(()=>rpc("fn_submit_proof",{p_wa:S.wa,p_path:path}),"Proof sent. Pending verification.")}
    catch(_){toast("Upload failed. Try a smaller screenshot or WhatsApp it to George.");$("#proofNote").textContent=""}
    finally{$("#proofBtn").disabled=false;$("#proofFile").value=""}};
  $("#flightForm").addEventListener("submit",e=>{e.preventDefault();const g=i=>document.getElementById(i).value.trim();
    clean(["fiNo","fiDate","fiTime","foNo","foDate","foTime","flStatus"]);
    act(()=>upMe({fin:{no:g("fiNo").toUpperCase(),from:"DPS",date:g("fiDate"),time:g("fiTime")},fout:{no:g("foNo").toUpperCase(),to:"DPS",date:g("foDate"),time:g("foTime")},fl_status:g("flStatus")}),"Flights saved")});

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
  document.addEventListener("change",e=>{const t=e.target;if(t.dataset&&t.dataset.gp){const g=myG(),o=g.items[t.dataset.gp]||{};o.p=t.checked?1:0;g.items[t.dataset.gp]=o;saveGear();renderGear()}});
  document.addEventListener("click",e=>{const t=e.target.closest("[data-gm],[data-gs],[data-prof],a[data-close]");if(!t)return;if(t.matches("a[data-close]")){closeSheet();return}
    if(t.dataset.prof){openProfile(t.dataset.prof);return}
    if(t.dataset.gm){const id=t.dataset.gm,v=t.dataset.v;if(id==="bike"){act(()=>upMe({bike:v}),v==="sewa"?"Renting a bike in Osaka":"Bringing your own bike");return}
      const g=myG(),o=g.items[id]||{};o.m=o.m===v?"":v;g.items[id]=o;saveGear();renderGear();return}
    if(t.dataset.gs){const g=myG(),id=t.dataset.gs;g.shared=g.shared.includes(id)?g.shared.filter(x=>x!==id):g.shared.concat(id);saveGear();renderGear();toast(g.shared.includes(id)?"Thanks! You're bringing it.":"Removed")}});
  document.addEventListener("click",e=>{if(e.target.id==="seenBtn"){const mx=crewList().reduce((x,c)=>String(c.created_at||"")>x?String(c.created_at):x,"");store.set("bobo.seen",mx);renderAll()}});

  $("#cN").oninput=()=>{C.n=+$("#cN").value;renderCalc()};
  $("#cTier").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;C.tier=b.dataset.v;segSet("cTier",C.tier);renderCalc()});
  $("#cBike").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;C.bike=b.dataset.v;segSet("cBike",C.bike);renderCalc()});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)refresh()});
}

/* ---------- install + updates ---------- */
const BUILD=DATA.build;
const standalone=()=>window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
let deferredInstall=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstall=e;renderInstall()});
function renderInstall(){const c=$("#installCard");if(standalone()||store.get("bobo.noinstall")){c.hidden=true;return}
  const share=`<svg class="shareic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v8h14v-8"/></svg>`;
  c.innerHTML=`<h3>Save it as an app</h3><p class="note" style="margin:6px 0 0">One tap from your home screen, opens full screen like an app. No download.</p>`+
   (deferredInstall?`<div class="x"><button class="btn small" type="button" id="instBtn">Install app</button><button class="btn small ghost" type="button" id="instNo">Later</button></div>`
   :isIOS?`<ol><li>Open this link in <b>Safari</b></li><li>Tap Share ${share} at the bottom</li><li>Tap <b>Add to Home Screen</b> → <b>Add</b></li></ol><div class="x"><button class="btn small ghost" type="button" id="instNo">Done / later</button></div>`
   :`<ol><li>Tap <b>⋮</b> at the top right of Chrome</li><li>Tap <b>Add to Home screen</b> or <b>Install app</b></li></ol><div class="x"><button class="btn small ghost" type="button" id="instNo">Done / later</button></div>`);
  c.hidden=false;
  const ib=$("#instBtn");if(ib)ib.onclick=async()=>{deferredInstall.prompt();try{await deferredInstall.userChoice}catch(_){}deferredInstall=null;renderInstall()};
  $("#instNo").onclick=()=>{store.set("bobo.noinstall","1");c.hidden=true}}
async function checkVersion(){try{const r=await fetch("version.txt?t="+Date.now(),{cache:"no-store"});if(!r.ok)return;const v=(await r.text()).trim();if(v&&BUILD&&v!==BUILD)$("#updBar").hidden=false}catch(_){}}
function hardReload(){location.replace(location.pathname+"?v="+Date.now()+location.hash)}

/* pull down at the top of any page = reload to the latest version (like Cmd+R) */
(function(){const el=$("#ptr"),ic=$("#ptrIc"),tx=$("#ptrTx"),MAX=130,GO=85;let y0=null,dy=0;
  const blocked=t=>!$("#sheet").hidden||!$("#search").hidden||t.closest(".mapwrap,input,textarea,select");
  const show=d=>{el.style.transform=`translate(-50%,${Math.min(d,MAX)-120}px)`;ic.textContent=d>=GO?"↻":"↓";tx.textContent=d>=GO?"Release to update":"Pull to refresh"};
  document.addEventListener("touchstart",e=>{if(window.scrollY>0||e.touches.length>1||blocked(e.target)){y0=null;return}y0=e.touches[0].clientY;dy=0;el.classList.add("drag")},{passive:true});
  document.addEventListener("touchmove",e=>{if(y0===null)return;dy=(e.touches[0].clientY-y0)*.55;if(dy<=0||window.scrollY>0){dy=0;show(-200);return}show(dy)},{passive:true});
  document.addEventListener("touchend",()=>{if(y0===null)return;y0=null;el.classList.remove("drag");
    if(dy>=GO){el.classList.add("go");tx.textContent="Updating…";show(GO);setTimeout(hardReload,150)}else show(-200);dy=0},{passive:true});
})();

function renderChip(){const m=me(),c=$("#meChip");
  if(m){c.classList.add("av");c.href="#me";c.setAttribute("aria-label","My profile");c.innerHTML=m.photo?`<img src="${esc(fileUrl(m.photo))}" alt="">`:PERSON}
  else{c.classList.remove("av");c.removeAttribute("aria-label");const known=store.get("bobo.known");c.href=known?"#login":"#crew";c.textContent=known?"LOG IN":"JOIN"}}
function renderAll(){renderCrew();renderHome();renderGear();renderAdmin();renderWallet();renderDay();renderChip()}

$("#regQ").innerHTML=qHTML("reg");$("#edQ").innerHTML=qHTML("ed");
route();bind();renderInstall();
$("#btnReload").onclick=()=>{$("#btnReload").classList.add("spin");hardReload()};$("#updBtn").onclick=hardReload;
renderDayChips();renderDay();renderSpots();
if(!S.online)S.state="off";
renderAll();tick();setInterval(tick,1000);
if(S.online){refresh();setInterval(()=>{if(!document.hidden)refresh()},20000)}
visit();setInterval(()=>{if(!document.hidden)visit()},20000);checkVersion();setInterval(checkVersion,300000);document.addEventListener("visibilitychange",()=>{if(!document.hidden){visit();checkVersion();touch((location.hash||"#home").slice(1))}});
})();
