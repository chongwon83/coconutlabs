"use client";

import { useEffect, useRef } from "react";

interface UploadSuccessBannerProps {
  handle: string;
  onDismiss: () => void;
}

// B.4 MAJOR #1 lift-up: page-level success banner that survives modal close.
// Existing in-modal `.upload-success-card` is kept untouched; this banner
// renders only when the modal is closed AND a recent success exists.
// Same Korean copy + same CTA (#burn) so the lift-up is semantically additive.
export function UploadSuccessBanner({ handle, onDismiss }: UploadSuccessBannerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const displayHandle = handle.replace(/^@+/, "");

  // Move focus + scroll into view on mount so SR announces and the banner is
  // visible. block:"nearest" keeps the scroll local; reduced-motion → instant.
  useEffect(() => {
    if (!ref.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current.scrollIntoView({
      block: "nearest",
      behavior: reduce ? "instant" : "smooth",
    });
    ref.current.focus();
  }, []);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="status"
      aria-live="polite"
      className="upload-success-banner"
      data-testid="upload-success-banner"
    >
      <div className="upload-success-banner__body">
        <h3 className="upload-success-banner__title">리더보드에 추가되었어요</h3>
        <p className="upload-success-banner__handle">@{displayHandle}</p>
      </div>
      <div className="upload-success-banner__actions">
        <button
          type="button"
          onClick={() => {
            window.location.hash = "#burn";
            onDismiss();
          }}
          className="upload-success-banner__cta"
        >
          리더보드 보기
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="upload-success-banner__close"
          aria-label="배너 닫기"
        >
          ×
        </button>
      </div>
    </div>
  );
}
