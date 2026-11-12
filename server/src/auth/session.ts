import { createMiddleware } from "hono/factory";
import type { roles } from "../db/auth-schema";
import { ApiError } from "../http/errors";
import { auth } from "./auth";

type Role = (typeof roles)[number];

export type AuthVariables = {
    Variables: {
        actor: {
            id: string,
            role: Role,
        };
    };
};

export const requireSession = createMiddleware<AuthVariables>(
    async (context, next) => {
        const session = await auth.api.getSession({
            headers: context.req.raw.headers,
        });

        if(!session){
            throw new ApiError(401, "UNAUTHENTICATED", "Inicia sesion para continuar.");
        }

        const { id , role } = session.user;

        if (role !== "empleado" && role !== "agente"){
            throw new ApiError(403, "FORBIDDEN", "El rol de la cuenta no es valido");
        }

        context.set("actor", {id, role});
        await next();
    },
);