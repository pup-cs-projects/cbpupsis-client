export interface Credentials {
  employee_id: string;
  password: string;
  date_of_birth: string;
}
export interface Challenge {
  kind: "challenge";
  challengeToken: string;
  enrollmentRequired: boolean;
  expiresAt: number;
}
export interface Enrollment {
  secret: string;
  accountName: string;
  issuer: string;
  period: number;
}
export interface FacultySession {
  kind: "session";
  role: "faculty";
  accessToken: string;
  expiresAt: number;
}
export type AuthResult = Challenge | FacultySession;
