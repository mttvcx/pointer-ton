/** Routes that do not require a beta session cookie when the gate is enabled. */
export function pathIsBetaPublic(pathname: string): boolean {
  if (pathname === '/') return true;
  if (pathname.startsWith('/beta')) return true;
  if (pathname.startsWith('/share/')) return true;
  if (pathname.startsWith('/_next')) return true;
  if (pathname.startsWith('/api')) return true;
  if (pathname === '/favicon.ico') return true;
  if (pathname.startsWith('/branding/')) return true;
  if (/\.(?:ico|png|jpg|jpeg|gif|webp|svg|txt|xml|webmanifest|js|map)$/i.test(pathname)) {
    return true;
  }
  return false;
}
