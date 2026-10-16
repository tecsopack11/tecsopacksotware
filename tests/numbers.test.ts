import assert from "node:assert/strict";
import test from "node:test";
import { formatCanonicalNumber, matchesNumericValue, parseColombianNumber, numericInputError } from "../lib/numbers.ts";

test("quantities and prices use Colombian grouping without losing decimal precision", () => {
  for (const [canonical, visible] of [["10000", "10.000"], ["3000", "3.000"], ["1425.40", "1.425,40"], ["1234567.891", "1.234.567,891"], ["-1234.5", "-1.234,5"], ["0.001", "0,001"], ["", ""]]) {
    assert.equal(formatCanonicalNumber(canonical), visible);
    assert.equal(parseColombianNumber(visible), canonical);
  }
});
test("pasted grouping and empty decimal editing keep safe canonical form values", () => {
  assert.equal(parseColombianNumber("1.234.567,89"), "1234567.89");
  assert.equal(parseColombianNumber(" 10.000,50 "), "10000.50");
  assert.equal(parseColombianNumber("100,"), "100");
  assert.equal(formatCanonicalNumber("100."), "100,");
  assert.equal(parseColombianNumber("-"), "");
  assert.equal(parseColombianNumber("0,001"), "0.001");
  assert.equal(parseColombianNumber("1,2,3"), null);
  assert.equal(parseColombianNumber("12abc"), null);
});
test("min, max and step constraints still apply to localized text inputs", () => {
  assert.equal(numericInputError("0.001", { min: "0.001", step: "0.001" }), "");
  assert.match(numericInputError("0", { min: "0.001" }), /0,001/);
  assert.match(numericInputError("10001", { max: "10000" }), /10\.000/);
  assert.notEqual(numericInputError("1.2345", { step: "0.001" }), "");
  assert.equal(numericInputError("0.3", { step: "0.1" }), "");
  assert.equal(numericInputError("987654321.99", { step: "0.01" }), "");
  assert.notEqual(numericInputError("987654321.995", { step: "0.01" }), "");
  assert.equal(numericInputError("1.2345", { step: "any" }), "");
  assert.equal(numericInputError("", { min: "1" }), "");
  assert.notEqual(numericInputError("", { required: true, text: "-" }), "");
  assert.notEqual(numericInputError("", { text: "," }), "");
  assert.notEqual(numericInputError("", { required: true }), "");
});

test("numeric controlled fields retain the decimal edit buffer and can be cleared", () => {
  for (const visible of ["1", "1,", "1,0", "1,05", "1,050"]) {
    const canonical = parseColombianNumber(visible)!;
    assert.equal(matchesNumericValue(canonical, Number(canonical)), true);
  }
  assert.equal(matchesNumericValue("", 0), true);
  assert.equal(matchesNumericValue("1.05", 1.1), false);
  assert.equal(matchesNumericValue("1.05", "1.05"), true);
});
