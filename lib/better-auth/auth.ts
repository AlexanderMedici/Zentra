// Minimal Better Auth-shaped stub to satisfy server action imports.
// Replace with a real Better Auth client when wiring actual auth.

type EmailCredentials = {
  email: string;
  password: string;
  name?: string;
};

export const auth = {
  api: {
    signUpEmail: async ({
      body,
    }: {
      body: EmailCredentials;
    }) => {
      // Simulate a successful signup response
      return { user: { email: body.email, name: body.name ?? "" } };
    },
    signInEmail: async ({
      body,
    }: {
      body: EmailCredentials;
    }) => {
      // Simulate a successful sign-in response
      return { session: { email: body.email } };
    },
    signOut: async (_opts?: unknown) => {
      // Simulate a no-op sign out
      return { ok: true } as const;
    },
  },
};
