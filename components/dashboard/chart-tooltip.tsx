"use client";

import { useSyncExternalStore, type ComponentProps } from "react";
import { Tooltip } from "recharts";

const query = "(hover: none)";

function subscribe(callback: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function touchFirst() {
  return window.matchMedia(query).matches;
}

export function ChartTooltip(props: ComponentProps<typeof Tooltip>) {
  const useTap = useSyncExternalStore(subscribe, touchFirst, () => false);
  return <Tooltip {...props} trigger={useTap ? "click" : "hover"} />;
}
