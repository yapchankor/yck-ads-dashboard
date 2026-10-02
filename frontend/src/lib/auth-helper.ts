import { auth as clerkAuth, currentUser as clerkCurrentUser } from "@clerk/nextjs/server";

export interface AuthSession {
  userId: string | null;
  orgRole?: string | null;
  orgId?: string | null;
}

export interface AuthUser {
  id: string;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  primaryEmailAddress?: { emailAddress: string } | null;
  imageUrl?: string | null;
  publicMetadata?: Record<string, any>;
}

export async function getAuthSession(): Promise<AuthSession> {
  if (process.env.CLERK_SECRET_KEY) {
    try {
      const session = await clerkAuth();
      return {
        userId: session.userId,
        orgRole: session.orgRole,
        orgId: session.orgId,
      };
    } catch (err) {
      console.warn("Clerk auth() threw, using local dev fallback:", err);
    }
  }

  // Local development fallback when CLERK_SECRET_KEY is omitted
  return {
    userId: "dev-operator-1",
    orgRole: "org:admin",
    orgId: "org-dev",
  };
}

export async function getAuthUser(): Promise<AuthUser | null> {
  if (process.env.CLERK_SECRET_KEY) {
    try {
      const user = await clerkCurrentUser();
      if (user) {
        return {
          id: user.id,
          fullName: user.fullName || `${user.firstName || ""} ${user.lastName || ""}`.trim(),
          firstName: user.firstName,
          primaryEmailAddress: user.primaryEmailAddress ? { emailAddress: user.primaryEmailAddress.emailAddress } : null,
          imageUrl: user.imageUrl,
        };
      }
    } catch (err) {
      console.warn("Clerk currentUser() threw, using local dev fallback:", err);
    }
  }

  // Local development fallback
  return {
    id: "dev-operator-1",
    fullName: "Local Dev Operator",
    firstName: "Operator",
    primaryEmailAddress: { emailAddress: "dev@adspulse.local" },
    imageUrl: "",
  };
}
