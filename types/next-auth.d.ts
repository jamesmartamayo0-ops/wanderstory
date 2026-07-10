import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role: "SUPER_ADMIN" | "EDITOR";
  }

  interface Session {
    user: {
      id: string;
      role: "SUPER_ADMIN" | "EDITOR";
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "SUPER_ADMIN" | "EDITOR";
  }
}
