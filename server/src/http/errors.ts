import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { z } from "zod";

export class ApiError extends Error {
    constructor(
        readonly status: ContentfulStatusCode,
        readonly code: string,
        message: string
    ) {
        super(message);
    }

}

export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
    const result = schema.safeParse(value);

    if(!result.success){
        const issue = result.error.issues[0];
        const field = issue?.path.join(".");
        const message = issue?.message ?? "Data invalido";

        throw new ApiError(
            400,
            "VALIDATION_ERROR",
            field ? `${field}: ${message}` : message,
        );
    }

    return result.data;

}

export async function readJson<T>(
    context: Context,
    schema: z.ZodType<T>,
): Promise<T> {
    const contentType = context.req.header("content-type")
        ?.split(";")[0]
        ?.trim()
        .toLowerCase();

    if (contentType !== "application/json") {
        throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Envía un cuerpo JSON.");
    }

    let body: unknown;

    try {
        body = await context.req.json();
    } catch {
        throw new ApiError(400, "INVALID_JSON", "El cuerpo no contiene JSON válido.");
    }

    return parse(schema, body);
}

export function forbidden() {
    return new ApiError(403, "FORBIDDEN", "No tienes permiso para esta acción.");
}

export function notFound() {
    return new ApiError(404, "NOT_FOUND", "No se encontró el ticket.");
}