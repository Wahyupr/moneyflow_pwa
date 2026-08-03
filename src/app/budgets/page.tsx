"use client";

import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppFrame } from "@/components/app-frame";
import { Toast, useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/money";

type Category = { id: string; name: string; color: string; icon: string };
type Budget = {
  id: string;
  category_id: string;
  category_name: string;
  category_color: string;
  amount_limit_minor: number;
  period: string;
  alert_at_percent: number;
};

export default function BudgetsPage() {
  return (
    <AppFrame title="MoneyFlow" subtitle="Budget">
      <BudgetsContent />
    </AppFrame>
  );
}

function BudgetsContent() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Budget | null>(null);
  const { toast, showToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, cRes] = await Promise.all([
        fetch("/api/budgets"),
        fetch("/api/categories")
      ]);
      const bJson = bRes.ok ? await bRes.json() : { budgets: [] };
      const cJson = cRes.ok ? await cRes.json() : { categories: [] };
      setBudgets(bJson.budgets ?? []);
      setCategories(cJson.categories ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleDelete(id: string) {
    const res = await fetch(`/api/budgets/${id}`, { method: "DELETE" });
    if (res.ok) {
      setBudgets((prev) => prev.filter((b) => b.id !== id));
      showToast("Budget dihapus.");
    } else {
      showToast("Gagal menghapus budget.", "error");
    }
  }

  function openCreate() { setEditTarget(null); setShowForm(true); }
  function openEdit(b: Budget) { setEditTarget(b); setShowForm(true); }

  async function handleSave(payload: { category_id: string; amount_limit_minor: number; alert_at_percent: number }) {
    if (editTarget) {
      const res = await fetch(`/api/budgets/${editTarget.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount_limit_minor: payload.amount_limit_minor, alert_at_percent: payload.alert_at_percent })
      });
      if (res.ok) { showToast("Budget diperbarui."); setShowForm(false); void load(); }
      else showToast("Gagal menyimpan.", "error");
    } else {
      const res = await fetch("/api/budgets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, period: "monthly" })
      });
      if (res.ok) { showToast("Budget ditambahkan."); setShowForm(false); void load(); }
      else showToast("Gagal menyimpan.", "error");
    }
  }

  return (
    <div className="mt-5 space-y-4">
      <Toast toast={toast} />

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-ink">Budget Bulanan</h2>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-card active:scale-[0.98]"
        >
          <Plus size={16} /> Tambah
        </button>
      </div>

      {showForm ? (
        <BudgetForm
          categories={categories}
          existingCategoryIds={budgets.filter((b) => b.id !== editTarget?.id).map((b) => b.category_id)}
          editTarget={editTarget}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      ) : null}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-container" />)}
        </div>
      ) : budgets.length === 0 ? (
        <div className="rounded-xl bg-surface p-6 text-center shadow-card">
          <p className="font-semibold text-ink">Belum ada budget</p>
          <p className="mt-1 text-sm text-muted">Tambahkan budget untuk memantau pengeluaran per kategori.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {budgets.map((budget) => (
            <div key={budget.id} className="flex items-center gap-3 rounded-xl bg-surface p-4 shadow-card">
              <div
                className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white text-sm font-bold"
                style={{ backgroundColor: budget.category_color }}
              >
                {budget.category_name.slice(0, 2).toUpperCase()}
              </div>
              <button type="button" onClick={() => openEdit(budget)} className="min-w-0 flex-1 text-left">
                <p className="font-bold text-ink">{budget.category_name}</p>
                <p className="text-sm text-muted">
                  Limit: {formatCurrency(budget.amount_limit_minor, "IDR")} · Alert {budget.alert_at_percent}%
                </p>
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(budget.id)}
                className="flex size-9 items-center justify-center rounded-lg text-expense hover:bg-expense/10 active:scale-95"
                aria-label="Hapus budget"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BudgetForm({
  categories,
  existingCategoryIds,
  editTarget,
  onSave,
  onCancel
}: {
  categories: Category[];
  existingCategoryIds: string[];
  editTarget: Budget | null;
  onSave: (p: { category_id: string; amount_limit_minor: number; alert_at_percent: number }) => void;
  onCancel: () => void;
}) {
  const available = categories.filter((c) => !existingCategoryIds.includes(c.id));
  const [categoryId, setCategoryId] = useState(editTarget?.category_id ?? available[0]?.id ?? "");
  const [limitInput, setLimitInput] = useState(
    editTarget ? String(editTarget.amount_limit_minor / 100) : ""
  );
  const [alertPct, setAlertPct] = useState(String(editTarget?.alert_at_percent ?? 80));

  function submit() {
    const amount = Math.round(Number(limitInput.replace(/\D/g, "")) * 100);
    if (!categoryId || amount < 1) return;
    onSave({ category_id: categoryId, amount_limit_minor: amount, alert_at_percent: Number(alertPct) || 80 });
  }

  return (
    <div className="rounded-xl bg-surface p-4 shadow-card space-y-3">
      <h3 className="font-bold text-ink">{editTarget ? "Edit Budget" : "Tambah Budget"}</h3>

      {!editTarget ? (
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">Kategori</span>
          <select
            className="mt-1 min-h-12 w-full rounded-xl border border-outline bg-surface px-4 text-ink focus:border-primary focus:outline-none"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {available.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      ) : (
        <p className="text-sm font-semibold text-muted">Kategori: <span className="text-ink">{editTarget.category_name}</span></p>
      )}

      <label className="block">
        <span className="text-xs font-bold uppercase tracking-wider text-muted">Limit per bulan (Rp)</span>
        <input
          className="mt-1 min-h-12 w-full rounded-xl border border-outline bg-surface px-4 text-ink focus:border-primary focus:outline-none"
          type="number"
          min={0}
          step={1000}
          placeholder="Contoh: 500000"
          value={limitInput}
          onChange={(e) => setLimitInput(e.target.value)}
        />
        <p className="mt-1 text-xs text-muted">Masukkan dalam Rupiah (contoh: 500000 = Rp500.000)</p>
      </label>

      <label className="block">
        <span className="text-xs font-bold uppercase tracking-wider text-muted">Alert saat mencapai (%)</span>
        <input
          className="mt-1 min-h-12 w-full rounded-xl border border-outline bg-surface px-4 text-ink focus:border-primary focus:outline-none"
          type="number"
          min={1}
          max={100}
          value={alertPct}
          onChange={(e) => setAlertPct(e.target.value)}
        />
      </label>

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={submit}
          className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-primary font-bold text-white active:scale-[0.98]"
        >
          Simpan
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-xl border border-outline px-4 font-semibold text-muted active:scale-[0.98]"
        >
          Batal
        </button>
      </div>
    </div>
  );
}
