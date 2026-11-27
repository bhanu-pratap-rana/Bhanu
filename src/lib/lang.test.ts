import { describe, expect, it } from "vitest";
import { langOf } from "./lang";

describe("langOf", () => {
  it("marks mostly-Devanagari text as Hindi", () => {
    expect(langOf("भानु ने हिंदी के लिए कौन-कौन से AI प्रोजेक्ट बनाए हैं?")).toBe("hi");
  });
  it("leaves English, mixed-in Hindi words and empty text alone", () => {
    expect(langOf("He built search over गोदान and 1,632 other books.")).toBeUndefined();
    expect(langOf("")).toBeUndefined();
    expect(langOf(undefined)).toBeUndefined();
  });
});
