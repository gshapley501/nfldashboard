// App.jsx — fixed build (undefined state), safer effects, deploy-friendly

import React, { useEffect, useMemo, useRef, useState } from "react";

/* -------- Error Boundary -------- */
class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error){ return { hasError: true, error }; }
  componentDidCatch(error, info){ console.error("App crashed:", error, info); }
  render(){
    if (this.state.hasError) {
      return (
        <div style={{padding:16}}>
          <h2>Something went wrong.</h2>
          <pre style={{whiteSpace:"pre-wrap"}}>{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

/* -------- Proxy + URL helpers -------- */
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
        if (diff < -1) return 86400; // past -> 1 day
        if (diff === -1) return 300;  // yesterday -> 5 min
        if (diff === 0) return 30;    // today -> 30s
        return 60;                    // future -> 60s
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
    const espn = 'https://site.api.espn.com'
