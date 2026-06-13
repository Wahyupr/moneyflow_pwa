export type OfflineDraft = {
  id: string;
  created_at: string;
  payload: Record<string, unknown>;
};

const queueKey = "MoneyFlow:offline-drafts";

export function createOfflineDraftQueue(storage: Storage) {
  return {
    enqueue(draft: OfflineDraft) {
      const drafts = readQueue(storage);
      const nextDrafts = drafts.filter((item) => item.id !== draft.id).concat(draft);
      storage.setItem(queueKey, JSON.stringify(nextDrafts));
    },
    list() {
      return readQueue(storage);
    },
    markSynced(id: string) {
      storage.setItem(queueKey, JSON.stringify(readQueue(storage).filter((draft) => draft.id !== id)));
    }
  };
}

function readQueue(storage: Storage): OfflineDraft[] {
  const raw = storage.getItem(queueKey);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
