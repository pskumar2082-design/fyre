import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';

// Small shared light-theme primitives used across every page: white
// rounded-2xl cards with a soft shadow, tinted icon badges, stat cards
// (icon + label + value), and pill buttons/links -- matching the "Car
// Rent" dashboard reference's card/button language.
//
// Badges use a stronger tint (12% fill / 20% border, full-saturation
// icon) than the first light-theme pass -- the original 10%/15% read as
// washed-out and "basic" next to the reference's confident icon chips.
const TINTS = {
  blue: 'bg-gold/[0.12] text-gold border border-gold/20',
  teal: 'bg-goldDim/[0.12] text-goldDim border border-goldDim/20',
  yellow: 'bg-red/[0.12] text-red border border-red/20',
  pink: 'bg-black/[0.04] text-textDim border border-black/[0.06]',
  // A second, subtler cool tone that still reads as part of the blue
  // family -- for stats that sit right next to the blue accent (the
  // homepage's Live Now card) without borrowing the vivid red that's
  // reserved for actual live-tracking badges/pulse dots.
  indigo: 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20'
} as const;

// Matching solid-text color for each tint, used where a number itself
// (not just its icon chip) should carry the accent -- e.g. StatCard
// values and the homepage's big gross/live figures.
const TINT_TEXT = {
  blue: 'text-gold',
  teal: 'text-goldDim',
  yellow: 'text-red',
  pink: 'text-text',
  indigo: 'text-indigo-600'
} as const;

export type Tint = keyof typeof TINTS;

export function Card({
  className = '',
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`bg-surface border border-black/[0.04] rounded-2xl shadow-card ${className}`}>{children}</div>
  );
}

export function IconBadge({
  icon: Icon,
  tint = 'blue',
  size = 60
}: {
  icon: LucideIcon;
  tint?: Tint;
  size?: number;
}) {
  return (
    <div
      className={`flex-none rounded-2xl flex items-center justify-center ${TINTS[tint]}`}
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.48)} strokeWidth={2.25} />
    </div>
  );
}

export function StatCard({
  icon,
  tint = 'blue',
  label,
  value
}: {
  icon: LucideIcon;
  tint?: Tint;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Card className="p-5 flex items-center gap-4">
      <IconBadge icon={icon} tint={tint} size={56} />
      <div className="min-w-0">
        <div className="mdtype-overline text-textFaint truncate">{label}</div>
        <div className={`font-stat font-bold text-3xl sm:text-4xl truncate mt-0.5 ${TINT_TEXT[tint]}`}>
          {value}
        </div>
      </div>
    </Card>
  );
}

export function Pill({
  href,
  onClick,
  type = 'button',
  variant = 'default',
  disabled = false,
  className = '',
  children
}: {
  href?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'default' | 'outline' | 'active';
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const styles = {
    // Solid blue pill with white text and a soft colored shadow -- the
    // shadow is what was missing before; flat pills read as "basic"
    // against the reference's buttons, which visibly lift off the page.
    primary: 'bg-gold text-white border border-gold shadow-[0_10px_24px_-10px_rgba(47,111,237,0.55)] hover:bg-goldBright',
    default: 'bg-surface text-textDim border border-border hover:border-gold/30 hover:text-text',
    outline: 'bg-transparent text-textDim border border-border hover:border-gold/40 hover:text-text',
    active: 'bg-gold text-white border border-gold shadow-[0_10px_24px_-10px_rgba(47,111,237,0.55)]'
  }[variant];
  const base = `inline-flex items-center justify-center gap-1.5 text-[15px] font-semibold rounded-full px-5 py-2 transition disabled:opacity-40 disabled:pointer-events-none ${styles} ${className}`;

  if (href) {
    return (
      <Link href={href} className={base}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={base}>
      {children}
    </button>
  );
}

export function SectionHeading({
  title,
  action
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
      <h2 className="hdisplay text-xl text-text">{title}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <Card className="p-8 text-center text-textFaint text-sm">{children}</Card>
  );
}
