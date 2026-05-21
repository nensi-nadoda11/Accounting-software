import type { Company, PermissionKey, User } from "../types/auth";

export const SESSION_EXPIRED_EVENT = "session-expired";
export const SESSION_UPDATED_EVENT = "session-updated";

export type SessionUpdatedDetail = {
  accessToken: string;
  user: User;
  company: Company | null;
  permissions: PermissionKey[];
};

export const dispatchSessionExpired = () => {
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
};

export const dispatchSessionUpdated = (detail: SessionUpdatedDetail) => {
  window.dispatchEvent(new CustomEvent<SessionUpdatedDetail>(SESSION_UPDATED_EVENT, { detail }));
};
