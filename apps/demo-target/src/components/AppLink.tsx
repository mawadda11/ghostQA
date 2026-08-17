import type { MouseEvent, ReactNode } from "react";

interface AppLinkProps {
  children: ReactNode;
  className?: string;
  href: string;
  navigate: (path: string) => void;
}

export const AppLink = ({
  children,
  className,
  href,
  navigate,
}: AppLinkProps) => {
  const onClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    event.preventDefault();
    navigate(href);
  };

  return (
    <a className={className} href={href} onClick={onClick}>
      {children}
    </a>
  );
};
