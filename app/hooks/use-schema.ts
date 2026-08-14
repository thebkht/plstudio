import { useContext } from "react";
import { SchemaContext } from "@/app/components/designer/context/schema-context";

export function useSchema() {
  const value = useContext(SchemaContext);
  if (!value) throw new Error("useSchema must be used within SchemaProvider");
  return value;
}
