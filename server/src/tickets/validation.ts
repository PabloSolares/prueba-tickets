import { z } from "zod";
import { categories, priorities, statuses  } from "../db/schema";

export const ticketId = z.uuid();

export const ticketInput = z.strictObject({
    title: z.string().trim().min(1, "Escribe un titulo").max(150),
    description: z.string().trim().min(1, "Describe el problema.").max(4000),
    category: z.enum(categories),
    priority: z.enum(priorities),
})

export const ticketEdit = ticketInput.partial().refine(
    (input) => Object.keys(input).length > 0,
    { message: "Incluye al menos un campo para editar." },
);

export const listInput = z.strictObject({
    status: z.enum(statuses).optional(),
    priority: z.enum(priorities).optional(),
    category: z.enum(categories).optional(),
    q: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export const statusInput = z.strictObject({
    status: z.enum(statuses),
});

export const commentInput = z.strictObject({
    content: z.string().trim().min(1, "Escribe un comentario.").max(2000),
});