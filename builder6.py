import re
import subprocess

subprocess.run(['git', 'checkout', 'frontend/src/components/DecisionIntelligenceView.tsx'])

with open('frontend/src/components/DecisionIntelligenceView.tsx', 'r', encoding='utf-8') as f:
    original = f.read()

# ---------------------------------------------------------
# GUARDRAILS DASHBOARD
# ---------------------------------------------------------
g_out = original.replace('DecisionIntelligenceView', 'GuardrailsDashboard')
g_out = g_out.replace('Phase 7.2 Decision Optimization Engine', 'Phase 7.4 Decision Guardrails')
g_out = g_out.replace('Decision Optimization & Scenario Ranking', 'Decision Guardrails & Feasibility Audit')
g_out = g_out.replace('Discover controllable feature levers, generate deterministic what-if combinations, and rank scenarios by business objective.', 'Evaluate strategic decisions against safety boundaries, feasibility constraints, and compliance rules.')
g_out = g_out.replace("onClick={() => onNavigate('decisions')}", "onClick={() => {}} className=\"hidden\"")
g_out = g_out.replace("CONTINUE TO DECISIONS", "COMPLETE")

opt_states = [
    "const [decisionSummary, setDecisionSummary]",
    "const [latestAnalysis, setLatestAnalysis]",
    "const [modelExplanation, setModelExplanation]",
    "const [scenarioName, setScenarioName]",
    "const [scenarioDesc, setScenarioDesc]",
    "const [featureChangesInput, setFeatureChangesInput]",
    "const [submittingScenario, setSubmittingScenario]",
    "const [scenarioSuccessMsg, setScenarioSuccessMsg]",
    "const [activeComparison, setActiveComparison]",
    "const [comparingScenarioId, setComparingScenarioId]",
    "const [optimizationOptions, setOptimizationOptions]",
    "const [optimizationResult, setOptimizationResult]",
    "const [objective, setObjective]",
    "const [maxScenarios, setMaxScenarios]",
    "const [userConstraints, setUserConstraints]",
    "const [runningOpt, setRunningOpt]",
    "const [optError, setOptError]",
    "const [recResponse, setRecResponse]",
    "const [generatingRecs, setGeneratingRecs]",
    "const [recError, setRecError]"
]

for state in opt_states:
    g_out = re.sub(r'  ' + re.escape(state) + r'.*?\n', '', g_out)

g_out = re.sub(r'\s*// 1\. Fetch Decision Summary.*?console\.warn\(\'Model explanation fetch warning:\', expErr\);\s*\}\s*\}', '', g_out, flags=re.DOTALL)
g_out = re.sub(r'\s*// 4\. Fetch Phase 7\.2 Optimization Controllable Feature Options.*?catch \(optErr\) \{\s*console\.warn\(\'Optimization options fetch warning:\', optErr\);\s*\}', '', g_out, flags=re.DOTALL)
g_out = re.sub(r'\s*// Pre-populate sample JSON based on first 2 feature columns.*?setFeatureChangesInput.*?\}', '', g_out, flags=re.DOTALL)

g_out = re.sub(r'  const handleCreateScenario = async.*?finally \{\s*setSubmittingScenario\(false\);\s*\}\s*\};', '', g_out, flags=re.DOTALL)
g_out = re.sub(r'  const handleCompareScenario = async.*?finally \{\s*setComparingScenarioId\(null\);\s*\}\s*\};', '', g_out, flags=re.DOTALL)
g_out = re.sub(r'  const handleRunOptimization = async.*?finally \{\s*setRunningOpt\(false\);\s*\}\s*\};', '', g_out, flags=re.DOTALL)
g_out = re.sub(r'  const handleGenerateRecommendations = async.*?finally \{\s*setGeneratingRecs\(false\);\s*\}\s*\};', '', g_out, flags=re.DOTALL)

unused_imports = [
    "DecisionSummaryResponse,",
    "MLAnalysisResponse,",
    "MLExplanationResponse,",
    "OptimizationOptionResponse,",
    "OptimizationResponse,",
    "ScenarioComparisonResponse,",
    "RecommendationResponse,",
    "fetchDecisionSummary,",
    "fetchMLAnalyses,",
    "explainMLModel,",
    "evaluateWhatIfScenario,",
    "fetchOptimizationOptions,",
    "runOptimization,",
    "generateRecommendations,",
    "compareWhatIfScenario,",
    "evaluateAllGuardrails,"
]
for imp in unused_imports:
    g_out = g_out.replace(imp, "")

start_idx = g_out.find('{scenarioSuccessMsg && (')
end_idx = g_out.find('{/* Phase 7.3 Executive Recommendations UI */}')
if start_idx != -1 and end_idx != -1:
    g_out = g_out[:start_idx] + g_out[end_idx:]

g_out = re.sub(r'\s*\{recError && \(.*?</div>\s*\)', '', g_out, flags=re.DOTALL)
g_out = re.sub(r'\s*\{recResponse && recResponse\.warning && \(.*?</div>\s*\)', '', g_out, flags=re.DOTALL)

btn_start = g_out.find('<button\n                  onClick={() => handleGenerateRecommendations()}')
if btn_start != -1:
    btn_end = g_out.find('</button>', btn_start) + 9
    g_out = g_out[:btn_start] + g_out[btn_end:]

g_out = g_out.replace('disabled={generatingRecs || !optimizationResult}', '')
g_out = g_out.replace('              </div>}}', '              </div>')

# Truncate at Model Feature Importance Ranks to remove Phase 7.2 closing braces and Model/What-If
idx = g_out.find('{/* Model Feature Importance Ranks */}')
if idx != -1:
    g_out = g_out[:idx] + "    </div>\n  );\n};\n\nexport default GuardrailsDashboard;\n"
    
# Fix the ending! Because the truncate still leaves the optimizationResult brace!
# The text right before the truncate should just be the end of Phase 7.3
# In fact, let's just find the end of Phase 7.3 cleanly
ph73_end_str = """                </div>
              )}
            </div>"""

if ph73_end_str in g_out:
    idx2 = g_out.find(ph73_end_str)
    if idx2 != -1:
        g_out = g_out[:idx2 + len(ph73_end_str)] + "\n    </div>\n  );\n};\n\nexport default GuardrailsDashboard;\n"

with open('frontend/src/components/GuardrailsDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(g_out)

# ---------------------------------------------------------
# DECISION INTELLIGENCE VIEW (OPTIMIZATION)
# ---------------------------------------------------------
opt_out = original

guard_states = [
    "const [guardrailsMap, setGuardrailsMap]",
    "const [evaluatingGuardrailId, setEvaluatingGuardrailId]",
]
for state in guard_states:
    opt_out = re.sub(r'  ' + re.escape(state) + r'.*?\n', '', opt_out)

opt_out = re.sub(r'\s*// 6\. Fetch Phase 7\.4 Guardrail Evaluations.*?catch \(gErr\) \{\s*console\.warn\(\'Guardrails fetch warning:\', gErr\);\s*\}', '', opt_out, flags=re.DOTALL)
opt_out = re.sub(r'  const handleEvaluateGuardrailForRec = async.*?finally \{\s*setEvaluatingGuardrailId\(null\);\s*\}\s*\};', '', opt_out, flags=re.DOTALL)

def find_matching_curly(text, start_idx):
    count = 0
    for i in range(start_idx, len(text)):
        if text[i] == '{':
            count += 1
        elif text[i] == '}':
            count -= 1
            if count == 0:
                return i + 1
    return -1

g_ui_start = opt_out.find('{/* Phase 7.4 Decision Guardrails & Feasibility Analysis Card */}')
if g_ui_start != -1:
    curly_start = opt_out.find('{(() => {', g_ui_start)
    curly_end = find_matching_curly(opt_out, curly_start)
    if curly_end != -1:
        opt_out = opt_out[:g_ui_start] + opt_out[curly_end:]

opt_out = re.sub(r'\s*// Auto-evaluate Guardrails for newly generated recommendations.*?console\.warn\(\'Batch guardrail evaluation warning:\', gErr\);\s*\}', '', opt_out, flags=re.DOTALL)

unused_opt_imports = [
    "DecisionGuardrailResponse,",
    "evaluateAllGuardrails,",
    "evaluateGuardrailsForRecommendation,",
    "fetchGuardrailsForDataset,"
]
for imp in unused_opt_imports:
    opt_out = opt_out.replace(imp, "")

with open('frontend/src/components/DecisionIntelligenceView.tsx', 'w', encoding='utf-8') as f:
    f.write(opt_out)

with open('frontend/src/DashboardApp.tsx', 'r', encoding='utf-8') as f:
    d_out = f.read()

d_out = d_out.replace("import { HealthStatus, DatasetListResponse } from './types';", "import { HealthStatus } from './types';")

with open('frontend/src/DashboardApp.tsx', 'w', encoding='utf-8') as f:
    f.write(d_out)

print("Builder 6.0 complete.")
