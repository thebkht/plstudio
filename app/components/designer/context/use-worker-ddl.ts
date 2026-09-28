"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { generateDDL } from "@/app/lib/generators";
import type { Schema } from "@/app/lib/schema";

/**
 * The DDL for `schema` while `enabled`, generated in a worker.
 *
 * Same shape as the save queue: one request in flight, and everything that
 * arrives behind it collapses to the newest schema -- intermediate DDL is never
 * shown, so generating it is wasted. Opening the code panel generates
 * synchronously, before paint, so it never shows empty or stale text; without
 * `Worker`, or once the worker errors, every result is synchronous.
 */
export function useWorkerDDL(schema: Schema, enabled: boolean) {
  const [ddl, setDDL] = useState(() => (enabled ? generateDDL(schema) : ""));
  const postRef = useRef<((next: Schema) => void) | null>(null);
  const inFlightRef = useRef(false);
  const pendingRef = useRef<Schema | null>(null);
  /** The schema the in-flight request was generated from. */
  const sentRef = useRef<Schema | null>(null);
  /** What `ddl` was (or is being) generated from; null while disabled. */
  const shownRef = useRef<Schema | null>(enabled ? schema : null);

  useEffect(() => {
    if (typeof Worker === "undefined") return;
    const worker = new Worker(new URL("../../../lib/ddl.worker.ts", import.meta.url));
    const post = (next: Schema) => {
      inFlightRef.current = true;
      sentRef.current = next;
      worker.postMessage(next);
    };
    worker.onmessage = (event: MessageEvent<string>) => {
      inFlightRef.current = false;
      const next = pendingRef.current;
      pendingRef.current = null;
      if (next) post(next);
      // A reply from before the panel was closed and reopened is older than
      // the synchronous result the reopening already showed.
      else if (sentRef.current === shownRef.current) setDDL(event.data);
    };
    worker.onerror = () => {
      worker.terminate();
      postRef.current = null;
      inFlightRef.current = false;
      pendingRef.current = null;
      if (shownRef.current) setDDL(generateDDL(shownRef.current));
    };
    postRef.current = post;
    return () => {
      worker.terminate();
      postRef.current = null;
      inFlightRef.current = false;
      pendingRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    if (!enabled) {
      shownRef.current = null;
      return;
    }
    if (shownRef.current === schema) return;
    const opening = shownRef.current === null;
    shownRef.current = schema;
    const post = postRef.current;
    if (opening || !post) setDDL(generateDDL(schema));
    else if (inFlightRef.current) pendingRef.current = schema;
    else post(schema);
  }, [enabled, schema]);

  return enabled ? ddl : "";
}
