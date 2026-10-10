"use client";

import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

const milestones = [
  { number: "01", title: "Plan together", copy: "Keep events, people and responsibilities in one shared register." },
  { number: "02", title: "Move work forward", copy: "Turn volunteer work into clear, visible tasks with an honest next step." },
  { number: "03", title: "Close the loop", copy: "Record approvals and balances so the team can see what happened." },
];

function subscribeToReducedMotion(callback: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

export function LandingTimeline() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track || reducedMotion) return;

    const context = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>(".landing-journey-card");
      const progress = section.querySelector<HTMLElement>(".landing-journey-progress");
      const desktop = window.matchMedia("(min-width: 801px)").matches;

      if (!desktop) {
        cards.forEach((card) => {
          gsap.fromTo(card, { autoAlpha: 0, y: 28 }, {
            autoAlpha: 1,
            y: 0,
            duration: 0.55,
            ease: "power2.out",
            scrollTrigger: { trigger: card, start: "top 84%", once: true },
          });
        });
        return;
      }

      const movement = () => Math.max(0, track.scrollWidth - section.clientWidth + 92);
      const timeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: () => `+=${movement()}`,
          pin: true,
          scrub: 0.65,
          invalidateOnRefresh: true,
        },
      });

      timeline
        .fromTo(progress, { scaleX: 0 }, { scaleX: 1, duration: 1 }, 0)
        .fromTo(cards, { autoAlpha: 0, y: 34 }, { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.18, ease: "power2.out" }, 0.06)
        .to(track, { x: () => -movement(), duration: 1 }, 0);
    }, section);

    return () => context.revert();
  }, [reducedMotion]);

  return <section ref={sectionRef} className="landing-timeline landing-journey" id="how-it-works" aria-labelledby="flow-title">
    <div className="landing-journey-heading">
      <p>ONE SHARED RHYTHM</p>
      <h2 id="flow-title">Small steps make the <em>whole club</em> move.</h2>
      <span>Keep scrolling <b aria-hidden="true">↓</b></span>
    </div>
    <div className="landing-journey-viewport">
      <div className="landing-journey-rail" aria-hidden="true"><i className="landing-journey-progress" /></div>
      <div className="landing-journey-track" ref={trackRef} role="list">
        {milestones.map((item, index) => <article className={`landing-journey-card journey-card-${index + 1}`} key={item.number} role="listitem">
          <span className="landing-journey-node" aria-hidden="true" />
          <p>{item.number}</p><h3>{item.title}</h3><span>{item.copy}</span>
        </article>)}
      </div>
    </div>
  </section>;
}
