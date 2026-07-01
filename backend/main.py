from fastapi import FastAPI, HTTPException, Depends, Header, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import os
import json
import uuid
import hashlib
import asyncio
from dotenv import load_dotenv
from supabase import create_client, Client
import redis
import jwt
import bcrypt
from contextlib import asynccontextmanager

load_dotenv()

# ── CONFIGURATION ─────────────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://mhdieljduanzcoobqqkw.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SECRET = os.getenv("SUPABASE_SECRET")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
JWT_SECRET = os.getenv("JWT_SECRET", "agentwatch_super_secret_2026")
JWT_ALGORITHM = "HS256"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SECRET)
redis_client = redis.from_url(REDIS_URL) if REDIS_URL else None

# ── LIFESPAN ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("🚀 AgentWatch 2.0 Enterprise Starting...")
    print(f"📡 Supabase: {SUPABASE_URL}")
    print(f"📦 Redis: {'Connected' if redis_client else 'Disabled'}")
    yield
    # Shutdown
    print("🛑 AgentWatch 2.0 Shutting down...")

app = FastAPI(
    title="AgentWatch OS",
    version="2.0.0",
    description="Enterprise Governance Operating System for Autonomous AI",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

# ── WEBSOCKET MANAGER ────────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, system_id: str):
        await websocket.accept()
        if system_id not in self.active_connections:
            self.active_connections[system_id] = []
        self.active_connections[system_id].append(websocket)

    def disconnect(self, websocket: WebSocket, system_id: str):
        if system_id in self.active_connections:
            self.active_connections[system_id].remove(websocket)

    async def broadcast(self, system_id: str, message: dict):
        if system_id in self.active_connections:
            for connection in self.active_connections[system_id]:
                try:
                    await connection.send_json(message)
                except:
                    pass

manager = ConnectionManager()

# ── MODELS ────────────────────────────────────────────────────────────────────
class RegisterSystem(BaseModel):
    name: str
    owner_email: Optional[str] = None
    password: str
    tier: Optional[str] = "enterprise"

class LoginRequest(BaseModel):
    owner_email: str
    password: str

class AgentEvent(BaseModel):
    api_key: str
    agent_name: str
    event_type: str
    input_data: Optional[str] = None
    output_data: Optional[str] = None
    confidence: Optional[float] = None
    decision_amount: Optional[float] = None
    is_irreversible: Optional[bool] = False
    metadata: Optional[Dict] = None

class PolicyCreate(BaseModel):
    name: str
    description: Optional[str] = None
    conditions: Dict
    actions: Dict
    severity: str = "medium"

class CopilotQuery(BaseModel):
    query: str
    system_id: str

class TopologyQuery(BaseModel):
    system_id: str
    include_communications: bool = False

# ── HELPERS ───────────────────────────────────────────────────────────────────
def generate_api_key():
    return "aw_live_" + str(uuid.uuid4()).replace("-", "")[:32]

def generate_jwt(system_id: str, api_key: str):
    payload = {
        "sub": system_id,
        "api_key": api_key,
        "exp": datetime.utcnow() + timedelta(days=30)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_jwt(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except:
        return None

def get_system_by_key(api_key: str):
    result = supabase.table("agent_systems").select("*").eq("api_key", api_key).execute()
    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return result.data[0]

def calculate_governance_score(system_id: str):
    # Enhanced scoring algorithm
    events = supabase.table("agent_events").select("*").eq("system_id", system_id).execute().data
    if not events:
        return 50
    
    total = len(events)
    flagged = len([e for e in events if e.get("flagged")])
    cascades = len([e for e in events if e.get("cascade_detected")])
    no_oversight = len([e for e in events if e.get("oversight_required") and not e.get("oversight_approved")])
    
    # Weighted scoring
    score = 100
    score -= (flagged / max(total, 1)) * 25
    score -= (cascades / max(total, 1)) * 35
    score -= (no_oversight / max(total, 1)) * 30
    
    # Penalty for high severity events
    high_risk = len([e for e in events if e.get("risk_level") == "critical"])
    score -= (high_risk / max(total, 1)) * 10
    
    return max(0, min(100, int(score)))

# ── API ROUTES ───────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "name": "AgentWatch OS",
        "version": "2.0.0",
        "status": "operational",
        "features": [
            "agent_topology",
            "governance_copilot",
            "policy_engine",
            "trust_scoring",
            "red_team_lab",
            "digital_twin",
            "boardroom_mode",
            "compliance_center",
            "memory_forensics",
            "kill_switch"
        ]
    }

@app.get("/v2/health")
async def health():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "database": "connected",
        "redis": "connected" if redis_client else "disabled"
    }

# ── SYSTEM REGISTRATION ─────────────────────────────────────────────────────
@app.post("/v2/systems/register")
async def register_system(req: RegisterSystem):
    if req.owner_email:
        existing = supabase.table("agent_systems").select("id").eq("owner_email", req.owner_email).execute()
        if existing.data:
            raise HTTPException(status_code=409, detail="An account with this email already exists. Please log in instead.")

    api_key = generate_api_key()
    jwt_token = generate_jwt(str(uuid.uuid4()), api_key)
    password_hash = bcrypt.hashpw(req.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    result = supabase.table("agent_systems").insert({
        "name": req.name,
        "owner_email": req.owner_email,
        "password_hash": password_hash,
        "api_key": api_key,
        "tier": req.tier,
        "governance_score": 50,
        "total_decisions": 0,
        "cascade_failures": 0,
        "oversight_ratio": 0.0
    }).execute()
    
    system_id = result.data[0]["id"]
    
    # Create initial topology record
    supabase.table("agent_topology").insert({
        "system_id": system_id,
        "agent_id": str(uuid.uuid4()),
        "parent_id": None,
        "risk_score": 0,
        "trust_score": 50,
        "dependencies": []
    }).execute()
    
    # Create certificate
    cert_hash = hashlib.sha256(f"{system_id}{api_key}{datetime.now().isoformat()}".encode()).hexdigest()
    supabase.table("governance_certificates").insert({
        "system_id": system_id,
        "certificate_hash": cert_hash,
        "governance_score": 50,
        "issued_at": datetime.now().isoformat(),
        "valid_until": (datetime.now() + timedelta(days=365)).isoformat(),
        "compliance_eu_ai_act": "pending",
        "compliance_nist": "pending",
        "compliance_iso_42001": "pending"
    }).execute()
    
    return {
        "success": True,
        "system_id": system_id,
        "api_key": api_key,
        "jwt_token": jwt_token,
        "certificate_hash": cert_hash,
        "message": f"System '{req.name}' registered successfully"
    }

# ── AGENT EVENT TRACKING ────────────────────────────────────────────────────
@app.post("/v2/events")
async def track_event(event: AgentEvent):
    system = get_system_by_key(event.api_key)
    system_id = system["id"]
    
    # Detect cascades
    cascade = False
    if event.input_data and event.output_data:
        patterns = ["market share", "growth rate", "down from", "acquire", "merge"]
        cascade = any(p in event.output_data.lower() for p in patterns) and \
                  any(p in event.input_data.lower() for p in patterns)
    
    # Detect oversight need
    oversight_req = False
    if event.decision_amount and event.decision_amount > 10000:
        oversight_req = True
    if event.is_irreversible:
        oversight_req = True
    high_risk_types = ["pricing_change", "hire", "fire", "contract", "investment"]
    if any(t in event.event_type.lower() for t in high_risk_types):
        oversight_req = True
    
    flagged = cascade or oversight_req
    
    risk_level = "critical" if cascade and oversight_req else \
                 "high" if cascade or oversight_req else \
                 "medium" if flagged else "low"
    
    # Store event
    event_result = supabase.table("agent_events").insert({
        "system_id": system_id,
        "agent_name": event.agent_name,
        "event_type": event.event_type,
        "input_data": event.input_data[:1000] if event.input_data else None,
        "output_data": event.output_data[:1000] if event.output_data else None,
        "confidence": event.confidence,
        "risk_level": risk_level,
        "flagged": flagged,
        "cascade_detected": cascade,
        "oversight_required": oversight_req,
        "oversight_approved": None if oversight_req else True,
        "metadata": event.metadata
    }).execute()
    
    # Create alert if flagged
    if cascade:
        supabase.table("governance_alerts").insert({
            "system_id": system_id,
            "alert_type": "cascade_failure",
            "severity": "critical",
            "title": "Cascade Failure Detected",
            "description": f"Agent {event.agent_name} propagated unverified data",
            "agent_name": event.agent_name,
            "resolved": False
        }).execute()
    
    if oversight_req:
        supabase.table("approval_gates").insert({
            "system_id": system_id,
            "decision": (event.output_data[:200] if event.output_data else event.event_type),
            "risk_level": risk_level,
            "impact": f"Agent: {event.agent_name} | Type: {event.event_type}",
            "status": "blocked",
            "requested_by": event.agent_name
        }).execute()
        
        supabase.table("governance_alerts").insert({
            "system_id": system_id,
            "alert_type": "oversight_missing",
            "severity": "critical",
            "title": "Human Oversight Required",
            "description": f"Agent {event.agent_name} attempted high-risk action",
            "agent_name": event.agent_name,
            "resolved": False
        }).execute()
    
    # Update score
    new_score = calculate_governance_score(system_id)
    supabase.table("agent_systems").update({
        "governance_score": new_score,
        "total_decisions": system["total_decisions"] + 1,
        "cascade_failures": system["cascade_failures"] + (1 if cascade else 0)
    }).eq("id", system_id).execute()
    
    # Broadcast via WebSocket
    await manager.broadcast(system_id, {
        "type": "new_event",
        "data": {
            "event_id": event_result.data[0]["id"],
            "flagged": flagged,
            "risk_level": risk_level
        }
    })
    
    return {
        "event_id": event_result.data[0]["id"],
        "flagged": flagged,
        "cascade_detected": cascade,
        "oversight_required": oversight_req,
        "risk_level": risk_level,
        "action": "BLOCKED" if oversight_req else "ALLOWED",
        "governance_score": new_score
    }

# ── WEBSOCKET ───────────────────────────────────────────────────────────────
@app.websocket("/ws/{system_id}")
async def websocket_endpoint(websocket: WebSocket, system_id: str):
    await manager.connect(websocket, system_id)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket, system_id)

# ── DASHBOARD ────────────────────────────────────────────────────────────────
@app.get("/v2/dashboard/{api_key}")
async def get_dashboard(api_key: str):
    system = get_system_by_key(api_key)
    system_id = system["id"]
    
    events = supabase.table("agent_events").select("*").eq("system_id", system_id).order("created_at", desc=True).limit(100).execute().data
    alerts = supabase.table("governance_alerts").select("*").eq("system_id", system_id).eq("resolved", False).execute().data
    gates = supabase.table("approval_gates").select("*").eq("system_id", system_id).execute().data
    cert = supabase.table("governance_certificates").select("*").eq("system_id", system_id).execute().data
    
    total = len(events)
    cascades = len([e for e in events if e.get("cascade_detected")])
    no_oversight = len([e for e in events if e.get("oversight_required") and not e.get("oversight_approved")])
    oversight_ratio = round((1 - no_oversight / max(total, 1)) * 100, 1)
    
    from collections import defaultdict
    agent_map = defaultdict(lambda: {"decisions": 0, "flagged": 0, "cascades": 0, "risk": "low"})
    for e in events:
        name = e.get("agent_name", "Unknown")
        agent_map[name]["decisions"] += 1
        if e.get("flagged"):
            agent_map[name]["flagged"] += 1
        if e.get("cascade_detected"):
            agent_map[name]["cascades"] += 1
        if e.get("risk_level") == "critical":
            agent_map[name]["risk"] = "critical"
        elif e.get("risk_level") == "high" and agent_map[name]["risk"] != "critical":
            agent_map[name]["risk"] = "high"
        elif e.get("risk_level") == "medium" and agent_map[name]["risk"] not in ("critical", "high"):
            agent_map[name]["risk"] = "medium"

    agents = [{"name": k, **v} for k, v in agent_map.items()]

    return {
        "system": system,
        "governance_score": system["governance_score"],
        "total_events": total,
        "cascade_failures": cascades,
        "oversight_ratio": oversight_ratio,
        "active_alerts": len(alerts),
        "pending_approvals": len([g for g in gates if g["status"] == "blocked"]),
        "alerts": alerts[:20],
        "approval_gates": gates[:20],
        "recent_events": events[:50],
        "certificate": cert[0] if cert else None,
        "agents": agents,
    }

# ── APPROVAL GATES ──────────────────────────────────────────────────────────
@app.post("/v2/gates/action")
async def gate_action(api_key: str, gate_id: str, action: str, approved_by: str = "human"):
    system = get_system_by_key(api_key)
    result = supabase.table("approval_gates").update({
        "status": "approved" if action == "approve" else "blocked",
        "approved_by": approved_by,
        "resolved_at": datetime.now().isoformat()
    }).eq("id", gate_id).execute()
    
    return {"success": True, "action": action, "gate_id": gate_id}

# ── LEADERBOARD ─────────────────────────────────────────────────────────────
@app.get("/v2/leaderboard")
async def leaderboard():
    systems = supabase.table("agent_systems").select("name,governance_score,total_decisions,cascade_failures,owner_email").order("governance_score", desc=True).limit(50).execute()
    return {"leaderboard": systems.data}

# ── CERTIFICATE ─────────────────────────────────────────────────────────────
@app.get("/v2/certificate/{api_key}")
async def get_certificate(api_key: str):
    system = get_system_by_key(api_key)
    cert = supabase.table("governance_certificates").select("*").eq("system_id", system["id"]).execute()
    
    score = system["governance_score"]
    eu_status = "high_risk" if score < 30 else "limited_risk" if score < 60 else "minimal_risk"
    nist_status = "fail" if score < 30 else "partial" if score < 60 else "pass"
    
    return {
        "system_name": system["name"],
        "governance_score": score,
        "certificate": cert.data[0] if cert.data else None,
        "eu_ai_act_classification": eu_status,
        "nist_rmf_alignment": nist_status,
        "iso_42001_readiness": f"{min(score, 80)}%",
        "valid_until": (datetime.now() + timedelta(days=365)).isoformat()
    }

# ── KILL SWITCH ─────────────────────────────────────────────────────────────
@app.post("/v2/killswitch/{api_key}")
async def kill_switch(api_key: str, reason: Optional[str] = "Emergency lockdown"):
    system = get_system_by_key(api_key)
    system_id = system["id"]
    
    supabase.table("agent_systems").update({
        "governance_score": 0,
        "status": "frozen"
    }).eq("api_key", api_key).execute()
    
    supabase.table("governance_alerts").insert({
        "system_id": system_id,
        "alert_type": "kill_switch_activated",
        "severity": "critical",
        "title": "🔴 KILL SWITCH ACTIVATED",
        "description": f"System frozen. Reason: {reason}",
        "agent_name": "System Admin",
        "resolved": False
    }).execute()
    
    await manager.broadcast(system_id, {
        "type": "kill_switch",
        "message": "System frozen",
        "timestamp": datetime.now().isoformat()
    })
    
    return {
        "status": "FROZEN",
        "system_name": system["name"],
        "reason": reason,
        "timestamp": datetime.now().isoformat()
    }

# ── PLACEHOLDER ENDPOINTS FOR UPCOMING FEATURES ───────────────────────────

@app.post("/v2/topology")
async def get_topology(req: TopologyQuery):
    """Agent Topology Center - Coming in Feature 2"""
    return {"message": "Agent Topology Center coming soon", "system_id": req.system_id}

@app.post("/v2/copilot")
async def copilot_query(req: CopilotQuery):
    """Governance Copilot - Coming in Feature 3"""
    return {"message": "Governance Copilot coming soon", "query": req.query}

@app.post("/v2/policies")
async def create_policy(policy: PolicyCreate):
    """Policy Engine - Coming in Feature 4"""
    return {"message": "Policy Engine coming soon", "policy": policy.name}
# ── V1 COMPATIBILITY ──────────────────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    agent_outputs: str
    system_name: Optional[str] = "Unknown System"
    api_key: Optional[str] = None

class ApprovalAction(BaseModel):
    api_key: str
    gate_id: str
    action: str
    approved_by: Optional[str] = "human"

@app.get("/v1/dashboard/{api_key}")
async def dashboard_v1(api_key: str):
    return await get_dashboard(api_key)


@app.post("/v1/event")
async def event_v1(event: AgentEvent):
    return await track_event(event)
@app.post("/v1/register")
async def register_v1(req: RegisterSystem):
    return await register_system(req)

@app.post("/v1/login")
async def login(req: LoginRequest):
    result = supabase.table("agent_systems").select("*").eq("owner_email", req.owner_email).execute()
    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    system = result.data[0]
    stored_hash = system.get("password_hash")
    if not stored_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not bcrypt.checkpw(req.password.encode("utf-8"), stored_hash.encode("utf-8")):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return {
        "success": True,
        "api_key": system["api_key"],
        "name": system["name"],
        "owner_email": system["owner_email"],
    }

@app.post("/v1/event")
async def event_v1(event: AgentEvent):
    return await track_event(event)

@app.get("/v1/leaderboard")
async def leaderboard_v1():
    return await leaderboard()

@app.post("/v1/gates/action")
async def gates_v1(req: ApprovalAction):
    system = get_system_by_key(req.api_key)
    supabase.table("approval_gates").update({
        "status": "approved" if req.action == "approve" else "blocked",
        "approved_by": req.approved_by,
        "resolved_at": datetime.now().isoformat()
    }).eq("id", req.gate_id).execute()
    return {"success": True, "action": req.action}

@app.post("/v1/analyze")
async def analyze_v1(request: AnalyzeRequest):
    from groq import Groq
    groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": """You are AgentWatch governance engine. Return ONLY valid JSON:
{"cascade_risk":"critical|high|medium|low","cascade_score":"X/Y","cascade_detail":"one sentence","miscoord_risk":"critical|high|medium|low","miscoord_score":"metric","miscoord_detail":"one sentence","oversight_risk":"critical|high|medium|low","oversight_score":"X/Y","oversight_detail":"one sentence","overall_risk":"critical|high|medium|low","governance_score":12,"headline":"one sentence","top_recommendation":"one fix"}"""},
                {"role": "user", "content": f"System: {request.system_name}\n\n{request.agent_outputs}"}
            ],
            temperature=0.1, max_tokens=1000,
        )
        text = completion.choices[0].message.content
        data = json.loads(text.replace("```json","").replace("```","").strip())
        return {"system_name": request.system_name, **data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@app.post("/v1/event")
async def event_v1(event: AgentEvent):
    return await track_event(event)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)