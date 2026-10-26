import { redirect } from 'next/navigation';

/** Legacy dashboard path — templates live under marketplace. */
export default function DashboardTemplatesRedirectPage() {
  redirect('/marketplace');
}
