const $=s=>document.querySelector(s),app=$('#app');let D=[],M={},tab='all',q='';
const cols=['#4f46e5','#0ea5e9','#10b981','#f59e0b','#ec4899','#8b5cf6','#ef4444'];
const col=e=>cols[[...e.id].reduce((a,c)=>a+c.charCodeAt(0),0)%cols.length];
const gk=e=>e.s[0]=='G';
if(localStorage.dark==1||(!localStorage.dark&&matchMedia('(prefers-color-scheme: dark)').matches))document.body.classList.add('dark');
$('#theme').onclick=()=>{localStorage.dark=document.body.classList.toggle('dark')?1:0};
function head(e){return `<div class="row"><div class="hi">${e.hi}</div><div class="orig ${gk(e)?'gk':''}">${e.o}</div></div>
<div class="row"><div class="pr">${e.pr}</div><div class="en">${e.en}</div></div><div class="m">“${e.m}”</div>`}
function mini(e,extra=''){return `<div class="card ${extra}" style="--c:${col(e)}" onclick="location.hash='${e.id}'">${extra?'<div class="lbl">Name of the Day</div>':''}${head(e)}<div class="en">${e.s} · ${e.ref}</div></div>`}
function list(){const t=q.trim().toLowerCase();
 const r=D.filter(e=>(tab=='all'||e.t==tab)&&(!t||(e.hi+e.en+e.pr+e.m+e.o+e.s).toLowerCase().includes(t)));
 const day=D[Math.floor(Date.now()/864e5)%D.length];
 app.innerHTML=`${t?'':mini(day,'potd')}<input class="search" placeholder="Search name / नाम खोजें" value="${q}">
 <div class="tabs">${[['all','All'],['p','People'],['l','Places']].map(([k,l])=>`<button class="${tab==k?'on':''}" data-t="${k}">${l}</button>`).join('')}</div>
 <div id="res">${r.map(e=>mini(e)).join('')||'<p>No match</p>'}</div><footer>${D.length} names · Strong's (public domain) · IRV Hindi</footer>`;
 const s=$('.search');s.oninput=()=>{q=s.value;const p=s.selectionStart;list();const n=$('.search');n.focus();n.setSelectionRange(p,p)};
 app.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{tab=b.dataset.t;list()})}
const chip=id=>M[id]?`<span class="chip" onclick="location.hash='${id}'">${M[id].hi}</span>`:'';
function txt(e){return `${e.hi} (${e.en})\nमूल: ${e.o} – ${e.pr}\nअर्थ: ${e.m}\n${e.ref}: ${e.v}\n\n${location.href.split('#')[0]}#${e.id}`}
function detail(e){scrollTo(0,0);const rel=[['father','Father'],['mother','Mother'],['spouse','Spouse'],['siblings','Siblings'],['children','Children']].filter(([k])=>e[k]);
 const par=[...(e.father||[]),...(e.mother||[])];
 app.innerHTML=`<button class="back" onclick="location.hash=''">← All names</button>
 <div class="card" style="--c:${col(e)};cursor:auto">${head(e)}
 <div class="lbl">Strong's</div><div>${e.s}</div><div class="lbl">First reference · ${e.ref}</div><div class="verse">${e.v}</div>
 ${rel.length?`<div class="lbl">Family</div><div class="tree">${par.length?`<div class="gen">${par.map(chip).join('')}</div><div class="ar">↓</div>`:''}
 <div class="gen"><span class="chip me">${e.hi}</span>${(e.spouse||[]).map(chip).join('')}${(e.siblings||[]).map(chip).join('')}</div>
 ${e.children?`<div class="ar">↓</div><div class="gen">${e.children.map(chip).join('')}</div>`:''}</div>
 ${rel.map(([k,l])=>`<div class="en" style="margin-top:6px">${l}: ${e[k].map(i=>M[i].hi).join(', ')}</div>`).join('')}`:''}
 ${e.ll?'<div class="lbl">Map</div><div id="map"></div>':''}
 <div class="acts"><button id="spk">🔊 Listen</button><button id="sh">Share</button><button id="wa">WhatsApp</button></div></div>`;
 $('#spk').onclick=()=>{const u=new SpeechSynthesisUtterance(e.hi.split(' (')[0]);u.lang='hi-IN';const v=speechSynthesis.getVoices().find(v=>v.lang.startsWith('hi'));if(v)u.voice=v;speechSynthesis.cancel();speechSynthesis.speak(u)};
 $('#sh').onclick=()=>navigator.share?navigator.share({text:txt(e)}).catch(()=>{}):navigator.clipboard.writeText(txt(e)).then(()=>alert('Copied'));
 $('#wa').onclick=()=>open('https://wa.me/?text='+encodeURIComponent(txt(e)));
 if(e.ll){const go=()=>{if(!window.L)return setTimeout(go,200);const m=L.map('map').setView(e.ll,7);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(m);L.marker(e.ll).addTo(m).bindPopup(e.hi).openPopup()};go()}}
function route(){const id=location.hash.slice(1);M[id]?detail(M[id]):list()}
fetch('names.json').then(r=>r.json()).then(d=>{D=d;d.forEach(e=>M[e.id]=e);route()});addEventListener('hashchange',route);
