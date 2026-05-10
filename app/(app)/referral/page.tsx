import { redirect } from 'next/navigation';

export default function ReferralRedirectPage() {
  redirect('/points?tab=referral');
}
