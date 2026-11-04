"use client";

/**
 * Official MAO logo on a transparent background, in two variants so it follows
 * the theme: dark lettering on light theme, white lettering on dark theme.
 * `variant="light"` forces the white lettering (for the always-dark panel of
 * the login / sign-up pages).
 */
interface LogoProps {
  variant?: "dark" | "light";
}

const cls = "h-9 w-auto flex-shrink-0";

export default function Logo({ variant = "dark" }: LogoProps) {
  if (variant === "light") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src="/mao-logo-dark.png" alt="MAO" width={178} height={54} className={cls} />
    );
  }
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mao-logo-light.png" alt="MAO" width={178} height={54} className={`${cls} dark:hidden`} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mao-logo-dark.png" alt="" aria-hidden="true" width={178} height={54} className={`${cls} hidden dark:block`} />
    </>
  );
}
