import { useState, useMemo } from 'react'
import { z } from 'zod'
import { enabledWhen, requires, umpire } from '@umpire/core'
import { useUmpire } from '@umpire/react'
import { activeSchema, activeErrors, zodErrors } from '@umpire/zod'

// ── Umpire: field availability ───────────────────────────────────────────────

const signupFields = {
  email:           { required: true, isEmpty: (v: unknown) => !v },
  password:        { required: true, isEmpty: (v: unknown) => !v },
  confirmPassword: { required: true, isEmpty: (v: unknown) => !v },
  referralCode:    {},
  companyName:     { required: true, isEmpty: (v: unknown) => !v },
  companySize:     { required: true, isEmpty: (v: unknown) => !v },
}

type SignupConditions = { plan: 'personal' | 'business' }
type SignupField = keyof typeof signupFields

const signupUmp = umpire<typeof signupFields, SignupConditions>({
  fields: signupFields,
  rules: [
    requires('confirmPassword', 'password'),
    enabledWhen('companyName', (_v, cond) => cond.plan === 'business', {
      reason: 'business plan required',
    }),
    enabledWhen('companySize', (_v, cond) => cond.plan === 'business', {
      reason: 'business plan required',
    }),
    requires('companySize', 'companyName'),
  ],
})

// ── Zod: per-field validation schemas ────────────────────────────────────────
// These are the "correctness" checks. Umpire handles "should this field be
// in play?" — Zod handles "is this value well-formed?"

const fieldSchemas = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
  confirmPassword: z.string().min(1, 'Confirm your password'),
  referralCode: z.string(),
  companyName: z.string().min(1, 'Company name is required'),
  companySize: z.string().min(1, 'Company size is required').regex(/^\d+$/, 'Must be a number'),
})

// ── Field metadata ───────────────────────────────────────────────────────────

const fieldOrder = [
  'email',
  'password',
  'confirmPassword',
  'referralCode',
  'companyName',
  'companySize',
] as const satisfies readonly SignupField[]

const fieldMeta: Record<SignupField, { label: string; type: string; placeholder: string }> = {
  email:           { label: 'Email',            type: 'email',    placeholder: 'alex@example.com' },
  password:        { label: 'Password',         type: 'password', placeholder: 'Choose a password' },
  confirmPassword: { label: 'Confirm Password', type: 'password', placeholder: 'Re-enter password' },
  referralCode:    { label: 'Referral Code',    type: 'text',     placeholder: 'Optional' },
  companyName:     { label: 'Company Name',     type: 'text',     placeholder: 'Acme Industries' },
  companySize:     { label: 'Company Size',     type: 'text',     placeholder: '50' },
}

const planOptions = [
  { value: 'personal', label: 'Personal' },
  { value: 'business', label: 'Business' },
] as const

function cls(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

// ── Component ────────────────────────────────────────────────────────────────

export default function SignupDemo() {
  const [values, setValues] = useState(() => signupUmp.init())
  const [plan, setPlan] = useState<'personal' | 'business'>('personal')
  const [touched, setTouched] = useState<Set<string>>(new Set())

  const conditions: SignupConditions = { plan }
  const { check: availability, fouls } = useUmpire(signupUmp, values, conditions)

  // Build a dynamic Zod schema from availability — disabled fields are
  // excluded, enabled+required fields use the base schema, enabled+optional
  // fields get .optional(). This is the @umpire/zod composition.
  const validationErrors = useMemo(() => {
    const schema = activeSchema(availability, fieldSchemas.shape, z)
      .refine(
        (data) => !data.confirmPassword || !data.password || data.confirmPassword === data.password,
        { message: 'Passwords do not match', path: ['confirmPassword'] },
      )
    const result = schema.safeParse(values)
    if (result.success) return {}
    return activeErrors(availability, zodErrors(result.error))
  }, [availability, values])

  function updateValue(field: SignupField, nextValue: string) {
    setValues((current) => ({ ...current, [field]: nextValue }))
  }

  function markTouched(field: string) {
    setTouched((prev) => new Set(prev).add(field))
  }

  function applyResets() {
    setValues((current) => {
      const next = { ...current }
      for (const foul of fouls) {
        next[foul.field] = foul.suggestedValue
      }
      return next
    })
  }

  const canSubmit = fieldOrder.every((field) => {
    const av = availability[field]
    if (!av.enabled) return true // disabled fields don't block submit
    if (av.required && !values[field]) return false
    if (validationErrors[field]) return false
    return true
  })

  return (
    <div className="signup-demo umpire-demo">
      {fouls.length > 0 && (
        <div className="umpire-demo__fouls">
          <div className="umpire-demo__fouls-copy">
            <div className="umpire-demo__fouls-kicker">Flag fouls</div>
            <div className="umpire-demo__fouls-list">
              {fouls.map((foul) => (
                <div key={foul.field} className="umpire-demo__foul">
                  <span className="umpire-demo__foul-field">
                    {fieldMeta[foul.field].label}
                  </span>
                  <span className="umpire-demo__foul-reason">{foul.reason}</span>
                </div>
              ))}
            </div>
          </div>
          <button type="button" className="umpire-demo__reset-button" onClick={applyResets}>
            Apply resets
          </button>
        </div>
      )}

      <div className="umpire-demo__layout">
        <section className="umpire-demo__panel signup-demo__panel--form">
          <div className="umpire-demo__panel-header">
            <div>
              <div className="umpire-demo__eyebrow">Live example</div>
              <h2 className="umpire-demo__title">Signup Form</h2>
            </div>
            <span className="umpire-demo__panel-accent">umpire + zod</span>
          </div>

          <div className="umpire-demo__panel-body">
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

            <div className="umpire-demo__fields">
              {fieldOrder.map((field) => {
                const meta = fieldMeta[field]
                const av = availability[field]
                const isEnabled = av.enabled
                const error = touched.has(field) ? validationErrors[field] : undefined

                return (
                  <div
                    key={field}
                    className={cls(
                      'umpire-demo__field',
                      !isEnabled && 'umpire-demo__field--disabled',
                    )}
                  >
                    <label className="umpire-demo__label" htmlFor={`signup-demo-${field}`}>
                      <span>{meta.label}</span>
                      {av.required && <span className="signup-demo__required">*</span>}
                    </label>
                    <input
                      id={`signup-demo-${field}`}
                      className={cls(
                        'umpire-demo__input',
                        error && 'signup-demo__input--invalid',
                      )}
                      type={meta.type}
                      placeholder={meta.placeholder}
                      value={String(values[field] ?? '')}
                      disabled={!isEnabled}
                      onChange={(event) => updateValue(field, event.currentTarget.value)}
                      onBlur={() => markTouched(field)}
                    />
                    {!isEnabled && av.reason && (
                      <div className="signup-demo__reason">{av.reason}</div>
                    )}
                    {isEnabled && error && (
                      <div className="signup-demo__validation-error">{error}</div>
                    )}
                  </div>
                )
              })}
            </div>

            <button
              type="button"
              className={cls(
                'signup-demo__submit',
                canSubmit ? 'signup-demo__submit--ready' : 'signup-demo__submit--blocked',
              )}
              disabled={!canSubmit}
            >
              Create account
            </button>
          </div>
        </section>

        <section className="umpire-demo__panel signup-demo__panel--availability">
          <div className="umpire-demo__panel-header">
            <div>
              <div className="umpire-demo__eyebrow">Live state</div>
              <h2 className="umpire-demo__title">Availability + Validation</h2>
            </div>
            <span className="umpire-demo__panel-accent">
              plan: {plan}
            </span>
          </div>

          <div className="umpire-demo__panel-body signup-demo__panel-body--table">
            <div className="signup-demo__table-shell">
              <table className="signup-demo__table">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Enabled</th>
                    <th>Valid</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {fieldOrder.map((field) => {
                    const av = availability[field]
                    const error = validationErrors[field]

                    return (
                      <tr key={field}>
                        <td className="signup-demo__table-field">{field}</td>
                        <td>
                          <span className="signup-demo__status">
                            <span
                              className={cls(
                                'signup-demo__status-dot',
                                av.enabled
                                  ? 'signup-demo__status-dot--enabled'
                                  : 'signup-demo__status-dot--disabled',
                              )}
                            />
                            {av.enabled ? 'yes' : 'no'}
                          </span>
                        </td>
                        <td>
                          {av.enabled ? (
                            <span className="signup-demo__status">
                              <span
                                className={cls(
                                  'signup-demo__status-dot',
                                  error
                                    ? 'signup-demo__status-dot--disabled'
                                    : 'signup-demo__status-dot--enabled',
                                )}
                              />
                              {error ? 'no' : 'yes'}
                            </span>
                          ) : (
                            <span className="signup-demo__table-reason">—</span>
                          )}
                        </td>
                        <td className="signup-demo__table-reason">
                          {!av.enabled
                            ? av.reason ?? '—'
                            : error ?? (av.required && !values[field] ? 'empty' : '✓')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
