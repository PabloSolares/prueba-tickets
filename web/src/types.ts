export const statusLabels = { abierto: "Abierto", en_progreso: "En progreso", resuelto: "Resuelto", cerrado: "Cerrado" };
export const priorityLabels = { critica: "Crítica", alta: "Alta", media: "Media", baja: "Baja" };
export const categoryLabels = { hardware: "Hardware", software: "Software", red: "Red", accesos: "Accesos", otro: "Otro" };

export type Status = keyof typeof statusLabels;
export type Priority = keyof typeof priorityLabels;
export type Category = keyof typeof categoryLabels;
export type Role = "empleado" | "agente";
export type User = { id: string; name: string; role: Role };

export type TicketInput = { title: string; description: string; category: Category; priority: Priority };
export type TicketSummary = { id: string; title: string; status: Status; createdAt: string };
export type Ticket = TicketSummary & TicketInput & {
    createdBy: string;
    assignedTo: string | null;
    resolvedAt: string | null;
};
type Entry = { id: string; author: string; createdAt: string };
export type TicketDetail = Ticket & {
    creatorName: string;
    assigneeName: string | null;
    comments: (Entry & { content: string })[];
    history: (Entry & { fromStatus: Status; toStatus: Status })[];
};
export type TicketPage = { items: Ticket[]; total: number; page: number; pageSize: number };
export type Dashboard = {
    byStatus: Record<Status, number>;
    byPriority: Record<Priority, number>;
    averageResolutionHours: number | null;
    overdue: TicketSummary[];
    recent: TicketSummary[];
};