:root{
  --frame:#dee1e6; --toolbar:#fff; --tab-active:#fff; --tab-hover:#e8eaed;
  --text:#202124; --muted:#5f6368; --omni:#f1f3f4; --omni-focus:#fff; --accent:#1a73e8;
}
@media (prefers-color-scheme: dark){
  :root{--frame:#202124; --toolbar:#35363a; --tab-active:#35363a; --tab-hover:#2b2c2f;
    --text:#e8eaed; --muted:#9aa0a6; --omni:#202124; --omni-focus:#202124; --accent:#8ab4f8;}
}
*{box-sizing:border-box}
html,body{height:100%;margin:0;font-family:"Segoe UI",Roboto,system-ui,sans-serif;font-size:13px;color:var(--text);background:var(--frame)}
svg{width:20px;height:20px;fill:currentColor}
button{font:inherit;color:inherit;border:0;background:none;cursor:pointer}
#app{display:flex;flex-direction:column;height:100%}

#tabstrip{display:flex;align-items:flex-end;padding:8px 8px 0;gap:4px;background:var(--frame);user-select:none}
#tabs{display:flex;align-items:flex-end;min-width:0;flex:0 1 auto;gap:0}
.tab{position:relative;display:flex;align-items:center;gap:8px;height:34px;min-width:60px;max-width:240px;width:240px;flex:0 1 240px;padding:0 8px 0 12px;border-radius:8px 8px 0 0;color:var(--muted);cursor:default}
.tab:hover{background:var(--tab-hover)}
.tab.active{background:var(--tab-active);color:var(--text)}
.tab.active::before,.tab.active::after{content:"";position:absolute;bottom:0;width:8px;height:8px;background:transparent}
.tab.active::before{left:-8px;border-bottom-right-radius:8px;box-shadow:4px 4px 0 4px var(--tab-active)}
.tab.active::after{right:-8px;border-bottom-left-radius:8px;box-shadow:-4px 4px 0 4px var(--tab-active)}
.tab .fav{width:16px;height:16px;flex:none}
.tab .title{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.tab .x{width:18px;height:18px;border-radius:50%;display:grid;place-items:center;flex:none}
.tab .x svg{width:14px;height:14px}
.tab .x:hover{background:rgba(128,128,128,.3)}
.tab:not(:last-child):not(.active)::after{content:"";position:absolute;right:0;top:9px;height:16px;width:1px;background:var(--muted);opacity:.4}

.icon-btn{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;color:var(--muted);flex:none}
.icon-btn:hover{background:rgba(128,128,128,.2)}
.icon-btn.small{width:28px;height:28px;margin:0 0 3px 4px}
.icon-btn:disabled{opacity:.4;cursor:default}

#toolbar{display:flex;align-items:center;gap:4px;height:40px;padding:0 8px;background:var(--toolbar);box-shadow:0 1px 0 rgba(0,0,0,.15);z-index:2}
#omnibox{flex:1;display:flex;align-items:center;gap:8px;height:30px;margin:0 6px;padding:0 12px;border-radius:15px;background:var(--omni);border:1px solid transparent}
#omnibox:focus-within{background:var(--omni-focus);border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.omni-icon{width:16px;height:16px;color:var(--muted);flex:none}
#address,#ntp-input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:inherit;font:inherit;font-size:14px}

#content{position:relative;flex:1;background:#fff}
#frames,#newtab-page{position:absolute;inset:0}
#frames iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff;display:none}
#frames iframe.active{display:block}
#newtab-page{display:flex;flex-direction:column;align-items:center;padding-top:14vh;background:var(--toolbar);color:var(--text)}
#newtab-page.hidden{display:none}
.logo{width:72px;height:72px;color:var(--accent)}
#newtab-page h1{font-weight:400;font-size:44px;margin:8px 0 24px;letter-spacing:.5px}
#ntp-form{display:flex;align-items:center;gap:10px;width:min(560px,86vw);height:46px;padding:0 18px;border-radius:23px;background:var(--omni);border:1px solid rgba(128,128,128,.3)}
#ntp-form:focus-within{box-shadow:0 1px 6px rgba(32,33,36,.28);background:var(--omni-focus)}
#shortcuts{display:flex;gap:18px;margin-top:36px;flex-wrap:wrap;justify-content:center}
.sc{width:92px;display:flex;flex-direction:column;align-items:center;gap:8px;padding:10px 0;border-radius:8px;color:var(--text)}
.sc:hover{background:rgba(128,128,128,.15)}
.sc .ic{width:48px;height:48px;border-radius:50%;background:var(--omni);display:grid;place-items:center;color:var(--muted)}
#status{position:fixed;left:0;bottom:0;max-width:60%;padding:2px 10px;background:var(--toolbar);border:1px solid rgba(128,128,128,.3);border-left:0;border-bottom:0;border-radius:0 6px 0 0;font-size:12px}
