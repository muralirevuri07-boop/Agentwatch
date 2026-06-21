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

AGENTWATCH_API = "http://localhost:8000"

class AgentWatchClient:
    def __init__(self, api_key, api_url=AGENTWATCH_API, verbose=True):
        self.api_key = api_key
        self.api_url = api_url.rstrip("/")
        self.verbose = verbose
        self._session = requests.Session()
        self._session.headers.update({"Content-Type": "application/json"})
        self._verify_connection()

    def _verify_connection(self):
        try:
            res = self._session.get(f"{self.api_url}/v1/dashboard/{self.api_key}", timeout=5)
            if res.status_code == 200:
                data = res.json()
                name = data.get("system", {}).get("name", "Unknown")
                if self.verbose:
                    print(f"AgentWatch connected: {name}")
                    print(f"GovernanceScore: {data.get('governance_score', 0)}/100")
        except Exception as e:
            print(f"AgentWatch: Could not reach API - {e}")

    def _send_event(self, agent_name, event_type, input_data=None, output_data=None,
                    confidence=None, decision_amount=None, is_irreversible=False, metadata=None):
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
                print(f"ALERT [{agent_name}] Risk: {result.get('risk_level','').upper()} | Action: {result.get('action')}")
                if result.get("cascade_detected"):
                    print(f"  CASCADE FAILURE DETECTED")
                if result.get("oversight_required"):
                    print(f"  BLOCKED - Human approval required")
                print(f"  GovernanceScore: {result.get('governance_score', 0)}/100")
            return result
        except Exception as e:
            if self.verbose:
                print(f"AgentWatch: Failed to send event - {e}")
            return {}

    def monitor(self, func=None, *, agent_name=None, decision_amount=None, is_irreversible=False):
        def decorator(f):
            name = agent_name or f.__name__.replace("_", " ").title()
            @functools.wraps(f)
            def wrapper(*args, **kwargs):
                input_data = args[0] if args else str(kwargs)
                result = None
                error = None
                try:
                    result = f(*args, **kwargs)
                    return result
                except Exception as e:
                    error = str(e)
                    raise
                finally:
                    threading.Thread(
                        target=self._send_event,
                        args=(name, f.__name__),
                        kwargs={"input_data": input_data, "output_data": result or error,
                                "decision_amount": decision_amount, "is_irreversible": is_irreversible},
                        daemon=True
                    ).start()
            return wrapper
        if func is not None:
            return decorator(func)
        return decorator

    def track(self, agent_name, event_type, input_data=None, output_data=None,
              confidence=None, decision_amount=None, is_irreversible=False):
        return self._send_event(agent_name, event_type, input_data, output_data,
                                confidence, decision_amount, is_irreversible)

    def score(self):
        try:
            res = self._session.get(f"{self.api_url}/v1/dashboard/{self.api_key}", timeout=5)
            return res.json().get("governance_score", 0)
        except:
            return 0

    def alerts(self):
        try:
            res = self._session.get(f"{self.api_url}/v1/dashboard/{self.api_key}", timeout=5)
            return res.json().get("alerts", [])
        except:
            return []

    def gates(self):
        try:
            res = self._session.get(f"{self.api_url}/v1/dashboard/{self.api_key}", timeout=5)
            return res.json().get("approval_gates", [])
        except:
            return []

    def kill(self, reason="Emergency lockdown"):
        try:
            res = self._session.post(f"{self.api_url}/v2/killswitch/{self.api_key}",
                                     params={"reason": reason}, timeout=5)
            result = res.json()
            print(f"KILL SWITCH ACTIVATED: {result.get('system_name')}")
            return result
        except Exception as e:
            print(f"AgentWatch: Kill switch failed - {e}")
            return {}


def connect(api_key, api_url=AGENTWATCH_API, verbose=True):
    return AgentWatchClient(api_key=api_key, api_url=api_url, verbose=verbose)


def register(name, email=None, api_url=AGENTWATCH_API):
    try:
        res = requests.post(f"{api_url}/v1/register",
                            json={"name": name, "owner_email": email}, timeout=10)
        data = res.json()
        api_key = data.get("api_key")
        print(f"System registered: {name}")
        print(f"API Key: {api_key}")
        return AgentWatchClient(api_key=api_key, api_url=api_url)
    except Exception as e:
        raise ConnectionError(f"Registration failed: {e}")