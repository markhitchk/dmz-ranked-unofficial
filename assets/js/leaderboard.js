
/* ============================================================
   DMZ RANKED LEADERBOARD  —  single-file app
   Data model is event-sourced: the source of truth is an
   append-only list of raids. SR totals, ranks, and deployment
   fees are all COMPUTED by replaying each player's raids in
   chronological order. This makes merging concurrent writes
   trivial (union raids by id) and keeps the math self-consistent.
   ============================================================ */

/* ---------- Scoring config (from the official rules) ---------- */
const SCORE = {
  operatorKill: 15,
  extraction: 20,
  squadKill: 3,
  squadKillMaxCount: 10,   // +3 each, capped at 30 => 10 kills
  fullSquad: 10,
  regularContract: 10,
  weaponCase: 20,
  huntContract: 20,
  finalExfil: 15,
  bossKill: 10,            // Season 2: +10 per boss
  bossMaxCount: 2          // capped at 2 bosses/raid => +20
};
/* Season-2 features (boss kills + milestones) stay dormant until the admin turns
   them on for a season. The flag lives on the season object so it syncs to everyone. */
function s2on(){ return !!(state.season && state.season.s2); }
const TIERS = [
  {name:'Iridescent', min:6000, fee:100},
  {name:'Crimson',    min:5000, fee:75},
  {name:'Diamond',    min:4000, fee:60},
  {name:'Platinum',   min:3000, fee:45},
  {name:'Gold',       min:2000, fee:30},
  {name:'Silver',     min:1000, fee:15},
  {name:'Bronze',     min:0,    fee:0}
];
function tierFor(sr){ for(const t of TIERS){ if(sr>=t.min) return t; } return TIERS[TIERS.length-1]; }
/* Division + progress-to-next-rank. Each tier splits into 1/2/3 by thirds of its SR range (enter at 1, climb to 3, then promote).
   The apex tier (Iridescent, index 0) has no divisions — it's a live #-ranked ladder instead.
   This is a display layer only: it never changes how SR is computed or the per-tier fees. */
const RANKBADGE={"Bronze1":"/assets/legacy/leaderboard-015-2808c49bc0d5.webp","Bronze2":"/assets/legacy/leaderboard-016-aab15b196781.webp","Bronze3":"/assets/legacy/leaderboard-017-2f667e976d25.webp","Silver1":"/assets/legacy/leaderboard-018-3670db732b01.webp","Silver2":"/assets/legacy/leaderboard-019-fabeb4b98e63.webp","Silver3":"/assets/legacy/leaderboard-020-024fab70c140.webp","Gold1":"/assets/legacy/leaderboard-021-ae25abe446ef.webp","Gold2":"/assets/legacy/leaderboard-022-1871fb11f48a.webp","Gold3":"/assets/legacy/leaderboard-023-d87ab61f5656.webp","Platinum1":"/assets/legacy/leaderboard-024-11058ef86ddc.webp","Platinum2":"/assets/legacy/leaderboard-025-b6dedd8835ef.webp","Platinum3":"/assets/legacy/leaderboard-026-969f97d0f03d.webp","Diamond1":"/assets/legacy/leaderboard-027-f69ddb397114.webp","Diamond2":"/assets/legacy/leaderboard-028-4d6d5c4cc2b6.webp","Diamond3":"/assets/legacy/leaderboard-029-39c25e869058.webp","Crimson1":"/assets/legacy/leaderboard-030-a0647cc76270.webp","Crimson2":"/assets/legacy/leaderboard-031-836e8c92b2f4.webp","Crimson3":"/assets/legacy/leaderboard-032-1ddce018435d.webp","Iridescent":"/assets/legacy/leaderboard-033-c86a3f83ab50.webp","Top":"/assets/legacy/leaderboard-034-ebef3a3576d3.webp"};
/* Division-specific rank emblem for app rows/profile. Apex(Iridescent) uses the single snake; the top-3 skull stays in its own elite column. */
function appBadge(ri,tier){ if(!ri) return ""; if(ri.isApex) return RANKBADGE.Iridescent||""; return RANKBADGE[tier+ri.div]||RANKBADGE[tier+"1"]||""; }
function rankInfo(sr){
  sr = Math.max(0, sr||0);
  let ti = TIERS.findIndex(t=> sr>=t.min); if(ti<0) ti = TIERS.length-1;
  const t = TIERS[ti];
  if(ti===0){ return { tier:t.name, isApex:true, label:t.name, roman:'', pct:100, toNext:0, nextLabel:'' }; }
  const upper = TIERS[ti-1].min, span = upper - t.min, D = 3, dw = span/D;
  let d = Math.floor((sr - t.min)/dw); if(d<0) d=0; if(d>D-1) d=D-1;
  const roman = ['I','II','III'][d];
  const divFloor = t.min + d*dw, nextFloor = t.min + (d+1)*dw;
  const toNext = Math.max(0, Math.ceil(nextFloor - sr));
  const denom = (nextFloor - divFloor) || 1;
  const pct = Math.max(0, Math.min(100, ((sr - divFloor)/denom)*100));
  const nextLabel = (d<D-1) ? (t.name+' '+['I','II','III'][d+1]) : (TIERS[ti-1].name + (ti-1===0 ? '' : ' I'));
  return { tier:t.name, isApex:false, label:t.name+' '+roman, roman, div:d+1, pct, toNext, nextLabel };
}
/* Division-aware deployment fee. Each tier's base fee applies to Division I (just
   promoted in); every division you climb inside the tier adds DIV_FEE_STEP more,
   so the fee ramps smoothly with your rank instead of jumping only at tier lines.
   Iridescent (apex) has no divisions, so it stays a flat fee. Driven off TIERS +
   rankInfo so it stays in sync if the tiers ever change. */
const DIV_FEE_STEP = 5;
function feeFor(sr){
  const base = tierFor(sr).fee;
  const ri = rankInfo(sr);
  if(ri.isApex) return base;
  return base + (ri.div - 1) * DIV_FEE_STEP;
}

/* ============================================================
   Hot / cold streak flair for the leaderboard — based on EXFILS.
   Hot = trailing run of raids the player extracted from (got out alive).
   Cold = trailing run of raids with no exfil (died / left empty-handed).
   Exfil is hard (~33% of raids), so a run of them is a real flex, and death
   spirals happen often enough that the ice actually shows. 2+/4+/6+ = tier 1/2/3.
   Carryover rows are skipped. All graphics are inline animated SVG, no emoji.
   ============================================================ */
function streakInfo(p){
  const real = (p.raids||[]).filter(r=> r.carryover == null);
  if(!real.length) return { type:null, level:0, count:0 };
  const lastEx = !!real[real.length-1].extracted;
  let n=0;
  for(let i=real.length-1; i>=0; i--){ if(!!real[i].extracted === lastEx) n++; else break; }
  if(n<2) return { type:null, level:0, count:n };
  return { type: lastEx?'hot':'cold', level: n>=6?3 : n>=4?2 : 1, count:n };
}
/* Shared gradient defs — injected once so repeated row icons share them (no dup IDs). */
const STREAK_IMG = {"hot": ["/assets/legacy/leaderboard-035-f7fd52d62a3c.webp", "/assets/legacy/leaderboard-036-a8678967e7d0.webp", "/assets/legacy/leaderboard-037-9fff56a37633.webp"], "cold": ["/assets/legacy/leaderboard-038-4b2ffb04b4b2.webp", "/assets/legacy/leaderboard-039-30efa8801c5b.webp", "/assets/legacy/leaderboard-040-c058bc960a6a.webp"]};
const STREAK_DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <linearGradient id="sFlameOut" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffe14d"/><stop offset=".4" stop-color="#ff8a00"/><stop offset=".74" stop-color="#ff3d1f"/><stop offset="1" stop-color="#d81b00"/></linearGradient>
  <linearGradient id="sFlameCore" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fffef0"/><stop offset=".6" stop-color="#ffe98a"/><stop offset="1" stop-color="#ffb01e"/></linearGradient>
  <linearGradient id="sIce" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eaf8ff"/><stop offset=".5" stop-color="#8fd4ff"/><stop offset="1" stop-color="#3a9bff"/></linearGradient>
  <radialGradient id="sIceCore"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#bfe9ff"/></radialGradient>
</defs></svg>`;
function flameSVG(w){ return `<svg class="s-flame" width="${w}" height="${Math.round(w*26/22)}" viewBox="0 0 22 26" aria-hidden="true"><path d="M11 2 C 8 8.5 5 11 5 16.8 A 6 6 0 0 0 17 16.8 C 17 12 14 9 11 2 Z" fill="url(#sFlameOut)"/><path d="M11 12.5 C 9.6 15 8.8 16.4 8.8 18.6 A 2.4 2.4 0 0 0 13.2 18.6 C 13.2 16.6 12.2 15.2 11 12.5 Z" fill="url(#sFlameCore)"/></svg>`; }
function snowSVG(w){ const spoke='M12 12 V2.6 M12 5.6 L9.7 3.9 M12 5.6 L14.3 3.9 M12 8.2 L10.3 7 M12 8.2 L13.7 7';
  const arms=[0,60,120,180,240,300].map(a=>`<path d="${spoke}" transform="rotate(${a} 12 12)"/>`).join('');
  return `<svg class="s-snow" width="${w}" height="${w}" viewBox="0 0 24 24" aria-hidden="true"><g stroke="url(#sIce)" stroke-width="1.5" stroke-linecap="round" fill="none">${arms}</g><circle cx="12" cy="12" r="1.6" fill="url(#sIceCore)"/></svg>`; }
function icicleSVG(w){ return `<svg class="s-icic" width="${w}" height="${Math.round(w*26/28)}" viewBox="0 0 28 26" aria-hidden="true"><g fill="url(#sIce)"><path d="M3 3 L7 3 L5 19 Z"/><path d="M8 3 L13 3 L10.5 25 Z"/><path d="M14 3 L18 3 L16 15 Z"/><path d="M19 3 L24 3 L21.5 21 Z"/></g><rect x="1.5" y="1.5" width="25" height="3" rx="1.4" fill="url(#sIceCore)"/></svg>`; }
function streakHTML(s){
  if(!s || !s.type) return '';
  const label = s.type==='hot' ? ('On fire — '+s.count+' exfils in a row') : ('Ice cold — '+s.count+' raids without an exfil');
  let inner;
  if(s.type==='hot'){
    inner = s.level===3 ? `<span class="s-cluster">${flameSVG(13)}${flameSVG(21)}${flameSVG(13)}</span>` : flameSVG(s.level===2?24:18);
  } else {
    inner = s.level===3 ? icicleSVG(26) : snowSVG(s.level===2?23:18);
  }
  return `<span class="streak ${s.type} l${s.level}" title="${label}">${inner}</span>`;
}

/* Exclusive "Top 3" badges for the elite tiers (Platinum → Iridescent). */
const TIER_BADGE = { Platinum:'/assets/legacy/leaderboard-041-f06f253938fe.webp', Diamond:'/assets/legacy/leaderboard-042-6fc8cceb97b5.webp', Crimson:'/assets/legacy/leaderboard-043-9cb9f37aaf47.webp', Iridescent:'/assets/legacy/leaderboard-044-5ee36b70fc54.webp' };
/* standings are sorted by SR desc, so the first 3 seen per elite tier are that tier's top 3. */
function eliteBadges(standings){
  const out={}, seen={};
  standings.forEach(p=>{
    if(p.tier!=='Iridescent' || !TIER_BADGE[p.tier] || p.sr<=0) return;
    seen[p.tier]=(seen[p.tier]||0)+1;
    if(seen[p.tier]<=3) out[p.id]={ badge:TIER_BADGE[p.tier], tier:p.tier, rank:seen[p.tier] };
  });
  return out;
}

/* ---------- Gross SR earned in a single raid ---------- */
function grossEarned(r){
  let e = 0;
  if(r.carryover) e += Number(r.carryover)||0;   // imported starting SR (from Google Sheets etc.)
  e += (r.operatorKills||0) * SCORE.operatorKill;
  e += Math.min(r.squadKills||0, SCORE.squadKillMaxCount) * SCORE.squadKill;
  if(r.extracted){
    e += SCORE.extraction;
    if(r.weaponCase) e += SCORE.weaponCase;
    if(r.fullSquad)  e += SCORE.fullSquad;
    if(r.finalExfil) e += SCORE.finalExfil;
  }
  if(r.contract === 'regular') e += SCORE.regularContract;
  else if(r.contract === 'hunt') e += SCORE.huntContract;
  if(s2on()) e += Math.min(r.bossKills||0, SCORE.bossMaxCount) * SCORE.bossKill;   // Season 2 only
  return e;
}

/* ============================================================
   Safety: offensive-name filter + suspicious-raid approval
   ============================================================ */
/* Default blocklist — slurs and hard profanity. Admin can edit the list in
   Settings; it's stored in meta so it syncs to everyone. Matching is done on a
   normalized form (leetspeak folded, symbols/spaces stripped) so "n1_gg3r" is
   caught the same as the plain word. */
/* Top 30 most hateful / profane — slurs first, then hard profanity. Matching folds
   leetspeak and repeats, so one entry covers most spellings. Admins can edit this list. */
const DEFAULT_BADWORDS = ['nigger','nigga','faggot','fag','retard','chink','spic','kike','gook','wetback','beaner','coon','tranny','dyke','nazi','cunt','whore','slut','fuck','shit','bitch','bastard','cock','pussy','dick','asshole','motherfucker','rape','rapist','pedophile'];
const DEFAULT_FILTER = { enabled:true, opk:30, earn:600, words:DEFAULT_BADWORDS.slice(), velo:true, veloMin:8, veloMax:5, probFactor:3, minGap:5, proofMinKills:10 };
function sanitizeFilter(f){
  f = (f && typeof f==='object') ? f : {};
  const words = Array.isArray(f.words) ? f.words.map(w=>String(w).toLowerCase().trim()).filter(Boolean) : DEFAULT_BADWORDS.slice();
  // Back-compat: an older saved filter may carry probN (hold-first-N). Fall back to the new factor default.
  const pf = Number.isFinite(+f.probFactor) ? Math.max(0, Math.min(20, +f.probFactor)) : 3;
  return { enabled: f.enabled!==false,
    opk: Number.isFinite(+f.opk)? Math.max(0,+f.opk) : 30,
    earn: Number.isFinite(+f.earn)? Math.max(0,+f.earn) : 600,
    velo: f.velo!==false,
    veloMin: Number.isFinite(+f.veloMin)? Math.max(0,+f.veloMin) : 8,
    veloMax: Number.isFinite(+f.veloMax)? Math.max(0,+f.veloMax) : 5,
    minGap: Number.isFinite(+f.minGap)? Math.max(0,+f.minGap) : 5,
    proofMinKills: Number.isFinite(+f.proofMinKills)? Math.max(0,+f.proofMinKills) : 10,
    probFactor: pf,
    words: words.length ? words : DEFAULT_BADWORDS.slice() };
}
const LEET = {'@':'a','4':'a','8':'b','(':'c','<':'c','3':'e','6':'g','9':'g','1':'i','!':'i','|':'i','0':'o','5':'s','$':'s','7':'t','+':'t','2':'z'};
function normName(s){ s=String(s||'').toLowerCase(); let o=''; for(const ch of s){ o += (LEET[ch]!==undefined?LEET[ch]:ch); } return o.replace(/[^a-z]/g,''); }
function collapseRuns(s){ return s.replace(/(.)\1+/g,'$1'); }   // "niiig" -> "nig", beats padded evasion
function currentFilter(){ return (state && state.filter) ? state.filter : DEFAULT_FILTER; }
/* ---- Automatic season schedule ---- */
const DEFAULT_SEASONCFG = { auto:true, lengthDays:14, finalEnd:'2026-10-23' };
function sanitizeSeasonCfg(c){
  c = (c && typeof c==='object') ? c : {};
  return { auto: c.auto!==false,
    lengthDays: (Number.isFinite(+c.lengthDays) && +c.lengthDays>0) ? Math.min(90, Math.round(+c.lengthDays)) : 14,
    finalEnd: (typeof c.finalEnd==='string' && /^\d{4}-\d{2}-\d{2}$/.test(c.finalEnd)) ? c.finalEnd : '2026-10-23' };
}
function seasonCfg(){ return (state && state.seasonCfg) ? state.seasonCfg : DEFAULT_SEASONCFG; }
const DAY_MS = 86400000;
/* Returns the offending word if the name should be blocked, else null. */
function nameBlocked(name){
  const f = currentFilter();
  if(!f.enabled) return null;
  const n = normName(name), nc = collapseRuns(n);
  for(const w of (f.words||[])){
    const ww = normName(w); if(ww.length < 3) continue;   // ignore ultra-short tokens (false-positive magnets)
    if(n.includes(ww) || nc.includes(collapseRuns(ww))) return w;
  }
  return null;
}
/* Returns a human reason if a raid is abnormally high (should wait for approval), else null. */
function raidSuspicious(r){
  const f = currentFilter();
  if((r.operatorKills||0) > f.opk) return 'operator kills ('+(r.operatorKills||0)+')';
  const earned = grossEarned(r);
  if(earned > f.earn) return 'single-raid SR (+'+earned+')';
  return null;
}
/* Velocity guard: a real DMZ raid takes ~20-40 min, so raids logged too close together
   (or too many in an hour) are almost certainly fabricated → hold for review. */
function velocityHold(raid){
  const f = currentFilter(); if(f.velo===false) return null;
  const p = playerByName(raid.playerName); if(!p) return null;   // brand-new name has no history to compare
  const mine = (state.raids||[]).filter(r=> r.playerId===p.id && r.carryover==null && !r.pending && !r.deleted);
  if(!mine.length) return null;
  const now = raid.ts || Date.now();
  const gapMin = f.veloMin||0, maxHr = f.veloMax||0;
  if(gapMin>0){
    const last = Math.max(...mine.map(r=> r.ts||0));
    const mins = Math.round((now-last)/60000);
    if(now-last < gapMin*60000) return 'logged '+(mins<1?'<1':mins)+' min after last raid';
  }
  if(maxHr>0){
    const inHour = mine.filter(r=> now-(r.ts||0) < 3600000).length;
    if(inHour >= maxHr) return 'too many raids in one hour ('+(inHour+1)+')';
  }
  return null;
}
/* Real, non-pending, in-season raids — the pool we judge "normal" against. */
function communityRealRaids(){ return (state.raids||[]).filter(r=> r.carryover==null && !r.pending && !r.deleted && inSeason(r)); }
const ESTABLISHED_RAIDS = 10;   // once an operator has this many logged, they're no longer a "newcomer"
/* New-operator outlier hold: a fresh/unproven name only waits for review if their raid is a
   wide outlier against the community's own numbers — a modest first raid sails straight through.
   Established or admin-trusted operators are exempt (their big games aren't second-guessed here). */
function probationHold(name, raid){
  const f = currentFilter(); const factor = f.probFactor||0; if(factor<=0) return null;
  const p = playerByName(name);
  if(p && p.trusted) return null;                                  // admin already vouched for them
  const pid = p ? p.id : null;
  const mine = pid ? (state.raids||[]).filter(r=> r.playerId===pid && !r.pending && !r.deleted && r.carryover==null).length : 0;
  if(mine >= ESTABLISHED_RAIDS) return null;                       // proven track record → not a newcomer
  const all = communityRealRaids();
  if(all.length < ESTABLISHED_RAIDS) return null;                  // not enough data yet to call an outlier
  const medOpk  = median(all.map(r=> r.operatorKills||0));
  const medEarn = median(all.map(r=> grossEarned(r)));
  const opk = raid.operatorKills||0, earn = grossEarned(raid);
  // Only relative-flag a raid that's already NEAR the absolute cap, so a normal early-season
  // raid (high only because the median is tiny when few raids exist yet) sails straight through.
  const OPK_FLOOR = Math.max(8, Math.round((f.opk||30)*0.6)), EARN_FLOOR = Math.max(200, Math.round((f.earn||600)*0.6));
  if(medOpk>0  && opk  >= OPK_FLOOR  && opk  >= medOpk*factor)  return 'new operator — '+opk+' op kills is '+(Math.round(opk/medOpk*10)/10)+'× the community norm';
  if(medEarn>0 && earn >= EARN_FLOOR && earn >= medEarn*factor) return 'new operator — +'+earn+' SR is '+(Math.round(earn/medEarn*10)/10)+'× the community norm';
  return null;
}

/* ============================================================
   State + storage
   ============================================================ */
/* The browser reads published snapshots and sends writes to the Go API. */
const LEADERBOARD_SNAPSHOT = '/leaderboard.json';
const DATA_API = '/api/v1/data';
const OLD_NPOINT_URL = 'https://api.npoint.io/619f3a453fc50135e089';   // legacy store — used only by the one-time import

let state = { players: [], raids: [], season: { name:'Season 1', start:null, end:null, updatedAt:0 }, pastSeasons: [], pinHash: '', adminPinConfigured: true };
let settingsUnlocked = false;   // derived: is the Settings area currently open?
let sessionUnlocked = false;    // did the admin enter the PIN this session? (never persisted)
/* lightweight, non-cryptographic hash — a deterrent to stop casual tampering, not hard security */
function pinHashOf(pin){ let h=5381; const s='dmz:'+String(pin); for(let i=0;i<s.length;i++){ h=((h<<5)+h+s.charCodeAt(i))>>>0; } return 'p'+h.toString(36); }
let lastSnapshotVersion = null;
let snapshotMustAdvanceFrom = null; // keep a writer on fresh data until its rev bump reaches the CDN
let pollTimer = null;
let saving = false;
let exfilChoice = null;   // 'yes' | 'no' | null — explicit extraction outcome per raid
let idleTimer = null;     // auto-lock Settings after inactivity
let currentTab = 'board';
let leadersView = 'cards';   // Leaders tab: 'cards' | 'chart'
let currentSub = 'leaders';  // Community tab sub-view: 'leaders' | 'watch' | 'shame'

/* localStorage is optional (may be blocked in sandboxed frames) — always guard it */
function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function lsSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
/* Per-device dedupe so one person can't spam the same report. */
function reportedSet(){ try{ return JSON.parse(lsGet('dmz_reported')||'[]'); }catch(e){ return []; } }
function reportedLocally(key){ return reportedSet().indexOf(key) >= 0; }
function markReportedLocally(key){ const s=reportedSet(); if(s.indexOf(key)<0){ s.push(key); lsSet('dmz_reported', JSON.stringify(s.slice(-500))); } }
function unmarkReportedLocally(key){ lsSet('dmz_reported', JSON.stringify(reportedSet().filter(k=>k!==key))); }
/* Flip a report button between its two states without a full re-render. */
function markBtnReported(btn){
  if(!btn || !btn.classList) return;
  btn.classList.add('reported');
  if(btn.classList.contains('rl-report')) btn.title = 'You reported this — tap to undo';
  else { btn.textContent = '⚑ Reported'; btn.title = 'Tap to remove your report'; }
}
function markBtnUnreported(btn){
  if(!btn || !btn.classList) return;
  btn.classList.remove('reported');
  if(btn.classList.contains('rl-report')) btn.title = 'Report this raid to an admin';
  else if(btn.classList.contains('pf-reportbtn')){ btn.textContent = '⚑ Report this operator'; btn.title = 'Flag this operator for an admin to review'; }
  else { btn.textContent = '⚑ Report'; btn.title = ''; }
}

/* ---------- Networking (application API) ---------- */
let adminToken = '';
const verifiedPlayerSessions = Object.create(null);
const checkedPlayerSessions = Object.create(null);
const playerSessionChecks = Object.create(null);
let pendingPlayerPIN = '';
function setAdminToken(t){ adminToken = t||''; }

function assembleState(raids, players, meta){
  const st = normalize({
    raids, players,
    season:  meta.season,
    pastSeasons: meta.pastSeasons,
    pinHash: (typeof meta.pinHash==='string') ? meta.pinHash : '',
    adminPinConfigured: !!meta.adminPinConfigured || (typeof meta.pinHash==='string' && !!meta.pinHash),
    filter: meta.filter,
    snapshot: meta.snapshot,
    polls: meta.polls,
    pollDefs: meta.pollDefs,
    seasonCfg: meta.seasonCfg,
    suggestions: meta.suggestions,
    donate: meta.donate
  });
  st.__rev = (meta.rev != null) ? meta.rev : null;
  return st;
}
async function remoteGet(token){
  const res=await fetch(DATA_API+'/state',{headers:{'X-Admin-Token':token||adminToken},cache:'no-store'});
  if(!res.ok) throw new Error('Private state '+res.status);
  const data=await res.json();
  return assembleState(data.raids||[],data.players||[],data.meta||{});
}
async function remotePublicState(){
  const res=await fetch(DATA_API+'/public-state',{cache:'no-store'});
  if(!res.ok) throw new Error('Current board '+res.status);
  const data=await res.json();
  if(!Array.isArray(data.players)||!Array.isArray(data.raids)||!data.meta) throw new Error('Invalid current board');
  return assembleState(data.raids,data.players,data.meta);
}
/* Public read path: one compact document cached at Cloudflare. Private values that
   were loaded for an active admin/player workflow stay in memory but never come
   from the public snapshot. */
async function remoteSnapshot(){
  const manifestRes = await fetch(LEADERBOARD_SNAPSHOT+'?manifest=1');
  if(!manifestRes.ok) throw new Error('snapshot manifest '+manifestRes.status);
  const manifest = await manifestRes.json();
  if(!manifest || typeof manifest.version!=='string' || typeof manifest.url!=='string') throw new Error('invalid leaderboard snapshot manifest');
  if(snapshotMustAdvanceFrom===null && lastSnapshotVersion && manifest.version===lastSnapshotVersion){
    return {__snapshotVersion:manifest.version,__unchanged:true};
  }
  const res = await fetch(manifest.url);
  if(!res.ok) throw new Error('snapshot '+res.status);
  const envelope = await res.json(), data = envelope && envelope.data;
  if(envelope.version!==manifest.version) throw new Error('snapshot version changed while loading');
  if(!data || !Array.isArray(data.players) || !Array.isArray(data.raids)) throw new Error('invalid leaderboard snapshot');
  if(snapshotMustAdvanceFrom!==null && JSON.stringify(envelope.sourceRevision)===JSON.stringify(snapshotMustAdvanceFrom)) return {__snapshotVersion:manifest.version,__unchanged:true};
  snapshotMustAdvanceFrom=null;
  const oldPlayers = indexById(state.players||[]), oldRaids = indexById(state.raids||[]);
  const players = data.players.map(p=>{
    const next=Object.assign({},p), old=oldPlayers[p.id];
    if(next.pinConfigured && old && old.pin) next.pin=old.pin;
    return next;
  });
  const raids = data.raids.map(r=>{
    const next=Object.assign({},r), old=oldRaids[r.id];
    if(next.proofProvided && old){ if(old.proofImg) next.proofImg=old.proofImg; if(old.proofUrl) next.proofUrl=old.proofUrl; }
    return next;
  });
  const st = normalize(Object.assign({},data,{players,raids,pinHash:data.adminPinConfigured?state.pinHash:'',adminPinConfigured:!!data.adminPinConfigured}));
  st.__rev = envelope.sourceRevision!=null ? envelope.sourceRevision : null;
  st.__snapshotVersion = envelope.version || null;
  return st;
}
function normalize(o){
  o = o || {};
  const pinHash = typeof o.pinHash==='string' ? o.pinHash : '';
  const season = Object.assign({ name:'Season 1', start:null, end:null, updatedAt:0 },
    (o.season && typeof o.season==='object') ? o.season : {});
  return {
    players: Array.isArray(o.players)?o.players:[],
    raids: Array.isArray(o.raids)?o.raids:[],
    season: season,
    pastSeasons: Array.isArray(o.pastSeasons)?o.pastSeasons:[],
    pinHash: pinHash,
    adminPinConfigured: typeof o.adminPinConfigured==='boolean' ? o.adminPinConfigured : !!pinHash,
    filter: sanitizeFilter(o.filter),
    snapshot: (o.snapshot && typeof o.snapshot==='object') ? o.snapshot : null,
    polls: (o.polls && typeof o.polls==='object') ? o.polls : {},
    pollDefs: Array.isArray(o.pollDefs) ? o.pollDefs : undefined,
    seasonCfg: sanitizeSeasonCfg(o.seasonCfg),
    suggestions: Array.isArray(o.suggestions) ? o.suggestions : [],
    donate: sanitizeDonate(o.donate)
  };
}
/* Community donation link (admin-set). URL must be http(s); label optional. */
function sanitizeDonate(d){
  d = (d && typeof d==='object') ? d : {};
  const url = (typeof d.url==='string' && /^https?:\/\//i.test(d.url)) ? d.url.slice(0,300) : '';
  const label = (typeof d.label==='string' && d.label.trim()) ? d.label.trim().slice(0,32) : 'Support';
  return { url, label };
}

/* ---------- Merge (union by id) so concurrent writes don't clobber ---------- */
function mergeStates(a, b){
  a = a||{}; b = b||{};
  const players = {}, raids = {}, past = {};
  (a.players||[]).forEach(p=>players[p.id]=p);
  (b.players||[]).forEach(p=>{ if(!players[p.id]) players[p.id]=p; });
  (a.raids||[]).forEach(r=>raids[r.id]=r);
  (b.raids||[]).forEach(r=>{ if(!raids[r.id]) raids[r.id]=r; });
  (a.pastSeasons||[]).forEach(s=>past[s.id]=s);
  (b.pastSeasons||[]).forEach(s=>{ if(!past[s.id]) past[s.id]=s; });
  // season: whichever was edited most recently wins
  const sa = a.season||{}, sb = b.season||{};
  const season = ((sb.updatedAt||0) > (sa.updatedAt||0)) ? sb : (sa.name!==undefined ? sa : sb);
  return { players:Object.values(players), raids:Object.values(raids),
    season: season||{ name:'Season 1', start:null, end:null, updatedAt:0 },
    pastSeasons: Object.values(past),
    pinHash: (typeof a.pinHash==='string') ? a.pinHash : (b.pinHash||''),
    adminPinConfigured: typeof a.adminPinConfigured==='boolean' ? a.adminPinConfigured : !!(a.pinHash||b.pinHash||b.adminPinConfigured),
    filter: a.filter || b.filter,
    snapshot: (a.snapshot!==undefined ? a.snapshot : b.snapshot),
    polls: Object.assign({}, b.polls||{}, a.polls||{}),
    pollDefs: (a.pollDefs!==undefined ? a.pollDefs : b.pollDefs),
    seasonCfg: (a.seasonCfg || b.seasonCfg),
    suggestions: mergeSuggestions(a.suggestions, b.suggestions),
    donate: (a.donate || b.donate) };
}
/* Union suggestions by id; on a duplicate keep the higher vote count so a concurrent
   upvote is never lost when two saves merge. */
function mergeSuggestions(a, b){
  const m = {};
  (b||[]).forEach(s=>{ if(s && s.id!=null) m[s.id]=s; });
  (a||[]).forEach(s=>{ if(s && s.id!=null){ const ex=m[s.id]; m[s.id] = (ex && (ex.votes||0) > (s.votes||0)) ? ex : s; } });
  return Object.values(m);
}

/* Apply a change as targeted row operations instead of rewriting the whole store.
   We read the freshest board, let the (unchanged) mutator produce the desired next
   state, then write ONLY the differences: new/edited raids are upserted, deleted
   raids are removed by id, and the same for players + the season/pinHash meta rows.
   Because a new raid is its own INSERT (never a rewrite of the whole list), two
   people submitting at the same moment can't overwrite each other's entries. */
function indexById(arr){ const m={}; (arr||[]).forEach(o=>{ if(o && o.id!=null) m[o.id]=o; }); return m; }

async function persist(mutator, _verify /* ignored — inserts can't collide */, errorMessageId='logMsg'){
  saving = true; setStatus('sync','Saving…');
  let attempt = 0, lastErr = null;
  while(attempt < 5){
    attempt++;
    try{
      const server = sessionUnlocked && adminToken ? await remoteGet() : await remotePublicState();
      const base   = JSON.parse(JSON.stringify(server));      // snapshot to diff against
      const next   = normalize(mutator ? mutator(server) : server);

      // ---- raids diff ----
      const baseR = indexById(base.raids), nextR = indexById(next.raids);
      const upRaids = [], delRaids = [];
      Object.keys(nextR).forEach(id=>{ if(JSON.stringify(nextR[id]) !== JSON.stringify(baseR[id])) upRaids.push({ id:id, data:nextR[id] }); });
      Object.keys(baseR).forEach(id=>{ if(!nextR[id]) delRaids.push(id); });
      // ---- players diff ----
      const baseP = indexById(base.players), nextP = indexById(next.players);
      const upPlayers = [], delPlayers = [];
      Object.keys(nextP).forEach(id=>{ if(JSON.stringify(nextP[id]) !== JSON.stringify(baseP[id])) upPlayers.push({ id:id, data:nextP[id] }); });
      Object.keys(baseP).forEach(id=>{ if(!nextP[id]) delPlayers.push(id); });
      // ---- meta diff (season / pastSeasons / pinHash) ----
      const metaUp = [];
      if(JSON.stringify(next.season)      !== JSON.stringify(base.season))      metaUp.push({ key:'season',      value: next.season });
      if(JSON.stringify(next.pastSeasons) !== JSON.stringify(base.pastSeasons)) metaUp.push({ key:'pastSeasons', value: next.pastSeasons });
      if(JSON.stringify(next.pinHash)     !== JSON.stringify(base.pinHash))     metaUp.push({ key:'pinHash',     value: next.pinHash });
      if(JSON.stringify(next.filter)      !== JSON.stringify(base.filter))      metaUp.push({ key:'filter',      value: next.filter });
      if(JSON.stringify(next.snapshot)    !== JSON.stringify(base.snapshot))    metaUp.push({ key:'snapshot',    value: next.snapshot });
      if(JSON.stringify(next.polls)       !== JSON.stringify(base.polls))       metaUp.push({ key:'polls',       value: next.polls });
      if(JSON.stringify(next.pollDefs)    !== JSON.stringify(base.pollDefs))    metaUp.push({ key:'pollDefs',    value: (next.pollDefs===undefined?null:next.pollDefs) });
      if(JSON.stringify(next.seasonCfg)   !== JSON.stringify(base.seasonCfg))   metaUp.push({ key:'seasonCfg',   value: next.seasonCfg });
      if(JSON.stringify(next.suggestions) !== JSON.stringify(base.suggestions)) metaUp.push({ key:'suggestions', value: next.suggestions });
      if(JSON.stringify(next.donate)      !== JSON.stringify(base.donate))      metaUp.push({ key:'donate',      value: next.donate });

      const changed = upRaids.length || delRaids.length || upPlayers.length || delPlayers.length || metaUp.length;

      if(changed){
        const headers={'Content-Type':'application/json'};
        if(sessionUnlocked && adminToken) headers['X-Admin-Token']=adminToken;
        const playerPIN=pendingPlayerPIN;
        if(playerPIN) headers['X-Player-PIN']=playerPIN;
        const mutation={upsertPlayers:upPlayers,upsertRaids:upRaids,deletePlayerIds:delPlayers,deleteRaidIds:delRaids,upsertMeta:metaUp};
        const res=await fetch(DATA_API+'/mutations',{method:'POST',headers,body:JSON.stringify(mutation),cache:'no-store',credentials:'same-origin'});
        if(!res.ok) throw new Error('Save '+res.status+' '+(await res.text()).slice(0,160));
        snapshotMustAdvanceFrom=server.__rev;
      }
      state = next;
      // Force our own next poll to reconcile with the server, so a save that raced with
      // someone else's still converges to the full board (we can't assume `next` is complete).
      saving = false;
      renderAll(); setStatus('on','Live'); markSynced(); hideBanner();
      return true;
    }catch(e){ lastErr = e; await sleep(400); }
  }
  saving = false;
  setStatus('off','Save failed');
  const kind = classifyErr(lastErr);
  const hint = kind==='network' ? ' — check your connection or open this page in a normal browser tab.' : '';
  showMsg(errorMessageId,'err', 'Could not save: '+(lastErr&&lastErr.message||'network error')+hint);
  bannerForError(kind);
  renderAll();
  return false;
}

async function pull(){
  if(saving) return;
  try{
    let server;
    try{
      server = await remoteSnapshot();
      if(server.__unchanged || (server.__snapshotVersion && server.__snapshotVersion===lastSnapshotVersion)){
        setStatus('on','Live'); markSynced(); hideBanner(); return;
      }
      lastSnapshotVersion = server.__snapshotVersion;
    }catch(snapshotErr){
      console.warn('Cached leaderboard snapshot unavailable; retrying the application backend.',snapshotErr);
      server = await remotePublicState();
      lastSnapshotVersion = null;
    }
    state = server;
    renderAll();
    setStatus('on','Live'); markSynced(); hideBanner();
  }catch(e){
    setStatus('off','Offline');
    bannerForError(classifyErr(e));
  }
}
const sleep = ms => new Promise(r=>setTimeout(r,ms));

/* ============================================================
   Compute standings by replaying raids
   ============================================================ */
/* Current season window: raids logged in [start, end] count toward standings */
function seasonWindow(){
  const s = state.season || {};
  const start = (typeof s.start === 'number') ? s.start : null;
  const end   = (typeof s.end   === 'number') ? s.end + 86399999 : null; // inclusive end-of-day
  return { start, end };
}
function inSeason(r){
  const w = seasonWindow();
  const t = r.ts || 0;
  return (w.start==null || t>=w.start) && (w.end==null || t<=w.end);
}

function computeStandings(){
  const byPlayer = {};
  state.players.forEach(p=>{ byPlayer[p.id] = { id:p.id, name:p.name, sr:0, peak:0, raids:[], lastDelta:0, msCum:{}, msHit:{}, ach:{n:0,opK:0,sqK:0,contracts:0,exfils:0,finalExfils:0,weaponCases:0,bossK:0}, achMax:{} }; });
  // include any orphan raids whose player got deleted, under their stored name
  const sorted = [...state.raids].filter(r=>inSeason(r) && !r.pending && !r.deleted).sort((a,b)=> (a.ts||0)-(b.ts||0));
  sorted.forEach(r=>{
    let pl = byPlayer[r.playerId];
    if(!pl){ pl = byPlayer[r.playerId] = { id:r.playerId, name:r.playerName||'(removed)', sr:0, peak:0, raids:[], lastDelta:0, msCum:{}, msHit:{}, ach:{n:0,opK:0,sqK:0,contracts:0,exfils:0,finalExfils:0,weaponCases:0,bossK:0}, achMax:{} }; }
    const before = pl.sr;
    const fee = feeFor(before);
    let earned = grossEarned(r);
    // Achievement milestones: award SR the first time each of the 10 tracks crosses 1★/2★/3★/◆Diamond
    let achHits = [];
    if(r.carryover == null){
      const A = pl.ach;
      A.n++;
      A.opK += r.operatorKills||0;
      A.sqK += r.squadKills||0;
      if(r.contract==='regular' || r.contract==='hunt') A.contracts++;
      if(r.extracted) A.exfils++;
      if(r.finalExfil) A.finalExfils++;
      if(r.weaponCase && r.extracted) A.weaponCases++;
      A.bossK += Math.min(r.bossKills||0, 2);
      ACHV.filter(a=> !a.s2 || s2on()).forEach(a=>{
        if(a.rate && A.n < (a.min||0)) return;               // rate tracks locked until enough raids
        const lvl = starTier(a.val(A), a.t);
        const prev = pl.achMax[a.key] || 0;
        if(lvl > prev){
          const L = prev + 1;                       // advance at most ONE tier per raid — no multi-tier SR dumps
          const sr = ACH_SR[L-1] || 0; earned += sr;
          achHits.push({ label:a.label, tier:L, sr:sr });
          pl.achMax[a.key] = L;
        }
      });
    }
    const after = Math.max(0, before - fee + earned);
    const rec = Object.assign({}, r, {srBefore:before, fee, earned, delta:after-before, srAfter:after, achHits:achHits});
    pl.raids.push(rec);
    pl.sr = after;
    if(after > pl.peak) pl.peak = after;
    pl.lastDelta = after - before;
  });
  const arr = Object.values(byPlayer).map(p=>{
    const t = tierFor(p.sr);
    return Object.assign(p, { tier:t.name });
  });
  arr.sort((a,b)=> b.sr - a.sr || a.name.localeCompare(b.name));
  return arr;
}

/* ============================================================
   Championship — "Road to 1.0" (season points across the series)
   ============================================================ */
const CHAMP_PTS = [25,20,16,13,11,9,7,5,3,1];   // placement 1..10
const CHALLENGE_PODIUM = [5,3,1];               // challenge board top 3
const ACTIVE_MIN = 8;                            // raids to earn the +2 active bonus
const CHAMP_START = 2;                           // Championship officially begins this season; earlier seasons are preseason and don't count
/* Archived seasons that count toward the Championship (Season 1 was preseason).
   Past seasons are stored in chronological order, so a missing num falls back to index+1. */
function champSeasons(){
  return (state.pastSeasons||[]).map((s,idx)=>({ s, num:(Number.isFinite(+s.num)&&+s.num>0)?+s.num:(idx+1) }))
    .filter(x=> x.num >= CHAMP_START);
}
const CHALLENGES = {
  weaponCase:    { label:'Weapon Case Exfils', unit:'cases',   stat:r=> (r.extracted && r.weaponCase)?1:0 },
  hunt:          { label:'Hunt Contracts',     unit:'hunts',   stat:r=> r.contract==='hunt'?1:0 },
  operatorKills: { label:'Operator Kills',     unit:'kills',   stat:r=> r.operatorKills||0 },
  bossKills:     { label:'Boss Kills',         unit:'bosses',  stat:r=> Math.min(r.bossKills||0,2) }
};
function realRaids(p){ return (p.raids||[]).filter(r=> r.carryover == null); }
/* Rank players by a season's featured stat (played raids only). */
function challengeStandings(standings, chKey){
  const c = CHALLENGES[chKey]; if(!c) return [];
  return standings.map(p=>({ id:p.id, name:p.name, val: realRaids(p).reduce((a,r)=>a+(c.stat(r)||0),0) }))
    .filter(x=> x.val>0).sort((a,b)=> b.val-a.val || a.name.localeCompare(b.name));
}
function champMultOf(season){ return (season && season.finale) ? 2 : 1; }
/* Championship points a set of standings would pay out: placement + challenge podium + active bonus. */
function seasonChampPoints(standings, chKey, mult){
  mult = mult||1;
  const by = {};
  standings.forEach((p,i)=>{
    const place = i+1;
    const placePts = place<=10 ? CHAMP_PTS[place-1] : 0;
    const active = realRaids(p).length >= ACTIVE_MIN ? 2 : 0;
    by[p.id] = { id:p.id, name:p.name, place, placePts, chPlace:0, chPts:0, active, total:0 };
  });
  if(chKey){
    challengeStandings(standings, chKey).slice(0,3).forEach((e,i)=>{
      if(by[e.id]){ by[e.id].chPlace=i+1; by[e.id].chPts=CHALLENGE_PODIUM[i]; }
    });
  }
  Object.values(by).forEach(e=> e.total = Math.round((e.placePts + e.chPts + e.active) * mult));
  return by;
}
/* Cumulative table across archived seasons + (optionally) the live projected current season. */
function championshipTable(includeLive){
  const totals = {}, cols = [];
  champSeasons().forEach(({s})=>{
    cols.push({ id:s.id, name:s.name, live:false, mult:(s.champMult||1) });
    (s.champ||[]).forEach(e=>{ if(e.total<=0) return;
      const t = totals[e.id] || (totals[e.id]={ id:e.id, name:e.name, pts:0, wins:0, by:{} });
      t.pts += e.total; t.by[s.id]=e.total; t.name=e.name; if(e.place===1) t.wins++; });
  });
  const liveNum = seasonNumber();
  if(includeLive && state.season && liveNum >= CHAMP_START){
    const proj = seasonChampPoints(computeStandings(), state.season.challenge, champMultOf(state.season));
    cols.push({ id:'__live__', name:state.season.name||'Current', live:true, mult:champMultOf(state.season) });
    Object.values(proj).forEach(e=>{ if(e.total<=0) return;
      const t = totals[e.id] || (totals[e.id]={ id:e.id, name:e.name, pts:0, wins:0, by:{} });
      t.pts += e.total; t.by['__live__']=e.total; t.name=e.name; });
  }
  const rows = Object.values(totals).sort((a,b)=> b.pts-a.pts || b.wins-a.wins || a.name.localeCompare(b.name));
  return { rows, cols };
}
/* ---- Weekly snapshot (auto every Monday) → powers movement arrows ---- */
function mostRecentMonday(){ const d=new Date(); d.setHours(0,0,0,0); const off=(d.getDay()===0?6:d.getDay()-1); d.setDate(d.getDate()-off); return d.getTime(); }
function seasonKeyOf(s){ s=s||{}; return (s.start!=null ? 'st'+s.start : 'nm'+(s.name||'')); }

/* ---------- New-season popup (fires once per season, on every device) ---------- */
function seenSeasonKey(){ return lsGet('dmz_seen_season') || ''; }
function markSeasonSeen(key){ lsSet('dmz_seen_season', key||''); }
function maybeSeasonPopup(){
  const s = state.season;
  if(!s || s.complete) return;                       // no active season yet, or it's closed out
  if(typeof s.start !== 'number') return;            // all-time / undated board → not a real "season start"
  const key = seasonKeyOf(s);
  if(seenSeasonKey() === key) return;                // already saw this exact season on this device
  showSeasonPopup(s); markSeasonSeen(key);           // new (or first-seen) season → announce once, then remember
}
function showSeasonPopup(s){
  const t = el('spTitle');
  if(t){
    const nm=(s.name||'').trim(), num=seasonNumber();
    t.textContent = nm ? (/season/i.test(nm) ? nm : 'Season '+num+' — '+nm) : 'Season '+num;
  }
  const m = el('seasonPop'); if(m) m.style.display = 'flex';
}
function closeSeasonPopup(){ const m=el('seasonPop'); if(m) m.style.display='none'; }

let _snapTried=false;
function maybeSnapshot(){
  if(saving || _snapTried) return; _snapTried=true;
  const monday=mostRecentMonday(), key=seasonKeyOf(state.season), snap=state.snapshot;
  const fresh = !snap || snap.seasonKey!==key || (snap.weekOf||0) < monday;
  if(!fresh) return;
  const st=computeStandings().filter(p=>p.raids.length>0);
  if(!st.length) return;
  const board={}; st.forEach((p,i)=> board[p.id]=i+1);
  const champ={}; championshipTable(true).rows.forEach((r,i)=> champ[r.id]=i+1);
  persist(m=>{ m.snapshot={ weekOf:monday, seasonKey:key, takenAt:Date.now(), board, champ }; return m; });
}
/* movement vs the current week's Monday baseline: >0 = climbed, returns {neu} for new entries */
function moveVs(map, id, curRank){
  if(!map || map[id]==null) return { neu:true, delta:0 };
  return { neu:false, delta: map[id]-curRank };
}
function shortSeason(name){ name=String(name||''); const m=name.match(/season\s*(\d+)/i); if(m) return 'S'+m[1]; const w=name.split(/\s+/)[0]; return w.length>8?w.slice(0,8):w; }
const CHAMP_HERO_IMG='/assets/legacy/leaderboard-045-9cf83e20fffb.webp';
const CHAMP_TROPHY_IMG='/assets/legacy/leaderboard-046-116c5f75cb30.webp';
function renderChampionship(){
  const s = state.season||{}; const ch = CHALLENGES[s.challenge]; const mult = champMultOf(s);
  const cfg = state.seasonCfg || DEFAULT_SEASONCFG;
  const finalMs = dateToMs(cfg.finalEnd);
  const daysLeft = (finalMs!=null) ? Math.max(0, Math.ceil((finalMs-Date.now())/DAY_MS)) : null;
  const banked = champSeasons().length;
  const { rows, cols } = championshipTable(true);
  const leader = rows[0];
  const hero = el('champHero');
  if(hero) hero.innerHTML = `${(typeof CHAMP_HERO_IMG!=='undefined')?`<div class="champ-banner" style="background-image:url(${CHAMP_HERO_IMG})"></div>`:''}
    <div class="champ-hero champ-hero-big">
      <div class="ch-main">
        <div class="ch-tag">Road to 1.0 &middot; Beta Championship</div>
        <div class="ch-title">One Crown &middot; Every Season Counts</div>
        <div class="ch-goal">The weekly leaderboard is each season's race. The <b>Championship</b> is the war behind it — points you bank <b>every season</b> stack up, and whoever holds the most when <b>MW4 drops</b> is crowned the <b>DMZ Ranked Beta Champion</b>.${mult>1?' <b style="color:var(--gold-b)">This is the FINALS — points count double.</b>':''}</div>
        <div class="ch-chips">
          <span class="ch-chip"><i>Now Playing</i><b>Season ${seasonNumber()}${ch?' · '+esc(ch.label):''}</b></span>
          <span class="ch-chip"><i>Seasons Banked</i><b>${banked}</b></span>
          ${daysLeft!=null?`<span class="ch-chip"><i>Days to the Crown</i><b>${daysLeft}</b></span>`:''}
          <span class="ch-chip lead"><i>Current Leader</i><b>${leader?esc(leader.name)+' · '+leader.pts+' pts':'— up for grabs'}</b></span>
        </div>
      </div>
    </div>`;
  const tro = el('champTrophy');
  if(tro && typeof CHAMP_TROPHY_IMG!=='undefined'){
    const ended = (finalMs!=null) && (Date.now() >= finalMs);
    const hold = leader;
    const tag = ended ? 'The Champion Is Crowned' : 'The Prize';
    let holderHTML;
    if(hold){
      holderHTML = `<div class="prize-holder"><span class="ph-l">${ended?'DMZ Ranked Beta Champion':'Currently held by'}</span><span class="ph-n">${esc(hold.name)}</span><span class="ph-p">${hold.pts} pts</span></div>`;
    } else {
      holderHTML = `<div class="prize-holder"><span class="ph-l">Currently held by</span><span class="ph-n" style="color:var(--muted)">Up for grabs</span></div>`;
    }
    const statusHTML = ended
      ? `<div class="prize-status"><b>${hold?esc(hold.name):'—'}</b> banked the most Championship Points across every season. The crown is theirs.</div>`
      : (daysLeft!=null
          ? `<div class="prize-status">Whoever holds the most points when <b>MW4 drops</b> takes it home &middot; <b>${daysLeft}</b> day${daysLeft===1?'':'s'} to the crown. Standings are live &amp; projected — it's still anyone's.</div>`
          : `<div class="prize-status">Awarded to whoever banks the most Championship Points by launch.</div>`);
    tro.innerHTML = `<div class="prize${ended?' crowned':''}">
      <div class="prize-img"><img src="${CHAMP_TROPHY_IMG}" alt="Champion's Trophy"></div>
      <div class="prize-body">
        <div class="prize-tag">${tag}</div>
        <div class="prize-name">The Crowned Reaper</div>
        <div class="prize-desc">One trophy. Won once. The single operator with the most <b>Championship Points</b> banked across every season before MW4 drops is crowned the <b>DMZ Ranked Beta Champion</b> — and takes <b>The Crowned Reaper</b>, standing atop everyone they outlasted.</div>
        ${holderHTML}
        ${statusHTML}
      </div>
    </div>`;
  }
  const card = el('challengeCard');
  if(card){
    if(ch){
      card.style.display='block';
      if(el('challengeName')) el('challengeName').textContent = ch.label;
      const cs = challengeStandings(computeStandings(), s.challenge);
      const medal=['1','2','3'];
      const chLead = `<p class="note" style="margin:0 0 12px">This season's spotlight stat is <b>${esc(ch.label)}</b>. Log the most and finish top 3 here to bank <b>bonus</b> Championship Points — <b>+5 / +3 / +1</b> — on top of your leaderboard finish.</p>`;
      el('challengeBody').innerHTML = chLead + (cs.length
        ? cs.slice(0,15).map((e,i)=>`<div class="hrow"><div><span style="display:inline-block;width:26px;font-weight:800;color:${i<3?'var(--gold-b)':'var(--muted2)'}">${medal[i]||(i+1)}</span> <b style="color:var(--txt)">${esc(e.name)}</b>${i<3?' <span class="pill" style="background:rgba(143,209,79,.16);color:#8fd14f;border:1px solid rgba(143,209,79,.35)">+'+CHALLENGE_PODIUM[i]+'</span>':''}</div><div style="font-weight:800;color:var(--gold-b)">${e.val} <span style="color:var(--muted);font-weight:600;font-size:12px">${esc(ch.unit)}</span></div></div>`).join('')
        : '<div class="note" style="margin:0">No '+esc(ch.label.toLowerCase())+' logged yet this season — be the first.</div>');
    } else card.style.display='none';
  }
  const box = el('champBody'); if(!box) return;
  if(el('champNote')) el('champNote').innerHTML = `
    <div class="ch-ex-lead"><b>Think of it as one season vs. the whole war.</b> The SR leaderboard resets every two weeks — that's a single season's race. <b>Championship Points never reset</b>: you collect them each season and they stack up all the way to launch, where the biggest pile wins.</div>
    <div class="ch-fresh"><span class="cf-i">🏁</span><div><b>Everyone starts even.</b> Season 1 was the preseason warm-up — it doesn't count. The Championship officially kicks off <b>Season ${CHAMP_START}</b>, so no one is behind and the crown is wide open. Jump in now and you're right in the race.</div></div>
    <div class="ch-flow">
      <div class="ch-step"><span class="ch-num">1</span><div><b>Play the season</b><p>Log your raids and climb the SR leaderboard like you normally would.</p></div></div>
      <div class="ch-step"><span class="ch-num">2</span><div><b>Earn points</b><p>Where you finish, how you place in the season challenge, and staying active all pay Championship Points — see below.</p></div></div>
      <div class="ch-step"><span class="ch-num">3</span><div><b>Points bank &amp; stack</b><p>When the season ends your points lock in and add to your all-time total. Nothing resets.</p></div></div>
      <div class="ch-step"><span class="ch-num">4</span><div><b>Crown the champion</b><p>Whoever holds the most total points when MW4 drops wins the whole thing.</p></div></div>
    </div>
    <div class="ch-ex-sub">Ways to score points each season</div>
    <div class="ch-ex-grid">
      <div class="ch-ex"><span class="ch-ex-h">Season Finish</span><span class="ch-ex-v">The season's top 10 score <b>25 · 20 · 16 · 13 · 11 · 9 · 7 · 5 · 3 · 1</b> points.</span></div>
      <div class="ch-ex"><span class="ch-ex-h">Season Challenge${ch?': '+esc(ch.label):''}</span><span class="ch-ex-v">Every season picks <b>one stat</b> to spotlight${ch?` — this season it's <b>${esc(ch.label)}</b>`:''}. Whoever racks up the most tops the <b>Season Challenge board</b> and pockets <b>bonus</b> points on top of their finish: <b>1st +5, 2nd +3, 3rd +1</b>.</span></div>
      <div class="ch-ex"><span class="ch-ex-h">Active Bonus</span><span class="ch-ex-v"><b>+2</b> for logging <b>${ACTIVE_MIN}+ raids</b> in the season — reward for showing up.</span></div>
      <div class="ch-ex"><span class="ch-ex-h">The Finals</span><span class="ch-ex-v">The final season before launch pays <b>double</b> — every point counts 2×.</span></div>
    </div>
    <p class="note" style="margin:14px 0 0">Reading the table below: each <b>column is a season</b>, the number is the points you banked that season, and <b>Total</b> is your all-time championship score. The gold column is the current season — live and projected until it ends.</p>`;
  if(!rows.length){ box.innerHTML='<div class="note" style="margin:0">No points banked yet. Once raids are logged this season, live projected standings appear here.</div>'; return; }
  const head = `<tr><th>#</th><th>Player</th>${cols.map(c=>`<th class="cc${c.live?' live':''}" title="${esc(c.name)}">${esc(c.name)}${c.live?' <span class="livedot">•</span>':''}</th>`).join('')}<th>Total</th></tr>`;
  const body = rows.map((r,i)=>{
    const cells = cols.map(c=>{ const v=r.by[c.id]; return `<td class="cc${c.live?' live':''}">${v?('+'+v):'<span class="mut">–</span>'}</td>`; }).join('');
    return `<tr><td class="place ${i<3?'p'+(i+1):''}">${i+1}</td><td class="pn">${esc(r.name)}${r.wins?` <span class="pill" style="background:rgba(245,196,81,.16);color:var(--gold-b);font-size:9px;padding:0 5px;vertical-align:1px" title="Season wins">${r.wins} WIN${r.wins>1?'S':''}</span>`:''}</td>${cells}<td class="tot">${r.pts}</td></tr>`;
  }).join('');
  box.innerHTML = `<div class="champ-scroll"><table class="champ-tbl"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

/* ============================================================
   Leaders — public category boards with squad-vs-community context
   (honor system: every stat is self-reported, so we show it against
    the squad average and the community average for people to judge)
   ============================================================ */
const _f1 = x=> (Math.round(x*10)/10).toString();
function _mean(a){ return a.length ? a.reduce((s,v)=>s+v,0)/a.length : 0; }
function median(a){ if(!a.length) return 0; const s=[...a].sort((x,y)=>x-y); const m=s.length>>1; return s.length%2 ? s[m] : (s[m-1]+s[m])/2; }

/* Per-player rollups + every real raid tagged solo/squad. */
function leadersData(){
  const st = computeStandings().filter(p=> p.raids.length>0);
  const allRaids=[];
  const players = st.map(p=>{
    const real = p.raids.filter(r=> r.carryover==null);
    real.forEach(r=> allRaids.push(r));
    const n = real.length;
    const opK = real.reduce((a,r)=>a+(r.operatorKills||0),0);
    const sqK = real.reduce((a,r)=>a+(r.squadKills||0),0);
    const exfils = real.filter(r=> r.extracted).length;
    const finalExfils = real.filter(r=> r.finalExfil).length;
    const weaponCases = real.filter(r=> r.weaponCase && r.extracted).length;
    const contracts = real.filter(r=> r.contract==='regular'||r.contract==='hunt').length;
    const bossK = real.reduce((a,r)=>a+Math.min(r.bossKills||0,2),0);
    const bigRaid = real.reduce((m,r)=>Math.max(m, r.earned||0),0);
    const climb = _mean(real.map(r=> r.delta||0));
    const squadRaids = real.filter(r=> r.ranSquad).length;
    const flagged = (state.raids||[]).filter(r=> r.playerId===p.id && r.pending && !r.deleted).length;
    const verified = real.some(r=> r.verified);
    const raw = state.players.find(x=>x.id===p.id);
    const reports = (raw && raw.reports) || 0;
    return { id:p.id, name:p.name, tier:p.tier, sr:p.sr, real, n, opK, sqK, exfils, finalExfils,
             weaponCases, contracts, bossK, bigRaid, climb, squadRaids, flagged, verified, reports };
  });
  // "Notable" bar for the unverified-big-runs stat: a run worth backing up with proof.
  const notableBar = Math.max(250, median(allRaids.map(r=> r.earned||0)) * 2);
  players.forEach(p=>{ p.unverifBig = p.real.filter(r=> (r.earned||0) >= notableBar && !r.verified).length; });
  return { players, allRaids, notableBar };
}

/* Rate categories: value = mean of a per-raid metric. Baselines computed at raid level. */
const RATE_CATS = [
  { key:'kpr',   label:'Kills per raid',  unit:'',      min:5, award:'kpr',  raidVal:r=> r.operatorKills||0, fmt:v=>_f1(v),        extreme:v=>v>12,  blurb:'Operator kills per raid' },
  { key:'exfr',  label:'Exfil %',         unit:'%',     min:5, award:'exfr', raidVal:r=> r.extracted?100:0,  fmt:v=>Math.round(v)+'%', extreme:v=>v>=100, blurb:'Share of raids you get out alive' },
  { key:'srr',   label:'SR gained / raid',unit:'SR',    min:5, raidVal:r=> r.delta||0,          fmt:v=>(v>=0?'+':'')+Math.round(v).toLocaleString(), extreme:v=>v>250, blurb:'Fastest climber — net SR per raid' }
];
/* Total categories: value = a per-player total. */
const TOTAL_CATS = [
  { key:'opk',  label:'Operator kills', unit:'kills', award:'opk', val:p=>p.opK,          fmt:v=>Math.round(v).toLocaleString() },
  { key:'sqk',  label:'Squad kills',    unit:'kills', award:'sqk', val:p=>p.sqK,          fmt:v=>Math.round(v).toLocaleString() },
  { key:'exf',  label:'Exfils',         unit:'',      award:'exf', val:p=>p.exfils,       fmt:v=>Math.round(v).toLocaleString() },
  { key:'wc',   label:'Weapon cases',   unit:'',      award:'wc',  val:p=>p.weaponCases,  fmt:v=>Math.round(v).toLocaleString() },
  { key:'fin',  label:'Final exfils',   unit:'',      award:'fin', val:p=>p.finalExfils,  fmt:v=>Math.round(v).toLocaleString() },
  { key:'big',  label:'Biggest single raid', unit:'SR', award:'big', val:p=>p.bigRaid,    fmt:v=>Math.round(v).toLocaleString(), extreme:v=>v>600 },
  { key:'unv',  label:'Unverified big runs', unit:'', award:'liar', val:p=>p.unverifBig||0, fmt:v=>Math.round(v).toLocaleString(), noVer:true, callout:true, blurb:'Big runs with no proof attached — verify yours to drop off this list' }
];

function multChip(v, avg){
  if(!(avg>0) || !(v>0)) return '';
  const m = v/avg; if(m < 1.5) return '';
  return `<span class="lk-mult${m>=3?' hot':''}" title="${_f1(m)}× the typical operator">${_f1(m)}× avg</span>`;
}
function heldChip(p){ return p.flagged>0 ? `<span class="lk-held" title="Raids held for admin review">${p.flagged} held</span>` : ''; }
function reportChip(p){ return p.reports>0 ? `<span class="lk-rep" title="${p.reports} community report${p.reports>1?'s':''}">⚑ ${p.reports}</span>` : ''; }
function splitNote(p){
  if(!p.n) return '';
  const s=p.squadRaids, pct=Math.round(s/p.n*100);
  const lbl = pct>=67?'mostly squad' : pct<=33?'mostly solo' : 'mixed';
  return `<span class="ldr-split" title="${s} of ${p.n} raids logged with a squad">${s}/${p.n} squad · ${lbl}</span>`;
}

function verFlag(e, cat){
  if(cat && cat.noVer) return '';
  if(e.p.verified) return '<span class="lk-ver" title="Has an admin-approved or clip-verified run">✓ Verified</span>';
  return (cat.extreme && cat.extreme(e.v)) ? '<span class="lk-flag">⚑ verify</span>' : '';
}
/* Inline award medal shown next to the current #1 in a category (the projected award-winner). */
function awardChip(key){
  const a=awardDef(key); if(!a) return '';
  const img=badgeUri(key, a.glyph);
  const inner = img ? `<img src="${img}" alt="">` : `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="47" fill="var(--tc)" opacity=".92"/><circle cx="50" cy="50" r="47" fill="none" stroke="#f5e6b0" stroke-width="3" opacity=".55"/><circle cx="50" cy="50" r="37" fill="#100e0a"/><g style="color:var(--tc)">${AWARD_GLYPHS[a.glyph]||''}</g></svg>`;
  return `<span class="ldr-medal" style="--tc:${a.color}" title="Current ${esc(a.label)} leader — wins this trophy if the season ended now">${inner}</span>`;
}
/* Poll medal markup (image for the built-in poll glyphs, else drawn). */
function pollMedalMarkup(color, glyph){ const uri=GLYPH_IMG[glyph]; return uri ? `<img src="${uri}" alt="">` : medalSvg(color,glyph); }
function rateRow(e, i, cat, commAvg){
  return `<li class="ldr-row lb-clickable" data-profile="${esc(e.p.id)}" title="View ${esc(e.p.name)}'s profile">
    <span class="ldr-rk r${i+1}">${i+1}</span>
    <span class="ldr-nm">${(i===0&&cat.award)?awardChip(cat.award):''}${esc(e.p.name)} ${splitNote(e.p)}</span>
    <span class="ldr-meta">${verFlag(e,cat)}${heldChip(e.p)}${reportChip(e.p)}${multChip(e.v, commAvg)}</span>
    <span class="ldr-v">${cat.fmt(e.v)}</span>
  </li>`;
}
function totalRow(e, i, cat, commAvg){
  return `<li class="ldr-row lb-clickable" data-profile="${esc(e.p.id)}" title="View ${esc(e.p.name)}'s profile">
    <span class="ldr-rk r${i+1}">${i+1}</span>
    <span class="ldr-nm">${(i===0&&cat.award)?awardChip(cat.award):''}${esc(e.p.name)} ${splitNote(e.p)}</span>
    <span class="ldr-meta">${verFlag(e,cat)}${heldChip(e.p)}${reportChip(e.p)}${multChip(e.v, commAvg)}</span>
    <span class="ldr-v">${cat.fmt(e.v)}</span>
  </li>`;
}
function barBlock(name, rows){
  const max = Math.max(1, ...rows.map(r=> r.v==null?0:r.v));
  const bars = rows.map(r=> r.v==null
    ? `<div class="lb-bar"><span class="lb-l">${r.l}</span><div class="lb-track"><div class="lb-fill ${r.c}" style="width:0"></div></div><span class="lb-v">—</span></div>`
    : `<div class="lb-bar"><span class="lb-l">${r.l}</span><div class="lb-track"><div class="lb-fill ${r.c}" style="width:${Math.max(3,Math.round(r.v/max*100))}%"></div></div><span class="lb-v">${r.t}</span></div>`).join('');
  return `<div class="ldr-bars"><div class="lb-cap">${esc(name)} vs the field</div>${bars}</div>`;
}

function renderLeaders(){
  const intro = el('leadersIntroBody'), body = el('leadersBody');
  if(!body) return;
  const { players, allRaids } = leadersData();
  if(intro){
    intro.innerHTML = `<p class="ldr-lead">Every number here is <b>self-reported</b> — this is an honor-system board. That's exactly why each leader's stat is shown next to the <b>squad average</b> and the <b>community average</b>: so the whole crew can see who's a genuine standout and who might be padding. Tap any name to open their full profile and raid log.</p>
      <div class="ldr-keys">
        <span class="ldr-key"><span class="lk-flag">⚑ verify</span> a number that's statistically hard to hit — worth a second look</span>
        <span class="ldr-key"><span class="lk-mult">2.5× avg</span> how far above the community average a leader sits</span>
        <span class="ldr-key"><span class="lk-held">1 held</span> raids this operator has had held for admin review</span>
        <span class="ldr-key"><span class="ldr-split" style="position:static">7/10 squad</span> how many of their raids were run with a squad vs solo</span>
      </div>`;
  }
  if(players.length < 2){
    body.innerHTML = '<div class="card"><div class="empty">Leaders unlock once a few operators are on the board. Head to <b>Log a Raid</b> to get started.</div></div>';
    return;
  }

  // ---- precompute per-category rankings + robust (median) baselines ----
  // Baselines use the MEDIAN operator, not the mean, so a couple of padded
  // accounts can't drag "average" upward and hide their own outlier.
  const rateData = RATE_CATS.map(cat=>{
    const pv = p=> _mean(p.real.map(cat.raidVal));
    const pool = players.filter(p=> p.n >= cat.min).map(p=>({ p, v:pv(p) }));
    pool.sort((a,b)=> b.v-a.v || a.p.name.localeCompare(b.p.name));
    const comm = pool.length ? median(pool.map(x=>x.v)) : 0;
    const sqPool = pool.filter(x=> x.p.n>0 && x.p.squadRaids/x.p.n >= 0.5);   // operators who mostly run with a squad
    const sq = sqPool.length ? median(sqPool.map(x=>x.v)) : null;
    return { cat, pool, comm, sq };
  });
  const totalData = TOTAL_CATS.map(cat=>{
    const pool = players.map(p=>({ p, v:cat.val(p) })).filter(x=> x.v>0);
    pool.sort((a,b)=> b.v-a.v || a.p.name.localeCompare(b.p.name));
    const typical = pool.length ? median(pool.map(x=>x.v)) : 0;
    return { cat, pool, typical };
  });

  // ---- CARDS view ----
  const rateCards = rateData.map(d=>{
    const {cat,pool,comm,sq}=d;
    if(!pool.length) return emptyCard(cat, `Needs ${cat.min}+ raids logged to qualify — no one's there yet.`);
    const top = pool.slice(0,5), lead = top[0];
    const bars = barBlock(lead.p.name, [
      { l:'Leader',        v:lead.v, t:cat.fmt(lead.v),            c:'me' },
      { l:'Squad average', v:sq,     t:sq==null?'—':cat.fmt(sq),   c:'sq' },
      { l:'Community avg',  v:comm,   t:cat.fmt(comm),             c:'co' }
    ]);
    return `<div class="ldr-card">
      <div class="ldr-h"><span class="ldr-title">${esc(cat.label)}</span>
        <span class="ldr-avg" title="Typical operator (median) · ${cat.min}+ raids to qualify">avg ${cat.fmt(comm)}${unitSuffix(cat)}</span></div>
      ${cat.blurb?`<div class="ldr-blurb">${esc(cat.blurb)}</div>`:''}
      <ol class="ldr-list">${top.map((e,i)=>rateRow(e,i,cat,comm)).join('')}</ol>
      ${bars}
    </div>`;
  }).join('');
  const totalCards = totalData.map(d=>{
    const {cat,pool,typical}=d;
    if(!pool.length) return cat.callout ? '' : emptyCard(cat, 'Nothing logged yet.');
    const top = pool.slice(0,5);
    return `<div class="ldr-card${cat.callout?' ldr-callout':''}">
      <div class="ldr-h"><span class="ldr-title">${esc(cat.label)}</span>
        <span class="ldr-avg" title="Typical operator (median of everyone with at least one)">avg ${cat.fmt(typical)}${unitSuffix(cat)}</span></div>
      ${cat.blurb?`<div class="ldr-blurb">${esc(cat.blurb)}</div>`:''}
      <ol class="ldr-list">${top.map((e,i)=>totalRow(e,i,cat,typical)).join('')}</ol>
    </div>`;
  }).join('');
  const cardsHtml =
    `<div class="ldr-sec">Rate leaders <span class="ldr-secnote">performance per raid — shown against squad &amp; community averages</span></div>
     <div class="ldr-grid">${rateCards}</div>
     <div class="ldr-sec">Totals <span class="ldr-secnote">volume leaders this season · “avg” = typical operator</span></div>
     <div class="ldr-grid">${totalCards}</div>`;

  // ---- CHART view: one bar per operator, a dashed line at the average ----
  const rateCharts = rateData.map(d=>{
    const {cat,pool,comm,sq}=d;
    if(!pool.length) return emptyCard(cat, `Needs ${cat.min}+ raids to qualify.`);
    const rows = pool.slice(0,12).map((e,i)=>({ id:e.p.id, name:e.p.name, v:e.v, t:cat.fmt(e.v), leader:i===0, award:(i===0&&cat.award)?cat.award:null, extreme: !!(cat.extreme&&cat.extreme(e.v)) }));
    const lines = [{ v:comm, label:'community avg '+cat.fmt(comm), cls:'co' }];
    if(sq!=null) lines.push({ v:sq, label:'squad avg '+cat.fmt(sq), cls:'sq' });
    return chartCard(cat, rows, lines);
  }).join('');
  const totalCharts = totalData.map(d=>{
    const {cat,pool,typical}=d;
    if(!pool.length) return cat.callout ? '' : emptyCard(cat, 'Nothing logged yet.');
    const rows = pool.slice(0,12).map((e,i)=>({ id:e.p.id, name:e.p.name, v:e.v, t:cat.fmt(e.v), leader: cat.callout?false:i===0, award:(!cat.callout&&i===0&&cat.award)?cat.award:null, extreme: cat.callout ? true : !!(cat.extreme&&cat.extreme(e.v)) }));
    const lines = [{ v:typical, label:'typical '+cat.fmt(typical), cls:'co' }];
    return chartCard(cat, rows, lines);
  }).join('');
  const chartsHtml =
    `<div class="ldr-sec">Rate leaders <span class="ldr-secnote">each bar is one operator · dashed line = the average</span></div>
     <div class="ldr-grid wide">${rateCharts}</div>
     <div class="ldr-sec">Totals <span class="ldr-secnote">each bar is one operator · dashed line = typical operator</span></div>
     <div class="ldr-grid wide">${totalCharts}</div>`;

  const toggle = `<div class="ldr-toggle">
    <button class="ldr-viewbtn ${leadersView==='cards'?'on':''}" data-ldrview="cards">▤ Cards</button>
    <button class="ldr-viewbtn ${leadersView==='chart'?'on':''}" data-ldrview="chart">▥ Chart</button>
  </div>`;
  body.innerHTML = toggle
    + `<div class="ldr-view" style="display:${leadersView==='cards'?'block':'none'}">${cardsHtml}</div>`
    + `<div class="ldr-view" style="display:${leadersView==='chart'?'block':'none'}">${chartsHtml}</div>`;
}
function unitSuffix(cat){ return cat.unit==='%' ? '' : (cat.unit ? ' '+esc(cat.unit) : ''); }
function emptyCard(cat, msg){
  return `<div class="ldr-card"><div class="ldr-h"><span class="ldr-title">${esc(cat.label)}</span></div><div class="ldr-empty">${esc(msg)}</div></div>`;
}
/* Horizontal bar chart: one bar per operator, dashed reference line(s) at the average. */
function chartCard(cat, rows, lines){
  const maxV = Math.max(1, ...rows.map(r=>r.v), ...lines.map(l=>l.v||0));
  const barsHtml = rows.map(r=>{
    const w = Math.max(1.5, r.v/maxV*100);
    const cls = r.leader ? 'lead' : (r.extreme ? 'ex' : '');
    const flag = r.extreme ? ' <span class="chart-flag" title="statistically hard to hit — worth verifying">⚑</span>' : '';
    return `<div class="chart-row lb-clickable" data-profile="${esc(r.id)}" title="View ${esc(r.name)}'s profile">
      <div class="chart-track"><div class="chart-fill ${cls}" style="width:${w}%"></div></div>
      <div class="chart-name">${r.award?awardChip(r.award):''}${esc(r.name)}${flag}</div>
      <div class="chart-val">${r.t}</div>
    </div>`;
  }).join('');
  const linesHtml = lines.map(l=>{
    const left = Math.min(99, (l.v/maxV)*100);
    const tf = left>=80 ? 'translateX(-100%)' : (left<=10 ? 'translateX(0)' : 'translateX(-50%)');
    return `<div class="chart-avgline ${l.cls}" style="left:${left}%"></div>`
         + `<div class="chart-avglabel ${l.cls}" style="left:${left}%;transform:${tf}">${esc(l.label)}</div>`;
  }).join('');
  return `<div class="ldr-card chart-card">
    <div class="ldr-h"><span class="ldr-title">${esc(cat.label)}</span></div>
    ${cat.blurb?`<div class="ldr-blurb">${esc(cat.blurb)}</div>`:''}
    <div class="chart-plot">${barsHtml}${linesHtml}</div>
  </div>`;
}
/* view toggle (attached once) */
/* Switch the Community tab's sub-view (Leaders / Watch / Hall of Shame). */
function showSub(sub){
  currentSub = sub || 'leaders';
  document.querySelectorAll('#community .subnav [data-sub]').forEach(b=> b.classList.toggle('active', b.getAttribute('data-sub')===currentSub));
  document.querySelectorAll('#community .subpanel').forEach(p=> p.classList.toggle('active', p.id==='sub-'+currentSub));
  if(currentSub==='watch') markWatchSeen();   // viewing Watch clears the flag dot
}
function initLeaders(){
  document.addEventListener('click', e=>{
    const sub = e.target.closest && e.target.closest('#community .subnav [data-sub]');
    if(sub){ showSub(sub.getAttribute('data-sub')); return; }
    const lb = e.target.closest && e.target.closest('[data-ldrview]');
    if(lb){ const v=lb.getAttribute('data-ldrview'); if(v&&v!==leadersView){ leadersView=v; renderLeaders(); } return; }
    const sb = e.target.closest && e.target.closest('[data-shameview]');
    if(sb){ const v=sb.getAttribute('data-shameview'); if(v&&v!==shameView){ shameView=v; renderShame(); } }
  });
}

/* ============================================================
   Community Watch — public view of everything the crew has flagged
   ============================================================ */
function watchTotal(){
  const ops = (state.players||[]).filter(p=>(p.reports||0)>0).length;
  const rds = (state.raids||[]).filter(r=>(r.reports||0)>0 && !r.deleted).length;
  return ops + rds;
}
function watchSeen(){ return parseInt(lsGet('dmz_seen_watch')||'0',10) || 0; }
function watchDotState(){ const show = (watchTotal() > watchSeen()) ? '' : 'none'; ['watchDot','communityDot'].forEach(id=>{ const d=el(id); if(d) d.style.display = show; }); }
function markWatchSeen(){ lsSet('dmz_seen_watch', String(watchTotal())); watchDotState(); }
/* public proof (a link is shareable; uploaded images stay admin-only) */
function proofPublic(r){
  if(!r.proofUrl) return '';
  return `<a class="proof-link" href="${esc(r.proofUrl)}" target="_blank" rel="noopener">↗ clip / screenshot</a>`;
}
function raidHasProof(r){ return !!(r && (r.proofProvided || r.proofImg || r.proofUrl)); }
/* Community → Under Review: every raid currently held for admin approval, shown publicly so
   players can see their held raid's status (and the community sees the board is honest). */
function agoShort(ts){ if(!ts) return ''; const m=Math.round((Date.now()-ts)/60000);
  if(m<1) return 'just now'; if(m<60) return m+'m ago'; const h=Math.round(m/60); if(h<24) return h+'h ago'; return fmtDate(ts)||''; }
function renderReview(){
  const intro = el('reviewIntro'), body = el('reviewBody'), badge = el('reviewCount');
  const pend = (state.raids||[]).filter(r=> r.pending && !r.deleted).sort((a,b)=> (b.ts||0)-(a.ts||0));
  if(badge){ if(pend.length){ badge.style.display=''; badge.textContent=pend.length; } else badge.style.display='none'; }
  if(!body) return;
  if(intro) intro.innerHTML = '<p class="ldr-lead">These raids came in <b>above the board’s limits</b>, so they’re waiting for an admin to approve them before they count. If yours is here it’s <b>not lost</b> — once approved it lands on your raid history and SR. Nothing here counts toward the leaderboard yet.</p>';
  if(!pend.length){ body.innerHTML = '<div class="card"><div class="empty">Nothing under review right now — every raid on the board cleared the limits. 👍</div></div>'; return; }
  body.innerHTML = pend.map(r=>{
    const earned = grossEarned(r);
    const bits = [(r.operatorKills||0)+' op kills', (r.squadKills||0)+' squad'];
    if(r.bossKills) bits.push(r.bossKills+' boss');
    bits.push(r.extracted?'exfil':'no exfil');
    if(r.weaponCase) bits.push('weapon case'); if(r.finalExfil) bits.push('final exfil');
    return '<div class="card rev-row">'
      + '<div class="rev-top"><span class="rev-name">'+esc(r.playerName||'(unknown)')+'</span><span class="rev-when">'+agoShort(r.ts)+'</span></div>'
      + '<div class="rev-stats">'+bits.join(' · ')+' · <b>+'+earned+' SR</b></div>'
      + '<div class="rev-reason">⏳ Held: '+esc(r.pendingReason||'above the board limits')+'</div>'
      + '</div>';
  }).join('');
}
/* ============================================================
   Suggestions — community ideas, upvoted; most-wanted rise to the top.
   Persisted in state.suggestions (meta 'suggestions' row). Votes and
   troll-flags are keyed by device id (like polls) so they dedupe across
   reloads and toggle off cleanly. Admins (Settings unlocked) can mark
   ideas Planned / Done, archive trolling out of sight, restore, or delete.
   ============================================================ */
function suggVotes(s){ return s && s.voters ? Object.keys(s.voters).length : 0; }
function suggFlags(s){ return s && s.flags  ? Object.keys(s.flags).length  : 0; }
function iVotedSugg(s){ const d=getDeviceId(); return !!(s && s.voters && s.voters[d]); }
function iFlaggedSugg(s){ const d=getDeviceId(); return !!(s && s.flags && s.flags[d]); }
function suggSort(a,b){ return suggVotes(b)-suggVotes(a) || (b.ts||0)-(a.ts||0); }
function renderSuggestions(){
  const body = el('suggBody'); if(!body) return;
  const all  = (state.suggestions||[]);
  const live = all.filter(s=> s.status!=='archived').sort(suggSort);
  const archived = all.filter(s=> s.status==='archived').sort(suggSort);
  body.innerHTML = live.length
    ? '<div class="card">' + live.map(suggRowHTML).join('') + '</div>'
    : '<div class="card"><div class="sugg-empty">No suggestions yet — be the first to drop an idea above. Whatever the crew upvotes most rises to the top.</div></div>';
  const arch = el('suggArchive');
  if(arch){
    arch.innerHTML = (settingsUnlocked && archived.length)
      ? '<div class="card"><div class="sugg-arch-head" id="suggArchToggle" data-n="'+archived.length+'">▸ Archived ('+archived.length+')</div>'
        + '<div id="suggArchList" style="display:none">' + archived.map(suggRowHTML).join('') + '</div></div>'
      : '';
  }
}
function suggRowHTML(s){
  const votes = suggVotes(s), voted = iVotedSugg(s);
  const flags = suggFlags(s), flagged = iFlaggedSugg(s);
  const who = esc(s.author||'Anonymous');
  const chip = s.status==='planned' ? '<span class="sugg-chip planned">🔧 Planned</span>'
             : s.status==='done'    ? '<span class="sugg-chip done">✓ Done</span>'
             : s.status==='archived'? '<span class="sugg-chip archived">Archived</span>' : '';
  const admin = settingsUnlocked ? `<div class="sugg-admin">
      ${s.status!=='planned'?`<button data-sugg-status="planned" data-sugg="${esc(s.id)}">🔧 Planned</button>`:''}
      ${s.status!=='done'?`<button data-sugg-status="done" data-sugg="${esc(s.id)}">✓ Done</button>`:''}
      ${(s.status&&s.status!=='open'&&s.status!=='archived')?`<button data-sugg-status="open" data-sugg="${esc(s.id)}">↺ Reopen</button>`:''}
      ${s.status!=='archived'?`<button data-sugg-status="archived" data-sugg="${esc(s.id)}">Archive</button>`:`<button data-sugg-status="open" data-sugg="${esc(s.id)}">↺ Restore</button>`}
      <button class="danger" data-sugg-del="${esc(s.id)}">Delete</button>
      ${flags?`<span class="rep-badge">⚑ ${flags}</span>`:''}
    </div>` : '';
  const reportBtn = (!settingsUnlocked && s.status!=='archived')
    ? `<button class="sugg-report${flagged?' flagged':''}" data-sugg-flag="${esc(s.id)}" title="${flagged?'You flagged this':'Flag as inappropriate'}">⚑ ${flagged?'flagged':'report'}</button>` : '';
  return `<div class="sugg-row${s.status==='archived'?' archived':''}">
    <div class="sugg-vote${voted?' voted':''}" data-sugg-vote="${esc(s.id)}" title="${voted?'Remove your upvote':'Upvote this'}">
      <span class="caret">▲</span><span class="n">${votes}</span><span class="lab">${votes===1?'vote':'votes'}</span>
    </div>
    <div class="sugg-main">
      <div class="sugg-text">${esc(s.text||'')}</div>
      <div class="sugg-meta">${who} · ${agoShort(s.ts)}${chip?' · '+chip:''}${reportBtn?' · '+reportBtn:''}</div>
      ${admin}
    </div>
  </div>`;
}
function updateSuggCount(){ const inp=el('suggInput'), c=el('suggCount'); if(inp&&c) c.textContent=(280-(inp.value||'').length)+' left'; }
async function postSuggestion(){
  const inp = el('suggInput'); if(!inp) return;
  const text = (inp.value||'').trim();
  if(text.length < 4){ showMsg('suggMsg','err','Add a little more detail first.'); return; }
  if(text.length > 280){ showMsg('suggMsg','err','Keep it under 280 characters.'); return; }
  if((state.suggestions||[]).some(s=> (s.text||'').trim().toLowerCase()===text.toLowerCase() && s.status!=='archived')){
    showMsg('suggMsg','err','That idea is already on the board — upvote it instead.'); return;
  }
  const btn=el('suggPost'); if(btn) btn.disabled=true;
  const author = (lsGet('dmz_myname')||'').trim() || 'Anonymous';
  const dev = getDeviceId();
  const item = { id:'s'+uid(), text, author, ts:Date.now(), status:'open', voters:{[dev]:1}, flags:{} };
  const ok = await persist(merged=>{ merged.suggestions=(merged.suggestions||[]).concat([item]); return merged; });
  if(btn) btn.disabled=false;
  if(ok){ inp.value=''; updateSuggCount(); showMsg('suggMsg','ok','Posted — thanks! It starts with your upvote.'); }
}
async function voteSuggestion(id){
  const dev=getDeviceId();
  await persist(merged=>{
    const s=(merged.suggestions||[]).find(x=>x.id===id); if(!s) return merged;
    s.voters=s.voters||{}; if(s.voters[dev]) delete s.voters[dev]; else s.voters[dev]=1;
    return merged;
  });
}
async function flagSuggestion(id){
  const dev=getDeviceId();
  await persist(merged=>{
    const s=(merged.suggestions||[]).find(x=>x.id===id); if(!s) return merged;
    s.flags=s.flags||{}; s.flags[dev]=1; return merged;
  });
  showMsg('suggMsg','ok','Thanks — flagged for the admins to review.');
}
async function setSuggStatus(id, status){
  await persist(merged=>{ const s=(merged.suggestions||[]).find(x=>x.id===id); if(s) s.status=status; return merged; });
}
async function deleteSuggestion(id){
  if(!confirm('Delete this suggestion permanently? This can’t be undone.')) return;
  await persist(merged=>{ merged.suggestions=(merged.suggestions||[]).filter(x=>x.id!==id); return merged; });
}
function initSuggestions(){
  const inp=el('suggInput'); if(inp){ inp.addEventListener('input', updateSuggCount); updateSuggCount(); }
  const post=el('suggPost'); if(post) post.addEventListener('click', postSuggestion);
  document.addEventListener('click', e=>{
    const t=e.target;
    const at=t.closest && t.closest('#suggArchToggle');
    if(at){ const l=el('suggArchList'); if(l){ const open=l.style.display!=='none'; l.style.display=open?'none':''; at.textContent=(open?'▸':'▾')+' Archived ('+(at.getAttribute('data-n')||0)+')'; } return; }
    const v=t.closest && t.closest('[data-sugg-vote]'); if(v){ voteSuggestion(v.getAttribute('data-sugg-vote')); return; }
    const f=t.closest && t.closest('[data-sugg-flag]'); if(f){ flagSuggestion(f.getAttribute('data-sugg-flag')); return; }
    const st=t.closest && t.closest('[data-sugg-status]'); if(st){ setSuggStatus(st.getAttribute('data-sugg'), st.getAttribute('data-sugg-status')); return; }
    const d=t.closest && t.closest('[data-sugg-del]'); if(d){ deleteSuggestion(d.getAttribute('data-sugg-del')); return; }
  });
}
function renderWatch(){
  const intro = el('watchIntro'), body = el('watchBody');
  if(!body) return;
  const st = computeStandings(); const byId = {}; st.forEach(p=> byId[p.id]=p);
  const ops = (state.players||[]).filter(p=>(p.reports||0)>0).sort((a,b)=>(b.reports||0)-(a.reports||0));
  const rds = (state.raids||[]).filter(r=>(r.reports||0)>0 && !r.deleted).sort((a,b)=>(b.reports||0)-(a.reports||0));
  if(intro) intro.innerHTML = `<p class="ldr-lead">These are operators and raids the community has <b>flagged for a closer look</b>. A flag is a question, not a verdict — the number just shows how many of the crew raised a hand. See a stat that looks bogus? Open that operator's profile and hit <b>⚑ Report</b>. Everything here is out in the open so you can judge for yourself.</p>`;
  if(!ops.length && !rds.length){
    body.innerHTML = '<div class="card"><div class="empty">Nothing flagged right now — the board looks clean. If a stat seems off, open that operator\'s profile and report it.</div></div>';
    return;
  }
  const opCards = ops.map(p=>{
    const s = byId[p.id];
    return `<div class="watch-row">
      <div class="watch-count" title="${p.reports} community report${p.reports>1?'s':''}">⚑ ${p.reports}</div>
      <div class="watch-main">
        <div class="watch-name">${esc(p.name)}${s?` <span class="rankname b-${s.tier}" style="font-size:12px">${s.tier}</span>`:''}</div>
        <div class="watch-sub">${s?s.sr.toLocaleString()+' SR · rank #'+(st.findIndex(x=>x.id===p.id)+1):'no ranked raids'}</div>
      </div>
      <div class="watch-act">
        <button class="btn ghost" style="padding:6px 11px;font-size:12.5px" data-profile="${esc(p.id)}">View</button>
        <button class="watch-report${reportedLocally('p:'+p.id)?' reported':''}" data-reportp="${esc(p.id)}">${reportedLocally('p:'+p.id)?'⚑ Reported':'⚑ Report'}</button>
      </div>
    </div>`;
  }).join('');
  const rdCards = rds.map(r=>{
    const earned = grossEarned(r);
    const bits=[]; if(r.operatorKills)bits.push(r.operatorKills+' op'); if(r.squadKills)bits.push(r.squadKills+' sq'); if(r.extracted)bits.push('exfil');
    const when = r.ts ? new Date(r.ts).toLocaleDateString(undefined,{month:'short',day:'numeric'}) : '';
    return `<div class="watch-row">
      <div class="watch-count" title="${r.reports} community report${r.reports>1?'s':''}">⚑ ${r.reports}</div>
      <div class="watch-main">
        <div class="watch-name">${esc(r.playerName||'?')} <span style="color:var(--gold-b);font-weight:800">+${earned} SR</span>${r.verified?' <span class="vf-chip">✓ Verified</span>':''}</div>
        <div class="watch-sub">${bits.join(' · ')||'no actions'} · ${when} ${proofPublic(r)}</div>
      </div>
      <div class="watch-act">
        <button class="btn ghost" style="padding:6px 11px;font-size:12.5px" data-profile="${esc(r.playerId)}">View</button>
        <button class="watch-report${reportedLocally('r:'+r.id)?' reported':''}" data-report="${esc(r.id)}">${reportedLocally('r:'+r.id)?'⚑ Reported':'⚑ Report'}</button>
      </div>
    </div>`;
  }).join('');
  body.innerHTML =
    (opCards?`<div class="card"><h2 class="section-title">Flagged operators</h2>${opCards}</div>`:'') +
    (rdCards?`<div class="card"><h2 class="section-title">Flagged raids</h2>${rdCards}</div>`:'');
}

/* ============================================================
   Hall of Shame — the board nobody wants to top (min 10 raids to qualify)
   ============================================================ */
let shameView = 'chart';   // user framed this as "a chart", so default to it
const SHAME_MIN = 10;
const SHAME_CATS = [
  { key:'kpr',   label:'Fewest kills / raid',       unit:'',       worst:'low',  fmt:v=>_f1(v),                          val:p=> p.n? p.opK/p.n : 0,           blurb:'Lowest average operator kills per raid' },
  { key:'died',  label:'Died the most',             unit:'%',      worst:'high', fmt:v=>Math.round(v)+'%',               val:p=> p.n? (p.n-p.exfils)/p.n*100 : 0, blurb:'Didn\'t make it out — the share of raids that ended in a body bag' },
  { key:'whiff', label:'Most whiffs (0-kill raids)',unit:'%',      worst:'high', fmt:v=>Math.round(v)+'%',               val:p=> p.n? p.zeroK/p.n*100 : 0,     blurb:'Highest share of raids that ended with zero operator kills' },
  { key:'sqpr',  label:'Fewest squad kills / raid', unit:'',       worst:'low',  fmt:v=>_f1(v),                          val:p=> p.n? p.sqK/p.n : 0,           blurb:'Lowest average squadmate kills per raid' },
  { key:'bled',  label:'Most SR bled',              unit:'SR',     worst:'high', fmt:v=>Math.round(v).toLocaleString(),  val:p=> p.srLost,                     blurb:'Most total SR lost this season (deploy fees + failed raids)' },
  { key:'face',  label:'Biggest faceplant',         unit:'SR',     worst:'high', fmt:v=>'-'+Math.round(v).toLocaleString(), val:p=> p.worstDrop,               blurb:'Their single worst raid — the biggest SR drop in one run' },
  { key:'back',  label:'Going backwards',           unit:'SR/raid',worst:'low',  neg:true, fmt:v=>(v>=0?'+':'')+Math.round(v), val:p=> p.climb,                blurb:'Their average raid ends with LESS SR than it started — sliding down the ranks' }
];
function shameRow(e, i, cat){
  return `<li class="ldr-row lb-clickable" data-profile="${esc(e.p.id)}" title="View ${esc(e.p.name)}'s profile">
    <span class="ldr-rk r${i+1}">${i+1}</span>
    <span class="ldr-nm">${esc(e.p.name)} ${splitNote(e.p)}</span>
    <span class="ldr-meta">${reportChip(e.p)}</span>
    <span class="ldr-v">${cat.fmt(e.v)}</span>
  </li>`;
}
function renderShame(){
  const intro = el('shameIntro'), body = el('shameBody');
  if(!body) return;
  const { players } = leadersData();
  const elig = players.filter(p=> p.n >= SHAME_MIN);
  elig.forEach(p=>{
    p.zeroK = p.real.filter(r=> (r.operatorKills||0)===0).length;
    p.srLost = p.real.reduce((a,r)=> a + ((r.delta||0)<0 ? -r.delta : 0), 0);
    let worst = 0; p.real.forEach(r=>{ const d=r.delta||0; if(d<worst) worst=d; });
    p.worstDrop = -worst;   // magnitude of the single worst raid (0 if never dropped)
  });
  if(intro) intro.innerHTML = `<p class="ldr-lead">The board nobody wants to top. All in good fun — you need <b>${SHAME_MIN}+ raids</b> to qualify, so one-and-done tourists are safe. Only one way off: actually play better. Numbers are shown against the <b>typical</b> operator so you can see how far into the basement someone really is.</p>`;
  if(elig.length < 2){
    body.innerHTML = `<div class="card"><div class="empty">The Hall of Shame opens once a couple of operators have ${SHAME_MIN}+ raids logged. Keep grinding — someone's got to be last.</div></div>`;
    return;
  }
  const build = (mode)=> SHAME_CATS.map(cat=>{
    let pool = elig.map(p=>({ p, v:cat.val(p) }));
    if(cat.worst==='high') pool = pool.filter(x=> x.v>0);          // only people who actually did the bad thing
    if(cat.neg) pool = pool.filter(x=> x.v<0);                     // "going backwards" = genuinely negative only
    pool.sort((a,b)=> cat.worst==='high' ? (b.v-a.v) : (a.v-b.v)); // worst first
    if(!pool.length) return '';
    const typical = median(elig.map(cat.val));
    if(mode==='cards'){
      const top = pool.slice(0,5);
      return `<div class="ldr-card ldr-callout">
        <div class="ldr-h"><span class="ldr-title">${esc(cat.label)}</span><span class="ldr-avg" title="Typical operator (median)">typical ${cat.fmt(typical)}${unitSuffix(cat)}</span></div>
        ${cat.blurb?`<div class="ldr-blurb">${esc(cat.blurb)}</div>`:''}
        <ol class="ldr-list">${top.map((e,i)=>shameRow(e,i,cat)).join('')}</ol>
      </div>`;
    }
    const rows = pool.slice(0,12).map(e=>({ id:e.p.id, name:e.p.name, v:Math.abs(e.v), t:cat.fmt(e.v), leader:false, extreme:true }));
    const lines = [{ v:Math.abs(typical), label:'typical '+cat.fmt(typical), cls:'co' }];
    return chartCard(cat, rows, lines);
  }).join('');
  const toggle = `<div class="ldr-toggle">
    <button class="ldr-viewbtn ${shameView==='cards'?'on':''}" data-shameview="cards">▤ Cards</button>
    <button class="ldr-viewbtn ${shameView==='chart'?'on':''}" data-shameview="chart">▥ Chart</button>
  </div>`;
  body.innerHTML = toggle
    + `<div class="ldr-view" style="display:${shameView==='cards'?'block':'none'}"><div class="ldr-grid">${build('cards')}</div></div>`
    + `<div class="ldr-view" style="display:${shameView==='chart'?'block':'none'}"><div class="ldr-grid wide">${build('chart')}</div></div>`;
}

/* ============================================================
   Power Rankings — shareable card (canvas → PNG), movement vs Monday snapshot
   ============================================================ */
const PR_LOGO='/assets/legacy/leaderboard-047-ca1ea722ec01.png';
const TIER_COL={Bronze:'#db9c64',Silver:'#d3dae1',Gold:'#f2ca63',Platinum:'#63d8c4',Diamond:'#67b4ee',Crimson:'#ec6a5c',Iridescent:'#c79bff'};
function prLoadImg(src){ return new Promise(res=>{ if(!src||src.indexOf('data:')!==0){res(null);return;} const i=new Image(); i.onload=()=>res(i); i.onerror=()=>res(null); i.src=src; }); }
function prMove(map,id,curRank){ if(!map||map[id]==null) return {t:'NEW',c:'#8fd14f'}; const d=map[id]-curRank; if(d>0) return {t:'▲ '+d,c:'#8fd14f'}; if(d<0) return {t:'▼ '+(-d),c:'#ec6a5c'}; return {t:'—',c:'#7c857d'}; }
function prRound(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }
async function downloadPowerRankings(){
  const btn=el('prBtn'); const orig=btn?btn.textContent:'';
  if(btn){ btn.disabled=true; btn.textContent='Rendering…'; }
  try{
    await Promise.all(['700 50px Oswald','700 30px Oswald','700 26px Oswald','700 22px Oswald','600 24px Rajdhani','600 18px Rajdhani'].map(f=>document.fonts.load(f))).catch(()=>{});
    try{ await document.fonts.ready; }catch(e){}
    const logo=await prLoadImg(PR_LOGO);
    const W=1080,H=1350,S=2, cv=document.createElement('canvas'); cv.width=W*S; cv.height=H*S;
    const g=cv.getContext('2d'); g.scale(S,S); g.textBaseline='alphabetic';
    const bg=g.createLinearGradient(0,0,0,H); bg.addColorStop(0,'#13221b'); bg.addColorStop(.55,'#0b100d'); bg.addColorStop(1,'#080b09');
    g.fillStyle=bg; g.fillRect(0,0,W,H);
    g.strokeStyle='rgba(230,169,43,.45)'; g.lineWidth=3; g.strokeRect(7,7,W-14,H-14);
    const s=state.season||{}, ch=CHALLENGES[s.challenge];
    const st=computeStandings().filter(p=>p.raids.length>0);
    const champ=championshipTable(true).rows;
    const snapB=state.snapshot&&state.snapshot.board, snapC=state.snapshot&&state.snapshot.champ;
    let hx=54;
    if(logo){ g.drawImage(logo,42,32,124,124); hx=182; }
    g.fillStyle='#f5c451'; g.font='700 21px Oswald'; g.fillText('DMZ RANKED',hx,64);
    g.fillStyle='#ffffff'; g.font='700 50px Oswald'; g.fillText('POWER RANKINGS',hx,110);
    g.fillStyle='#cdd6cd'; g.font='600 23px Rajdhani'; g.fillText((s.name||'Season')+(ch?'   ·   '+ch.label:''),hx,142);
    g.textAlign='right'; g.fillStyle='#8b978f'; g.font='600 20px Rajdhani';
    g.fillText(new Date().toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}),W-54,64); g.textAlign='left';
    function label(txt,y){ g.fillStyle='#e6a92b'; g.fillRect(54,y-16,4,20); g.fillStyle='#f5c451'; g.font='700 22px Oswald'; g.fillText(txt.toUpperCase(),68,y); }
    function medalNum(n,x,y){ const col=n<=3?['#f5c451','#d3dae1','#d8a06a'][n-1]:'#7f8a80'; g.beginPath(); g.arc(x,y,17,0,7); g.fillStyle='rgba(0,0,0,.35)'; g.fill(); g.lineWidth=2; g.strokeStyle=col; g.stroke(); g.fillStyle=col; g.font='700 18px Oswald'; g.textAlign='center'; g.fillText(String(n),x,y+6); g.textAlign='left'; }
    function row(y,rank,name,sub,subCol,right,move){
      const x=54,w=W-108,cy=y+20;
      medalNum(rank,x+18,cy);
      g.fillStyle='#f2f6f1'; g.font='700 26px Oswald'; g.fillText(name,x+48,cy+6);
      if(sub){ g.fillStyle=subCol||'#8b978f'; g.font='600 17px Rajdhani'; g.fillText(sub,x+48,cy+28); }
      if(move){ g.font='700 18px Oswald'; const mw=g.measureText(move.t).width+20, mx=x+w-160-mw;
        g.fillStyle='rgba(255,255,255,.05)'; prRound(g,mx,cy-15,mw,26,7); g.fill();
        g.fillStyle=move.c; g.textAlign='center'; g.fillText(move.t,mx+mw/2,cy+3); g.textAlign='left'; }
      g.fillStyle='#f5c451'; g.font='700 28px Oswald'; g.textAlign='right'; g.fillText(right,x+w,cy+6); g.textAlign='left';
      g.strokeStyle='rgba(255,255,255,.06)'; g.lineWidth=1; g.beginPath(); g.moveTo(x,y+58); g.lineTo(x+w,y+58); g.stroke();
    }
    label('Top of the Board',214);
    st.slice(0,5).forEach((p,i)=> row(236+i*70,i+1,p.name,p.tier,TIER_COL[p.tier]||'#8b978f',p.sr.toLocaleString(),prMove(snapB,p.id,i+1)));
    if(!st.length){ g.fillStyle='#8b978f'; g.font='600 20px Rajdhani'; g.fillText('No standings yet.',68,270); }
    label('Road to 1.0 — Championship',632);
    champ.slice(0,5).forEach((r,i)=> row(654+i*70,i+1,r.name,(r.wins?(r.wins+'× season win'+(r.wins>1?'s':'')):''),'#c9a24a',r.pts+' pts',prMove(snapC,r.id,i+1)));
    if(!champ.length){ g.fillStyle='#8b978f'; g.font='600 20px Rajdhani'; g.fillText('Points bank once a season is archived.',68,688); }
    const boxY=1052, boxH=150, bw=(W-108-24)/2;
    function box(x,title,big,small){ g.fillStyle='rgba(255,255,255,.03)'; prRound(g,x,boxY,bw,boxH,12); g.fill(); g.strokeStyle='rgba(230,169,43,.28)'; g.lineWidth=1.5; prRound(g,x,boxY,bw,boxH,12); g.stroke();
      g.fillStyle='#e6a92b'; g.font='700 16px Oswald'; g.fillText(title.toUpperCase(),x+20,boxY+34);
      g.fillStyle='#ffffff'; g.font='700 33px Oswald'; g.fillText(String(big).slice(0,16),x+20,boxY+80);
      g.fillStyle='#9aa39b'; g.font='600 18px Rajdhani'; g.fillText(String(small).slice(0,26),x+20,boxY+114); }
    const cl=ch?challengeStandings(st,s.challenge)[0]:null;
    box(54,'Challenge Leader', cl?cl.name:'—', cl?(cl.val+' '+ch.unit):(ch?('lead the '+ch.label.toLowerCase()):'no challenge set'));
    let big={val:0,name:''}; st.forEach(p=>p.raids.forEach(r=>{ if(r.carryover==null && (r.earned||0)>big.val) big={val:r.earned,name:p.name}; }));
    box(54+bw+24,'Biggest Raid', big.val?('+'+big.val+' SR'):'—', big.name||'this season');
    g.fillStyle='#5f6d63'; g.font='600 19px Rajdhani'; g.fillText('dmzranked2026.netlify.app',54,H-32);
    g.textAlign='right'; g.fillStyle='#7c857d'; g.font='600 18px Rajdhani';
    g.fillText(state.snapshot?('▲▼ since '+new Date(state.snapshot.weekOf).toLocaleDateString(undefined,{month:'short',day:'numeric'})):'live standings',W-54,H-32); g.textAlign='left';
    cv.toBlob(function(blob){ const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='DMZ-Power-Rankings-'+new Date().toISOString().slice(0,10)+'.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),4000); },'image/png');
  }catch(e){ alert('Could not render the card: '+(e&&e.message||e)); }
  finally{ if(btn){ btn.disabled=false; btn.textContent=orig; } }
}

/* ============================================================
   Rendering
   ============================================================ */
function el(id){ return document.getElementById(id); }
function esc(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

let lastPinState;
function renderAll(){ applyTheme(); renderSeasonBanner(); renderSeasonBar(); renderBoard(); renderHallOfFame(); renderHistory(); renderPlayerList(); renderManage(); renderPastAdmin(); renderModeration(); renderRecycle(); renderChampionship(); renderLeaders(); renderRace(); renderMedals(); renderPolls(); renderWatch(); renderShame(); renderReview(); renderSuggestions(); renderAwards(); watchDotState(); applyS2UI(); applyDonate(); if(el('nameSec')) updateNameStatus(); el('playerCount').textContent = state.players.length + (state.players.length===1?' player':' players');
  const pinState=(state.adminPinConfigured?'1':'0')+'|'+state.pinHash;
  if(pinState !== lastPinState){ lastPinState = pinState; computeUnlocked(); refreshSettingsLock(); }
}

/* ---------- Season date helpers ---------- */
/* Season boundaries anchor to the community's timezone (Central) for EVERY viewer, so a
   season always starts/ends at midnight Central no matter where (or in what timezone) the
   viewer is — this is what stops a rollover from firing early for someone whose clock is ahead.
   DST-aware via Intl, so it's correct year-round. */
const APP_TZ='America/Chicago';
function dateToMs(str){                                   // 'YYYY-MM-DD' -> UTC ms of midnight-Central that day
  if(!str) return null;
  const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(str); if(!m) return null;
  const guess=Date.UTC(+m[1], +m[2]-1, +m[3], 0, 0, 0);
  const dtf=new Intl.DateTimeFormat('en-US',{timeZone:APP_TZ,hour12:false,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const p={}; dtf.formatToParts(new Date(guess)).forEach(x=>{ p[x.type]=x.value; });
  let hr=+p.hour; if(hr===24) hr=0;
  const asTz=Date.UTC(+p.year, +p.month-1, +p.day, hr, +p.minute, +p.second);
  return guess - (asTz - guess);                          // shift UTC-midnight by the Central offset
}
function msToDateInput(ms){ if(typeof ms!=='number') return '';
  return new Intl.DateTimeFormat('en-CA',{timeZone:APP_TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(ms)); }
function fmtDate(ms){ if(typeof ms!=='number') return null;
  return new Date(ms).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric',timeZone:APP_TZ}); }
function todayMidnight(){ const d=new Date(); d.setHours(0,0,0,0); return d.getTime(); }

/* ---- Per-season visual theme (baked in, keyed by exact season name) ---- */
const _T2='/assets/legacy/leaderboard-048-b8db8f3fda2c.webp';
const _T3='/assets/legacy/leaderboard-049-4e18f572be23.webp';
const _T4='/assets/legacy/leaderboard-050-5cd0a25ab135.webp';
const _T5='/assets/legacy/leaderboard-051-961af3709e2c.webp';
const _T6='/assets/legacy/leaderboard-052-33c91136ef6c.webp';
const SEASON_THEMES = {
  'Weapon Case Warfare':{hero:_T2,banner:_T2},
  'Hunt Club':{hero:_T3,banner:_T3},
  'Confirmed Kills':{hero:_T4,banner:_T4},
  'Apex Predator':{hero:_T5,banner:_T5},
  'The Finals':{hero:_T6,banner:_T6},
};
function seasonTheme(){ const s=state.season||{}; return SEASON_THEMES[(s.name||'').trim()] || null; }
/* Season number: manual override if set, otherwise (archived seasons)+1 so it advances on its own. */
function seasonNumber(){ const s=state.season||{}; if(Number.isFinite(+s.num) && +s.num>0) return +s.num; return ((state.pastSeasons&&state.pastSeasons.length)||0)+1; }
function applyTheme(){
  const t=seasonTheme(), root=document.documentElement;
  if(t && t.hero) root.style.setProperty('--img-hero','url('+t.hero+')');
  else root.style.removeProperty('--img-hero');   // fall back to the default masthead art
}
function renderSeasonBanner(){
  const box=el('seasonBanner'); if(!box) return;
  const s=state.season||{}, ch=CHALLENGES[s.challenge], t=seasonTheme();
  const isNew = (typeof s.start==='number') && (Date.now() < s.start + 3*86400000);
  const ds=fmtDate(s.start), de=fmtDate(s.end);
  const range = (ds||de) ? ((ds||'—')+' – '+(de||'—')) : 'Season standings';
  const open = (t&&t.banner) ? '<div class="season-banner hasimg" style="background-image:url('+t.banner+')">' : '<div class="season-banner">';
  box.innerHTML = open
    + (isNew?'<span class="sb-new">New Season</span>':'')
    + ((PR_LOGO&&PR_LOGO.indexOf('data:')===0)?'<img class="sb-watermark" src="'+PR_LOGO+'" alt="">':'')
    + '<div class="sb-kicker"><span class="sb-num">Season '+seasonNumber()+'</span> · Road to 1.0</div>'
    + '<div class="sb-name">'+esc(s.name||'Season')+'</div>'
    + '<div class="sb-sub">'+esc(range)+(ch?' · Challenge: '+esc(ch.label):'')+(champMultOf(s)>1?' · <b style="color:var(--gold-b)">Finals 2×</b>':'')+'</div>'
    + '</div>';
}
function renderSeasonBar(){
  const bar = el('seasonBar'); if(!bar) return;
  const s = state.season||{}; const w = seasonWindow(); const now = Date.now();
  let status, cls;
  if(w.start && now < w.start){ status = 'Starts '+fmtDate(w.start); cls='soon'; }
  else if(w.end && now > w.end){ status = 'Season ended'; cls='ended'; }
  else if(w.end){ const days = Math.ceil((w.end-now)/86400000); status = days+' day'+(days===1?'':'s')+' left'; cls='live'; }
  else { status = 'Live'; cls='live'; }
  const ds = fmtDate(s.start), de = fmtDate(s.end);
  const range = (ds||de) ? ((ds||'—')+' – '+(de||'—')) : 'All-time · no dates set';
  const ch = CHALLENGES[s.challenge];
  const chLine = ch ? `<div class="s-dates" style="color:var(--gold-b)">Challenge: ${esc(ch.label)}${champMultOf(s)>1?' · FINALS 2×':''}</div>` : '';
  const right = (cls==='live' && w.end)
    ? `<div class="s-count" id="seasonCountdown" data-end="${w.end}">${cdHTML(w.end)}</div>`
    : `<div class="s-status ${cls}">${status}</div>`;
  bar.innerHTML = `<div class="season-bar">
    <div><div class="s-name"><span class="s-num">S${seasonNumber()}</span> ${esc(s.name||'Season')}</div><div class="s-dates">${range}</div>${chLine}</div>
    ${right}
  </div>`;
}
/* Live season countdown — ticks every second; rollover itself is handled by maybeRolloverSeason() on the poll loop. */
function cdParts(ms){ ms=Math.max(0,ms); const s=Math.floor(ms/1000); return { d:Math.floor(s/86400), h:Math.floor(s%86400/3600), m:Math.floor(s%3600/60), s:s%60 }; }
function cdHTML(end){ const p=cdParts(end-Date.now()); const seg=(v,l)=>`<span class="cd-seg"><b>${String(v).padStart(2,'0')}</b><i>${l}</i></span>`;
  return `<div class="cd-lab">Season ends in</div><div class="cd-row">${seg(p.d,'DAYS')}${seg(p.h,'HRS')}${seg(p.m,'MIN')}${seg(p.s,'SEC')}</div>`; }
function tickSeasonCountdown(){ const c=el('seasonCountdown'); if(!c) return; const end=+c.dataset.end; if(!end) return;
  if(end-Date.now()<=0){ c.innerHTML='<div class="cd-lab">Season</div><div class="cd-row"><span class="cd-end">Rolling over…</span></div>'; return; }
  c.innerHTML=cdHTML(end); }

function championHtml(list){
  const medal = ['1','2','3'];
  const champ = list[0];
  const runners = list.slice(1);
  let html = `<div class="hof-champ"><span class="hof-crown">${medal[0]}</span>
    <span class="cn">${esc(champ.name)}</span> <span class="badge b-${champ.tier}">${champ.tier}</span>
    <span class="cs">${Number(champ.sr).toLocaleString()} SR</span></div>`;
  if(runners.length){
    html += '<div class="hof-runners">' + runners.map((r,i)=>
      `<div class="hof-run"><span class="rp">${medal[i+1]||(i+2+'.')}</span><span class="rn">${esc(r.name)}</span>
       <span class="badge b-${r.tier}">${r.tier}</span><span class="rs">${Number(r.sr).toLocaleString()} SR</span></div>`).join('') + '</div>';
  }
  return html;
}

function renderHallOfFame(){
  const card = el('hofCard'), body = el('hofBody'); if(!card||!body) return;
  const past = [...(state.pastSeasons||[])].sort((a,b)=> (b.endedAt||0)-(a.endedAt||0));
  if(past.length===0){ card.style.display='none'; return; }
  card.style.display='block';
  body.innerHTML = past.map(s=>{
    const ds=fmtDate(s.start), de=fmtDate(s.end||s.endedAt);
    const range = (ds?ds:'—')+' – '+(de?de:'—');
    const champs = (s.champions&&s.champions.length)? championHtml(s.champions) : '<div class="note">No standings recorded.</div>';
    return `<div class="hof-item">
      <div class="hof-head"><span class="hof-season">${esc(s.name||'Season')}</span><span class="hof-dates">${range}</span></div>
      ${champs}
    </div>`;
  }).join('');
}

function renderPastAdmin(){
  const box = el('pastSeasonsAdmin'); if(!box) return;
  const past = [...(state.pastSeasons||[])].sort((a,b)=> (b.endedAt||0)-(a.endedAt||0));
  if(past.length===0){ box.innerHTML=''; return; }
  box.innerHTML = '<p class="note" style="margin:0 0 6px"><b style="color:var(--gold-b)">Past seasons</b></p>' +
    past.map(s=>{
      const champ = (s.champions&&s.champions[0])? esc(s.champions[0].name)+' · '+Number(s.champions[0].sr).toLocaleString()+' SR' : 'no champion';
      return `<div class="hrow"><div><div class="det" style="color:var(--txt);font-weight:700">${esc(s.name||'Season')}</div><div class="det">${champ}</div></div>
        <button class="del-x" title="Delete this archived season" data-delseason="${esc(s.id)}">✕</button></div>`;
    }).join('');
}

/* ============================================================
   Player profile modal
   ============================================================ */
function openProfile(pid){
  const st = computeStandings();
  const idx = st.findIndex(p=>p.id===pid);
  if(idx<0) return;
  const p = st[idx];
  const real = p.raids.filter(r=> r.carryover == null);   // played raids only
  const n = real.length;
  const sum = f=> real.reduce((a,r)=>a+(f(r)||0),0);
  const opK = sum(r=>r.operatorKills), sqK = sum(r=>r.squadKills);
  const contracts = real.filter(r=> r.contract==='regular'||r.contract==='hunt').length;
  const exfils = real.filter(r=> r.extracted).length;
  const finalExfils = real.filter(r=> r.finalExfil).length;
  const weaponCases = real.filter(r=> r.weaponCase && r.extracted).length;
  const bossK = sum(r=> Math.min(r.bossKills||0, 2));
  const exfilRate = n ? Math.round(exfils/n*100) : 0;
  const f1 = x=> (Math.round(x*10)/10).toString();
  const place = idx+1;
  const ri = rankInfo(p.sr);
  const peakRi = rankInfo(p.peak||0);
  const eb = eliteBadges(st)[p.id];   // exclusive top-3 tier badge, if earned
  const tiles = [
    ['Peak SR', (p.peak||0).toLocaleString()],
    ['Total raids', n], ['Operator kills', opK], ['Avg kills / raid', n?f1(opK/n):'0'],
    ['Squad kills', sqK], ['Avg squad / raid', n?f1(sqK/n):'0'], ['Contracts', contracts],
    ['Exfils', exfils], ['Exfil success', exfilRate+'%'], ['Final exfils', finalExfils],
    ['Weapon cases', weaponCases]
  ];
  if(s2on()) tiles.push(['Boss kills', bossK]);
  const grid = tiles.map(t=>`<div class="pf-tile"><div class="v">${t[1]}</div><div class="l">${t[0]}</div></div>`).join('');
  const series = p.raids.slice().sort((a,b)=>(a.ts||0)-(b.ts||0)).map(r=>({ts:r.ts||0, sr:r.srAfter}));
  el('profileBody').innerHTML =
    `<div class="pf-head">
       <div class="pf-place ${place<=3?'':'np'}">${place}</div>
       <div class="pf-name">${esc(p.name)}</div>
       <div class="pf-elitewrap">
         ${eb?`<img class="pf-elite" src="${eb.badge}" alt="Top 3 ${eb.tier}" title="Top 3 ${eb.tier} — #${eb.rank} in tier">`:''}
         <div class="pf-medal rankbadge b-${p.tier}" style="margin-left:0;background-image:url(${appBadge(ri,p.tier)})" title="${esc(ri.label)}"></div>
       </div>
     </div>
     <div class="pf-sub"><span class="rankname b-${p.tier}" style="font-size:15px">${ri.label}</span>
       <b style="color:var(--gold-b);font-family:var(--f-display);font-size:16px">${p.sr.toLocaleString()} SR</b>
       · Rank #${place} of ${st.length}${eb?` · <span class="rankname b-${p.tier}" style="font-weight:700">Top 3 ${eb.tier}</span>`:''}
       <span class="pf-peak">· Peak <b>${(p.peak||0).toLocaleString()}</b> SR${(p.peak||0)>p.sr?` (${esc(peakRi.label)})`:''}</span></div>
     <div class="pf-prog b-${p.tier}">
       <div class="pf-prog-top"><span class="nowr">${esc(ri.label)}</span><span>${ri.isApex?('Rank #'+place+' — apex ladder'):(ri.toNext.toLocaleString()+' SR to '+esc(ri.nextLabel))}</span></div>
       <div class="rankprog"><i style="width:${ri.isApex?100:ri.pct.toFixed(0)}%"></i></div>
     </div>
     <div class="pf-report"><button class="pf-reportbtn${reportedLocally('p:'+p.id)?' reported':''}" data-reportp="${esc(p.id)}" title="Flag this operator for an admin to review">${reportedLocally('p:'+p.id)?'⚑ Reported':'⚑ Report this operator'}</button></div>
     <div class="pftabs">
       <button data-pftab="overview" class="active">Overview</button>
       <button data-pftab="ach">Achievements</button>
       <button data-pftab="trophies">Trophies${(state.players.find(x=>x.id===p.id)||{}).awards&&(state.players.find(x=>x.id===p.id)||{}).awards.length?` <span class="pft-count">${(state.players.find(x=>x.id===p.id)||{}).awards.length}</span>`:''}</button>
       <button data-pftab="log">Raid Log <span class="pft-count">${p.raids.length}</span></button>
     </div>
     <div class="pftab-panel active" data-pftabpanel="overview">
       ${featuredMedals(state.players.find(x=>x.id===p.id)||{})}
       <div class="pf-grid">${grid}</div>
       ${buildCompare(real)}
       <div class="pf-sec">Rank progression</div>
       ${buildSpark(series)}
       ${buildMilestones(series)}
     </div>
     <div class="pftab-panel" data-pftabpanel="ach">
       ${buildAchievements({ n, opK, sqK, contracts, exfils, finalExfils, weaponCases, bossK })}
     </div>
     <div class="pftab-panel" data-pftabpanel="trophies">
       ${buildTrophies(state.players.find(x=>x.id===p.id)||{ id:p.id, name:p.name })}
     </div>
     <div class="pftab-panel" data-pftabpanel="log">
       ${buildRaidLog(p)}
     </div>`;
  el('profileModal').style.display = 'flex';
  el('profileBody').scrollTop = 0;
}
/* Scrollable list of every raid this player has logged (most recent first) */
function buildRaidLog(p){
  const rows = p.raids.slice().sort((a,b)=>(b.ts||0)-(a.ts||0)).map(r=>{
    const d = r.ts ? new Date(r.ts) : null;
    const when = d ? d.toLocaleDateString(undefined,{month:'short',day:'numeric'})+' · '+d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}) : '';
    const bits=[];
    if(r.carryover) bits.push('carryover +'+(Number(r.carryover)||0).toLocaleString()+' SR');
    if(r.operatorKills) bits.push(r.operatorKills+' op kill'+(r.operatorKills>1?'s':''));
    if(r.squadKills) bits.push(r.squadKills+' squad kill'+(r.squadKills>1?'s':''));
    if(r.bossKills) bits.push(Math.min(r.bossKills,2)+' boss kill'+(Math.min(r.bossKills,2)>1?'s':''));
    if(r.contract==='regular') bits.push('regular contract');
    if(r.contract==='hunt') bits.push('hunt contract');
    if(r.extracted) bits.push('extracted'); else if(r.carryover==null) bits.push('no exfil');
    if(r.weaponCase) bits.push('weapon case');
    if(r.fullSquad) bits.push('full squad');
    if(r.finalExfil) bits.push('final exfil');
    const dcls = r.delta>0?'up':r.delta<0?'down':'zero';
    const tag = r.verified ? '<span class="vf-chip">✓ Verified</span>'
      : (raidHasProof(r) ? '<span class="vf-pending">proof pending</span>' : '');
    const repd = reportedLocally('r:'+r.id);
    const rep = (r.carryover==null) ? `<button class="rl-report${repd?' reported':''}" data-report="${esc(r.id)}" title="${repd?'You reported this raid':'Report this raid to an admin'}">⚑</button>` : '';
    return `<div class="rl-row">
      <div class="rl-main"><div class="rl-when">${when}</div><div class="rl-acts">${esc(bits.join(' · ')||'no actions')}${tag?' '+tag:''}</div></div>
      <div class="rl-sr"><span class="delta ${dcls}">${r.delta>=0?'+':''}${r.delta}</span><div class="rl-tot">${(r.srAfter||0).toLocaleString()} SR</div>${rep}</div>
    </div>`;
  }).join('');
  return `<div class="pf-sec">Raid log <span class="rl-count">${p.raids.length}</span></div>
    <div class="rl-box">${rows||'<div class="rl-empty">No raids logged yet.</div>'}</div>`;
}

/* ---------- Change Log (baked-in; newest first). Bump `v` when adding an entry
   so everyone gets the "new" dot until they open the Updates tab on their device. ---------- */
const CHANGELOG = [
  { v:27, ver:'v27', date:'Sep 4, 2026', tag:'Fix', title:'Performance patch + keeping the board alive',
    body:"A quick optimization to keep things fast as we grow — plus an honest note from the team.",
    items:[
      "We've grown a ton lately — welcome to everyone who found us through the recent videos! To keep up, we shipped a quick patch that lightens how much data the site pulls, so the board stays fast and reliable as more of you pile in. A bigger upgrade is in the works behind the scenes.",
      "Heads-up for streamers: with this patch your overlays may take a little longer to update than they used to — a change can take up to a couple of minutes to show on your ticker instead of almost instantly. That's expected for now; the larger fix will bring it back to near-instant.",
      "We've trimmed the overlay lineup to the two most-used ones — the Live Ticker and the Rank Card. The Corner Standings overlay has been retired; if you were running it, hop into the Overlays tab and grab the Ticker or Rank Card instead.",
      "A note on keeping the lights on: what started as a free side project has taken off, and hosting a board this size now costs us every month. If you'd like to chip in, there's a ☕ Support button up top. Every dollar donated goes strictly toward development and keeping the site online — and anything beyond that gets put right back into the community in a responsible way. It's completely optional and always will be; just playing, logging raids, and spreading the word helps more than you know. Thank you for being part of this."
    ] },
  { v:26, ver:'v26', date:'Aug 31, 2026', tag:'New', title:'Support the board + cleaner proof',
    body:"A couple of small changes — one to help keep the lights on, one to cut the clutter.",
    items:[
      "The board costs real money to run as we grow. There's now a ☕ Support button up in the header — if you're able to chip in to keep it online, it's hugely appreciated. Totally optional, always will be.",
      "Proof uploads now only appear on big raids (10+ operator kills). No more attaching a screenshot of a 1-kill run — proof is for the runs worth verifying."
    ] },
  { v:25, ver:'v25', date:'Aug 27, 2026', tag:'Rules', title:'Fair play: log as you go',
    body:"A small rule change to keep the board honest for everyone.",
    items:[
      "Raids are now logged one at a time, as you play them — you can't sit down and dump a whole session at once. If you just logged a raid, you'll be asked to wait a few minutes before the next one.",
      "A real raid takes far longer than that gap, so if you're logging as you actually play, you'll never notice it. It only stops bulk-entering a pile of raids in one go."
    ] },
  { v:24, ver:'v24', date:'Aug 27, 2026', tag:'New', title:'Suggestions, name search & a faster board',
    body:"You asked, we built. A place to pitch ideas, a quick way to find your name, plus a big speed pass under the hood.",
    items:[
      "New Suggestions tab in the Community section: pitch an idea, upvote the ones you want, and the most-wanted rise to the top. Every suggestion starts with your own upvote.",
      "Admins can mark suggestions 🔧 Planned or ✓ Done, and can archive or delete anything that's off-topic or trolling — flagged suggestions get a ⚑ count so they're easy to spot.",
      "Added a search box to the Standings — type any operator's name to jump straight to them instead of scrolling.",
      "Proof screenshots now open in a full-size in-app viewer when you tap them, instead of a blank tab you had to zoom into. Thumbnails are bigger too.",
      "Big performance pass: the board now syncs changes incrementally instead of re-downloading everything, so it's faster, lighter on data, and far less likely to lag or drop offline during busy stretches.",
      "Fixed the mobile layout loading zoomed-out and shifted to one side — it now fits your screen on first load."
    ] },
  { v:23, ver:'v23', date:'Aug 21, 2026', tag:'New', title:'Fairer raid reviews + Verified badges',
    body:"We heard you: the anti-cheat holds were too silent and too twitchy at season start. Reviews are now clear, transparent, and rewarding.",
    items:[
      "New Max SR per raid and Max operator-kills per raid limits (admin-set). Any raid over a cap waits for approval instead of hitting the board — and because they're fixed numbers, they're fair even in the first days of a season when there aren't many raids to compare against.",
      "No more silent holds. If your raid goes over a limit you now get a clear message telling you it's under review, why, and where to track it — instead of the raid just not showing up.",
      "New Under Review tab in the Community section: every raid waiting on approval is listed publicly with its stats and the reason it's held, so you can watch your own raid's status and everyone can see the board stays honest.",
      "Re-logging a raid that's already under review no longer stacks duplicate entries (which used to get people extra-flagged) — it just points you to the review status.",
      "Approved raids now earn a ✓ Verified badge, shown on your profile and in the overall raid History.",
      "Tuned the new-operator outlier check so a normal early-season run isn't held just because the board doesn't have many raids yet."
    ] },
  { v:22, ver:'v22', date:'Aug 20, 2026', tag:'New', title:'Season 2 — the full patch notes',
    body:"Everything new since Season 1, in detail. Grab a coffee — this was a big one.",
    items:[
      "— RANKS & PROGRESSION —",
      "Divisions: every tier (Bronze → Crimson) now splits into three sub-ranks — I, II and III. You enter a tier at I and climb to III before promoting, so there's always a next rank a raid or two away.",
      "Deployment fees now scale by division, not just by tier. The fee steps up a little each time you climb a division, so the deeper you sit inside a rank the more it costs to deploy — a gentler curve than one big jump at every tier line. Bronze I still deploys free (Bronze II −5, III −10), on up through Silver 15/20/25, Gold 30/35/40, Platinum 45/50/55, Diamond 60/65/70 and Crimson 75/80/85. Iridescent stays a flat −100 as the apex ladder. Full table lives in the Field Manual.",
      "Brand-new division badge art — your exact I / II / III badge now shows on every leaderboard row, on your profile, and on both stream overlays.",
      "Top 3 of Iridescent wear the crowned DMZ skull badge instead of the snake — the rarest badge in the game.",
      "Peak SR: your highest SR of the season is now tracked and shown on your profile, so a bad night never erases your best run.",
      "Progress-to-next-rank bars on the leaderboard and your profile show exactly how close you are to ranking up.",
      "Boss kills now count toward your SR — up to 2 per raid at +10 SR each — logged right on the raid form.",
      "— LOGGING A RAID —",
      "Tap-to-log kills: operator and squadmate kills are now a row of number buttons instead of a text box — tap “4” for four kills and you're done. No keyboard, no typing, way faster on a phone mid-session.",
      "Big run? Operator kills has a “15+” button that opens a keypad for the rare monster raid, and boss kills tap the same way (Season 2).",
      "The Log screen is more condensed overall, and the live SR preview updates the instant you tap a number so you see exactly what the raid is worth before you submit.",
      "— THE CHAMPIONSHIP (ROAD TO 1.0) —",
      "A season-long Championship: every two-week season pays Championship Points, and those points stack all the way to MW4 launch. Most points when the beta ends is crowned DMZ Ranked Beta Champion.",
      "The Championship officially starts at Season 2 — Season 1 was the preseason, so everyone begins the race even.",
      "The Crowned Reaper: a one-of-one champion's trophy, shown live on the Championship page and awarded to the overall points leader at the finish.",
      "How points are earned each season: your final leaderboard finish (25·20·16·13·11·9·7·5·3·1 for the top 10), the season-challenge podium (+5 / +3 / +1), an Active Bonus (+2 for logging 8+ raids), and the Finals season pays double.",
      "The Championship page was rebuilt with a clear, plain-English breakdown and standings that auto-update every season.",
      "Live season countdown: the exact time left in the season ticks down at the top of the board (days / hours / minutes / seconds), and the season auto-rolls to the next one when it hits zero.",
      "— ACHIEVEMENTS —",
      "Ten achievement tracks on your profile (Operator Kills, Kills/Raid, Squad Kills, Exfils, Exfil %, Final Exfils, Weapon Cases, Contracts, Boss Kills, Raids Logged).",
      "Each track climbs from 1 star to 3 stars to a Diamond medal — and every tier now pays SR: +25 / +50 / +100 / +200.",
      "Unlock one mid-session and it pops right in your raid recap with the medal and the SR you just banked.",
      "The Medals board shows who's stacked the most stars and Diamonds this season.",
      "— HOT & COLD STREAKS —",
      "String together consecutive exfils and your row catches fire — a small flame at 2, bigger at 4, a full inferno at 6. Go on a run of no-exfils and you ice over instead. All live, right on the leaderboard.",
      "— STREAM OVERLAYS —",
      "New Overlays tab: build your own OBS overlay in a few clicks — no account, no admin. Full step-by-step OBS guide included.",
      "Live Ticker overlay in two styles — a slim bar or a corner card — showing your rank, SR, division and last-raid change.",
      "Corner Standings overlay: your row centered with the two players above and below you, auto-flipping to the Top 5 every 45 seconds.",
      "Make it yours: your own border/inside colors, title & text colors, panel transparency, your logo, and an overlay-size dial that stays razor-sharp on 1080p, 1440p and 4K.",
      "Save your look to your profile and your OBS overlay updates itself within ~15 seconds — set the browser source once and never re-copy a link again.",
      "The card layout was redesigned with a big featured rank badge and bigger, easier-to-read stats.",
      "— COMMUNITY & PROFILE —",
      "Leaders board: who's #1 in every category, each stat shown against the squad and community average, in a Cards or Chart view.",
      "Award Standings: the live race for every season trophy, all in one place and updated in real time.",
      "Trophy Case: dozens of season trophies with custom art (serious and joke), auto-awarded when a season ends — feature your favorite three on your profile.",
      "Community Polls: vote on the awards stats can't measure — Top Salesman, Lucky SOB, Humpty Dumpty and more.",
      "Hall of Shame and the Medals board round out the community tab — the boards you do and don't want to top.",
      "Power Rankings card with weekly movement arrows — a branded image ready to drop straight into Discord.",
      "Your profile is now a full operator card: rank badge, Peak SR, progress, featured trophies, every stat with per-raid rates vs the squad & community, and your complete raid log.",
      "— LOOK & FEEL —",
      "A premium facelift: glassy tier-colored progress bars, metallic rank text and SR numbers, glowing tier badges, and a subtle animated shine on the #1 row.",
      "New Contact tab with a one-tap link to join the community Discord.",
      "Per-season themes, banners and season numbers give every season its own identity, plus an Awards guide in the Field Manual explaining every medal and how to earn it.",
      "This 'What's New' tour that pops up when Season 2 drops (and lives in the Updates tab any time you want to flip back through it).",
      "— FIXES —",
      "Achievement star tally now counts maxed tracks correctly.",
      "Rank badges on the overlays are re-sized uniformly and no longer clip at the edges."
    ] },
  { v:6, date:'Aug 14, 2026', time:'10:52 PM ET', tag:'New', title:'Anti-troll: name filter + raid approval',
    body:"Offensive operator names are now blocked automatically, and any suspiciously high raid (over 30 operator kills or 600 SR in one run) waits for an admin's approval before it hits the board — no more fake million-SR entries. Admins manage the blocked-word list, thresholds, and the approval queue under Settings → Safety & moderation." },
  { v:5, date:'Aug 14, 2026', tag:'New', title:'Your full raid history on your profile',
    body:"Tap any operator on the leaderboard to open their profile — now with every raid they've logged in a scrollable list, plus a rank graph that turns red on any SR loss." },
  { v:4, date:'Aug 14, 2026', tag:'New', title:'Protect your name with a PIN',
    body:"On the Log a Raid screen you can set an optional PIN so only you can log raids under your name. Enter it once on your phone and you're set — no typing it every time. Forgot it? An admin can reset it." },
  { v:3, date:'Aug 14, 2026', tag:'New', title:'Official-style rank badges',
    body:"Every operator now has a detailed rank medallion next to their name on the leaderboard and on their profile." },
  { v:2, date:'Aug 14, 2026', tag:'Fix', title:'No more disappearing raids — and less lag',
    body:"Raids now save one at a time instead of rewriting the whole board, so two people logging at the same moment can never overwrite each other. It's also faster with the full squad on." }
];
const TAGCOL = { New:'#8fd14f', Feature:'#8fd14f', Fix:'#67b4ee', Rules:'#f2ca63', Season:'#c79bff' };
function newestChangelogV(){ return CHANGELOG.reduce((m,c)=>Math.max(m,c.v),0); }
function seenChangelogV(){ return parseInt(lsGet('dmz_seen_updates')||'0',10) || 0; }
function updatesDotState(){ const dot=el('updatesDot'); if(dot) dot.style.display = (newestChangelogV() > seenChangelogV()) ? '' : 'none'; }
function markUpdatesSeen(){ lsSet('dmz_seen_updates', String(newestChangelogV())); updatesDotState(); }
function changelogCardHTML(c){
  const col = TAGCOL[c.tag] || '#e6a92b';
  return `<div class="cl-item">
      <div class="cl-top">
        <span class="cl-tag" style="color:${col};border-color:${col}55">${esc(c.tag)}</span>
        ${c.ver?`<span class="cl-ver">${esc(c.ver)}</span>`:''}
        <span class="cl-title">${esc(c.title)}</span>
        <span class="cl-date">${esc(c.date)}${c.time?' · '+esc(c.time):''}</span>
      </div>
      ${c.body?`<div class="cl-body">${esc(c.body)}</div>`:''}
      ${Array.isArray(c.items)&&c.items.length?`<ul class="cl-list">${c.items.map(it=>{const m=/^—\s*(.+?)\s*—$/.exec(it);return m?`<li class="cl-sec">${esc(m[1])}</li>`:`<li>${esc(it)}</li>`;}).join('')}</ul>`:''}
    </div>`;
}
function renderUpdates(){
  const body = el('updatesBody'); if(!body) return;
  const wnBtn = (typeof WHATSNEW_PAGES!=='undefined' && WHATSNEW_PAGES.length)
    ? `<div style="margin:0 0 16px"><button class="wn-btn" onclick="openWhatsNew()">🎉 See what's new in Season 2</button></div>` : '';
  body.innerHTML = wnBtn + CHANGELOG.slice().sort((a,b)=>b.v-a.v).map(changelogCardHTML).join('');
}
/* Profile "How you compare" — this operator's per-raid rates vs squad & community averages */
function buildCompare(real){
  const { players } = leadersData();
  if(real.length < 3 || players.length < 2) return '';
  const defs = [
    { label:'Kills / raid',   metric:r=> r.operatorKills||0, fmt:v=>_f1(v) },
    { label:'Exfil %',        metric:r=> r.extracted?100:0,  fmt:v=>Math.round(v)+'%' },
    { label:'SR gained / raid', metric:r=> r.delta||0,       fmt:v=>(v>=0?'+':'')+Math.round(v).toLocaleString() }
  ];
  // Community/squad baselines = MEDIAN operator (robust to a few padded accounts).
  const block = defs.map(d=>{
    const pv = p=> _mean(p.real.map(d.metric));
    const qual = players.filter(p=> p.n>=3);
    const me = _mean(real.map(d.metric));
    const co = qual.length ? median(qual.map(pv)) : me;
    const sqPool = qual.filter(p=> p.squadRaids/p.n >= 0.5);
    const sqv = sqPool.length ? median(sqPool.map(pv)) : null;
    const max = Math.max(1, me, co, sqv||0);
    const bar = (l,v,c)=> v==null
      ? `<div class="lb-bar"><span class="lb-l">${l}</span><div class="lb-track"><div class="lb-fill ${c}" style="width:0"></div></div><span class="lb-v">—</span></div>`
      : `<div class="lb-bar"><span class="lb-l">${l}</span><div class="lb-track"><div class="lb-fill ${c}" style="width:${Math.max(3,Math.round(v/max*100))}%"></div></div><span class="lb-v">${d.fmt(v)}</span></div>`;
    return `<div class="cmp-stat"><div class="cmp-name">${d.label}</div>${bar('You',me,'me')}${bar('Squad avg',sqv,'sq')}${bar('Community avg',co,'co')}</div>`;
  }).join('');
  return `<div class="pf-sec">How you compare <span class="pf-secnote">per-raid rates vs squad &amp; community</span></div><div class="cmp-wrap">${block}</div>`;
}
/* ============================================================
   Season achievements — progressive ★ / ★★ / ★★★ / ◆ Diamond badges
   (per season; rate stats need 10+ raids; Diamond is deliberately elite)
   ============================================================ */
const ACH_STAR_IMG='/assets/legacy/leaderboard-053-8851e8323933.webp';
const ACH_DIA_IMG='/assets/legacy/leaderboard-054-dd6d1337e9a9.webp';
const ACHV = [
  { key:'opk',  label:'Operator Kills', val:s=>s.opK,          t:[40,90,150,250] },
  { key:'exf',  label:'Exfils',         val:s=>s.exfils,       t:[8,18,32,50] },
  { key:'sqk',  label:'Squad Kills',    val:s=>s.sqK,          t:[20,45,90,150] },
  { key:'wc',   label:'Weapon Cases',   val:s=>s.weaponCases,  t:[4,9,18,30] },
  { key:'fin',  label:'Final Exfils',   val:s=>s.finalExfils,  t:[3,7,14,25] },
  { key:'con',  label:'Contracts',      val:s=>s.contracts,    t:[12,28,55,100] },
  { key:'raids',label:'Raids Logged',   val:s=>s.n,            t:[10,22,40,65] },
  { key:'boss', label:'Boss Kills', s2:true, val:s=>s.bossK,   t:[4,9,18,30] },
  { key:'kpr',  label:'Kills / Raid', rate:true, min:10, fmt:v=>_f1(v),          val:s=>s.n?s.opK/s.n:0,      t:[0.5,1.5,4,6] },
  { key:'exfr', label:'Exfil %',      rate:true, min:10, fmt:v=>Math.round(v)+'%',val:s=>s.n?s.exfils/s.n*100:0,t:[45,65,82,95] }
];
const ACH_SR = [25, 50, 100, 200];   // SR awarded for reaching 1★ / 2★ / 3★ / ◆ Diamond on any achievement track
function starTier(v, t){ let n=0; for(const x of t){ if(v>=x) n++; } return n; }
function tierIcons(level){
  let s=''; for(let i=1;i<=3;i++) s+=`<img class="ach-badge ach-star-img${level>=i?' on':''}" src="${ACH_STAR_IMG}" alt="${i} star" title="${i} star${i>1?'s':''}">`;
  s+=`<img class="ach-badge ach-dia-img${level>=4?' on':''}" src="${ACH_DIA_IMG}" alt="Diamond medal" title="Diamond medal">`;
  return `<span class="ach-icons">${s}</span>`;
}
function buildAchievements(S){
  const defs = ACHV.filter(a=> !a.s2 || s2on());
  let diamonds=0, stars=0;
  const tiles = defs.map(a=>{
    const fmt = a.fmt || (x=>Math.round(x).toLocaleString());
    const locked = a.rate && S.n < (a.min||0);
    const v = a.val(S);
    const level = locked ? 0 : starTier(v, a.t);
    if(level>=4){ diamonds++; stars += 3; } else { stars += level; }   // a maxed track shows 3 filled stars + the diamond — count both
    let barPct, sub;
    if(level>=4){ barPct=100; sub='MAX · Diamond medal'; }
    else if(locked){ barPct=0; sub=`play ${a.min}+ raids to qualify`; }
    else { const prev=level>0?a.t[level-1]:0, next=a.t[level];
      barPct=Math.max(2, Math.min(100, Math.round((v-prev)/(next-prev)*100)));
      sub=`${fmt(v)} / ${fmt(next)} to ${level>=3?'◆ Diamond':(level+1)+'★'}`; }
    return `<div class="ach ${level>=4?'ach-dia':level>0?'ach-on':'ach-off'}">
      <div class="ach-top"><span class="ach-name">${esc(a.label)}</span>${tierIcons(level)}</div>
      <div class="ach-bar"><div class="ach-fill" style="width:${barPct}%"></div></div>
      <div class="ach-sub">${esc(sub)}</div>
    </div>`;
  }).join('');
  const sum = `<span class="ach-sum">${diamonds?`<b class="ach-dcount">◆ ${diamonds}</b> · `:''}<b>${stars}</b>★ this season</span>`;
  return `<div class="pf-sec">Season achievements ${sum}</div><div class="ach-grid">${tiles}</div>`;
}
/* Achievement tally for any player (this season). Diamond is weighted far above a star. */
function achStats(p){ return { n:p.n, opK:p.opK, sqK:p.sqK, contracts:p.contracts, exfils:p.exfils, finalExfils:p.finalExfils, weaponCases:p.weaponCases, bossK:p.bossK }; }
function achScore(S){
  let diamonds=0, stars=0, pts=0;
  ACHV.filter(a=> !a.s2 || s2on()).forEach(a=>{
    const locked = a.rate && S.n < (a.min||0);
    const lvl = locked ? 0 : starTier(a.val(S), a.t);
    if(lvl>=4){ diamonds++; stars+=3; pts+=5; } else { stars+=lvl; pts+=lvl; }
  });
  return { diamonds, stars, pts };
}
/* Community → Medals: rank everyone by achievements collected this season. */
function renderMedals(){
  const intro = el('medalsIntro'), body = el('medalsBody');
  if(!body) return;
  const { players } = leadersData();
  const scored = players.filter(p=> p.n>0).map(p=>({ p, ...achScore(achStats(p)) }))
    .filter(x=> x.pts>0)
    .sort((a,b)=> b.pts-a.pts || b.diamonds-a.diamonds || a.p.name.localeCompare(b.p.name));
  if(intro) intro.innerHTML = `<p class="ldr-lead">Who's collected the most this season, across all ten achievement tracks. A <b>Diamond medal</b> is worth far more than a star, so maxing categories is what climbs this board — it resets with every new season.</p>`;
  if(!scored.length){
    body.innerHTML = '<div class="card"><div class="empty">No achievements earned yet this season. Log some raids and start stacking stars.</div></div>';
    return;
  }
  const rows = scored.slice(0,25).map((x,i)=>{
    const { p, diamonds, stars } = x;
    const dia = `<span class="mb dia" title="${diamonds} Diamond medal${diamonds===1?'':'s'}">${diamonds?`<img class="mb-ic" src="${ACH_DIA_IMG}" alt="diamond"> ${diamonds}`:''}</span>`;
    const st  = `<span class="mb star" title="${stars} star${stars===1?'':'s'}">${stars?`<img class="mb-ic" src="${ACH_STAR_IMG}" alt="star"> ${stars}`:''}</span>`;
    return `<div class="medal-row lb-clickable" data-profile="${esc(p.id)}" title="View ${esc(p.name)}'s profile">
      <span class="medal-rk r${i+1}">${i+1}</span>
      <span class="medal-nm">${esc(p.name)} <span class="rankname b-${p.tier}" style="font-size:11px">${p.tier}</span></span>
      <span class="medal-badges">${dia}${st}</span>
    </div>`;
  }).join('');
  body.innerHTML = `<div class="card" style="padding:6px 8px">${rows}</div>`;
}
/* ============================================================
   End-of-season Awards / Trophy Case
   ============================================================ */
const AWARD_GLYPHS = {
  crown:'<path d="M16 42l16 15 18-31 18 31 16-15v38H16z" fill="currentColor"/><rect x="16" y="82" width="68" height="9" fill="currentColor"/><circle cx="50" cy="66" r="4.5" fill="#12100c"/>',
  skull:'<path d="M50 16c-19 0-31 12-31 31 0 11 6 19 12 24v8c0 3 2 5 5 5h28c3 0 5-2 5-5v-8c6-5 12-13 12-24 0-19-12-31-31-31z" fill="currentColor"/><circle cx="37" cy="49" r="8" fill="#12100c"/><circle cx="63" cy="49" r="8" fill="#12100c"/><path d="M50 60l-5 12h10z" fill="#12100c"/>',
  target:'<circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" stroke-width="7"/><circle cx="50" cy="50" r="9" fill="currentColor"/><line x1="50" y1="10" x2="50" y2="26" stroke="currentColor" stroke-width="6"/><line x1="50" y1="74" x2="50" y2="90" stroke="currentColor" stroke-width="6"/><line x1="10" y1="50" x2="26" y2="50" stroke="currentColor" stroke-width="6"/><line x1="74" y1="50" x2="90" y2="50" stroke="currentColor" stroke-width="6"/>',
  up:'<g fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"><path d="M28 56 50 34 72 56"/><path d="M28 74 50 52 72 74"/></g>',
  flag:'<rect x="28" y="16" width="6" height="70" rx="3" fill="currentColor"/><path d="M36 20h42v32H36z" fill="currentColor"/><g fill="#12100c"><rect x="40" y="24" width="9" height="10"/><rect x="60" y="24" width="9" height="10"/><rect x="50" y="38" width="9" height="10"/></g>',
  people:'<circle cx="35" cy="36" r="10" fill="currentColor"/><path d="M18 74c0-11 8-19 17-19s17 8 17 19z" fill="currentColor"/><circle cx="65" cy="38" r="9" fill="currentColor"/><path d="M50 74c0-10 7-17 15-17s15 7 15 17z" fill="currentColor"/>',
  case:'<rect x="20" y="40" width="60" height="42" rx="6" fill="currentColor"/><path d="M40 40v-8c0-3 2-5 5-5h10c3 0 5 2 5 5v8" fill="none" stroke="currentColor" stroke-width="7"/><rect x="20" y="54" width="60" height="7" fill="#12100c"/>',
  medal:'<g fill="none" stroke="currentColor" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"><path d="M24 42 50 20 76 42"/></g><path d="M50 44l6 13 14 2-10 10 3 14-13-7-13 7 3-14-10-10 14-2z" fill="currentColor"/>',
  refresh:'<path d="M50 22a28 28 0 1 0 27 21" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round"/><path d="M50 6 66 22 50 34z" fill="currentColor"/>',
  diamond:'<path d="M30 24h40l16 20-36 44-36-44z" fill="currentColor"/><path d="M30 24 44 44 20 44z" fill="#12100c" opacity=".22"/><path d="M70 24 56 44 80 44z" fill="#12100c" opacity=".22"/><path d="M20 44h60l-30 44z" fill="#000" opacity=".14"/>',
  backpack:'<rect x="28" y="34" width="44" height="52" rx="13" fill="currentColor"/><path d="M44 34v-3a6 6 0 0 1 12 0v3" fill="none" stroke="currentColor" stroke-width="5"/><line x1="28" y1="49" x2="72" y2="49" stroke="#12100c" stroke-width="4" opacity=".45"/><rect x="40" y="57" width="20" height="25" rx="6" fill="#12100c"/><circle cx="50" cy="69" r="2.8" fill="currentColor"/>',
  bomb:'<circle cx="45" cy="60" r="29" fill="currentColor"/><rect x="53" y="26" width="10" height="15" rx="3" transform="rotate(32 58 33)" fill="currentColor"/><path d="M65 22c4-5 11-4 12 2" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><circle cx="79" cy="16" r="5" fill="#f5e6b0"/><circle cx="37" cy="53" r="7" fill="#fff" opacity=".25"/>',
  rat:'<ellipse cx="47" cy="59" rx="27" ry="18" fill="currentColor"/><circle cx="30" cy="41" r="12" fill="currentColor"/><circle cx="30" cy="41" r="5" fill="#12100c"/><circle cx="23" cy="57" r="3" fill="#12100c"/><path d="M72 62c15 1 16 15 5 19" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>',
  smiley:'<circle cx="50" cy="50" r="34" fill="currentColor"/><circle cx="39" cy="44" r="5" fill="#12100c"/><circle cx="61" cy="44" r="5" fill="#12100c"/><path d="M35 60c7 9 23 9 30 0" fill="none" stroke="#12100c" stroke-width="5" stroke-linecap="round"/>',
  ghost:'<path d="M25 47c0-14 11-25 25-25s25 11 25 25v33l-8-7-8 7-9-7-8 7-9-7z" fill="currentColor"/><circle cx="42" cy="47" r="4.5" fill="#12100c"/><circle cx="58" cy="47" r="4.5" fill="#12100c"/>',
  person:'<circle cx="50" cy="33" r="14" fill="currentColor"/><path d="M24 84c0-16 12-27 26-27s26 11 26 27z" fill="currentColor"/>',
  fire:'<path d="M53 10c3 16-14 20-14 34 0 5 3 9 3 9-6 2-14 9-14 20 0 15 12 23 22 23s22-8 22-23c0-13-10-20-10-20s5-3 5-11c0-12-9-18-14-32z" fill="currentColor"/><path d="M50 52c4 4 8 10 8 17 0 8-6 12-8 12s-8-4-8-12c0-6 4-13 8-17z" fill="#12100c" opacity=".28"/>',
  siren:'<path d="M31 55a19 19 0 0 1 38 0z" fill="currentColor"/><rect x="27" y="55" width="46" height="11" rx="3" fill="currentColor"/><rect x="33" y="66" width="34" height="9" rx="2" fill="currentColor" opacity=".7"/><g stroke="currentColor" stroke-width="5" stroke-linecap="round"><line x1="50" y1="30" x2="50" y2="20"/><line x1="27" y1="41" x2="19" y2="35"/><line x1="73" y1="41" x2="81" y2="35"/></g><circle cx="50" cy="47" r="6" fill="#12100c" opacity=".3"/>',
  crab:'<ellipse cx="50" cy="58" rx="24" ry="16" fill="currentColor"/><circle cx="42" cy="54" r="4" fill="#12100c"/><circle cx="58" cy="54" r="4" fill="#12100c"/><path d="M27 52c-9-5-14-1-17-9M73 52c9-5 14-1 17-9" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M12 45l-2-8 8 2zM88 45l2-8-8 2z" fill="currentColor"/><g stroke="currentColor" stroke-width="4" stroke-linecap="round"><path d="M32 70l-9 9M44 74l-4 10M56 74l4 10M68 70l9 9"/></g>',
  mower:'<rect x="18" y="50" width="46" height="20" rx="4" fill="currentColor"/><circle cx="28" cy="76" r="8" fill="currentColor"/><circle cx="56" cy="76" r="8" fill="currentColor"/><circle cx="28" cy="76" r="3" fill="#12100c"/><circle cx="56" cy="76" r="3" fill="#12100c"/><path d="M64 56 84 32" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><rect x="78" y="26" width="15" height="7" rx="3" fill="currentColor"/><g stroke="currentColor" stroke-width="4" stroke-linecap="round"><path d="M16 84v-8M26 84v-6M36 84v-8"/></g>',
  puppy:'<ellipse cx="27" cy="46" rx="11" ry="21" fill="currentColor"/><ellipse cx="73" cy="46" rx="11" ry="21" fill="currentColor"/><circle cx="50" cy="51" r="27" fill="currentColor"/><circle cx="40" cy="47" r="4.6" fill="#12100c"/><circle cx="60" cy="47" r="4.6" fill="#12100c"/><ellipse cx="50" cy="61" rx="7" ry="5" fill="#12100c"/><path d="M50 66v5" stroke="#12100c" stroke-width="3" stroke-linecap="round"/><path d="M44 71c0 5 12 5 12 0z" fill="#e0738a"/>',
  coin:'<circle cx="50" cy="50" r="33" fill="currentColor"/><circle cx="50" cy="50" r="33" fill="none" stroke="#12100c" stroke-width="3" opacity=".22"/><path d="M50 27v46M43 37h13a7 7 0 0 1 0 14h-11a7 7 0 0 0 0 14h14" fill="none" stroke="#12100c" stroke-width="5" stroke-linecap="round"/>',
  rocket:'<path d="M50 12c12 8 18 23 18 39l-7 9H39l-7-9c0-16 6-31 18-39z" fill="currentColor"/><circle cx="50" cy="40" r="7" fill="#12100c"/><path d="M39 60 27 70l6-17zM61 60l12 10-6-17z" fill="currentColor"/><path d="M44 69h12l-6 17z" fill="#f2a63c"/>',
  moon:'<path d="M64 18a34 34 0 1 0 18 54 27 27 0 0 1-18-54z" fill="currentColor"/><path d="M40 26l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="currentColor" opacity=".85"/><circle cx="30" cy="44" r="2.5" fill="currentColor" opacity=".7"/>',
  megaphone:'<path d="M24 44 60 30v40L24 56z" fill="currentColor"/><rect x="14" y="45" width="12" height="10" rx="2" fill="currentColor"/><path d="M40 70l4 12h9l-5-13z" fill="currentColor"/><path d="M68 40c9 4 9 16 0 20" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M75 32c13 7 13 29 0 36" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity=".55"/>',
  raccoon:'<path d="M26 30l9 18-17-2z" fill="currentColor"/><path d="M74 30l-9 18 17-2z" fill="currentColor"/><circle cx="50" cy="54" r="29" fill="currentColor"/><path d="M22 50c8-8 20-8 28 0 8-8 20-8 28 0-3 12-15 16-28 9-13 7-25 3-28-9z" fill="#12100c"/><circle cx="40" cy="52" r="5.5" fill="#fff"/><circle cx="60" cy="52" r="5.5" fill="#fff"/><circle cx="40" cy="53" r="2.6" fill="#12100c"/><circle cx="60" cy="53" r="2.6" fill="#12100c"/><path d="M45 65l5 6 5-6z" fill="#12100c"/>',
  egg:'<ellipse cx="50" cy="55" rx="25" ry="32" fill="currentColor"/><path d="M35 41l7 7-6 7 7 6" fill="none" stroke="#12100c" stroke-width="3" stroke-linejoin="round"/><circle cx="43" cy="51" r="3" fill="#12100c"/><circle cx="59" cy="51" r="3" fill="#12100c"/><path d="M43 68c4-5 12-5 15 0" fill="none" stroke="#12100c" stroke-width="3" stroke-linecap="round"/>',
  car:'<path d="M16 60l7-17c1-3 4-5 7-5h40c3 0 6 2 7 5l7 17v9a3 3 0 0 1-3 3h-5a8 8 0 0 1-16 0H41a8 8 0 0 1-16 0h-6a3 3 0 0 1-3-3z" fill="currentColor"/><path d="M31 44h38l4 12H27z" fill="#12100c" opacity=".3"/><circle cx="33" cy="70" r="7" fill="#12100c"/><circle cx="67" cy="70" r="7" fill="#12100c"/><line x1="18" y1="22" x2="82" y2="78" stroke="#12100c" stroke-width="7" opacity=".5"/>'
};
/* Community-voted joke awards (reset each season). */
const DEFAULT_POLLS = [
  { key:'salesman', label:'Top Salesman',   color:'#f5c451', glyph:'megaphone', desc:'All talk — sells a big game but can\'t clutch when it counts' },
  { key:'raccoon',  label:'Lucky SOB',        color:'#b8c0c8', glyph:'raccoon',   desc:'Somehow always nabs the kill — the luckiest last shots, right out from under the squad' },
  { key:'humpty',   label:'Humpty Dumpty',  color:'#edd7a1', glyph:'egg',       desc:'Always the first one to hit the dirt' },
  { key:'license',  label:'Revoked License',color:'#e5484d', glyph:'car',       desc:'Should not be allowed behind the wheel of anything' }
];
/* Admins can customize polls; falls back to the built-ins until they do. */
function getPolls(){ return Array.isArray(state.pollDefs) ? state.pollDefs : DEFAULT_POLLS; }
function pollDef(key){ return getPolls().find(p=>p.key===key); }
/* Glyphs offered in the poll editor (all available medal art). */
const POLL_GLYPH_OPTS = ['megaphone','raccoon','egg','car','skull','crown','target','up','flag','people','case','medal','refresh','diamond','backpack','bomb','rat','smiley','ghost','person','coin','rocket','moon','puppy','crab','mower','siren','fire'];
function medalSvg(color, glyph){ return `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="47" fill="${color}" opacity=".92"/><circle cx="50" cy="50" r="47" fill="none" stroke="#f5e6b0" stroke-width="3" opacity=".55"/><circle cx="50" cy="50" r="37" fill="#100e0a"/><g style="color:${color}">${AWARD_GLYPHS[glyph]||''}</g></svg>`; }
function playerById(id){ return (state.players||[]).find(p=>p.id===id); }
function getDeviceId(){ let d=lsGet('dmz_deviceid'); if(!d){ d=uid(); lsSet('dmz_deviceid', d); } return d; }
function myVote(pollKey){ const v=state.polls&&state.polls[pollKey]; return (v&&v[getDeviceId()])||''; }
function pollTally(pollKey){
  const votes=(state.polls&&state.polls[pollKey])||{}; const c={};
  Object.values(votes).forEach(pid=>{ if(pid) c[pid]=(c[pid]||0)+1; });
  return Object.keys(c).filter(id=> (state.players||[]).some(p=>p.id===id))
    .map(id=>({ id, votes:c[id], name:(playerById(id)||{}).name||'?' }))
    .sort((a,b)=> b.votes-a.votes || a.name.localeCompare(b.name));
}
async function castVote(pollKey, targetId){
  const dev=getDeviceId();
  await persist(merged=>{
    merged.polls = merged.polls || {};
    merged.polls[pollKey] = merged.polls[pollKey] || {};
    if(targetId) merged.polls[pollKey][dev]=targetId; else delete merged.polls[pollKey][dev];
    return merged;
  });
}
/* Bespoke badge art (transparent webp, base64). Keyed by award key; polls keyed by glyph. */
const AWARD_IMG = {
  'champ':'/assets/legacy/leaderboard-055-47bb5a31b6e9.webp',
  'perfect':'/assets/legacy/leaderboard-056-dd079b2f4e14.webp',
  'opk':'/assets/legacy/leaderboard-057-1443ccb586de.webp',
  'kpr':'/assets/legacy/leaderboard-058-82769d696e32.webp',
  'exf':'/assets/legacy/leaderboard-059-d9dec7cc353c.webp',
  'exfr':'/assets/legacy/leaderboard-060-fdbef38dde0d.webp',
  'sqk':'/assets/legacy/leaderboard-061-f8aa2b3b8788.webp',
  'wc':'/assets/legacy/leaderboard-062-de7e2e4acc31.webp',
  'fin':'/assets/legacy/leaderboard-063-afb80e7e6171.webp',
  'big':'/assets/legacy/leaderboard-064-eeda8af04237.webp',
  'boss':'/assets/legacy/leaderboard-065-9a8f8307a2e2.webp',
  'grind':'/assets/legacy/leaderboard-066-d43ea06b6836.webp',
  'carried':'/assets/legacy/leaderboard-067-f8c04ca74fe6.webp',
  'glass':'/assets/legacy/leaderboard-068-9d802608d2ae.webp',
  'rat':'/assets/legacy/leaderboard-069-9824d4f462ec.webp',
  'vibes':'/assets/legacy/leaderboard-070-59faab1f783d.webp',
  'ghost':'/assets/legacy/leaderboard-071-c97bdb687711.webp',
  'solo':'/assets/legacy/leaderboard-072-001569ce65f4.webp',
  'clingy':'/assets/legacy/leaderboard-073-da69dc570724.webp',
  'liar':'/assets/legacy/leaderboard-074-deda28250d52.webp',
  'siren':'/assets/legacy/leaderboard-075-e4afe0958498.webp',
  'spender':'/assets/legacy/leaderboard-076-9bad3f2d95c3.webp',
  'comeback':'/assets/legacy/leaderboard-077-c7acafe3e78a.webp',
  'owl':'/assets/legacy/leaderboard-078-c904c33e1351.webp'
};
const GLYPH_IMG = {
  'megaphone':'/assets/legacy/leaderboard-079-1b71818cf837.webp',
  'raccoon':'/assets/legacy/leaderboard-080-6b2f8ba99289.webp',
  'egg':'/assets/legacy/leaderboard-081-b7178d06cda9.webp',
  'car':'/assets/legacy/leaderboard-082-cbfdb418f8b5.webp'
};
function badgeUri(key, glyph){ if(key && AWARD_IMG[key]) return AWARD_IMG[key]; if(glyph && GLYPH_IMG[glyph]) return GLYPH_IMG[glyph]; return null; }
const AWARDS = [
  { key:'champ',   label:'Season Champion',    color:'#f5c451', glyph:'crown',   special:'champ' },
  { key:'perfect', label:'Perfectionist',      color:'#8fd6ff', glyph:'diamond', special:'perfect' },
  { key:'opk',     label:'One-Man Army',color:'#ec6a5c', glyph:'skull',   stat:'opK' },
  { key:'kpr',     label:'James Bond',color:'#f2a63c',glyph:'target',  stat:'kpr',        min:10, fmt:v=>_f1(v) },
  { key:'exf',     label:'Wheels Up',        color:'#8fe05a', glyph:'up',      stat:'exfils' },
  { key:'exfr',    label:'Clean Getaway',       color:'#5ad1c4', glyph:'flag',    stat:'exfr',       min:10, fmt:v=>Math.round(v)+'%' },
  { key:'sqk',     label:'Squad Goals',   color:'#67b4ee', glyph:'people',  stat:'sqK' },
  { key:'wc',      label:'Case Closed',  color:'#8fe05a', glyph:'case',    stat:'weaponCases' },
  { key:'fin',     label:'The Closer',  color:'#c79bff', glyph:'flag',    stat:'finalExfils' },
  { key:'big',     label:'Biggest Single Raid',color:'#f5c451', glyph:'medal',   stat:'bigRaid' },
  { key:'grind',   label:'Touch Grass',        color:'#8fe05a', glyph:'mower',   stat:'n', fun:true },
  { key:'boss',    label:'Most Boss Kills',    color:'#c79bff', glyph:'skull',   stat:'bossK', s2:true },
  // ---- fun / joke badges ----
  { key:'carried', label:'Free Ride',          color:'#c39a63', glyph:'backpack', fun:true, min:10, score:s=> s.sqK - s.opK,               disp:s=> '+'+(s.sqK-s.opK) },
  { key:'glass',   label:'No Return Policy',       color:'#ef7a4a', glyph:'bomb',     fun:true, min:10, score:s=> s.kpr*(1-s.exfr/100),         disp:s=> _f1(s.kpr)+' k/r' },
  { key:'rat',     label:'Sneaky Bastard',      color:'#b8c0c8', glyph:'rat',      fun:true, min:10, score:s=> (s.exfils>0? s.exfr/(s.kpr+0.5):0), disp:s=> Math.round(s.exfr)+'% out' },
  { key:'vibes',   label:'The Tourist', color:'#5ad1c4', glyph:'smiley',   fun:true, min:10, score:s=> s.n? s.zeroK/s.n*100:0,       disp:s=> Math.round(s.zeroK/s.n*100)+'% whiffs' },
  { key:'ghost',   label:'Here in Spirit',            color:'#9aa7b3', glyph:'ghost',    fun:true, min:10, score:s=> s.n? (s.n-s.exfils)/s.n*100:0, disp:s=> Math.round((s.n-s.exfils)/s.n*100)+'% died' },
  { key:'solo',    label:'Outcast',        color:'#e08a4a', glyph:'crab',     fun:true, min:10, needsSquadData:true, score:s=> s.n? ((s.n-s.squadRaids)/s.n*100)*1000 + s.n : 0, disp:s=> Math.round((s.n-s.squadRaids)/s.n*100)+'% solo' },
  { key:'clingy',  label:'Separation Anxiety', color:'#67b4ee', glyph:'puppy',    fun:true, min:10, needsSquadData:true, score:s=> s.n? (s.squadRaids/s.n*100)*1000 + s.squadRaids : 0, disp:s=> Math.round(s.squadRaids/s.n*100)+'% w/ squad' },
  { key:'liar',    label:'Liar, Liar',         color:'#f2663c', glyph:'fire',     fun:true, min:1,  score:s=> s.unverifBig, disp:s=> s.unverifBig+' unbacked' },
  { key:'siren',   label:'Sus AF',          color:'#e5484d', glyph:'siren',    fun:true, min:1,  score:s=> s.reports,    disp:s=> s.reports+' report'+(s.reports===1?'':'s') },
  { key:'spender', label:'Big Spender',        color:'#f5c451', glyph:'coin',     fun:true, min:8,  score:s=> s.feesPaid,   disp:s=> s.feesPaid.toLocaleString()+' SR' },
  { key:'comeback',label:'Comeback Kid',       color:'#8fe05a', glyph:'rocket',   fun:true, min:5,  score:s=> s.bestGain,   disp:s=> '+'+s.bestGain+' SR' },
  { key:'owl',     label:'Like a Virgin',          color:'#9b8cff', glyph:'moon',     fun:true, min:5,  score:s=> s.nightRaids, disp:s=> s.nightRaids+' late-night' }
];
function awardDef(key){ return AWARDS.find(a=>a.key===key); }
/* Plain-English "how you earn it" for the Awards guide (Rules tab). */
const AWARD_HOW = {
  champ:'Finish #1 on the leaderboard (most SR) when the season ends.',
  perfect:'Max out all ten achievement tracks — a Diamond medal in every one.',
  opk:'Rack up the most operator kills this season.',
  kpr:'Highest operator kills per raid (min 10 raids logged).',
  exf:'Most successful exfils this season.',
  exfr:'Highest exfil % — you get out alive most often (min 10 raids).',
  sqk:'Most squadmate kills this season.',
  wc:'Extract the most weapon cases.',
  fin:'Bank the most final exfils.',
  big:'Biggest single-raid SR haul all season.',
  boss:'Most boss kills (Season 2).',
  grind:'Log the most raids. Go outside.',
  carried:'Got carried the hardest — more squad kills than your own kills.',
  glass:'Loads of kills per raid, but the worst exfil rate.',
  rat:'Exfil the most while killing the least (min 10 raids).',
  vibes:'Most raids that ended with zero kills. Just here to chill.',
  ghost:'Died (no exfil) in the highest share of your raids.',
  solo:'Highest share of solo runs — you fly alone.',
  clingy:'Highest share of raids run with a squad — never alone.',
  liar:'Most big raids logged with no proof attached. Pics or it didn\'t happen.',
  siren:'The most community reports pointed your way.',
  spender:'Paid the most SR in deployment fees this season.',
  comeback:'Biggest single-raid net SR gain — the comeback of the season.',
  owl:'Most raids logged between midnight and 5am.'
};
function awardGuideItem(key, label, glyph, color, how){
  const img=badgeUri(key, glyph);
  const medal = img ? `<img src="${img}" alt="">` : medalSvg(color, glyph);
  return `<div class="ag-item"><span class="ag-medal" style="--tc:${color}">${medal}</span><div class="ag-text"><div class="ag-name">${esc(label)}</div><div class="ag-how">${esc(how)}</div></div></div>`;
}
/* Community → Awards: live standings — who's leading every trophy right now. */
function raceItem(key,label,glyph,color,winnerId,valStr){
  const uri=badgeUri(key,glyph); const medal=uri?`<img src="${uri}" alt="">`:medalSvg(color,glyph);
  const lead = winnerId
    ? `<span class="race-lead lb-clickable" data-profile="${esc(winnerId)}" title="View profile">${esc((playerById(winnerId)||{}).name||'?')}</span>${valStr?` <span class="race-val" style="color:${color}">${esc(valStr)}</span>`:''}`
    : `<span class="race-open">up for grabs</span>`;
  return `<div class="ag-item"><span class="ag-medal" style="--tc:${color}">${medal}</span><div class="ag-text"><div class="ag-name">${esc(label)}</div><div class="race-line">${lead}</div></div></div>`;
}
function renderRace(){
  const intro=el('raceIntro'), box=el('raceBody'); if(!box) return;
  const st=computeStandings().filter(p=>p.raids.length>0);
  const statArr=Object.values(seasonStatsById(st));
  if(intro) intro.innerHTML=`<p class="ldr-lead">The live race for every trophy — who takes each one if the season ended <b>right now</b>. Nothing's locked in until the season is archived, so keep grinding (or keep voting).</p>`;
  const statKeys=['champ','perfect','opk','kpr','exf','exfr','sqk','wc','fin','big'].concat(s2on()?['boss']:[]);
  const funKeys=['grind','carried','glass','rat','vibes','ghost','solo','clingy','liar','siren','spender','comeback','owl'];
  const one=k=>{ const a=awardDef(k); if(!a) return ''; const w=pickWinners(a,statArr)[0];
    return raceItem(k,a.label,a.glyph,a.color, w?w.id:null, (w&&w.value)?fmtAwardVal(a,w.value):''); };
  const polls=getPolls().map(p=>{ const t=pollTally(p.key)[0]; const has=t&&t.votes>0;
    return raceItem(p.key,p.label,p.glyph,p.color, has?t.id:null, has?(t.votes+' vote'+(t.votes===1?'':'s')):''); }).join('');
  box.innerHTML=`<div class="ag-sec">Season awards</div><div class="ag-grid">${statKeys.map(one).join('')}</div>
    <div class="ag-sec">For better or worse</div><div class="ag-grid">${funKeys.map(one).join('')}</div>
    <div class="ag-sec">Community-voted <span class="ag-note">vote under Polls</span></div><div class="ag-grid">${polls}</div>`;
}
function renderAwards(){
  const box=el('awardsBody'); if(!box) return;
  const statKeys=['champ','perfect','opk','kpr','exf','exfr','sqk','wc','fin','big'].concat(s2on()?['boss']:[]);
  const funKeys=['grind','carried','glass','rat','vibes','ghost','solo','clingy','liar','siren','spender','comeback','owl'];
  const item=k=>{ const a=awardDef(k); return a?awardGuideItem(k,a.label,a.glyph,a.color,AWARD_HOW[k]||''):''; };
  const polls=getPolls().map(p=>awardGuideItem(p.key,p.label,p.glyph,p.color,(p.desc||'')+' — decided by community vote.')).join('');
  box.innerHTML =
    `<div class="ag-sec">Season awards <span class="ag-note">calculated automatically</span></div><div class="ag-grid">${statKeys.map(item).join('')}</div>
     <div class="ag-sec">For better or worse <span class="ag-note">calculated automatically</span></div><div class="ag-grid">${funKeys.map(item).join('')}</div>
     <div class="ag-sec">Community-voted <span class="ag-note">vote under Community &rarr; Polls</span></div><div class="ag-grid">${polls}</div>
     <p class="note" style="margin-top:14px">Separately, the ten star&rarr;Diamond <b>achievements</b> on your profile track your progress <i>within</i> a season and reset each time — hit the thresholds to light them up.</p>`;
}
/* Per-player season stats from a set of standings (played raids only). */
function seasonStatsById(st){
  const m={}; const allEarned=[];
  st.forEach(p=> p.raids.forEach(r=>{ if(r.carryover==null) allEarned.push(r.earned||0); }));
  const notableBar = Math.max(250, median(allEarned)*2);
  st.forEach(p=>{
    const real=p.raids.filter(r=>r.carryover==null); const n=real.length;
    const raw=state.players.find(x=>x.id===p.id);
    const o={ id:p.id, name:p.name, sr:p.sr, tier:p.tier, n,
      squadRaids:real.filter(r=>r.ranSquad).length,
      unverifBig:real.filter(r=>(r.earned||0)>=notableBar && !r.verified).length,
      reports:(raw&&raw.reports)||0,
      opK:real.reduce((a,r)=>a+(r.operatorKills||0),0),
      sqK:real.reduce((a,r)=>a+(r.squadKills||0),0),
      exfils:real.filter(r=>r.extracted).length,
      finalExfils:real.filter(r=>r.finalExfil).length,
      weaponCases:real.filter(r=>r.weaponCase&&r.extracted).length,
      contracts:real.filter(r=>r.contract==='regular'||r.contract==='hunt').length,
      bossK:real.reduce((a,r)=>a+Math.min(r.bossKills||0,2),0),
      zeroK:real.filter(r=>(r.operatorKills||0)===0).length,
      feesPaid:real.reduce((a,r)=>a+(r.fee||0),0),
      bestGain:real.reduce((mx,r)=>Math.max(mx,r.delta||0),0),
      nightRaids:real.filter(r=>{ const h=new Date(r.ts||0).getHours(); return h>=0 && h<5; }).length,
      bigRaid:real.reduce((mx,r)=>Math.max(mx,r.earned||0),0) };
    o.kpr = n? o.opK/n : 0; o.exfr = n? o.exfils/n*100 : 0;
    m[p.id]=o;
  });
  return m;
}
function pickWinners(a, arr){
  if(a.special==='perfect'){ const total=ACHV.filter(x=>!x.s2||s2on()).length;
    return arr.filter(s=> achScore(s).diamonds>=total).map(s=>({id:s.id,value:0})); }
  if(a.special==='champ'){ const w=arr.slice().sort((x,y)=>y.sr-x.sr || x.name.localeCompare(y.name))[0]; return (w&&w.sr>0)?[{id:w.id,value:w.sr}]:[]; }
  if(a.score){ const min=a.min||0;
    if(a.needsSquadData && !arr.some(s=> s.squadRaids>0)) return [];   // solo/squad badges need real squad-tag data first
    const pool=arr.filter(s=> s.n>=min).map(s=>({s, v:a.score(s)})).filter(x=> x.v>0);
    if(!pool.length) return [];
    pool.sort((x,y)=> y.v-x.v || x.s.name.localeCompare(y.s.name));
    return [{ id:pool[0].s.id, value:(a.disp? a.disp(pool[0].s) : Math.round(pool[0].v)) }]; }
  const min=a.min||0, pool=arr.filter(s=> s.n>=min && (s[a.stat]||0)>0);
  if(!pool.length) return [];
  pool.sort((x,y)=> (y[a.stat]||0)-(x[a.stat]||0) || x.name.localeCompare(y.name));
  return [{id:pool[0].id, value:pool[0][a.stat]}];
}
function fmtAwardVal(a, v){ if(typeof v==='string') return v; return a.fmt ? a.fmt(v) : (typeof v==='number'? Math.round(v).toLocaleString() : v); }
/* Awards the CURRENT (unfinished) season would hand out right now — for the "on track" preview. */
function currentAwardWinners(){
  const st=computeStandings().filter(p=>p.raids.length>0);
  const arr=Object.values(seasonStatsById(st)); const out=[];
  AWARDS.filter(a=>!a.s2||s2on()).forEach(a=> pickWinners(a,arr).forEach(w=> out.push({ key:a.key, label:a.label, color:a.color, glyph:a.glyph, id:w.id, value:fmtAwardVal(a,w.value) })));
  getPolls().forEach(p=>{ const t=pollTally(p.key)[0]; if(t&&t.votes>0) out.push({ key:'poll_'+p.key, label:p.label, color:p.color, glyph:p.glyph, id:t.id, value:t.votes+' vote'+(t.votes===1?'':'s') }); });
  return out;
}
/* Render one medal. rec: {key,label?,color?,glyph?,num,season,value,id}. */
function awardMedal(rec, opts){
  opts=opts||{}; const def=awardDef(rec.key)||{};
  const color=rec.color||def.color||'#f5c451', glyphName=rec.glyph||def.glyph, glyph=AWARD_GLYPHS[glyphName]||'';
  const label=rec.label||def.label||'Award';
  const num=rec.num?('S'+rec.num):''; const val=(rec.value!==undefined&&rec.value!==''&&rec.value!==0)?rec.value:'';
  const pin = opts.canEdit ? `<button class="tf-pin${opts.featured?' on':''}" data-feat="${esc(rec.id)}">${opts.featured?'★ Featured':'☆ Feature'}</button>` : '';
  const img = badgeUri(rec.key, glyphName);
  const medalInner = img
    ? `<img class="tm-img${opts.proj?' proj':''}" src="${img}" alt="">`
    : `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="47" fill="var(--tc)" opacity="${opts.proj?'.28':'.9'}"/><circle cx="50" cy="50" r="47" fill="none" stroke="#f5e6b0" stroke-width="2" opacity=".6"/><circle cx="50" cy="50" r="37" fill="#100e0a"/><g style="color:var(--tc)">${glyph}</g></svg>`;
  return `<div class="trophy${opts.feat?' tf-mini':''}${opts.proj?' tf-proj':''}" style="--tc:${color}">
    <div class="trophy-medal">${medalInner}</div>
    <div class="trophy-cap"><span class="trophy-name">${esc(label)}</span>${val?`<span class="trophy-val">${esc(String(val))}</span>`:''}${(rec.season&&!opts.feat&&!opts.proj)?`<span class="trophy-season">${esc(rec.season)}</span>`:''}${opts.proj?'<span class="trophy-proj-tag">on track</span>':''}</div>
    ${pin}
  </div>`;
}
function canEditProfile(p){ return settingsUnlocked || ((lsGet('dmz_myname')||'').trim().toLowerCase() === (p.name||'').toLowerCase()); }
/* The up-to-3 medals shown on the Overview header (explicit picks, else best 3 auto). */
function featuredMedals(pl){
  const awards=(pl.awards||[]); if(!awards.length) return '';
  const order={champ:0,perfect:1}; const pres=a=> (order[a.key]!==undefined?order[a.key]:5);
  let ids = Array.isArray(pl.featured) ? pl.featured.filter(id=> awards.some(a=>a.id===id)) : [];
  if(!ids.length){ ids = awards.slice().sort((a,b)=> pres(a)-pres(b) || (b.num||0)-(a.num||0)).slice(0,3).map(a=>a.id); }
  const show = ids.slice(0,3).map(id=> awards.find(a=>a.id===id)).filter(Boolean);
  if(!show.length) return '';
  return `<div class="pf-featured">${show.map(a=>awardMedal(a,{feat:true})).join('')}</div>`;
}
/* Full Trophy Case tab for a player. */
function buildTrophies(pl){
  const awards=(pl.awards||[]).slice().sort((a,b)=> (b.num||0)-(a.num||0) || (b.ts||0)-(a.ts||0));
  const canEdit=canEditProfile(pl);
  const featSet=new Set(Array.isArray(pl.featured)?pl.featured:[]);
  const proj=currentAwardWinners().filter(w=>w.id===pl.id);
  let out='';
  if(canEdit) out += `<div class="tf-hint">${awards.length?'Tap ☆ Feature on up to 3 medals to show them on your profile.':'Win a season award and it lands here — permanently.'}</div>`;
  if(proj.length){
    out += `<div class="pf-sec">On track this season</div><div class="trophy-grid">`+
      proj.map(w=> awardMedal({key:w.key,label:w.label,color:w.color,glyph:w.glyph,value:w.value},{proj:true})).join('')+`</div>`;
  }
  if(awards.length){
    out += `<div class="pf-sec">Trophy case <span class="rl-count">${awards.length}</span></div><div class="trophy-grid">`+
      awards.map(a=>awardMedal(a,{canEdit:canEdit, featured:featSet.has(a.id)})).join('')+`</div>`;
  } else if(!proj.length){
    out += `<div class="pf-empty" style="padding:20px 4px">No trophies yet. Season awards are handed out when a season ends — climb a category to earn one.</div>`;
  }
  return out;
}
async function toggleFeatured(awardId){
  const owner=(state.players||[]).find(pl=> (pl.awards||[]).some(a=>a.id===awardId));
  if(!owner) return;
  if(!canEditProfile(owner)){ alert('Only '+owner.name+' (logged in on their own device) or an admin can change featured trophies.'); return; }
  const feat=Array.isArray(owner.featured)?owner.featured:[];
  if(!feat.includes(awardId) && feat.filter(id=>(owner.awards||[]).some(a=>a.id===id)).length>=3){ alert('You can feature up to 3 trophies at once — un-feature one first.'); return; }
  await persist(merged=>{
    const pl=(merged.players||[]).find(x=>x.id===owner.id); if(!pl) return merged;
    let f=Array.isArray(pl.featured)?pl.featured.slice():[];
    f = f.includes(awardId) ? f.filter(x=>x!==awardId) : f.concat([awardId]).slice(0,3);
    pl.featured=f; return merged;
  });
  openProfile(owner.id);
  const tb=document.querySelector('.pftabs [data-pftab="trophies"]'); if(tb) tb.click();
}
/* Community → Polls: vote for who deserves each community award this season. */
function renderPolls(){
  const intro=el('pollsIntro'), body=el('pollsBody'); if(!body) return;
  const names=[...(state.players||[])].sort((a,b)=>a.name.localeCompare(b.name));
  if(intro) intro.innerHTML=`<p class="ldr-lead">Community-voted honors — for the things the numbers can't measure. Cast <b>one vote per poll</b> for whoever fits best; you can change it anytime. Whoever has the most votes when the season ends takes the trophy, and it all resets for the next one.</p>`;
  if(names.length<2){ body.innerHTML='<div class="card"><div class="empty">Polls open up once there are a couple of operators to vote for.</div></div>'; return; }
  body.innerHTML = '<div class="poll-grid">'+getPolls().map(p=>{
    const tally=pollTally(p.key), mine=myVote(p.key), max=Math.max(1, ...tally.map(t=>t.votes));
    const standings = tally.length
      ? tally.slice(0,5).map((t,i)=>`<div class="poll-row${t.id===mine?' mine':''}">
          <span class="poll-rk">${i+1}</span>
          <span class="poll-nm lb-clickable" data-profile="${esc(t.id)}">${esc(t.name)}${t.id===mine?' <span class="poll-you">your pick</span>':''}</span>
          <div class="poll-bar"><div class="poll-fill" style="width:${Math.round(t.votes/max*100)}%"></div></div>
          <span class="poll-votes">${t.votes}</span></div>`).join('')
      : '<div class="poll-empty">No votes yet — be the first to nominate someone.</div>';
    const opts='<option value="">'+(mine?'— remove my vote —':'— pick an operator —')+'</option>'+
      names.map(n=>`<option value="${esc(n.id)}"${n.id===mine?' selected':''}>${esc(n.name)}</option>`).join('');
    return `<div class="card poll-card" style="--tc:${p.color}">
      <div class="poll-head"><span class="poll-medal">${pollMedalMarkup(p.color,p.glyph)}</span>
        <div class="poll-headtext"><div class="poll-title">${esc(p.label)}</div><div class="poll-desc">${esc(p.desc)}</div></div></div>
      <div class="poll-standings">${standings}</div>
      <div class="poll-vote"><label>Your vote</label><select data-pollvote="${esc(p.key)}">${opts}</select></div>
    </div>`;
  }).join('')+'</div>';
}
function initPolls(){
  document.addEventListener('change', e=>{
    const sel=e.target.closest && e.target.closest('[data-pollvote]');
    if(!sel) return;
    castVote(sel.getAttribute('data-pollvote'), sel.value);
  });
}

/* ---------- Admin: poll editor (Settings) ---------- */
let _pollRows = null;   // in-memory editor model
function seedPollRows(){ _pollRows = getPolls().map(p=>({ key:p.key, label:p.label, desc:p.desc, color:p.color, glyph:p.glyph })); }
function pollRowHtml(p, i){
  return `<div class="pa-row">
    <span class="pa-medal" id="pa-medal-${i}">${pollMedalMarkup(p.color||'#f5c451', p.glyph||'medal')}</span>
    <div class="pa-fields">
      <input class="pa-in" data-pi="${i}" data-pf="label" value="${esc(p.label||'')}" placeholder="Poll name" maxlength="28">
      <input class="pa-in" data-pi="${i}" data-pf="desc" value="${esc(p.desc||'')}" placeholder="Short description shown under the name" maxlength="90">
      <div class="pa-controls">
        <label>Medal <select class="pa-sel" data-pi="${i}" data-pf="glyph">${POLL_GLYPH_OPTS.map(g=>`<option value="${g}"${g===p.glyph?' selected':''}>${g}</option>`).join('')}</select></label>
        <label>Color <input type="color" data-pi="${i}" data-pf="color" value="${esc(p.color||'#f5c451')}"></label>
        <button type="button" class="del-x" data-polldel="${i}">Remove</button>
      </div>
    </div>
  </div>`;
}
function renderPollAdmin(force){
  const box=el('pollAdminBody'); if(!box) return;
  if(_pollRows===null) seedPollRows();
  if(!force && box.dataset.built==='1') return;   // don't clobber in-progress edits on background refresh
  box.dataset.built='1';
  box.innerHTML = _pollRows.length ? _pollRows.map(pollRowHtml).join('') : '<div class="note" style="margin:0">No polls — the Polls tab will be empty. Add one below.</div>';
}
function savePolls(){
  const rows=(_pollRows||[]).map(r=>({
    key: r.key || ('p'+uid()),
    label: (r.label||'').trim().slice(0,28) || 'Poll',
    desc: (r.desc||'').trim().slice(0,90),
    color: /^#[0-9a-fA-F]{6}$/.test(r.color||'') ? r.color : '#f5c451',
    glyph: POLL_GLYPH_OPTS.includes(r.glyph) ? r.glyph : 'medal'
  }));
  const seen={}; rows.forEach(r=>{ while(seen[r.key]) r.key=r.key+'x'; seen[r.key]=1; });
  persist(merged=>{ merged.pollDefs = rows; return merged; }).then(ok=>{ if(ok){ _pollRows=rows.map(r=>Object.assign({},r)); renderPollAdmin(true); showMsg('pollAdminMsg','ok','Polls saved — live for everyone.'); } });
}
function resetPolls(){
  if(!confirm('Restore the original four polls? Your custom polls (and their current votes) will be replaced.')) return;
  persist(merged=>{ merged.pollDefs = null; return merged; }).then(ok=>{ if(ok){ seedPollRows(); renderPollAdmin(true); showMsg('pollAdminMsg','ok','Polls reset to the defaults.'); } });
}
function initPollAdmin(){
  const add=el('addPollBtn'), save=el('savePollsBtn'), reset=el('resetPollsBtn');
  if(add) add.addEventListener('click', ()=>{ if(_pollRows===null) seedPollRows(); _pollRows.push({ key:'', label:'New Poll', desc:'', color:'#8fd6ff', glyph:'medal' }); renderPollAdmin(true); });
  if(save) save.addEventListener('click', savePolls);
  if(reset) reset.addEventListener('click', resetPolls);
  // live-edit the in-memory model + medal preview
  document.addEventListener('input', e=>{
    const t=e.target; if(!t || !t.getAttribute) return;
    const pf=t.getAttribute('data-pf'); if(pf==null) return;
    const i=+t.getAttribute('data-pi'); if(!_pollRows||!_pollRows[i]) return;
    _pollRows[i][pf]=t.value;
    if(pf==='glyph'||pf==='color'){ const m=el('pa-medal-'+i); if(m) m.innerHTML=pollMedalMarkup(_pollRows[i].color||'#f5c451', _pollRows[i].glyph||'medal'); }
  });
  document.addEventListener('click', e=>{
    const del=e.target.closest && e.target.closest('[data-polldel]'); if(!del) return;
    const i=+del.getAttribute('data-polldel'); if(_pollRows&&_pollRows[i]!=null){ _pollRows.splice(i,1); renderPollAdmin(true); }
  });
}
function closeProfile(){ el('profileModal').style.display = 'none'; }

function buildSpark(series){
  if(series.length < 2) return '<div class="spark-wrap"><div class="pf-empty">Not enough raids logged yet to chart a progression.</div></div>';
  const W=600,H=180,padL=8,padR=8,padT=14,padB=16;
  const srs=series.map(s=>s.sr); let min=Math.min(...srs),max=Math.max(...srs);
  if(min===max){ min=Math.max(0,min-50); max=max+50; }
  const n=series.length;
  const X=i=> padL + (n===1?0:i/(n-1))*(W-padL-padR);
  const Y=v=> padT + (1-(v-min)/(max-min))*(H-padT-padB);
  let bands='';
  [1000,2000,3000,4000,5000,6000].forEach(t=>{
    if(t>min && t<max){ const y=Y(t).toFixed(1);
      bands+=`<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="rgba(255,255,255,.08)" stroke-width="1"/>`
        +`<text x="${W-padR}" y="${(Y(t)-3).toFixed(1)}" text-anchor="end" font-size="10" fill="rgba(255,255,255,.32)" font-family="Rajdhani,sans-serif">${tierFor(t).name}</text>`; }
  });
  const pts=series.map((s,i)=>`${X(i).toFixed(1)},${Y(s.sr).toFixed(1)}`).join(' ');
  const area=`${padL.toFixed(1)},${(H-padB).toFixed(1)} ${pts} ${(W-padR).toFixed(1)},${(H-padB).toFixed(1)}`;
  const GOLD='#f5c451', RED='#ef5350';
  // draw the line as individual segments so any drop in SR is painted red
  let segs='';
  for(let i=1;i<n;i++){
    const down = series[i].sr < series[i-1].sr;
    segs+=`<line x1="${X(i-1).toFixed(1)}" y1="${Y(series[i-1].sr).toFixed(1)}" x2="${X(i).toFixed(1)}" y2="${Y(series[i].sr).toFixed(1)}" stroke="${down?RED:GOLD}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  const dots=series.map((s,i)=>{
    const down = i>0 && series[i].sr < series[i-1].sr;
    const col = down ? RED : (i===n-1?GOLD:'#e6a92b');
    return `<circle cx="${X(i).toFixed(1)}" cy="${Y(s.sr).toFixed(1)}" r="${i===n-1?3.5:2}" fill="${col}"/>`;
  }).join('');
  return `<div class="spark-wrap"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="SR progression">
    <defs><linearGradient id="pfg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(245,196,81,.28)"/><stop offset="1" stop-color="rgba(245,196,81,0)"/></linearGradient></defs>
    ${bands}<polygon points="${area}" fill="url(#pfg)"/>
    ${segs}${dots}
  </svg></div>`;
}
function buildMilestones(series){
  const events=[];
  for(let i=1;i<series.length;i++){
    const a=tierFor(series[i-1].sr).name, b=tierFor(series[i].sr).name;
    if(a!==b) events.push({ up: series[i].sr>series[i-1].sr, to:b, ts:series[i].ts });
  }
  if(events.length===0) return '<div class="pf-ms"><div class="row" style="color:var(--muted2)">No rank changes yet this season.</div></div>';
  const rows=events.reverse().map(e=>
    `<div class="row"><span class="${e.up?'up':'down'}">${e.up?'▲':'▼'}</span> ${e.up?'Promoted to':'Demoted to'}
      <span class="badge b-${e.to}">${e.to}</span> <span style="color:var(--muted2)">${e.ts?'· '+fmtDate(e.ts):''}</span></div>`).join('');
  return `<div class="pf-ms">${rows}</div>`;
}
function initProfile(){
  document.addEventListener('click', e=>{
    const tabBtn = e.target.closest && e.target.closest('[data-pftab]');
    if(tabBtn){
      const which = tabBtn.getAttribute('data-pftab');
      document.querySelectorAll('.pftabs [data-pftab]').forEach(b=> b.classList.toggle('active', b===tabBtn));
      document.querySelectorAll('.pftab-panel').forEach(p=> p.classList.toggle('active', p.getAttribute('data-pftabpanel')===which));
      return;
    }
    const featBtn = e.target.closest && e.target.closest('[data-feat]');
    if(featBtn){ toggleFeatured(featBtn.getAttribute('data-feat')); return; }
    const row = e.target.closest && e.target.closest('[data-profile]');
    if(row){ openProfile(row.getAttribute('data-profile')); }
  });
  el('profileClose').addEventListener('click', closeProfile);
  el('profileBackdrop').addEventListener('click', closeProfile);
  el('resultClose').addEventListener('click', closeResult);
  el('resultBackdrop').addEventListener('click', closeResult);
  { const sc=el('spClose'), sb=el('seasonPopBackdrop');
    if(sc) sc.addEventListener('click', closeSeasonPopup);
    if(sb) sb.addEventListener('click', closeSeasonPopup); }
  document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ closeProfile(); closeResult(); closeSeasonPopup(); } });
}

/* ---------- Season admin actions ---------- */
function fillSeasonInputs(){
  const s = state.season||{};
  el('seasonName').value = s.name||'';
  el('seasonStart').value = msToDateInput(s.start);
  el('seasonEnd').value = msToDateInput(s.end);
  if(el('seasonS2')) el('seasonS2').checked = !!s.s2;
  if(el('seasonNum')) el('seasonNum').value = (Number.isFinite(+s.num)&&+s.num>0) ? s.num : '';
  if(el('seasonChallenge')) el('seasonChallenge').value = s.challenge || '';
  if(el('seasonFinale')) el('seasonFinale').checked = !!s.finale;
  fillSeasonCfgInputs(); renderSeasonSchedule();
}
function fillSeasonCfgInputs(){
  const c = seasonCfg();
  if(el('seasonAuto')) el('seasonAuto').checked = c.auto!==false;
  if(el('seasonLen') && document.activeElement!==el('seasonLen')) el('seasonLen').value = c.lengthDays;
  if(el('seasonFinal') && document.activeElement!==el('seasonFinal')) el('seasonFinal').value = c.finalEnd;
}
function seasonScheduleText(){
  const cfg=seasonCfg(), s=state.season||{};
  if(!cfg.auto) return 'Automatic seasons are <b>off</b> — end seasons manually with the button below.';
  if(s.complete) return 'The series is <b>complete</b> — the final season has ended.';
  if(typeof s.start!=='number') return 'Set a <b>start date</b> above (or end a season) to begin the auto schedule.';
  const finalMs=dateToMs(cfg.finalEnd);
  let end=(typeof s.end==='number')?s.end:null;
  if(end==null){ end=s.start+(cfg.lengthDays-1)*DAY_MS; if(finalMs!=null&&end>finalMs)end=finalMs; }
  const fmt=ms=> new Date(ms).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
  const nextStart=end+DAY_MS;
  const isFinal = finalMs!=null && (end>=finalMs || nextStart>finalMs);
  const nextName = plannedSeasonName(seasonNumber()+1, s.name);
  return 'This season ends <b>'+fmt(end)+'</b>. ' + (isFinal
    ? 'That\'s the <b>final season</b> — no new one starts after it (series ends '+fmt(finalMs)+').'
    : 'Next up: <b>'+esc(nextName)+'</b>, auto-starting <b>'+fmt(nextStart)+'</b>.');
}
function renderSeasonSchedule(){ const n=el('seasonSchedNote'); if(n) n.innerHTML=seasonScheduleText(); }
function saveSeasonCfg(){
  const auto = !!(el('seasonAuto') && el('seasonAuto').checked);
  const lengthDays = Math.max(1, Math.min(90, parseInt(el('seasonLen').value)||14));
  const fv = el('seasonFinal').value;
  const finalEnd = /^\d{4}-\d{2}-\d{2}$/.test(fv) ? fv : '2026-10-23';
  persist(m=>{ m.seasonCfg={ auto, lengthDays, finalEnd }; return m; })
    .then(ok=>{ if(ok){ showMsg('seasonMsg','ok','Schedule saved.'); renderSeasonSchedule(); maybeRolloverSeason(); } });
}
async function saveSeason(){
  const name = el('seasonName').value.trim() || 'Season 1';
  const start = dateToMs(el('seasonStart').value);
  const end = dateToMs(el('seasonEnd').value);
  if(start && end && end < start){ showMsg('seasonMsg','err','End date is before the start date.'); return; }
  const s2 = !!(el('seasonS2') && el('seasonS2').checked);
  const challenge = (el('seasonChallenge') && el('seasonChallenge').value) || '';
  const finale = !!(el('seasonFinale') && el('seasonFinale').checked);
  const numRaw = el('seasonNum') ? parseInt(el('seasonNum').value,10) : NaN;
  const num = (Number.isFinite(numRaw) && numRaw>0) ? numRaw : undefined;
  const season = { name, start, end, s2, challenge, finale, num, updatedAt: Date.now() };
  const ok = await persist(merged=>{
    merged.season = season;
    // Keep carryover (imported starting SR) anchored at the season start so a start date never orphans it.
    const base = (typeof start==='number') ? start : 1;
    let k = 0;
    merged.raids.forEach(r=>{ if(r.carryover != null){ r.ts = base + (k++); } });
    return merged;
  }, null, 'seasonMsg');
  if(ok) showMsg('seasonMsg','ok','Season saved.');
}
/* Pre-planned season names — the whole run to MW4 is on rails.
   Each name below also has baked-in hero art in SEASON_THEMES. Season 1 is the
   plain intro season; 2–6 are themed and auto-assigned as the schedule rolls. */
const SEASON_NAMES = {
  1:'Season 1',
  2:'Weapon Case Warfare',
  3:'Hunt Club',
  4:'Confirmed Kills',
  5:'Apex Predator',
  6:'The Finals',
};
function plannedSeasonName(num, curName){
  return SEASON_NAMES[num] || nextSeasonName(curName||'Season '+((num||2)-1));
}
function nextSeasonName(cur){
  const m = String(cur||'').match(/(\d+)\s*$/);
  if(m) return cur.slice(0, m.index) + (parseInt(m[1],10)+1);
  return (cur||'Season') + ' 2';
}
/* End-of-day (inclusive) ms for a season-end date (stored as start-of-day ms). */
function endOfDay(ms){ return ms + (DAY_MS-1); }
/* The next season object after `cur`, or null if the series is complete (past finalEnd). */
function computeNextSeason(cur, cfg, startMs){
  const auto = !!(cfg && cfg.auto);
  const finalMs = auto ? dateToMs(cfg.finalEnd) : null;
  if(auto && finalMs!=null && startMs > finalMs) return null;   // past the final day → no new season
  let endMs = null;
  if(auto){ endMs = startMs + (cfg.lengthDays-1)*DAY_MS; if(finalMs!=null && endMs>finalMs) endMs = finalMs; }
  const curNum = (Number.isFinite(+cur.num)&&+cur.num>0)
    ? +cur.num
    : (((state.pastSeasons&&state.pastSeasons.length)||0)+1);   // fall back to (archived seasons)+1
  const nextNum = curNum + 1;
  return { name:plannedSeasonName(nextNum, cur.name), start:startMs, end:endMs, s2:!!cur.s2, challenge:'',
    finale:!!(auto && finalMs!=null && endMs!=null && endMs>=finalMs), num:nextNum, updatedAt:startMs };
}
/* Core archive used by both the manual button and the auto-roller.
   auto=true makes the archive deterministic (same id across clients) so simultaneous
   auto-rolls can't create duplicates. Returns true if it archived. */
async function doArchive(opts){
  opts=opts||{};
  await pull();    // freshest board so recorded champions/awards are current
  const cur = state.season||{};
  const st = computeStandings();
  if(st.length===0){ if(!opts.auto) showMsg('seasonMsg','warn','No standings to archive yet — log some raids first.'); return false; }
  const cfg = seasonCfg();
  const now = Date.now();
  const finishedEnd = (typeof cur.end==='number') ? cur.end : now;
  const startMs = opts.auto ? (finishedEnd + DAY_MS) : now;   // next season begins the day after this one ends
  const next = computeNextSeason(cur, cfg, startMs);          // null → series complete
  const sk = opts.auto ? ('auto_'+seasonKeyOf(cur)) : uid();  // deterministic id for auto (dedupe races)
  const finishedNum = seasonNumber();
  const champions = st.slice(0,3).map((p,i)=>({ rank:i+1, name:p.name, sr:p.sr, tier:p.tier }));
  const champ = Object.values(seasonChampPoints(st, cur.challenge, champMultOf(cur))).filter(e=> e.total>0).sort((a,b)=> b.total-a.total);
  const past = { id:sk, name:cur.name||'Season', num:finishedNum, start:(typeof cur.start==='number'?cur.start:null),
    end:(typeof cur.end==='number'?cur.end:now), endedAt:now, champions, challengeStat:cur.challenge||'', champMult:champMultOf(cur), champ };
  const statArr = Object.values(seasonStatsById(st));
  const grants = [];
  AWARDS.filter(a=> !a.s2 || s2on()).forEach(a=>{ pickWinners(a, statArr).forEach(w=>{
    grants.push({ playerId:w.id, rec:{ id:uid(), sk, key:a.key, label:a.label, color:a.color, glyph:a.glyph, season:(cur.name||'Season'), num:finishedNum, value:fmtAwardVal(a,w.value), ts:now } }); }); });
  getPolls().forEach(p=>{ const t=pollTally(p.key)[0]; if(t && t.votes>0){
    grants.push({ playerId:t.id, rec:{ id:uid(), sk, key:'poll_'+p.key, label:p.label, color:p.color, glyph:p.glyph, season:(cur.name||'Season'), num:finishedNum, value:t.votes+' vote'+(t.votes===1?'':'s'), ts:now } }); } });
  past.awards = grants.map(g=>({ key:g.rec.key, playerId:g.playerId }));
  const ok = await persist(merged=>{
    if((merged.pastSeasons||[]).some(s=>s.id===sk)) return merged;   // already archived (auto-roll dedupe)
    merged.pastSeasons = (merged.pastSeasons||[]).concat([past]);
    grants.forEach(g=>{ const pl=(merged.players||[]).find(x=>x.id===g.playerId); if(!pl) return;
      pl.awards = pl.awards||[]; if(!pl.awards.some(aw=> aw.sk===g.rec.sk && aw.key===g.rec.key)) pl.awards.push(g.rec); });
    merged.raids = (merged.raids||[]).filter(r=> r.carryover == null);   // reset scores; raids kept
    if(next){ merged.season = next; }
    else { const curNum=(Number.isFinite(+cur.num)&&+cur.num>0)?+cur.num:null;
      merged.season = { name:'Beta Complete', start:startMs, end:null, complete:true, s2:!!cur.s2, challenge:'', finale:false, num:(curNum!=null?curNum+1:undefined), updatedAt:startMs }; }
    merged.snapshot = null; merged.polls = {};
    return merged;
  }, null, opts.auto ? 'logMsg' : 'seasonMsg');
  if(ok && !opts.auto){ showMsg('seasonMsg','ok', next?('Season archived — '+next.name+' has begun.'):'Final season archived — the beta is complete! 🏆'); fillSeasonInputs(); }
  return ok;
}
async function archiveSeason(){
  const cur = state.season||{};
  if(!confirm('End "'+(cur.name||'this season')+'" now?\n\nIts top 3 go to the Hall of Fame, every category winner gets their trophy, and a fresh season starts (scores reset — all raids are kept).')) return;
  await doArchive({ auto:false });
}
/* Auto-roller: sets a running season's end date if missing, then archives once the end passes. */
let _rolling = false;
async function maybeRolloverSeason(){
  if(saving || _rolling) return;
  const cfg = seasonCfg(); if(!cfg.auto) return;
  const s = state.season||{};
  if(s.complete || typeof s.start!=='number') return;          // completed, or all-time season → nothing to schedule
  if(typeof s.end!=='number'){                                  // running season with no end → schedule one
    _rolling = true;
    try{ const finalMs=dateToMs(cfg.finalEnd); let end=s.start+(cfg.lengthDays-1)*DAY_MS; if(finalMs!=null && end>finalMs) end=finalMs;
      await persist(m=>{ if(m.season && typeof m.season.end!=='number' && !m.season.complete){ m.season.end=end; m.season.updatedAt=Date.now(); } return m; });
    } finally{ _rolling=false; }
    return;
  }
  if(Date.now() > endOfDay(s.end)){                             // past the last day → roll
    _rolling = true;
    try{ await doArchive({ auto:true }); } finally{ _rolling=false; }
  }
}

/* ---------- Import players + carryover SR (e.g. from Google Sheets) ---------- */
function parseImport(text){
  const rows = [];
  (text||'').split(/\r?\n/).forEach(line=>{
    line = line.trim(); if(!line) return;
    // SR = the trailing number (may include thousands separators / spaces, e.g. "3,400")
    const m = line.match(/(\d[\d,\s]*)\s*$/);
    if(!m) return;                                   // no trailing number -> skip (e.g. header "Name, SR")
    const sr = parseInt(m[1].replace(/[^\d]/g,''), 10);
    const name = line.slice(0, m.index).replace(/[\s,;\t|]+$/,'').trim();
    if(!name || isNaN(sr)) return;
    rows.push({ name, sr: Math.max(0, sr) });
  });
  return rows;
}
async function importPlayers(){
  const rows = parseImport(el('importText').value);
  if(rows.length === 0){ showMsg('importMsg','warn','No valid rows found. Use one player per line, e.g.  Ghost, 1250'); return; }
  const total = rows.reduce((a,r)=>a+r.sr, 0);
  const preview = rows.slice(0,8).map(r=>'• '+r.name+' — '+r.sr.toLocaleString()+' SR').join('\n') + (rows.length>8?'\n…and '+(rows.length-8)+' more':'');
  if(!confirm('Import '+rows.length+' player'+(rows.length>1?'s':'')+' (total '+total.toLocaleString()+' SR)?\n\n'+preview+'\n\nEach gets a "carryover" starting entry. Re-importing a name that already exists just updates its carryover — it will not duplicate.')) return;
  const baseTs = (seasonWindow().start || 1);
  const ok = await persist(merged=>{
    rows.forEach((row,i)=>{
      const p = ensurePlayer(merged, row.name);
      // Idempotent: if this player already has a carryover entry, update it instead of adding a duplicate.
      const existing = merged.raids.find(r=> r.carryover != null && r.playerId === p.id);
      if(existing){ existing.carryover = row.sr; existing.ts = baseTs + i; existing.playerName = row.name; }
      else {
        merged.raids.push({ id:uid(), ts: baseTs + i, playerId:p.id, playerName:row.name, carryover:row.sr,
          operatorKills:0, squadKills:0, contract:'none', extracted:false, weaponCase:false, fullSquad:false, finalExfil:false });
      }
    });
    return merged;
  });
  if(ok){ showMsg('importMsg','ok','Imported '+rows.length+' player'+(rows.length>1?'s':'')+' with carryover SR.'); el('importText').value=''; }
}

/* ---------- Admin PIN lock (deterrent for the Settings tab) ---------- */
function adminPinIsSet(){ return !!(state.pinHash || state.adminPinConfigured); }
function computeUnlocked(){
  // Open only if there's no PIN, or the admin entered it THIS session.
  // Never remembered across reloads; auto-relocks on leaving Settings or after idle.
  settingsUnlocked = (!adminPinIsSet()) || sessionUnlocked;
}
function armIdle(){
  clearTimeout(idleTimer);
  if(adminPinIsSet() && sessionUnlocked && currentTab === 'settings'){
    idleTimer = setTimeout(autoLock, 120000);   // 2 min of inactivity → relock
  }
}
function autoLock(){
  clearTimeout(idleTimer);
  if(adminPinIsSet() && sessionUnlocked){ sessionUnlocked = false; setAdminToken(''); computeUnlocked(); refreshSettingsLock(); }
}
function refreshSettingsLock(){
  const lock = el('settingsLock'), inner = el('settingsInner');
  if(!lock || !inner) return;
  const locked = adminPinIsSet() && !settingsUnlocked;
  lock.style.display = locked ? 'block' : 'none';
  inner.style.display = locked ? 'none' : 'block';
  if(!locked){ renderPinManage(); showSetTab(currentSetTab); }
}
/* Settings sub-tabs: Everyday / Setup / Danger — show only the cards tagged for the active tab. */
let currentSetTab = 'everyday';
function showSetTab(tab){
  currentSetTab = tab || 'everyday';
  document.querySelectorAll('#setnav [data-settab]').forEach(b=> b.classList.toggle('active', b.getAttribute('data-settab')===currentSetTab));
  document.querySelectorAll('#settingsInner .card[data-settab]').forEach(c=>{ c.style.display = (c.getAttribute('data-settab')===currentSetTab) ? '' : 'none'; });
}
function initSetTabs(){
  document.addEventListener('click', e=>{
    const b = e.target.closest && e.target.closest('#setnav [data-settab]');
    if(b){ showSetTab(b.getAttribute('data-settab')); }
  });
  showSetTab('everyday');
}
function renderPinManage(){
  const box = el('pinManage'); if(!box) return;
  if(!adminPinIsSet()){
    box.innerHTML = `<p class="note" style="margin-top:0">No PIN set — anyone with the link can change settings. Add a PIN to lock this Settings tab (players can still view the board and log their own raids).</p>
      <div class="field" style="max-width:220px"><label for="pinNew">New PIN (3–8 digits)</label>
        <input id="pinNew" type="password" inputmode="numeric" autocomplete="off" placeholder="••••"></div>
      <div class="btnrow"><button class="btn" id="pinSet">Enable PIN lock</button></div>`;
    el('pinSet').addEventListener('click', ()=>setPin(el('pinNew').value));
  } else {
    box.innerHTML = `<p class="note" style="margin-top:0">Unlocked for now. Settings auto-lock when you leave this tab, after 2 minutes idle, or on reload — so it's never left open for others.</p>
      <div class="btnrow" style="margin-bottom:12px">
        <button class="btn ghost" id="pinLock">Lock now</button>
      </div>
      <div class="field" style="max-width:220px"><label for="pinNew">Change PIN</label>
        <input id="pinNew" type="password" inputmode="numeric" autocomplete="off" placeholder="new PIN"></div>
      <div class="btnrow"><button class="btn" id="pinSet">Update PIN</button></div>`;
    el('pinLock').addEventListener('click', lockSettings);
    el('pinSet').addEventListener('click', ()=>setPin(el('pinNew').value));
  }
}
async function tryUnlock(){
  const entered = (el('pinEntry').value||'').trim();
  let privateState;
  try{
    privateState=await remoteGet(entered);
  }catch(e){ showMsg('pinErr','err',e&&e.message&&e.message.includes('429')?'Too many incorrect PIN attempts. Try again in 10 minutes.':e&&e.message&&e.message.includes('403')?'Incorrect PIN.':'Could not verify the PIN — check your connection.'); return; }
  if(privateState){
    sessionUnlocked = true; computeUnlocked();
    setAdminToken(entered);
    el('pinEntry').value=''; el('pinErr').className='msg';
    state=privateState;
    renderAll();
    refreshSettingsLock(); armIdle();
  }
}
async function setPin(pin){
  pin = (pin||'').trim();
  if(!/^\d{3,8}$/.test(pin)){ showMsg('pinMsg','err','PIN must be 3–8 digits.'); return; }
  const hash = pinHashOf(pin);
  const ok = await persist(merged=>{ merged.pinHash = hash; return merged; });
  if(ok){ sessionUnlocked = true; computeUnlocked(); setAdminToken(pin); showMsg('pinMsg','ok','PIN set. Settings now lock automatically when you leave or go idle.'); refreshSettingsLock(); armIdle(); }
}
function lockSettings(){
  clearTimeout(idleTimer);
  sessionUnlocked = false; computeUnlocked();
  setAdminToken('');
  refreshSettingsLock();
  document.querySelector('nav.tabs button[data-tab="board"]').click();   // jump to leaderboard so the lock is obvious
}

/* Human-readable summary of a raid's actions */
function raidBits(r){
  if(r.carryover) return 'carryover (imported) +'+(Number(r.carryover)||0).toLocaleString();
  const bits = [];
  if(r.operatorKills) bits.push(r.operatorKills+' op kill'+(r.operatorKills>1?'s':''));
  if(r.squadKills) bits.push(r.squadKills+' squad kill'+(r.squadKills>1?'s':''));
  if(r.contract==='regular') bits.push('regular contract');
  if(r.contract==='hunt') bits.push('hunt squad contract');
  if(r.extracted) bits.push('extracted');
  if(r.weaponCase) bits.push('weapon case');
  if(r.fullSquad) bits.push('full squad');
  if(r.finalExfil) bits.push('final exfil');
  return bits.join(' · ') || 'no actions';
}
function timeAgo(ts){
  if(!ts) return '';
  const s = Math.floor((Date.now()-ts)/1000);
  if(s<60) return 'just now';
  const m=Math.floor(s/60); if(m<60) return m+'m ago';
  const h=Math.floor(m/60); if(h<24) return h+'h ago';
  const d=Math.floor(h/24); if(d<7) return d+'d ago';
  return new Date(ts).toLocaleDateString();
}

/* Global reverse-chronological feed of every raid logged */
function renderHistory(){
  const body = el('historyBody');
  if(!body) return;
  const st = computeStandings();
  const feed = [];
  st.forEach(p=>p.raids.forEach(r=>feed.push({name:p.name, r})));
  feed.sort((a,b)=> (b.r.ts||0)-(a.r.ts||0));
  if(feed.length===0){ body.innerHTML = '<div class="empty">No raids logged yet. Once operators start reporting runs, every entry shows up here.</div>'; return; }
  const shown = feed.slice(0,120);
  body.innerHTML = shown.map(({name,r})=>{
    const dcls = r.delta>0?'up':r.delta<0?'down':'';
    const dtxt = (r.delta>=0?'+':'')+r.delta;
    return `<div class="hist-row">
      <div class="hist-main">
        <div class="hist-top"><span class="hist-name">${esc(name)}</span> <span class="hist-time">${timeAgo(r.ts)}</span></div>
        <div class="hist-det">${raidBits(r)}${r.verified?' <span class="vf-chip">✓ Verified</span>':(raidHasProof(r)?' <span class="vf-pending">proof pending</span>':'')}</div>
      </div>
      <div class="hist-right">
        <span class="delta ${dcls}">${dtxt} SR</span>
        <span class="hist-total">${r.srAfter.toLocaleString()} · <span class="badge b-${tierFor(r.srAfter).name}">${tierFor(r.srAfter).name}</span></span>
      </div>
    </div>`;
  }).join('') + (feed.length>shown.length ? `<div class="note" style="text-align:center;margin-top:10px">Showing the ${shown.length} most recent of ${feed.length} raids.</div>` : '');
}

function renderBoard(){
  const st = computeStandings().filter(p=> p.raids.length > 0);   // hide players whose only raid is awaiting approval
  const body = el('boardBody');
  if(st.length === 0){
    body.innerHTML = '<div class="empty">No players yet. Head to <b>Log a Raid</b> to add yourself and record your first run.</div>';
    return;
  }
  const elite = eliteBadges(st);
  const showElite = Object.keys(elite).length > 0;
  let rows = st.map((p,i)=>{
    const place = i+1;
    const pc = place===1?'p1':place===2?'p2':place===3?'p3':'';
    const d = p.lastDelta;
    const dtxt = d===0?'':(d>0?'▲ +'+d:'▼ '+d);
    const dcls = d>0?'up':d<0?'down':'';
    const rc = p.raids.filter(r=> r.carryover == null).length;   // real raids (exclude carryover)
    const eb = elite[p.id];
    const ri = rankInfo(p.sr);
    const streak = streakInfo(p);
    const badgeCell = showElite ? `<td class="badge-col">${eb?`<img class="elite-badge" src="${eb.badge}" alt="Top 3 ${eb.tier}" title="Top 3 ${eb.tier} — #${eb.rank} in tier">`:''}</td>` : '';
    return `<tr class="lb-clickable ${place===1 && p.sr>0 ?'top1':''}" data-profile="${esc(p.id)}" data-name="${esc(p.name.toLowerCase())}" title="View ${esc(p.name)}'s profile">
      <td class="op">
        ${streak.type?`<div class="stk-plate stk-l${streak.level}" style="background-image:url(${STREAK_IMG[streak.type][streak.level-1]})"></div><div class="stk-scrim"></div><div class="stk-bar ${streak.type}"></div>`:''}
        <div class="rankcell">
          <div class="place ${pc}">${place}</div>
          <div class="rankbadge b-${p.tier}" style="background-image:url(${appBadge(ri,p.tier)})" title="${esc(ri.label)}"></div>
          <div>
            <div class="pname">${esc(p.name)} ${streakHTML(streak)}<span class="pf-hint">›</span></div>
            <div class="raids-mini"><span class="divmini b-${p.tier}">${ri.isApex?('#'+place+' · '+ri.label):ri.label}</span> · ${rc} raid${rc===1?'':'s'}${dtxt?` · <span class="delta ${dcls}">${dtxt} last</span>`:''}</div>
          </div>
        </div>
      </td>
      <td class="hide-sm b-${p.tier}"><span class="divlabel">${ri.label}</span>${ri.isApex?`<div class="rankprog" title="Apex ladder — ranked #${place}"><i style="width:100%"></i></div>`:`<div class="rankprog" title="${ri.toNext.toLocaleString()} SR to ${esc(ri.nextLabel)}"><i style="width:${ri.pct.toFixed(0)}%"></i></div>`}</td>
      ${badgeCell}
      <td class="num">${p.sr.toLocaleString()}</td>
    </tr>`;
  }).join('');
  const colspan = 2 + (showElite?1:0) + 1;
  body.innerHTML = STREAK_DEFS + `<table class="lb">
    <thead><tr><th>Operator</th><th class="hide-sm">Rank</th>${showElite?'<th class="badge-col">Top 3</th>':''}<th class="num">SR</th></tr>
    <tr class="lb-empty" id="boardNoMatch" style="display:none"><td colspan="${colspan}">No operator matches your search.</td></tr></thead>
    <tbody>${rows}</tbody></table>`;
  applyBoardFilter();
}
/* Live name filter for the standings — hides non-matching rows without a full re-render,
   so the search box keeps focus while the 20s poll refreshes the board underneath it. */
function applyBoardFilter(){
  const inp = el('boardSearch'); if(!inp) return;
  const q = (inp.value||'').trim().toLowerCase();
  const rowsEls = document.querySelectorAll('#boardBody tr[data-name]');
  let shown = 0;
  rowsEls.forEach(tr=>{
    const hit = !q || (tr.getAttribute('data-name')||'').indexOf(q) !== -1;
    tr.style.display = hit ? '' : 'none';
    if(hit) shown++;
  });
  const none = el('boardNoMatch'); if(none) none.style.display = (q && shown===0) ? '' : 'none';
}

function renderPlayerList(){
  const names = [...state.players].sort((a,b)=>a.name.localeCompare(b.name));
  el('playerList').innerHTML = names.map(p=>`<option value="${esc(p.name)}">`).join('');
  const pick = el('playerPick');
  if(pick){
    const cur = el('playerName').value.trim();
    pick.innerHTML = '<option value="">— select existing operator —</option>' +
      names.map(p=>`<option value="${esc(p.name)}"${p.name===cur?' selected':''}>${esc(p.name)}</option>`).join('');
    el('pickWrap').style.display = names.length ? 'block' : 'none';
  }
}

function renderManage(){
  const st = computeStandings();
  const body = el('manageBody');
  if(st.length===0){ body.innerHTML = '<div class="note">No players yet.</div>'; return; }
  body.innerHTML = st.map(p=>{
    const hist = p.raids.slice().reverse().map(r=>{
      const when = r.ts? new Date(r.ts).toLocaleString():'';
      const bits = [];
      if(r.carryover) bits.push('carryover +'+(Number(r.carryover)||0).toLocaleString());
      if(r.operatorKills) bits.push(r.operatorKills+' op');
      if(r.squadKills) bits.push(r.squadKills+' sq');
      if(r.contract==='regular') bits.push('reg contract');
      if(r.contract==='hunt') bits.push('hunt contract');
      if(r.extracted) bits.push('extracted');
      if(r.weaponCase) bits.push('wpn case');
      if(r.fullSquad) bits.push('full squad');
      if(r.finalExfil) bits.push('final exfil');
      const dcls = r.delta>0?'up':r.delta<0?'down':'';
      return `<div class="hrow">
        <div><div class="det">${when}</div><div class="det">${bits.join(' · ')||'no actions'}</div></div>
        <div style="text-align:right;white-space:nowrap">
          <span class="delta ${dcls}">${r.delta>=0?'+':''}${r.delta}</span>
          <button class="del-x" title="Delete this raid" data-delraid="${esc(r.id)}">✕</button>
        </div>
      </div>`;
    }).join('');
    const raw = state.players.find(x=>x.id===p.id);
    const hasPin = playerPinIsSet(raw);
    const resetBtn = hasPin ? `<button class="del-x" style="float:right;margin-left:6px" title="Reset this player's PIN (they can set a new one)" data-resetpin="${esc(p.id)}">Reset PIN</button>` : '';
    return `<details class="hist">
      <summary>${esc(p.name)} ${hasPin?'<span style="font-size:10px;font-weight:700;color:var(--gold-b);border:1px solid rgba(245,196,81,.45);border-radius:4px;padding:0 4px;vertical-align:1px">PIN</span> ':''}— <span class="badge b-${p.tier}">${p.tier}</span> ${p.sr.toLocaleString()} SR
        <button class="del-x" style="float:right" title="Remove player + their raids" data-delplayer="${esc(p.id)}">Remove</button>${resetBtn}</summary>
      ${hist||'<div class="hrow"><div class="det">No raids.</div></div>'}
    </details>`;
  }).join('');
}

/* ============================================================
   Log-a-raid form + live preview
   ============================================================ */
function readForm(){
  return {
    name: el('playerName').value.trim(),
    ranSquad: el('ranSquad') ? el('ranSquad').checked : false,
    operatorKills: Math.max(0, parseInt(el('operatorKills').value)||0),
    squadKills: Math.min(10, Math.max(0, parseInt(el('squadKills').value)||0)),   // rules cap squad kills at 10
    bossKills: Math.min(2, Math.max(0, parseInt(el('bossKills').value)||0)),      // Season 2: cap boss kills at 2
    contract: el('contract').value,
    exfilChoice: exfilChoice,
    extracted: exfilChoice==='yes',
    weaponCase: el('weaponCase').checked,
    fullSquad: el('fullSquad').checked,
    finalExfil: el('finalExfil').checked
  };
}
function setExfil(choice){ exfilChoice = choice; updatePreview(); }
/* ---- Proof attachment (verification) ---- */
let _proofDataUrl = null;   // compressed image data URL staged for the next submit
function compressImage(file, cb){
  const fr = new FileReader();
  fr.onload = ()=>{ const img = new Image();
    img.onload = ()=>{
      const max = 1024; let w = img.width, h = img.height;
      if(w>max || h>max){ const s = Math.min(max/w, max/h); w = Math.round(w*s); h = Math.round(h*s); }
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      let q = 0.72, url = c.toDataURL('image/jpeg', q);
      while(url.length > 240000 && q > 0.4){ q -= 0.1; url = c.toDataURL('image/jpeg', q); }
      cb(url);
    };
    img.onerror = ()=> cb(null); img.src = fr.result;
  };
  fr.onerror = ()=> cb(null); fr.readAsDataURL(file);
}
function onProofFile(){
  const inp = el('proofImg'); const file = inp && inp.files && inp.files[0];
  if(!file){ return; }
  if(!/^image\//.test(file.type)){ showMsg('logMsg','warn','That file isn’t an image — attach a screenshot or clip frame.'); inp.value=''; return; }
  compressImage(file, url=>{
    if(!url){ showMsg('logMsg','warn','Couldn’t read that image. Try a different screenshot.'); return; }
    _proofDataUrl = url;
    const pv = el('proofPreview');
    if(pv){ pv.style.display='block'; pv.innerHTML = `<img src="${url}" alt="proof preview"><button type="button" class="proof-x" id="proofClear">✕ remove</button>`; }
    const lbl = el('proofUploadLabel'); if(lbl) lbl.textContent = '📎 Image attached — tap to replace';
  });
}
function clearProof(){
  _proofDataUrl = null;
  const inp = el('proofImg'); if(inp) inp.value = '';
  const url = el('proofUrl'); if(url) url.value = '';
  const pv = el('proofPreview'); if(pv){ pv.style.display='none'; pv.innerHTML=''; }
  const lbl = el('proofUploadLabel'); if(lbl) lbl.textContent = '📎 Attach a screenshot / clip image';
}
/* Show or hide all Season-2 bits (boss field, rules rows) based on the season flag */
function applyDonate(){
  const btn = el('supportBtn'); if(!btn) return;
  const d = (state && state.donate) || {};
  if(d.url){ btn.href = d.url; const l=el('supportLabel'); if(l) l.textContent = d.label || 'Support'; btn.style.display=''; }
  else { btn.style.display='none'; }
}
function applyS2UI(){
  const on = s2on();
  ['bossField','bossRuleRow','rulesS2'].forEach(id=>{ const e=el(id); if(e) e.style.display = on ? '' : 'none'; });
}
function currentSRfor(name){
  if(!name) return 0;
  const st = computeStandings();
  const found = st.find(p=>p.name.toLowerCase()===name.toLowerCase());
  return found? found.sr : 0;
}
function syncExtractionUI(){
  const yes = exfilChoice==='yes';
  document.querySelectorAll('#exfilSeg .seg-btn').forEach(btn=>{
    btn.classList.toggle('active', btn.getAttribute('data-exfil')===exfilChoice);
  });
  el('exfilBonuses').style.display = yes ? 'grid' : 'none';   // bonuses only apply when extracted
  ['weaponCase','fullSquad','finalExfil'].forEach(id=>{ el(id).disabled = !yes; if(!yes) el(id).checked=false; });
  el('extracted').checked = yes;
}
function updatePreview(){
  syncExtractionUI();
  const f = readForm();
  const st = computeStandings();
  const meNow = f.name ? st.find(p=> p.name.toLowerCase()===f.name.toLowerCase()) : null;
  const before = meNow ? meNow.sr : 0;
  const fee = feeFor(before);
  let earned = grossEarned(f);
  const after = Math.max(0, before - fee + earned);
  const net = after - before;
  el('pv-cur').innerHTML = f.name ? `${before.toLocaleString()} · <span class="badge b-${tierFor(before).name}">${tierFor(before).name}</span>` : '—';
  el('pv-fee').textContent = fee===0?'0':('−'+fee);
  el('pv-feenote').textContent = f.name ? '('+rankInfo(before).label+')' : '';
  el('pv-earn').textContent = '+'+earned;
  const netEl = el('pv-net');
  netEl.textContent = (net>=0?'+':'')+net;
  netEl.className = 'net ' + (net>0?'pos':net<0?'neg':'');
  el('pv-new').innerHTML = f.name ? `${after.toLocaleString()} · <span class="badge b-${tierFor(after).name}">${tierFor(after).name}</span>` : '—';
  syncProofGate(f);
  updateNameStatus();
}
/* Proof upload only matters for big runs — hide the whole proof section until the raid clears
   the kill threshold (admin-set, default 10), so nobody's uploading a 1-kill screenshot to verify. */
function syncProofGate(f){
  const fld = el('proofField'); if(!fld) return;
  const min = currentFilter().proofMinKills;
  const thresh = (min==null ? 10 : min);
  const show = (f.operatorKills||0) >= thresh;
  fld.style.display = show ? '' : 'none';
  if(!show && (_proofDataUrl || (el('proofUrl') && el('proofUrl').value))) clearProof();  // never let a hidden field submit stale proof
}

/* ---------- Per-player PIN protection ----------
   Each player may set an optional PIN. Once set, logging a raid under that name
   requires it — but only until this device is verified, then it's remembered here. */
function playerByName(name){ if(!name) return null; const q=name.trim().toLowerCase(); return state.players.find(p=> (p.name||'').toLowerCase()===q) || null; }
function playerPinIsSet(pl){ return !!(pl && (pl.pin || pl.pinConfigured)); }
function deviceHasPin(pl){ return !!(pl && playerPinIsSet(pl) && verifiedPlayerSessions[pl.id]); }
async function hydratePlayerPin(name){
  const pl=playerByName(name);
  if(!pl || !playerPinIsSet(pl) || checkedPlayerSessions[pl.id]) return pl;
  if(!playerSessionChecks[pl.id]){
    playerSessionChecks[pl.id]=(async()=>{
      const res=await fetch(DATA_API+'/player-pin/status?playerId='+encodeURIComponent(pl.id),{cache:'no-store',credentials:'same-origin'});
      if(!res.ok) throw new Error('Player session '+res.status);
      const result=await res.json();
      checkedPlayerSessions[pl.id]=true;
      verifiedPlayerSessions[pl.id]=!!result.verified;
    })().finally(()=>{ delete playerSessionChecks[pl.id]; });
  }
  await playerSessionChecks[pl.id];
  return pl;
}
async function verifyPlayerPinForDevice(id, pin){
  const res=await fetch(DATA_API+'/player-pin/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({playerId:id,pin}),cache:'no-store',credentials:'same-origin'});
  if(res.status===429) throw new Error('Too many incorrect PIN attempts. Try again in 10 minutes.');
  if(!res.ok) return false;
  checkedPlayerSessions[id]=true;
  verifiedPlayerSessions[id]=true;
  return true;
}

function updateNameStatus(){
  const sec=el('nameSec'), unlock=el('unlockRow'), setrow=el('setPinRow');
  if(!sec) return;
  const name = el('playerName').value.trim();
  if(setrow && setrow.style.display!=='none'){ sec.style.display='none'; unlock.style.display='none'; return; }  // don't clobber an open set-PIN form
  if(!name){ sec.style.display='none'; unlock.style.display='none'; sec._sig=''; return; }
  const pl = playerByName(name);
  if(pl && playerPinIsSet(pl) && !checkedPlayerSessions[pl.id] && !playerSessionChecks[pl.id]){
    hydratePlayerPin(name).then(()=>{ sec._sig=''; updateNameStatus(); }).catch(()=>{});
  }
  // Only rebuild when the meaningful state changes — prevents wiping the link/handlers on every keystroke
  const sig = [name.toLowerCase(), pl&&pl.id, playerPinIsSet(pl)?1:0, deviceHasPin(pl)?1:0].join('|');
  if(sec._sig === sig && sec.style.display!=='none') return;
  sec._sig = sig;
  if(playerPinIsSet(pl)){
    sec.className='namesec prot'; sec.style.display='flex';
    if(deviceHasPin(pl)){
      sec.innerHTML = 'Protected · <span class="ok">verified on this device ✓</span> · <a id="changePinLink">Change PIN</a>';
      unlock.style.display='none';
    } else {
      sec.innerHTML = '<b>'+esc(name)+'</b> is protected — enter your PIN to log as this operator.';
      unlock.style.display='flex';
    }
  } else {
    sec.className='namesec open'; sec.style.display='flex';
    sec.innerHTML = 'Not protected. <a id="setPinLink">Set a PIN</a> so only you can log as <b>'+esc(name)+'</b>.';
    unlock.style.display='none';
  }
  const sp=el('setPinLink'); if(sp) sp.onclick=()=>openSetPin(false);
  const cp=el('changePinLink'); if(cp) cp.onclick=()=>openSetPin(true);
}
function openSetPin(isChange){
  el('nameSec')._sig=''; el('nameSec').style.display='none'; el('unlockRow').style.display='none';
  const row=el('setPinRow'); row.style.display='flex';
  el('curPin').style.display = isChange ? '' : 'none';
  el('curPin').value=''; el('newPin').value=''; el('newPin2').value='';
  (isChange?el('curPin'):el('newPin')).focus();
}
function cancelSetPin(){ el('setPinRow').style.display='none'; el('nameSec')._sig=''; updateNameStatus(); }
async function saveSetPin(){
  const name = el('playerName').value.trim();
  if(!name){ showMsg('logMsg','warn','Enter your operator name first.'); return; }
  const cur = el('curPin').value.trim();
  const p1 = el('newPin').value.trim(), p2 = el('newPin2').value.trim();
  if(p1.length<3){ showMsg('logMsg','warn','PIN must be at least 3 characters.'); return; }
  if(p1!==p2){ showMsg('logMsg','warn','Those PINs don\'t match.'); return; }
  let existing;
  try{ existing=await hydratePlayerPin(name); }
  catch(e){ showMsg('logMsg','err','Could not verify the current PIN — check your connection.'); return; }
  if(playerPinIsSet(existing) && !cur){ showMsg('logMsg','err','Enter your current PIN.'); return; }
  const newHash = pinHashOf(p1);
  pendingPlayerPIN=cur;
  const ok = await persist(merged=>{ const pl = ensurePlayer(merged, name); pl.pin = newHash; return merged; });
  pendingPlayerPIN='';
  if(ok){
    const pl = playerByName(name);
    if(pl){
      delete checkedPlayerSessions[pl.id]; delete verifiedPlayerSessions[pl.id];
      try{ await verifyPlayerPinForDevice(pl.id,p1); }catch(e){}
    }
    el('setPinRow').style.display='none';
    showMsg('logMsg','ok',deviceHasPin(pl) ? name+' is now protected. This device is verified.' : name+' is now protected. Enter the PIN again to remember this device.');
    updateNameStatus();
  }
}
async function unlockName(){
  const name = el('playerName').value.trim();
  let pl;
  try{ pl=await hydratePlayerPin(name); }
  catch(e){ showMsg('logMsg','err',e&&e.message&&e.message.includes('Too many')?e.message:'Could not verify the PIN — check your connection.'); return; }
  if(!pl || !playerPinIsSet(pl)){ updateNameStatus(); return; }
  const pin=el('namePin').value.trim();
  let verified=false;
  try{ verified=await verifyPlayerPinForDevice(pl.id,pin); }
  catch(e){ showMsg('logMsg','err',e&&e.message&&e.message.includes('Too many')?e.message:'Could not verify the PIN — check your connection.'); return; }
  if(verified){
    el('namePin').value='';
    showMsg('logMsg','ok','Unlocked — this device can now log raids as '+name+'.');
    updateNameStatus();
  } else { showMsg('logMsg','err','Incorrect PIN.'); }
}

function ensurePlayer(merged, name){
  let p = merged.players.find(x=>x.name.toLowerCase()===name.toLowerCase());
  if(!p){ p = { id:uid(), name:name }; merged.players.push(p); }
  return p;
}

async function submitRaid(){
  const f = readForm();
  if(!f.name){ showMsg('logMsg','err','Enter your operator name first.'); el('playerName').focus(); return; }
  if(nameBlocked(f.name)){ showMsg('logMsg','err','That name isn’t allowed on the board. Pick a different operator name.'); el('playerName').focus(); return; }
  let prot;
  try{ prot=await hydratePlayerPin(f.name); }
  catch(e){ showMsg('logMsg','err','Could not verify operator protection — check your connection.'); return; }
  if(playerPinIsSet(prot) && !deviceHasPin(prot)){
    showMsg('logMsg','warn',''+f.name+' is protected — enter your PIN to log as this operator.');
    updateNameStatus(); const np=el('namePin'); if(np) np.focus();
    return;
  }
  if(!f.exfilChoice){ showMsg('logMsg','warn','Did you get out? Tap “Extracted” or “Killed / no exfil” first.'); return; }
  // If an identical raid is already waiting for review, don't stack another — this is the
  // re-submit spiral that used to get people extra-flagged. Point them to the status instead.
  const dupPending = (state.raids||[]).some(r=> r.pending && !r.deleted
    && (r.playerName||'').toLowerCase()===f.name.toLowerCase()
    && (r.operatorKills||0)===f.operatorKills && (r.squadKills||0)===f.squadKills && (r.bossKills||0)===f.bossKills
    && !!r.extracted===!!f.extracted && (r.contract||'none')===(f.contract||'none')
    && !!r.weaponCase===!!f.weaponCase && !!r.finalExfil===!!f.finalExfil && !!r.fullSquad===!!f.fullSquad);
  if(dupPending){ showHoldNotice('you already logged this raid — it’s waiting for review, no need to submit it again'); return; }
  // Hard stop against mass data entry: a player can't log another raid until the cooldown
  // has passed since their last one. A real raid takes far longer, so this only ever blocks
  // bulk-spamming. Admins are exempt. (The velocity check above still HOLDS merely-fast raids.)
  if(!settingsUnlocked){
    const cd = (currentFilter().minGap)||0;
    if(cd>0){
      const me = playerByName(f.name);
      if(me){
        const mine = (state.raids||[]).filter(r=> r.playerId===me.id && r.carryover==null && !r.deleted);
        if(mine.length){
          const since = Date.now() - Math.max(...mine.map(r=> r.ts||0));
          if(since < cd*60000){
            const wait = Math.max(1, Math.ceil((cd*60000 - since)/60000));
            const ago = Math.max(1, Math.round(since/60000));
            showMsg('logMsg','err', `Hold up — you logged a raid ${ago} min ago. To keep the board honest, raids can only be logged once every ${cd} minutes (log them as you play, not all at once). You can log your next raid in about ${wait} min.`);
            return;
          }
        }
      }
    }
  }
  const beforeSR = currentSRfor(f.name);      // capture starting SR/rank for the result popup
  el('submitRaid').disabled = true;
  const raid = {
    id: uid(), ts: Date.now(),
    playerId: null, playerName: f.name,
    operatorKills:f.operatorKills, squadKills:f.squadKills, bossKills:f.bossKills, contract:f.contract,
    extracted:f.extracted, weaponCase:f.weaponCase, fullSquad:f.fullSquad, finalExfil:f.finalExfil,
    ranSquad: !!f.ranSquad
  };
  // Optional proof for verification (a link stays; an uploaded image is discarded on approval)
  const proofUrl = (el('proofUrl') ? el('proofUrl').value : '').trim();
  if(proofUrl && /^https?:\/\//i.test(proofUrl)) raid.proofUrl = proofUrl.slice(0,300);
  if(_proofDataUrl) raid.proofImg = _proofDataUrl;
  // Anti-troll gate: abnormally high raids, impossibly fast logging, or a brand-new
  // operator's first runs all wait for an admin's OK before they count (admins bypass).
  const holdReason = raidSuspicious(raid) || velocityHold(raid) || probationHold(f.name, raid);
  if(holdReason && !settingsUnlocked){ raid.pending = true; raid.pendingReason = holdReason; }
  const ok = await persist(
    merged=>{
      const p = ensurePlayer(merged, f.name);
      raid.playerId = p.id;
      if(!merged.raids.some(r=> r.id === raid.id)) merged.raids.push(raid);   // idempotent if we retry
      return merged;
    },
    check=> check.raids.some(r=> r.id === raid.id)   // confirm our raid actually landed; retry if a collision clobbered it
  );
  el('submitRaid').disabled = false;
  if(ok && raid.pending){
    lsSet('dmz_myname', f.name);
    showHoldNotice(raid.pendingReason || 'the numbers were higher than the board’s limits');
    clearForm(true); el('playerName').value = f.name; updatePreview();
    return;
  }
  if(ok){
    lsSet('dmz_myname', f.name);
    const st = computeStandings();
    const me = st.find(p=>p.id===raid.playerId);
    const place = st.findIndex(p=>p.id===raid.playerId)+1;
    const afterSR = me ? me.sr : beforeSR;
    const myRec = me && me.raids.find(r=> r.id === raid.id);
    const achievements = (myRec && myRec.achHits) ? myRec.achHits : [];
    showResult({ name:f.name, beforeSR, afterSR, place, total: st.length, achievements });
    showMsg('logMsg','ok', 'Logged for '+f.name+'. Now '+afterSR.toLocaleString()+' SR ('+(me?me.tier:'')+').');
    clearForm(true);
    el('playerName').value = f.name;
    updatePreview();
  }
}

/* ---------- Raid result popup (with rank-up animation) ---------- */
let resultTimer;
function showResult(d){
  const bt = tierFor(d.beforeSR), at = tierFor(d.afterSR);
  const delta = d.afterSR - d.beforeSR;
  const up = at.min > bt.min, down = at.min < bt.min;
  const dcls = delta>0?'pos':delta<0?'neg':'zero';
  const dtxt = (delta>0?'+':'') + delta.toLocaleString() + ' SR';
  let banner;
  if(up){
    banner = `<div class="rankup"><div class="rays"></div>
      <div class="ru-label">▲ Rank Up</div>
      <div class="ru-badge"><span class="badge b-${at.name}">${at.name}</span></div>
      <div class="ru-from">${bt.name} → ${at.name}</div></div>`;
  } else if(down){
    banner = `<div class="rankdown"><div class="rd-label">▼ Rank Down</div>
      <span class="badge b-${at.name} lg">${at.name}</span>
      <div class="ru-from">${bt.name} → ${at.name}</div></div>`;
  } else {
    banner = `<div class="r-rankrow"><span class="badge b-${at.name} lg">${at.name}</span></div>`;
  }
  const achMedal = t => t>=4
    ? `<img class="r-ach-ic dia" src="${ACH_DIA_IMG}" alt="Diamond medal">`
    : Array.from({length:t},()=>`<img class="r-ach-ic" src="${ACH_STAR_IMG}" alt="star">`).join('');
  const achBanner = (d.achievements && d.achievements.length)
    ? '<div class="r-ach"><div class="r-ach-h"><img class="r-ach-ic" src="'+ACH_STAR_IMG+'" alt=""> Achievement'+(d.achievements.length>1?'s':'')+' unlocked</div>'
      + d.achievements.map(a=>'<div class="r-ach-row"><span class="r-ach-lbl">'+esc(a.label)+' <span class="r-ach-medals">'+achMedal(a.tier)+'</span></span><b>+'+a.sr+' SR</b></div>').join('')
      + '</div>'
    : '';
  el('resultBody').innerHTML =
    `<div class="r-head">Raid logged · ${esc(d.name)}</div>
     <div class="r-delta ${dcls}">${dtxt}</div>
     <div class="r-total">New total <b>${d.afterSR.toLocaleString()} SR</b> · <span class="r-place">#${d.place} of ${d.total}</span></div>
     ${achBanner}
     ${banner}`;
  const card = el('resultCard');
  card.className = 'rcard ' + (up?'is-up':down?'is-down':'is-plain');
  el('resultModal').style.display = 'flex';
  void card.offsetWidth;   // restart CSS animations each time
  clearTimeout(resultTimer);
  resultTimer = setTimeout(closeResult, up?7000:4500);
}
function closeResult(){ clearTimeout(resultTimer); el('resultModal').style.display = 'none'; }
function clearForm(keepName){
  if(!keepName) el('playerName').value='';
  el('operatorKills').value=0; el('squadKills').value=0; el('bossKills').value=0; el('contract').value='none';
  ['extracted','weaponCase','fullSquad','finalExfil','ranSquad'].forEach(id=>{ const e=el(id); if(e) e.checked=false; });
  clearProof();
  exfilChoice = null;
  resetKillChips();
  syncSquadGroup();
  updatePreview();
}

/* ============================================================
   Settings actions
   ============================================================ */
/* One-time import: copy everything from the old shared store into Supabase.
   Runs in the browser (which can reach both). Idempotent — re-running just
   re-syncs the same rows by id, so it never creates duplicates. */
async function migrateFromNpoint(){
  if(!confirm('Import all current players, raids and seasons from the old shared store into this database?\n\nSafe to run once. Running it again just re-syncs the same records (no duplicates).')) return;
  showMsg('setMsg','warn','Importing from the old store…');
  setStatus('sync','Importing…');
  try{
    const res = await fetch(OLD_NPOINT_URL, { cache:'no-store' });
    if(!res.ok) throw new Error('old store GET '+res.status);
    const old = normalize(await res.json());
    // If the old store never kept an explicit players list, rebuild it from the raids
    // so everyone keeps the same identity (their new raids attach to their existing history).
    if(!old.players.length){
      const seen = {};
      old.raids.forEach(r=>{ if(r.playerId && !seen[r.playerId]){ seen[r.playerId]=1; old.players.push({ id:r.playerId, name:(r.playerName||'(operator)') }); } });
    }
    if(!sessionUnlocked || !adminToken) throw new Error('Unlock administrator settings before importing');
    if(!await persist(merged=>mergeStates(merged,old))) throw new Error('The application backend rejected the import');
    await pull();
    showMsg('setMsg','ok','Imported '+old.players.length+' players and '+old.raids.length+' raids. You\'re fully on the new database now.');
  }catch(e){
    showMsg('setMsg','err','Import failed: '+e.message);
    setStatus('off','Offline');
  }
}
function updateBackendDesc(){
  el('backendDesc').textContent = 'Connected through the DMZ Ranked application backend. Every raid is stored as its own record, so simultaneous entries cannot overwrite each other.';
}
async function exportBackup(){
  if(!sessionUnlocked || !adminToken){ showMsg('setMsg','err','Unlock administrator settings before downloading a complete backup.'); return; }
  let fullState;
  try{ fullState=await remoteGet(); }
  catch(e){ showMsg('setMsg','err','Could not download a complete backup. Try again in a moment.'); return; }
  const blob = new Blob([JSON.stringify(fullState,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'dmz-leaderboard-backup-'+new Date().toISOString().slice(0,10)+'.json';
  a.click();
}
function importBackup(file){
  const reader = new FileReader();
  reader.onload = async ()=>{
    try{
      const obj = normalize(JSON.parse(reader.result));
      if(!confirm('Restore '+obj.players.length+' players and '+obj.raids.length+' raids? This merges with the current board.')) return;
      await persist(merged=> mergeStates(merged, obj));
      showMsg('setMsg','ok','Backup restored.');
    }catch(e){ showMsg('setMsg','err','Invalid backup file.'); }
  };
  reader.readAsText(file);
}
async function wipeAll(){
  if(!confirm('Erase ALL players and raids for everyone? Download a backup first if unsure.')) return;
  if(!confirm('Really wipe the entire leaderboard? This cannot be undone.')) return;
  // Clear only players + raids; keep the season, Hall of Fame, and admin PIN intact.
  await persist(merged=>{ merged.players = []; merged.raids = []; return merged; });
  showMsg('setMsg','ok','Leaderboard reset (players & raids cleared; seasons and Hall of Fame kept).');
}
/* Batch-clear every raid but KEEP the player roster (and PINs, seasons, Hall of Fame).
   Everyone drops to 0 SR and off the board until they log again — a clean-slate season start. */
async function clearRaids(){
  const n = (state.raids||[]).length;
  if(!confirm('Clear ALL '+n+' raids?\n\nEvery operator resets to 0 SR. Players, PINs, past seasons and the Hall of Fame are kept. This cannot be undone — download a backup first if unsure.')) return;
  if(!confirm('Last check: wipe every logged raid on the board right now?')) return;
  const ok = await persist(merged=>{ merged.raids = []; return merged; });
  if(ok) showMsg('setMsg','ok','All raids cleared — everyone is back to 0. Players kept.');
  else showMsg('setMsg','err','Could not clear raids — try again.');
}

/* ---------- Recently deleted (soft-delete recycle bin, 7-day auto-wipe) ---------- */
function renderRecycle(){
  const box=el('recycleBody'); if(!box) return;
  const now=Date.now();
  const dels=(state.raids||[]).filter(r=> r.deleted).sort((a,b)=> (b.deleted||0)-(a.deleted||0));
  if(!dels.length){ box.innerHTML='<div class="note" style="margin:0">Nothing here right now. Deleted raids show up for 7 days so you can undo a mistake.</div>'; return; }
  box.innerHTML = dels.map(r=>{
    const earned=grossEarned(r);
    const bits=[]; if(r.operatorKills)bits.push(r.operatorKills+' op'); if(r.squadKills)bits.push(r.squadKills+' sq'); if(r.bossKills)bits.push(r.bossKills+' boss'); if(r.extracted)bits.push('exfil'); if(r.weaponCase)bits.push('case');
    const when = r.ts ? new Date(r.ts).toLocaleDateString(undefined,{month:'short',day:'numeric'}) : '';
    const left = Math.max(0, 7 - Math.floor((now-(r.deleted||now))/DAY_MS));
    return `<div class="recyc-row">
      <div class="recyc-main">
        <div class="recyc-name">${esc(r.playerName||'?')} <span class="recyc-sr">+${earned} SR</span></div>
        <div class="recyc-sub">${bits.join(' · ')||'no actions'}${when?' · '+when:''} · <span class="recyc-left">${left} day${left===1?'':'s'} left</span></div>
      </div>
      <div class="recyc-act">
        <button class="btn" style="padding:6px 12px;font-size:12.5px" data-restoreraid="${esc(r.id)}">↩ Restore</button>
        <button class="btn ghost" style="padding:6px 11px;font-size:12.5px" data-purgeraid="${esc(r.id)}">Delete forever</button>
      </div>
    </div>`;
  }).join('');
}
async function purgeOldDeleted(){
  if(saving) return;
  const cutoff = Date.now() - 7*DAY_MS;
  const stale = (state.raids||[]).filter(r=> r.deleted && r.deleted < cutoff);
  if(!stale.length) return;
  await persist(merged=>{ merged.raids = (merged.raids||[]).filter(r=> !(r.deleted && r.deleted < cutoff)); return merged; });
}

/* delegated delete handlers */
document.addEventListener('click', async (e)=>{
  const pv = e.target.getAttribute && e.target.getAttribute('data-proofview');
  if(pv){
    const r=(state.raids||[]).find(x=>x.id===pv);
    if(r && r.proofImg) openImageBox(r.proofImg);
    return;
  }
  const delR = e.target.getAttribute && e.target.getAttribute('data-delraid');
  const delP = e.target.getAttribute && e.target.getAttribute('data-delplayer');
  if(delR){
    if(!confirm('Delete this raid? SR recalculates now — you can restore it from “Recently deleted” in Settings for the next 7 days.')) return;
    await persist(merged=>{ const rr=(merged.raids||[]).find(r=>r.id===delR); if(rr) rr.deleted=Date.now(); return merged; });
    renderRecycle();
  }
  const restoreR = e.target.getAttribute && e.target.getAttribute('data-restoreraid');
  if(restoreR){
    await persist(merged=>{ const rr=(merged.raids||[]).find(r=>r.id===restoreR); if(rr) delete rr.deleted; return merged; });
    renderRecycle(); showMsg('setMsg','ok','Raid restored — standings updated.');
  }
  const purgeR = e.target.getAttribute && e.target.getAttribute('data-purgeraid');
  if(purgeR){
    if(!confirm('Delete this raid forever? This cannot be undone.')) return;
    await persist(merged=>{ merged.raids = (merged.raids||[]).filter(r=>r.id!==purgeR); return merged; });
    renderRecycle();
  }
  if(delP){
    if(!confirm('Remove this player and all their raids?')) return;
    await persist(merged=>{
      merged.players = merged.players.filter(p=>p.id!==delP);
      merged.raids = merged.raids.filter(r=>r.playerId!==delP);
      return merged;
    });
  }
  const delS = e.target.getAttribute && e.target.getAttribute('data-delseason');
  if(delS){
    if(!confirm('Delete this archived season from the Hall of Fame?')) return;
    await persist(merged=>{ merged.pastSeasons = (merged.pastSeasons||[]).filter(s=>s.id!==delS); return merged; });
  }
  const rp = e.target.getAttribute && e.target.getAttribute('data-resetpin');
  if(rp){
    if(!confirm('Reset this player\'s PIN? Their name becomes unprotected until they set a new PIN.')) return;
    await persist(merged=>{ const pl=(merged.players||[]).find(x=>x.id===rp); if(pl) delete pl.pin; return merged; });
    showMsg('setMsg','ok','PIN reset — the player can set a new one on their device.');
  }
  const apv = e.target.getAttribute && e.target.getAttribute('data-approve');
  if(apv){
    await persist(merged=>{
      const r=(merged.raids||[]).find(x=>x.id===apv);
      if(r){
        delete r.pending; delete r.pendingReason;
        const pl=(merged.players||[]).find(x=>x.id===r.playerId); if(pl) pl.trusted = true;   // clears new-operator probation
        r.verified = true; r.verifiedAt = Date.now();     // admin approved → Verified badge on raid history & profile
        if(r.proofImg) delete r.proofImg;                 // discard any stored image; a pasted link stays as audit
      }
      return merged;
    });
    showMsg('modMsg','ok','Approved & verified — it now counts on the board.');
  }
  // ---- community reports ----
  const rpt = e.target.getAttribute && e.target.getAttribute('data-report');
  if(rpt){
    const key='r:'+rpt;
    if(reportedLocally(key)){   // toggle OFF — remove my report
      await persist(merged=>{ const r=(merged.raids||[]).find(x=>x.id===rpt); if(r){ r.reports=Math.max(0,(r.reports||0)-1); if(!r.reports) delete r.reports; } return merged; });
      unmarkReportedLocally(key); markBtnUnreported(e.target);
      showMsg('logMsg','ok','Report removed.');
    } else {                    // toggle ON — report it
      await persist(merged=>{ const r=(merged.raids||[]).find(x=>x.id===rpt); if(r){ r.reports=(r.reports||0)+1; } return merged; });
      markReportedLocally(key); markBtnReported(e.target);
      showMsg('logMsg','ok','Reported — thanks. An admin will review it.');
    }
    return;
  }
  const rptp = e.target.getAttribute && e.target.getAttribute('data-reportp');
  if(rptp){
    const key='p:'+rptp;
    if(reportedLocally(key)){   // toggle OFF — remove my report
      await persist(merged=>{ const pl=(merged.players||[]).find(x=>x.id===rptp); if(pl){ pl.reports=Math.max(0,(pl.reports||0)-1); if(!pl.reports) delete pl.reports; } return merged; });
      unmarkReportedLocally(key); markBtnUnreported(e.target);
      showMsg('logMsg','ok','Report removed.');
    } else {                    // toggle ON — report the operator
      await persist(merged=>{ const pl=(merged.players||[]).find(x=>x.id===rptp); if(pl){ pl.reports=(pl.reports||0)+1; } return merged; });
      markReportedLocally(key); markBtnReported(e.target);
      showMsg('logMsg','ok','Reported — thanks. An admin will review this operator.');
    }
    return;
  }
  const dsr = e.target.getAttribute && e.target.getAttribute('data-dismissreport');
  if(dsr){
    await persist(merged=>{ const r=(merged.raids||[]).find(x=>x.id===dsr); if(r){ delete r.reports; delete r.reportNotes; } return merged; });
    showMsg('modMsg','ok','Report cleared.');
  }
  const dsp = e.target.getAttribute && e.target.getAttribute('data-dismisspreport');
  if(dsp){
    await persist(merged=>{ const pl=(merged.players||[]).find(x=>x.id===dsp); if(pl){ delete pl.reports; delete pl.reportNotes; } return merged; });
    showMsg('modMsg','ok','Report cleared.');
  }
  const vfy = e.target.getAttribute && e.target.getAttribute('data-verify');
  if(vfy){
    await persist(merged=>{ const r=(merged.raids||[]).find(x=>x.id===vfy); if(r){ r.verified=true; r.verifiedAt=Date.now(); delete r.proofImg; } return merged; });
    showMsg('modMsg','ok','Verified ✓ — the image was discarded.');
  }
  const unp = e.target.getAttribute && e.target.getAttribute('data-unproof');
  if(unp){
    await persist(merged=>{ const r=(merged.raids||[]).find(x=>x.id===unp); if(r){ delete r.proofImg; delete r.proofUrl; } return merged; });
    showMsg('modMsg','ok','Proof dismissed — the raid stays, without a ✓.');
  }
  const rej = e.target.getAttribute && e.target.getAttribute('data-reject');
  if(rej){
    if(!confirm('Reject and delete this raid? If it was the player\'s only entry, the player is removed too.')) return;
    await persist(merged=>{
      const r=(merged.raids||[]).find(x=>x.id===rej);
      merged.raids = (merged.raids||[]).filter(x=>x.id!==rej);
      if(r){ const others=(merged.raids||[]).some(x=>x.playerId===r.playerId); if(!others) merged.players=(merged.players||[]).filter(p=>p.id!==r.playerId); }
      return merged;
    });
    showMsg('modMsg','ok','Rejected and removed.');
  }
});

/* ---------- Moderation settings + pending-approval queue ---------- */
function renderModeration(){
  const f = currentFilter();
  const pw = el('pinWarn'); if(pw) pw.style.display = adminPinIsSet() ? 'none' : 'block';
  const fe = el('filterEnabled'); if(fe) fe.checked = f.enabled!==false;
  const fw = el('filterWords'); if(fw && document.activeElement!==fw) fw.value = (f.words||[]).join(', ');
  const fo = el('filterOpk'); if(fo && document.activeElement!==fo) fo.value = f.opk;
  const fn = el('filterEarn'); if(fn && document.activeElement!==fn) fn.value = f.earn;
  const fv = el('filterVelo'); if(fv) fv.checked = f.velo!==false;
  const fvm = el('filterVeloMin'); if(fvm && document.activeElement!==fvm) fvm.value = f.veloMin;
  const fvx = el('filterVeloMax'); if(fvx && document.activeElement!==fvx) fvx.value = f.veloMax;
  const fmg = el('filterMinGap'); if(fmg && document.activeElement!==fmg) fmg.value = f.minGap;
  const fpm = el('filterProofMin'); if(fpm && document.activeElement!==fpm) fpm.value = f.proofMinKills;
  { const du=el('donateUrl'); if(du && document.activeElement!==du) du.value = (state.donate&&state.donate.url)||'';
    const dl=el('donateLabel'); if(dl && document.activeElement!==dl) dl.value = (state.donate&&state.donate.label)||''; }
  const fp = el('filterProbFactor'); if(fp && document.activeElement!==fp) fp.value = f.probFactor;
  renderPending();
  renderProofQueue();
  renderReports();
  renderAnomaly();
  renderPollAdmin();
  renderSeasonSchedule();
}
function renderPending(){
  const box = el('pendingBody'); if(!box) return;
  const pend = (state.raids||[]).filter(r=>r.pending && !r.deleted).sort((a,b)=>(b.ts||0)-(a.ts||0));
  const cnt = el('pendCount'); if(cnt) cnt.textContent = pend.length ? '('+pend.length+')' : '';
  if(!pend.length){ box.innerHTML='<div class="note" style="margin:0">Nothing waiting. Unusually high raids will show up here for a quick yes/no.</div>'; return; }
  box.innerHTML = pend.map(r=>{
    const earned = grossEarned(r);
    const bits=[]; if(r.operatorKills)bits.push(r.operatorKills+' op'); if(r.squadKills)bits.push(r.squadKills+' sq'); if(r.bossKills)bits.push(r.bossKills+' boss'); if(r.contract&&r.contract!=='none')bits.push(r.contract); if(r.extracted)bits.push('exfil');
    return `<div class="hrow">
      <div><div class="det" style="color:var(--txt);font-weight:700">${esc(r.playerName||'?')} · <span style="color:var(--gold-b)">+${earned} SR</span></div>
      <div class="det">${bits.join(' · ')||'no actions'} · ${new Date(r.ts||0).toLocaleString()}${r.pendingReason?' · <span style="color:#e79">flagged: '+esc(r.pendingReason)+'</span>':''}</div>
      ${proofBlock(r)}</div>
      <div style="white-space:nowrap;display:flex;gap:6px;align-items:center">
        <button class="btn" style="padding:6px 12px;font-size:13px" data-approve="${esc(r.id)}">${(r.proofImg||r.proofUrl)?'Approve ✓':'Approve'}</button>
        <button class="del-x" title="Reject &amp; delete" data-reject="${esc(r.id)}">✕</button>
      </div></div>`;
  }).join('');
}
/* Small proof preview (image thumb + link) used in the moderation queues. */
function proofBlock(r){
  if(!r.proofImg && !r.proofUrl) return '';
  const img = r.proofImg ? `<img class="proof-thumb" src="${r.proofImg}" alt="proof" data-proofview="${esc(r.id)}" title="Click to enlarge">` : '';
  const link = r.proofUrl ? `<a class="proof-link" href="${esc(r.proofUrl)}" target="_blank" rel="noopener">↗ open clip / screenshot link</a>` : '';
  return `<div class="proof-mod">${img}${link}</div>`;
}
/* Fullscreen image viewer for proof screenshots (no new tab / blank page). */
function openImageBox(src){
  if(!src) return;
  const old = document.querySelector('.imgbox'); if(old) old.remove();
  const box = document.createElement('div');
  box.className = 'imgbox';
  box.innerHTML = `<button class="imgbox-x" aria-label="Close">✕</button><img src="${src}" alt="proof"><div class="imgbox-hint">Click anywhere to close</div>`;
  const close = ()=>{ box.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = ev=>{ if(ev.key==='Escape') close(); };
  box.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(box);
}
/* Raids that carry proof but aren't held (they count already) — admin can stamp them Verified. */
function renderProofQueue(){
  const box = el('proofBody'); if(!box) return;
  const list = (state.raids||[]).filter(r=> (r.proofImg||r.proofUrl) && !r.verified && !r.pending && !r.deleted).sort((a,b)=>(b.ts||0)-(a.ts||0));
  const cnt = el('proofCount'); if(cnt) cnt.textContent = list.length ? '('+list.length+')' : '';
  if(!list.length){ box.innerHTML='<div class="note" style="margin:0">Nothing to verify. When someone attaches a clip or screenshot to a run, it shows here for a ✓.</div>'; return; }
  box.innerHTML = list.map(r=>{
    const earned = grossEarned(r);
    return `<div class="hrow">
      <div><div class="det" style="color:var(--txt);font-weight:700">${esc(r.playerName||'?')} · <span style="color:var(--gold-b)">+${earned} SR</span> · ${r.operatorKills||0} op</div>
      <div class="det">${new Date(r.ts||0).toLocaleString()}</div>
      ${proofBlock(r)}</div>
      <div style="white-space:nowrap;display:flex;gap:6px;align-items:center">
        <button class="btn" style="padding:6px 12px;font-size:13px" data-verify="${esc(r.id)}">✓ Verify</button>
        <button class="del-x" title="Dismiss proof (leaves the raid, no ✓)" data-unproof="${esc(r.id)}">✕</button>
      </div></div>`;
  }).join('');
}
/* Community-reported raids + operators, surfaced for the admin. */
function renderReports(){
  const box = el('reportBody'); if(!box) return;
  const rRaids = (state.raids||[]).filter(r=> (r.reports||0)>0 && !r.deleted).sort((a,b)=>(b.reports||0)-(a.reports||0));
  const rPlayers = (state.players||[]).filter(p=> (p.reports||0)>0).sort((a,b)=>(b.reports||0)-(a.reports||0));
  const cnt = el('reportCount'); if(cnt) cnt.textContent = (rRaids.length+rPlayers.length) ? '('+(rRaids.length+rPlayers.length)+')' : '';
  if(!rRaids.length && !rPlayers.length){ box.innerHTML='<div class="note" style="margin:0">No reports. Anyone can flag a raid or operator from their profile — flags land here.</div>'; return; }
  const pl = rPlayers.map(p=>{
    const st = computeStandings().find(x=>x.id===p.id);
    return `<div class="hrow">
      <div><div class="det" style="color:var(--txt);font-weight:700">${esc(p.name)} <span class="rep-badge">⚑ ${p.reports} report${p.reports>1?'s':''}</span></div>
      <div class="det">operator flagged${st?' · '+st.sr.toLocaleString()+' SR ('+st.tier+')':''}</div></div>
      <div style="white-space:nowrap;display:flex;gap:6px;align-items:center">
        <button class="btn ghost" style="padding:6px 10px;font-size:12.5px" data-profile="${esc(p.id)}">View</button>
        <button class="btn" style="padding:6px 10px;font-size:12.5px" data-dismisspreport="${esc(p.id)}">Dismiss</button>
        <button class="del-x" title="Remove operator + raids" data-delplayer="${esc(p.id)}">✕</button>
      </div></div>`;
  }).join('');
  const rd = rRaids.map(r=>{
    const earned = grossEarned(r);
    const bits=[]; if(r.operatorKills)bits.push(r.operatorKills+' op'); if(r.squadKills)bits.push(r.squadKills+' sq'); if(r.extracted)bits.push('exfil');
    return `<div class="hrow">
      <div><div class="det" style="color:var(--txt);font-weight:700">${esc(r.playerName||'?')} <span class="rep-badge">⚑ ${r.reports} report${r.reports>1?'s':''}</span></div>
      <div class="det">${bits.join(' · ')||'no actions'} · +${earned} SR · ${new Date(r.ts||0).toLocaleString()}</div>
      ${proofBlock(r)}</div>
      <div style="white-space:nowrap;display:flex;gap:6px;align-items:center">
        <button class="btn" style="padding:6px 10px;font-size:12.5px" data-dismissreport="${esc(r.id)}">Dismiss</button>
        <button class="del-x" title="Reject &amp; delete raid" data-reject="${esc(r.id)}">✕</button>
      </div></div>`;
  }).join('');
  box.innerHTML = (pl?('<div class="rep-sub">Operators</div>'+pl):'') + (rd?('<div class="rep-sub">Raids</div>'+rd):'');
}
/* ============================================================
   Integrity radar — score operators on how hard their LOGGED raids are to explain.
   The heavy weight is "loaded raids": a single raid that stacks 3+ rare objectives
   (weapon case + a boss + final exfil + 15-kill game). On a contested 60-player map each
   of those is hard alone; stacking them repeatedly, or logging raids impossibly fast, is
   the real cheat/fabrication fingerprint. Small samples are excluded so a couple of hot
   games can't flag anyone. This is a signal to check footage — never an automatic verdict.
   ============================================================ */
function raidRareCount(r){ return (r.weaponCase?1:0)+((r.bossKills||0)>=1?1:0)+(r.finalExfil?1:0)+((r.operatorKills||0)>=15?1:0); }
function computeAnomalies(){
  const raids=(state.raids||[]).filter(r=>!r.deleted && !r.pending);
  const MIN=8;
  return (state.players||[]).map(p=>{
    const rs=raids.filter(r=> r.playerId===p.id && r.carryover==null);
    if(rs.length<MIN) return null;
    const n=rs.length;
    const loaded=rs.filter(r=>raidRareCount(r)>=3).length;
    const sup=rs.filter(r=>raidRareCount(r)>=4 || (r.weaponCase&&(r.bossKills||0)>=1&&r.finalExfil&&(r.operatorKills||0)>=20)).length;
    const caseN=rs.filter(r=>r.weaponCase).length, finalN=rs.filter(r=>r.finalExfil).length;
    const sorted=rs.slice().sort((a,b)=>(a.ts||0)-(b.ts||0));
    let fast=0; for(let i=1;i<sorted.length;i++){ if(((sorted[i].ts-sorted[i-1].ts)/1000)<90) fast++; }
    let win=1; for(let i=0;i<sorted.length;i++){ let c=1; for(let j=i+1;j<sorted.length;j++){ if(((sorted[j].ts||0)-(sorted[i].ts||0))<=600000)c++; else break; } if(c>win)win=c; }
    const loadedRate=loaded/n, caseRate=caseN/n, finalRate=finalN/n;
    const reasons=[];
    if(loaded) reasons.push(loaded+' of '+n+' raids stacked 3+ rare objectives ('+Math.round(loadedRate*100)+'%)');
    if(sup) reasons.push(sup+' near-impossible raid'+(sup>1?'s':'')+' — weapon case + boss + final exfil + a 20-kill game, all in one');
    if(caseN>=6 && caseRate>0.30) reasons.push('grabbed the weapon case in '+caseN+' of '+n+' raids ('+Math.round(caseRate*100)+'%)');
    if(finalN>=6 && finalRate>0.30) reasons.push('reached final exfil in '+finalN+' of '+n+' raids ('+Math.round(finalRate*100)+'%)');
    if(win>=5) reasons.push(win+' raids logged inside a 10-minute window');
    else if(fast>=2) reasons.push(fast+' raids logged under 90 seconds apart');
    const score=Math.round(loadedRate*50 + sup*12 + (caseN>=6&&caseRate>0.30?12:0) + (finalN>=6&&finalRate>0.30?10:0) + fast*6 + (win>=5?(win-4)*8:(win>=4?4:0)));
    return { id:p.id, name:p.name, n, score, reasons };
  }).filter(r=> r && r.score>=12 && r.reasons.length).sort((a,b)=>b.score-a.score);
}
function renderAnomaly(){
  const box=el('anomalyBody'); if(!box) return;
  const rows=computeAnomalies().slice(0,12);
  const cnt=el('anomalyCount'); if(cnt) cnt.textContent = rows.length ? '('+rows.length+')' : '';
  if(!rows.length){ box.innerHTML='<div class="note" style="margin:0">Nothing standing out — no one’s logging pattern looks statistically off right now. (Operators need 8+ raids to be scored.)</div>'; return; }
  box.innerHTML = rows.map(r=>{
    const lvl = r.score>=30?'high':(r.score>=18?'med':'low');
    return `<div class="anom-row">
      <div class="anom-head">
        <span class="anom-score ${lvl}">${r.score}</span>
        <span class="anom-name">${esc(r.name)}</span>
        <span class="anom-n">${r.n} raids</span>
        <button class="btn ghost" style="padding:5px 10px;font-size:12px;margin-left:auto" data-profile="${esc(r.id)}">View</button>
      </div>
      <ul class="anom-reasons">${r.reasons.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul>
    </div>`;
  }).join('');
}
function saveFilter(){
  const enabled = el('filterEnabled').checked;
  const words = el('filterWords').value.split(/[\n,]+/).map(s=>s.trim().toLowerCase()).filter(Boolean);
  const opk = Math.max(0, parseInt(el('filterOpk').value)||0);
  const earn = Math.max(0, parseInt(el('filterEarn').value)||0);
  const velo = el('filterVelo').checked;
  const veloMin = Math.max(0, parseInt(el('filterVeloMin').value)||0);
  const veloMax = Math.max(0, parseInt(el('filterVeloMax').value)||0);
  const minGap = Math.max(0, parseInt(el('filterMinGap').value)||0);
  const proofMinKills = Math.max(0, parseInt(el('filterProofMin').value)||0);
  const probFactor = Math.max(0, Math.min(20, parseFloat(el('filterProbFactor').value)||0));
  persist(merged=>{ merged.filter = { enabled, words, opk, earn, velo, veloMin, veloMax, minGap, proofMinKills, probFactor }; return merged; })
    .then(ok=>{ if(ok) showMsg('modMsg','ok','Moderation settings saved for everyone.'); });
}
function saveDonate(){
  const url = (el('donateUrl').value||'').trim();
  const label = (el('donateLabel').value||'').trim();
  if(url && !/^https?:\/\//i.test(url)){ showMsg('donateMsg','err','Link must start with http:// or https://'); return; }
  persist(merged=>{ merged.donate = { url, label }; return merged; })
    .then(ok=>{ if(ok) showMsg('donateMsg','ok', url ? 'Saved — the ☕ Support button is now live in the header for everyone.' : 'Saved — the Support button is hidden.'); });
}

/* ============================================================
   Helpers + UI wiring
   ============================================================ */
function uid(){ return 'x'+Date.now().toString(36)+Math.floor(Math.random()*1e6).toString(36); }
function setStatus(kind,text){
  const d = el('dot'); d.className = 'dot ' + (kind==='on'?'on':kind==='sync'?'sync':'off');
  el('statusText').textContent = text;
}
function markSynced(){ el('syncInfo').textContent = 'Synced '+new Date().toLocaleTimeString(); }
let msgTimers = {};
function showMsg(id,kind,text){
  const m = el(id); m.className='msg show '+kind; m.textContent=text;
  clearTimeout(msgTimers[id]);
  if(kind==='ok'||kind==='warn') msgTimers[id]=setTimeout(()=>{ m.className='msg'; }, 6000);
}
/* Persistent (non-timed) "your raid is under review" notice on the Log screen, so a held
   player understands what happened and doesn't keep re-submitting the same raid. */
function showHoldNotice(reason){
  const m = el('logMsg'); if(!m) return;
  clearTimeout(msgTimers['logMsg']);
  m.className = 'msg show warn hold-notice';
  m.innerHTML = '<b>This raid is under review.</b> It exceeded the board’s limits ('+esc(reason)+'), so an admin needs to approve it first. '
    + 'If approved, it’ll show on your raid history and count toward your SR. '
    + 'To check the status of this raid, open the <b>Community → Under Review</b> tab.';
}
let bannerDismissed = false;
function showBanner(kind, html){
  if(bannerDismissed) return;
  const b = el('banner');
  b.className = 'banner show ' + (kind||'');
  b.innerHTML = '<span class="bx" id="banX">✕</span>' + html;
  const x = document.getElementById('banX');
  if(x) x.onclick = ()=>{ bannerDismissed = true; hideBanner(); };
}
function hideBanner(){ el('banner').className = 'banner'; }
function classifyErr(e){
  const s = String(e && (e.message||e));
  if(s.includes('403') || s.includes('not activated') || s.includes('verified')) return 'activate';
  if(s.includes('Failed to fetch') || s.includes('NetworkError') || s.includes('fetch')) return 'network';
  return 'other';
}
function bannerForError(kind){
  if(kind==='activate'){
    showBanner('err', '<b>Saving is off until you activate the store (one-time).</b> Open <b>Settings</b> for the 3-step activation, or paste a Firebase URL there.');
  } else if(kind==='network'){
    showBanner('err', '<b>Can\'t reach the sync store.</b> Live sync needs this page open in a real browser tab or hosted link — not an in-app preview pane. If you\'re already in a browser, check your connection or see <b>Settings</b>.');
  } else {
    showBanner('err', '<b>Sync problem.</b> See <b>Settings</b> to check the backend, or download a backup.');
  }
}

function initTabs(){
  document.querySelectorAll('[data-tab]').forEach(b=>{   // includes the header gear (data-tab="settings")
    b.addEventListener('click', ()=>{
      const tab = b.dataset.tab;
      if(currentTab==='settings' && tab!=='settings') autoLock();   // leaving Settings re-locks it
      document.querySelectorAll('[data-tab]').forEach(x=>x.classList.remove('active'));
      document.querySelectorAll('section').forEach(s=>s.classList.remove('active'));
      b.classList.add('active');
      el(tab).classList.add('active');
      currentTab = tab;
      if(tab==='log') updatePreview();
      if(tab==='updates') markUpdatesSeen();       // opening the tab clears the "new" dot on this device
      if(tab==='community') showSub(currentSub);   // restore the last-open community sub-view
      if(tab==='settings'){ computeUnlocked(); refreshSettingsLock(); armIdle(); }
    });
  });
  // reset the idle auto-lock timer on any interaction while unlocked in Settings
  ['click','keydown'].forEach(ev=> document.addEventListener(ev, ()=>{
    if(currentTab==='settings' && settingsUnlocked) armIdle();
  }));
}

/* Quick-tap kill chips: tap the number that matches your kills instead of typing.
   The chips just drive the underlying number inputs, so all scoring/preview/caps
   logic stays exactly the same. Operator kills has a "15+" chip that reveals a
   type-in field for the rare big run. */
function syncChips(box){
  const input = el(box.getAttribute('data-target'));
  const max = parseInt(box.getAttribute('data-max')) || 10;
  const hasMore = !!box.querySelector('.kc.more');
  let v = parseInt(input.value) || 0;
  if(v > max && hasMore) input.classList.remove('hide');   // big count → keep the type-in visible
  const typing = !input.classList.contains('hide');
  box.querySelectorAll('.kc').forEach(b=>{
    if(b.classList.contains('more')) b.classList.toggle('on', typing);
    else b.classList.toggle('on', !typing && v<=max && String(v)===b.getAttribute('data-v'));
  });
}
function buildKillChips(){
  document.querySelectorAll('.killchips').forEach(box=>{
    const targ = box.getAttribute('data-target');
    const max = parseInt(box.getAttribute('data-max')) || 10;
    const hasMore = box.getAttribute('data-more')==='1';
    const input = el(targ);
    let html='';
    for(let i=0;i<=max;i++) html += `<button type="button" class="kc" data-v="${i}">${i}</button>`;
    if(hasMore) html += `<button type="button" class="kc more" data-more="1">${max}+</button>`;
    box.innerHTML = html;
    box.querySelectorAll('.kc').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        if(btn.getAttribute('data-more')){                 // reveal the type-in for a higher count
          input.classList.remove('hide');
          if(!(parseInt(input.value)>max)) input.value = max+1;
          input.focus(); input.select && input.select();
          input.dispatchEvent(new Event('input',{bubbles:true}));
          return;
        }
        input.classList.add('hide');
        input.value = btn.getAttribute('data-v');
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.dispatchEvent(new Event('change',{bubbles:true}));
      });
    });
    input.addEventListener('input', ()=> syncChips(box));
    syncChips(box);
  });
}
function resetKillChips(){
  document.querySelectorAll('input.kill-type').forEach(i=> i.classList.add('hide'));
  document.querySelectorAll('.killchips').forEach(syncChips);
}
/* Solo vs squad: when "ran with a squad" is off, dim + zero out squadmate kills
   (you can't have squadmate kills solo), and light it back up when it's on. */
function syncSquadGroup(){
  const rs = el('ranSquad'); if(!rs) return;
  const grp = document.getElementById('squadGroup'); if(!grp) return;
  if(rs.checked){ grp.classList.remove('solo'); }
  else {
    grp.classList.add('solo');
    const sk = el('squadKills');
    if(sk && (parseInt(sk.value)||0) !== 0){
      sk.value = 0;
      sk.classList.add('hide');
      sk.dispatchEvent(new Event('input',{bubbles:true}));
    }
  }
}
function initForm(){
  buildKillChips();
  if(el('ranSquad')){ el('ranSquad').addEventListener('change', ()=>{ syncSquadGroup(); updatePreview(); }); syncSquadGroup(); }
  ['operatorKills','squadKills','bossKills','contract','playerName'].forEach(id=>{
    el(id).addEventListener('input', updatePreview);
    el(id).addEventListener('change', updatePreview);
  });
  ['weaponCase','fullSquad','finalExfil'].forEach(id=>el(id).addEventListener('change', updatePreview));
  el('squadKills').addEventListener('input', ()=>{ if((parseInt(el('squadKills').value)||0) > 10) el('squadKills').value = 10; });   // cap at 10
  el('bossKills').addEventListener('input', ()=>{ if((parseInt(el('bossKills').value)||0) > 2) el('bossKills').value = 2; });        // cap at 2
  document.querySelectorAll('#exfilSeg .seg-btn').forEach(btn=>{
    btn.addEventListener('click', ()=> setExfil(btn.getAttribute('data-exfil')));
  });
  el('playerPick').addEventListener('change', function(){
    if(this.value){ el('playerName').value = this.value; updatePreview(); }
  });
  el('submitRaid').addEventListener('click', submitRaid);
  el('resetForm').addEventListener('click', ()=>clearForm(false));
  if(el('boardSearch')) el('boardSearch').addEventListener('input', applyBoardFilter);
  if(el('proofImg')) el('proofImg').addEventListener('change', onProofFile);
  document.addEventListener('click', e=>{ if(e.target && e.target.id==='proofClear'){ e.preventDefault(); clearProof(); } });
  el('unlockBtn').addEventListener('click', unlockName);
  el('namePin').addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); unlockName(); } });
  el('savePinBtn').addEventListener('click', saveSetPin);
  el('cancelPinBtn').addEventListener('click', cancelSetPin);
  el('newPin2').addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); saveSetPin(); } });
  const myname = lsGet('dmz_myname'); if(myname) el('playerName').value = myname;
}

function initSettings(){
  el('migrateBtn').addEventListener('click', migrateFromNpoint);
  el('refreshNow').addEventListener('click', ()=>{ pull(); showMsg('setMsg','ok','Refreshed.'); });
  el('exportBtn').addEventListener('click', exportBackup);
  el('importFile').addEventListener('change', e=>{ if(e.target.files[0]) importBackup(e.target.files[0]); });
  el('wipeBtn').addEventListener('click', wipeAll);
  if(el('clearRaidsBtn')) el('clearRaidsBtn').addEventListener('click', clearRaids);
  el('saveSeason').addEventListener('click', saveSeason);
  el('archiveSeason').addEventListener('click', archiveSeason);
  if(el('saveSeasonCfg')) el('saveSeasonCfg').addEventListener('click', saveSeasonCfg);
  el('importPlayersBtn').addEventListener('click', importPlayers);
  el('pinUnlock').addEventListener('click', tryUnlock);
  el('pinEntry').addEventListener('keydown', e=>{ if(e.key==='Enter') tryUnlock(); });
  el('saveFilter').addEventListener('click', saveFilter);
  { const sd=el('saveDonate'); if(sd) sd.addEventListener('click', saveDonate); }
  computeUnlocked(); refreshSettingsLock();
  fillSeasonInputs();
  updateBackendDesc();
}

const WHATSNEW_PAGES = ["/assets/legacy/leaderboard-083-9f1a0b8da3ae.webp","/assets/legacy/leaderboard-084-74123748b639.webp","/assets/legacy/leaderboard-085-f62dcdbcf8db.webp","/assets/legacy/leaderboard-086-09e66e8dcfc2.webp","/assets/legacy/leaderboard-087-cecb5ade1175.webp","/assets/legacy/leaderboard-088-e7f75bbcca59.webp","/assets/legacy/leaderboard-089-bef760fd8838.webp","/assets/legacy/leaderboard-090-1bfe11c63e83.webp"];
function buildWhatsNew(){
  if(document.getElementById('wnOverlay')) return;
  const ov=document.createElement('div'); ov.id='wnOverlay'; ov.className='wn-overlay';
  ov.innerHTML='<div class="wn-top"><span class="wn-ttl">◆ Season 2 · What\'s New</span><button class="wn-x" id="wnX">✕ Close</button></div>'+
    '<div class="wn-scroll" id="wnScroll">'+WHATSNEW_PAGES.map(u=>'<img class="wn-page" src="'+u+'" alt="">').join('')+
    '<button class="wn-done" id="wnDone">Let\'s go →</button></div>';
  document.body.appendChild(ov);
  ov.querySelector('#wnX').onclick=closeWhatsNew;
  ov.querySelector('#wnDone').onclick=closeWhatsNew;
}
function openWhatsNew(){ buildWhatsNew(); const ov=document.getElementById('wnOverlay'); if(ov){ ov.style.display='flex'; const s=document.getElementById('wnScroll'); if(s) s.scrollTop=0; document.body.style.overflow='hidden'; } }
function closeWhatsNew(){ const ov=document.getElementById('wnOverlay'); if(ov) ov.style.display='none'; document.body.style.overflow=''; }
function maybeWhatsNew(){ if(typeof WHATSNEW_PAGES==='undefined'||!WHATSNEW_PAGES.length) return; if(seasonNumber()<2) return; if(lsGet('dmz_seen_whatsnew_s2')==='1') return; openWhatsNew(); lsSet('dmz_seen_whatsnew_s2','1'); }

/* ---------- Changelog popup: on refresh, show the newest changelog entries once,
   so players know we shipped changes. Reuses the What's-New overlay styling. It
   auto-fires whenever the newest changelog version is higher than the one this
   device last acknowledged, and can be dismissed (X / Got it / tap outside). ---------- */
function clPopupSeenV(){ return parseInt(lsGet('dmz_clpop_seen')||'0',10) || 0; }
function markClPopupSeen(){ lsSet('dmz_clpop_seen', String(newestChangelogV())); }
function buildChangelogPopup(entries){
  let ov = document.getElementById('clOverlay');
  if(!ov){ ov = document.createElement('div'); ov.id='clOverlay'; ov.className='wn-overlay'; document.body.appendChild(ov); }
  ov.innerHTML =
    '<div class="wn-top"><span class="wn-ttl">◆ What’s New</span><button class="wn-x" id="clX">✕ Close</button></div>'+
    '<div class="wn-scroll" id="clScroll">'+
      '<div class="cl-pop-lead">Here’s what changed since your last visit — tap outside or hit close to jump back in.</div>'+
      '<div class="cl-pop-wrap">'+entries.map(changelogCardHTML).join('')+'</div>'+
      '<button class="wn-done" id="clDone">Got it →</button>'+
    '</div>';
  const done = ()=>closeChangelogPopup();
  ov.querySelector('#clX').onclick = done;
  ov.querySelector('#clDone').onclick = done;
  ov.onclick = e=>{ if(e.target===ov) done(); };   // tap the backdrop to dismiss
}
function closeChangelogPopup(){ const ov=document.getElementById('clOverlay'); if(ov) ov.style.display='none'; document.body.style.overflow=''; markClPopupSeen(); updatesDotState(); }
function maybeChangelogPopup(){
  // First run on this device: baseline to the previous version, so the popup shows just the
  // newest entry (not the whole history) on its first appearance. NOTE: deliberately NOT tied
  // to the Updates-tab "seen" marker — opening the changelog tab must not suppress this popup.
  if(lsGet('dmz_clpop_seen')==null){
    lsSet('dmz_clpop_seen', String(newestChangelogV()-1));
  }
  if(newestChangelogV() <= clPopupSeenV()) return;                 // nothing new since last acknowledged
  const wn=document.getElementById('wnOverlay');                  // don't stack on the Season 2 popup
  if(wn && getComputedStyle(wn).display!=='none'){ return; }
  const seen = clPopupSeenV();
  const entries = CHANGELOG.slice().sort((a,b)=>b.v-a.v).filter(c=>c.v>seen).slice(0,4);
  if(!entries.length){ markClPopupSeen(); return; }
  buildChangelogPopup(entries);
  const ov=document.getElementById('clOverlay');
  if(ov){ ov.style.display='flex'; const s=document.getElementById('clScroll'); if(s) s.scrollTop=0; document.body.style.overflow='hidden'; }
  markClPopupSeen();   // mark seen as soon as it's shown, so it's one-and-done even if they
                       // close the tab without tapping dismiss — never re-shows until the next version
}

async function boot(){
  initTabs(); initForm(); initSettings(); initProfile(); initLeaders(); initPolls(); initPollAdmin(); initSuggestions(); initSetTabs();
  renderUpdates(); updatesDotState();
  // Supabase accepts saves from anywhere, so a local file works too — this is just a sharing nudge.
  if(location.protocol === 'file:'){
    showBanner('', '<b>You\'re opening the local file.</b> Everything works, but to share one live board with your squad, host it once — drag it onto <a href="https://app.netlify.com/drop" target="_blank" rel="noopener">app.netlify.com/drop</a> — and send everyone that link.');
  }
  setStatus('sync','Connecting…');
  await pull();
  computeUnlocked(); refreshSettingsLock();
  fillSeasonInputs();
  updatePreview();
  maybeSnapshot();   // set/refresh this week's Monday movement baseline
  await maybeRolloverSeason();   // auto-start/stop seasons on schedule
  maybeSeasonPopup();
  maybeWhatsNew();
  maybeChangelogPopup();         // one-time "what's new" popup when the changelog version bumps
  purgeOldDeleted();             // clear recycle-bin raids older than 7 days            // announce a new season once per device
  { const pb=el('prBtn'); if(pb) pb.addEventListener('click', downloadPowerRankings); }
  if(pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async ()=>{ await pull(); await maybeRolloverSeason(); maybeSeasonPopup(); purgeOldDeleted(); }, 45000);
  setInterval(tickSeasonCountdown, 1000);   // live season countdown
}
boot();
