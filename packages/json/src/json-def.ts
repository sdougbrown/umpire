type JsonDefCarrier<T> = T & {
  __jsonDef?: unknown
}

export function attachJsonDef<T extends object, D>(value: T, jsonDef: D): T {
  Object.defineProperty(value as JsonDefCarrier<T>, '__jsonDef', {
    configurable: false,
    enumerable: false,
    value: jsonDef,
    writable: false,
  })

  return value
}

export function getJsonDef<D>(value: unknown): D | undefined {
  if (typeof value !== 'object' || value === null || !('__jsonDef' in value)) {
    return undefined
  }

  return (value as JsonDefCarrier<object>).__jsonDef as D | undefined
}
