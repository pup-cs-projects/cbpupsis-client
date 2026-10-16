import type { ApiClient } from "../api/client";
import * as parse from "../api/parse";
import { parseTokens, sessionEndpoints, type Schemas } from "./common";
import type { Tokens } from "./session";

export interface StudentCredentials {
  /** YYYY-NNNNN-XX-N. The API checks the format and answers AUTH_ID_FORMAT_INVALID. */
  studentNumber: string;
  /** YYYY-MM-DD, as on the Registrar record. */
  birthdate: string;
  password: string;
}

export interface StudentProfile {
  id: string;
  email: string;
}

/** Student sign-in (US-101): one step, no MFA. */
export function createStudentAuthApi(client: ApiClient) {
  return {
    ...sessionEndpoints(client, "student"),

    async login({ studentNumber, birthdate, password }: StudentCredentials): Promise<Tokens> {
      const body: Schemas["StudentLoginRequest"] = {
        student_number: studentNumber,
        birthdate,
        password,
      };
      return parseTokens(await client.request("/auth/student/login", { body }), "student");
    },

    async me(accessToken: string): Promise<StudentProfile> {
      const body = parse.record(
        await client.request("/auth/student/me", { method: "GET", accessToken }),
      );
      parse.literal(body.role, "student");
      return { id: parse.string(body.id), email: parse.string(body.email) };
    },
  };
}

export type StudentAuthApi = ReturnType<typeof createStudentAuthApi>;
