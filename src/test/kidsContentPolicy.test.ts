import { describe, expect, it } from "vitest";
import { isKidsContentAllowed } from "@/constants/kidsRatings";

describe("Kids catalogue policy", () => {
  it("allows only G-rated Family or Kids animation content for ages 12 and under", () => {
    expect(isKidsContentAllowed({ title: "Family Story", contentRating: "G", genre: "Family", age_limit: 12 })).toBe(true);
    expect(isKidsContentAllowed({ title: "Cartoon Story", contentRating: "G", genre: "Animation", age_limit: 8 })).toBe(true);
  });

  it("rejects missing ratings, PG titles, adult genres, and content above age 12", () => {
    expect(isKidsContentAllowed({ title: "Unrated", genre: "Family" })).toBe(false);
    expect(isKidsContentAllowed({ title: "PG Story", contentRating: "PG", genre: "Family" })).toBe(false);
    expect(isKidsContentAllowed({ title: "Drama", contentRating: "G", genre: "Drama" })).toBe(false);
    expect(isKidsContentAllowed({ title: "Older Kids", contentRating: "G", genre: "Kids", age_limit: 13 })).toBe(false);
  });
});