import { useState, useEffect, useMemo, type ComponentType } from "react";
import { getAppId, type AppRoute } from "./appRoutes";

interface AppRouterProps {
  routes: AppRoute[];
  fallback?: ComponentType;
}

export function AppRouter({ routes, fallback: Fallback }: AppRouterProps) {
  const [appId, setAppId] = useState<string>("home");

  useEffect(() => {
    setAppId(getAppId());
  }, []);

  const routeMap = useMemo(() => {
    const map = new Map<string, ComponentType>();
    for (const route of routes) {
      map.set(route.id, route.component);
    }
    return map;
  }, [routes]);

  const Component = routeMap.get(appId) ?? Fallback ?? routes[0]?.component;

  return Component ? <Component /> : null;
}
