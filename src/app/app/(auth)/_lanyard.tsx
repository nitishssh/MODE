"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { cardFrontSvg } from "./_card";

/*
 * The member pass hanging on a lanyard, in the product's own colours: paper
 * card with the terracotta header, ink back, ink strap with the wordmark and
 * gold hardware. Client-only (three.js needs a window); reduced-motion users
 * get the still card without the intro swing or breeze.
 */
const Lanyard = dynamic(() => import("@/components/ui/lanyard/Lanyard"), { ssr: false, loading: () => <div className="mx-login-lanyard-fallback" aria-hidden="true" /> });

/** `name` is whatever the visitor is typing in the form; it is drawn on the card after a short pause. */
export function AuthLanyard({ name = "" }: { name?: string }) {
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [front, setFront] = useState(() => cardFrontSvg(""));
  useEffect(() => {
    const id = window.setTimeout(() => setFront(cardFrontSvg(name)), 140);
    return () => window.clearTimeout(id);
  }, [name]);
  return (
    <div className="mx-login-lanyard" aria-hidden="true">
      <Lanyard
        frontImage={front}
        backImage="/lanyard/card-back.svg"
        strapImage="/lanyard/strap.svg"
        imageFit="cover"
        cardColor="#fdfaf5"
        orientation="portrait"
        finish="glossy"
        cornerRadius={0.3}
        size={0.62}
        anchor="center"
        strapLength={0.5}
        strapColor="#24201e"
        strapWidth={0.65}
        metal="gold"
        gravity={1}
        damping={0.5}
        elasticity={0.5}
        breeze={reduce ? 0 : 0.5}
        interactive
        intro={!reduce}
      />
    </div>
  );
}
