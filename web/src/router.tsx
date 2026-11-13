import { createRootRoute, createRoute, createRouter, Link, Outlet, redirect } from "@tanstack/react-router";
import { api, request } from "./api";
import { AuthPage, Shell } from "./auth";
import { DashboardView } from "./dashboard";
import { TicketEditor, TicketList, TicketView } from "./tickets";
import type { Dashboard, TicketDetail, User } from "./types";

const root = createRootRoute({
  component: () => <main className="mx-auto max-w-5xl space-y-4 p-4"><Outlet /></main>,
});
const home = createRoute({
  getParentRoute: () => root, path: "/",
  beforeLoad: () => { throw redirect({ to: "/tickets" }); },
});
const login = createRoute({
  getParentRoute: () => root, path: "login",
  component: () => <AuthPage key="login" register={false} />,
});
const register = createRoute({
  getParentRoute: () => root, path: "registro",
  component: () => <AuthPage key="register" register />,
});

const privateRoute = createRoute({
  getParentRoute: () => root, id: "_private",
  beforeLoad: async () => {
    const session = await request<{ user: User } | null>("/api/auth/get-session");
    if (!session?.user) throw redirect({ to: "/login" });
    return { user: session.user };
  },
  component: () => <Shell user={privateRoute.useRouteContext().user} />,
});

const getTicket = (id: string) => api<TicketDetail>("/api/tickets/" + encodeURIComponent(id));

const list = createRoute({
  getParentRoute: () => privateRoute, path: "tickets",
  component: () => <TicketList user={privateRoute.useRouteContext().user} />,
});
const create = createRoute({
  getParentRoute: () => privateRoute, path: "tickets/nuevo",
  beforeLoad: ({ context }) => { if (context.user.role !== "empleado") throw redirect({ to: "/tickets" }); },
  component: () => <TicketEditor />,
});
const detail = createRoute({
  getParentRoute: () => privateRoute, path: "tickets/$ticketId",
  validateSearch: (search: Record<string, unknown>): { created?: boolean } =>
    search.created === true ? { created: true } : {},
  loader: ({ params }) => getTicket(params.ticketId),
  component: () => <TicketView key={detail.useParams().ticketId} ticket={detail.useLoaderData()}
    user={privateRoute.useRouteContext().user} created={detail.useSearch().created === true} />,
});
const edit = createRoute({
  getParentRoute: () => privateRoute, path: "tickets/$ticketId/editar",
  loader: async ({ params, context }) => {
    const ticket = await getTicket(params.ticketId);
    if (context.user.role !== "empleado" || ticket.createdBy !== context.user.id || ticket.status !== "abierto") {
      throw redirect({ to: "/tickets/$ticketId", params });
    }
    return ticket;
  },
  component: () => <TicketEditor key={edit.useParams().ticketId} ticket={edit.useLoaderData()} />,
});
const dashboard = createRoute({
  getParentRoute: () => privateRoute, path: "dashboard",
  beforeLoad: ({ context }) => { if (context.user.role !== "agente") throw redirect({ to: "/tickets" }); },
  loader: () => api<Dashboard>("/api/dashboard"),
  component: () => <DashboardView metrics={dashboard.useLoaderData()} />,
});

export const router = createRouter({
  routeTree: root.addChildren([home, login, register, privateRoute.addChildren([list, create, detail, edit, dashboard])]),
  defaultPendingComponent: () => <p role="status">Cargando…</p>,
  defaultErrorComponent: ({ error }) => <section className="panel">
    <p role="alert">{error instanceof Error ? error.message : "No se pudo cargar la página."}</p>
    <Link to="/tickets">Volver a tickets</Link>
  </section>,
});

declare module "@tanstack/react-router" {
  interface Register { router: typeof router }
}