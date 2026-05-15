import { DEFAULT_ROLE_PERMISSIONS, PERMISSION_GROUPS } from "../constants/permissions";

export const permissionsApi = {
  getRoleMatrix: async () => ({
    groups: PERMISSION_GROUPS,
    defaults: DEFAULT_ROLE_PERMISSIONS,
  }),
};
