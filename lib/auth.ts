import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import prisma from "./prisma";
import authConfig from "./auth.config";
import { auditFromRequest } from "./audit";
import { getTrustedClientIp, loginEmailKey, normalizeEmail } from "./security";
import {
  checkLoginRateLimit,
  intEnv,
  resetRateLimit,
} from "./rate-limit";

const LOGIN_RATE_LIMIT_DEFAULT = 10;
const LOGIN_RATE_WINDOW_SECONDS_DEFAULT = 900;

let dummyHashPromise: Promise<string> | null = null;
function dummyHash(): Promise<string> {
  dummyHashPromise ??= argon2.hash(randomUUID());
  return dummyHashPromise;
}

async function recordLoginAttempt(input: {
  email: string;
  success: boolean;
  adminId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  try {
    await prisma.loginAttempt.create({
      data: {
        email: input.email,
        success: input.success,
        adminId: input.adminId ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (error) {
    console.error("Login attempt recording failed:", error);
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  events: {
    async signIn({ user }) {
      await auditFromRequest({
        eventType: "LOGIN_SUCCESS",
        actorEmail: user.email ?? "unknown",
        actorId: user.id,
      });
    },
    async signOut(params) {
      const token = "token" in params ? params.token : undefined;
      await auditFromRequest({
        eventType: "LOGOUT",
        actorEmail: (token?.email as string) ?? "unknown",
        actorId: (token?.id as string) ?? null,
      });
    },
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        let ipAddress: string | null = null;
        let userAgent: string | null = null;
        try {
          const requestHeaders = await headers();
          ipAddress = getTrustedClientIp(requestHeaders);
          userAgent = requestHeaders.get("user-agent");
        } catch {
          // no request context — attempt still recorded without request metadata
        }

        const limit = intEnv("LOGIN_RATE_LIMIT", LOGIN_RATE_LIMIT_DEFAULT);
        const windowSeconds = intEnv(
          "LOGIN_RATE_WINDOW_SECONDS",
          LOGIN_RATE_WINDOW_SECONDS_DEFAULT,
        );

        const lock = await checkLoginRateLimit(email, ipAddress, {
          limit,
          windowSeconds,
          trustProxy: process.env.TRUST_PROXY === "1",
        });
        if (!lock.allowed) {
          await recordLoginAttempt({
            email: normalizeEmail(email),
            success: false,
            ipAddress,
            userAgent,
          });
          await auditFromRequest({
            eventType: "LOGIN_FAILED",
            actorEmail: email,
            metadata: {
              reason: "rate_limited",
              infraFailure: lock.infraFailure,
            },
          });
          return null;
        }

        const admin = await prisma.admin.findUnique({
          where: { email },
        });

        let isValid = false;
        if (admin) {
          isValid = await argon2.verify(admin.passwordHash, password);
        } else {
          isValid = await argon2.verify(await dummyHash(), password);
        }

        if (!isValid || !admin) {
          await recordLoginAttempt({
            email: normalizeEmail(email),
            success: false,
            adminId: admin?.id ?? null,
            ipAddress,
            userAgent,
          });
          return null;
        }

        await resetRateLimit(loginEmailKey(email));
        await recordLoginAttempt({
          email: normalizeEmail(email),
          success: true,
          adminId: admin.id,
          ipAddress,
          userAgent,
        });

        return {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
        };
      },
    }),
  ],
});
