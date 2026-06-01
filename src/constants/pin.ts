import { Platform, type TextInputProps } from 'react-native';

/** Shared PIN/password length limits for UI and validation */
export const MIN_PIN_LENGTH = 4;
export const MAX_NUMERIC_PIN_LENGTH = 20;
export const MAX_ALPHANUMERIC_PIN_LENGTH = 20;

export type PinMode = 'numeric' | 'alphanumeric';

export function getMaxPinLength(mode: PinMode): number {
  return mode === 'numeric' ? MAX_NUMERIC_PIN_LENGTH : MAX_ALPHANUMERIC_PIN_LENGTH;
}

/**
 * TextInput props for PIN/password fields.
 * On Android, secureTextEntry + keyboardType "numeric" forces a number pad even for
 * alphanumeric passwords (ReactTextInputManager.checkPasswordType).
 */
export function getPinTextInputProps(
  mode: PinMode,
): Pick<TextInputProps, 'keyboardType' | 'inputMode' | 'autoCapitalize' | 'autoCorrect' | 'textContentType'> {
  if (mode === 'numeric') {
    return {
      keyboardType: 'numeric',
      inputMode: 'numeric',
      autoCapitalize: 'none',
      autoCorrect: false,
      textContentType: 'none',
    };
  }
  return {
    keyboardType: 'default',
    inputMode: 'text',
    autoCapitalize: 'none',
    autoCorrect: false,
    textContentType: Platform.OS === 'ios' ? 'password' : 'none',
  };
}
