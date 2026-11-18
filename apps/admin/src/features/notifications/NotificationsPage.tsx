import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  AdminPage,
  ApiFailure,
  Pagination,
  adminButton,
  adminCard,
} from "../../components/AdminPage";
import { localDate, useAdminQuery } from "../../lib/adminQueries";
import { adminOperationsApi, type Preference } from "../../lib/adminApi";

export function NotificationsPage() {
  const [offset, setOffset] = useState(0);
  const cache = useQueryClient();
  const list = useAdminQuery(["notifications", offset], (signal) =>
    adminOperationsApi.notifications(offset, signal),
  );
  const unread = useAdminQuery(["unread"], (signal) => adminOperationsApi.unread(signal));
  const preferences = useAdminQuery(["notification-preferences"], (signal) =>
    adminOperationsApi.preferences(signal),
  );
  const mark = useMutation({
    mutationFn: async (id: string | null) =>
      id ? adminOperationsApi.markRead(id) : adminOperationsApi.markAllRead(),
    retry: false,
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["admin-operations"] });
    },
  });
  const preference = useMutation({
    mutationFn: (item: Preference) => adminOperationsApi.setPreference(item),
    retry: false,
    onSuccess: () => {
      void preferences.refetch();
    },
  });
  return (
    <AdminPage
      title="Notifications"
      description="Messages for your signed-in account and your notification delivery preferences."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          {unread.data === undefined
            ? "Unread count unavailable"
            : `${unread.data} unread notifications`}
        </p>
        <button
          type="button"
          className={adminButton}
          disabled={mark.isPending || !unread.data}
          onClick={() => mark.mutate(null)}
        >
          Mark all as read
        </button>
      </div>
      {list.isPending && <p role="status">Loading notifications…</p>}
      {list.isError && <ApiFailure error={list.error} retry={() => void list.refetch()} />}
      {unread.isError && <ApiFailure error={unread.error} retry={() => void unread.refetch()} />}
      {mark.isError && <ApiFailure error={mark.error} />}
      {list.data && (
        <>
          <div className="space-y-3">
            {list.data.items.length ? (
              list.data.items.map((item) => (
                <article key={item.id} className={adminCard}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h2 className="font-semibold">{item.title}</h2>
                    <span className="text-brand-muted text-xs">
                      {item.readAt ? "Read" : "Unread"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm break-words whitespace-pre-wrap">{item.body}</p>
                  <time className="text-brand-muted mt-3 block text-xs" dateTime={item.createdAt}>
                    {localDate(item.createdAt)}
                  </time>
                  {!item.readAt && (
                    <button
                      type="button"
                      className={adminButton + " mt-3"}
                      disabled={mark.isPending}
                      aria-label={`Mark as read: ${item.title}`}
                      onClick={() => mark.mutate(item.id)}
                    >
                      Mark as read
                    </button>
                  )}
                </article>
              ))
            ) : (
              <p className={adminCard}>You have no notifications.</p>
            )}
          </div>
          <Pagination
            offset={offset}
            total={list.data.total}
            busy={list.isFetching}
            onChange={setOffset}
          />
        </>
      )}
      <section className={adminCard} aria-labelledby="notification-preferences-heading">
        <h2 id="notification-preferences-heading" className="text-lg font-bold">
          Delivery preferences
        </h2>
        <p className="text-brand-muted mt-2 text-sm">
          Required security notices cannot be disabled.
        </p>
        {preferences.isPending && (
          <p role="status" className="mt-3">
            Loading preferences…
          </p>
        )}
        {preferences.isError && (
          <ApiFailure error={preferences.error} retry={() => void preferences.refetch()} />
        )}
        {preference.isError && <ApiFailure error={preference.error} />}
        <div className="mt-4 space-y-3">
          {preferences.data?.map((item) => (
            <label
              key={`${item.type}:${item.channel}`}
              className="flex min-h-11 items-center gap-3 text-sm"
            >
              <input
                type="checkbox"
                className="accent-brand-maroon size-4"
                checked={item.enabled}
                disabled={!item.editable || preference.isPending}
                onChange={(event) => preference.mutate({ ...item, enabled: event.target.checked })}
              />
              <span className="min-w-0 break-words">
                {item.type} · {item.channel === "email" ? "Email" : "In-app"}
                {!item.editable ? " (required)" : ""}
              </span>
            </label>
          ))}
        </div>
      </section>
    </AdminPage>
  );
}
