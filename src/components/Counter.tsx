import { useCountUp } from "../hooks/useCountUp";
import { formatCount, odometer, percentOf } from "../lib/format";

type Props = {
  live: number;
  blocked: number;
  goal: number;
};

// The big number. Leading zeros stay dim so the lit digits read as progress.
// Renders inside the count panel, which sets the colors.
export function Counter({ live, blocked, goal }: Props) {
  const animated = useCountUp(live);
  const digits = goal.toString().length;
  const { dim, lit } = odometer(animated, digits);
  const width = `${Math.min(100, (live / goal) * 100)}%`;

  return (
    <>
      <p className="label">Jev asked, so far</p>
      <p className="counter" aria-hidden="true">
        <span className="counter__dim">{dim}</span>
        {lit}
      </p>
      <p className="sr-only">
        Jev asked {formatCount(live)} times of {formatCount(goal)}
      </p>
      <div
        className="progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={live}
      >
        <div className="progress__fill" style={{ width }} />
      </div>
      <div className="count__stats body-sm">
        <span>
          {percentOf(live, goal)} <span className="muted">of one million</span>
        </span>
        <span>
          {formatCount(blocked)} <span className="muted">held back by Jev</span>
        </span>
      </div>
    </>
  );
}
