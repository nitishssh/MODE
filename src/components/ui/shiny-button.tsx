"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

export type ShinyButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * MODE-adapted Hyperiux shiny button.
 *
 * The visual sweep is supplied by the shared `.mode-shiny-button` styles so
 * this component retains native button semantics and every standard prop.
 */
const ShinyButton = forwardRef<HTMLButtonElement, ShinyButtonProps>(
  ({ className = "", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={`mode-shiny-button ${className}`.trim()}
      {...props}
    />
  ),
);

ShinyButton.displayName = "ShinyButton";

export default ShinyButton;
