// Parser for the LEFT QR code on a Taiwanese e-invoice proof slip
// (dian zi fa piao zheng ming lian). Pure - no imports, no I/O, no throws -
// so it is safe in a Client Component, a Server Action, or a test.
//
// The left QR encodes a fixed-width record. Fields are read by character
// offset (see OFFSETS). Two fields are easy to get wrong:
//
//   * the date is ROC / Minguo format `yyyMMdd` - the year is 1911 less than
//     the Gregorian year, so "1130215" is 2024-02-15.
//   * the two amount fields are HEXADECIMAL, not decimal. "000003E8" is 1000.
//
// These offsets were supplied by Marcus, who was not fully certain of them.
// Confirm a real receipt's parsed `totalAmount` against its printed total
// before building anything on top of this (see lib/einvoice.test.ts).

export interface ParsedInvoice {
  /** Invoice number: 2 uppercase letters + 8 digits, e.g. "AB12345678". */
  invoiceNumber: string;
  /** Invoice date as an ISO Gregorian date, e.g. "2024-02-15". */
  date: string;
  /** 4-character random verification code, e.g. "1234". */
  randomCode: string;
  /** Sales amount excluding tax, decoded from the QR's hexadecimal field. */
  salesAmountExTax: number;
  /** Total amount, tax inclusive, decoded from the QR's hexadecimal field. */
  totalAmount: number;
  /** Buyer tax ID (8 chars), or null when the receipt names no buyer ("00000000"). */
  buyerId: string | null;
  /** Seller tax ID, 8 chars. */
  sellerId: string;
}

/** The left QR is at least this many characters. Anything shorter is rejected. */
const MIN_LENGTH = 77;

// [start, end) character offsets of each field within the record.
const OFFSETS = {
  invoiceNumber: [0, 10],
  date: [10, 17],
  randomCode: [17, 21],
  salesAmountExTax: [21, 29],
  totalAmount: [29, 37],
  buyerId: [37, 45],
  sellerId: [45, 53],
  // [53, 77) is an encryption verification block - deliberately ignored.
} as const;

const INVOICE_NUMBER_RE = /^[A-Z]{2}[0-9]{8}$/;

function field(raw: string, key: keyof typeof OFFSETS): string {
  const [start, end] = OFFSETS[key];
  return raw.slice(start, end);
}

/** Hex string -> number. Returns NaN for anything that is not clean hex. */
function fromHex(value: string): number {
  if (!/^[0-9a-fA-F]+$/.test(value)) return NaN;
  return parseInt(value, 16);
}

/**
 * ROC `yyyMMdd` -> ISO `yyyy-mm-dd`. Returns null when the input is not 7
 * digits or does not describe a real calendar date (e.g. month 13, Feb 30).
 */
function rocDateToISO(value: string): string | null {
  if (!/^[0-9]{7}$/.test(value)) return null;
  const year = parseInt(value.slice(0, 3), 10) + 1911;
  const month = parseInt(value.slice(3, 5), 10);
  const day = parseInt(value.slice(5, 7), 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // Round-trip through Date to reject impossible days (2024-02-30 etc.).
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }

  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/**
 * Parse the raw text of the left QR code. Returns null - never throws - for
 * input that is too short, has a malformed invoice number, carries an
 * unparseable date, or has non-hex amount fields.
 */
export function parseEInvoiceQR(raw: string): ParsedInvoice | null {
  if (typeof raw !== "string") return null;

  // Scanners occasionally tack on a trailing newline; strip surrounding
  // whitespace before measuring or slicing.
  const s = raw.trim();
  if (s.length < MIN_LENGTH) return null;

  const invoiceNumber = field(s, "invoiceNumber");
  if (!INVOICE_NUMBER_RE.test(invoiceNumber)) return null;

  const date = rocDateToISO(field(s, "date"));
  if (date === null) return null;

  const salesAmountExTax = fromHex(field(s, "salesAmountExTax"));
  const totalAmount = fromHex(field(s, "totalAmount"));
  if (!Number.isFinite(salesAmountExTax) || !Number.isFinite(totalAmount)) {
    return null;
  }

  const rawBuyerId = field(s, "buyerId");
  const buyerId = rawBuyerId === "00000000" ? null : rawBuyerId;

  return {
    invoiceNumber,
    date,
    randomCode: field(s, "randomCode"),
    salesAmountExTax,
    totalAmount,
    buyerId,
    sellerId: field(s, "sellerId"),
  };
}
