import { createHash } from "node:crypto";
import { CapacityError, RateLimitError } from "./errors";
import type { Actor } from "./modules/identity";

export interface TokenBucketSpec {
  capacity: number;
  refillTokens: number;
  refillMs: number;
}

interface BucketRequest {
  key: string;
  spec: TokenBucketSpec;
  cost?: number;
}

interface BucketState {
  tokens: number;
  updatedAt: number;
  touchedAt: number;
  spec: TokenBucketSpec;
}

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAfterSeconds: number;
}

const SUMMARY_ACCOUNT = { capacity: 5, refillTokens: 30, refillMs: 60_000 } satisfies TokenBucketSpec;
const SUMMARY_CLUB = { capacity: 700, refillTokens: 42_000, refillMs: 60_000 } satisfies TokenBucketSpec;
const SEARCH_ACCOUNT = { capacity: 6, refillTokens: 30, refillMs: 60_000 } satisfies TokenBucketSpec;
const SEARCH_CLUB = { capacity: 100, refillTokens: 3_000, refillMs: 60_000 } satisfies TokenBucketSpec;
const LOGIN_SOURCE = { capacity: 50, refillTokens: 300, refillMs: 60_000 } satisfies TokenBucketSpec;
// Successful authentication refunds this bucket. Existing SQL lockout remains authoritative at five failures.
const LOGIN_EMAIL = { capacity: 10, refillTokens: 10, refillMs: 15 * 60_000 } satisfies TokenBucketSpec;

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function refill(state: BucketState, now: number): BucketState {
  const elapsed = Math.max(0, now - state.updatedAt);
  state.tokens = Math.min(state.spec.capacity, state.tokens + (elapsed * state.spec.refillTokens) / state.spec.refillMs);
  state.updatedAt = now;
  state.touchedAt = now;
  return state;
}

/** Bounded, synchronous token buckets for one Node process. */
export class TokenBucketStore {
  private readonly buckets = new Map<string, BucketState>();
  private operations = 0;

  constructor(
    private readonly now: () => number = () => performance.now(),
    private readonly maximumKeys = 10_000,
    private readonly idleMs = 30 * 60_000,
  ) {}

  takeMany(requests: BucketRequest[]): RateLimitDecision {
    if (requests.length === 0) return { allowed: true, limit: 0, remaining: 0, retryAfterSeconds: 0, resetAfterSeconds: 0 };
    const now = this.now();
    this.maintain(now);
    const evaluated = requests.map((request) => {
      const cost = request.cost ?? 1;
      let state = this.buckets.get(request.key);
      if (!state) {
        this.makeRoom();
        state = { tokens: request.spec.capacity, updatedAt: now, touchedAt: now, spec: request.spec };
        this.buckets.set(request.key, state);
      } else if (
        state.spec.capacity !== request.spec.capacity ||
        state.spec.refillTokens !== request.spec.refillTokens ||
        state.spec.refillMs !== request.spec.refillMs
      ) {
        state.spec = request.spec;
        state.tokens = Math.min(state.tokens, request.spec.capacity);
      }
      refill(state, now);
      return { request, state, cost };
    });

    const denied = evaluated
      .filter(({ state, cost }) => state.tokens < cost)
      .map(({ request, state, cost }) => {
        const tokensPerMs = request.spec.refillTokens / request.spec.refillMs;
        const retryMs = tokensPerMs > 0 ? (cost - state.tokens) / tokensPerMs : request.spec.refillMs;
        return {
          allowed: false,
          limit: request.spec.capacity,
          remaining: Math.max(0, Math.floor(state.tokens)),
          retryAfterSeconds: Math.max(1, Math.ceil(retryMs / 1000)),
          resetAfterSeconds: Math.max(1, Math.ceil(((request.spec.capacity - state.tokens) / tokensPerMs) / 1000)),
        } satisfies RateLimitDecision;
      })
      .sort((a, b) => b.retryAfterSeconds - a.retryAfterSeconds)[0];
    if (denied) return denied;

    for (const item of evaluated) item.state.tokens -= item.cost;
    const tightest = evaluated.toSorted((a, b) => a.state.tokens / a.request.spec.capacity - b.state.tokens / b.request.spec.capacity)[0];
    const tokensPerMs = tightest.request.spec.refillTokens / tightest.request.spec.refillMs;
    return {
      allowed: true,
      limit: tightest.request.spec.capacity,
      remaining: Math.max(0, Math.floor(tightest.state.tokens)),
      retryAfterSeconds: 0,
      resetAfterSeconds: Math.max(0, Math.ceil(((tightest.request.spec.capacity - tightest.state.tokens) / tokensPerMs) / 1000)),
    };
  }

  refund(requests: BucketRequest[]): void {
    const now = this.now();
    for (const request of requests) {
      const state = this.buckets.get(request.key);
      if (!state) continue;
      refill(state, now);
      state.tokens = Math.min(request.spec.capacity, state.tokens + (request.cost ?? 1));
    }
  }

  get size(): number {
    return this.buckets.size;
  }

  clear(): void {
    this.buckets.clear();
    this.operations = 0;
  }

  private maintain(now: number): void {
    this.operations += 1;
    if (this.operations % 256 !== 0) return;
    for (const [key, state] of this.buckets) {
      if (now - state.touchedAt >= this.idleMs) this.buckets.delete(key);
    }
  }

  private makeRoom(): void {
    if (this.buckets.size < this.maximumKeys) return;
    let oldestKey: string | undefined;
    let oldestAt = Number.POSITIVE_INFINITY;
    for (const [key, state] of this.buckets) {
      if (state.touchedAt < oldestAt) {
        oldestAt = state.touchedAt;
        oldestKey = key;
      }
    }
    if (oldestKey) this.buckets.delete(oldestKey);
  }
}

export type AdmissionPriority = "critical" | "normal" | "shed-first" | "bypass";

export class AdmissionGate {
  private active = 0;

  constructor(readonly softLimit: number, readonly hardLimit: number) {
    if (softLimit <= 0 || hardLimit < softLimit) throw new Error("Invalid HTTP admission limits.");
  }

  async run<T>(priority: AdmissionPriority, work: () => Promise<T> | T): Promise<T> {
    if (priority === "bypass") return await work();
    if (this.active >= this.hardLimit || (priority === "shed-first" && this.active >= this.softLimit)) {
      throw new CapacityError("The server is busy. Please retry shortly.", "http_in_flight", 1);
    }
    this.active += 1;
    try {
      return await work();
    } finally {
      this.active -= 1;
    }
  }

  get inFlight(): number {
    return this.active;
  }
}

interface TrafficState {
  limiter: TokenBucketStore;
  admission: AdmissionGate;
}

const globalTraffic = globalThis as typeof globalThis & { modeTrafficControl?: TrafficState };

function traffic(): TrafficState {
  return (globalTraffic.modeTrafficControl ??= {
    limiter: new TokenBucketStore(),
    admission: new AdmissionGate(
      positiveInteger(process.env.MODE_HTTP_SOFT_IN_FLIGHT, 64),
      positiveInteger(process.env.MODE_HTTP_MAX_IN_FLIGHT, 128),
    ),
  });
}

function opaque(value: string): string {
  return createHash("sha256").update(value).digest("base64url").slice(0, 22);
}

function enforce(requests: BucketRequest[]): RateLimitDecision {
  const decision = traffic().limiter.takeMany(requests);
  if (!decision.allowed) throw new RateLimitError(decision.retryAfterSeconds, decision.limit, decision.remaining, decision.resetAfterSeconds);
  return decision;
}

export function enforceWorkspaceRateLimit(actor: Actor, resource: "summary" | "search"): RateLimitDecision {
  const account = resource === "summary" ? SUMMARY_ACCOUNT : SEARCH_ACCOUNT;
  const club = resource === "summary" ? SUMMARY_CLUB : SEARCH_CLUB;
  return enforce([
    { key: `${resource}:account:${actor.memberId}`, spec: account },
    { key: `${resource}:club:${actor.clubId}`, spec: club },
  ]);
}

export interface LoginRateLease {
  decision: RateLimitDecision;
  refundSuccessfulEmail(): RateLimitDecision;
}

export function enforceLoginRateLimit(request: Request, normalizedEmail: string): LoginRateLease {
  const emailRequest = { key: `login:email:${opaque(normalizedEmail)}`, spec: LOGIN_EMAIL };
  const requests = [
    { key: `login:source:${opaque(requestSource(request))}`, spec: LOGIN_SOURCE },
    emailRequest,
  ];
  const decision = enforce(requests);
  return {
    decision,
    refundSuccessfulEmail: () => {
      traffic().limiter.refund([emailRequest]);
      return decision.limit === LOGIN_EMAIL.capacity
        ? { ...decision, remaining: LOGIN_EMAIL.capacity, resetAfterSeconds: 0 }
        : decision;
    },
  };
}

export function applyRateLimitHeaders(response: Response, decision: RateLimitDecision): Response {
  response.headers.set("RateLimit-Limit", String(decision.limit));
  response.headers.set("RateLimit-Remaining", String(decision.remaining));
  response.headers.set("RateLimit-Reset", String(decision.resetAfterSeconds));
  return response;
}

export function withHttpAdmission<T>(priority: AdmissionPriority, work: () => Promise<T> | T): Promise<T> {
  return traffic().admission.run(priority, work);
}

function requestSource(request: Request): string {
  const hops = positiveInteger(process.env.MODE_TRUSTED_PROXY_HOPS, 0);
  if (hops > 0) {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",").map((part) => part.trim()).filter(Boolean) ?? [];
    if (forwarded.length > 0) return forwarded[Math.max(0, forwarded.length - hops)]!;
  }
  return "direct-or-untrusted-proxy";
}

/** Test-only reset; production never clears policy state during process lifetime. */
export function resetTrafficControlForTests(): void {
  delete globalTraffic.modeTrafficControl;
}
