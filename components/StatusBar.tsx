"use client";

import { Icon } from "@/components/primitives";

export function StatusBar() {
  return (
    <div className="status-bar">
      <div className="status-bar-inner">
        <span className="status-dot" />
        <span className="status-text">
          Live · 1,247 builders tracked this week
        </span>
        <span className="status-divider" />
        <span className="status-item">
          <Icon name="cpu" size={12} />
          2.4B tokens burned
        </span>
        <span className="status-divider" />
        <span className="status-item">
          <Icon name="bolt" size={12} />
          Top VES this week: 201.7 (@shellcoder)
        </span>
      </div>
    </div>
  );
}
