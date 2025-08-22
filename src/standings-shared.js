// Pure JS helpers for Standings lazy chunk (no JSX)
export const DIVISIONS = {
  "AFC East": ["BUF","MIA","NE","NYJ"],
  "AFC North": ["BAL","CIN","CLE","PIT"],
  "AFC South": ["HOU","IND","JAX","TEN"],
  "AFC West": ["DEN","KC","LAC","LV"],
  "NFC East": ["DAL","NYG","PHI","WAS"],
  "NFC North": ["CHI","DET","GB","MIN"],
  "NFC South": ["ATL","CAR","NO","TB"],
  "NFC West": ["ARI","LAR","SF","SEA"],
};

export const TEAM_FULL = {
  ARI:"Arizona Cardinals", ATL:"Atlanta Falcons", BAL:"Baltimore Ravens", BUF:"Buffalo Bills",
  CAR:"Carolina Panthers", CHI:"Chicago Bears", CIN:"Cincinnati Bengals", CLE:"Cleveland Browns",
  DAL:"Dallas Cowboys", DEN:"Denver Broncos", DET:"Detroit Lions", GB:"Green Bay Packers",
  HOU:"Houston Texans", IND:"Indianapolis Colts", JAX:"Jacksonville Jaguars", KC:"Kansas City Chiefs",
  LAC:"Los Angeles Chargers", LAR:"Los Angeles Rams", LV:"Las Vegas Raiders", MIA:"Miami Dolphins",
  MIN:"Minnesota Vikings", NE:"New England Patriots", NO:"New Orleans Saints", NYG:"New York Giants",
  NYJ:"New York Jets", PHI:"Philadelphia Eagles", PIT:"Pittsburgh Steelers", SEA:"Seattle Seahawks",
  SF:"San Francisco 49ers", TB:"Tampa Bay Buccaneers", TEN:"Tennessee Titans", WAS:"Washington Commanders"
};

export const lc = {
  get(key){
    try{
      const raw = localStorage.getItem(key);
      if(!raw) return null;
      const { data, exp } = JSON.parse(raw);
      if(exp && Date.now() > exp) return null;
      return data;
    }catch{ return null; }
  },
  set(key, data, ttlMs=5*60*1000){
    try{
      localStorage.setItem(key, JSON.stringify({ data, exp: Date.now() + ttlMs }));
    }catch{}
  }
};

export function pct(w,l,t=0){ const g=w+l+t; return g? (w + 0.5*t)/g : 0; }

export function tallyFromEvents(events, table){
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

export function limitConcurrency(tasks, n){
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

export function discoverMaxCompletedWeek(season, signal){
  let lo=1, hi=18, ans=0;
  while(lo<=hi){
    const mid = Math.floor((lo+hi)/2);
    const ok = await hasFinalsForWeek(season, mid, signal);
    if(ok){ ans=mid; lo=mid+1; } else { hi=mid-1; }
  }
  return ans;
}

export function fetchWeekScoreboard(season, week, signal){
  const urls = scoreboardUrlsForWeek(season, week);
  return await fetchFirstOk(urls, { signal });
}

export function hasFinalsForWeek(season, week, signal){
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

export function fetchFirstOk(urls, init){
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
          if (--pending === 0) done(new Error(`Request failed (last status ${lastStatus}): ${String(lastText).slice(0,160)}`));
        }
      }).catch((e)=>{
        if (e && e.name === "AbortError") return;
        lastStatus = 0; lastText = String(e||"");
        if (--pending === 0) done(new Error(`Request failed (last status ${lastStatus}): ${String(lastText).slice(0,160)}`));
      });
    }
  });
}

export function proxify(u){
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

export function _ttlForEspnUrl(espnUrl){
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
        if (diff < -1) return 86400; // 1 day
        if (diff === -1) return 300; // 5 min
        if (diff === 0) return 30;   // 30s
        return 1800;                 // 30 min future
      }
      return 600;
    }
  }catch{}
  return 60;
}
