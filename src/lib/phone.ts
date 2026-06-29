import parsePhoneNumberFromString, { CountryCode } from 'libphonenumber-js';

const DEFAULT_COUNTRY: CountryCode = 'IN';

/**
 * Normalizes a phone number to strict international E.164 format.
 * Uses 'IN' (India) as the default country if no country code is provided.
 * 
 * @param phone The raw phone number input (e.g. '9876543210', '+919876543210')
 * @returns An object containing the normalized E.164 string and a boolean indicating validity.
 */
export function normalizePhone(phone: string | null | undefined): { isValid: boolean; normalized: string | null; error?: string } {
  if (!phone || typeof phone !== 'string') {
    return { isValid: false, normalized: null, error: 'Phone number is required.' };
  }

  // Basic pre-cleaning: remove all non-numeric characters EXCEPT '+'
  const cleaned = phone.replace(/[^\d+]/g, '');

  if (!cleaned) {
    return { isValid: false, normalized: null, error: 'Phone number is empty after cleaning.' };
  }

  try {
    const phoneNumber = parsePhoneNumberFromString(cleaned, DEFAULT_COUNTRY);

    if (!phoneNumber) {
       return { isValid: false, normalized: null, error: 'Invalid phone number format.' };
    }

    if (!phoneNumber.isValid()) {
       return { isValid: false, normalized: null, error: 'Phone number is structurally invalid for the parsed region.' };
    }

    return { 
      isValid: true, 
      normalized: phoneNumber.format('E.164') 
    };
  } catch (error) {
    return { isValid: false, normalized: null, error: 'Failed to parse phone number.' };
  }
}

/**
 * Formats a phone number to international format for display purposes.
 * Returns the original string if parsing fails, to avoid breaking the UI.
 */
export function formatPhoneForDisplay(phone: string): string {
  if (!phone) return '';
  const parsed = parsePhoneNumberFromString(phone, DEFAULT_COUNTRY);
  if (parsed && parsed.isValid()) {
    return parsed.formatInternational(); // e.g. "+91 98765 43210"
  }
  return phone;
}
