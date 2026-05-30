"use client";

import { CHALLENGES } from "@/lib/data";
import { Badge, Button, Icon } from "@/components/primitives";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="section-eyebrow">{children}</div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="challenge-stat">
      <span className="challenge-stat-value">{value}</span>
      <span className="challenge-stat-label">{label}</span>
    </div>
  );
}

function CodePanel() {
  return (
    <div className="code-panel">
      <div className="code-panel-header">
        <span className="code-panel-dot red" />
        <span className="code-panel-dot yellow" />
        <span className="code-panel-dot green" />
        <span className="code-panel-title">score.py</span>
      </div>
      <pre className="code-panel-body">
        <code>
          <span className="code-comment"># Verified Efficiency Score</span>{"\n"}
          <span className="code-kw">def</span>{" "}
          <span className="code-fn">score</span>
          <span className="code-punc">(</span>
          <span className="code-param">commits</span>
          <span className="code-punc">: </span>
          <span className="code-type">int</span>
          <span className="code-punc">, </span>
          <span className="code-param">cost</span>
          <span className="code-punc">: </span>
          <span className="code-type">float</span>
          <span className="code-punc">) -&gt; </span>
          <span className="code-type">float</span>
          <span className="code-punc">:</span>{"\n"}
          {"    "}
          <span className="code-kw">return</span>{" "}
          <span className="code-param">commits</span>
          <span className="code-punc"> / </span>
          <span className="code-param">cost</span>
          <span className="code-punc"> * </span>
          <span className="code-num">1000</span>{"\n"}
          {"\n"}
          <span className="code-comment"># Example from this week</span>{"\n"}
          <span className="code-fn">score</span>
          <span className="code-punc">(</span>
          <span className="code-num">commits</span>
          <span className="code-punc">=</span>
          <span className="code-num">64</span>
          <span className="code-punc">, </span>
          <span className="code-num">cost</span>
          <span className="code-punc">=</span>
          <span className="code-num">740.00</span>
          <span className="code-punc">)</span>{" "}
          <span className="code-comment"># → </span>
          <span className="code-accent">86.5</span>{"\n"}
        </code>
      </pre>
    </div>
  );
}

interface ChallengeSectionProps {
  onInvite?: () => void;
}

export function ChallengeSection({ onInvite }: ChallengeSectionProps) {
  return (
    <section className="section section-alt" id="challenge">
      <div className="section-inner">
        <Eyebrow>Cost-per-Fix Challenge</Eyebrow>
        <h2 className="section-title">
          Compete on verified efficiency.
        </h2>
        <p className="section-sub">
          Every challenge is judged by VES — independently verified commits per $1k
          of your AI spend. No vanity metrics.
        </p>

        <div className="challenge-layout">
          <div className="challenge-cards">
            {CHALLENGES.map((c) => (
              <div key={c.id} className="challenge-card">
                <div className="challenge-card-header">
                  <Badge kind="accent">{c.reward} reward</Badge>
                  <span className="challenge-deadline">
                    <Icon name="bolt" size={12} />
                    {c.deadline} left
                  </span>
                </div>
                <h3 className="challenge-card-title">{c.label}</h3>
                <p className="challenge-card-desc">{c.description}</p>
                <div className="challenge-card-footer">
                  <span className="challenge-participants">
                    {c.participants} participants
                  </span>
                  <Button variant="ghost" size="sm" onClick={onInvite}>
                    Request invite
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="challenge-right">
            <div className="challenge-stats">
              <Stat label="Active challenges" value="3" />
              <Stat label="Total reward pool" value="$100" />
              <Stat label="Participants" value="45" />
            </div>
            <CodePanel />
          </div>
        </div>
      </div>
    </section>
  );
}
