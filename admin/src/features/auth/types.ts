export interface Credentials {
  identifier: string;
  password: string;
}
export interface Challenge {
  kind: "challenge";
  challengeToken: string;
  enrollmentRequired: boolean;
  expiresAt: number;
  methods: ("totp" | "webauthn")[];
}
export interface Enrollment {
  secret: string;
  accountName: string;
  issuer: string;
  period: number;
}
export interface AdminSession {
  kind: "session";
  role: "admin";
  position: "Chairperson" | "Dean" | "Registrar";
  accessToken: string;
  expiresAt: number;
  permissions: string[];
}
