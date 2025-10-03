import { ValidationError } from 'class-validator'

export type ParsedError = {
  [field: string]: { [type: string]: string }
}

export function parseError(
  errors: ValidationError[],
  parentName?: string,
): ParsedError[] {
  return errors.flatMap(error => {
    const entityName = buildPropertyName(error.property, parentName)
    const nestedErrors = error.children
      ? parseError(error.children, entityName)
      : []
    const ownError = error.constraints
      ? [{ [entityName]: error.constraints }]
      : []
    return [...nestedErrors, ...ownError]
  })
}

function buildPropertyName(name: string, parentName?: string) {
  return parentName ? `${parentName}.${name}` : name
}
