# JWT authentication

## Problem

The app has no concept of a user. Anyone can hit `/api/optimize`,
`/api/resume/render`, and `/api/templates` directly, and the UI never asks
who's using it. There's no database, no session handling, and no login UI
anywhere in the codebase.

## Goal

- Users can sign up and log in with email/password.
- The main resume-optimization flow is unreachable without a valid login.
- Every API route validates a JWT before doing any work.

## Scope

New:
- `prisma/schema.prisma` — `User`, `RefreshToken` models.
- `lib/auth/` — password hashing, token issuance/verification, `requireAuth`
  helper, refresh-token rotation logic.
- `app/api/auth/signup/route.ts`, `login/route.ts`, `refresh/route.ts`,
  `logout/route.ts`.
- `app/login/page.tsx`, `app/signup/page.tsx`.
- `lib/auth/AuthContext.tsx` (client-side auth state), `lib/auth/authFetch.ts`
  (fetch wrapper that attaches/refreshes the access token).

Changed:
- `app/api/optimize/route.ts`, `app/api/resume/render/route.ts`,
  `app/api/templates/route.ts` — call `requireAuth` before doing anything
  else.
- `app/page.tsx` — redirect to `/login` if not authenticated; use
  `authFetch` instead of raw `fetch`.
- `app/layout.tsx` — wrap children in `AuthProvider`.
- `.env.local.example`, `README.md`, `CLAUDE.md` — new env vars documented.

Out of scope: password reset/forgot-password flow, email verification,
OAuth/social login, rate limiting on auth endpoints, multi-device session
management UI. These are natural follow-ups but not required for "user
must log in, APIs must validate tokens."

## Design

### Data model (Prisma + Postgres)

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String
  createdAt     DateTime @default(now())
  refreshTokens RefreshToken[]
}

model RefreshToken {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  tokenHash String    // sha256 of the raw token; raw value is never stored
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())
}
```

Passwords are hashed with `bcryptjs`. Refresh tokens are opaque random
strings (not JWTs); only a hash of each lives in the DB, so a DB read alone
can't be replayed as a valid token.

### Token flow

- **Access token**: JWT (`jose`, HS256), 15 min TTL, payload `{ sub: userId }`,
  signed with `JWT_ACCESS_SECRET`. Stateless — verified without a DB hit.
- **Refresh token**: opaque random string, 7 day TTL. Client sends it to
  `/api/auth/refresh` to mint a new pair. Each use **rotates** the token:
  the old `RefreshToken` row is marked `revokedAt`, a new one is inserted,
  and the new raw token is returned to the client. If a request ever
  presents a token whose row is already revoked, that's a signal of theft —
  all of that user's refresh tokens are revoked immediately.

### Auth API routes (`app/api/auth/`)

| Route | Body | Behavior |
|---|---|---|
| `POST /signup` | `{ email, password }` | zod-validates (email format, password ≥ 8 chars), 409 on duplicate email, else creates `User`, returns `{ accessToken, refreshToken }` |
| `POST /login` | `{ email, password }` | bcrypt-compares, 401 on mismatch, else returns `{ accessToken, refreshToken }` |
| `POST /refresh` | `{ refreshToken }` | validates + rotates as above, returns new `{ accessToken, refreshToken }`, 401 if invalid/expired/revoked |
| `POST /logout` | `{ refreshToken }` | marks the token's row `revokedAt`, returns 204 |

### Protecting existing routes

`lib/auth/requireAuth.ts` exports `requireAuth(req: NextRequest): Promise<string>`
which reads the `Authorization: Bearer <token>` header, verifies it with
`jose` against `JWT_ACCESS_SECRET`, and returns the `userId` from `sub` — or
throws, which each route catches and turns into
`NextResponse.json({ error: "Unauthorized" }, { status: 401 })`. Added as
the first statement in `optimize`, `resume/render`, and `templates` — all
three require a valid token, since "APIs must validate user tokens" wasn't
scoped to only the AI-calling route.

The 401 body is always the generic string `"Unauthorized"` regardless of
whether the token was missing, malformed, expired, or signed with the wrong
key — no detail that would help someone probe for a valid-looking token.

### Client-side

- `lib/auth/AuthContext.tsx`: React context holding `{ accessToken,
  refreshToken, login, signup, logout }`, mounted in `app/layout.tsx`.
  Tokens persist in `localStorage` under a single namespaced key so a page
  reload doesn't lose the session.
- `lib/auth/authFetch.ts`: wraps `fetch`, attaching
  `Authorization: Bearer <accessToken>`. On a `401` it calls
  `/api/auth/refresh` once, retries the original request with the new
  access token, and on a second failure clears auth state and redirects to
  `/login`.
- `app/page.tsx`: on mount, redirect to `/login` if there's no session;
  swap its `fetch("/api/optimize", ...)` call for `authFetch`.
- `app/login/page.tsx`, `app/signup/page.tsx`: plain email/password forms
  styled consistently with the existing step UI, calling `login`/`signup`
  from `AuthContext` and redirecting to `/` on success.

### New environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string (Prisma) |
| `JWT_ACCESS_SECRET` | Yes | Signs/verifies access tokens |
| `JWT_REFRESH_HASH_SECRET` | Yes | Pepper mixed into the refresh-token hash before storage |

Documented in `.env.local.example`, `README.md`, and `CLAUDE.md`.

## Testing

No test runner exists in this repo yet (`package.json` has no test script);
adding one is out of scope here. Verification is manual via `npm run dev`:

1. Sign up with a new email — lands on the main flow, `localStorage` has
   tokens.
2. Log out, confirm `/` redirects to `/login`.
3. Log back in with the same credentials.
4. Hit `/api/optimize` directly (e.g. via curl) with no `Authorization`
   header — confirm 401.
5. Hit it with an expired/garbage token — confirm 401.
6. Let the access token expire (or temporarily shorten the TTL for the
   test) and confirm `authFetch` transparently refreshes and retries.
7. Confirm a revoked/already-used refresh token is rejected by `/refresh`.
8. Sign up with an already-registered email — confirm 409.
