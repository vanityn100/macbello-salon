import { describe, it, expect } from "vitest";
import { validateAndCalculateServiceStatus, InvalidStatusError } from "./serviceStatus";

describe("validateAndCalculateServiceStatus", () => {
  describe("When no status is provided (auto-calculate)", () => {
    it("should return OUT OF STOCK if stock is 0", () => {
      expect(validateAndCalculateServiceStatus(undefined, 0, 5)).toBe("OUT OF STOCK");
    });

    it("should return OUT OF STOCK if stock is negative", () => {
      expect(validateAndCalculateServiceStatus(null, -2, 5)).toBe("OUT OF STOCK");
    });

    it("should return LOW STOCK if stock is > 0 but <= min_stock", () => {
      expect(validateAndCalculateServiceStatus(undefined, 3, 5)).toBe("LOW STOCK");
      expect(validateAndCalculateServiceStatus(null, 5, 5)).toBe("LOW STOCK");
    });

    it("should return active if stock is > min_stock", () => {
      expect(validateAndCalculateServiceStatus(undefined, 6, 5)).toBe("ACTIVE");
      expect(validateAndCalculateServiceStatus(null, 100, 10)).toBe("ACTIVE");
    });

    it("should always return ACTIVE if category is Service regardless of stock", () => {
      expect(validateAndCalculateServiceStatus(undefined, 0, 5, "Service")).toBe("ACTIVE");
      expect(validateAndCalculateServiceStatus(null, -10, 5, "Service")).toBe("ACTIVE");
    });
  });

  describe("When a status is explicitly provided", () => {
    it("should return the exact provided status if it is in the allowed list", () => {
      expect(validateAndCalculateServiceStatus("active")).toBe("active");
      expect(validateAndCalculateServiceStatus("archived")).toBe("archived");
      expect(validateAndCalculateServiceStatus("OUT OF STOCK")).toBe("OUT OF STOCK");
      expect(validateAndCalculateServiceStatus("LOW STOCK")).toBe("LOW STOCK");
    });

    it("should throw InvalidStatusError if the provided status is not allowed", () => {
      expect(() => validateAndCalculateServiceStatus("foo")).toThrow(InvalidStatusError);
      expect(() => validateAndCalculateServiceStatus("low_stock")).toThrow(InvalidStatusError);
      expect(() => validateAndCalculateServiceStatus("out of stock")).toThrow(InvalidStatusError); // case sensitive
    });

    it("should ignore stock levels when a valid status is explicitly provided", () => {
      // Even if stock is 0, if the user explicitly provided 'active', it should trust the user.
      expect(validateAndCalculateServiceStatus("active", 0, 5)).toBe("active");
    });
  });
});
