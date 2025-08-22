// Auto-generated shared helpers for StandingsPanel lazy chunk
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
export const TEAM_URLS = {
  ARI:"https://www.azcardinals.com", ATL:"https://www.atlantafalcons.com", BAL:"https://www.baltimoreravens.com", BUF:"https://www.buffalobills.com",
  CAR:"https://www.panthers.com", CHI:"https://www.chicagobears.com", CIN:"https://www.bengals.com", CLE:"https://www.clevelandbrowns.com",
  DAL:"https://www.dallascowboys.com", DEN:"https://www.denverbroncos.com", DET:"https://www.detroitlions.com", GB:"https://www.packers.com",
  HOU:"https://www.houstontexans.com", IND:"https://www.colts.com", JAX:"https://www.jaguars.com", KC:"https://www.chiefs.com",
  LAC:"https://www.chargers.com", LAR:"https://www.therams.com", LV:"https://www.raiders.com", MIA:"https://www.miamidolphins.com",
  MIN:"https://www.vikings.com", NE:"https://www.patriots.com", NO:"https://www.neworleanssaints.com", NYG:"https://www.giants.com",
  NYJ:"https://www.newyorkjets.com", PHI:"https://www.philadelphiaeagles.com", PIT:"https://www.steelers.com", SEA:"https://www.seahawks.com",
  SF:"https://www.49ers.com", TB:"https://www.buccaneers.com", TEN:"https://www.tennesseetitans.com", WAS:"https://www.commanders.com"
};
export lc = {
  get(key){
    try{
      raw = localStorage.getItem(key);
      if(!raw) return null;
      { data, exp } = JSON.parse(raw);
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
    table[away] = table[away] || { team:a, w:0, l:0, t:0 }
export function limitConcurrency(tasks, n){
  let i=0, active=0; const out=new Array(tasks.length);
  return new Promise((resolve)=>{
    const next=()=>{
      if(i===tasks.length && active===0) return resolve(Promise.all(out));
      while(active<n && i<tasks.length){
        const idx=i++; active++;
        out[idx]=tasks[idx]().finally(()=>{ active--; next(); }
export function discoverMaxCompletedWeek(season, signal){
  let lo=1, hi=18, ans=0;
  while(lo<=hi){
    const mid = Math.floor((lo+hi)/2);
    const ok = await hasFinalsForWeek(season, mid, signal);
    if(ok){ ans=mid; lo=mid+1; }
export function fetchWeekScoreboard(season, week, signal){
  const urls = scoreboardUrlsForWeek(season, week);
  return await fetchFirstOk(urls, { signal }
