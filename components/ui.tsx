import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';

// Small shared light-theme primitives used across every page: white
// rounded-2xl cards with a soft shadow, tinted icon badges, stat cards
// (icon + label + value), and pill buttons/links -- matching the "Car
// Rent" dashboard reference's card/button language.
const TINTS = {
  blue: 'bg-gold/10 text-gold border border-gold/15',
  teal: 'bg-goldDim/10 text-goldDim border border-goldDim/15',
  yellow: 'bg-red/10 text-red border border-red/15',
  pink: 'bg-black/[0.03] text-textFaint border border-black/5'
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
      className={`flex-none rounded-xl flex items-center justify-center ${TINTS[tint]}`}
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.45)} strokeWidth={2} />
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
        <div className="font-stat text-2xl tracking-wide truncate mt-0.5 text-text">{value}</div>
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
    // Solid blue pill with white text -- the reference's "Check" button
    // and its active filter-tab treatment.
    primary: 'bg-gold text-white border border-gold hover:bg-goldBright',
    default: 'bg-surface text-textDim border border-border hover:border-gold/30 hover:text-text',
    outline: 'bg-transparent text-textDim border border-border hover:border-gold/40 hover:text-text',
    active: 'bg-gold text-white border border-gold'
  }[variant];
  const base = `inline-flex items-center justify-center gap-1.5 text-sm font-semibold rounded-full px-5 py-2 transition disabled:opacity-40 disabled:pointer-events-none ${styles} ${className}`;

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
