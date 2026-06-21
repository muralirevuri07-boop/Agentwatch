import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const API = "http://localhost:8000";
const DEFAULT_KEY = "aw_live_653c9104a8a84db5b9bb081509b4ebc0";

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

// ── STATIC FALLBACKS ─────────────────────────────────────────────────────────
const RADAR_DATA = [
  {metric:"Input Validation",score:8},{metric:"Coordination",score:14},{metric:"Oversight",score:0},
  {metric:"Audit Trail",score:22},{metric:"Error Detection",score:10},{metric:"Accountability",score:12},
];

const EU_REQUIREMENTS = [
  {req:"Human Oversight Mechanisms",status:"fail",article:"Art. 14"},
  {req:"Technical Documentation",  status:"warn",article:"Art. 11"},
  {req:"Transparency & Explainability",status:"fail",article:"Art. 13"},
  {req:"Accuracy & Robustness",    status:"fail",article:"Art. 15"},
  {req:"Data Governance",          status:"warn",article:"Art. 10"},
  {req:"Conformity Assessment",    status:"fail",article:"Art. 43"},
  {req:"Post-market Monitoring",   status:"fail",article:"Art. 72"},
  {req:"Incident Reporting",       status:"warn",article:"Art. 73"},
];

const NIST_FUNCTIONS = [
  {fn:"GOVERN",desc:"Policies, accountability, culture",score:15,status:"fail"},
  {fn:"MAP",   desc:"Context, risk categorization",     score:28,status:"warn"},
  {fn:"MEASURE",desc:"Analysis, monitoring, evaluation",score:22,status:"warn"},
  {fn:"MANAGE",desc:"Prioritize, respond, recover",     score:8, status:"fail"},
];

const MEMORY_FACTS = [
  {fact:"Tesla EV market share is 8.2% in Q1 2025",verified:false,source:"Research Agent",risk:"critical"},
  {fact:"Global EV market size is $847B",          verified:false,source:"Web Intel",    risk:"high"},
  {fact:"BYD holds 41% market share",              verified:true, source:"Web Intel",    risk:"low"},
  {fact:"Q3 growth target is 40% QoQ",             verified:true, source:"CEO Agent",    risk:"medium"},
  {fact:"All agents proceed without approval",      verified:false,source:"Operations",  risk:"critical"},
];

const PII_FINDINGS = [
  {type:"Financial Data",  count:3,severity:"critical",example:"$100M unreviewed investment"},
  {type:"Vendor Contracts",count:2,severity:"high",    example:"Unnamed third-party agreement"},
  {type:"Personnel Data",  count:4,severity:"high",    example:"Engineer salaries disclosed"},
  {type:"Revenue Targets", count:1,severity:"medium",  example:"Q3 targets in press release"},
];

const NAV_ITEMS = [
  {id:"command",    icon:"⚡",label:"Command Center"},
  {id:"alerts",     icon:"🔔",label:"Live Alerts"},
  {id:"gates",      icon:"🚦",label:"Approval Gates"},
  {id:"audit",      icon:"📜",label:"Audit Trail"},
  {id:"agents",     icon:"🤖",label:"Agent Registry"},
  {id:"heatmap",    icon:"🌡",label:"Risk Heatmap"},
  {id:"eu",         icon:"🇪🇺",label:"EU AI Act"},
  {id:"nist",       icon:"🏛",label:"NIST RMF"},
  {id:"memory",     icon:"🧠",label:"Memory Inspector"},
  {id:"pii",        icon:"🔏",label:"PII Detection"},
  {id:"leaderboard",icon:"🏆",label:"Leaderboard"},
  {id:"connect",    icon:"🔌",label:"Connect System"},
  {id:"analyzer",   icon:"🔬",label:"Analyze System"},
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

function Card({children,style={}}){
  return <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"20px 22px",...style}}>{children}</div>;
}

function Spinner(){
  return <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:40}}>
    <div style={{width:32,height:32,border:`3px solid ${C.faint}`,borderTop:`3px solid ${C.accent}`,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
  </div>;
}

// ── COMMAND CENTER ────────────────────────────────────────────────────────────
function CommandCenter({data,loading,onRefresh}){
  if(loading)return <Spinner/>;
  if(!data)return <div style={{color:C.muted,textAlign:"center",padding:40}}>No data. Connect your system first.</div>;

  const score=data.governance_score||0;
  const scoreBreakdown=[
    {label:"Input Validation",   score:data.cascade_failures>0?8:60,  icon:"🛡"},
    {label:"Agent Coordination", score:data.total_events>0?14:50,     icon:"🔗"},
    {label:"Human Oversight",    score:Math.round(data.oversight_ratio||0),icon:"👁"},
    {label:"Accountability",     score:data.active_alerts>0?12:70,    icon:"⚖️"},
    {label:"Auditability",       score:22,                             icon:"📋"},
    {label:"Drift Resistance",   score:18,                             icon:"📡"},
  ];

  return(
    <div>
      <SectionHeader label="Governance Command Center" live/>
      <div style={{background:`linear-gradient(135deg,${C.panel},#080F1C)`,border:`1px solid ${C.border}`,borderRadius:16,padding:"28px 32px",marginBottom:20,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${C.accent},${C.accent2})`}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:20}}>
          <div>
            <div style={{fontSize:11,color:C.accent,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:6}}>AgentWatch · LIVE</div>
            <div style={{fontSize:28,fontWeight:900,color:C.text,letterSpacing:"-0.02em"}}>{data.system?.name||"Enterprise AI OS"}</div>
            <div style={{fontSize:13,color:C.muted,marginTop:4}}>Owner: {data.system?.owner_email} · Real-time governance monitoring</div>
            <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
              <RiskBadge level={score<25?"critical":score<50?"high":score<75?"medium":"low"}/>
              {data.active_alerts>0&&<span style={{background:"rgba(239,68,68,0.1)",color:"#FCA5A5",border:"1px solid #EF4444",borderRadius:5,padding:"3px 10px",fontSize:11,fontWeight:700}}>{data.active_alerts} ACTIVE ALERTS</span>}
              {data.pending_approvals>0&&<span style={{background:"rgba(245,158,11,0.1)",color:"#FCD34D",border:"1px solid #F59E0B",borderRadius:5,padding:"3px 10px",fontSize:11,fontWeight:700}}>{data.pending_approvals} BLOCKED DECISIONS</span>}
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
        {[
          {icon:"⚡",label:"Governance Score™",value:score,         severity:score<25?"critical":"high",sub:"Real-time calculated"},
          {icon:"👁",label:"Human Oversight",  value:`${data.oversight_ratio||0}%`,severity:"critical",sub:`${data.pending_approvals} decisions blocked`},
          {icon:"🔗",label:"Cascade Failures",  value:data.cascade_failures||0,    severity:data.cascade_failures>0?"critical":"low",sub:"Detected & logged"},
          {icon:"💬",label:"Total Events",       value:data.total_events||0,        severity:"medium",sub:"Agent actions tracked"},
          {icon:"🚨",label:"Active Alerts",      value:data.active_alerts||0,       severity:data.active_alerts>0?"critical":"low",sub:"Require attention"},
          {icon:"🔒",label:"Blocked Decisions",  value:data.pending_approvals||0,   severity:data.pending_approvals>0?"critical":"low",sub:"Awaiting human approval"},
        ].map((m,i)=>{
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
          {scoreBreakdown.map((s,i)=>(
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
            <RadarChart data={RADAR_DATA}>
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
              <div style={{fontSize:13,color:C.text,marginBottom:4}}>Certificate Hash</div>
              <div style={{fontSize:11,color:C.muted,fontFamily:"monospace"}}>{data.certificate.certificate_hash?.slice(0,32)}...</div>
            </div>
            <div>
              <div style={{fontSize:13,color:C.text,marginBottom:4}}>Valid Until</div>
              <div style={{fontSize:12,color:C.green}}>{new Date(data.certificate.valid_until).toLocaleDateString()}</div>
            </div>
            <div>
              <div style={{fontSize:13,color:C.text,marginBottom:4}}>EU AI Act</div>
              <div style={{fontSize:12,color:C.yellow,textTransform:"uppercase"}}>{data.certificate.compliance_eu_ai_act}</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── LIVE ALERTS ───────────────────────────────────────────────────────────────
function LiveAlerts({data,loading}){
  if(loading)return <Spinner/>;
  const alerts=data?.alerts||[];
  return(
    <div>
      <SectionHeader label="Real-Time Governance Alerts" live/>
      {alerts.length===0?(
        <Card><div style={{textAlign:"center",color:C.green,padding:24}}>✓ No active alerts</div></Card>
      ):(
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
                <div style={{fontSize:11,color:r.text,opacity:0.5}}>Agent: {al.agent_name} · Type: {al.alert_type}</div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── APPROVAL GATES ────────────────────────────────────────────────────────────
function ApprovalGates({data,loading,apiKey,onRefresh}){
  if(loading)return <Spinner/>;
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
      <div style={{background:"rgba(239,68,68,0.08)",border:"1px solid #EF4444",borderRadius:12,padding:"12px 18px",marginBottom:16}}>
        <span style={{fontSize:13,color:"#FCA5A5"}}>⚠ These decisions were BLOCKED by AgentWatch. Real human approval required before any action proceeds.</span>
      </div>
      {gates.length===0?(
        <Card><div style={{textAlign:"center",color:C.green,padding:24}}>✓ No pending approvals</div></Card>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {gates.map((g,i)=>{
            const statusColor=g.status==="approved"?C.green:g.status==="blocked"?C.red:C.yellow;
            return(
              <motion.div key={g.id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.07}}
                style={{background:C.card,border:`1px solid ${g.status==="blocked"?C.red:g.status==="approved"?C.green:C.border}`,borderRadius:12,padding:"18px 22px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:10}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4}}>{g.decision}</div>
                    <div style={{fontSize:12,color:C.muted,marginBottom:2}}>Impact: {g.impact}</div>
                    <div style={{fontSize:11,color:C.muted}}>Requested: {new Date(g.created_at).toLocaleString()}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
                    <RiskBadge level={g.risk_level}/>
                    <span style={{background:`${statusColor}22`,color:statusColor,border:`1px solid ${statusColor}`,borderRadius:5,padding:"3px 10px",fontSize:11,fontWeight:700,textTransform:"uppercase"}}>
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
function AuditTrail({data,loading}){
  const [search,setSearch]=useState("");
  if(loading)return <Spinner/>;
  const events=(data?.recent_events||[]).filter(e=>
    e.agent_name?.toLowerCase().includes(search.toLowerCase())||
    e.event_type?.toLowerCase().includes(search.toLowerCase())
  );
  return(
    <div>
      <SectionHeader label="Audit Trail" live/>
      <Card>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search events..."
          style={{width:"100%",padding:"8px 12px",background:C.faint,border:`1px solid ${C.border}`,borderRadius:8,fontSize:13,color:C.text,outline:"none",marginBottom:16,boxSizing:"border-box"}}/>
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
              {events.map((e,i)=>(
                <tr key={e.id} style={{borderBottom:`1px solid ${C.faint}`,background:e.flagged?"rgba(239,68,68,0.04)":"transparent"}}>
                  <td style={{padding:"9px 12px",color:C.muted,fontFamily:"monospace",fontSize:10}}>{new Date(e.created_at).toLocaleTimeString()}</td>
                  <td style={{padding:"9px 12px",color:C.text,fontWeight:600}}>{e.agent_name}</td>
                  <td style={{padding:"9px 12px",color:C.muted}}>{e.event_type}</td>
                  <td style={{padding:"9px 12px"}}><RiskBadge level={e.risk_level} small/></td>
                  <td style={{padding:"9px 12px",color:e.cascade_detected?C.red:C.green,fontWeight:700,fontSize:11}}>{e.cascade_detected?"⚡ YES":"✓ NO"}</td>
                  <td style={{padding:"9px 12px",color:e.oversight_required?C.red:C.green,fontWeight:700,fontSize:11}}>{e.oversight_required?"🔴 REQUIRED":"✓ OK"}</td>
                  <td style={{padding:"9px 12px",color:e.flagged?C.red:C.green,fontWeight:700,fontSize:11}}>{e.flagged?"⚠ YES":"✓ NO"}</td>
                </tr>
              ))}
              {events.length===0&&<tr><td colSpan={7} style={{padding:24,textAlign:"center",color:C.muted}}>No events yet. Send agent events to see them here.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── AGENT REGISTRY ────────────────────────────────────────────────────────────
function AgentRegistry({data,loading}){
  if(loading)return <Spinner/>;
  const agents=data?.agents||[];
  return(
    <div>
      <SectionHeader label="Agent Registry" live/>
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
              {agents.length===0&&<tr><td colSpan={6} style={{padding:24,textAlign:"center",color:C.muted}}>No agents tracked yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── RISK HEATMAP ──────────────────────────────────────────────────────────────
function RiskHeatmap({data}){
  const agents=data?.agents||[];
  const metrics=["Validation","Coordination","Oversight","Auditability"];
  const getRisk=(ag,metric)=>{
    if(metric==="Oversight"&&ag.cascades>0)return "critical";
    if(metric==="Validation"&&ag.cascades>0)return "critical";
    if(metric==="Coordination"&&ag.flagged>0)return "high";
    return ag.risk||"medium";
  };
  return(
    <div>
      <SectionHeader label="Governance Risk Heatmap" live/>
      <Card>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"separate",borderSpacing:4}}>
            <thead>
              <tr>
                <th style={{width:120,padding:"8px 12px",textAlign:"left",color:C.muted,fontSize:10,fontWeight:700,textTransform:"uppercase"}}>Agent</th>
                {metrics.map(m=>(
                  <th key={m} style={{padding:"8px 12px",textAlign:"center",color:C.muted,fontSize:10,fontWeight:700,textTransform:"uppercase"}}>{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(agents.length?agents:[{name:"No agents yet",risk:"low",flagged:0,cascades:0}]).map(ag=>(
                <tr key={ag.name}>
                  <td style={{padding:"8px 12px",color:C.text,fontWeight:700,fontSize:13}}>{ag.name}</td>
                  {metrics.map(m=>{
                    const level=getRisk(ag,m);
                    const r=RISK[level];
                    return(
                      <td key={m} style={{padding:4}}>
                        <motion.div whileHover={{scale:1.05}}
                          style={{background:r.bg,border:`1px solid ${r.border}`,borderRadius:8,padding:"12px 8px",textAlign:"center"}}>
                          <div style={{fontSize:10,fontWeight:700,color:r.text}}>{r.label}</div>
                        </motion.div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── EU AI ACT ─────────────────────────────────────────────────────────────────
function EUAIAct({data}){
  const score=data?.governance_score||0;
  const classification=score<30?"high_risk":score<60?"limited_risk":"minimal_risk";
  return(
    <div>
      <SectionHeader label="EU AI Act Compliance Mapper"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        {[
          {label:"Unacceptable Risk",desc:"Prohibited systems",       color:C.red,   active:false},
          {label:"High Risk",        desc:"Current classification",   color:C.orange,active:classification==="high_risk"},
          {label:"Limited Risk",     desc:"Transparency obligations", color:C.yellow,active:classification==="limited_risk"},
          {label:"Minimal Risk",     desc:"No specific obligations",  color:C.green, active:classification==="minimal_risk"},
        ].map(tier=>(
          <div key={tier.label} style={{background:tier.active?`${tier.color}18`:C.faint,border:`1px solid ${tier.active?tier.color:C.border}`,borderRadius:12,padding:"16px 18px",boxShadow:tier.active?`0 0 20px ${tier.color}30`:"none"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:tier.active?tier.color:C.text}}>{tier.label}</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>{tier.desc}</div>
              </div>
              {tier.active&&<span style={{background:`${tier.color}20`,color:tier.color,border:`1px solid ${tier.color}`,borderRadius:5,padding:"3px 10px",fontSize:11,fontWeight:700}}>CURRENT</span>}
            </div>
          </div>
        ))}
      </div>
      <Card>
        <div style={{fontSize:11,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:14}}>Compliance Requirements</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {EU_REQUIREMENTS.map((req,i)=>{
            const color=req.status==="fail"?C.red:req.status==="warn"?C.yellow:C.green;
            const icon=req.status==="fail"?"✗":req.status==="warn"?"⚠":"✓";
            return(
              <motion.div key={i} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:i*0.05}}
                style={{display:"flex",alignItems:"center",gap:12,background:C.faint,borderRadius:8,padding:"10px 14px"}}>
                <span style={{fontSize:14,color,fontWeight:700,width:20}}>{icon}</span>
                <span style={{flex:1,fontSize:13,color:C.text}}>{req.req}</span>
                <span style={{fontSize:11,color:C.muted,fontFamily:"monospace"}}>{req.article}</span>
                <span style={{fontSize:10,fontWeight:700,color,textTransform:"uppercase"}}>{req.status==="fail"?"FAIL":req.status==="warn"?"WARN":"PASS"}</span>
              </motion.div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ── NIST RMF ──────────────────────────────────────────────────────────────────
function NISTFramework(){
  return(
    <div>
      <SectionHeader label="NIST AI RMF Alignment"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14,marginBottom:16}}>
        {NIST_FUNCTIONS.map((fn,i)=>{
          const color=fn.status==="fail"?C.red:fn.status==="warn"?C.yellow:C.green;
          return(
            <motion.div key={fn.fn} initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:i*0.1}}
              style={{background:C.card,border:`1px solid ${fn.status==="fail"?C.red:C.border}`,borderRadius:14,padding:"20px 22px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                <div>
                  <div style={{fontSize:18,fontWeight:900,color,marginBottom:4}}>{fn.fn}</div>
                  <div style={{fontSize:12,color:C.muted}}>{fn.desc}</div>
                </div>
                <span style={{background:`${color}20`,color,border:`1px solid ${color}`,borderRadius:5,padding:"3px 10px",fontSize:11,fontWeight:700}}>{fn.status==="fail"?"FAIL":fn.status==="warn"?"WARN":"PASS"}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{flex:1,background:C.faint,borderRadius:4,height:6,overflow:"hidden"}}>
                  <motion.div initial={{width:0}} animate={{width:`${fn.score}%`}} transition={{delay:i*0.1+0.3,duration:0.8}}
                    style={{height:"100%",background:color,borderRadius:4}}/>
                </div>
                <span style={{fontSize:13,fontWeight:700,color}}>{fn.score}/100</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ── MEMORY INSPECTOR ──────────────────────────────────────────────────────────
function MemoryInspector(){
  return(
    <div>
      <SectionHeader label="Agent Memory Inspector"/>
      <Card>
        <div style={{display:"flex",gap:16,marginBottom:16}}>
          {[["Verified",MEMORY_FACTS.filter(f=>f.verified).length,C.green],["Unverified",MEMORY_FACTS.filter(f=>!f.verified).length,C.red],["Total",MEMORY_FACTS.length,C.accent2]].map(([l,v,c])=>(
            <div key={l} style={{background:C.faint,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 16px",textAlign:"center"}}>
              <div style={{fontSize:20,fontWeight:800,color:c}}>{v}</div>
              <div style={{fontSize:11,color:C.muted}}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {MEMORY_FACTS.map((f,i)=>{
            const r=RISK[f.risk];
            return(
              <motion.div key={i} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.05}}
                style={{background:r.bg,border:`1px solid ${r.border}`,borderRadius:10,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,color:r.text,marginBottom:3}}>{f.fact}</div>
                  <div style={{fontSize:11,color:r.text,opacity:0.6}}>Source: {f.source}</div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                  <RiskBadge level={f.risk} small/>
                  <span style={{fontSize:10,fontWeight:700,color:f.verified?C.green:C.red}}>{f.verified?"✓ VERIFIED":"✗ UNVERIFIED"}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ── PII DETECTION ─────────────────────────────────────────────────────────────
function PIIDetection(){
  return(
    <div>
      <SectionHeader label="PII & Sensitive Data Detection"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginBottom:16}}>
        {PII_FINDINGS.map((f,i)=>{
          const r=RISK[f.severity];
          return(
            <motion.div key={i} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.08}}
              style={{background:r.bg,border:`1px solid ${r.border}`,borderRadius:12,padding:"16px 18px",boxShadow:r.glow}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                <span style={{fontSize:13,fontWeight:700,color:r.text}}>{f.type}</span>
                <RiskBadge level={f.severity} small/>
              </div>
              <div style={{fontSize:24,fontWeight:900,color:r.text,marginBottom:4}}>{f.count} <span style={{fontSize:12}}>instances</span></div>
              <div style={{fontSize:12,color:r.text,opacity:0.7}}>Example: {f.example}</div>
            </motion.div>
          );
        })}
      </div>
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
        <span style={{fontSize:13,color:"#93C5FD"}}>🏆 World's first public benchmark for multi-agent AI governance. Real systems. Real scores.</span>
      </div>
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
          {boards.length===0&&<div style={{textAlign:"center",color:C.muted,padding:24}}>No systems registered yet.</div>}
        </div>
      </Card>
    </div>
  );
}

// ── CONNECT SYSTEM ────────────────────────────────────────────────────────────
function ConnectSystem({onConnect}){
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [loading,setLoading]=useState(false);
  const [result,setResult]=useState(null);
  const [error,setError]=useState(null);

  async function register(){
    if(!name.trim())return;
    setLoading(true);setError(null);
    try{
      const res=await fetch(`${API}/v1/register`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,owner_email:email})});
      const data=await res.json();
      setResult(data);
      onConnect(data.api_key);
    }catch(e){setError("Registration failed. Make sure backend is running.");}
    setLoading(false);
  }

  return(
    <div>
      <SectionHeader label="Connect Your Agent System"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Card>
          <div style={{fontSize:11,color:C.accent,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>Register New System</div>
          <div style={{fontSize:18,fontWeight:800,color:C.text,marginBottom:16}}>Connect any agent system</div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,color:C.muted,fontWeight:600,textTransform:"uppercase",marginBottom:6}}>System Name</div>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. My LangGraph System"
              style={{width:"100%",padding:"10px 14px",background:C.faint,border:`1px solid ${C.border}`,borderRadius:9,fontSize:13,color:C.text,outline:"none",boxSizing:"border-box"}}/>
          </div>
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,color:C.muted,fontWeight:600,textTransform:"uppercase",marginBottom:6}}>Owner Email</div>
            <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"
              style={{width:"100%",padding:"10px 14px",background:C.faint,border:`1px solid ${C.border}`,borderRadius:9,fontSize:13,color:C.text,outline:"none",boxSizing:"border-box"}}/>
          </div>
          <motion.button onClick={register} disabled={loading||!name.trim()} whileHover={{scale:1.01}} whileTap={{scale:0.99}}
            style={{width:"100%",background:loading?C.muted:`linear-gradient(135deg,${C.accent},#C0392B)`,border:"none",color:"#fff",borderRadius:10,padding:"13px",fontSize:14,fontWeight:700,cursor:loading?"default":"pointer"}}>
            {loading?"Registering...":"Register & Get API Key →"}
          </motion.button>
          {error&&<div style={{marginTop:12,background:RISK.critical.bg,border:`1px solid ${C.red}`,borderRadius:9,padding:"10px 14px",fontSize:13,color:"#FCA5A5"}}>{error}</div>}
        </Card>

        <Card>
          <div style={{fontSize:11,color:C.accent2,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>SDK Integration</div>
          <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:12}}>3 lines. Any agent. Any language.</div>
          <div style={{background:C.faint,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 16px",fontFamily:"monospace",fontSize:12,color:C.text,lineHeight:1.8,marginBottom:12}}>
            <div style={{color:"#86EFAC"}}># Install</div>
            <div>pip install agentwatch-sdk</div>
            <br/>
            <div style={{color:"#86EFAC"}}># Connect</div>
            <div>import agentwatch</div>
            <div>aw = agentwatch.connect(api_key=<span style={{color:C.accent}}>"aw_live_..."</span>)</div>
            <br/>
            <div style={{color:"#86EFAC"}}># Monitor any agent</div>
            <div>@aw.monitor</div>
            <div>def your_agent(input):</div>
            <div>    return llm.run(input)</div>
          </div>
          <div style={{fontSize:12,color:C.muted}}>Works with LangGraph, AutoGen, CrewAI, custom agents — any Python agent system.</div>
        </Card>
      </div>

      {result&&(
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} style={{marginTop:16}}>
          <Card style={{border:`1px solid ${C.green}`,boxShadow:`0 0 20px rgba(34,197,94,0.2)`}}>
            <div style={{fontSize:11,color:C.green,fontWeight:700,textTransform:"uppercase",marginBottom:12}}>✅ System Registered Successfully!</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
              <div style={{background:C.faint,borderRadius:9,padding:"12px 14px"}}>
                <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",fontWeight:600,marginBottom:4}}>API Key</div>
                <div style={{fontSize:12,color:C.green,fontFamily:"monospace",wordBreak:"break-all"}}>{result.api_key}</div>
              </div>
              <div style={{background:C.faint,borderRadius:9,padding:"12px 14px"}}>
                <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",fontWeight:600,marginBottom:4}}>Certificate Hash</div>
                <div style={{fontSize:11,color:C.accent2,fontFamily:"monospace"}}>{result.certificate_hash?.slice(0,32)}...</div>
              </div>
            </div>
            {result.qr_code_base64&&(
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:11,color:C.muted,marginBottom:8}}>Scan QR code to connect your agents</div>
                <img src={`data:image/png;base64,${result.qr_code_base64}`} alt="QR Code" style={{width:160,height:160,borderRadius:8}}/>
              </div>
            )}
          </Card>
        </motion.div>
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
      const res=await fetch(`${API}/v1/analyze`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({agent_outputs:logs,system_name:sysName||"Unknown System",api_key:apiKey})});
      const data=await res.json();
      if(data.detail)throw new Error(data.detail);
      onResult(data);
    }catch(e){setError(e.message||"Cannot reach AgentWatch API.");}
    setLoading(false);
  }

  return(
    <div>
      <SectionHeader label="Universal System Analyzer"/>
      <Card>
        <div style={{fontSize:20,fontWeight:800,color:C.text,marginBottom:4}}>Analyze any agent system</div>
        <div style={{fontSize:13,color:C.muted,marginBottom:24}}>Paste outputs from any multi-agent system. Powered by Groq Llama 3.3 70B. Results saved to your database.</div>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>System Name</div>
          <input value={sysName} onChange={e=>setSysName(e.target.value)} placeholder="e.g. Enterprise AI OS..."
            style={{width:"100%",padding:"11px 14px",background:C.faint,border:`1px solid ${C.border}`,borderRadius:9,fontSize:13,color:C.text,outline:"none",boxSizing:"border-box"}}/>
        </div>
        <div style={{marginBottom:20}}>
          <div style={{fontSize:11,color:C.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Agent Outputs</div>
          <textarea value={logs} onChange={e=>setLogs(e.target.value)}
            placeholder={"Paste raw agent outputs...\n\nAgentWatch detects:\n— Cascade failures\n— Agent miscoordination\n— Oversight gaps\n— PII exposure\n— Shadow agents"}
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
          <div>
            <div style={{color:C.accent,fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>AgentWatch</div>
            <div style={{color:C.text,fontSize:14,fontWeight:700}}>Governance Analysis Report</div>
          </div>
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
          <div style={{fontSize:11,color:C.muted,marginTop:16}}>Generated by AgentWatch · {ts} · Murali Revuri, 2026</div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function AgentWatch(){
  const [activeTab,setActiveTab]=useState("command");
  const [apiKey,setApiKey]=useState(DEFAULT_KEY);
  const [dashData,setDashData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [reportData,setReportData]=useState(null);
  const [lastRefresh,setLastRefresh]=useState(null);

  const fetchDashboard=useCallback(async(key=apiKey)=>{
    try{
      setLoading(true);
      const res=await fetch(`${API}/v1/dashboard/${key}`);
      const data=await res.json();
      setDashData(data);
      setLastRefresh(new Date().toLocaleTimeString());
    }catch(e){console.error(e);}
    setLoading(false);
  },[apiKey]);

  useEffect(()=>{fetchDashboard();},[]);
  useEffect(()=>{
    const t=setInterval(()=>fetchDashboard(),15000);
    return()=>clearInterval(t);
  },[fetchDashboard]);

  if(reportData)return <ReportPage result={reportData} onBack={()=>setReportData(null)}/>;

  function renderContent(){
    switch(activeTab){
      case "command":    return <CommandCenter data={dashData} loading={loading} onRefresh={fetchDashboard}/>;
      case "alerts":     return <LiveAlerts data={dashData} loading={loading}/>;
      case "gates":      return <ApprovalGates data={dashData} loading={loading} apiKey={apiKey} onRefresh={fetchDashboard}/>;
      case "audit":      return <AuditTrail data={dashData} loading={loading}/>;
      case "agents":     return <AgentRegistry data={dashData} loading={loading}/>;
      case "heatmap":    return <RiskHeatmap data={dashData}/>;
      case "eu":         return <EUAIAct data={dashData}/>;
      case "nist":       return <NISTFramework/>;
      case "memory":     return <MemoryInspector/>;
      case "pii":        return <PIIDetection/>;
      case "leaderboard":return <Leaderboard/>;
      case "connect":    return <ConnectSystem onConnect={k=>{setApiKey(k);fetchDashboard(k);}}/>;
      case "analyzer":   return <AnalyzerPage apiKey={apiKey} onResult={setReportData}/>;
      default:           return <CommandCenter data={dashData} loading={loading} onRefresh={fetchDashboard}/>;
    }
  }

  const score=dashData?.governance_score||0;
  const criticalAlerts=dashData?.active_alerts||0;

  return(
    <div style={{fontFamily:"'Inter',system-ui,sans-serif",background:C.bg,minHeight:"100vh",color:C.text,display:"flex"}}>
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
              {item.id==="gates"&&dashData?.pending_approvals>0&&<span style={{background:C.orange,color:"#fff",borderRadius:10,padding:"1px 6px",fontSize:10,fontWeight:700}}>{dashData.pending_approvals}</span>}
            </button>
          ))}
        </div>
        <div style={{padding:"12px 14px",borderTop:`1px solid ${C.border}`}}>
          <div style={{fontSize:10,color:C.muted,marginBottom:4}}>GovernanceScore™</div>
          <div style={{fontSize:22,fontWeight:900,color:score<25?C.red:score<50?C.orange:score<75?C.yellow:C.green}}>{score}<span style={{fontSize:11,color:C.muted,fontWeight:400}}>/100</span></div>
          <div style={{background:C.faint,borderRadius:3,height:4,marginTop:4}}>
            <div style={{width:`${score}%`,height:"100%",background:score<25?C.red:score<50?C.orange:score<75?C.yellow:C.green,borderRadius:3,transition:"width 0.5s"}}/>
          </div>
          <div style={{fontSize:10,color:score<25?C.red:C.green,marginTop:4,fontWeight:600}}>{score<25?"CRITICAL RISK":score<50?"HIGH RISK":score<75?"MEDIUM RISK":"LOW RISK"}</div>
          <button onClick={()=>fetchDashboard()} style={{marginTop:8,width:"100%",background:C.faint,border:`1px solid ${C.border}`,color:C.muted,borderRadius:6,padding:"5px",fontSize:10,cursor:"pointer"}}>↻ Refresh</button>
        </div>
      </div>

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
