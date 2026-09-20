import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';

// Small shared BankDash-style primitives used across the redesigned pages:
// white rounded-2xl cards with the BankDash drop shadow, circular tinted
// icon badges, stat cards (icon + label + value), and pill buttons/links.
// Keeping these in one file since each is a few lines -- see components/ui/
// only if this grows enough to warrant splitting later.

const TINTS = {
  blue: 'bg-tintBlue text-gold',
  pink: 'bg-tintPink text-coral',
  yellow: 'bg-tintYellow text-[#F6A609]',
  teal: 'bg-tintTeal text-chartTeal'
} as const;

export type Tint = keyof typeof TINTS;

export function Card({
  className = '',
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={`bg-surface rounded-2xl shadow-card ${className}`}>{children}</div>;
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
        <div className="text-textDim text-sm truncate">{label}</div>
        <div className="hdisplay text-xl truncate">{value}</div>
      </div>
    </Card>
  );
}

export function Pill({
  href,
  onClick,
  type = 'button',
  variant = 'default',
  className = '',
  children
}: {
  href?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'default' | 'outline';
  className?: string;
  children: React.ReactNode;
}) {
  const styles = {
    primary: 'bg-gold text-white border border-gold',
    default: 'bg-transparent text-text border border-border hover:border-gold hover:text-gold',
    outline: 'bg-transparent text-gold border border-gold/40 hover:border-gold'
  }[variant];
  const base = `inline-flex items-center justify-center gap-1.5 text-sm font-semibold rounded-full px-5 py-2 transition ${styles} ${className}`;

  if (href) {
    return (
      <Link href={href} className={base}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} className={base}>
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
      <h2 className="hdisplay text-xl">{title}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <Card className="p-8 text-center text-textFaint text-sm">{children}</Card>
  );
}
