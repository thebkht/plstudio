import { describe, expect, it } from "vitest";
import { Spring, VelocityTracker, project, rubberband, rubberClamp } from "@/app/lib/motion";
import { contrastRatio, readableTextOn } from "@/app/lib/color";
import { PALETTE } from "@/app/lib/schema";

describe("momentum projection", () => {
  it("projects further the faster the flick", () => {
    expect(project(1000)).toBeGreaterThan(project(200));
  });

  it("projects in the direction of travel", () => {
    expect(project(-800)).toBeLessThan(0);
  });

  it("comes to rest immediately with no velocity", () => {
    expect(project(0)).toBe(0);
  });
});

describe("rubber-banding", () => {
  it("resists progressively rather than moving 1:1", () => {
    const small = rubberband(50, 1000);
    const large = rubberband(500, 1000);
    expect(small).toBeLessThan(50);
    expect(large).toBeLessThan(500);
    expect(large / 500).toBeLessThan(small / 50);
  });

  it("leaves values inside the bounds untouched", () => {
    expect(rubberClamp(120, 0, 500, 800)).toBe(120);
  });

  it("lets values past the bound, but damped", () => {
    const under = rubberClamp(-100, 0, 500, 800);
    expect(under).toBeLessThan(0);
    expect(under).toBeGreaterThan(-100);
  });
});

describe("Spring", () => {
  it("settles at the target", () => {
    const spring = new Spring(0);
    spring.setTarget(100);
    for (let i = 0; i < 600 && spring.step(1 / 60); i += 1);
    expect(spring.value).toBe(100);
    expect(spring.velocity).toBe(0);
  });

  it("does not overshoot when critically damped", () => {
    const spring = new Spring(0, { damping: 1, response: 0.4 });
    spring.setTarget(100);
    let peak = 0;
    for (let i = 0; i < 600 && spring.step(1 / 60); i += 1) peak = Math.max(peak, spring.value);
    expect(peak).toBeLessThanOrEqual(100);
  });

  it("overshoots when under-damped", () => {
    const spring = new Spring(0, { damping: 0.6, response: 0.4 });
    spring.setTarget(100);
    let peak = 0;
    for (let i = 0; i < 600 && spring.step(1 / 60); i += 1) peak = Math.max(peak, spring.value);
    expect(peak).toBeGreaterThan(100);
  });

  it("carries handed-off velocity past the target", () => {
    const spring = new Spring(0, { damping: 1, response: 0.4 });
    spring.setTarget(0, 500);
    spring.step(1 / 60);
    expect(spring.value).toBeGreaterThan(0);
  });

  it("re-targets from the live value without jumping", () => {
    const spring = new Spring(0);
    spring.setTarget(100);
    for (let i = 0; i < 10; i += 1) spring.step(1 / 60);
    const midflight = spring.value;
    spring.setTarget(-100);
    spring.step(1 / 60);
    expect(Math.abs(spring.value - midflight)).toBeLessThan(20);
  });

  it("stays stable across a long dropped frame", () => {
    const spring = new Spring(0);
    spring.setTarget(100);
    spring.step(0.5);
    expect(Number.isFinite(spring.value)).toBe(true);
    expect(Math.abs(spring.value)).toBeLessThanOrEqual(100);
  });
});

describe("VelocityTracker", () => {
  it("measures px/s across the sample window", () => {
    const tracker = new VelocityTracker();
    tracker.add(0, 0, 0);
    tracker.add(50, 25, 50);
    tracker.add(100, 50, 100);
    const velocity = tracker.velocity(100);
    expect(velocity.x).toBeCloseTo(1000, 0);
    expect(velocity.y).toBeCloseTo(500, 0);
  });

  it("reports zero without enough samples", () => {
    const tracker = new VelocityTracker();
    tracker.add(10, 10, 0);
    expect(tracker.velocity(0)).toEqual({ x: 0, y: 0 });
  });

  it("reads as stationary after a pause at the same point", () => {
    const tracker = new VelocityTracker();
    tracker.add(0, 0, 0);
    tracker.add(100, 0, 50);
    tracker.add(100, 0, 400);
    tracker.add(100, 0, 450);
    expect(tracker.velocity(450).x).toBe(0);
  });
});

describe("header contrast", () => {
  it("gives every palette color a foreground that clears WCAG AA", () => {
    PALETTE.forEach((color) => {
      [color.a, color.b].forEach((background) => {
        const ratio = contrastRatio(background, readableTextOn(background));
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });
    });
  });

  it("picks dark ink on light backgrounds and white on dark", () => {
    expect(readableTextOn("#E8A33D")).toBe("#12203A");
    expect(readableTextOn("#3A66C4")).toBe("#FFFFFF");
  });
});
