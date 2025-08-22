
import React, { useEffect, useState } from "react";
import { DIVISIONS, TEAM_FULL, pct, tallyFromEvents, limitConcurrency, discoverMaxCompletedWeek, fetchWeekScoreboard, lc } from "./standings-shared";

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
    async function load(opts = {}) {
      const { background = false } = opts;
      if(!background) setLoading(true);
      setRefreshing(Boolean(background));
      setError("");
      try {
        const ck = `standings_${season}`;
        const cached = lc.get(ck);
        if(cached && !background) setDivisions(cached);
        const upto = await discoverMaxCompletedWeek(season);
        const tasks = [];
        for(let w=1; w<=Math.max(0, Math.min(18, upto)); w++) tasks.push(()=> fetchWeekScoreboard(season, w).catch(()=>null));
        const weeks = await limitConcurrency(tasks, 6);
        const table = {};
        for(const wk of weeks) { if(!wk) continue; tallyFromEvents((wk && wk.events)||[], table); }
        const groups = Object.entries(DIVISIONS).map(([name, abbrs])=>({
          name,
          teams: abbrs.map((abbr)=> (table[abbr] ? table[abbr] : { team: { abbr, name: TEAM_FULL[abbr] || abbr }, w:0, l:0, t:0 }))
            .sort((a,b)=> (b.w - a.w) || (a.l - b.l) || (b.t - a.t) || a.team.name.localeCompare(b.team.name))
        }));
        if(live) { setDivisions(groups); lc.set(ck, groups, 10*60*1000); }
      } catch(e) { if(live && !background) setError(e.message || "Failed to load standings"); }
      finally { if(!background) setLoading(false); setRefreshing(false); }
    }
    load();
    const id = setInterval(()=>{ if(document.visibilityState==="visible") load({ background:true }); }, 5*60*1000);
    return ()=>{ live=false; clearInterval(id); };
  }, [season]);

  if(error) return <div style={{ color:"#b91c1c" }}>{error}</div>;
  if(loading && divisions.length===0) return <div>Loading…</div>;

  return (
    <div>
      {refreshing && <div style={{ fontSize:12, color:"#64748b" }}>Updating…</div>}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:12 }}>
        {divisions.map((div)=>(
          <div key={div.name} style={{ border:"1px solid #e2e8f0", borderRadius:12, overflow:"hidden" }}>
            <div style={{ background:"#f8fafc", fontWeight:600, padding:8 }}>{div.name}</div>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <colgroup><col/><col style={{width:64}}/><col style={{width:64}}/><col style={{width:64}}/></colgroup>
              <thead><tr style={{ color:"#64748b", textAlign:"left" }}><th style={{padding:8}}>Team</th><th style={{...numCell}}>W</th><th style={{...numCell}}>L</th><th style={{...numCell}}>T</th></tr></thead>
              <tbody>
                {div.teams.map((t)=>(
                  <tr key={t.team.abbr}>
                    <td style={{padding:8}}>{t.team.name}</td>
                    <td style={{...numCell}}>{t.w}</td>
                    <td style={{...numCell}}>{t.l}</td>
                    <td style={{...numCell}}>{t.t}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

export default StandingsPanel;
