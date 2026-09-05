import re

def process_guardrails():
    with open('frontend/src/components/DecisionIntelligenceView.tsx', 'r', encoding='utf-8') as f:
        content = f.read()
    
    out = content.replace('DecisionIntelligenceView', 'GuardrailsDashboard')
    out = out.replace('Phase 7.2 Decision Optimization Engine', 'Phase 7.4 Decision Guardrails')
    out = out.replace('Decision Optimization & Scenario Ranking', 'Decision Guardrails & Feasibility Audit')
    out = out.replace('Discover controllable feature levers, generate deterministic what-if combinations, and rank scenarios by business objective.', 'Evaluate strategic decisions against safety boundaries, feasibility constraints, and compliance rules.')
    
    out = out.replace("onClick={() => onNavigate('decisions')}", "onClick={() => {}} className=\"hidden\"")
    out = out.replace("CONTINUE TO DECISIONS", "COMPLETE")

    opt_states = [
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
        out = re.sub(r'  ' + re.escape(state) + r'.*?\n', '', out)
    
    out = re.sub(r'\s*// 4\. Fetch Phase 7\.2 Optimization Controllable Feature Options.*?catch \(optErr\) \{\s*console\.warn\(\'Optimization options fetch warning:\', optErr\);\s*\}', '', out, flags=re.DOTALL)
    out = re.sub(r'\s*// Pre-populate sample JSON based on first 2 feature columns.*?setFeatureChangesInput.*?\}', '', out, flags=re.DOTALL)

    out = re.sub(r'  const handleCreateScenario = async.*?finally \{\s*setSubmittingScenario\(false\);\s*\}\s*\};', '', out, flags=re.DOTALL)
    out = re.sub(r'  const handleCompareScenario = async.*?finally \{\s*setComparingScenarioId\(null\);\s*\}\s*\};', '', out, flags=re.DOTALL)
    out = re.sub(r'  const handleRunOptimization = async.*?finally \{\s*setRunningOpt\(false\);\s*\}\s*\};', '', out, flags=re.DOTALL)
    out = re.sub(r'  const handleGenerateRecommendations = async.*?finally \{\s*setGeneratingRecs\(false\);\s*\}\s*\};', '', out, flags=re.DOTALL)

    # Clean UI section safely!
    # Instead of DOTALL regex that eats closing braces, we just replace the EXACT strings of the tags we don't want.
    # Actually, the best way to remove Phase 7.2 UI is to find `{/* Phase 7.2 Optimization Lab */}` 
    # and the matching `</div>` that closes it.
    
    def find_matching_brace(text, start_idx):
        count = 0
        for i in range(start_idx, len(text)):
            if text[i:i+4] == '<div':
                count += 1
            elif text[i:i+5] == '</div':
                count -= 1
                if count == 0:
                    return i + 6
        return -1
    
    p72_start = out.find('{/* Phase 7.2 Optimization Lab */}')
    if p72_start != -1:
        div_start = out.find('<div', p72_start)
        div_end = find_matching_brace(out, div_start)
        if div_end != -1:
            out = out[:p72_start] + out[div_end:]

    # Remove scenarioSuccessMsg block
    msg_start = out.find('{scenarioSuccessMsg && (')
    if msg_start != -1:
        # The block ends with `)}`
        end = out.find(')}', msg_start) + 2
        out = out[:msg_start] + out[end:]
        
    # Remove Non-Causal Model Disclaimer
    nc_start = out.find('{/* Non-Causal Model Disclaimer */}')
    if nc_start != -1:
        div_start = out.find('<div', nc_start)
        div_end = find_matching_brace(out, div_start)
        out = out[:nc_start] + out[div_end:]

    # Remove Generate Executive Recommendations button safely
    btn_start = out.find('<button\n                  onClick={() => handleGenerateRecommendations()}')
    if btn_start != -1:
        btn_end = out.find('</button>', btn_start) + 9
        out = out[:btn_start] + out[btn_end:]

    rec_err_start = out.find('{recError && (')
    if rec_err_start != -1:
        end = out.find(')}', rec_err_start) + 2
        out = out[:rec_err_start] + out[end:]

    rec_warn_start = out.find('{recResponse && recResponse.warning && (')
    if rec_warn_start != -1:
        end = out.find(')}', rec_warn_start) + 2
        out = out[:rec_warn_start] + out[end:]
        
    out = out.replace('disabled={generatingRecs || !optimizationResult}', '')

    with open('frontend/src/components/GuardrailsDashboard.tsx', 'w', encoding='utf-8') as f:
        f.write(out)

def process_optimization():
    with open('frontend/src/components/DecisionIntelligenceView.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    guard_states = [
        "const [guardrailsMap, setGuardrailsMap]",
        "const [evaluatingGuardrailId, setEvaluatingGuardrailId]",
    ]
    for state in guard_states:
        content = re.sub(r'  ' + re.escape(state) + r'.*?\n', '', content)

    content = re.sub(r'\s*// 6\. Fetch Phase 7\.4 Guardrail Evaluations.*?catch \(gErr\) \{\s*console\.warn\(\'Guardrails fetch warning:\', gErr\);\s*\}', '', content, flags=re.DOTALL)
    content = re.sub(r'  const handleEvaluateGuardrailForRec = async.*?finally \{\s*setEvaluatingGuardrailId\(null\);\s*\}\s*\};', '', content, flags=re.DOTALL)
    
    # Remove Guardrails UI
    def find_matching_brace(text, start_idx):
        count = 0
        for i in range(start_idx, len(text)):
            if text[i:i+4] == '<div':
                count += 1
            elif text[i:i+5] == '</div':
                count -= 1
                if count == 0:
                    return i + 6
        return -1

    g_ui_start = content.find('{/* Phase 7.4 Decision Guardrails & Feasibility Analysis Card */}')
    if g_ui_start != -1:
        # The block is `{(() => { ... })()}`
        # We can just use python to find matching braces for `{`
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
        
        curly_start = content.find('{(() => {', g_ui_start)
        curly_end = find_matching_curly(content, curly_start)
        if curly_end != -1:
            content = content[:g_ui_start] + content[curly_end:]

    # Also remove auto-eval logic
    content = re.sub(r'\s*// Auto-evaluate Guardrails for newly generated recommendations.*?console\.warn\(\'Batch guardrail evaluation warning:\', gErr\);\s*\}', '', content, flags=re.DOTALL)

    with open('frontend/src/components/DecisionIntelligenceView.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

process_guardrails()
process_optimization()
print("Built correctly.")
