import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { SectionHeading } from '@/components/ui/surface';
import { cn } from '@/lib/utils';

export interface Crumb {
  href: string;
  label: string;
}

/**
 * The opening block of every interior page.
 *
 * Also carries the clearance the fixed header needs, so pages do not each
 * reinvent a top padding that then drifts apart.
 */
export function PageIntro({
  title,
  description,
  eyebrow,
  crumbs = [],
  children,
  className,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  crumbs?: Crumb[];
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('girih-field border-b border-sand-300 bg-sand-200/40', className)}>
      <div className="container-content pb-10 pt-24 sm:pb-12 lg:pb-14 lg:pt-32">
        {crumbs.length > 0 ? (
          <nav aria-label="Yoʻnalish" className="mb-5">
            <ol className="flex flex-wrap items-center gap-1 text-xs text-brown-400">
              <li>
                <Link href="/" className="transition-colors hover:text-chocolate-800">
                  Bosh sahifa
                </Link>
              </li>
              {crumbs.map((crumb, index) => (
                <li key={crumb.href} className="flex items-center gap-1">
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                  {index === crumbs.length - 1 ? (
                    <span aria-current="page" className="text-chocolate-700">
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      href={crumb.href}
                      className="transition-colors hover:text-chocolate-800"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <SectionHeading as="h1" eyebrow={eyebrow} title={title} description={description} />

        {children ? <div className="mt-6">{children}</div> : null}
      </div>
    </div>
  );
}
