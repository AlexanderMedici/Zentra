'use server'; 
import { auth } from '@/lib/better-auth/auth';
import { inngest } from '@/lib/inngest/client';
import { headers, cookies } from 'next/headers';

export const signUpWithEmail = async ({
  email,
  password,
  fullName,
  country,
  investmentGoals,
  riskTolerance,
  preferredIndustry,
}: SignUpFormData) => {
  try {
    const clean = (v?: string) => (typeof v === 'string' ? v.trim() : '');
    const cleanEmail = clean(email);
    const cleanName = clean(fullName);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      return { success: false, error: 'Invalid email address' };
    }

    const response = await auth.api.signUpEmail({ body: { email: cleanEmail, password, name: cleanName } });

    if (response) {
      await inngest.send({
        name: 'app/user.created',
        data: { email: cleanEmail, name: cleanName, country, investmentGoals, riskTolerance, preferredIndustry },
      });
    }

    return { success: true, data: response };
  } catch (e) {
    console.log('Sign up failed', e);
    return { success: false, error: 'Sign up failed' };
  }
};



export const signInWithEmail = async ({ email, password }: SignInFormData) => {
    try {
        const response = await auth.api.signInEmail({
          body: { email, password },
          headers: await headers(),
          cookies: cookies(),
        })

        return { success: true, data: response }
    } catch (e) {
        console.log('Sign in failed', e)
        return { success: false, error: 'Sign in failed' }
    }
}

export const signOut = async () => {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch (e) {
    console.log('Sign out failed', e);
    return { success: false, error: 'Sign out failed' };
  }
};
