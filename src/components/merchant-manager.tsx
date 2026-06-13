"use client";

import { Store } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Merchant = {
  id: string;
  name: string;
  logo_url: string | null;
  is_system: boolean;
  created_at: string;
};

export function MerchantManager({ onStatus }: { onStatus: (message: string) => void }) {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [name, setName] = useState("");
  const [logo, setLogo] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/merchants");
    if (response.ok) {
      setMerchants((await response.json()).merchants ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setName("");
    setLogo("");
    setEditingId(null);
  }

  async function submit() {
    if (!name.trim()) {
      onStatus("Nama merchant wajib diisi.");
      return;
    }

    const url = editingId ? `/api/admin/merchants/${editingId}` : "/api/admin/merchants";
    const method = editingId ? "PATCH" : "POST";
    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, logo_url: logo })
    });

    if (response.ok) {
      onStatus(editingId ? "Merchant diperbarui." : "Merchant ditambahkan.");
      resetForm();
      void load();
    } else {
      onStatus(editingId ? "Gagal memperbarui merchant." : "Gagal menambahkan merchant.");
    }
  }

  function startEdit(merchant: Merchant) {
    setEditingId(merchant.id);
    setName(merchant.name);
    setLogo(merchant.logo_url ?? "");
  }

  async function remove(id: string) {
    const response = await fetch(`/api/admin/merchants/${id}`, { method: "DELETE" });
    if (response.ok) {
      onStatus("Merchant dihapus.");
      if (editingId === id) {
        resetForm();
      }
      void load();
    } else {
      onStatus("Gagal menghapus merchant.");
    }
  }

  return (
    <section className="rounded-xl bg-surface p-4 shadow-card" id="merchants">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-surface-container text-primary">
          <Store size={18} />
        </div>
        <div>
          <h2 className="font-bold text-ink">Merchant Global</h2>
          <p className="text-sm text-muted">Hanya admin yang bisa kelola merchant.</p>
        </div>
      </div>

      <label className="mt-4 block">
        <span className="text-sm font-semibold text-muted">Nama merchant</span>
        <input
          className="mt-2 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Netflix"
        />
      </label>
      <label className="mt-3 block">
        <span className="text-sm font-semibold text-muted">URL logo</span>
        <input
          className="mt-2 min-h-12 w-full rounded-lg border border-outline bg-surface px-3 focus:border-primary focus:outline-none"
          value={logo}
          onChange={(event) => setLogo(event.target.value)}
          placeholder="https://.../netflix.png"
        />
      </label>
      <div className="mt-4 flex gap-2">
        <button className="min-h-12 flex-1 rounded-lg bg-primary px-4 font-bold text-white active:scale-[0.98]" onClick={submit} type="button">
          {editingId ? "Simpan Perubahan" : "Tambah Merchant"}
        </button>
        {editingId ? (
          <button className="min-h-12 rounded-lg bg-surface-container px-4 font-bold text-primary active:scale-[0.98]" onClick={resetForm} type="button">
            Batal
          </button>
        ) : null}
      </div>

      {merchants.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {merchants.map((merchant) => (
            <li className="flex items-center gap-3 rounded-lg border border-outline p-2" key={merchant.id}>
              {merchant.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={merchant.name} className="size-8 rounded-md object-cover" src={merchant.logo_url} />
              ) : (
                <span className="flex size-8 items-center justify-center rounded-md bg-surface-container text-primary">
                  <Store size={16} />
                </span>
              )}
              <span className="min-w-0 flex-1 truncate font-semibold text-ink">{merchant.name}</span>
              <button className="min-h-9 rounded-lg bg-surface-container px-3 text-xs font-bold text-primary active:scale-[0.98]" onClick={() => startEdit(merchant)} type="button">
                Edit
              </button>
              <button className="min-h-9 rounded-lg bg-error-container px-3 text-xs font-bold text-on-error-container active:scale-[0.98]" onClick={() => remove(merchant.id)} type="button">
                Hapus
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">Belum ada merchant global.</p>
      )}
    </section>
  );
}
