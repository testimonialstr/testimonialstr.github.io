import {
  MouseEvent,
  ReactNode,
  useMemo,
  useSyncExternalStore,
} from "react";

export type Route =
  | { view: "home" }
  | { view: "profile"; npub: string; write?: boolean }
  | { view: "inbox" }
  | { view: "friends" }
  | { view: "rejected" }
  | { view: "sent" };

function parseLocation(): Route {
  const params = new URLSearchParams(window.location.search);
  const p = params.get("p");
  if (p) {
    return {
      view: "profile",
      npub: p,
      write: params.get("write") === "1",
    };
  }
  const v = params.get("view");
  if (
    v === "inbox" ||
    v === "friends" ||
    v === "rejected" ||
    v === "sent"
  ) {
    return { view: v };
  }
  return { view: "home" };
}

export function routeToHref(route: Route): string {
  switch (route.view) {
    case "home":
      return "./";
    case "profile": {
      const q = new URLSearchParams();
      q.set("p", route.npub);
      if (route.write) q.set("write", "1");
      return "?" + q.toString();
    }
    case "inbox":
      return "?view=inbox";
    case "friends":
      return "?view=friends";
    case "rejected":
      return "?view=rejected";
    case "sent":
      return "?view=sent";
  }
}

const listeners = new Set<() => void>();
function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  window.addEventListener("popstate", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("popstate", cb);
  };
}
function emit() {
  for (const l of listeners) l();
}

const getSnapshot = () =>
  window.location.pathname + window.location.search;

export function useRoute(): Route {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  return useMemo(() => parseLocation(), [snapshot]);
}

export function navigate(
  route: Route,
  opts: { replace?: boolean } = {},
): void {
  const href = routeToHref(route);
  if (opts.replace) window.history.replaceState({}, "", href);
  else window.history.pushState({}, "", href);
  emit();
}

function shouldIntercept(e: MouseEvent): boolean {
  return (
    e.button === 0 &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.shiftKey &&
    !e.altKey
  );
}

type LinkProps = {
  route: Route;
  className?: string;
  children: ReactNode;
  title?: string;
  onClick?: () => void;
};

export function RouterLink({
  route,
  className,
  children,
  title,
  onClick,
}: LinkProps) {
  const href = routeToHref(route);
  return (
    <a
      href={href}
      className={className}
      title={title}
      onClick={(e) => {
        if (!shouldIntercept(e)) return;
        e.preventDefault();
        onClick?.();
        navigate(route);
      }}
    >
      {children}
    </a>
  );
}

export function NavRouterLink({
  route,
  className,
  children,
}: {
  route: Route;
  className: (args: { isActive: boolean }) => string;
  children: ReactNode;
}) {
  const current = useRoute();
  const isActive = routeMatchesNav(current, route);
  return (
    <RouterLink route={route} className={className({ isActive })}>
      {children}
    </RouterLink>
  );
}

function routeMatchesNav(current: Route, target: Route): boolean {
  if (current.view !== target.view) return false;
  if (current.view === "profile" && target.view === "profile") {
    return current.npub === target.npub;
  }
  return true;
}
