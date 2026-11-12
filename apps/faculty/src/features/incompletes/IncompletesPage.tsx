import { SampleDataNotice } from "../../components/SampleDataNotice";
import { ApiError } from "@cbpupsis/shared/api";
import {
  gradingErrorMessage,
  normalizeGrade,
  type FacultyIncomplete,
} from "@cbpupsis/shared/grades";
import { ModalDialog } from "@cbpupsis/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import { DashboardLayout } from "../dashboard/DashboardLayout";
import { facultyGradingDataSource, type FacultyGradingDataSource } from "../grades/dataSource";
import { gradeButton, gradeCard, gradeDate, gradeField, gradePrimary } from "../grades/gradeStyles";
import { useMe } from "../sign-in/useFacultyAuth";

const stateLabels = {
  PENDING_COMPLETION: "Open for completion",
  COMPLETED: "Completed",
  EXPIRED: "Expired",
};
export function IncompletesPage({
  dataSource = facultyGradingDataSource,
}: {
  dataSource?: FacultyGradingDataSource;
}) {
  const me = useMe();
  const client = useQueryClient();
  const key = ["faculty-incompletes", me.data?.id];
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => dataSource.incompletes(signal),
    enabled: me.isSuccess,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selection, setSelection] = useState<{ owner: string; item: FacultyIncomplete } | null>(
    null,
  );
  const selected = selection?.owner === me.data?.id ? selection?.item : null;
  const [notice, setNotice] = useState<string | null>(null);
  const error = me.error ?? query.error;
  const rows =
    query.data?.filter(
      (item) =>
        (filter === "all" || item.state === filter) &&
        `${item.studentName} ${item.studentNumber} ${item.section.courseCode}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
    ) ?? [];
  function updateCase(id: string, values: Partial<FacultyIncomplete>) {
    client.setQueryData<FacultyIncomplete[]>(key, (items) =>
      items?.map((item) => (item.id === id ? { ...item, ...values } : item)),
    );
  }
  return (
    <DashboardLayout>
      <div className="space-y-6 px-4 py-8 sm:px-8">
        <SampleDataNotice />
        <header>
          <p className="text-brand-muted text-sm">Academics / Grades</p>
          <h1 className="text-brand-maroon mt-2 text-3xl font-bold">Incomplete grades</h1>
          <p className="text-brand-muted mt-2 max-w-2xl text-sm leading-relaxed">
            Review completion deadlines and file a completion for Dean endorsement. The recorded Inc
            changes only after approval.
          </p>
        </header>
        {notice && (
          <p role="status" className={gradeCard}>
            {notice}
          </p>
        )}
        <section className={gradeCard} aria-label="Incomplete grade records">
          <div className="mb-5 flex flex-wrap items-end gap-4">
            <label className="min-w-0 flex-1 text-sm font-medium">
              Search students or courses
              <input
                className={gradeField + " mt-2"}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                type="search"
              />
            </label>
            <label className="text-sm font-medium">
              Status
              <select
                className={gradeField + " mt-2"}
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              >
                <option value="all">All statuses</option>
                {Object.entries(stateLabels).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className={gradeButton}
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              Refresh Incompletes
            </button>
          </div>
          {error ? (
            <div role="alert">
              <p>{gradingErrorMessage(error)}</p>
              <button
                className={gradeButton + " mt-3"}
                onClick={() => void (me.isError ? me.refetch() : query.refetch())}
              >
                Retry Incompletes
              </button>
            </div>
          ) : !me.isSuccess || query.isPending ? (
            <p role="status">Loading Incomplete grades…</p>
          ) : !rows.length ? (
            <p className="text-brand-muted py-6 text-sm">
              No Incomplete grades match these filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm">
                <caption className="sr-only">
                  Incomplete grades and their completion periods
                </caption>
                <thead className="bg-brand-maroon text-white">
                  <tr>
                    {["Student", "Course", "Completion deadline (Manila)", "Status", "Action"].map(
                      (text) => (
                        <th scope="col" className="px-4 py-3" key={text}>
                          {text}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => (
                    <tr key={item.id} className="border-brand-border/25 border-b">
                      <th scope="row" className="px-4 py-4">
                        <p>{item.studentName}</p>
                        <p className="text-brand-muted mt-1 text-xs font-normal">
                          {item.studentNumber}
                        </p>
                      </th>
                      <td className="px-4 py-4">
                        {item.section.courseCode}
                        <span className="text-brand-muted mt-1 block text-xs">
                          {item.section.sectionName}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <time dateTime={item.completionDeadline}>
                          {gradeDate(item.completionDeadline)}
                        </time>
                        {item.state === "PENDING_COMPLETION" && (
                          <p className="text-brand-muted mt-1 text-xs">
                            {Math.max(0, item.daysLeft)} days left
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {item.completionPending ? "Awaiting Dean" : stateLabels[item.state]}
                      </td>
                      <td className="px-4 py-4">
                        <button
                          className={gradeButton}
                          aria-label={`File completion for ${item.studentName}`}
                          disabled={item.state !== "PENDING_COMPLETION" || item.completionPending}
                          onClick={() => {
                            setNotice(null);
                            setSelection({ owner: me.data!.id, item });
                          }}
                        >
                          File completion<span className="sr-only"> for {item.studentName}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        {selected && (
          <CompletionForm
            key={`${me.data?.id}:${selected.id}`}
            item={selected}
            source={dataSource}
            onClose={() => setSelection(null)}
            onExpired={() => updateCase(selected.id, { state: "EXPIRED" })}
            onFiled={() => {
              updateCase(selected.id, { completionPending: true });
              setSelection(null);
              setNotice(
                "Completion request filed. Waiting for Dean endorsement. The recorded mark remains Inc.",
              );
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

function CompletionForm({
  item,
  source,
  onClose,
  onFiled,
  onExpired,
}: {
  item: FacultyIncomplete;
  source: FacultyGradingDataSource;
  onClose: () => void;
  onFiled: () => void;
  onExpired: () => void;
}) {
  const [mark, setMark] = useState("");
  const [form, setForm] = useState<File | null>(null);
  const [fields, setFields] = useState<{ mark?: string; form?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [closed, setClosed] = useState(false);
  const running = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running.current || closed) return;
    const normalized = normalizeGrade(mark, true);
    const errors = {
      ...(!normalized ? { mark: "Enter a completion mark from 1.00 to 3.00." } : {}),
      ...(!form?.size ? { form: "Attach the completion form." } : {}),
    };
    setFields(errors);
    if (!normalized || !form?.size) return;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      await source.complete(item.id, { mark: normalized, form });
      onFiled();
    } catch (failure) {
      setError(gradingErrorMessage(failure));
      if (failure instanceof ApiError && failure.code === "INC_COMPLETION_WINDOW_CLOSED") {
        setClosed(true);
        onExpired();
      }
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return (
    <ModalDialog open title="File Inc completion" busy={busy} onClose={onClose}>
      <form onSubmit={(event) => void submit(event)} noValidate>
        <p className="mt-3 text-sm">
          <strong>{item.studentName}</strong> · {item.studentNumber}
        </p>
        <p className="text-brand-muted mt-1 text-sm">
          {item.section.courseCode} · Deadline: {gradeDate(item.completionDeadline)}
        </p>
        <label className="mt-5 block text-sm font-medium">
          Completion mark
          <input
            data-initial-focus
            className={gradeField + " mt-2"}
            value={mark}
            disabled={busy || closed}
            onChange={(event) => setMark(event.target.value)}
            aria-invalid={!!fields.mark}
            aria-describedby="completion-mark-help completion-mark-error"
          />
        </label>
        <p id="completion-mark-help" className="text-brand-muted mt-1 text-xs">
          Enter 1.00 to 3.00. Dean endorsement is required.
        </p>
        <p
          id="completion-mark-error"
          role={fields.mark ? "alert" : undefined}
          className="mt-1 text-xs text-red-700"
        >
          {fields.mark}
        </p>
        <label className="mt-4 block text-sm font-medium">
          Completion form
          <input
            className={gradeField + " mt-2"}
            type="file"
            disabled={busy || closed}
            onChange={(event) => setForm(event.target.files?.[0] ?? null)}
            aria-invalid={!!fields.form}
            aria-describedby="completion-file-error"
          />
        </label>
        <p
          id="completion-file-error"
          role={fields.form ? "alert" : undefined}
          className="mt-1 text-xs text-red-700"
        >
          {fields.form}
        </p>
        {error && (
          <p role="alert" className="text-brand-maroon mt-4 text-sm">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" className={gradeButton} disabled={busy} onClick={onClose}>
            Cancel completion
          </button>
          <button type="submit" className={gradePrimary} disabled={busy || closed}>
            {busy ? "Filing completion…" : "File completion request"}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
