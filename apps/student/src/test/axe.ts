import axe from "axe-core";

/**
 * Runs the axe engine over a rendered container and fails with a readable report on any
 * violation. `color-contrast` is off: jsdom does no real layout or paint, so its contrast
 * calculation is unreliable there; contrast is a design-token concern, checked visually.
 */
export async function expectNoA11yViolations(container: Element) {
  const results = await axe.run(container, {
    rules: { "color-contrast": { enabled: false } },
  });
  if (results.violations.length === 0) return;
  const report = results.violations
    .map((violation) => {
      const targets = violation.nodes.map((node) => node.target.join(" ")).join("\n    ");
      return `${violation.id} (${violation.impact}): ${violation.help}\n    ${targets}`;
    })
    .join("\n\n");
  throw new Error(`Accessibility violations found:\n\n${report}`);
}
