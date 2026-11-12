import { Hono } from "hono";
import { z } from "zod";
import { auth } from "./auth";

const signupBody = z.strictObject({
    name: z.string().trim().min(1).max(120),
    email: z.email().max(254),
    password: z.string().min(10).max(128),
});

export const authRoutes = new Hono();

authRoutes.post("/sign-up/email", async (c) => {
    const request = c.req.raw;
    const contentType = request.headers
        .get("content-type")
        ?.split(";")[0]
        ?.trim()
        .toLowerCase();

    if(contentType !== "application/json"){
        return c.json({
            error: {code: "UNSUPPORTED_MEDIA_TYPE", message: "Envia un cuerpo JSON"},
        }, 415);
    }

    let body : unknown;

    try {
        body = await request.json();
    } catch (error) {
        return c.json({
            error: {code: "INVALID_JSON", message: "El cuerpo no contiene JSON valido"},
        }, 400)
    }

    const result = signupBody.safeParse(body);

    if (!result.success) {
        return c.json({
            error: {
                code: "INVALID_SIGNUP",
                message: "Revisa el nombre, correo y contraseña.",
            },
        }, 400);
    }

    const headers = new Headers(request.headers);
    headers.delete("content-length");

    return auth.handler(new Request(request.url, {
        method: "POST", 
        headers,
        body: JSON.stringify(result.data),
    }));
});

authRoutes.on(["GET", "POST"], "/*", (c) => auth.handler(c.req.raw));