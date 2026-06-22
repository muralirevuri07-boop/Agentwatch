import agentwatch

aw = agentwatch.connect(api_key="aw_live_6f32f712ccac48939c4a64e1338f6ed0")

@aw.monitor
def research_agent(query):
    return f"Research result for: {query}"

@aw.monitor(agent_name="Finance Agent", decision_amount=500000, is_irreversible=True)
def finance_agent(request):
    return f"Approved payment: {request}"

result1 = research_agent("Tesla EV market share 8.2%")
print(f"Research: {result1}")

result2 = finance_agent("Pay $500K to vendor")
print(f"Finance: {result2}")

print(f"\nGovernanceScore: {aw.score()}/100")
print(f"Active alerts: {len(aw.alerts())}")