import re

# 1. Read Original
with open('frontend/src/components/DecisionIntelligenceView.tsx', 'r', encoding='utf-8') as f:
    original = f.read()

# Restore original if we messed it up earlier (Wait, did we write to it?)
with open('.git/logs/HEAD', 'r') as f:
    # Just grab it from git to be safe
    pass

import subprocess
subprocess.run(['git', 'checkout', 'frontend/src/components/DecisionIntelligenceView.tsx'])
with open('frontend/src/components/DecisionIntelligenceView.tsx', 'r', encoding='utf-8') as f:
    original = f.read()

# 2. Extract Guardrails UI to GuardrailsDashboard.tsx
guard_code = original.replace('DecisionIntelligenceView', 'GuardrailsDashboard')

# In guard_code, we need to remove the Optimization Lab UI.
# Find Phase 7.2 Optimization Lab block and remove everything from its start to the start of Phase 7.3
phase_7_2_start = guard_code.find('{/* Phase 7.2 Optimization Lab */}')
phase_7_3_start = guard_code.find('{/* Phase 7.3 Executive Recommendations UI */}')

if phase_7_2_start != -1 and phase_7_3_start != -1:
    # Find the Non-Causal disclaimer
    non_causal_start = guard_code.find('{/* Non-Causal Model Disclaimer */}')
    if non_causal_start != -1 and non_causal_start < phase_7_3_start:
        phase_7_3_start = non_causal_start
    
    guard_code = guard_code[:phase_7_2_start] + guard_code[phase_7_3_start:]

# Change headers
guard_code = guard_code.replace(
    'Phase 7.2 Decision Optimization Engine',
    'Phase 7.4 Decision Guardrails'
).replace(
    'Decision Optimization & Scenario Ranking',
    'Decision Guardrails & Feasibility Audit'
).replace(
    'Discover controllable feature levers, generate deterministic what-if combinations, and rank scenarios by business objective.',
    'Evaluate strategic decisions against safety boundaries, feasibility constraints, and compliance rules.'
)

# Change Next Action to hidden
guard_code = guard_code.replace(
    "onClick={() => onNavigate('decisions')}",
    "onClick={() => {}} className=\"hidden\""
)
guard_code = guard_code.replace("CONTINUE TO DECISIONS", "")

with open('frontend/src/components/GuardrailsDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(guard_code)


# 3. Clean up DecisionIntelligenceView.tsx
opt_code = original

# Remove Phase 7.3 UI and Phase 7.4 UI from it
# Find Phase 7.3 start
phase_7_3_start = opt_code.find('{/* Phase 7.3 Executive Recommendations UI */}')
# Find 07 - NEXT ACTION start
next_action_start = opt_code.find('{/* 07 - NEXT ACTION */}')

if phase_7_3_start != -1 and next_action_start != -1:
    opt_code = opt_code[:phase_7_3_start] + opt_code[next_action_start:]

with open('frontend/src/components/DecisionIntelligenceView.tsx', 'w', encoding='utf-8') as f:
    f.write(opt_code)

print("Extraction script complete.")
