with open('frontend/src/components/GuardrailsDashboard.tsx', 'r', encoding='utf-8') as f:
    g_out = f.read()

bad_fetches = """      // 1. Fetch Decision Summary
      const data = await fetchDecisionSummary(datasetId);
      setDecisionSummary(data);

      // 2. Fetch Latest ML Analysis
      const mlList = await fetchMLAnalyses(datasetId).catch(() => []);
      if (mlList.length > 0) {
        const activeAnalysis = mlList[0];
        setLatestAnalysis(activeAnalysis);

        // 3. Fetch Model Feature Importances / Explainability
        try {
          const expData = await explainMLModel(datasetId, activeAnalysis.id);
          setModelExplanation(expData);
        } catch (expErr) {
          console.warn('Model explanation fetch warning:', expErr);
        }
      }"""

if bad_fetches in g_out:
    g_out = g_out.replace(bad_fetches, "")
    print("bad_fetches removed successfully!")
else:
    print("WARNING: bad_fetches not found exactly")

with open('frontend/src/components/GuardrailsDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(g_out)

print("Fetch fix complete.")
