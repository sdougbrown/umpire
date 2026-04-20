import type { RuleEvaluation } from './types.js'

export type CompositeConstraint = 'enabled' | 'fair'
export type CompositeMode = 'and' | 'or'

export function appendCompositeFailureReasons(
  result: RuleEvaluation,
  reasons: string[],
): void {
  if (result.reasons && result.reasons.length > 0) {
    for (const reason of result.reasons) {
      reasons.push(reason)
    }

    return
  }

  if (result.reason !== null) {
    reasons.push(result.reason)
  }
}

export function getCompositeFailureReasons(result: RuleEvaluation): string[] {
  const reasons: string[] = []
  appendCompositeFailureReasons(result, reasons)
  return reasons
}

export function combineCompositeResults(
  constraint: CompositeConstraint,
  mode: CompositeMode,
  results: RuleEvaluation[],
): RuleEvaluation {
  let passed = mode === 'and'

  for (const result of results) {
    const currentPassed =
      constraint === 'fair' ? result.fair !== false : result.enabled

    if (mode === 'and') {
      if (!currentPassed) {
        passed = false
        break
      }

      continue
    }

    if (currentPassed) {
      passed = true
      break
    }
  }

  if (passed) {
    return constraint === 'fair'
      ? {
          enabled: true,
          fair: true,
          reason: null,
        }
      : {
          enabled: true,
          reason: null,
        }
  }

  const reasons: string[] = []

  for (const result of results) {
    appendCompositeFailureReasons(result, reasons)
  }

  return constraint === 'fair'
    ? {
        enabled: true,
        fair: false,
        reason: reasons[0] ?? null,
        reasons: reasons.length === 0 ? undefined : reasons,
      }
    : {
        enabled: false,
        reason: reasons[0] ?? null,
        reasons: reasons.length === 0 ? undefined : reasons,
      }
}

export function getCompositeTargetEvaluation(
  evaluation: Map<string, RuleEvaluation>,
  target: string,
): RuleEvaluation {
  return evaluation.get(target) ?? { enabled: true, reason: null }
}
