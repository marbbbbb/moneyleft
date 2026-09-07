// Unit tests for the e-invoice QR parser.
//
// Run:  node --test lib/einvoice.test.ts
// (Node 24 strips the TypeScript types natively - no test runner to install.)

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEInvoiceQR } from "./einvoice.ts";

// A synthetic but structurally valid left-QR string, built field by field so
// each offset is visible. 10 + 7 + 4 + 8 + 8 + 8 + 8 + 24 = 77 chars.
const parts = {
  invoiceNumber: "AB12345678",
  date: "1130215", //           ROC 113-02-15  ->  2024-02-15
  randomCode: "1234",
  salesAmountExTax: "000003E8", // hex 0x3E8 = 1000
  totalAmount: "0000041A", //     hex 0x41A = 1050
  buyerId: "00000000", //         absent
  sellerId: "12345678",
  crypto: "ABCDEFGHIJKLMNOPQRSTUVWX", // 24 chars, ignored
};
const SAMPLE = Object.values(parts).join("");

test("SAMPLE is exactly 77 characters", () => {
  assert.equal(SAMPLE.length, 77);
});

test("parses every field of a well-formed QR", () => {
  const r = parseEInvoiceQR(SAMPLE);
  assert.deepEqual(r, {
    invoiceNumber: "AB12345678",
    date: "2024-02-15",
    randomCode: "1234",
    salesAmountExTax: 1000,
    totalAmount: 1050,
    buyerId: null,
    sellerId: "12345678",
  });
});

test("amount fields are decoded as hexadecimal, not decimal", () => {
  // "0000000A" is 10 in hex; a decimal reading would give 0 or throw.
  const raw =
    "AB12345678" + "1130215" + "1234" + "0000000A" + "00000064" + "00000000" +
    "12345678" + "ABCDEFGHIJKLMNOPQRSTUVWX";
  const r = parseEInvoiceQR(raw);
  assert.equal(r?.salesAmountExTax, 10); //  0x0A
  assert.equal(r?.totalAmount, 100); //      0x64
});

test("ROC date is converted by adding 1911 to the year", () => {
  const mk = (roc: string) =>
    parseEInvoiceQR(
      "AB12345678" + roc + "1234" + "000003E8" + "0000041A" + "00000000" +
      "12345678" + "ABCDEFGHIJKLMNOPQRSTUVWX",
    )?.date;
  assert.equal(mk("1130215"), "2024-02-15");
  assert.equal(mk("1000101"), "2011-01-01");
  assert.equal(mk("0910101"), "2002-01-01");
});

test("a real buyer tax ID is returned as-is", () => {
  const raw =
    "AB12345678" + "1130215" + "1234" + "000003E8" + "0000041A" + "53212539" +
    "12345678" + "ABCDEFGHIJKLMNOPQRSTUVWX";
  assert.equal(parseEInvoiceQR(raw)?.buyerId, "53212539");
});

test("trailing content beyond 77 chars is ignored", () => {
  const r = parseEInvoiceQR(SAMPLE + ":**********0000:extra product data");
  assert.equal(r?.invoiceNumber, "AB12345678");
  assert.equal(r?.totalAmount, 1050);
});

test("surrounding whitespace is tolerated", () => {
  const r = parseEInvoiceQR("  \n" + SAMPLE + "\n ");
  assert.equal(r?.invoiceNumber, "AB12345678");
});

test("returns null when shorter than 77 characters", () => {
  assert.equal(parseEInvoiceQR(SAMPLE.slice(0, 76)), null);
  assert.equal(parseEInvoiceQR(""), null);
});

test("returns null on a malformed invoice number", () => {
  const swap = (prefix: string) =>
    parseEInvoiceQR(prefix + SAMPLE.slice(prefix.length));
  assert.equal(swap("ab12345678"), null); // lowercase letters
  assert.equal(swap("A112345678"), null); // digit in a letter slot
  assert.equal(swap("ABC2345678"), null); // letter in a digit slot
});

test("returns null on an unparseable or impossible date", () => {
  const withDate = (d: string) =>
    parseEInvoiceQR(
      "AB12345678" + d + "1234" + "000003E8" + "0000041A" + "00000000" +
      "12345678" + "ABCDEFGHIJKLMNOPQRSTUVWX",
    );
  assert.equal(withDate("11302XX"), null); // non-numeric
  assert.equal(withDate("1131330"), null); // month 13
  assert.equal(withDate("1130230"), null); // Feb 30
});

test("returns null on non-hex amount fields", () => {
  const raw =
    "AB12345678" + "1130215" + "1234" + "ZZZZZZZZ" + "0000041A" + "00000000" +
    "12345678" + "ABCDEFGHIJKLMNOPQRSTUVWX";
  assert.equal(parseEInvoiceQR(raw), null);
});

test("never throws on junk input", () => {
  // @ts-expect-error - deliberately wrong types
  assert.equal(parseEInvoiceQR(null), null);
  // @ts-expect-error
  assert.equal(parseEInvoiceQR(undefined), null);
  // @ts-expect-error
  assert.equal(parseEInvoiceQR(12345), null);
  assert.equal(parseEInvoiceQR("!@#$%^&*()".repeat(20)), null);
});
