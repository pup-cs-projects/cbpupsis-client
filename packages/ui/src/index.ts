// The React side of what the portals share. Framework-free code (the API client, the session,
// the password rules) stays in @cbpupsis/shared; whole account screens are @cbpupsis/account.
export { AuthSkeleton } from "./components/AuthSkeleton";
export { ErrorAlert, Notice, RetryCountdown } from "./components/messages";
export { PasswordField, TextField } from "./components/fields";
export { PasswordChecklist } from "./components/PasswordChecklist";
export { QrCode } from "./components/QrCode";
export { SubmitButton } from "./components/SubmitButton";
export { useCheckedField } from "./hooks/useCheckedField";
export { formatTime, useCodeWindow, useCountdown } from "./hooks/useCountdown";
export { useStepHeading } from "./hooks/useStepHeading";

export { DashboardLayout } from "./components/DashboardLayout";
export { DashboardIcon } from "./components/DashboardIcon";
export {
  DashboardAnnouncements,
  DashboardCalendar,
  DashboardEmpty,
  DashboardLoading,
  DashboardMetric,
  DashboardSection,
} from "./components/DashboardWidgets";

export { NotFoundPage } from "./shared/NotFoundPage";
export { ServerErrorPage } from "./shared/ServerErrorPage";
export { MaintenancePage } from "./shared/MaintenancePage";

export { DashboardProfileCard } from "./components/DashboardProfileCard";

export { ModalDialog } from "./components/ModalDialog";

export { DashboardHeader } from "./components/DashboardHeader";

export { NotificationsMenu, type NotificationsMenuItem } from "./components/NotificationsMenu";
export { HelpSupportButton, SUPPORT_EMAIL } from "./components/HelpSupportButton";
