import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import { errorText } from "@/lib/errors";

describe("errorText", () => {
  it("passes English through for English readers", () => {
    expect(errorText(new ApiError(400, "invalid_input", "Pick a date in the future"), "en", "Error")).toBe("Pick a date in the future");
  });

  it("never shows English to Marathi readers", () => {
    expect(errorText(new ApiError(400, "invalid_input", "Pick a date in the future"), "mr", "x")).toBe("पुढील तारीख निवडा.");
    expect(errorText(new ApiError(404, "not_found", "Case not found"), "mr", "x")).toBe("हे सापडले नाही.");
    expect(errorText(new ApiError(429, "TOO_MANY", "Too many requests"), "mr", "x")).toMatch(/खूप प्रयत्न/);
    expect(errorText(new ApiError(500, "internal", "Something went wrong"), "mr", "काहीतरी चुकले")).toBe("काहीतरी चुकले");
    expect(errorText(new Error("network down"), "mr", "काहीतरी चुकले")).toBe("काहीतरी चुकले");
  });
});
