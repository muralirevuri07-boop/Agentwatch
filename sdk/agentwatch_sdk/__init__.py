import time
import json
import uuid
import threading
import functools
import requests
from typing import Optional, Callable, Any, Dict
from datetime import datetime
 
__version__ = "1.0.0"
__author__ = "Murali Revuri"
__email__ = "muralirevuri07@gmail.com"
 
AGENTWATCH_API = "http://localhost:8000"
 
# ── MAIN CLIENT ───────────────────────────────────────────────────────────────
class AgentWatchClient:
    def __init__(self, api_key: str, api_url: str = AGENTWATCH_API, verbose: bool = True):
        self.api_key = api_key
        self.api_url = api_url.rstrip("/")
        self.verbose = verbose
        self._session = requests.Session()
        self._session.headers.update({"Content-Type": "application/json"})
        self._queue = []
        self._lock = threading.Lock()
        self._verify_connection()
 
    def _verify_connection(self):
        try:
            res = self._session.get(f"{self.api_url}/v1/dashboard/{self.api_key}", timeout=5)
            if res.status_code == 200:
                data = res.json()
                system_name = data.get("system", {}).get("name", "Unknown")
                if self.verbose:
                    print(f"✅ AgentWatch connected: {system_name}")
                    print(f"📊 GovernanceScore™: {data.get('governance_score', 0)}/100")
                    print(f"🔍 Monitoring: {self.api_url}")
            else:
                print(f"⚠️  AgentWatch: Could not verify connection (status {res.status_code})")
        except Exception as e:
            print(f"⚠️  AgentWatch: Could not reach API — {e}")
 
    def _send_event(self, agent_name: str, event_type: str,
                    input_data: Any = None, output_data: Any = None,
                    confidence: float = None, decision_amount: float = None,
                    is_irreversible: bool = False, metadata: dict = None):
        payload = {
            "api_key": self.api_key,
            "agent_name": agent_name,
            "event_type": event_type,
            "input_data": str(input_data)[:1000] if input_data else None,
            "output_data": str(output_data)[:1000] if output_data else None,
            "confidence": confidence,
            "decision_amount": decision_amount,
            "is_irreversible": is_irreversible,
            "metadata": metadata or {},
        }
        try:
            res = self._session.post(f"{self.api_url}/v1/event", json=payload, timeout=5)
            result = res.json()
            if self.verbose and result.get("flagged"):
                print(f"\n🚨 AgentWatch Alert [{agent_name}]")
                print(f"   Risk: {result.get('risk_level', 'unknown').upper()}")
                print(f"   Action: {result.get('action', 'unknown')}")
                if result.get("cascade_detected"):
                    print(f"   ⚡ CASCADE FAILURE DETECTED")
                if result.get("oversight_required"):
                    print(f"   🔴 BLOCKED — Human approval required")
                print(f"   GovernanceScore™: {result.get('governance_score', 0)}/100\n")
            return result
        except Exception as e:
            if self.verbose:
                print(f"⚠️  AgentWatch: Failed to send event — {e}")
            return {}
 
    def monitor(self, func: Callable = None, *, agent_name: str = None,
                decision_amount: float = None, is_irreversible: bool = False):
        """
        Decorator to monitor any agent function.
        
        @aw.monitor
        def research_agent(query):
            return llm.run(query)
        
        @aw.monitor(agent_name="Finance Agent", decision_amount=50000, is_irreversible=True)
        def finance_agent(request):
            return process_payment(request)
        """
        def decorator(f):
            name = agent_name or f.__name__.replace("_", " ").title()
 
            @functools.wraps(f)
            def wrapper(*args, **kwargs):
                input_data = args[0] if args else str(kwargs)
                start = time.time()
                result = None
                error = None
                try:
                    result = f(*args, **kwargs)
                    return result
                except Exception as e:
                    error = str(e)
                    raise
                finally:
                    duration = round(time.time() - start, 3)
                    thread = threading.Thread(
                        target=self._send_event,
                        args=(name, f.__name__),
                        kwargs={
                            "input_data": input_data,
                            "output_data": result or error,
                            "confidence": None,
                            "decision_amount": decision_amount,
                            "is_irreversible": is_irreversible,
                            "metadata": {"duration_seconds": duration, "error": error}
                        },
                        daemon=True
                    )
                    thread.start()
            return wrapper
 
        if func is not None:
            return decorator(func)
        return decorator
 
    def track(self, agent_name: str, event_type: str,
              input_data: Any = None, output_data: Any = None,
              confidence: float = None, decision_amount: float = None,
              is_irreversible: bool = False):
        """
        Manual event tracking without decorator.
        
        aw.track(
            agent_name="CEO Agent",
            event_type="strategic_decision",
            input_data="Expand to London market",
            output_data="Approved $500K budget allocation",
            decision_amount=500000,
            is_irreversible=True
        )
        """
        return self._send_event(
            agent_name=agent_name,
            event_type=event_type,
            input_data=input_data,
            output_data=output_data,
            confidence=confidence,
            decision_amount=decision_amount,
            is_irreversible=is_irreversible
        )
 
    def dashboard(self):
        """Get current governance dashboard data."""
        try:
            res = self._session.get(f"{self.api_url}/v1/dashboard/{self.api_key}", timeout=5)
            return res.json()
        except Exception as e:
            print(f"⚠️  AgentWatch: {e}")
            return {}
 
    def score(self):
        """Get current GovernanceScore™."""
        data = self.dashboard()
        return data.get("governance_score", 0)
 
    def alerts(self):
        """Get active governance alerts."""
        data = self.dashboard()
        return data.get("alerts", [])
 
    def gates(self):
        """Get pending approval gates."""
        data = self.dashboard()
        return data.get("approval_gates", [])
 
    def kill(self, reason: str = "Emergency lockdown"):
        """Activate kill switch — freeze all agents immediately."""
        try:
            res = self._session.post(
                f"{self.api_url}/v2/killswitch/{self.api_key}",
                params={"reason": reason},
                timeout=5
            )
            result = res.json()
            print(f"🔴 KILL SWITCH ACTIVATED: {result.get('system_name')}")
            print(f"   Reason: {reason}")
            return result
        except Exception as e:
            print(f"⚠️  AgentWatch: Kill switch failed — {e}")
            return {}
 
    def validate_input(self, data: Any, baseline: Dict = None):
        """
        Validate agent input against known baselines.
        Returns True if safe, False if suspicious.
        
        safe = aw.validate_input(
            data={"tesla_market_share": 8.2},
            baseline={"tesla_market_share": {"min": 10, "max": 30}}
        )
        """
        if not baseline:
            return True
        if isinstance(data, dict):
            for key, value in data.items():
                if key in baseline:
                    rule = baseline[key]
                    if isinstance(rule, dict):
                        if "min" in rule and value < rule["min"]:
                            if self.verbose:
                                print(f"⚠️  Input validation failed: {key}={value} below min {rule['min']}")
                            return False
                        if "max" in rule and value > rule["max"]:
                            if self.verbose:
                                print(f"⚠️  Input validation failed: {key}={value} above max {rule['max']}")
                            return False
        return True
 
 
# ── LANGCHAIN INTEGRATION ─────────────────────────────────────────────────────
class AgentWatchLangChainCallback:
    """
    LangChain callback handler for automatic governance monitoring.
    
    from agentwatch import AgentWatchLangChainCallback
    
    callback = AgentWatchLangChainCallback(aw)
    chain = LLMChain(llm=llm, callbacks=[callback])
    """
    def __init__(self, client: AgentWatchClient):
        self.client = client
 
    def on_llm_start(self, serialized, prompts, **kwargs):
        self.client.track(
            agent_name="LangChain LLM",
            event_type="llm_start",
            input_data=str(prompts[0])[:500] if prompts else None
        )
 
    def on_llm_end(self, response, **kwargs):
        text = ""
        if hasattr(response, "generations") and response.generations:
            text = response.generations[0][0].text if response.generations[0] else ""
        self.client.track(
            agent_name="LangChain LLM",
            event_type="llm_end",
            output_data=str(text)[:500]
        )
 
    def on_chain_start(self, serialized, inputs, **kwargs):
        self.client.track(
            agent_name="LangChain Chain",
            event_type="chain_start",
            input_data=str(inputs)[:500]
        )
 
    def on_chain_end(self, outputs, **kwargs):
        self.client.track(
            agent_name="LangChain Chain",
            event_type="chain_end",
            output_data=str(outputs)[:500]
        )
 
    def on_agent_action(self, action, **kwargs):
        self.client.track(
            agent_name="LangChain Agent",
            event_type="agent_action",
            input_data=str(action.tool_input)[:500],
            output_data=str(action.tool)
        )
 
    def on_agent_finish(self, finish, **kwargs):
        self.client.track(
            agent_name="LangChain Agent",
            event_type="agent_finish",
            output_data=str(finish.return_values)[:500]
        )
 
 
# ── LANGGRAPH INTEGRATION ─────────────────────────────────────────────────────
class AgentWatchLangGraphMonitor:
    """
    LangGraph node wrapper for governance monitoring.
    
    from agentwatch import AgentWatchLangGraphMonitor
    
    monitor = AgentWatchLangGraphMonitor(aw)
    
    @monitor.node(agent_name="Research Node")
    def research_node(state):
        return {"output": llm.invoke(state["input"])}
    """
    def __init__(self, client: AgentWatchClient):
        self.client = client
 
    def node(self, func=None, *, agent_name=None, decision_amount=None, is_irreversible=False):
        def decorator(f):
            name = agent_name or f.__name__.replace("_", " ").title()
            @functools.wraps(f)
            def wrapper(state):
                input_data = str(state)[:500] if state else None
                result = f(state)
                output_data = str(result)[:500] if result else None
                threading.Thread(
                    target=self.client._send_event,
                    args=(name, f.__name__),
                    kwargs={
                        "input_data": input_data,
                        "output_data": output_data,
                        "decision_amount": decision_amount,
                        "is_irreversible": is_irreversible,
                    },
                    daemon=True
                ).start()
                return result
            return wrapper
        if func is not None:
            return decorator(func)
        return decorator
 
 
# ── CONNECT FUNCTION ──────────────────────────────────────────────────────────
def connect(api_key: str, api_url: str = AGENTWATCH_API, verbose: bool = True) -> AgentWatchClient:
    """
    Connect to AgentWatch governance monitoring.
    
    aw = agentwatch.connect(api_key="aw_live_...")
    """
    return AgentWatchClient(api_key=api_key, api_url=api_url, verbose=verbose)
 
 
# ── REGISTER NEW SYSTEM ───────────────────────────────────────────────────────
def register(name: str, email: str = None, api_url: str = AGENTWATCH_API) -> AgentWatchClient:
    """
    Register a new system and get an API key automatically.
    
    aw = agentwatch.register(name="My Agent System", email="you@example.com")
    """
    try:
        res = requests.post(
            f"{api_url}/v1/register",
            json={"name": name, "owner_email": email},
            timeout=10
        )
        data = res.json()
        api_key = data.get("api_key")
        print(f"✅ System registered: {name}")
        print(f"🔑 API Key: {api_key}")
        print(f"📜 Certificate: {data.get('certificate_hash', '')[:32]}...")
        print(f"\nSave your API key! You'll need it to reconnect.")
        return AgentWatchClient(api_key=api_key, api_url=api_url)
    except Exception as e:
        raise ConnectionError(f"AgentWatch registration failed: {e}")
 