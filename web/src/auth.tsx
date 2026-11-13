import { useState, type FormEvent } from "react";
import { Link, Outlet, useRouter } from "@tanstack/react-router";
import { request } from "./api";
import type { Role, User } from "./types";
import { ErrorMessage, useAction } from "./ui";

export function AuthPage({ register }: { register: boolean }) {
  const router = useRouter();
  const [role, setRole] = useState<Role>("empleado");
  const { busy, error, run } = useAction();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const credentials = {
      email: String(fields.get("email")).trim(),
      password: String(fields.get("password")),
    };

    void run(async () => {
      if (register) {
        const headers = new Headers({ "X-Signup-Role": role });
        if (role === "agente") headers.set("X-Agent-Signup-Code", String(fields.get("code")).trim());
        await request("/api/auth/sign-up/email", {
          method: "POST", headers, body: { ...credentials, name: String(fields.get("name")).trim() },
        });
      } else {
        await request("/api/auth/sign-in/email", { method: "POST", body: credentials });
      }
      await router.navigate({ to: "/tickets", replace: true });
    });
  }

  return <section className="panel mx-auto max-w-md">
    <h1>{register ? "Crea tu cuenta" : "Inicia sesión"}</h1>
    <form onSubmit={submit} className="space-y-3">
      {register && <label>Nombre<input name="name" autoComplete="name" required maxLength={120} /></label>}
      <label>Correo electrónico<input name="email" type="email" autoComplete="email" required /></label>
      <label>Contraseña<input name="password" type="password" required minLength={register ? 10 : undefined}
        maxLength={128} autoComplete={register ? "new-password" : "current-password"} /></label>
      {register && <label>Rol<select aria-label="Rol" value={role}
        onChange={e => setRole(e.target.value === "agente" ? "agente" : "empleado")}>
        <option value="empleado">Empleado</option>
        <option value="agente">Agente</option>
      </select></label>}
      {register && role === "agente" && <label>Código de incorporación
        <input name="code" type="password" required maxLength={128} />
      </label>}
      <ErrorMessage text={error} />
      <button disabled={busy}>{busy ? "Procesando…" : register ? "Crear cuenta" : "Iniciar sesión"}</button>
    </form>
    <Link to={register ? "/login" : "/registro"}>{register ? "Ya tengo cuenta" : "Registrarme"}</Link>
  </section>;
}

export function Shell({ user }: { user: User }) {
  const router = useRouter();
  const { busy, error, run } = useAction();

  return <>
    <header className="panel flex flex-wrap items-center gap-4">
      <strong className="mr-auto">Mesa de soporte · {user.name} ({user.role})</strong>
      <Link to="/tickets">Tickets</Link>
      {user.role === "agente" && <Link to="/dashboard">Dashboard</Link>}
      <button disabled={busy} onClick={() => void run(async () => {
        await request("/api/auth/sign-out", { method: "POST" });
        await router.navigate({ to: "/login", replace: true });
        await router.invalidate();
      })}>Cerrar sesión</button>
    </header>
    <ErrorMessage text={error} />
    <Outlet />
  </>;
}