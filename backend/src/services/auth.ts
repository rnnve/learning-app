import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env.ts";
import { getDb, schema } from "../db/client.ts";
import { AppError } from "../lib/errors.ts";
import { sha256 } from "../lib/hash.ts";
import { generateId } from "../lib/ids.ts";

export interface UserTokenPayload {
  sub: string;
  jti: string;
}

export interface AuthTokens {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export class AuthService {
  private secretKey: Uint8Array;

  constructor() {
    this.secretKey = new TextEncoder().encode(env.JWT_SECRET);
  }

  public async generateTokens(
    userId: string,
    familyId?: string,
    userAgent?: string,
  ): Promise<AuthTokens> {
    const db = getDb();
    const jti = generateId();
    const accessExp = Math.floor(Date.now() / 1000) + env.ACCESS_TOKEN_TTL_SEC;

    const accessToken = await new SignJWT({ sub: userId })
      .setProtectedHeader({ alg: "HS256" })
      .setJti(jti)
      .setIssuedAt()
      .setExpirationTime(accessExp)
      .sign(this.secretKey);

    const refreshTokenRaw = randomBytes(48).toString("base64url");
    const refreshHash = sha256(refreshTokenRaw);
    const tokenFamily = familyId || generateId();
    const refreshExpDate = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await db.insert(schema.refreshTokens).values({
      userId,
      familyId: tokenFamily,
      tokenHash: refreshHash,
      expiresAt: refreshExpDate,
      userAgent: userAgent || null,
    });

    return {
      accessToken,
      accessTokenExpiresAt: new Date(accessExp * 1000).toISOString(),
      refreshToken: refreshTokenRaw,
      refreshTokenExpiresAt: refreshExpDate.toISOString(),
    };
  }

  public async verifyAccessToken(token: string): Promise<UserTokenPayload> {
    try {
      const { payload } = await jwtVerify(token, this.secretKey, {
        algorithms: ["HS256"],
      });

      if (!payload.sub || !payload.jti) {
        throw new AppError("UNAUTHENTICATED", { message: "Invalid token payload" });
      }

      return {
        sub: payload.sub,
        jti: payload.jti,
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      if (err.code === "ERR_JWT_EXPIRED") {
        throw new AppError("TOKEN_EXPIRED", { message: "Access token has expired" });
      }
      throw new AppError("UNAUTHENTICATED", { message: "Invalid access token" });
    }
  }

  public async createGuest(userAgent?: string) {
    const db = getDb();
    const [user] = await db
      .insert(schema.users)
      .values({
        isGuest: true,
        displayName: "นักเรียน",
        preferences: {
          uiLanguage: "th",
          contentLanguage: "auto",
          level: "general",
          theme: "system",
        },
      })
      .returning();

    const tokens = await this.generateTokens(user.id, undefined, userAgent);
    return { user: formatUserResponse(user), tokens };
  }

  public async register(params: {
    email: string;
    password: string;
    displayName?: string;
    guestUserId?: string;
    userAgent?: string;
  }) {
    const db = getDb();
    const emailNorm = params.email.trim().toLowerCase();

    // Check if email already taken
    const [existing] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, emailNorm));
    if (existing) {
      throw new AppError("EMAIL_TAKEN", { message: "Email is already registered" });
    }

    const passwordHash = await Bun.password.hash(params.password, { algorithm: "argon2id" });

    // Upgrade guest in place if valid guest user provided
    if (params.guestUserId) {
      const [guestUser] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, params.guestUserId));

      if (guestUser?.isGuest) {
        const [upgraded] = await db
          .update(schema.users)
          .set({
            email: emailNorm,
            passwordHash,
            displayName: params.displayName?.trim() || guestUser.displayName,
            isGuest: false,
            updatedAt: new Date(),
          })
          .where(eq(schema.users.id, guestUser.id))
          .returning();

        const tokens = await this.generateTokens(upgraded.id, undefined, params.userAgent);
        return { user: formatUserResponse(upgraded), tokens };
      }
    }

    // New user registration
    const [newUser] = await db
      .insert(schema.users)
      .values({
        email: emailNorm,
        passwordHash,
        displayName: params.displayName?.trim() || "นักเรียน",
        isGuest: false,
        preferences: {
          uiLanguage: "th",
          contentLanguage: "auto",
          level: "general",
          theme: "system",
        },
      })
      .returning();

    const tokens = await this.generateTokens(newUser.id, undefined, params.userAgent);
    return { user: formatUserResponse(newUser), tokens };
  }

  public async login(email: string, pass: string, userAgent?: string) {
    const db = getDb();
    const emailNorm = email.trim().toLowerCase();

    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, emailNorm));
    if (!user || !user.passwordHash) {
      // Run dummy verify to mitigate timing attacks
      await Bun.password.verify(
        "dummy_password",
        "$argon2id$v=19$m=65536,t=2,p=1$fakehashfakehashfakehash$fakehash",
      );
      throw new AppError("INVALID_CREDENTIALS", { message: "Invalid email or password" });
    }

    const matches = await Bun.password.verify(pass, user.passwordHash);
    if (!matches) {
      throw new AppError("INVALID_CREDENTIALS", { message: "Invalid email or password" });
    }

    const tokens = await this.generateTokens(user.id, undefined, userAgent);
    return { user: formatUserResponse(user), tokens };
  }

  public async refresh(
    refreshTokenRaw: string,
    userAgent?: string,
  ): Promise<{ tokens: AuthTokens }> {
    const db = getDb();
    const tokenHash = sha256(refreshTokenRaw);

    const [record] = await db
      .select()
      .from(schema.refreshTokens)
      .where(eq(schema.refreshTokens.tokenHash, tokenHash));

    if (!record) {
      throw new AppError("REFRESH_TOKEN_INVALID", {
        message: "Refresh token not found or invalid",
      });
    }

    // Check reuse
    if (record.revokedAt) {
      // Token reuse detected! Revoke whole family
      await db
        .update(schema.refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(schema.refreshTokens.familyId, record.familyId));

      throw new AppError("REFRESH_TOKEN_REUSED", {
        message: "Refresh token reuse detected; session family has been revoked",
      });
    }

    if (new Date() > record.expiresAt) {
      throw new AppError("REFRESH_TOKEN_INVALID", { message: "Refresh token has expired" });
    }

    // Revoke old token and rotate
    await db
      .update(schema.refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(schema.refreshTokens.id, record.id));

    const tokens = await this.generateTokens(record.userId, record.familyId, userAgent);
    return { tokens };
  }

  public async logout(refreshTokenRaw: string): Promise<void> {
    const db = getDb();
    const tokenHash = sha256(refreshTokenRaw);
    await db
      .update(schema.refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(schema.refreshTokens.tokenHash, tokenHash));
  }
}

export function formatUserResponse(user: typeof schema.users.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    isGuest: user.isGuest,
    preferences: user.preferences,
    consent: {
      aiProcessing: !!user.consentVersion,
      version: user.consentVersion,
      acceptedAt: user.consentAt ? user.consentAt.toISOString() : null,
    },
    createdAt: user.createdAt.toISOString(),
  };
}

export const authService = new AuthService();
