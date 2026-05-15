import type { SafeCompany } from "../modules/companies/companies.repository";
import type { EffectivePermissionSet, SafeUser } from "../modules/users/users.repository";
import type { JwtSessionPayload } from "../utils/jwt";

declare global {
  namespace Express {
    interface Request {
      auth?: JwtSessionPayload;
      currentUser?: SafeUser;
      currentCompany?: SafeCompany | null;
      permissions?: EffectivePermissionSet;
    }
  }
}

export {};
