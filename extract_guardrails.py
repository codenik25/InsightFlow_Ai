import re

with open('frontend/src/components/DecisionIntelligenceView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

guardrails_content = content.replace('DecisionIntelligenceView', 'GuardrailsDashboard')

guardrails_content = re.sub(
    r'\{\/\* Phase 7\.2 Optimization Lab \*\/}.*?(?=\{\/\* Phase 7\.3 Executive Recommendations UI \*\/})',
    r'',
    guardrails_content,
    flags=re.DOTALL
)

guardrails_content = re.sub(
    r'\{\/\* Non-Causal Model Disclaimer \*\/}.*?(?=\{\/\* Phase 7\.3 Executive Recommendations UI \*\/})',
    r'',
    guardrails_content,
    flags=re.DOTALL
)

guardrails_content = re.sub(
    r'onClick=\{\(\) => onNavigate\(\'decisions\'\)\}',
    r'onClick={() => {}} className="hidden"',
    guardrails_content
)

guardrails_content = guardrails_content.replace(
    'Phase 7.2 Decision Optimization Engine',
    'Phase 7.4 Decision Guardrails'
).replace(
    'Decision Optimization & Scenario Ranking',
    'Decision Guardrails & Feasibility Audit'
).replace(
    'Discover controllable feature levers, generate deterministic what-if combinations, and rank scenarios by business objective.',
    'Evaluate strategic decisions against safety boundaries, feasibility constraints, and compliance rules.'
)

with open('frontend/src/components/GuardrailsDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(guardrails_content)

opt_content = content
opt_content = re.sub(
    r'\{\/\* Phase 7\.3 Executive Recommendations UI \*\/}.*?(?=\{\/\* 07 - NEXT ACTION \*\/})',
    r'',
    opt_content,
    flags=re.DOTALL
)

with open('frontend/src/components/DecisionIntelligenceView.tsx', 'w', encoding='utf-8') as f:
    f.write(opt_content)

