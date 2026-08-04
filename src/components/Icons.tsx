type IconProps = { className?: string };

function base(className?: string) {
  return {
    className,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  };
}

/** Pouls : accueil athlète et marque de l'app. */
export function IconPulse({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />
    </svg>
  );
}

/** Groupe : dashboard coach. */
export function IconAthletes({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c.6-3 2.8-4.7 5.5-4.7s4.9 1.7 5.5 4.7" />
      <circle cx="17" cy="9.5" r="2.4" />
      <path d="M15.8 14.6c2.6.1 4.2 1.6 4.7 4.4" />
    </svg>
  );
}

export function IconHistory({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.5V12l3 2.2" />
    </svg>
  );
}

export function IconChat({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M20 11.6c0 4-3.6 7-8 7-1 0-1.9-.1-2.8-.4L4 19.6l1.2-3.2C4.4 15.2 4 13.9 4 12.4c0-4 3.6-7.2 8-7.2s8 2.4 8 6.4Z" />
    </svg>
  );
}

export function IconBell({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M6 16v-5.4C6 7.5 8.7 5 12 5s6 2.5 6 5.6V16l1.5 2.5h-15L6 16Z" />
      <path d="M10 20.5c.4.9 1.1 1.4 2 1.4s1.6-.5 2-1.4" />
    </svg>
  );
}

export function IconSettings({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 7.5h16M4 12h16M4 16.5h16" />
      <circle cx="9" cy="7.5" r="1.9" fill="var(--color-surface)" />
      <circle cx="15" cy="12" r="1.9" fill="var(--color-surface)" />
      <circle cx="7" cy="16.5" r="1.9" fill="var(--color-surface)" />
    </svg>
  );
}

export function IconPlus({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconChevronLeft({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </svg>
  );
}

export function IconChevronRight({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
    </svg>
  );
}

export function IconSend({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M20 4 10.5 13.5M20 4l-6 16.5-3.5-7L4 10l16-6Z" />
    </svg>
  );
}

export function IconCheck({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}

export function IconCopy({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h9" />
    </svg>
  );
}

export function IconCalendar({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="4" y="5.5" width="16" height="14.5" rx="2" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </svg>
  );
}
