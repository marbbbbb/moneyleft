// Cash account types offered in the UI (subset of the DB enum cash_account_type).
// Kept in its own module so both the client form and the server action can
// import it (a "use server" file may only export async functions).
export const CASH_ACCOUNT_TYPES = ["checking", "savings", "cash"] as const;
export type CashAccountType = (typeof CASH_ACCOUNT_TYPES)[number];
