import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';

// Shared primitives for the black + zinc system (tailwind.config.js),
// measured from the frameXTV reference:
//   cards     zinc-950 fill, 1px zinc-800 border, 12px radius, no glow
//   buttons   primary = solid white / black text; secondary = zinc-900
//             fill + zinc-800 border; 8px radius
//   badges    platform monospace, bold, uppercase
//   headings  bold, tight tracking, optional mono count pill + mono
//             subtitle (reference: "Trending Now  18 / Top cinema ...")
// Icons are Lucide everywhere (the reference's own icon set), stroke 2.

const TINTS = {
  blue: 'bg-surface2 text-gold border border-border',
  teal: 'bg-surface2 text-goldDim border border-border',
  yellow: 'bg-surface2 text-red border border-border',
  pink: 'bg-surface2 text-textDim border border-border',
  indigo: 'bg-surface2 text-indigo border border-border'
} as const;

const TINT_TEXT = {
  blue: 'text-gold',
  teal: 'text-goldDim',
  yellow: 'text-red',
  pink: 'text-text',
  indigo: 'text-indigo'
} as const;

export type Tint = keyof typeof TINTS;

export function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`bg-surface border border-border rounded-xl ${className}`}>{children}</div>;
}

export function IconBadge({ icon: Icon, tint = 'blue', size = 60 }: { icon: LucideIcon; tint?: Tint; size?: number }) {
  return (
    <div className={`flex-none rounded-xl flex items-center justify-center ${TINTS[tint]}`} style={{ width: size, height: size }}>
      <Icon size={Math.round(size * 0.42)} strokeWidth={2} />
    </div>
  );
}

export function StatCard({ icon, tint = 'blue', label, value }: { icon: LucideIcon; tint?: Tint; label: string; value: React.ReactNode }) {
  return (
    <Card className="p-5 flex items-center gap-4">
      <IconBadge icon={icon} tint={tint} size={48} />
      <div className="min-w-0">
        <div className="mdtype-overline text-textFaint truncate">{label}</div>
        <div className={`font-bold tracking-tight text-3xl sm:text-4xl truncate mt-0.5 ${TINT_TEXT[tint]}`}>{value}</div>
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
    primary: 'bg-white text-black border border-white hover:bg-zinc-200 hover:border-zinc-200',
    default: 'bg-surface2/80 text-text border border-border hover:bg-surface2 hover:border-borderStrong',
    outline: 'bg-transparent text-textDim border border-border hover:text-text hover:border-borderStrong',
    active: 'bg-white text-black border border-white'
  }[variant];
  const base = `inline-flex items-center justify-center gap-2 text-sm font-semibold rounded-lg h-10 px-4 transition-colors disabled:opacity-40 disabled:pointer-events-none ${styles} ${className}`;
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

// Monospace uppercase chip (reference: "FEATURED FILM", "MOVIE").
export function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono font-bold uppercase tracking-wider text-[11px] sm:text-[13px] leading-none px-2 py-1.5 rounded-md ${className}`}>
      {children}
    </span>
  );
}

// Mono count pill next to a section title (reference: "Trending Now  18").
export function CountPill({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center h-6 sm:h-7 px-2 sm:px-2.5 rounded-full bg-surface2 border border-border font-mono text-xs sm:text-[13px] font-normal tracking-normal text-textDim ${className}`}>{children}</span>;
}

export function SectionHeading({
  title,
  count,
  subtitle,
  action,
  className = 'mb-5 sm:mb-6'
}: {
  title: string;
  count?: number | string | null;
  subtitle?: string | null;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-end justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        <h2 className="hdisplay font-extrabold text-[22px] sm:text-[32px] leading-tight text-text">
          {title}
          {count != null && <CountPill className="ml-2.5 sm:ml-3 align-middle -translate-y-0.5">{count}</CountPill>}
        </h2>
        {subtitle && <p className="font-mono text-[13px] sm:text-[17px] text-textDim mt-1.5 truncate">{subtitle}</p>}
      </div>
      {action && <div className="flex-none pb-0.5">{action}</div>}
    </div>
  );
}

// "View all" link used at the right of a section heading.
export function ViewAll({ href, label = 'View all' }: { href: string; label?: string }) {
  return (
    <Link href={href} className="text-sm sm:text-[17px] font-semibold text-zinc-300 hover:text-white transition-colors">
      {label}
    </Link>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <Card className="p-8 text-center text-textFaint text-sm">{children}</Card>;
}
