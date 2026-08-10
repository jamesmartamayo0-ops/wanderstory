import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import argon2 from "argon2";
import prisma from "./prisma";
import authConfig from "./auth.config";
import { auditFromRequest } from "./audit";

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

        const admin = await prisma.admin.findUnique({
          where: { email },
        });

        if (!admin) {
          return null;
        }

        const isValid = await argon2.verify(admin.passwordHash, password);

        if (!isValid) {
          return null;
        }

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
