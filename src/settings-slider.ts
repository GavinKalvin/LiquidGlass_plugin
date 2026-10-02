import type { SliderComponent } from "obsidian";

/** Use Obsidian's inline value when available, never an icon-button label. */
export function configureSliderValue(
  slider: SliderComponent,
  suffix: string,
): (value: number) => void {
  const format = (value: number) => `${value}${suffix}`;
  if (typeof slider.setDisplayFormat === "function") {
    slider.setDisplayFormat(format);
    // The native component updates its own label during drag and setValue().
    return () => {};
  }

  // Obsidian < 1.13 has no inline formatter. Keep a single plain text label
  // for the CSS-only path on older supported hosts, without icon dimensions.
  const control = slider.sliderEl.parentElement;
  if (!control) return () => {};
  let valueLabel = control.querySelector<HTMLElement>(
    ":scope > .slider-value, :scope > .liquid-glass-value",
  );
  if (!valueLabel) {
    valueLabel = control.ownerDocument.createElement("span");
    control.insertBefore(valueLabel, slider.sliderEl);
  }
  valueLabel.classList.add("liquid-glass-value");
  valueLabel.textContent = format(slider.getValue());
  return (value: number) => { valueLabel.textContent = format(value); };
}
