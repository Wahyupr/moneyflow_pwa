"use client";

import { AlertTriangle, Check, FileCheck2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { Toast, useToast } from "@/components/ui/toast";
import { dashboardModel } from "@/lib/demo-data";

type DraftState = {
  id?: string;
  amount_minor: number;
  transaction_type: "expense" | "income" | "transfer";
  merchant_name: string;
  counterparty_name: string;
  occurred_at: string;
  payment_method: string;
  confidence: number;
  warnings: string[];
};

const fallbackDraft: DraftState = {
  amount_minor: 21_000,
  transaction_type: "expense",
  merchant_name: "Kopi Kenangan",
  counterparty_name: "",
  occurred_at: new Date().toISOString().slice(0, 16),
  payment_method: "GoPay",
  confidence: 0.62,
  warnings: ["Draft dari AI perlu dicek sebelum disimpan."]
};

export default function AiTransactionReviewPage() {
  const [draft, setDraft] = useState<DraftState>(fallbackDraft);
  const { toast, showToast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const draftId = params.get("draft");
    const voicePreview = localStorage.getItem("voice_draft_preview");

    if (voicePreview && !draftId) {
      setDraft((current) => ({ ...current, merchant_name: voicePreview.replace(/^.*?\bdi\s+/i, "").replace(/\s+pakai.*$/i, "") || current.merchant_name }));
    }

    if (!draftId) {
      return;
    }

    fetch(`/api/drafts/${draftId}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        const extracted = json?.draft?.extracted_json;
        if (extracted) {
          setDraft({
            id: draftId,
            amount_minor: extracted.amount_minor ?? fallbackDraft.amount_minor,
            transaction_type: extracted.transaction_type ?? "expense",
            merchant_name: extracted.merchant_name ?? "",
            counterparty_name: extracted.counterparty_name ?? "",
            occurred_at: (extracted.occurred_at ?? new Date().toISOString()).slice(0, 16),
            payment_method: extracted.payment_method ?? "",
            confidence: extracted.confidence ?? 0.5,
            warnings: extracted.warnings ?? fallbackDraft.warnings
          });
        }
      })
      .catch(() => undefined);
  }, []);

  async function confirmDraft() {
    if (draft.id) {
      await fetch(`/api/drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount_minor: draft.amount_minor,
          transaction_type: draft.transaction_type,
          merchant_name: draft.merchant_name,
          counterparty_name: draft.counterparty_name || null,
          occurred_at: new Date(draft.occurred_at).toISOString(),
          payment_method: draft.payment_method,
          needs_review: false,
          confidence: Math.max(draft.confidence, 0.9)
        })
      });
      const response = await fetch(`/api/drafts/${draft.id}/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet_id: dashboardModel.wallets[0].id, reviewed: true })
      });
      showToast(response.ok ? "Draft disimpan sebagai transaksi." : "Draft tersimpan lokal.");
      return;
    }

    showToast("Draft disimpan lokal.");
  }

  return (
    <AppFrame title="AI Review" subtitle="Draft transaksi">
      <div className="mt-5 space-y-4">
        <section className="rounded-xl border-2 border-dashed border-warning bg-[#fff7e6] p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
              <FileCheck2 size={20} />
            </div>
            <div>
              <h2 className="font-bold text-ink">Review sebelum simpan</h2>
              <p className="mt-1 text-sm text-[#6f4b00]">Confidence {Math.round(draft.confidence * 100)}%</p>
            </div>
          </div>
        </section>
        <section className="space-y-4 rounded-xl bg-surface p-4 shadow-card">
          <Field label="Nominal" value={String(draft.amount_minor)} onChange={(value) => setDraft((current) => ({ ...current, amount_minor: Number(value) || 0 }))} />
          <label className="block">
            <span className="text-sm font-semibold text-muted">Tipe</span>
            <select className="mt-2 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none" value={draft.transaction_type} onChange={(event) => setDraft((current) => ({ ...current, transaction_type: event.target.value as DraftState["transaction_type"] }))}>
              <option value="expense">Pengeluaran</option>
              <option value="income">Pemasukan</option>
              <option value="transfer">Transfer</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-muted">Dompet</span>
            <select className="mt-2 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none">
              {dashboardModel.wallets.map((wallet) => (
                <option key={wallet.id}>{wallet.name}</option>
              ))}
            </select>
          </label>
          <Field label="Merchant" value={draft.merchant_name} onChange={(value) => setDraft((current) => ({ ...current, merchant_name: value }))} />
          <Field label="Counterparty" value={draft.counterparty_name} onChange={(value) => setDraft((current) => ({ ...current, counterparty_name: value }))} />
          <Field label="Tanggal" type="datetime-local" value={draft.occurred_at} onChange={(value) => setDraft((current) => ({ ...current, occurred_at: value }))} />
          <Field label="Payment Method" value={draft.payment_method} onChange={(value) => setDraft((current) => ({ ...current, payment_method: value }))} />
        </section>
        <section className="rounded-xl bg-surface p-4 shadow-card">
          <div className="flex items-center gap-2 text-warning">
            <AlertTriangle size={18} />
            <h2 className="font-bold">Warnings</h2>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {draft.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
        <Toast toast={toast} />
        <button className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 font-bold text-white active:scale-[0.98]" onClick={confirmDraft} type="button">
          <Check size={18} />
          Confirm Draft
        </button>
      </div>
    </AppFrame>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-muted">{label}</span>
      <input className="mt-2 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
