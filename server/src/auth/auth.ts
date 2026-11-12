import { createHash, timingSafeEqual } from "node:crypto";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { account, roles, session, user, verification } from './../db/auth-schema';
import { db } from "../db/client";

const config = z.object({
    APP_ORIGIN: z.url({protocol: /^https?$/ }),
    BETTER_AUTH_SECRET: z.string().min(32),
    AGENT_SIGNUP_CODE: z.string().min(16).max(128),
}).safeParse(process.env);

if(!config.success){
    const fields = config.error.issues.map((issue) => issue.path.join("."));
    throw new Error(`Revisa la configuracion de autenticacion: ${fields.join(", ")}`);
}

const origin = new URL(config.data.APP_ORIGIN).origin;

function hashCode(code: string){
    return createHash("sha256").update(code).digest();
}

const expectedCode = hashCode(config.data.AGENT_SIGNUP_CODE);

export const auth = betterAuth({
    baseURL: origin,
    trustedOrigins: [origin],
    secret: config.data.BETTER_AUTH_SECRET,

    database: drizzleAdapter(db, {
        provider: "pg",
        schema: {user, session, account, verification},
    }),

    emailAndPassword: {
        enabled: true,
        minPasswordLength: 10,
        maxPasswordLength: 128,

    },

    user: {
        additionalFields: {
            role: {
                type: [...roles],
                required: true,
                defaultValue: "empleado",
                input: false,
            },
        },
    },

    databaseHooks: {
        user: {
            create: {
                before: async (newUser, context) => {
                    const headers = context?.path === "/sign-up/email"
                        ? context.headers ?? context.request?.headers
                        : undefined;

                    const role = headers?.get("x-signup-role") ?? "empleado";

                    if (role !== "empleado" && role !== "agente"){
                        throw new APIError("BAD_REQUEST", {
                            message: "Elige un rol valido",
                        });
                    }

                    if(role === "agente"){
                        const code = headers?.get("x-agent-signup-code") ?? "";
                        if( code.length > 128 || !timingSafeEqual(hashCode(code), expectedCode)){
                            throw new APIError("FORBIDDEN", {
                                message: "El codigo de incorporacion no es valido",
                            });
                        }
                    }

                    return {data: {...newUser, role}};
                }
            },
        },
    },
});