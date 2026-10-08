import React, { useState, useEffect, useCallback } from 'react';
import {
  DecisionCommandCenterResponse,
  DecisionGuardrailResponse,
} from '../types';
import {
  fetchDecisionCommandCenter,
  getGuardrailByRecommendationId,
  evaluateGuardrailsForRecommendation,
} from '../services/api';
import { GuardrailsControlCenter } from './GuardrailsControlCenter';

interface DataGuardrailsProps {
  processedDatasetId: string | null;
  setCurrentStage: (stage: string) => void;
}

export const DataGuardrails: React.FC<DataGuardrailsProps> = ({ 
  processedDatasetId, 
  setCurrentStage 
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [decisionData, setDecisionData] = useState<DecisionCommandCenterResponse | null>(null);
  const [guardrail, setGuardrail] = useState<DecisionGuardrailResponse | null>(null);
  const [evaluating, setEvaluating] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    if (!processedDatasetId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDecisionCommandCenter(processedDatasetId);
      setDecisionData(data);

      if (data.primary_recommendation) {
        try {
          const gRes = await getGuardrailByRecommendationId(
            processedDatasetId, 
            data.primary_recommendation.recommendation_id
          );
          setGuardrail(gRes);
        } catch {
          // If guardrail isn't pre-evaluated, leave null so user can trigger evaluation
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to aggregate Decision Intelligence evidence chain.');
    } finally {
      setLoading(false);
    }
  }, [processedDatasetId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRunGuardrails = async () => {
    if (!processedDatasetId || !decisionData?.primary_recommendation) return;
    setEvaluating(true);
    setError(null);
    try {
      const gRes = await evaluateGuardrailsForRecommendation(
        processedDatasetId, 
        decisionData.primary_recommendation.recommendation_id
      );
      setGuardrail(gRes);
    } catch (err: any) {
      setError(err.message || 'Failed to execute guardrails validation.');
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <GuardrailsControlCenter
      decisionData={decisionData}
      guardrail={guardrail}
      evaluating={evaluating}
      loading={loading}
      error={error}
      onRetry={loadData}
      onRunGuardrails={handleRunGuardrails}
      onProceed={() => setCurrentStage('DECISIONS')}
    />
  );
};
