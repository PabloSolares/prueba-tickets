import { beforeAll, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { app } from "../src/app";
import { db } from "../src/db/client";
import { tickets } from "../src/db/schema";

const origin = process.env.APP_ORIGIN ?? "http://127.0.0.1:3000";
const input = { title: "Sin acceso", description: "No abre el correo", category: "accesos", priority: "alta" };
let employee: string;
let otherEmployee: string;
let agent: string;

function request(path: string, method = "GET", cookie?: string, body?: unknown, extra?: HeadersInit) {
    const headers = new Headers(extra);
    headers.set("Origin", origin);
    if (cookie) headers.set("Cookie", cookie);
    if (body !== undefined) headers.set("Content-Type", "application/json");
    return app.request(new URL(path, origin), {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    });
}

async function register(role: "empleado" | "agente") {
    const headers = new Headers({ "X-Signup-Role": role });
    if (role === "agente") {
        const code = process.env.AGENT_SIGNUP_CODE;
        if (!code) throw new Error("Falta AGENT_SIGNUP_CODE.");
        headers.set("X-Agent-Signup-Code", code);
    }
    const res = await request("/api/auth/sign-up/email", "POST", undefined, {
        name: role, email: `${crypto.randomUUID()}@example.test`, password: "SoloParaPruebas2026!",
    }, headers);
    expect(res.status).toBe(200);
    const cookie = res.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
    expect(cookie).not.toBe("");
    return cookie;
}

beforeAll(async () => {
    if (process.env.POSTGRES_DB !== "tickets_test") throw new Error("Usa la base aislada tickets_test.");
    employee = await register("empleado");
    otherEmployee = await register("empleado");
    agent = await register("agente");
});

async function createTicket() {
    const response = await request("/api/tickets", "POST", employee, input);
    expect(response.status).toBe(201);
    const { data }: { data: { id: string; status: string } } = await response.json();
    expect(data.status).toBe("abierto");
    return data.id;
}

const assign = (id: string, cookie: string) => request(`/api/tickets/${id}/assign`, "POST", cookie);
const change = (id: string, status: string) => request(`/api/tickets/${id}/status`, "PATCH", agent, { status });

test("crea un ticket y rechaza un título vacío", async () => {
    await createTicket();
    expect((await request("/api/tickets", "POST", employee, { ...input, title: " " })).status).toBe(400);
});

test("un empleado no puede consultar tickets de otro", async () => {
    const id = await createTicket();
    expect((await request(`/api/tickets/${id}`, "GET", otherEmployee)).status).toBe(404);
});

test("solo un agente puede tomar un ticket libre y una sola vez", async () => {
    const id = await createTicket();
    expect((await assign(id, employee)).status).toBe(403);
    const results = await Promise.all([assign(id, agent), assign(id, agent)]);
    expect(results.map(response => response.status).sort()).toEqual([200, 409]);
});

test("bloquea saltos y conserva la fecha de resolución y el historial", async () => {
    const id = await createTicket();
    expect((await assign(id, agent)).status).toBe(200);
    expect((await change(id, "cerrado")).status).toBe(409);
    expect((await change(id, "en_progreso")).status).toBe(200);
    const resolved = await change(id, "resuelto");
    expect(resolved.status).toBe(200);
    const payload: { data: { resolvedAt: string | null } } = await resolved.json();
    expect(payload.data.resolvedAt).toBeTruthy();
    expect((await change(id, "cerrado")).status).toBe(200);

    const detail = await request(`/api/tickets/${id}`, "GET", employee);
    expect(detail.status).toBe(200);
    const { data }: { data: { resolvedAt: string | null; history: { toStatus: string }[] } } = await detail.json();
    expect(data.resolvedAt).toBe(payload.data.resolvedAt);
    expect(data.history.map(item => item.toStatus)).toEqual(["en_progreso", "resuelto", "cerrado"]);
});

test("el dashboard protege métricas y detecta abiertos sin asignar de más de 48 h", async () => {
    const id = await createTicket();
    const recentId = await createTicket();
    await db.update(tickets).set({ createdAt: new Date(Date.now() - 49 * 60 * 60 * 1000) }).where(eq(tickets.id, id));

    expect((await request("/api/dashboard")).status).toBe(401);
    expect((await request("/api/dashboard", "GET", employee)).status).toBe(403);
    const response = await request("/api/dashboard", "GET", agent);
    expect(response.status).toBe(200);

    const { data }: { data: { overdue: { id: string }[]; recent: { id: string }[] } } = await response.json();
    expect(data.overdue.map(item => item.id)).toContain(id);
    expect(data.overdue.map(item => item.id)).not.toContain(recentId);
    expect(data.recent.length).toBeLessThanOrEqual(5);
});