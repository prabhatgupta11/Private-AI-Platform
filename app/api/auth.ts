/**
 * Checks if the request is authorized.
 * If API_KEY environment variable is configured, it validates authorization headers.
 * If API_KEY is not configured, it returns true for backward compatibility.
 */
export function isAuthorized(request: Request): boolean {
  const configuredKey = process.env.API_KEY;

  if (!configuredKey) {
    return true; // Passwordless default
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const token = authHeader.replace(/^bearer\s+/i, "").trim();
    if (token === configuredKey) {
      return true;
    }
  }

  const apiKeyHeader = request.headers.get("x-api-key");
  if (apiKeyHeader && apiKeyHeader.trim() === configuredKey) {
    return true;
  }

  return false;
}

// Memory-store IP rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

/**
 * Validates request frequency limit based on client IP.
 */
export function checkRateLimit(request: Request, limit = 60, windowMs = 60000): boolean {
  const ip =
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "127.0.0.1";

  const now = Date.now();
  let record = rateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime: now + windowMs };
  }
  record.count += 1;
  rateLimitMap.set(ip, record);

  return record.count <= limit;
}
