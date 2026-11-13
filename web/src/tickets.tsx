import { useEffect, useState, type FormEvent } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { api } from "./api";
import {
  categoryLabels, priorityLabels, statusLabels,
  type Category, type Priority, type TicketInput, type Ticket, type TicketDetail, type TicketPage, type User,
} from "./types";
import { dateLabel, ErrorMessage, Options, useAction } from "./ui";

export function TicketList({ user }: { user: User }) {
  const [filters, setFilters] = useState("");
  const [page, setPage] = useState(1);
  const query = new URLSearchParams(filters);
  query.set("page", String(page));
  const url = "/api/tickets?" + query;
  const [result, setResult] = useState<{ url: string; data?: TicketPage; error?: string }>();
  const current = result?.url === url ? result : undefined;

  useEffect(() => {
    const controller = new AbortController();
    void api<TicketPage>(url, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setResult({ url, data }); })
      .catch(e => {
        if (!controller.signal.aborted) setResult({
          url, error: e instanceof Error ? e.message : "No se pudo cargar.",
        });
      });
    return () => controller.abort();
  }, [url]);

  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget)) {
      if (typeof value === "string" && value.trim()) query.set(key, value.trim());
    }
    setPage(1);
    setFilters(query.toString());
  }

  const data = current?.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return <section className="panel">
    <h1>{user.role === "empleado" ? "Mis tickets" : "Todos los tickets"}</h1>
    {user.role === "empleado" && <Link to="/tickets/nuevo">Nuevo ticket</Link>}
    <form onSubmit={filter} onReset={() => { setFilters(""); setPage(1); }}
      className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label>Buscar<input name="q" maxLength={100} placeholder="Título o descripción" /></label>
      <label>Estado<select aria-label="Estado" name="status">
        <option value="">Todos</option><Options labels={statusLabels} />
      </select></label>
      <label>Prioridad<select aria-label="Prioridad" name="priority">
        <option value="">Todas</option><Options labels={priorityLabels} />
      </select></label>
      <label>Categoría<select aria-label="Categoría" name="category">
        <option value="">Todas</option><Options labels={categoryLabels} />
      </select></label>
      <div className="flex gap-2"><button>Aplicar filtros</button><button type="reset">Limpiar</button></div>
    </form>
    {!current && <p role="status">Cargando tickets…</p>}
    <ErrorMessage text={current?.error ?? ""} />
    {data && <>
      <ul className="divide-y divide-slate-200">
        {data.items.map(ticket => <li key={ticket.id} className="py-3">
          <Link to="/tickets/$ticketId" params={{ ticketId: ticket.id }}>{ticket.title}</Link>
          <p>{statusLabels[ticket.status]} · {priorityLabels[ticket.priority]} · {categoryLabels[ticket.category]}</p>
        </li>)}
      </ul>
      {!data.items.length && <p>No hay tickets con estos filtros.</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
        <span>Página {page} de {pages} · {data.total} tickets</span>
        <button disabled={page >= pages} onClick={() => setPage(page + 1)}>Siguiente</button>
      </div>
    </>}
  </section>;
}

export function TicketEditor({ ticket }: { ticket?: Ticket }) {
  const router = useRouter();
  const { busy, error, run } = useAction();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    void run(async () => {
      const body: TicketInput = {
        title: String(fields.get("title")), description: String(fields.get("description")),
        category: fields.get("category") as Category, priority: fields.get("priority") as Priority,
      };
      const saved = await api<Ticket>(ticket ? "/api/tickets/" + ticket.id : "/api/tickets", {
        method: ticket ? "PATCH" : "POST", body,
      });
      await router.navigate({
        to: "/tickets/$ticketId", params: { ticketId: saved.id }, search: { created: !ticket },
      });
    });
  }

  return <section className="panel max-w-2xl">
    <Link to="/tickets">Volver a tickets</Link>
    <h1>{ticket ? "Editar ticket" : "Nuevo ticket"}</h1>
    <form className="space-y-3" onSubmit={submit}>
      <label>Título<input name="title" required maxLength={150} defaultValue={ticket?.title} /></label>
      <label>Descripción<textarea name="description" required maxLength={4000} defaultValue={ticket?.description} /></label>
      <label>Categoría<select aria-label="Categoría" name="category" defaultValue={ticket?.category ?? "software"}>
        <Options labels={categoryLabels} />
      </select></label>
      <label>Prioridad<select aria-label="Prioridad" name="priority" defaultValue={ticket?.priority ?? "media"}>
        <Options labels={priorityLabels} />
      </select></label>
      <ErrorMessage text={error} />
      <button disabled={busy}>{busy ? "Guardando…" : ticket ? "Guardar cambios" : "Crear ticket"}</button>
    </form>
  </section>;
}

const next = { abierto: "en_progreso", en_progreso: "resuelto", resuelto: "cerrado", cerrado: null } as const;

export function TicketView({ ticket, user, created }: { ticket: TicketDetail; user: User; created: boolean }) {
  const router = useRouter();
  const { busy, error, run } = useAction();
  const [notice, setNotice] = useState("");
  const owner = ticket.createdBy === user.id;
  const assigned = ticket.assignedTo === user.id;
  const nextStatus = next[ticket.status];

  function mutate(path: string, method: "POST" | "PATCH", success: string, body?: unknown, form?: HTMLFormElement) {
    setNotice("");
    void run(async () => {
      await api(`/api/tickets/${ticket.id}/${path}`, { method, body });
      form?.reset();
      setNotice(success);
      await router.invalidate();
    });
  }

  return <>
    <section className="panel">
      <Link to="/tickets">Volver a tickets</Link>
      <h1 className="break-words">{ticket.title}</h1>
      <p>{statusLabels[ticket.status]} · {priorityLabels[ticket.priority]} · {categoryLabels[ticket.category]}</p>
      <p className="whitespace-pre-wrap break-words">{ticket.description}</p>
      <p>Solicitante: {ticket.creatorName} · Agente: {ticket.assigneeName ?? "Sin asignar"}</p>
      <p>Creado: {dateLabel(ticket.createdAt)}{ticket.resolvedAt && " · Resuelto: " + dateLabel(ticket.resolvedAt)}</p>
      <ErrorMessage text={error} />
      {(notice || created) && <p role="status" className="rounded bg-teal-50 p-3">{notice || "Ticket creado."}</p>}
      <div className="flex flex-wrap items-center gap-3">
        {owner && user.role === "empleado" && ticket.status === "abierto" &&
          <Link to="/tickets/$ticketId/editar" params={{ ticketId: ticket.id }}>Editar ticket</Link>}
        {user.role === "agente" && !ticket.assignedTo && ticket.status === "abierto" &&
          <button disabled={busy} onClick={() => mutate("assign", "POST", "Ticket asignado.")}>Asignarme</button>}
        {user.role === "agente" && assigned && nextStatus && <button disabled={busy}
          onClick={() => mutate("status", "PATCH", nextStatus === "resuelto" ? "Ticket resuelto." : "Estado actualizado.", { status: nextStatus })}>
          {nextStatus === "en_progreso" ? "Iniciar atención" : nextStatus === "resuelto" ? "Resolver ticket" : "Cerrar ticket"}
        </button>}
      </div>
    </section>
    <section className="panel">
      <h2>Comentarios</h2>
      {!ticket.comments.length && <p>No hay comentarios.</p>}
      {ticket.comments.map(comment => <article key={comment.id}>
        <strong>{comment.author}</strong> · {dateLabel(comment.createdAt)}
        <p className="whitespace-pre-wrap break-words">{comment.content}</p>
      </article>)}
      {(owner || assigned) && <form className="space-y-3" onSubmit={e => {
        e.preventDefault();
        const form = e.currentTarget;
        mutate("comments", "POST", "Comentario agregado.", { content: String(new FormData(form).get("content")) }, form);
      }}>
        <label>Nuevo comentario<textarea name="content" required maxLength={2000} /></label>
        <button disabled={busy}>Agregar comentario</button>
      </form>}
    </section>
    <section className="panel">
      <h2>Historial de estados</h2>
      {!ticket.history.length && <p>No hay cambios de estado.</p>}
      <ul className="space-y-2">{ticket.history.map(item => <li key={item.id}>
        <strong>{statusLabels[item.fromStatus]} → {statusLabels[item.toStatus]}</strong> · {item.author} · {dateLabel(item.createdAt)}
      </li>)}</ul>
    </section>
  </>;
}