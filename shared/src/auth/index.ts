export type { MfaChallenge, MfaMethod, Role } from "./common";
export {
  createSession,
  type Session,
  type SessionEvent,
  type SessionOptions,
  type Tokens,
} from "./session";
export { parseProvisioningUri, type TotpSetup } from "./totp";
export {
  createStudentAuthApi,
  type StudentAuthApi,
  type StudentCredentials,
  type StudentProfile,
} from "./student";
export {
  createFacultyAuthApi,
  type FacultyAuthApi,
  type FacultyCredentials,
  type FacultyProfile,
  type FacultySecondFactor,
} from "./faculty";
export {
  ADMIN_POSITIONS,
  createAdminAuthApi,
  type AdminAuthApi,
  type AdminChallenge,
  type AdminCredentials,
  type AdminPosition,
  type AdminProfile,
  type AdminSecondFactor,
  type WebAuthnJson,
} from "./admin";
export {
  createSuperadminAuthApi,
  type SuperadminAuthApi,
  type SuperadminCredentials,
  type SuperadminProfile,
} from "./superadmin";
