import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const API = "http://localhost:8000";

const C = {
  bg:"#060E1A",panel:"#0A1628",card:"#0F1E30",border:"#162840",
  accent:"#E8593C",accent2:"#4A9EE8",accent3:"#A855F7",
  green:"#22C55E",yellow:"#F59E0B",red:"#EF4444",orange:"#F97316",
  text:"#E2EAF2",muted:"#4A6A8A",faint:"#0D1E30",
};

const RISK = {
  critical:{bg:"rgba(239,68,68,0.1)",border:"#EF4444",text:"#FCA5A5",dot:"#EF4444",label:"CRITICAL",glow:"0 0 20px rgba(239,68,68,0.3)"},
  high:    {bg:"rgba(245,158,11,0.1)",border:"#F59E0B",text:"#FCD34D",dot:"#F59E0B",label:"HIGH",    glow:"0 0 20px rgba(245,158,11,0.3)"},
  medium:  {bg:"rgba(74,158,232,0.1)",border:"#4A9EE8",text:"#93C5FD",dot:"#4A9EE8",label:"MEDIUM",  glow:"0 0 20px rgba(74,158,232,0.3)"},
  low:     {bg:"rgba(34,197,94,0.1)", border:"#22C55E",text:"#86EFAC",dot:"#22C55E",label:"LOW",     glow:"0 0 20px rgba(34,197,94,0.3)"},
};

const NAV_ITEMS = [
  {id:"command",    icon:"⚡",label:"Command Center"},
  {id:"alerts",     icon:"🔔",label:"Live Alerts"},
  {id:"gates",      icon:"🚦",label:"Approval Gates"},
  {id:"audit",      icon:"📜",label:"Audit Trail"},
  {id:"agents",     icon:"🤖",label:"Agent Registry"},
  {id:"leaderboard",icon:"🏆",label:"Leaderboard"},
  {id:"analyzer",   icon:"🔬",label:"Analyze System"},
  {id:"sdk",        icon:"📦",label:"SDK & Docs"},
];

// ── UTILS ────────────────────────────────────────────────────────────────────
function RiskBadge({level,small}){
  const r=RISK[level]||RISK.medium;
  return <span style={{background:r.bg,color:r.text,border:`1px solid ${r.border}`,borderRadius:5,padding:small?"2px 7px":"3px 10px",fontSize:small?10:11,fontWeight:700,letterSpacing:"0.07em",whiteSpace:"nowrap"}}>{r.label}</span>;
}

function ScoreGauge({score,size=140}){
  const r=size*0.4,circ=2*Math.PI*r,dash=(score/100)*circ;
  const color=score<25?C.red:score<50?C.orange:score<75?C.yellow:C.green;
  return(
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.faint} strokeWidth={size*0.09}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={size*0.09}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{filter:`drop-shadow(0 0 8px ${color})`}}/>
      <text x={size/2} y={size/2-4} textAnchor="middle" fontSize={size*0.22} fontWeight={900} fill={color} fontFamily="system-ui">{score}</text>
      <text x={size/2} y={size/2+size*0.13} textAnchor="middle" fontSize={size*0.1} fill={C.muted} fontFamily="system-ui">/100</text>
    </svg>
  );
}

function Card({children,style={}}){
  return <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"20px 22px",...style}}>{children}</div>;
}

function SectionHeader({label,live}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
      <div style={{width:3,height:16,background:C.accent,borderRadius:2}}/>
      <span style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:"0.1em"}}>{label}</span>
      {live&&<span style={{display:"flex",alignItems:"center",gap:5,background:"rgba(34,197,94,0.1)",border:"1px solid #22C55E",borderRadius:5,padding:"2px 8px",fontSize:10,color:C.green,fontWeight:700}}>
        <span style={{width:5,height:5,borderRadius:"50%",background:C.green,display:"inline-block",animation:"pulse 1.5s infinite"}}/>LIVE
      </span>}
    </div>
  );
}

function Spinner(){
  return <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:60}}>
    <div style={{width:32,height:32,border:`3px solid ${C.faint}`,borderTop:`3px solid ${C.accent}`,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
  </div>;
}

function Empty({msg}){
  return <Card><div style={{textAlign:"center",color:C.muted,padding:32,fontSize:14}}>{msg}</div></Card>;
}

// ── LOGIN PAGE ────────────────────────────────────────────────────────────────
function LoginPage({onLogin}){
  const [mode,setMode]=useState("register");
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [apiKey,setApiKey]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState(null);
  const [registered,setRegistered]=useState(null);

  async function handleRegister(){
    if(!name.trim())return;
    setLoading(true);setError(null);
    try{
      const res=await fetch(`${API}/v1/register`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,owner_email:email})});
      const data=await res.json();
      if(!data.api_key)throw new Error("Registration failed");
      setRegistered(data);
      localStorage.setItem("aw_api_key",data.api_key);
      localStorage.setItem("aw_system_name",name);
    }catch(e){setError(e.message);}
    setLoading(false);
  }

  async function handleLogin(){
    if(!apiKey.trim())return;
    setLoading(true);setError(null);
    try{
      const res=await fetch(`${API}/v1/dashboard/${apiKey.trim()}`);
      if(!res.ok)throw new Error("Invalid API key");
      const data=await res.json();
      localStorage.setItem("aw_api_key",apiKey.trim());
      localStorage.setItem("aw_system_name",data.system?.name||"My System");
      onLogin(apiKey.trim());
    }catch(e){setError("Invalid API key. Please check and try again.");}
    setLoading(false);
  }

  return(
    <div style={{background:C.bg,minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Inter',system-ui",padding:24}}>
      {/* Header */}
      <motion.div initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}} style={{textAlign:"center",marginBottom:40}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:12}}>
          <div style={{width:10,height:10,borderRadius:"50%",background:C.red,animation:"pulse 2s infinite"}}/>
          <span style={{color:C.accent,fontSize:13,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase"}}>AgentWatch</span>
        </div>
        <div style={{fontSize:42,fontWeight:900,color:C.text,letterSpacing:"-0.02em",lineHeight:1.1,marginBottom:12}}>
          Governance OS
        </div>
        <div style={{fontSize:16,color:C.muted,maxWidth:480,margin:"0 auto",lineHeight:1.7}}>
          Universal governance monitoring for autonomous AI agent systems.
          Connect any agent. Detect failures. Enforce oversight.
        </div>
      </motion.div>

      {/* Stats bar */}
      <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.2}}
        style={{display:"flex",gap:32,marginBottom:40}}>
        {[["3 lines","to connect"],["Real-time","cascade detection"],["0%","oversight tolerated"],["GovernanceScore™","live calculated"]].map(([v,l])=>(
          <div key={l} style={{textAlign:"center"}}>
            <div style={{fontSize:18,fontWeight:800,color:C.accent}}>{v}</div>
            <div style={{fontSize:11,color:C.muted}}>{l}</div>
          </div>
        ))}
      </motion.div>

      {/* Auth card */}
      <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.3}}
        style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:20,padding:"36px 40px",width:"100%",maxWidth:480,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${C.accent},${C.accent2})`}}/>

        {!registered?(
          <>
            {/* Tabs */}
            <div style={{display:"flex",gap:0,marginBottom:28,background:C.faint,borderRadius:10,padding:4}}>
              {[["register","Register System"],["login","I have an API key"]].map(([m,l])=>(
                <button key={m} onClick={()=>{setMode(m);setError(null);}} style={{flex:1,padding:"9px",borderRadius:8,border:"none",background:mode===m?C.card:"transparent",color:mode===m?C.text:C.muted,fontSize:13,fontWeight:mode===m?600:400,cursor:"pointer",transition:"all 0.15s"}}>{l}</button>
              ))}
            </div>

            {mode==="register"?(
              <div>
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:11,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>System Name *</div>
                  <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. My LangGraph System"
                    style={{width:"100%",padding:"11px 14px",background:C.faint,border:`1px solid ${C.border}`,borderRadius:9,fontSize:13,color:C.text,outline:"none",boxSizing:"border-box"}}/>
                </div>
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:11,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Email (optional)</div>
                  <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"
                    style={{width:"100%",padding:"11px 14px",background:C.faint,border:`1px solid ${C.border}`,borderRadius:9,fontSize:13,color:C.text,outline:"none",boxSizing:"border-box"}}/>
                </div>
                <motion.button onClick={handleRegister} disabled={loading||!name.trim()} whileHover={{scale:1.01}} whileTap={{scale:0.99}}
                  style={{width:"100%",background:loading?C.muted:`linear-gradient(135deg,${C.accent},#C0392B)`,border:"none",color:"#fff",borderRadius:10,padding:"14px",fontSize:15,fontWeight:700,cursor:loading?"default":"pointer"}}>
                  {loading?"Registering...":"Register & Get API Key →"}
                </motion.button>
              </div>
            ):(
              <div>
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:11,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Your API Key</div>
                  <input value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="aw_live_..."
                    style={{width:"100%",padding:"11px 14px",background:C.faint,border:`1px solid ${C.border}`,borderRadius:9,fontSize:13,color:C.text,outline:"none",boxSizing:"border-box",fontFamily:"monospace"}}/>
                </div>
                <motion.button onClick={handleLogin} disabled={loading||!apiKey.trim()} whileHover={{scale:1.01}} whileTap={{scale:0.99}}
                  style={{width:"100%",background:loading?C.muted:`linear-gradient(135deg,${C.accent2},"#2563EB")`,border:"none",color:"#fff",borderRadius:10,padding:"14px",fontSize:15,fontWeight:700,cursor:loading?"default":"pointer"}}>
                  {loading?"Connecting...":"Connect to Dashboard →"}
                </motion.button>
              </div>
            )}

            {error&&<div style={{marginTop:14,background:RISK.critical.bg,border:`1px solid ${C.red}`,borderRadius:9,padding:"10px 14px",fontSize:13,color:"#FCA5A5"}}>{error}</div>}
          </>
        ):(
          // Success state
          <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}}>
            <div style={{textAlign:"center",marginBottom:24}}>
              <div style={{fontSize:40,marginBottom:8}}>🎉</div>
              <div style={{fontSize:20,fontWeight:800,color:C.green,marginBottom:4}}>System Registered!</div>
              <div style={{fontSize:13,color:C.muted}}>{registered.message}</div>
            </div>
            <div style={{background:C.faint,border:`1px solid ${C.green}`,borderRadius:10,padding:"14px 16px",marginBottom:16}}>
              <div style={{fontSize:10,color:C.muted,fontWeight:600,textTransform:"uppercase",marginBottom:6}}>Your API Key — Save this!</div>
              <div style={{fontSize:13,color:C.green,fontFamily:"monospace",wordBreak:"break-all",fontWeight:600}}>{registered.api_key}</div>
            </div>
            <div style={{background:C.faint,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 16px",marginBottom:20}}>
              <div style={{fontSize:10,color:C.muted,fontWeight:600,textTransform:"uppercase",marginBottom:6}}>Connect your agents in 3 lines</div>
              <div style={{fontFamily:"monospace",fontSize:12,color:C.text,lineHeight:1.8}}>
                <div><span style={{color:C.accent2}}>import</span> agentwatch</div>
                <div>aw = agentwatch.<span style={{color:C.green}}>connect</span>(<span style={{color:C.yellow}}>api_key=</span><span style={{color:C.accent}}>"{registered.api_key}"</span>)</div>
                <div><span style={{color:C.accent}}>@aw.monitor</span></div>
                <div><span style={{color:C.accent2}}>def</span> <span style={{color:C.green}}>your_agent</span>(input):</div>
                <div>    <span style={{color:C.accent2}}>return</span> llm.run(input)</div>
              </div>
            </div>
            <motion.button onClick={()=>onLogin(registered.api_key)} whileHover={{scale:1.01}} whileTap={{scale:0.99}}
              style={{width:"100%",background:`linear-gradient(135deg,${C.green},#16A34A)`,border:"none",color:"#fff",borderRadius:10,padding:"14px",fontSize:15,fontWeight:700,cursor:"pointer"}}>
              Go to Dashboard →
            </motion.button>
          </motion.div>
        )}
      </motion.div>

      <div style={{marginTop:24,fontSize:12,color:C.muted,textAlign:"center"}}>
        Built by Murali Revuri · <a href="https://github.com/muralirevuri07-boop/agentwatch" target="_blank" rel="noopener noreferrer" style={{color:C.accent2}}>GitHub</a>
      </div>
    </div>
  );
}

// ── COMMAND CENTER ────────────────────────────────────────────────────────────
function CommandCenter({data}){
  if(!data)return <Spinner/>;
  const score=data.governance_score||0;
  const metrics=[
    {icon:"⚡",label:"Governance Score™",value:score,severity:score<25?"critical":score<50?"high":score<75?"medium":"low",sub:"Real-time calculated"},
    {icon:"👁",label:"Human Oversight",value:`${data.oversight_ratio||0}%`,severity:data.oversight_ratio<50?"critical":"medium",sub:`${data.pending_approvals||0} decisions blocked`},
    {icon:"🔗",label:"Cascade Failures",value:data.cascade_failures||0,severity:data.cascade_failures>0?"critical":"low",sub:"Detected & logged"},
    {icon:"💬",label:"Total Events",value:data.total_events||0,severity:"medium",sub:"Agent actions tracked"},
    {icon:"🚨",label:"Active Alerts",value:data.active_alerts||0,severity:data.active_alerts>0?"critical":"low",sub:"Require attention"},
    {icon:"🔒",label:"Blocked Decisions",value:data.pending_approvals||0,severity:data.pending_approvals>0?"high":"low",sub:"Awaiting human approval"},
  ];

  const radarData=[
    {metric:"Input Validation",score:Math.max(5,50-(data.cascade_failures||0)*15)},
    {metric:"Coordination",score:Math.max(5,score)},
    {metric:"Oversight",score:Math.round(data.oversight_ratio||0)},
    {metric:"Audit Trail",score:Math.min(100,(data.total_events||0)*5+20)},
    {metric:"Error Detection",score:Math.max(10,40-(data.active_alerts||0)*5)},
    {metric:"Accountability",score:Math.max(5,score-10)},
  ];

  return(
    <div>
      <SectionHeader label="Governance Command Center" live/>
      <div style={{background:`linear-gradient(135deg,${C.panel},#080F1C)`,border:`1px solid ${C.border}`,borderRadius:16,padding:"28px 32px",marginBottom:20,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${C.accent},${C.accent2})`}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:20}}>
          <div>
            <div style={{fontSize:11,color:C.accent,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:6}}>AgentWatch · LIVE</div>
            <div style={{fontSize:28,fontWeight:900,color:C.text,letterSpacing:"-0.02em"}}>{data.system?.name||"My System"}</div>
            <div style={{fontSize:13,color:C.muted,marginTop:4}}>{data.system?.owner_email} · Real-time governance monitoring</div>
            <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
              <RiskBadge level={score<25?"critical":score<50?"high":score<75?"medium":"low"}/>
              {data.active_alerts>0&&<span style={{background:"rgba(239,68,68,0.1)",color:"#FCA5A5",border:"1px solid #EF4444",borderRadius:5,padding:"3px 10px",fontSize:11,fontWeight:700}}>{data.active_alerts} ACTIVE ALERTS</span>}
              {data.pending_approvals>0&&<span style={{background:"rgba(245,158,11,0.1)",color:"#FCD34D",border:"1px solid #F59E0B",borderRadius:5,padding:"3px 10px",fontSize:11,fontWeight:700}}>{data.pending_approvals} BLOCKED</span>}
            </div>
          </div>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>GovernanceScore™</div>
            <ScoreGauge score={score} size={120}/>
            <div style={{fontSize:11,color:score<25?C.red:C.green,fontWeight:600,marginTop:4}}>HIGHER = SAFER</div>
          </div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
        {metrics.map((m,i)=>{
          const r=RISK[m.severity];
          return(
            <motion.div key={m.label} initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:i*0.07}}
              style={{background:r.bg,border:`1px solid ${r.border}`,borderRadius:12,padding:"16px 18px",position:"relative",overflow:"hidden",boxShadow:r.glow}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:r.dot}}/>
              <div style={{fontSize:18,marginBottom:6}}>{m.icon}</div>
              <div style={{fontSize:10,color:r.text,opacity:0.7,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>{m.label}</div>
              <div style={{fontSize:26,fontWeight:900,color:r.text,lineHeight:1}}>{m.value}</div>
              <div style={{fontSize:11,color:r.text,opacity:0.6,marginTop:4}}>{m.sub}</div>
            </motion.div>
          );
        })}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <Card>
          <SectionHeader label="GovernanceScore™ Breakdown"/>
          {[
            {label:"Input Validation",   score:Math.max(5,50-(data.cascade_failures||0)*15), icon:"🛡"},
            {label:"Agent Coordination", score:Math.max(5,score),                             icon:"🔗"},
            {label:"Human Oversight",    score:Math.round(data.oversight_ratio||0),            icon:"👁"},
            {label:"Accountability",     score:Math.max(5,score-10),                           icon:"⚖️"},
            {label:"Auditability",       score:Math.min(100,(data.total_events||0)*5+20),      icon:"📋"},
          ].map((s,i)=>(
            <div key={s.label} style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontSize:12,color:C.text}}>{s.icon} {s.label}</span>
                <span style={{fontSize:12,fontWeight:700,color:s.score<20?C.red:s.score<50?C.yellow:C.green}}>{s.score}/100</span>
              </div>
              <div style={{background:C.faint,borderRadius:4,height:5,overflow:"hidden"}}>
                <motion.div initial={{width:0}} animate={{width:`${s.score}%`}} transition={{delay:i*0.1,duration:0.8}}
                  style={{height:"100%",background:s.score<20?C.red:s.score<50?C.yellow:C.green,borderRadius:4}}/>
              </div>
            </div>
          ))}
        </Card>
        <Card>
          <SectionHeader label="Governance Radar"/>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData}>
              <PolarGrid stroke={C.border}/>
              <PolarAngleAxis dataKey="metric" tick={{fill:C.muted,fontSize:10}}/>
              <Radar dataKey="score" stroke={C.accent} fill={C.accent} fillOpacity={0.15} strokeWidth={2}/>
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {data.certificate&&(
        <Card style={{borderLeft:`4px solid ${C.accent2}`}}>
          <div style={{fontSize:11,color:C.accent2,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Governance Certificate</div>
          <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
            <div>
              <div style={{fontSize:12,color:C.muted,marginBottom:2}}>Certificate Hash</div>
              <div style={{fontSize:11,color:C.text,fontFamily:"monospace"}}>{data.certificate.certificate_hash?.slice(0,40)}...</div>
            </div>
            <div>
              <div style={{fontSize:12,color:C.muted,marginBottom:2}}>Valid Until</div>
              <div style={{fontSize:12,color:C.green,fontWeight:600}}>{new Date(data.certificate.valid_until).toLocaleDateString()}</div>
            </div>
            <div>
              <div style={{fontSize:12,color:C.muted,marginBottom:2}}>EU AI Act</div>
              <div style={{fontSize:12,color:C.yellow,fontWeight:600,textTransform:"uppercase"}}>{data.certificate.compliance_eu_ai_act||"PENDING"}</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── LIVE ALERTS ───────────────────────────────────────────────────────────────
function LiveAlerts({data}){
  const alerts=data?.alerts||[];
  return(
    <div>
      <SectionHeader label="Real-Time Governance Alerts" live/>
      {alerts.length===0?<Empty msg="✓ No active alerts — your system is clean"/>:(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {alerts.map((al,i)=>{
            const r=RISK[al.severity]||RISK.medium;
            return(
              <motion.div key={al.id} initial={{opacity:0,x:-16}} animate={{opacity:1,x:0}} transition={{delay:i*0.06}}
                style={{background:r.bg,border:`1px solid ${r.border}`,borderRadius:12,padding:"16px 20px",boxShadow:i<2?r.glow:"none"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                  <span style={{fontSize:14,fontWeight:700,color:r.text}}>{al.title}</span>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <RiskBadge level={al.severity} small/>
                    <span style={{fontSize:11,color:C.muted}}>{new Date(al.created_at).toLocaleTimeString()}</span>
                  </div>
                </div>
                <div style={{fontSize:13,color:r.text,opacity:0.8,lineHeight:1.5,marginBottom:4}}>{al.description}</div>
                <div style={{fontSize:11,color:r.text,opacity:0.5}}>Agent: {al.agent_name} · {al.alert_type}</div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── APPROVAL GATES ────────────────────────────────────────────────────────────
function ApprovalGates({data,apiKey,onRefresh}){
  const gates=data?.approval_gates||[];

  async function handleAction(gateId,action){
    try{
      await fetch(`${API}/v1/gates/action`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({api_key:apiKey,gate_id:gateId,action,approved_by:"Human Operator"})
      });
      onRefresh();
    }catch(e){console.error(e);}
  }

  return(
    <div>
      <SectionHeader label="Human Approval Gates" live/>
      {gates.length===0?<Empty msg="✓ No pending approvals"/>:(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {gates.map((g,i)=>{
            const statusColor=g.status==="approved"?C.green:g.status==="blocked"?C.red:C.yellow;
            return(
              <motion.div key={g.id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.07}}
                style={{background:C.card,border:`1px solid ${g.status==="blocked"?C.red:g.status==="approved"?C.green:C.border}`,borderRadius:12,padding:"18px 22px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:10}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>{g.decision}</div>
                    <div style={{fontSize:12,color:C.muted,marginBottom:2}}>{g.impact}</div>
                    <div style={{fontSize:11,color:C.muted}}>{new Date(g.created_at).toLocaleString()}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
                    <RiskBadge level={g.risk_level}/>
                    <span style={{background:`${statusColor}22`,color:statusColor,border:`1px solid ${statusColor}`,borderRadius:5,padding:"3px 10px",fontSize:11,fontWeight:700}}>
                      {g.status==="blocked"?"🔴 BLOCKED":g.status==="approved"?"✅ APPROVED":"⏳ PENDING"}
                    </span>
                  </div>
                </div>
                {g.status==="blocked"&&(
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>handleAction(g.id,"approve")} style={{background:"rgba(34,197,94,0.15)",border:"1px solid #22C55E",color:"#22C55E",borderRadius:7,padding:"8px 20px",fontSize:13,fontWeight:700,cursor:"pointer"}}>✓ Approve</button>
                    <button onClick={()=>handleAction(g.id,"reject")} style={{background:"rgba(239,68,68,0.15)",border:"1px solid #EF4444",color:"#EF4444",borderRadius:7,padding:"8px 20px",fontSize:13,fontWeight:700,cursor:"pointer"}}>✗ Reject</button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── AUDIT TRAIL ───────────────────────────────────────────────────────────────
function AuditTrail({data}){
  const [search,setSearch]=useState("");
  const events=(data?.recent_events||[]).filter(e=>
    e.agent_name?.toLowerCase().includes(search.toLowerCase())||
    e.event_type?.toLowerCase().includes(search.toLowerCase())
  );
  return(
    <div>
      <SectionHeader label="Audit Trail" live/>
      <Card>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by agent or event type..."
          style={{width:"100%",padding:"8px 12px",background:C.faint,border:`1px solid ${C.border}`,borderRadius:8,fontSize:13,color:C.text,outline:"none",marginBottom:16,boxSizing:"border-box"}}/>
        {events.length===0?<div style={{textAlign:"center",color:C.muted,padding:24}}>No events yet. Connect your agents to start tracking.</div>:(
          <div style={{overflowX:"auto",maxHeight:500,overflowY:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr style={{background:C.faint}}>
                  {["Time","Agent","Event Type","Risk","Cascade","Oversight","Flagged"].map(h=>(
                    <th key={h} style={{padding:"10px 12px",textAlign:"left",color:C.muted,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",borderBottom:`1px solid ${C.border}`}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map((e)=>(
                  <tr key={e.id} style={{borderBottom:`1px solid ${C.faint}`,background:e.flagged?"rgba(239,68,68,0.04)":"transparent"}}>
                    <td style={{padding:"9px 12px",color:C.muted,fontFamily:"monospace",fontSize:10}}>{new Date(e.created_at).toLocaleTimeString()}</td>
                    <td style={{padding:"9px 12px",color:C.text,fontWeight:600}}>{e.agent_name}</td>
                    <td style={{padding:"9px 12px",color:C.muted}}>{e.event_type}</td>
                    <td style={{padding:"9px 12px"}}><RiskBadge level={e.risk_level} small/></td>
                    <td style={{padding:"9px 12px",color:e.cascade_detected?C.red:C.green,fontWeight:700,fontSize:11}}>{e.cascade_detected?"⚡ YES":"✓ NO"}</td>
                    <td style={{padding:"9px 12px",color:e.oversight_required?C.red:C.green,fontWeight:700,fontSize:11}}>{e.oversight_required?"🔴 REQ":"✓ OK"}</td>
                    <td style={{padding:"9px 12px",color:e.flagged?C.red:C.green,fontWeight:700,fontSize:11}}>{e.flagged?"⚠ YES":"✓ NO"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── AGENT REGISTRY ────────────────────────────────────────────────────────────
function AgentRegistry({data}){
  const agents=data?.agents||[];
  return(
    <div>
      <SectionHeader label="Agent Registry" live/>
      {agents.length===0?<Empty msg="No agents tracked yet. Run your SDK to start monitoring agents."/>:(
        <Card>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{background:C.faint}}>
                  {["Agent","Risk Level","Decisions","Flagged","Cascades","Status"].map(h=>(
                    <th key={h} style={{padding:"10px 14px",textAlign:"left",color:C.muted,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",borderBottom:`1px solid ${C.border}`}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agents.map((ag,i)=>(
                  <motion.tr key={ag.name} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.05}}
                    style={{borderBottom:`1px solid ${C.faint}`}}>
                    <td style={{padding:"12px 14px",color:C.text,fontWeight:700}}>{ag.name}</td>
                    <td style={{padding:"12px 14px"}}><RiskBadge level={ag.risk}/></td>
                    <td style={{padding:"12px 14px",color:C.text}}>{ag.decisions}</td>
                    <td style={{padding:"12px 14px",color:ag.flagged>0?C.red:C.green,fontWeight:700}}>{ag.flagged}</td>
                    <td style={{padding:"12px 14px",color:ag.cascades>0?C.red:C.green,fontWeight:700}}>{ag.cascades}</td>
                    <td style={{padding:"12px 14px"}}>
                      <span style={{background:"rgba(34,197,94,0.1)",color:C.green,border:`1px solid ${C.green}`,borderRadius:5,padding:"2px 8px",fontSize:10,fontWeight:700}}>MONITORED</span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── LEADERBOARD ───────────────────────────────────────────────────────────────
function Leaderboard(){
  const [boards,setBoards]=useState([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    fetch(`${API}/v1/leaderboard`).then(r=>r.json()).then(d=>{setBoards(d.leaderboard||[]);setLoading(false);}).catch(()=>setLoading(false));
  },[]);
  if(loading)return <Spinner/>;
  return(
    <div>
      <SectionHeader label="GovernanceScore™ Leaderboard"/>
      <div style={{background:"rgba(74,158,232,0.08)",border:"1px solid #4A9EE8",borderRadius:12,padding:"12px 18px",marginBottom:16}}>
        <span style={{fontSize:13,color:"#93C5FD"}}>🏆 World's first public benchmark for multi-agent AI governance. Real systems. Real scores. Higher = safer.</span>
      </div>
      {boards.length===0?<Empty msg="No systems on the leaderboard yet. Be the first!"/>:(
        <Card>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {boards.map((item,i)=>{
              const score=item.governance_score||0;
              const risk=score<25?"critical":score<50?"high":score<75?"medium":"low";
              const r=RISK[risk];
              return(
                <motion.div key={i} initial={{opacity:0,x:-16}} animate={{opacity:1,x:0}} transition={{delay:i*0.07}}
                  style={{background:r.bg,border:`1px solid ${r.border}`,borderRadius:10,padding:"14px 18px",display:"flex",alignItems:"center",gap:16}}>
                  <div style={{fontSize:20,fontWeight:900,color:i<3?[C.yellow,"#9CA3AF","#CD7F32"][i]:C.muted,width:30,textAlign:"center"}}>
                    {i<3?["🥇","🥈","🥉"][i]:i+1}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.text}}>{item.name}</div>
                    <div style={{fontSize:11,color:C.muted}}>{item.total_decisions} decisions · {item.cascade_failures} cascades</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:22,fontWeight:900,color:r.text}}>{score}</div>
                    <RiskBadge level={risk} small/>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── ANALYZER ──────────────────────────────────────────────────────────────────
function AnalyzerPage({apiKey,onResult}){
  const [logs,setLogs]=useState("");
  const [sysName,setSysName]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState(null);

  async function analyze(){
    if(!logs.trim())return;
    setLoading(true);setError(null);
    try{
      const res=await fetch(`${API}/v1/analyze`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({agent_outputs:logs,system_name:sysName||"My System",api_key:apiKey})});
      const data=await res.json();
      if(data.detail)throw new Error(data.detail);
      onResult(data);
    }catch(e){setError(e.message||"Analysis failed.");}
    setLoading(false);
  }

  return(
    <div>
      <SectionHeader label="Universal System Analyzer"/>
      <Card>
        <div style={{fontSize:20,fontWeight:800,color:C.text,marginBottom:4}}>Analyze any agent system</div>
        <div style={{fontSize:13,color:C.muted,marginBottom:24}}>Paste raw agent outputs. Get instant governance analysis powered by Groq Llama 3.3 70B.</div>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:C.muted,fontWeight:600,textTransform:"uppercase",marginBottom:6}}>System Name</div>
          <input value={sysName} onChange={e=>setSysName(e.target.value)} placeholder="e.g. My LangGraph System"
            style={{width:"100%",padding:"11px 14px",background:C.faint,border:`1px solid ${C.border}`,borderRadius:9,fontSize:13,color:C.text,outline:"none",boxSizing:"border-box"}}/>
        </div>
        <div style={{marginBottom:20}}>
          <div style={{fontSize:11,color:C.muted,fontWeight:600,textTransform:"uppercase",marginBottom:6}}>Agent Outputs</div>
          <textarea value={logs} onChange={e=>setLogs(e.target.value)}
            placeholder={"Paste raw agent outputs, logs, or decision traces here...\n\nAgentWatch detects:\n- Cascade failures\n- Agent miscoordination\n- Oversight gaps\n- PII exposure"}
            style={{width:"100%",minHeight:200,padding:"13px 14px",background:C.faint,border:`1px solid ${C.border}`,borderRadius:9,fontSize:13,fontFamily:"monospace",color:C.text,resize:"vertical",outline:"none",boxSizing:"border-box",lineHeight:1.7}}/>
        </div>
        <motion.button onClick={analyze} disabled={loading||!logs.trim()} whileHover={{scale:1.01}} whileTap={{scale:0.99}}
          style={{width:"100%",background:loading?C.muted:`linear-gradient(135deg,${C.accent},#C0392B)`,border:"none",color:"#fff",borderRadius:10,padding:"14px",fontSize:15,fontWeight:700,cursor:loading?"default":"pointer"}}>
          {loading?<span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10}}><span style={{width:16,height:16,border:"3px solid #fff4",borderTop:"3px solid #fff",borderRadius:"50%",display:"inline-block",animation:"spin 0.8s linear infinite"}}/>Analyzing...</span>:"Run Governance Analysis →"}
        </motion.button>
        {error&&<div style={{marginTop:14,background:RISK.critical.bg,border:`1px solid ${C.red}`,borderRadius:9,padding:"12px 16px",fontSize:13,color:"#FCA5A5"}}>{error}</div>}
      </Card>
    </div>
  );
}

// ── SDK DOCS ──────────────────────────────────────────────────────────────────
function SDKDocs({apiKey}){
  return(
    <div>
      <SectionHeader label="SDK & Integration Docs"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        <Card>
          <div style={{fontSize:11,color:C.accent,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Quick Start</div>
          <div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:16}}>Connect in 3 lines</div>
          <div style={{background:C.faint,borderRadius:10,padding:"16px",fontFamily:"monospace",fontSize:12,color:C.text,lineHeight:1.9}}>
            <div style={{color:C.muted}}># Install</div>
            <div>pip install agentwatch-sdk</div>
            <br/>
            <div style={{color:C.muted}}># Connect</div>
            <div><span style={{color:C.accent2}}>import</span> agentwatch</div>
            <div>aw = agentwatch.<span style={{color:C.green}}>connect</span>(</div>
            <div>    api_key=<span style={{color:C.accent}}>"{apiKey}"</span></div>
            <div>)</div>
            <br/>
            <div style={{color:C.muted}}># Monitor any agent</div>
            <div><span style={{color:C.accent}}>@aw.monitor</span></div>
            <div><span style={{color:C.accent2}}>def</span> <span style={{color:C.green}}>your_agent</span>(input):</div>
            <div>    <span style={{color:C.accent2}}>return</span> llm.run(input)</div>
          </div>
        </Card>
        <Card>
          <div style={{fontSize:11,color:C.accent2,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>High-Risk Decisions</div>
          <div style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:16}}>Auto-block dangerous actions</div>
          <div style={{background:C.faint,borderRadius:10,padding:"16px",fontFamily:"monospace",fontSize:12,color:C.text,lineHeight:1.9}}>
            <div style={{color:C.muted}}># Block high-value decisions</div>
            <div><span style={{color:C.accent}}>@aw.monitor</span>(</div>
            <div>    decision_amount=<span style={{color:C.yellow}}>500000</span>,</div>
            <div>    is_irreversible=<span style={{color:C.yellow}}>True</span></div>
            <div>)</div>
            <div><span style={{color:C.accent2}}>def</span> <span style={{color:C.green}}>finance_agent</span>(req):</div>
            <div>    <span style={{color:C.accent2}}>return</span> process(req)</div>
            <br/>
            <div style={{color:C.muted}}># Manual tracking</div>
            <div>aw.<span style={{color:C.green}}>track</span>(</div>
            <div>    agent_name=<span style={{color:C.accent}}>"CEO"</span>,</div>
            <div>    event_type=<span style={{color:C.accent}}>"decision"</span>,</div>
            <div>    decision_amount=<span style={{color:C.yellow}}>100000</span></div>
            <div>)</div>
          </div>
        </Card>
      </div>
      <Card>
        <div style={{fontSize:11,color:C.accent3,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:16}}>All SDK Methods</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
          {[
            {method:"aw.monitor",desc:"Decorator to monitor any agent function"},
            {method:"aw.track()",desc:"Manual event tracking"},
            {method:"aw.score()",desc:"Get current GovernanceScore™"},
            {method:"aw.alerts()",desc:"Get active governance alerts"},
            {method:"aw.gates()",desc:"Get blocked decisions"},
            {method:"aw.kill()",desc:"Emergency freeze all agents"},
          ].map(m=>(
            <div key={m.method} style={{background:C.faint,borderRadius:9,padding:"12px 14px"}}>
              <div style={{fontFamily:"monospace",fontSize:12,color:C.accent,fontWeight:600,marginBottom:4}}>{m.method}</div>
              <div style={{fontSize:12,color:C.muted,lineHeight:1.4}}>{m.desc}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── REPORT PAGE ───────────────────────────────────────────────────────────────
function ReportPage({result,onBack}){
  const reportRef=useRef();
  const ts=new Date().toLocaleString("en-GB",{dateStyle:"long",timeStyle:"short"});
  const overallR=RISK[result.overall_risk]||RISK.critical;
  const score=result.governance_score??12;

  async function downloadPDF(){
    const canvas=await html2canvas(reportRef.current,{scale:1.5,backgroundColor:"#060E1A",useCORS:true});
    const img=canvas.toDataURL("image/png");
    const pdf=new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
    const w=pdf.internal.pageSize.getWidth();
    const h=(canvas.height*w)/canvas.width;
    let pos=0;const ph=pdf.internal.pageSize.getHeight();
    pdf.addImage(img,"PNG",0,pos,w,h);
    while(pos+ph<h){pos+=ph;pdf.addPage();pdf.addImage(img,"PNG",0,-pos,w,h);}
    pdf.save(`AgentWatch_Report_${Date.now()}.pdf`);
  }

  return(
    <motion.div initial={{opacity:0}} animate={{opacity:1}} style={{background:C.bg,minHeight:"100vh",color:C.text,fontFamily:"'Inter',system-ui"}}>
      <div style={{background:C.panel,borderBottom:`1px solid ${C.border}`,padding:"13px 28px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <button onClick={onBack} style={{background:C.faint,border:`1px solid ${C.border}`,color:C.muted,borderRadius:7,padding:"6px 13px",fontSize:12,cursor:"pointer"}}>← Back</button>
          <div style={{color:C.text,fontSize:14,fontWeight:700}}>Governance Analysis Report</div>
        </div>
        <button onClick={downloadPDF} style={{background:C.accent,border:"none",color:"#fff",borderRadius:7,padding:"7px 16px",fontSize:12,cursor:"pointer",fontWeight:600}}>⬇ Download PDF</button>
      </div>
      <div ref={reportRef} style={{maxWidth:900,margin:"0 auto",padding:"28px 22px"}}>
        <div style={{background:`linear-gradient(135deg,${C.panel},#080F1C)`,border:`1px solid ${C.border}`,borderRadius:18,padding:"36px 44px",marginBottom:22,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${C.accent},${C.accent2})`}}/>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:20}}>
            <div>
              <div style={{color:C.muted,fontSize:12,marginBottom:6}}>{ts}</div>
              <div style={{fontSize:30,fontWeight:900,color:C.text,letterSpacing:"-0.02em",marginBottom:6}}>Governance Analysis Report</div>
              <div style={{fontSize:14,color:C.muted,marginBottom:14}}>System: <span style={{color:C.text,fontWeight:600}}>{result.system_name}</span></div>
              <RiskBadge level={result.overall_risk}/>
            </div>
            <div style={{textAlign:"center"}}>
              <ScoreGauge score={score} size={110}/>
              <div style={{fontSize:11,color:overallR.text,fontWeight:600,marginTop:4}}>HIGHER = SAFER</div>
            </div>
          </div>
        </div>
        <Card style={{marginBottom:16}}>
          <div style={{fontSize:15,color:C.text,lineHeight:1.8,marginBottom:14}}>{result.headline}</div>
          <div style={{background:overallR.bg,border:`1px solid ${overallR.border}`,borderRadius:9,padding:"14px 18px"}}>
            <div style={{fontSize:11,color:overallR.text,fontWeight:700,marginBottom:6}}>KEY RECOMMENDATION</div>
            <div style={{fontSize:13,color:overallR.text,lineHeight:1.7}}>{result.top_recommendation}</div>
          </div>
        </Card>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
          {[
            {icon:"🔗",label:"Cascade Risk",  risk:result.cascade_risk,  score:result.cascade_score,  detail:result.cascade_detail},
            {icon:"⚔️",label:"Conflict Risk", risk:result.miscoord_risk, score:result.miscoord_score, detail:result.miscoord_detail},
            {icon:"👁",label:"Oversight Risk",risk:result.oversight_risk, score:result.oversight_score,detail:result.oversight_detail},
          ].map((m)=>{
            const r=RISK[m.risk]||RISK.medium;
            return(
              <div key={m.label} style={{background:r.bg,border:`1px solid ${r.border}`,borderRadius:12,padding:"16px 18px"}}>
                <div style={{fontSize:18,marginBottom:6}}>{m.icon}</div>
                <div style={{fontSize:10,color:r.text,opacity:0.7,fontWeight:600,textTransform:"uppercase",marginBottom:4}}>{m.label}</div>
                <div style={{fontSize:20,fontWeight:800,color:r.text,marginBottom:4}}>{m.score}</div>
                <div style={{fontSize:12,color:r.text,opacity:0.7,lineHeight:1.4}}>{m.detail}</div>
              </div>
            );
          })}
        </div>
        <motion.div initial={{opacity:0,scale:0.97}} animate={{opacity:1,scale:1}} transition={{delay:0.3}}
          style={{background:`linear-gradient(135deg,${overallR.bg},rgba(6,14,26,0.9))`,border:`2px solid ${overallR.border}`,borderRadius:18,padding:"44px",textAlign:"center"}}>
          <div style={{fontSize:11,color:overallR.text,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",marginBottom:14,opacity:0.7}}>Governance Verdict</div>
          <div style={{fontSize:34,fontWeight:900,color:overallR.text,letterSpacing:"-0.02em",marginBottom:14,lineHeight:1.1}}>
            {result.overall_risk==="critical"?"CRITICAL GOVERNANCE FAILURE":result.overall_risk==="high"?"HIGH GOVERNANCE RISK":result.overall_risk==="medium"?"MODERATE GOVERNANCE RISK":"LOW RISK SYSTEM"}
          </div>
          <div style={{fontSize:15,color:overallR.text,opacity:0.8,maxWidth:560,margin:"0 auto 20px",lineHeight:1.7}}>{result.headline}</div>
          <div style={{fontSize:11,color:C.muted,marginTop:16}}>Generated by AgentWatch · {ts}</div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function AgentWatch(){
  const [apiKey,setApiKey]=useState(()=>localStorage.getItem("aw_api_key")||null);
  const [activeTab,setActiveTab]=useState("command");
  const [dashData,setDashData]=useState(null);
  const [loading,setLoading]=useState(false);
  const [reportData,setReportData]=useState(null);
  const [lastRefresh,setLastRefresh]=useState(null);

  const fetchDashboard=useCallback(async(key=apiKey)=>{
    if(!key)return;
    setLoading(true);
    try{
      const res=await fetch(`${API}/v1/dashboard/${key}`);
      if(!res.ok)throw new Error("Invalid key");
      const data=await res.json();
      setDashData(data);
      setLastRefresh(new Date().toLocaleTimeString());
    }catch(e){
      localStorage.removeItem("aw_api_key");
      setApiKey(null);
    }
    setLoading(false);
  },[apiKey]);

  useEffect(()=>{if(apiKey)fetchDashboard();},[]);
  useEffect(()=>{
    if(!apiKey)return;
    const t=setInterval(()=>fetchDashboard(),15000);
    return()=>clearInterval(t);
  },[apiKey,fetchDashboard]);

  function handleLogin(key){setApiKey(key);fetchDashboard(key);}
  function handleLogout(){localStorage.removeItem("aw_api_key");localStorage.removeItem("aw_system_name");setApiKey(null);setDashData(null);}

  if(!apiKey)return <LoginPage onLogin={handleLogin}/>;
  if(reportData)return <ReportPage result={reportData} onBack={()=>setReportData(null)}/>;

  const score=dashData?.governance_score||0;
  const criticalAlerts=dashData?.active_alerts||0;
  const pendingGates=dashData?.pending_approvals||0;

  function renderContent(){
    if(loading&&!dashData)return <Spinner/>;
    switch(activeTab){
      case "command":    return <CommandCenter data={dashData}/>;
      case "alerts":     return <LiveAlerts data={dashData}/>;
      case "gates":      return <ApprovalGates data={dashData} apiKey={apiKey} onRefresh={fetchDashboard}/>;
      case "audit":      return <AuditTrail data={dashData}/>;
      case "agents":     return <AgentRegistry data={dashData}/>;
      case "leaderboard":return <Leaderboard/>;
      case "analyzer":   return <AnalyzerPage apiKey={apiKey} onResult={setReportData}/>;
      case "sdk":        return <SDKDocs apiKey={apiKey}/>;
      default:           return <CommandCenter data={dashData}/>;
    }
  }

  return(
    <div style={{fontFamily:"'Inter',system-ui,sans-serif",background:C.bg,minHeight:"100vh",color:C.text,display:"flex"}}>
      {/* SIDEBAR */}
      <div style={{width:220,background:C.panel,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0,position:"sticky",top:0,height:"100vh",overflowY:"auto"}}>
        <div style={{padding:"18px 16px 12px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:C.green,animation:"pulse 2s infinite"}}/>
            <span style={{color:C.accent,fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase"}}>AgentWatch</span>
          </div>
          <div style={{color:C.text,fontSize:14,fontWeight:800}}>Governance OS</div>
          <div style={{color:C.muted,fontSize:10,marginTop:1}}>v2.0 · LIVE</div>
          {lastRefresh&&<div style={{color:C.muted,fontSize:9,marginTop:2}}>Updated: {lastRefresh}</div>}
        </div>

        <div style={{padding:"8px 8px",flex:1}}>
          {NAV_ITEMS.map(item=>(
            <button key={item.id} onClick={()=>setActiveTab(item.id)}
              style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 10px",borderRadius:8,border:"none",
                background:activeTab===item.id?"rgba(232,89,60,0.12)":"transparent",
                color:activeTab===item.id?C.accent:C.muted,cursor:"pointer",textAlign:"left",marginBottom:1,
                borderLeft:activeTab===item.id?`2px solid ${C.accent}`:"2px solid transparent",
                fontSize:12,fontWeight:activeTab===item.id?700:400,transition:"all 0.15s"}}>
              <span style={{fontSize:14}}>{item.icon}</span>
              <span style={{flex:1}}>{item.label}</span>
              {item.id==="alerts"&&criticalAlerts>0&&<span style={{background:C.red,color:"#fff",borderRadius:10,padding:"1px 6px",fontSize:10,fontWeight:700}}>{criticalAlerts}</span>}
              {item.id==="gates"&&pendingGates>0&&<span style={{background:C.orange,color:"#fff",borderRadius:10,padding:"1px 6px",fontSize:10,fontWeight:700}}>{pendingGates}</span>}
            </button>
          ))}
        </div>

        <div style={{padding:"12px 14px",borderTop:`1px solid ${C.border}`}}>
          <div style={{fontSize:10,color:C.muted,marginBottom:2}}>System</div>
          <div style={{fontSize:12,color:C.text,fontWeight:600,marginBottom:8,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{dashData?.system?.name||"..."}</div>
          <div style={{fontSize:10,color:C.muted,marginBottom:4}}>GovernanceScore™</div>
          <div style={{fontSize:22,fontWeight:900,color:score<25?C.red:score<50?C.orange:score<75?C.yellow:C.green}}>{score}<span style={{fontSize:11,color:C.muted,fontWeight:400}}>/100</span></div>
          <div style={{background:C.faint,borderRadius:3,height:4,marginTop:4,marginBottom:8}}>
            <div style={{width:`${score}%`,height:"100%",background:score<25?C.red:score<50?C.orange:score<75?C.yellow:C.green,borderRadius:3,transition:"width 0.5s"}}/>
          </div>
          <button onClick={()=>fetchDashboard()} style={{width:"100%",background:C.faint,border:`1px solid ${C.border}`,color:C.muted,borderRadius:6,padding:"5px",fontSize:10,cursor:"pointer",marginBottom:6}}>↻ Refresh</button>
          <button onClick={handleLogout} style={{width:"100%",background:"rgba(239,68,68,0.1)",border:`1px solid ${C.red}`,color:"#FCA5A5",borderRadius:6,padding:"5px",fontSize:10,cursor:"pointer"}}>⏏ Logout</button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{flex:1,overflowY:"auto",padding:"24px 28px",minWidth:0}}>
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:0.2}}>
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes spin{to{transform:rotate(360deg)}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:${C.bg}}
        ::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}
        input::placeholder,textarea::placeholder{color:${C.muted};opacity:0.6}
      `}</style>
    </div>
  );
}

