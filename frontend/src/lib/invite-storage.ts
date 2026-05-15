import type { InviteRecord } from "../types/api";

const STORAGE_KEY = "accounting_recent_invites";

export const getStoredInvites = (): InviteRecord[] => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as InviteRecord[];
  } catch {
    return [];
  }
};

export const saveStoredInvites = (invites: InviteRecord[]) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(invites));
};

export const upsertStoredInvite = (invite: InviteRecord) => {
  const current = getStoredInvites();
  const next = [invite, ...current.filter((item) => item.id !== invite.id)];
  saveStoredInvites(next);
};
