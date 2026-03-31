import { useEffect, useRef, useSyncExternalStore } from 'react'
import { computed, effect, signal } from '@preact/signals-core'
import { enabledWhen, requires, umpire, type Foul } from '@umpire/core'
import { reactiveUmp, type ReactiveUmpire, type SignalProtocol } from '@umpire/signals'
import '../styles/signals-demo.css'

const fields = {
  email:       { required: true, isEmpty: (value: unknown) => !value },
  password:    { required: true, isEmpty: (value: unknown) => !value },
  companyName: { isEmpty: (value: unknown) => !value },
  companySize: { isEmpty: (value: unknown) => !value },
}

type Cond = { plan: 'personal' | 'business' }
type Plan = Cond['plan']
type DemoField = keyof typeof fields
type DemoValues = Record<DemoField, unknown>
type Reader<T> = { get(): T }
type FieldReaders = {
  enabled: Reader<boolean>
  required: Reader<boolean>
  reason: Reader<string | null>
}
type DemoRuntime = {
  reactive: ReactiveUmpire<typeof fields>
  planSignal: { value: Plan }
  readers: {
    plan: Reader<Plan>
    values: Reader<DemoValues>
    fouls: Reader<Foul<typeof fields>[]>
    fields: Record<DemoField, FieldReaders>
  }
}

const demoUmp = umpire<typeof fields, Cond>({
  fields,
  rules: [
    // Business-only fields stay behind a condition signal instead of becoming user-owned values.
    enabledWhen('companyName', (_values, conditions) => conditions.plan === 'business', {
      reason: 'business plan required',
    }),
    enabledWhen('companySize', (_values, conditions) => conditions.plan === 'business', {
      reason: 'business plan required',
    }),
    // companySize only stays available while companyName is both filled and still enabled.
    requires('companySize', 'companyName'),
  ],
})

const preactAdapter: SignalProtocol = {
  signal(initial) {
    const s = signal(initial)
    return { get: () => s.value, set: (value) => { s.value = value } }
  },
  computed(fn) {
    const c = computed(fn)
    return { get: () => c.value }
  },
  effect,
}

const fieldOrder = [
  'email',
  'password',
  'companyName',
  'companySize',
] as const satisfies readonly DemoField[]

const fieldLabels: Record<DemoField, string> = {
  email: 'Email',
  password: 'Password',
  companyName: 'Company Name',
  companySize: 'Company Size',
}

const fieldSamples: Record<DemoField, string> = {
  email: 'crew@stadium.dev',
  password: 'strike-zone',
  companyName: 'Acme Stadium Ops',
  companySize: '100-250 employees',
}

const planOptions = [
  { value: 'personal', label: 'Personal' },
  { value: 'business', label: 'Business' },
] as const

function cls(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function createReader<T>(get: () => T): Reader<T> {
  return { get }
}

function createFieldReaders(
  reactive: ReactiveUmpire<typeof fields>,
  field: DemoField,
): FieldReaders {
  const availability = reactive.field(field)

  return {
    enabled: createReader(() => availability.enabled),
    required: createReader(() => availability.required),
    reason: createReader(() => availability.reason),
  }
}

function createRuntime(): DemoRuntime {
  const planSignal = signal<Plan>('personal')
  const reactive = reactiveUmp(demoUmp, preactAdapter, {
    conditions: {
      plan: { get: () => planSignal.value },
    },
  })

  return {
    reactive,
    planSignal,
    readers: {
      plan: createReader(() => planSignal.value),
      values: createReader(() => reactive.values),
      fouls: createReader(() => reactive.fouls),
      fields: {
        email: createFieldReaders(reactive, 'email'),
        password: createFieldReaders(reactive, 'password'),
        companyName: createFieldReaders(reactive, 'companyName'),
        companySize: createFieldReaders(reactive, 'companySize'),
      },
    },
  }
}

function useSignalValue<T>(sig: { get(): T }): T {
  return useSyncExternalStore(
    (onChange) => effect(() => { sig.get(); onChange() }),
    () => sig.get(),
    () => sig.get(),
  )
}

function JsonBlock({ value }: { value: string }) {
  return (
    <pre className="signals-demo__code-block">
      <code>{value}</code>
    </pre>
  )
}

function AvailabilityCard({
  field,
  label,
  readers,
}: {
  field: DemoField
  label: string
  readers: FieldReaders
}) {
  const enabled = useSignalValue(readers.enabled)
  const required = useSignalValue(readers.required)
  const reason = useSignalValue(readers.reason)

  return (
    <article
      className={cls(
        'signals-demo__field-card',
        !enabled && 'signals-demo__field-card--disabled',
      )}
    >
      <div className="signals-demo__field-top">
        <div>
          <div className="signals-demo__field-name">{label}</div>
          <code className="signals-demo__field-code">{`field('${field}')`}</code>
        </div>

        <div
          className={cls(
            'signals-demo__status',
            enabled
              ? 'signals-demo__status--enabled'
              : 'signals-demo__status--disabled',
          )}
        >
          <span className="signals-demo__status-dot" />
          {enabled ? 'enabled' : 'disabled'}
        </div>
      </div>

      <div className="signals-demo__field-grid">
        <div className="signals-demo__field-cell">
          <span className="signals-demo__field-key">required</span>
          <span
            className={cls(
              'signals-demo__pill',
              required ? 'signals-demo__pill--required' : 'signals-demo__pill--optional',
            )}
          >
            {String(required)}
          </span>
        </div>

        <div className="signals-demo__field-cell signals-demo__field-cell--reason">
          <span className="signals-demo__field-key">reason</span>
          <span className="signals-demo__field-reason">{reason ?? 'available'}</span>
        </div>
      </div>
    </article>
  )
}

export default function SignalsAdapterDemo() {
  const runtimeRef = useRef<DemoRuntime | null>(null)

  if (!runtimeRef.current) {
    runtimeRef.current = createRuntime()
  }

  const runtime = runtimeRef.current
  const plan = useSignalValue(runtime.readers.plan)
  const values = useSignalValue(runtime.readers.values)
  const fouls = useSignalValue(runtime.readers.fouls)

  useEffect(() => {
    return () => {
      runtime.reactive.dispose()
    }
  }, [runtime])

  function setPlan(nextPlan: Plan) {
    runtime.planSignal.value = nextPlan
  }

  function setFieldValue(field: DemoField) {
    runtime.reactive.set(field, fieldSamples[field])
  }

  function clearFieldValue(field: DemoField) {
    runtime.reactive.set(field, '')
  }

  return (
    <div className="signals-demo umpire-demo umpire-demo--styled">
      <div className="umpire-demo__layout">
        <section className="umpire-demo__panel">
          <div className="umpire-demo__panel-header">
            <div>
              <div className="umpire-demo__eyebrow">Signal primitives</div>
              <h2 className="umpire-demo__title">Signal State</h2>
            </div>
            <span className="umpire-demo__panel-accent">reactiveUmp()</span>
          </div>

          <div className="umpire-demo__panel-body">
            <div className="signals-demo__callout">
              <span className="signals-demo__badge">Fine-grained tracking</span>
              <div>
                <div className="signals-demo__callout-title">Predicates subscribe by access path</div>
                <p className="signals-demo__callout-text">
                  `enabledWhen()` only tracks the signals it touches, so flipping the plan only
                  recomputes the business gate and its dependents.
                </p>
              </div>
            </div>

            <div className="signals-demo__controls">
              <div className="signals-demo__control-group">
                <div className="signals-demo__control-label">Plan Conditions</div>
                <div className="umpire-demo__plan-toggle" aria-label="Plan">
                  {planOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={plan === option.value}
                      className={cls(
                        'umpire-demo__plan-option',
                        plan === option.value && 'umpire-demo__plan-option--active',
                      )}
                      onClick={() => setPlan(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {fieldOrder.map((field) => (
                <div key={field} className="signals-demo__control-group">
                  <div className="signals-demo__control-label">{fieldLabels[field]}</div>
                  <div className="signals-demo__button-row">
                    <button
                      type="button"
                      className="signals-demo__button"
                      onClick={() => setFieldValue(field)}
                    >
                      Set {fieldLabels[field].toLowerCase()}
                    </button>
                    <button
                      type="button"
                      className="signals-demo__button signals-demo__button--ghost"
                      onClick={() => clearFieldValue(field)}
                    >
                      Clear {fieldLabels[field].toLowerCase()}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <section className="signals-demo__json-shell">
              <div className="signals-demo__json-header">
                <span className="signals-demo__json-title">signal snapshot</span>
                <span className="signals-demo__json-meta">@preact/signals-core</span>
              </div>
              <JsonBlock value={prettyJson({ conditions: { plan }, values })} />
            </section>
          </div>
        </section>

        <section className="umpire-demo__panel">
          <div className="umpire-demo__panel-header">
            <div>
              <div className="umpire-demo__eyebrow">Live computed output</div>
              <h2 className="umpire-demo__title">Field Availability</h2>
            </div>
            <span className="umpire-demo__panel-accent">field(name)</span>
          </div>

          <div className="umpire-demo__panel-body">
            <div className="signals-demo__field-list">
              {fieldOrder.map((field) => (
                <AvailabilityCard
                  key={field}
                  field={field}
                  label={fieldLabels[field]}
                  readers={runtime.readers.fields[field]}
                />
              ))}
            </div>

            <section
              className={cls(
                'signals-demo__fouls',
                fouls.length > 0 && 'signals-demo__fouls--alert',
              )}
            >
              <div className="signals-demo__json-header">
                <span className="signals-demo__json-title">fouls</span>
                <span className="signals-demo__json-meta">
                  {fouls.length > 0 ? 'effect()-driven transitions' : '[]'}
                </span>
              </div>
              <JsonBlock value={fouls.length > 0 ? prettyJson(fouls) : '[]'} />
            </section>

            <p className="signals-demo__note">
              Set a company name while the plan is business, then toggle back to personal to watch
              signals surface a foul.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
