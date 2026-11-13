import { useState } from "react";

export function Options({ labels }: { labels: Record<string, string> }) {
    return Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>);
}

export const dateLabel = (value: string) => new Date(value).toLocaleString("es-GT");

export function useAction() {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function run(action: () => Promise<void>) {
        setBusy(true);
        setError("");
        try { await action(); }
        catch (e) { setError(e instanceof Error ? e.message : "No se pudo completar la solicitud."); }
        finally { setBusy(false); }
    }

    return { busy, error, run };
}

export function ErrorMessage({ text }: { text: string }) {
    return text ? <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{text}</p> : null;
}