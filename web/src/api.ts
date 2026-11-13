type Options = Omit<RequestInit, "body"> & { body?: unknown };
type ErrorBody = { message?: string; error?: { message?: string } };

export async function request<T>(path: string, { body, ...options }: Options = {}): Promise<T> {
    const headers = new Headers(options.headers);
    if (body !== undefined) headers.set("Content-Type", "application/json");
    const response = await fetch(path, {
        ...options, headers, body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
        const error: ErrorBody | null = await response.json().catch(() => null);
        throw new Error(error?.error?.message ?? error?.message ?? `Error HTTP ${response.status}`);
    }
    return response.json();
}

export async function api<T>(path: string, options?: Options): Promise<T> {
    return (await request<{ data: T }>(path, options)).data;
}