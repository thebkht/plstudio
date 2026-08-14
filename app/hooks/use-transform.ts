import { useContext } from "react";
import { TransformContext } from "@/app/components/designer/context/transform-context";

export function useTransform() {
  const value = useContext(TransformContext);
  if (!value)
    throw new Error("useTransform must be used within TransformProvider");
  return value;
}
