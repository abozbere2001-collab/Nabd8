
import type { SVGProps } from 'react';

export function FootballIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 22a10 10 0 0 0 4.93-1.49" />
      <path d="M12 2a10 10 0 0 1 4.93 1.49" />
      <path d="m5.26 6.26 13.48 11.48" />
      <path d="M5.26 17.74 18.74 6.26" />
      <path d="m12 2 4.7 4.7" />
      <path d="m12 22 4.7-4.7" />
      <path d="m2 12 4.7 4.7" />
      <path d="m22 12-4.7 4.7" />
    </svg>
  );
}

    