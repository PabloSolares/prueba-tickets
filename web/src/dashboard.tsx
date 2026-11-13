import { Link } from "@tanstack/react-router";
import { priorityLabels, statusLabels, type Dashboard, type TicketSummary } from "./types";
import { dateLabel } from "./ui";

function TicketLinks({ items }: { items: TicketSummary[] }) {
  if (!items.length) return <p>No hay tickets.</p>;
  return <ul className="space-y-2">{items.map(ticket => <li key={ticket.id}>
    <Link to="/tickets/$ticketId" params={{ ticketId: ticket.id }}>{ticket.title}</Link>
    {" · " + statusLabels[ticket.status] + " · " + dateLabel(ticket.createdAt)}
  </li>)}</ul>;
}

export function DashboardView({ metrics }: { metrics: Dashboard }) {
  return <section className="panel">
    <h1>Dashboard de soporte</h1>
    <p>Promedio de resolución: <strong>{metrics.averageResolutionHours === null
      ? "Sin tickets resueltos" : metrics.averageResolutionHours.toFixed(2) + " h"}</strong></p>
    <div className="grid gap-4 sm:grid-cols-2">
      <section><h2>Por estado</h2>
        {Object.entries(metrics.byStatus).map(([key, count]) =>
          <p key={key}>{statusLabels[key as keyof typeof statusLabels]}: {count}</p>)}
      </section>
      <section><h2>Por prioridad</h2>
        {Object.entries(metrics.byPriority).map(([key, count]) =>
          <p key={key}>{priorityLabels[key as keyof typeof priorityLabels]}: {count}</p>)}
      </section>
    </div>
    <h2>Abiertos sin asignar hace más de 48 h ({metrics.overdue.length})</h2>
    <TicketLinks items={metrics.overdue} />
    <h2>Cinco tickets más recientes</h2>
    <TicketLinks items={metrics.recent} />
  </section>;
}