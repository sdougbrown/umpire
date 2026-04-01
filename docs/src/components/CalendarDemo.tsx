import { useState } from 'react'
import { disables, enabledWhen, oneOf, requires, umpire } from '@umpire/core'
import { useUmpire } from '@umpire/react'
import '../styles/calendar-demo.css'

const calendarFields = {
  // Date bounds
  fromDate:     {},
  toDate:       {},
  fixedBetween: { default: false },

  // Explicit dates (overrides patterns)
  dates:        {},

  // Day-level recurrence patterns
  everyWeekday: {},
  everyDate:    {},
  everyMonth:   {},

  // Exclusions from patterns
  exceptDates:   {},
  exceptBetween: {},

  // Sub-day strategy A: specific hours
  everyHour: {},

  // Sub-day strategy B: time interval
  startTime:   {},
  endTime:     {},
  repeatEvery: {},

  // Shared
  duration: {},
}

const calendarUmp = umpire({
  fields: calendarFields,
  rules: [
    // Explicit dates shut down everything pattern-based
    disables('dates', [
      'everyWeekday', 'everyDate', 'everyMonth',
      'everyHour', 'startTime', 'endTime', 'repeatEvery',
      'exceptDates', 'exceptBetween',
    ]),

    // Pick one: specific hours OR a time interval
    oneOf('subDayStrategy', {
      hourList: ['everyHour'],
      interval: ['startTime', 'endTime', 'repeatEvery'],
    }),

    // Interval fields chain off startTime
    requires('repeatEvery', 'startTime'),
    requires('endTime', 'startTime'),

    // Bounds toggle only meaningful when both dates exist
    enabledWhen('fixedBetween',
      ({ fromDate, toDate }) => !!fromDate && !!toDate),

    // Exclusions only meaningful when patterns exist
    enabledWhen('exceptDates',
      (v) => !!(v.everyWeekday || v.everyDate || v.everyMonth)),
    enabledWhen('exceptBetween',
      (v) => !!(v.everyWeekday || v.everyDate || v.everyMonth)),
  ],
})

type CalendarField = keyof typeof calendarFields
type CalendarValues = ReturnType<typeof calendarUmp.init>

type NumberListField = 'everyWeekday' | 'everyDate' | 'everyMonth' | 'everyHour'
type StringListField = 'dates' | 'exceptDates'
type StringField = 'fromDate' | 'toDate' | 'startTime' | 'endTime'
type NumberField = 'repeatEvery' | 'duration'
type ExceptBetweenValue = { start?: string; end?: string }

const fieldOrder = [
  'fromDate',
  'toDate',
  'fixedBetween',
  'dates',
  'everyWeekday',
  'everyDate',
  'everyMonth',
  'exceptDates',
  'exceptBetween',
  'everyHour',
  'startTime',
  'endTime',
  'repeatEvery',
  'duration',
] as const satisfies readonly CalendarField[]

const fieldMeta: Record<CalendarField, { label: string; detail: string }> = {
  fromDate: {
    label: 'From Date',
    detail: 'Lower bound for the recurring window.',
  },
  toDate: {
    label: 'To Date',
    detail: 'Upper bound for the recurring window.',
  },
  fixedBetween: {
    label: 'Fixed Between',
    detail: 'Only meaningful when both date bounds exist.',
  },
  dates: {
    label: 'Explicit Dates',
    detail: 'Authoritative list that overrides every pattern field.',
  },
  everyWeekday: {
    label: 'Every Weekday',
    detail: 'Weekly recurrence by weekday.',
  },
  everyDate: {
    label: 'Every Date',
    detail: 'Day numbers within the month.',
  },
  everyMonth: {
    label: 'Every Month',
    detail: 'Month selection across the year.',
  },
  exceptDates: {
    label: 'Except Dates',
    detail: 'Blacklisted dates carved out from active patterns.',
  },
  exceptBetween: {
    label: 'Except Between',
    detail: 'Blackout range inside a valid pattern schedule.',
  },
  everyHour: {
    label: 'Every Hour',
    detail: 'Specific hour list strategy.',
  },
  startTime: {
    label: 'Start Time',
    detail: 'Activates the interval strategy.',
  },
  endTime: {
    label: 'End Time',
    detail: 'Requires a start time first.',
  },
  repeatEvery: {
    label: 'Repeat Every',
    detail: 'Interval cadence in minutes.',
  },
  duration: {
    label: 'Duration',
    detail: 'Shared event length in minutes.',
  },
}

const weekdays = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
] as const

const months = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Feb' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' },
  { value: 5, label: 'May' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Aug' },
  { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dec' },
] as const

const quickDates = [1, 15, 31] as const
const hourOptions = Array.from({ length: 24 }, (_, hour) => hour)

function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

function isPresent(value: unknown) {
  if (Array.isArray(value)) {
    return value.length > 0
  }

  if (value && typeof value === 'object') {
    return Object.values(value).some(Boolean)
  }

  return value !== null && value !== undefined && value !== ''
}

function toNumberList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === 'number') : []
}

function toStringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function toExceptBetween(value: unknown): ExceptBetweenValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  const { start, end } = value as ExceptBetweenValue
  return { start, end }
}

function formatHour(hour: number) {
  const period = hour >= 12 ? 'PM' : 'AM'
  const normalized = hour % 12 || 12
  return `${normalized}:00 ${period}`
}

function renderValueSummary(field: CalendarField, value: CalendarValues[CalendarField]) {
  if (!isPresent(value)) {
    if (field === 'fixedBetween') {
      return 'off'
    }

    return '—'
  }

  if (field === 'fixedBetween') {
    return value ? 'on' : 'off'
  }

  if (field === 'everyWeekday') {
    return toNumberList(value)
      .map((day) => weekdays.find((weekday) => weekday.value === day)?.label ?? String(day))
      .join(', ')
  }

  if (field === 'everyMonth') {
    return toNumberList(value)
      .map((month) => months.find((item) => item.value === month)?.label ?? String(month))
      .join(', ')
  }

  if (field === 'everyHour') {
    return toNumberList(value).map(formatHour).join(', ')
  }

  if (field === 'exceptBetween') {
    const range = toExceptBetween(value)
    return [range.start, range.end].filter(Boolean).join(' → ')
  }

  if (Array.isArray(value)) {
    return value.join(', ')
  }

  return String(value)
}

export default function CalendarDemo() {
  const [values, setValues] = useState<CalendarValues>(() => calendarUmp.init())
  const [dateDraft, setDateDraft] = useState('2026-04-01')
  const [exceptDateDraft, setExceptDateDraft] = useState('2026-04-12')
  const [everyDateDraft, setEveryDateDraft] = useState('15')
  const [hourDraft, setHourDraft] = useState('9')

  const { check: availability, fouls } = useUmpire(calendarUmp, values)

  function updateField<K extends CalendarField>(field: K, nextValue: CalendarValues[K]) {
    setValues((current) => ({
      ...current,
      [field]: nextValue,
    }))
  }

  function updateStringField(field: StringField, nextValue: string) {
    updateField(field, (nextValue || undefined) as CalendarValues[typeof field])
  }

  function updateNumberField(field: NumberField, nextValue: string) {
    const trimmed = nextValue.trim()
    const parsed = trimmed ? Number(trimmed) : undefined
    updateField(field, parsed as CalendarValues[typeof field])
  }

  function toggleNumberList(field: NumberListField, item: number) {
    const current = toNumberList(values[field])
    const exists = current.includes(item)
    const next = exists
      ? current.filter((value) => value !== item)
      : [...current, item].sort((left, right) => left - right)

    updateField(field, (next.length > 0 ? next : undefined) as CalendarValues[typeof field])
  }

  function addNumberListValue(field: NumberListField, rawValue: string, reset: () => void) {
    const parsed = Number(rawValue)

    if (!Number.isInteger(parsed)) {
      return
    }

    if (field === 'everyDate' && (parsed < 1 || parsed > 31)) {
      return
    }

    if (field === 'everyHour' && (parsed < 0 || parsed > 23)) {
      return
    }

    if (field === 'everyMonth' && (parsed < 1 || parsed > 12)) {
      return
    }

    const current = toNumberList(values[field])

    if (!current.includes(parsed)) {
      updateField(
        field,
        [...current, parsed].sort((left, right) => left - right) as CalendarValues[typeof field],
      )
    }

    reset()
  }

  function addStringListValue(field: StringListField, rawValue: string, reset: () => void) {
    const trimmed = rawValue.trim()

    if (!trimmed) {
      return
    }

    const current = toStringList(values[field])

    if (!current.includes(trimmed)) {
      updateField(field, [...current, trimmed] as CalendarValues[typeof field])
    }

    reset()
  }

  function removeListValue(field: NumberListField | StringListField, item: number | string) {
    const current = Array.isArray(values[field]) ? values[field] : []
    const next = current.filter((value) => value !== item)
    updateField(field, (next.length > 0 ? next : undefined) as CalendarValues[typeof field])
  }

  function updateExceptBetween(part: keyof ExceptBetweenValue, nextValue: string) {
    const current = toExceptBetween(values.exceptBetween)
    const next = {
      ...current,
      [part]: nextValue || undefined,
    }

    if (!next.start && !next.end) {
      updateField('exceptBetween', undefined)
      return
    }

    updateField('exceptBetween', next as CalendarValues['exceptBetween'])
  }

  function applyResets() {
    setValues((current) => {
      const next = { ...current }

      for (const foul of fouls) {
        next[foul.field] = foul.suggestedValue as CalendarValues[typeof foul.field]
      }

      return next
    })
  }

  const modeLabel = isPresent(values.dates)
    ? 'explicit dates'
    : isPresent(values.everyWeekday) || isPresent(values.everyDate) || isPresent(values.everyMonth)
      ? 'pattern recurrence'
      : isPresent(values.fromDate) || isPresent(values.toDate)
        ? 'bounded draft'
        : 'open schedule'

  const strategyLabel = isPresent(values.dates)
    ? 'pattern fields overridden'
    : !availability.everyHour.enabled && (
      availability.startTime.enabled || availability.endTime.enabled || availability.repeatEvery.enabled
    )
      ? 'interval branch active'
      : !availability.startTime.enabled && availability.everyHour.enabled
        ? 'hour-list branch active'
        : isPresent(values.startTime) || isPresent(values.endTime) || isPresent(values.repeatEvery)
          ? 'interval branch active'
          : isPresent(values.everyHour)
            ? 'hour-list branch active'
            : 'strategy undecided'

  const disabledCount = fieldOrder.filter((field) => !availability[field].enabled).length
  const exceptBetween = toExceptBetween(values.exceptBetween)

  return (
    <div className="calendar-demo">
      <div className="calendar-demo__topbar">
        <div className="calendar-demo__indicators">
          <div className="calendar-demo__indicator">
            <div className="calendar-demo__indicator-label">Mode</div>
            <div className="calendar-demo__indicator-value">{modeLabel}</div>
          </div>
          <div className="calendar-demo__indicator">
            <div className="calendar-demo__indicator-label">Strategy</div>
            <div className="calendar-demo__indicator-value">{strategyLabel}</div>
          </div>
          <div className="calendar-demo__indicator">
            <div className="calendar-demo__indicator-label">On The Field</div>
            <div className="calendar-demo__indicator-value">
              {fieldOrder.length - disabledCount}/{fieldOrder.length} active
            </div>
          </div>
        </div>

        <div
          className={cls(
            'calendar-demo__fouls',
            fouls.length > 0 && 'calendar-demo__fouls--alert',
          )}
        >
          <div className="calendar-demo__fouls-copy">
            <div className="calendar-demo__fouls-kicker">Fouls Banner</div>
            {fouls.length > 0 ? (
              <div className="calendar-demo__fouls-list">
                {fouls.map((foul) => (
                  <div key={foul.field} className="calendar-demo__foul">
                    <span className="calendar-demo__foul-field">
                      {fieldMeta[foul.field].label}
                    </span>
                    <span className="calendar-demo__foul-reason">{foul.reason}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="calendar-demo__fouls-empty">
                No stale values on the basepaths. Change modes or strategy branches to surface reset calls.
              </div>
            )}
          </div>

          {fouls.length > 0 && (
            <button
              type="button"
              className="calendar-demo__reset-button"
              onClick={applyResets}
            >
              Apply resets
            </button>
          )}
        </div>
      </div>

      <div className="calendar-demo__layout">
        <section className="calendar-demo__panel calendar-demo__panel--builder">
          <div className="calendar-demo__panel-header">
            <div>
              <div className="calendar-demo__eyebrow">Capstone demo</div>
              <h2 className="calendar-demo__title">Recurrence Builder</h2>
            </div>
            <span className="calendar-demo__panel-accent">14 fields / 7 rules</span>
          </div>

          <div className="calendar-demo__panel-body">
            <div className="calendar-demo__sections">
              <fieldset className="calendar-demo__section">
                <legend className="calendar-demo__section-title">Date Bounds</legend>
                <p className="calendar-demo__section-copy">
                  Establish the window, then decide whether the recurrence should stay fixed inside it.
                </p>

                <div className="calendar-demo__grid calendar-demo__grid--two">
                  <div
                    className={cls(
                      'calendar-demo__field',
                      !availability.fromDate.enabled && 'calendar-demo__field--disabled',
                    )}
                  >
                    <label className="calendar-demo__label" htmlFor="calendar-demo-fromDate">
                      {fieldMeta.fromDate.label}
                    </label>
                    <input
                      id="calendar-demo-fromDate"
                      className="calendar-demo__input"
                      type="date"
                      value={String(values.fromDate ?? '')}
                      disabled={!availability.fromDate.enabled}
                      onChange={(event) => updateStringField('fromDate', event.currentTarget.value)}
                    />
                    <div className="calendar-demo__detail">{fieldMeta.fromDate.detail}</div>
                  </div>

                  <div
                    className={cls(
                      'calendar-demo__field',
                      !availability.toDate.enabled && 'calendar-demo__field--disabled',
                    )}
                  >
                    <label className="calendar-demo__label" htmlFor="calendar-demo-toDate">
                      {fieldMeta.toDate.label}
                    </label>
                    <input
                      id="calendar-demo-toDate"
                      className="calendar-demo__input"
                      type="date"
                      value={String(values.toDate ?? '')}
                      disabled={!availability.toDate.enabled}
                      onChange={(event) => updateStringField('toDate', event.currentTarget.value)}
                    />
                    <div className="calendar-demo__detail">{fieldMeta.toDate.detail}</div>
                  </div>
                </div>

                <div
                  className={cls(
                    'calendar-demo__field',
                    'calendar-demo__field--toggle',
                    !availability.fixedBetween.enabled && 'calendar-demo__field--disabled',
                  )}
                >
                  <div>
                    <div className="calendar-demo__label">{fieldMeta.fixedBetween.label}</div>
                    <div className="calendar-demo__detail">{fieldMeta.fixedBetween.detail}</div>
                    {!availability.fixedBetween.enabled && availability.fixedBetween.reason && (
                      <div className="calendar-demo__reason">{availability.fixedBetween.reason}</div>
                    )}
                  </div>

                  <label className="calendar-demo__switch">
                    <input
                      type="checkbox"
                      checked={Boolean(values.fixedBetween)}
                      disabled={!availability.fixedBetween.enabled}
                      onChange={(event) => updateField('fixedBetween', event.currentTarget.checked)}
                    />
                    <span className="calendar-demo__switch-track" />
                  </label>
                </div>
              </fieldset>

              <fieldset className="calendar-demo__section">
                <legend className="calendar-demo__section-title">Explicit Dates</legend>
                <p className="calendar-demo__section-copy">
                  Add individual dates to override weekday, monthly, and sub-day pattern controls.
                </p>

                <div
                  className={cls(
                    'calendar-demo__field',
                    !availability.dates.enabled && 'calendar-demo__field--disabled',
                  )}
                >
                  <label className="calendar-demo__label" htmlFor="calendar-demo-dates">
                    {fieldMeta.dates.label}
                  </label>
                  <div className="calendar-demo__input-row">
                    <input
                      id="calendar-demo-dates"
                      className="calendar-demo__input"
                      type="date"
                      value={dateDraft}
                      disabled={!availability.dates.enabled}
                      onChange={(event) => setDateDraft(event.currentTarget.value)}
                    />
                    <button
                      type="button"
                      className="calendar-demo__action"
                      disabled={!availability.dates.enabled}
                      onClick={() => addStringListValue('dates', dateDraft, () => setDateDraft(''))}
                    >
                      Add
                    </button>
                  </div>
                  <div className="calendar-demo__detail">{fieldMeta.dates.detail}</div>
                  <div className="calendar-demo__chips">
                    {toStringList(values.dates).map((date) => (
                      <button
                        key={date}
                        type="button"
                        className="calendar-demo__chip"
                        disabled={!availability.dates.enabled}
                        onClick={() => removeListValue('dates', date)}
                      >
                        {date}
                      </button>
                    ))}
                    {toStringList(values.dates).length === 0 && (
                      <span className="calendar-demo__empty">No explicit dates yet.</span>
                    )}
                  </div>
                </div>
              </fieldset>

              <fieldset className="calendar-demo__section">
                <legend className="calendar-demo__section-title">Patterns</legend>
                <p className="calendar-demo__section-copy">
                  Build the recurring cadence with weekday toggles, month-day picks, and month selectors.
                </p>

                <div
                  className={cls(
                    'calendar-demo__field',
                    !availability.everyWeekday.enabled && 'calendar-demo__field--disabled',
                  )}
                >
                  <div className="calendar-demo__label">{fieldMeta.everyWeekday.label}</div>
                  <div className="calendar-demo__detail">{fieldMeta.everyWeekday.detail}</div>
                  <div className="calendar-demo__toggle-grid calendar-demo__toggle-grid--weekdays">
                    {weekdays.map((weekday) => (
                      <button
                        key={weekday.label}
                        type="button"
                        aria-pressed={toNumberList(values.everyWeekday).includes(weekday.value)}
                        className={cls(
                          'calendar-demo__toggle',
                          toNumberList(values.everyWeekday).includes(weekday.value) &&
                            'calendar-demo__toggle--active',
                        )}
                        disabled={!availability.everyWeekday.enabled}
                        onClick={() => toggleNumberList('everyWeekday', weekday.value)}
                      >
                        {weekday.label}
                      </button>
                    ))}
                  </div>
                  {!availability.everyWeekday.enabled && availability.everyWeekday.reason && (
                    <div className="calendar-demo__reason">{availability.everyWeekday.reason}</div>
                  )}
                </div>

                <div className="calendar-demo__grid calendar-demo__grid--two">
                  <div
                    className={cls(
                      'calendar-demo__field',
                      !availability.everyDate.enabled && 'calendar-demo__field--disabled',
                    )}
                  >
                    <div className="calendar-demo__label">{fieldMeta.everyDate.label}</div>
                    <div className="calendar-demo__detail">{fieldMeta.everyDate.detail}</div>
                    <div className="calendar-demo__toggle-grid">
                      {quickDates.map((date) => (
                        <button
                          key={date}
                          type="button"
                          aria-pressed={toNumberList(values.everyDate).includes(date)}
                          className={cls(
                            'calendar-demo__toggle',
                            toNumberList(values.everyDate).includes(date) &&
                              'calendar-demo__toggle--active',
                          )}
                          disabled={!availability.everyDate.enabled}
                          onClick={() => toggleNumberList('everyDate', date)}
                        >
                          {date}
                        </button>
                      ))}
                    </div>
                    <div className="calendar-demo__input-row">
                      <input
                        className="calendar-demo__input"
                        type="number"
                        min="1"
                        max="31"
                        inputMode="numeric"
                        value={everyDateDraft}
                        disabled={!availability.everyDate.enabled}
                        onChange={(event) => setEveryDateDraft(event.currentTarget.value)}
                      />
                      <button
                        type="button"
                        className="calendar-demo__action"
                        disabled={!availability.everyDate.enabled}
                        onClick={() =>
                          addNumberListValue('everyDate', everyDateDraft, () => setEveryDateDraft(''))
                        }
                      >
                        Add day
                      </button>
                    </div>
                    <div className="calendar-demo__chips">
                      {toNumberList(values.everyDate).map((date) => (
                        <button
                          key={date}
                          type="button"
                          className="calendar-demo__chip"
                          disabled={!availability.everyDate.enabled}
                          onClick={() => removeListValue('everyDate', date)}
                        >
                          day {date}
                        </button>
                      ))}
                      {toNumberList(values.everyDate).length === 0 && (
                        <span className="calendar-demo__empty">No month days selected.</span>
                      )}
                    </div>
                    {!availability.everyDate.enabled && availability.everyDate.reason && (
                      <div className="calendar-demo__reason">{availability.everyDate.reason}</div>
                    )}
                  </div>

                  <div
                    className={cls(
                      'calendar-demo__field',
                      !availability.everyMonth.enabled && 'calendar-demo__field--disabled',
                    )}
                  >
                    <div className="calendar-demo__label">{fieldMeta.everyMonth.label}</div>
                    <div className="calendar-demo__detail">{fieldMeta.everyMonth.detail}</div>
                    <div className="calendar-demo__toggle-grid calendar-demo__toggle-grid--months">
                      {months.map((month) => (
                        <button
                          key={month.label}
                          type="button"
                          aria-pressed={toNumberList(values.everyMonth).includes(month.value)}
                          className={cls(
                            'calendar-demo__toggle',
                            toNumberList(values.everyMonth).includes(month.value) &&
                              'calendar-demo__toggle--active',
                          )}
                          disabled={!availability.everyMonth.enabled}
                          onClick={() => toggleNumberList('everyMonth', month.value)}
                        >
                          {month.label}
                        </button>
                      ))}
                    </div>
                    {!availability.everyMonth.enabled && availability.everyMonth.reason && (
                      <div className="calendar-demo__reason">{availability.everyMonth.reason}</div>
                    )}
                  </div>
                </div>
              </fieldset>

              <fieldset className="calendar-demo__section">
                <legend className="calendar-demo__section-title">Exceptions</legend>
                <p className="calendar-demo__section-copy">
                  Exception fields only come alive when a recurrence pattern exists somewhere upstream.
                </p>

                <div className="calendar-demo__grid calendar-demo__grid--two">
                  <div
                    className={cls(
                      'calendar-demo__field',
                      !availability.exceptDates.enabled && 'calendar-demo__field--disabled',
                    )}
                  >
                    <label className="calendar-demo__label" htmlFor="calendar-demo-exceptDates">
                      {fieldMeta.exceptDates.label}
                    </label>
                    <div className="calendar-demo__input-row">
                      <input
                        id="calendar-demo-exceptDates"
                        className="calendar-demo__input"
                        type="date"
                        value={exceptDateDraft}
                        disabled={!availability.exceptDates.enabled}
                        onChange={(event) => setExceptDateDraft(event.currentTarget.value)}
                      />
                      <button
                        type="button"
                        className="calendar-demo__action"
                        disabled={!availability.exceptDates.enabled}
                        onClick={() =>
                          addStringListValue('exceptDates', exceptDateDraft, () => setExceptDateDraft(''))
                        }
                      >
                        Add
                      </button>
                    </div>
                    <div className="calendar-demo__detail">{fieldMeta.exceptDates.detail}</div>
                    <div className="calendar-demo__chips">
                      {toStringList(values.exceptDates).map((date) => (
                        <button
                          key={date}
                          type="button"
                          className="calendar-demo__chip"
                          disabled={!availability.exceptDates.enabled}
                          onClick={() => removeListValue('exceptDates', date)}
                        >
                          {date}
                        </button>
                      ))}
                      {toStringList(values.exceptDates).length === 0 && (
                        <span className="calendar-demo__empty">No excluded dates.</span>
                      )}
                    </div>
                    {!availability.exceptDates.enabled && availability.exceptDates.reason && (
                      <div className="calendar-demo__reason">{availability.exceptDates.reason}</div>
                    )}
                  </div>

                  <div
                    className={cls(
                      'calendar-demo__field',
                      !availability.exceptBetween.enabled && 'calendar-demo__field--disabled',
                    )}
                  >
                    <div className="calendar-demo__label">{fieldMeta.exceptBetween.label}</div>
                    <div className="calendar-demo__detail">{fieldMeta.exceptBetween.detail}</div>
                    <div className="calendar-demo__grid calendar-demo__grid--two">
                      <input
                        className="calendar-demo__input"
                        type="date"
                        value={exceptBetween.start ?? ''}
                        disabled={!availability.exceptBetween.enabled}
                        onChange={(event) => updateExceptBetween('start', event.currentTarget.value)}
                      />
                      <input
                        className="calendar-demo__input"
                        type="date"
                        value={exceptBetween.end ?? ''}
                        disabled={!availability.exceptBetween.enabled}
                        onChange={(event) => updateExceptBetween('end', event.currentTarget.value)}
                      />
                    </div>
                    {!availability.exceptBetween.enabled && availability.exceptBetween.reason && (
                      <div className="calendar-demo__reason">{availability.exceptBetween.reason}</div>
                    )}
                  </div>
                </div>
              </fieldset>

              <fieldset className="calendar-demo__section">
                <legend className="calendar-demo__section-title">Sub-Day Strategy</legend>
                <p className="calendar-demo__section-copy">
                  The `oneOf()` rule forces a call: choose specific hours, or choose an interval branch.
                </p>

                <div className="calendar-demo__grid calendar-demo__grid--two">
                  <div
                    className={cls(
                      'calendar-demo__field',
                      !availability.everyHour.enabled && 'calendar-demo__field--disabled',
                    )}
                  >
                    <div className="calendar-demo__label">{fieldMeta.everyHour.label}</div>
                    <div className="calendar-demo__detail">{fieldMeta.everyHour.detail}</div>
                    <div className="calendar-demo__input-row">
                      <select
                        className="calendar-demo__input calendar-demo__input--select"
                        value={hourDraft}
                        disabled={!availability.everyHour.enabled}
                        onChange={(event) => setHourDraft(event.currentTarget.value)}
                      >
                        {hourOptions.map((hour) => (
                          <option key={hour} value={hour}>
                            {formatHour(hour)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="calendar-demo__action"
                        disabled={!availability.everyHour.enabled}
                        onClick={() => addNumberListValue('everyHour', hourDraft, () => setHourDraft('9'))}
                      >
                        Add hour
                      </button>
                    </div>
                    <div className="calendar-demo__chips">
                      {toNumberList(values.everyHour).map((hour) => (
                        <button
                          key={hour}
                          type="button"
                          className="calendar-demo__chip"
                          disabled={!availability.everyHour.enabled}
                          onClick={() => removeListValue('everyHour', hour)}
                        >
                          {formatHour(hour)}
                        </button>
                      ))}
                      {toNumberList(values.everyHour).length === 0 && (
                        <span className="calendar-demo__empty">No specific hours picked.</span>
                      )}
                    </div>
                    {!availability.everyHour.enabled && availability.everyHour.reason && (
                      <div className="calendar-demo__reason">{availability.everyHour.reason}</div>
                    )}
                  </div>

                  <div className="calendar-demo__stack">
                    <div
                      className={cls(
                        'calendar-demo__field',
                        !availability.startTime.enabled && 'calendar-demo__field--disabled',
                      )}
                    >
                      <label className="calendar-demo__label" htmlFor="calendar-demo-startTime">
                        {fieldMeta.startTime.label}
                      </label>
                      <input
                        id="calendar-demo-startTime"
                        className="calendar-demo__input"
                        type="time"
                        value={String(values.startTime ?? '')}
                        disabled={!availability.startTime.enabled}
                        onChange={(event) => updateStringField('startTime', event.currentTarget.value)}
                      />
                      <div className="calendar-demo__detail">{fieldMeta.startTime.detail}</div>
                      {!availability.startTime.enabled && availability.startTime.reason && (
                        <div className="calendar-demo__reason">{availability.startTime.reason}</div>
                      )}
                    </div>

                    <div className="calendar-demo__grid calendar-demo__grid--two">
                      <div
                        className={cls(
                          'calendar-demo__field',
                          !availability.endTime.enabled && 'calendar-demo__field--disabled',
                        )}
                      >
                        <label className="calendar-demo__label" htmlFor="calendar-demo-endTime">
                          {fieldMeta.endTime.label}
                        </label>
                        <input
                          id="calendar-demo-endTime"
                          className="calendar-demo__input"
                          type="time"
                          value={String(values.endTime ?? '')}
                          disabled={!availability.endTime.enabled}
                          onChange={(event) => updateStringField('endTime', event.currentTarget.value)}
                        />
                        <div className="calendar-demo__detail">{fieldMeta.endTime.detail}</div>
                        {!availability.endTime.enabled && availability.endTime.reason && (
                          <div className="calendar-demo__reason">{availability.endTime.reason}</div>
                        )}
                      </div>

                      <div
                        className={cls(
                          'calendar-demo__field',
                          !availability.repeatEvery.enabled && 'calendar-demo__field--disabled',
                        )}
                      >
                        <label className="calendar-demo__label" htmlFor="calendar-demo-repeatEvery">
                          {fieldMeta.repeatEvery.label}
                        </label>
                        <input
                          id="calendar-demo-repeatEvery"
                          className="calendar-demo__input"
                          type="number"
                          min="5"
                          step="5"
                          inputMode="numeric"
                          placeholder="30"
                          value={String(values.repeatEvery ?? '')}
                          disabled={!availability.repeatEvery.enabled}
                          onChange={(event) => updateNumberField('repeatEvery', event.currentTarget.value)}
                        />
                        <div className="calendar-demo__detail">{fieldMeta.repeatEvery.detail}</div>
                        {!availability.repeatEvery.enabled && availability.repeatEvery.reason && (
                          <div className="calendar-demo__reason">{availability.repeatEvery.reason}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </fieldset>

              <fieldset className="calendar-demo__section">
                <legend className="calendar-demo__section-title">Duration</legend>
                <p className="calendar-demo__section-copy">
                  Shared event length stays independent from the recurrence mode, so it is always available.
                </p>

                <div
                  className={cls(
                    'calendar-demo__field',
                    !availability.duration.enabled && 'calendar-demo__field--disabled',
                  )}
                >
                  <label className="calendar-demo__label" htmlFor="calendar-demo-duration">
                    {fieldMeta.duration.label}
                  </label>
                  <div className="calendar-demo__input-row">
                    <input
                      id="calendar-demo-duration"
                      className="calendar-demo__input"
                      type="number"
                      min="15"
                      step="15"
                      inputMode="numeric"
                      placeholder="60"
                      value={String(values.duration ?? '')}
                      disabled={!availability.duration.enabled}
                      onChange={(event) => updateNumberField('duration', event.currentTarget.value)}
                    />
                    <span className="calendar-demo__suffix">minutes</span>
                  </div>
                  <div className="calendar-demo__detail">{fieldMeta.duration.detail}</div>
                </div>
              </fieldset>
            </div>
          </div>
        </section>

        <section className="calendar-demo__panel calendar-demo__panel--availability">
          <div className="calendar-demo__panel-header">
            <div>
              <div className="calendar-demo__eyebrow">Live state</div>
              <h2 className="calendar-demo__title">Availability Table</h2>
            </div>
            <span className="calendar-demo__panel-accent">useUmpire()</span>
          </div>

          <div className="calendar-demo__panel-body calendar-demo__panel-body--table">
            <div className="calendar-demo__table-shell">
              <table className="calendar-demo__table">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Value</th>
                    <th>Enabled</th>
                    <th>Required</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {fieldOrder.map((field) => {
                    const fieldAvailability = availability[field]

                    return (
                      <tr key={field}>
                        <td className="calendar-demo__table-field">{field}</td>
                        <td className="calendar-demo__table-value">
                          {renderValueSummary(field, values[field])}
                        </td>
                        <td>
                          <span className="calendar-demo__status">
                            <span
                              className={cls(
                                'calendar-demo__status-dot',
                                fieldAvailability.enabled
                                  ? 'calendar-demo__status-dot--enabled'
                                  : 'calendar-demo__status-dot--disabled',
                              )}
                            />
                            {fieldAvailability.enabled ? 'yes' : 'no'}
                          </span>
                        </td>
                        <td className="calendar-demo__table-required">
                          {fieldAvailability.required ? '✓' : '—'}
                        </td>
                        <td className="calendar-demo__table-reason">
                          {fieldAvailability.reason ?? '—'}
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
