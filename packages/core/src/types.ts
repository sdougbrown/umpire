export interface FieldDef<V = unknown> {
  required?: boolean
  default?: V
  isEmpty?(value: V | null | undefined): boolean
}

export type FieldAvailability = {
  enabled: boolean
  fair: boolean
  required: boolean
  reason: string | null
  reasons: string[]
}

export type AvailabilityMap<F extends Record<string, FieldDef>> = {
  [K in keyof F]: FieldAvailability
}

export type FieldValue<T extends FieldDef> = T extends FieldDef<infer V> ? V : unknown

export type FieldValues<F extends Record<string, FieldDef>> = {
  [K in keyof F]?: FieldValue<F[K]>
}

export type InputValues<
  F extends Record<string, FieldDef> = Record<string, FieldDef>,
> = FieldValues<F>

export type Snapshot<
  F extends Record<string, FieldDef>,
  C extends Record<string, unknown>,
> = {
  values: InputValues<F>
  conditions?: C
}

export type Foul<F extends Record<string, FieldDef>> = {
  field: keyof F & string
  reason: string
  suggestedValue: unknown
}

export type RuleTraceDependency = {
  kind: string
  id: string
}

export type RuleTraceReason = {
  code: string
  data?: Record<string, unknown>
}

export type RuleTraceAttachmentResult = {
  value?: unknown
  reason?: string | null
  reasons?: RuleTraceReason[]
  dependencies?: RuleTraceDependency[]
  [key: string]: unknown
}

export type RuleTraceAttachment<
  Values extends Record<string, unknown> = Record<string, unknown>,
  C extends Record<string, unknown> = Record<string, unknown>,
> = {
  kind: string
  id: string
  inspect(
    values: Values,
    conditions: C,
    prev?: Values,
  ): RuleTraceAttachmentResult | null | undefined
}

export type ChallengeTraceAttachment = RuleTraceAttachmentResult & {
  kind: string
  id: string
}

export type ChallengeDirectReason = {
  rule: string
  reason: string | null
  passed: boolean
  trace?: ChallengeTraceAttachment[]
  [key: string]: unknown
}

export type ChallengeTrace = {
  field: string
  enabled: boolean
  fair: boolean
  directReasons: ChallengeDirectReason[]
  transitiveDeps: Array<{
    field: string
    enabled: boolean
    fair: boolean
    reason: string | null
    causedBy: Array<Omit<ChallengeDirectReason, 'passed'>>
  }>
  oneOfResolution: {
    group: string
    activeBranch: string | null
    method: string
    branches: Record<string, { fields: string[]; anySatisfied: boolean }>
  } | null
}

export type RuleEvaluation = {
  enabled: boolean
  fair?: boolean
  reason: string | null
  reasons?: string[]
}

export type Rule<
  F extends Record<string, FieldDef>,
  C extends Record<string, unknown> = Record<string, unknown>,
> = {
  type: string
  targets: (keyof F & string)[]
  sources: (keyof F & string)[]
  evaluate: (
    values: FieldValues<F>,
    conditions: C,
    prev?: FieldValues<F>,
    fields?: F,
    availability?: Partial<AvailabilityMap<F>>,
  ) => Map<string, RuleEvaluation>
}

export interface Umpire<
  F extends Record<string, FieldDef>,
  C extends Record<string, unknown> = Record<string, unknown>,
> {
  check(values: InputValues<F>, conditions?: C, prev?: InputValues<F>): AvailabilityMap<F>
  play(before: Snapshot<F, C>, after: Snapshot<F, C>): Foul<F>[]
  init(overrides?: InputValues<F>): FieldValues<F>
  challenge(
    field: keyof F & string,
    values: InputValues<F>,
    conditions?: C,
    prev?: InputValues<F>,
  ): ChallengeTrace
  graph(): { nodes: string[]; edges: Array<{ from: string; to: string; type: string }> }
}
