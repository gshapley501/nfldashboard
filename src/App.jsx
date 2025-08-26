//fix this

import React, { useEffect, useMemo, useRef, useState } from "react";

/** Endpoint helpers (proxied) */
// Convert /espn* into /api/proxy?soft=1&u=<encoded>&h=<ttl>
function _ttlForEspnUrl(espnUrl){
  try{
    const u = new URL(espnUrl);
    if(u.pathname.includes('/scoreboard')){
      const d = u.searchParams.get('dates');
      if(d && /^\d{8}$/.test(d)){
        const Y=+d.slice(0,4), M=+d.slice(4,6)-1, D=+d.slice(6,8);
        const day = new Date(Date.UTC(Y,M,D));
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const diff = Math.floor((day - start)/86400000);
        if (diff < -1) return 86400; // 1 day (past)
        if (diff === -1) return 300; // 5 min (yesterday)
        if (diff === 0) return 30;   // 30s   (todayP
        return 60;                  // 60s future
      }
      return 600;
    }
  }catch{}
  return 60;
}
function proxify(u){
  if(typeof u !== 'string') return u;
  if(u.startsWith('/espn/')){
    const tail = u.replace(/^\/espn/, '');
    const espn = 'https://site.api.espn.com' + tail;
    const h = _ttlForEspnUrl(espn);
    return `/api/proxy?soft=1&h=${h}&u=${encodeURIComponent(espn)}`;
  }
  if(u.startsWith('/espn-site/')){
    const tail = u.replace(/^\/espn-site/, '');
    const espn = 'https://site.api.espn.com' + tail;
    const h = _ttlForEspnUrl(espn);
    return `/api/proxy?soft=1&h=${h}&u=${encodeURIComponent(espn)}`;
  }
  return u;
}

const scoreboardUrlsForDate = (iso) => {
  const d = yyyymmdd(iso);
  const q = `dates=${d}&region=us&lang=en`;
  return [
    `/espn/apis/site/v2/sports/football/nfl/scoreboard?${q}`,
    `/espn/apis/v2/sports/football/nfl/scoreboard?${q}`,
    `/espn-site/apis/site/v2/sports/football/nfl/scoreboard?${q}`,
  ];
};
const scoreboardUrlsForWeek = (season, week) => {
  const q1 = `seasontype=2&week=${week}&region=us&lang=en`;
  const q2 = `season=${season}&seasontype=2&week=${week}&region=us&lang=en`;
  return [
    `/espn/apis/site/v2/sports/football/nfl/scoreboard?${q2}`,
    `/espn/apis/site/v2/sports/football/nfl/scoreboard?${q1}`,
    `/espn/apis/v2/sports/football/nfl/scoreboard?${q2}`,
    `/espn/apis/v2/sports/football/nfl/scoreboard?${q1}`,
    `/espn-site/apis/site/v2/sports/football/nfl/scoreboard?${q2}`,
    `/espn-site/apis/site/v2/sports/football/nfl/scoreboard?${q1}`,
  ];
};

/* Utils */
const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const parseDate = (iso) => { const [y,m,day]=iso.split("-").map(Number); return new Date(y,m-1,day); };
const addDays = (iso, delta) => { const d=parseDate(iso); d.setDate(d.getDate()+delta); return fmtDate(d); };
const yyyymmdd = (iso) => iso.replaceAll("-","");
const prettyTime = (isoString, tz = Intl.DateTimeFormat().resolvedOptions().timeZone) => {
  try { return new Intl.DateTimeFormat(undefined,{timeZone:tz,hour:"numeric",minute:"2-digit"}).format(new Date(isoString)); } catch { return ""; }
};
function startOfWeekISO(iso, weekStartsOn = 0) {
  const d=parseDate(iso); const day=d.getDay();
  const diff = day < weekStartsOn ? 7 - (weekStartsOn - day) : day - weekStartsOn;
  d.setDate(d.getDate()-diff); return fmtDate(d);
}
function range7(isoStart){ const a=[]; for(let i=0;i<7;i++) a.push(addDays(isoStart,i)); return a; }

/* Fonts */
const FONT_STACK = `Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans, Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol`;

/* UI bits */
function Pill({ children, tone = "default" }) {
  const tones = { default:{bg:"#fff",bd:"#e2e8f0",fg:"#0f172a"}, good:{bg:"#ecfdf5",bd:"#a7f3d0",fg:"#065f46"}, warn:{bg:"#fffbeb",bd:"#fde68a",fg:"#92400e"}, bad:{bg:"#fef2f2",bd:"#fecaca",fg:"#991b1b"} };
  const t = tones[tone] || tones.default;
  return <span style={{display:"inline-flex",alignItems:"center",gap:6,padding:"2px 8px",borderRadius:999,border:`1px solid ${t.bd}`,background:t.bg,color:t.fg,fontSize:12}}>{children}</span>;
}
function RoleTag({ role }) { return <span style={{fontSize:12}}>{role==="home"?"🏠 HOME":"🚌 AWAY"}</span>; }

/** Fallback logo helper (ESPN CDN pattern) */
function fallbackLogoForAbbr(abbr){ return abbr ? `https://a.espncdn.com/i/teamlogos/nfl/500/${abbr.toLowerCase()}.png` : null; }
function TeamLogo({ href, abbr, size = 28 }) {
  const [bad, setBad] = useState(false);
  const src = (!href || bad) ? fallbackLogoForAbbr(abbr) : href;
  const box = { width:size, height:size, borderRadius:size/2, background:"#f1f5f9", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700 };
  if(!src) return <div style={box}>{abbr?.slice(0,3)||""}</div>;
  return <img src={src} alt="logo" style={{width:size,height:size,objectFit:"contain",display:"block"}} onError={()=>setBad(true)} />;
}

/** Stadium links */
const STADIUM_URLS = {
  ARI:"https://www.statefarmstadium.com/",
  ATL:"https://mercedesbenzstadium.com/",
  BAL:"https://www.baltimoreravens.com/stadium/",
  BUF:"https://www.buffalobills.com/stadium/",
  CAR:"https://www.panthers.com/stadium/",
  CHI:"https://soldierfield.net/",
  CIN:"https://www.bengals.com/stadium/",
  CLE:"https://www.clevelandbrowns.com/stadium/",
  DAL:"https://attstadium.com/",
  DEN:"https://www.empowerfieldatmilehigh.com/",
  DET:"https://www.fordfield.com/",
  GB:"https://www.packers.com/lambeau-field/",
  HOU:"https://www.nrgpark.com/venues/nrg-stadium/",
  IND:"https://www.lucasoilstadium.com/",
  JAX:"https://www.jaguars.com/stadium/",
  KC:"https://www.chiefs.com/stadium/",
  LAC:"https://www.sofistadium.com/",
  LAR:"https://www.sofistadium.com/",
  LV:"https://www.allegiantstadium.com/",
  MIA:"https://hardrockstadium.com/",
  MIN:"https://www.usbankstadium.com/",
  NE:"https://www.gillettestadium.com/",
  NO:"https://www.caesars-superdome.com/",
  NYG:"https://www.metlifestadium.com/",
  NYJ:"https://www.metlifestadium.com/",
  PHI:"https://www.lincolnfinancialfield.com/",
  PIT:"https://acrisurestadium.com/",
  SEA:"https://www.lumenfield.com/",
  SF:"https://www.levisstadium.com/",
  TB:"https://raymondjamesstadium.com/",
  TEN:"https://www.tennesseetitans.com/stadium/",
  WAS:"https://www.commanders.com/stadium/commanders-field"
};
const getStadiumUrlForTeam = (abbr) => STADIUM_URLS[abbr] || null;

/** Official team websites + full names */
const TEAM_URLS = {
  ARI:"https://www.azcardinals.com", ATL:"https://www.atlantafalcons.com", BAL:"https://www.baltimoreravens.com", BUF:"https://www.buffalobills.com",
  CAR:"https://www.panthers.com", CHI:"https://www.chicagobears.com", CIN:"https://www.bengals.com", CLE:"https://www.clevelandbrowns.com",
  DAL:"https://www.dallascowboys.com", DEN:"https://www.denverbroncos.com", DET:"https://www.detroitlions.com", GB:"https://www.packers.com",
  HOU:"https://www.houstontexans.com", IND:"https://www.colts.com", JAX:"https://www.jaguars.com", KC:"https://www.chiefs.com",
  LAC:"https://www.chargers.com", LAR:"https://www.therams.com", LV:"https://www.raiders.com", MIA:"https://www.miamidolphins.com",
  MIN:"https://www.vikings.com", NE:"https://www.patriots.com", NO:"https://www.neworleanssaints.com", NYG:"https://www.giants.com",
  NYJ:"https://www.newyorkjets.com", PHI:"https://www.philadelphiaeagles.com", PIT:"https://www.steelers.com", SEA:"https://www.seahawks.com",
  SF:"https://www.49ers.com", TB:"https://www.buccaneers.com", TEN:"https://www.tennesseetitans.com", WAS:"https://www.commanders.com"
};
const TEAM_FULL = {
  ARI:"Arizona Cardinals", ATL:"Atlanta Falcons", BAL:"Baltimore Ravens", BUF:"Buffalo Bills",
  CAR:"Carolina Panthers", CHI:"Chicago Bears", CIN:"Cincinnati Bengals", CLE:"Cleveland Browns",
  DAL:"Dallas Cowboys", DEN:"Denver Broncos", DET:"Detroit Lions", GB:"Green Bay Packers",
  HOU:"Houston Texans", IND:"Indianapolis Colts", JAX:"Jacksonville Jaguars", KC:"Kansas City Chiefs",
  LAC:"Los Angeles Chargers", LAR:"Los Angeles Rams", LV:"Las Vegas Raiders", MIA:"Miami Dolphins",
  MIN:"Minnesota Vikings", NE:"New England Patriots", NO:"New Orleans Saints", NYG:"New York Giants",
  NYJ:"New York Jets", PHI:"Philadelphia Eagles", PIT:"Pittsburgh Steelers", SEA:"Seattle Seahawks",
  SF:"San Francisco 49ers", TB:"Tampa Bay Buccaneers", TEN:"Tennessee Titans", WAS:"Washington Commanders"
};

function StatusPill({ game }) {
  const s = (game?.status?.type?.name || "").toLowerCase();
  const detail = game?.status?.type?.description || game?.status?.type?.detail;
  let tone = "default";
  if (s === "status_final" || s === "final") tone = "good";
  if (s === "status_in_progress" || s === "in") tone = "warn";
  if (s.includes("postponed") || s.includes("suspended")) tone = "bad";
  return <Pill tone={tone}>{detail || "Status"}</Pill>;
}

/* Fetch helper (robust, proper AbortError) */

async function fetchFirstOk(urls, init){
  // concurrent 'first 200 wins' with loser aborts
  let lastStatus = 0, lastText = "";
  const local = new AbortController();
  if (init && init.signal) {
    if (init.signal.aborted) local.abort();
    else init.signal.addEventListener("abort", ()=> local.abort(), { once: true });
  }
  return await new Promise((resolve, reject)=>{
    let pending = urls.length;
    if (pending === 0) return reject(new Error("No URLs provided"));
    const done = (err, data) => {
      if (err) reject(err); else resolve(data);
      try{ local.abort(); }catch{}
    };
    for (const u of urls) {
      fetch(proxify(u), { ...init, signal: local.signal }).then(async (r)=>{
        if (r.ok) {
          try { const json = await r.json(); done(null, json); } catch (e) { done(e); }
        } else {
          lastStatus = r.status;
          try { lastText = await r.text(); } catch {}
          console.warn("[NFL] attempt failed", u, r.status);
          if (--pending === 0) done(new Error(`Request failed (last status ${lastStatus}): ${String(lastText).slice(0,160)}`));
        }
      }).catch((e)=>{
        if (e && e.name === "AbortError") return;
        lastStatus = 0; lastText = String(e||"");
        console.warn("[NFL] attempt threw", u, e);
        if (--pending === 0) done(new Error(`Request failed (last status ${lastStatus}): ${String(lastText).slice(0,160)}`));
      });
    }
  });
}


/* ESPN event -> simplified (with logo fallback & official team links) */
function simplifyEspnEvent(ev) {
  const comp = ev?.competitions?.[0] || {};
  const status = ev?.status || comp?.status || {};
  const competitors = comp?.competitors || [];
  const venue = comp?.venue?.fullName || ev?.venue?.fullName;
  const seasonType = ev?.season?.type || comp?.season?.type; // 1=pre,2=reg,3=post

  const getSide = (homeAway) => {
    const c = competitors.find((x) => x.homeAway === homeAway) || {};
    const t = c.team || {};
    const logos = t.logos || c.team?.logos || [];
    const logoHref = logos[0]?.href || logos[0]?.url || fallbackLogoForAbbr(t.abbreviation);
    const record = (c.records || []).find((r) => r.type === "total") || {};
    const abbr = t.abbreviation;
    return {
      id: t.id,
      name: t.displayName || t.name || TEAM_FULL[abbr] || abbr,
      abbr,
      logo: logoHref,
      page: TEAM_URLS[abbr] || undefined, // official site
      score: c.score != null ? Number(c.score) : null,
      record: record.summary || "",
      winner: c.winner === true
    };
  };

  const home = getSide("home");
  const away = getSide("away");
  const sName = (status?.type?.name || "").toLowerCase();
  return {
    id: ev.id,
    date: ev.date || comp.date,
    venue,
    status,
    home,
    away,
    isFinal: sName === "status_final" || sName === "final",
    isLive: sName === "status_in_progress" || sName === "in",
    isPreseason: Number(seasonType) === 1,
  };
}

/* SCORES */
function TeamRowWithScore({ team, role, leading, size = 32 }) {
  return (
    <div className="teamline" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <TeamLogo href={team.logo} abbr={team.abbr} size={size} />
        <div style={{display:"grid",gap:2}}>
          <div style={{fontWeight:600}} title={team.name}>
            <a href={team.page || "#"} target="_blank" rel="noopener noreferrer" style={{ color:"inherit", textDecoration:"none" }}>{team.name}</a>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {team.record && <div style={{fontSize:12,color:"#64748b"}}>{team.record}</div>}
            <span style={{fontSize:12}}>{role==="home"?"🏠 HOME":"🚌 AWAY"}</span>
          </div>
        </div>
      </div>
      <div className={"scorepill" + (leading ? " scorepill-leading" : "")} style={{minWidth:36,textAlign:"center",border:"1px solid #e2e8f0",borderRadius:10,padding:"4px 8px",fontWeight:700}}>
        {team.score ?? "-"}
      </div>
    </div>
  );
}

function ScoresPanel({ date, setDate, tz }) {
  const [gamesByDate, setGamesByDate] = useState({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const abortRef = useRef(null);
  const weekStart = useMemo(() => startOfWeekISO(date, 4), [date]); // Thursday (NFL week)
  const weekDays = useMemo(() => range7(weekStart), [weekStart]);

  useEffect(() => {
    function onKey(e){ if(e.key==="ArrowLeft") setDate((d)=>addDays(d,-7)); if(e.key==="ArrowRight") setDate((d)=>addDays(d,7)); }
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [setDate]);

  function mergeDay(prev, day, nextGames){
    const arr = prev[day] || []; const map = new Map(arr.map((g)=>[g.id,g]));
    const merged = nextGames.map((n)=> map.has(n.id) ? { ...map.get(n.id), ...n } : n );
    return { ...prev, [day]: merged };
  }

  async function fetchScoresWeek(days, { background=false } = {}){
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController(); abortRef.current = controller;
    if (!background){ setLoading(true); setError(""); } else setRefreshing(true);
    try {
      const results = await Promise.all(days.map(async (d)=>{
        const urls = scoreboardUrlsForDate(d);
        const data = await fetchFirstOk(urls, { signal: controller.signal });
        const games = (data?.events || []).map((ev)=>simplifyEspnEvent(ev));
        return { day:d, games };
      }));
      setGamesByDate((prev)=>{
        let next = background ? { ...prev } : {};
        for (const {day, games} of results) next = mergeDay(next, day, games);
        return next;
      });
    } catch(e){
      if(e.name!=="AbortError" && !background) setError(e.message || "Failed to load scores");
    } finally { if(!background) setLoading(false); setRefreshing(false); }
  }

  useEffect(()=>{ fetchScoresWeek(weekDays); }, [weekStart]); // eslint-disable-line
  useEffect(()=>{
    const id = setInterval(()=>{ if(document.visibilityState==="visible") fetchScoresWeek(weekDays, { background:true }); }, 45000);
    const onVis = () => { if(document.visibilityState==="visible") fetchScoresWeek(weekDays, { background:true }); };
    document.addEventListener("visibilitychange", onVis);
    return ()=>{ clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [weekStart]); // eslint-disable-line

  function passesFilter(g){ if(filter==="final") return g.isFinal; if(filter==="live") return g.isLive; if(filter==="upcoming") return !g.isFinal && !g.isLive; return true; }
  const flatSorted = useMemo(()=>{
    const all = weekDays.flatMap((d)=> (gamesByDate[d]||[]) );
    return all.filter(passesFilter).slice().sort((a,b)=> new Date(a.date) - new Date(b.date) );
  }, [gamesByDate, weekDays, filter]);

  const weekLabel = useMemo(()=>{
    const start = new Date(weekStart); const end = new Date(parseDate(addDays(weekStart,6)));
    const fmt = new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric"});
    return `${fmt.format(start)} – ${fmt.format(end)}`;
  }, [weekStart]);

  return (
    <div style={{ display:"grid", gap:12 }}>
      <div className="controls" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <button className="btn" onClick={()=>setDate(addDays(weekStart,-7))}>← Prev Week</button>
        <div className="row" style={{display:"flex",gap:12,alignItems:"center"}}>
          <span style={{fontWeight:600}}>Week of {weekLabel}</span>
          <select className="input" value={filter} onChange={(e)=>setFilter(e.target.value)}>
            <option value="all">All</option><option value="live">Live</option><option value="upcoming">Upcoming</option><option value="final">Final</option>
          </select>
          <div style={{fontSize:12,color:"#64748b"}}>Times: {tz}</div>
          {refreshing && <span className="pill pill-mini">Updating…</span>}
        </div>
        <div className="row" style={{display:"flex",gap:8,alignItems:"center"}}>
          <button className="btn" onClick={()=>setDate(fmtDate(new Date()))}>This Week</button>
          <button className="btn" onClick={()=>setDate(addDays(weekStart,7))}>Next Week →</button>
        </div>
      </div>

      {loading && <div style={{ color:"#475569" }}>Loading scores…</div>}
      {error && <div style={{ border:"1px solid #fecaca", background:"#fef2f2", color:"#b91c1c", padding:12, borderRadius:12 }}>{error}</div>}

      {!loading && !error && flatSorted.length === 0 && (
        <div className="card" style={{ padding:24, textAlign:"center" }}>
          <div style={{ fontSize:48 }}>🏈</div>
          <div style={{ marginTop:8, color:"#334155", fontWeight:600 }}>No NFL games found for this week.</div>
          <div style={{ fontSize:12, color:"#64748b" }}>Try another week.</div>
        </div>
      )}

      {!loading && !error && flatSorted.map((g)=>{
        const showLead = g.isLive || g.isFinal;
        const homeScore = typeof g.home.score === "number" ? g.home.score : null;
        const awayScore = typeof g.away.score === "number" ? g.away.score : null;
        const homeLeading = showLead && homeScore != null && awayScore != null && homeScore > awayScore;
        const awayLeading = showLead && homeScore != null && awayScore != null && awayScore > homeScore;
        const stadiumUrl = getStadiumUrlForTeam(g.home.abbr);
        return (
          <div key={g.id} className="card" style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:12 }}>
            <div style={{ padding:12, display:"grid", gap:10 }}>
              <TeamRowWithScore team={g.home} role="home" leading={homeLeading} size={32} />
              <TeamRowWithScore team={g.away} role="away" leading={awayLeading} size={32} />
            </div>
            <div style={{ padding:12, display:"grid", gap:10, alignContent:"start", borderLeft:"1px solid #e2e8f0" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                <span style={{fontSize:12,color:"#64748b"}}>Status:</span>
                <StatusPill game={g} />{g.isPreseason && <Pill>Preseason</Pill>}
              </div>
              <div style={{ fontSize:"0.85em" }}>
                <span className="label">Kickoff:</span>{" "}
                {new Date(g.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}{" "}
                {prettyTime(g.date, tz)}
              </div>
              <div style={{ fontSize:"0.85em" }}><span className="label">Location:</span> {stadiumUrl ? (<a href={stadiumUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration:"underline" }}>{g.venue || "—"}</a>) : (g.venue || "—")}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---- Local Standings Aggregation ---- */
const DIVISIONS = {
  "AFC East": ["BUF","MIA","NE","NYJ"],
  "AFC North": ["BAL","CIN","CLE","PIT"],
  "AFC South": ["HOU","IND","JAX","TEN"],
  "AFC West": ["DEN","KC","LAC","LV"],
  "NFC East": ["DAL","NYG","PHI","WAS"],
  "NFC North": ["CHI","DET","GB","MIN"],
  "NFC South": ["ATL","CAR","NO","TB"],
  "NFC West": ["ARI","LAR","SF","SEA"],
};
function pct(w,l,t=0){ const g=w+l+t; return g? (w + 0.5*t)/g : 0; }

async function fetchWeekScoreboard(season, week, signal){
  const urls = scoreboardUrlsForWeek(season, week);
  return await fetchFirstOk(urls, { signal });
}
function tallyFromEvents(events, table){
  for(const ev of events){
    const s = simplifyEspnEvent(ev);
    if(!s.isFinal || s.isPreseason) continue; // regular-season finals only
    const a = s.away, h = s.home;
    if (typeof a.score !== "number" || typeof h.score !== "number") continue;
    const away = a.abbr, home = h.abbr;
    if(!away || !home) continue;
    table[away] = table[away] || { team:a, w:0, l:0, t:0 };
    table[home] = table[home] || { team:h, w:0, l:0, t:0 };
    if (a.score === h.score) { table[away].t++; table[home].t++; }
    else if (a.score > h.score) { table[away].w++; table[home].l++; }
    else { table[home].w++; table[away].l++; }
  }
}


async function hasFinalsForWeek(season, week, signal){
  try{
    const data = await fetchWeekScoreboard(season, week, signal);
    const evs = (data && data.events) || [];
    for (const ev of evs){
      const s = simplifyEspnEvent(ev);
      if (s.isFinal && !s.isPreseason) return true;
    }
    return false;
  }catch{ return false; }
}
async function discoverMaxCompletedWeek(season, signal){
  let lo=1, hi=18, ans=0;
  while(lo<=hi){
    const mid = Math.floor((lo+hi)/2);
    const ok = await hasFinalsForWeek(season, mid, signal);
    if(ok){ ans=mid; lo=mid+1; } else { hi=mid-1; }
  }
  return ans;
}
function limitConcurrency(tasks, n){
  let i=0, active=0; const out=new Array(tasks.length);
  return new Promise((resolve)=>{
    const next=()=>{
      if(i===tasks.length && active===0) return resolve(Promise.all(out));
      while(active<n && i<tasks.length){
        const idx=i++; active++;
        out[idx]=tasks[idx]().finally(()=>{ active--; next(); });
      }
    };
    next();
  });
}
function StandingsPanel({ season }) {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [divisions, setDivisions] = useState([]);

  const numCell = {
    padding: 8,
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
    fontFeatureSettings: "'tnum' 1, 'lnum' 1",
    whiteSpace: "nowrap",
  };

  useEffect(()=>{
    let live = true;
    
  async function load({ background=false } = {}){
    if(!background){ setLoading(true); setError(""); } else setRefreshing(true);
    try {
      const controller = new AbortController();
      const upto = await discoverMaxCompletedWeek(season, controller.signal);
      const tasks = [];
      for(let w=1; w<=Math.max(0, Math.min(18, upto)); w++){
        tasks.push(()=> fetchWeekScoreboard(season, w, controller.signal).catch(()=>null));
      }
      const weeks = await limitConcurrency(tasks, 6);
      const table = {}; // abbr -> {team, w,l,t}
        for(const wk of weeks){
          if(!wk) continue;
          tallyFromEvents((wk && wk.events) || [], table);
        }
        const groups = Object.entries(DIVISIONS).map(([name, abbrs])=>{
          const teams = abbrs.map((abbr)=>{
            const row = table[abbr] || { team: { abbr, name: TEAM_FULL[abbr], logo: fallbackLogoForAbbr(abbr) }, w:0,l:0,t:0 };
            const tm = row.team;
            return {
              id: tm.id || abbr,
              name: TEAM_FULL[abbr] || tm.name || abbr,
              abbr,
              logo: tm.logo || fallbackLogoForAbbr(abbr),
              page: TEAM_URLS[abbr] || tm.page,
              w: row.w, l: row.l, t: row.t,
              pct: pct(row.w,row.l,row.t),
            };
          }).sort((a,b)=> b.pct - a.pct || b.w - a.w || a.l - b.l || a.name.localeCompare(b.name));
          return { name, teams };
        });
        if(live) setDivisions(groups);
      } catch(e){
        if(live && !background) setError(e.message || "Failed to load standings");
      } finally {
        if(!background) setLoading(false);
        setRefreshing(false);
      }
    }
    load();
    const id = setInterval(()=>{ if(document.visibilityState==="visible") load({ background:true }); }, 5*60*1000);
    const onVis = () => { if(document.visibilityState==="visible") load({ background:true }); };
    document.addEventListener("visibilitychange", onVis);
    return ()=>{ clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [season]);

  return (
    <div style={{ display:"grid", gap:12 }}>
      <h2 style={{ margin: 0 }}>Standings · {season} (Regular Season, local aggregation)</h2>
      <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
        <span style={{ color:"#64748b", fontSize:12 }}>Built from ESPN weekly scoreboards (final games only). Preseason excluded.</span>
        {refreshing && <span className="pill pill-mini">Updating…</span>}
      </div>
      {loading && <div style={{ color:"#475569" }}>Loading standings…</div>}
      {error && <div style={{ border:"1px solid #fecaca", background:"#fef2f2", color:"#b91c1c", padding:12, borderRadius:12 }}>{error}</div>}

      {!loading && !error && divisions.map((d, i) => (
        <div key={i} className="card" style={{ border:"1px solid #e2e8f0", borderRadius:16, overflow:"hidden", background:"#fff" }}>
          <div style={{ background:"#f8fafc", padding:"10px 12px", borderBottom:"1px solid #e2e8f0" }}><strong>{d.name}</strong></div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:14, tableLayout:"fixed" }}>
              <colgroup><col/><col style={{width:64}}/><col style={{width:64}}/><col style={{width:64}}/><col style={{width:80}}/></colgroup>
              <thead><tr style={{ color:"#64748b", textAlign:"left" }}><th style={{padding:8}}>Team</th><th style={numCell}>W</th><th style={numCell}>L</th><th style={numCell}>T</th><th style={numCell}>Pct</th></tr></thead>
              <tbody>
                {d.teams.map((t)=>(
                  <tr key={t.id || t.name} style={{ borderTop:"1px solid #e2e8f0" }}>
                    <td style={{ padding:8 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
                        <TeamLogo href={t.logo} abbr={t.abbr} size={20} />
                        <a href={t.page || "#"} target="_blank" rel="noopener noreferrer" style={{ fontWeight:600, color:"inherit", textDecoration:"none" }}>{t.name}</a>
                      </div>
                    </td>
                    <td style={numCell}>{t.w}</td>
                    <td style={numCell}>{t.l}</td>
                    <td style={numCell}>{t.t}</td>
                    <td style={numCell}>{t.pct.toFixed(3).replace("0.", ".")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

/* Tabs + App */
function Tabs({ value, onChange }) {
  const items = [{ id: "scores", label: "Scores" }, { id: "standings", label: "Standings" }];
  return (
    <div style={{ border:"1px solid #e2e8f0", background:"#fff", padding:4, borderRadius:12, display:"inline-flex", gap:4 }}>
      {items.map((it)=>(
        <button key={it.id} onClick={()=>onChange(it.id)} className="btn"
          style={{ background:value===it.id?"#0f172a":"#fff", color:value===it.id?"#fff":"#0f172a", borderColor:"#e2e8f0" }}>{it.label}</button>
      ))}
    </div>
  );
}

export default function App(){
  const [tz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago");
  const today = useMemo(()=>fmtDate(new Date()),[]);
  const [date, setDate] = useState(today);
  const [tab, setTab] = useState("scores");
  const [season] = useState(()=>{ const now=new Date(); return now.getMonth()<2 ? now.getFullYear()-1 : now.getFullYear(); });

  useEffect(()=>{
    const base=document.createElement("style");
    base.innerHTML = `
      :root { --font-stack: ${FONT_STACK}; }
      html, body, #root { height:100%; }
      body { font-family: var(--font-stack); color:#0f172a; background:linear-gradient(#f8fafc,#ffffff); }
      h1,h2,h3 { font-family: var(--font-stack); }
      .container{max-width:1024px;margin:0 auto;padding:16px}
      .btn{border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:8px 12px;cursor:pointer}
      .btn:hover{background:#f8fafc}
      .input{border:1px solid #e2e8f0;border-radius:12px;padding:8px;font-family:var(--font-stack)}
      .row{display:flex;gap:8px;align-items:center}
      .card{border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;background:#fff;margin-bottom:12px}
      .scorepill{min-width:36px;text-align:center;border:1px solid #e2e8f0;border-radius:10px;padding:4px 8px;font-weight:700}
      .scorepill-leading{background:#0f172a;color:#fff}
      .label{font-size:12px;color:#64748b}
      table { font-family: var(--font-stack); }
    `;
    document.head.appendChild(base);
    return ()=>{ try{ document.head.removeChild(base);}catch{} };
  },[]);

  return (
    <div style={{ minHeight:"100vh" }}>
      <div className="container">
        <header style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap" }}>
          <div>
            <h1 style={{ fontSize:28, margin:0 }}>NFL Daily Dashboard</h1>
            <div style={{ color:"#64748b" }}>Scores & Standings (preseason labeled; excluded from standings)</div>
          </div>
          <Tabs value={tab} onChange={setTab} />
        </header>
        <main style={{ marginTop:16 }}>
          {tab==="scores" && <ScoresPanel tz={tz} date={date} setDate={setDate} />}
          {tab==="standings" && <StandingsPanel season={season} />}
        </main>
        <footer style={{ marginTop:16, fontSize:12, color:"#64748b" }}>
          Data via ESPN weekly scoreboards; preseason games are marked and excluded from standings.
        </footer>
      </div>
    </div>
  );
}
