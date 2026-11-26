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

/** Shared tooltip styling so every chart uses the same brand treatment. */
const contentStyle = { background: "#075E38", border: "1px solid #12834A", borderRadius: "10px", boxShadow: "0 8px 24px rgba(7, 94, 56, 0.24)", color: "#FFFFFF", padding: "10px 12px", fontSize: "13px" };
const labelStyle = { color: "#D3EEE0", fontWeight: 700, marginBottom: "6px" };
const itemStyle = { color: "#FFFFFF", fontWeight: 700 };
const cursor = { fill: "rgba(18, 131, 74, 0.08)" };

export function ChartTooltip(props: ComponentProps<typeof Tooltip>) {
  const useTap = useSyncExternalStore(subscribe, touchFirst, () => false);
  return <Tooltip contentStyle={contentStyle} labelStyle={labelStyle} itemStyle={itemStyle} cursor={cursor} {...props} trigger={useTap ? "click" : "hover"} />;
}
