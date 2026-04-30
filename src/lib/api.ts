export class ApiError extends Error {
  constructor(public status: number, message: string, public payload?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

interface FetchOptions extends RequestInit {
  timeout?: number;
}

export async function apiFetch<T>(url: string, options: FetchOptions = {}): Promise<T> {
  // Default 120s — matches Vercel function maxDuration ceiling on AI routes.
  // Set to ensure the client gives the server its full processing budget
  // before declaring 'Request timed out'. AI calls on Opus regularly hit
  // 30-60s with variance up to 90s during Anthropic load spikes; SDK has
  // its own 110s timeout per request + 3 retries on transient 5xx/429.
  // Pages with quick endpoints (settings save, admin lookups) can override
  // to a shorter timeout if they want fail-fast UX.
  const { timeout = 120000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...fetchOptions.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.error || `Request failed (${response.status})`;

      if (response.status === 401) {
        window.location.href = "/?auth=required";
        throw new ApiError(401, "Please sign in to continue");
      }

      if (response.status === 429) {
        throw new ApiError(429, "Rate limit reached. Upgrade for unlimited access!");
      }

      throw new ApiError(response.status, message, errorData);
    }

    return response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(408, "This took longer than expected — your inputs are saved, just hit Retry.");
    }

    if (!navigator.onLine) {
      throw new ApiError(0, "You appear to be offline. Check your connection.");
    }

    throw new ApiError(500, "Something went wrong. Please try again.");
  } finally {
    clearTimeout(timeoutId);
  }
}
