export class InvalidStatusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStatusError";
  }
}

const ALLOWED_STATUSES = [
  "active",
  "archived",
  "ACTIVE",
  "LOW STOCK",
  "OUT OF STOCK",
  "ARCHIVED"
];

/**
 * Validates and calculates a valid status for a catalogue/inventory service.
 * @param providedStatus Optional status provided by the UI.
 * @param currentStock Current stock of the item (defaults to 0).
 * @param minStock Minimum stock alert threshold (defaults to 5).
 * @returns A guaranteed valid status string.
 * @throws {InvalidStatusError} If the provided status is explicitly invalid.
 */
export function validateAndCalculateServiceStatus(
  providedStatus?: string | null,
  currentStock: number = 0,
  minStock: number = 5,
  category?: string
): string {
  // If a status was explicitly provided, validate it first.
  if (providedStatus && typeof providedStatus === "string") {
    const trimmedStatus = providedStatus.trim();
    if (ALLOWED_STATUSES.includes(trimmedStatus)) {
      return trimmedStatus;
    }
    
    // Throwing a custom error to be caught by the API route and returned as a 400 Bad Request
    throw new InvalidStatusError(
      `Invalid status provided: "${trimmedStatus}". Allowed values are: ${ALLOWED_STATUSES.join(", ")}.`
    );
  }

  // If no status was provided, calculate it based on stock thresholds.
  if (category === "Service") {
    return "ACTIVE";
  }

  if (currentStock <= 0) {
    return "OUT OF STOCK";
  } else if (currentStock <= minStock) {
    return "LOW STOCK";
  } else {
    return "ACTIVE";
  }
}
