/** Shared PIN/password length limits for UI and validation */
export const MIN_PIN_LENGTH = 4;
export const MAX_NUMERIC_PIN_LENGTH = 20;
export const MAX_ALPHANUMERIC_PIN_LENGTH = 20;

export function getMaxPinLength(mode: 'numeric' | 'alphanumeric'): number {
  return mode === 'numeric' ? MAX_NUMERIC_PIN_LENGTH : MAX_ALPHANUMERIC_PIN_LENGTH;
}
