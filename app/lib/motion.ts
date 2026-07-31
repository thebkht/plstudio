/**
 * Motion primitives for the canvas: velocity tracking, momentum projection,
 * rubber-banding, and interruptible springs.
 *
 * Springs are parameterized the way Apple exposes them (damping ratio +
 * response) rather than as mass/stiffness/damping, and they always integrate
 * from the current value and velocity — which is what makes them safe to
 * re-target mid-flight.
 */

export type Vec = { x: number; y: number };

/**
 * Where a flick would come to rest, using exponential scroll deceleration.
 * `decelerationRate` 0.998 matches normal scroll feel; 0.99 is snappier.
 */
export function project(velocity: number, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Progressive resistance past a boundary — the further out, the less it follows. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** Clamp to [min, max], but resist rather than hard-stop outside it. */
export function rubberClamp(
  value: number,
  min: number,
  max: number,
  dimension: number,
  constant = 0.55,
) {
  if (value < min) return min - rubberband(min - value, dimension, constant);
  if (value > max) return max + rubberband(value - max, dimension, constant);
  return value;
}

export type SpringOptions = {
  /** 1 = critically damped (no overshoot). Below 1 overshoots; ~0.8 for momentum. */
  damping?: number;
  /** Seconds to reach the target. Not a duration — settle time emerges from the physics. */
  response?: number;
};

const REST_DISTANCE = 0.05;
const REST_VELOCITY = 0.05;

/**
 * A damped harmonic oscillator solved analytically, so any `dt` is stable and
 * a dropped frame never destabilizes the motion.
 *
 * Re-target at any time with `setTarget` — the spring carries its current
 * velocity through, which is what avoids the "brick wall" on gesture reversal.
 */
export class Spring {
  value: number;
  velocity = 0;
  target: number;
  damping: number;
  response: number;

  constructor(value: number, { damping = 1, response = 0.4 }: SpringOptions = {}) {
    this.value = value;
    this.target = value;
    this.damping = damping;
    this.response = response;
  }

  /** Re-target from the live value. Pass `velocity` to hand off a gesture's momentum. */
  setTarget(target: number, velocity?: number) {
    this.target = target;
    if (velocity !== undefined) this.velocity = velocity;
  }

  /** Jump without animating (e.g. while the user is dragging 1:1). */
  reset(value: number, velocity = 0) {
    this.value = value;
    this.target = value;
    this.velocity = velocity;
  }

  /** Advance `dt` seconds. Returns false once settled. */
  step(dt: number): boolean {
    const omega = (2 * Math.PI) / this.response;
    const zeta = this.damping;
    const displacement = this.value - this.target;
    let next: number;
    let velocity: number;

    if (zeta >= 1) {
      // Critically damped: no oscillation, fastest non-overshooting settle.
      const decay = Math.exp(-omega * dt);
      const linear = this.velocity + omega * displacement;
      next = this.target + (displacement + linear * dt) * decay;
      velocity = (linear - omega * (displacement + linear * dt)) * decay;
    } else {
      const damped = omega * Math.sqrt(1 - zeta * zeta);
      const decay = Math.exp(-zeta * omega * dt);
      const cosine = Math.cos(damped * dt);
      const sine = Math.sin(damped * dt);
      const coefficient = (this.velocity + zeta * omega * displacement) / damped;
      const oscillation = displacement * cosine + coefficient * sine;
      next = this.target + decay * oscillation;
      velocity =
        decay *
        (-zeta * omega * oscillation + (-displacement * damped * sine + coefficient * damped * cosine));
    }

    this.value = next;
    this.velocity = velocity;

    if (
      Math.abs(this.value - this.target) < REST_DISTANCE &&
      Math.abs(this.velocity) < REST_VELOCITY
    ) {
      this.value = this.target;
      this.velocity = 0;
      return false;
    }
    return true;
  }
}

type Sample = { t: number; x: number; y: number };

/**
 * Rolling pointer history. Velocity is measured across a short window rather
 * than between the last two events, which would be dominated by jitter.
 */
export class VelocityTracker {
  private samples: Sample[] = [];
  private window: number;

  constructor(windowMs = 100) {
    this.window = windowMs;
  }

  add(x: number, y: number, t: number) {
    this.samples.push({ t, x, y });
    const cutoff = t - this.window * 2;
    while (this.samples.length > 2 && this.samples[0].t < cutoff) this.samples.shift();
  }

  clear() {
    this.samples = [];
  }

  /** Pixels per second over the trailing window. */
  velocity(now: number): Vec {
    const recent = this.samples.filter((sample) => now - sample.t <= this.window);
    const usable = recent.length >= 2 ? recent : this.samples.slice(-2);
    if (usable.length < 2) return { x: 0, y: 0 };
    const first = usable[0];
    const last = usable[usable.length - 1];
    const elapsed = (last.t - first.t) / 1000;
    if (elapsed <= 0) return { x: 0, y: 0 };
    return { x: (last.x - first.x) / elapsed, y: (last.y - first.y) / elapsed };
  }
}

/**
 * Drives a frame loop until `step` reports every spring has settled.
 * Calling the returned handle stops it; re-entrancy is the caller's business.
 */
export function runFrameLoop(step: (dt: number) => boolean) {
  let frame = 0;
  let last = performance.now();
  const tick = (now: number) => {
    // Clamp dt so a backgrounded tab doesn't teleport the animation on return.
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    if (step(dt)) frame = requestAnimationFrame(tick);
    else frame = 0;
  };
  frame = requestAnimationFrame(tick);
  return () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };
}
