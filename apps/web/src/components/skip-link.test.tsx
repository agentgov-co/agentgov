import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SkipLink } from "./skip-link";

function createMain(id?: string): HTMLElement {
  const main = document.createElement("main");
  if (id) main.id = id;
  // jsdom doesn't implement scrollIntoView
  main.scrollIntoView = vi.fn();
  document.body.appendChild(main);
  return main;
}

describe("SkipLink", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("renders with correct text and href", () => {
    render(<SkipLink />);
    const link = screen.getByText("Skip to main content");
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "#main-content");
  });

  it("is visually hidden by default (has sr-only class)", () => {
    render(<SkipLink />);
    const link = screen.getByText("Skip to main content");
    expect(link.className).toContain("sr-only");
  });

  it("focuses #main-content element on click", () => {
    const main = createMain("main-content");
    const focusSpy = vi.spyOn(main, "focus");

    render(<SkipLink />);
    fireEvent.click(screen.getByText("Skip to main content"));

    expect(focusSpy).toHaveBeenCalled();
    expect(main.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
  });

  it("sets tabindex=-1 on main and removes on blur", () => {
    const main = createMain("main-content");

    render(<SkipLink />);
    fireEvent.click(screen.getByText("Skip to main content"));

    expect(main.getAttribute("tabindex")).toBe("-1");

    fireEvent.blur(main);
    expect(main.hasAttribute("tabindex")).toBe(false);
  });

  it("falls back to first <main> when #main-content is absent", () => {
    const main = createMain();
    const focusSpy = vi.spyOn(main, "focus");

    render(<SkipLink />);
    fireEvent.click(screen.getByText("Skip to main content"));

    expect(focusSpy).toHaveBeenCalled();
  });

  it("does not throw when no <main> exists", () => {
    render(<SkipLink />);
    expect(() => {
      fireEvent.click(screen.getByText("Skip to main content"));
    }).not.toThrow();
  });
});
