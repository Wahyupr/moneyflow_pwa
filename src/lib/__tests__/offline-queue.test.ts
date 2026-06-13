import { describe, expect, it } from "vitest";
import { createOfflineDraftQueue } from "../offline-queue";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  length = 0;

  clear(): void {
    this.values.clear();
    this.length = 0;
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
    this.length = this.values.size;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
    this.length = this.values.size;
  }
}

describe("offline draft queue", () => {
  it("persists drafts until they are marked as synced", () => {
    const queue = createOfflineDraftQueue(new MemoryStorage());

    queue.enqueue({
      id: "draft-1",
      created_at: "2026-06-12T00:00:00.000Z",
      payload: { amount_minor: 38_000, wallet_id: "wallet-a" }
    });

    expect(queue.list()).toHaveLength(1);
    queue.markSynced("draft-1");
    expect(queue.list()).toEqual([]);
  });
});
