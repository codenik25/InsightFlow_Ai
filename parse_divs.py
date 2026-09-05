import sys

def find_matching_brace(text, start_idx):
    count = 0
    for i in range(start_idx, len(text)):
        if text[i:i+4] == '<div':
            count += 1
        elif text[i:i+5] == '</div':
            count -= 1
            if count == 0:
                return i + 6 # end of '</div>'
    return -1

with open('frontend/src/components/DecisionIntelligenceView.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# For GuardrailsDashboard
guard_code = text.replace('DecisionIntelligenceView', 'GuardrailsDashboard')

# 1. Find Phase 7.2 Lab block
start_tag = '{/* Phase 7.2 Optimization Lab */}'
lab_start = guard_code.find(start_tag)

# The lab is enclosed in a div immediately following the comment.
# Let's find the first <div after the comment
div_start = guard_code.find('<div', lab_start)
div_end = find_matching_brace(guard_code, div_start)

if div_start != -1 and div_end != -1:
    guard_code = guard_code[:lab_start] + guard_code[div_end:]

# 2. Find Non-Causal Model Disclaimer block
nc_start_tag = '{/* Non-Causal Model Disclaimer */}'
nc_start = guard_code.find(nc_start_tag)
if nc_start != -1:
    nc_div_start = guard_code.find('<div', nc_start)
    nc_div_end = find_matching_brace(guard_code, nc_div_start)
    if nc_div_end != -1:
        guard_code = guard_code[:nc_start] + guard_code[nc_div_end:]

# Also change header
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

# Replace NEXT ACTION button with a hidden one
guard_code = guard_code.replace(
    "onClick={() => onNavigate('decisions')}",
    "onClick={() => {}} className=\"hidden\""
)
guard_code = guard_code.replace("CONTINUE TO DECISIONS", "COMPLETE")

with open('frontend/src/components/GuardrailsDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(guard_code)


# Now for DecisionIntelligenceView.tsx
opt_code = text

# Remove Phase 7.3 block
p73_start_tag = '{/* Phase 7.3 Executive Recommendations UI */}'
p73_start = opt_code.find(p73_start_tag)
if p73_start != -1:
    p73_div_start = opt_code.find('<div', p73_start)
    p73_div_end = find_matching_brace(opt_code, p73_div_start)
    if p73_div_end != -1:
        opt_code = opt_code[:p73_start] + opt_code[p73_div_end:]

with open('frontend/src/components/DecisionIntelligenceView.tsx', 'w', encoding='utf-8') as f:
    f.write(opt_code)

print("Done.")
