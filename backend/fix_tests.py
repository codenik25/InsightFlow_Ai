import os
import re

directory = 'c:/Users/nrnik/OneDrive/Desktop/InsightFlow/tests'
files_to_check = [
    'test_recommendation_service.py',
    'test_recommendation_api.py',
    'test_outcome_service.py',
    'test_outcome_api.py',
    'test_guardrail_service.py',
    'test_guardrail_relative_change_regression.py',
    'test_guardrail_api.py',
    'test_decision_summary_api.py',
    'test_decision_brief_service.py',
    'test_decision_brief_api.py',
    'test_runtime_e2e_verification.py'
]

for filename in os.listdir(directory):
    if not filename.endswith('.py'):
        continue
    
    filepath = os.path.join(directory, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We want to replace "/decision/recommendations" with "/decision/optimize/recommendations"
    # ONLY when it's related to optimization. A good heuristic for test files:
    # If the file is specifically testing optimization recommendations, replace all.
    # If it's testing the "scenario_id" or basic pre-optimization, leave it alone.

    if filename in ['test_recommendation_api.py', 'test_recommendation_service.py']:
        content = content.replace('/decision/recommendations', '/decision/optimize/recommendations')
    else:
        # For other files, we only replace if 'optimization_id' is in the same line or block, but a regex line replacement is safer:
        # client.post(f"/api/v1/datasets/{proc_id}/decision/recommendations", json={"optimization_id" ...
        lines = content.split('\n')
        new_lines = []
        for line in lines:
            if '/decision/recommendations' in line and ('optimization_id' in line or 'json=' in line and 'optimization_id' in line):
                line = line.replace('/decision/recommendations', '/decision/optimize/recommendations')
            new_lines.append(line)
        content = '\n'.join(new_lines)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Done.")
