"use client";

import { motion, AnimatePresence } from "framer-motion";
import { WifiOff } from "lucide-react";
import { motionTiming, motionEase } from "../../lib/motion";
import type { PresenceUser } from "../../types";

interface PresenceStripProps {
  connected: boolean;
  participants: PresenceUser[];
}

export function PresenceStrip({ connected, participants }: PresenceStripProps) {
  const typingUsers = participants.filter((p) => p.isTyping);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: motionTiming.normal, ease: motionEase.smooth }}
      className="flex h-7 items-center justify-between border-t border-pd-border bg-pd-panel/80 px-4 text-[10px] backdrop-blur"
    >
      <div className="flex items-center gap-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={connected ? "online" : "offline"}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1.5"
          >
            {connected ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pd-success opacity-40" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-pd-success" />
                </span>
                <span className="text-pd-success">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="h-2.5 w-2.5 text-pd-danger" />
                <span className="text-pd-danger">Offline</span>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <span className="text-pd-muted">•</span>
        <span className="text-pd-muted">
          {participants.length} collaborator{participants.length !== 1 ? "s" : ""}
        </span>

        {typingUsers.length > 0 && (
          <>
            <span className="text-pd-muted">•</span>
            <span className="text-pd-accent">
              {typingUsers.map((u) => u.name).join(", ")} typing
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
              >
                …
              </motion.span>
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 text-pd-muted">
        <span>Presentation Designer v2</span>
      </div>
    </motion.div>
  );
}
