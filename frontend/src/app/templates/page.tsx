import { redirect } from 'next/navigation';

/** Legacy bookmark — templates live under marketplace. */
export default function TemplatesRedirectPage() {
  redirect('/marketplace');
}
