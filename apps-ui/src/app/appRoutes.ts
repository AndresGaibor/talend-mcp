import type { ComponentType } from "react";

export interface AppRoute {
  id: string;
  component: ComponentType;
  title: string;
}

export type AppRouteMap = Record<string, AppRoute>;

export function getAppId(): string {
  const metaAppId = document.querySelector('meta[name="app-id"]')?.getAttribute("content");
  const urlAppId = new URLSearchParams(location.search).get("appId");
  return metaAppId ?? urlAppId ?? "home";
}
