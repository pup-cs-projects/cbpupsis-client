export function AuthSkeleton() {
  return (
    <div
      className="auth-skeleton"
      role="status"
      aria-label="Please wait, securely processing your request"
    >
      <span className="sr-only">Please wait, securely processing your request.</span>
      <div aria-hidden="true">
        <div className="skeleton-line skeleton-short" />
        <div className="skeleton-line" />
        <div className="skeleton-line" />
        <div className="skeleton-line skeleton-button" />
      </div>
    </div>
  );
}
