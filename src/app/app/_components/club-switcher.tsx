"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClubMembership } from "@/lib/contracts";
import { api, ApiError, describeError } from "../_lib/api";
import { useSession } from "../_lib/session";
import { Icon } from "./icons";

interface ClubSwitcherProps {
  memberships: ClubMembership[];
  currentClubId: string;
}

export function ClubSwitcher({ memberships, currentClubId }: ClubSwitcherProps) {
  const { refresh } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");

  const currentClub = memberships.find((m) => m.clubId === currentClubId);

  const handleSwitch = useCallback(
    async (clubId: string) => {
      if (clubId === currentClubId) {
        setOpen(false);
        return;
      }
      setSwitching(true);
      setError("");
      try {
        await api.post("/api/auth/switch-club", { clubId });
        await refresh();
        setOpen(false);
        router.push("/app");
      } catch (caught) {
        setError(describeError(caught instanceof ApiError ? caught : new Error(String(caught))));
      } finally {
        setSwitching(false);
      }
    },
    [currentClubId, refresh, router],
  );

  // Don't show switcher if only one club
  if (memberships.length <= 1) return null;

  return (
    <div className="club-switcher">
      <button
        type="button"
        className="club-switcher-button"
        onClick={() => setOpen(!open)}
        aria-label="Switch club"
        title={currentClub?.clubName || "Switch club"}
      >
        <span className="club-name">{currentClub?.clubName || "Select club"}</span>
        <Icon name={open ? "chevron" : "chevron"} size={14} style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>

      {open && (
        <div className="club-switcher-menu">
          {error && <div className="error-message">{error}</div>}
          {memberships.map((membership) => (
            <button
              key={membership.clubId}
              type="button"
              className={`club-option ${membership.clubId === currentClubId ? "active" : ""}`}
              onClick={() => handleSwitch(membership.clubId)}
              disabled={switching}
            >
              <span className="club-option-name">{membership.clubName}</span>
              <span className="club-option-role">{membership.role}</span>
              {membership.clubId === currentClubId && <span className="active-indicator">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
