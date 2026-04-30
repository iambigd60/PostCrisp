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
  // Default 60s — covers most AI tool calls (Opus on ~2000-token output ~25-30s,
  // with variance up to ~50s during Anthropic load spikes). Pages with deeper
  // tasks (channel-analysis with refine) explicitly bump to 120s. Pages with
  // quick endpoints (settings save, admin lookups) can pass shorter timeouts
  // explicitly if they want fail-fast UX, but the default needs to accommodate
  // the slowest realistic AI call so users don't see false 'timed out' errors.
  const { timeout = 60000, ...fetchOptions } = options;

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
      throw new ApiError(408, "Request timed out. Please try again.");
    }

    if (!navigator.onLine) {
      throw new ApiError(0, "You appear to be offline. Check your connection.");
    }

    throw new ApiError(500, "Something went wrong. Please try again.");
  } finally {
    clearTimeout(timeoutId);
  }
}
