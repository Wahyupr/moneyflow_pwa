export type CurrencyCode = "IDR" | "SGD" | "MYR" | "USD";

export type TransactionType = "expense" | "income" | "transfer";

export type DocumentType = "qris" | "bank_transfer" | "ewallet_transfer" | "receipt" | "unknown";

export type PlanTier = "free" | "premium";

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
