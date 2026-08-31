export type CurrencyCode = "IDR" | "SGD" | "MYR" | "USD";

export type TransactionType = "expense" | "income" | "transfer";

export type DocumentType = "qris" | "bank_transfer" | "ewallet_transfer" | "receipt" | "unknown";

export type PlanTier = "free" | "premium" | "pro";

export type LedgerTransaction = {
  id: string;
  user_id: string;
  wallet_id: string;
  category_id: string | null;
  merchant_name: string | null;
  payment_method: string | null;
  transaction_type: TransactionType;
  amount_minor: number;
  currency: CurrencyCode;
  occurred_at: string;
  transfer_pair_id: string | null;
  /** Free-text note attached when recording the transaction (esp. manual input). */
  note?: string | null;
  /** How this transaction was recorded, e.g. "manual", "receipt_scan", "voice". */
  input_method?: string | null;
  /** Resolved from the global merchant directory by merchant_name, if matched. */
  merchant_logo_url?: string | null;
  /** Display name or email of the user who created this transaction (for shared wallets). */
  created_by_name?: string | null;
  /** Name of the wallet this transaction belongs to. */
  wallet_name?: string | null;
  /** Wallet type (bank, ewallet, cash, ...) — used to resolve the provider logo. */
  wallet_type?: string | null;
  /** Wallet's provider/institution (e.g. "GoPay", "BCA") for the brand logo. */
  wallet_institution_name?: string | null;
  /** Wallet card color, used as a fallback badge when no provider logo exists. */
  wallet_color?: string | null;
  /** Resolved category display fields, if the transaction has a category. */
  category_name?: string | null;
  category_icon?: string | null;
  category_color?: string | null;
};



export type ExtractionLineItem = {
  name: string;
  qty: number;
  unit_amount_minor: number;
  subtotal_minor: number;
};

export type ExtractionDraft = {
  document_type: DocumentType;
  transaction_type: TransactionType | null;
  amount_minor: number | null;
  currency: CurrencyCode;
  occurred_at: string | null;
  merchant_name: string | null;
  counterparty_name: string | null;
  payment_method: string | null;
  reference_number: string | null;
  line_items: ExtractionLineItem[];
  confidence: number;
  needs_review: boolean;
  warnings: string[];
};

export type Result = { ok: true } | { ok: false; reason: string };
