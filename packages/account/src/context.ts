import type { PasswordApi, Session } from "@cbpupsis/shared/auth";
import { createContext, useContext } from "react";

/** What differs between the portals' account flows. Everything else is this package. */
export interface AccountConfig {
  /** The portal's name as people see it, such as "Student Portal". */
  portalName: string;
  /** The app's one session. */
  session: Session;
  passwordApi: PasswordApi;
  /** Any authenticated request. Staying signed in sends one, which restarts the API's idle clock. */
  keepAlive: () => Promise<unknown>;
}

export const AccountContext = createContext<AccountConfig | null>(null);

export function useAccount() {
  const config = useContext(AccountContext);
  if (!config) throw new Error("Account screens must render inside AppFrame");
  return config;
}

/** How long a success state shows before the redirect it announces. */
export const CONFIRMATION_DELAY_MS = 1200;
