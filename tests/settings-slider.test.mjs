import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const result = await build({
  entryPoints: [fileURLToPath(new URL("../src/settings-slider.ts", import.meta.url))],
  bundle: true, write: false, format: "esm", platform: "node",
});
const { configureSliderValue } = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`,
);

class ElementStub {
  children = [];
  parentElement = null;
  textContent = "";
  classes = new Set();
  classList = { add: (name) => this.classes.add(name) };
  ownerDocument = { createElement: (tag) => new ElementStub(tag) };
  constructor(tag = "div") { this.tagName = tag; }
  insertBefore(child, anchor) {
    const index = this.children.indexOf(anchor);
    if (index < 0) throw new Error("Anchor is not a child");
    child.parentElement = this;
    this.children.splice(index, 0, child);
  }
  querySelector() {
    return this.children.find((child) => child.classes.has("slider-value")
      || child.classes.has("liquid-glass-value")) ?? null;
  }
}

function sliderFixture(native = false) {
  const control = new ElementStub();
  const input = new ElementStub("input");
  input.parentElement = control;
  control.children.push(input);
  const slider = {
    sliderEl: input, value: 150,
    getValue() { return this.value; },
  };
  let nativeLabel;
  if (native) {
    nativeLabel = new ElementStub("span");
    nativeLabel.classList.add("slider-value");
    control.insertBefore(nativeLabel, input);
    slider.setDisplayFormat = function(format) {
      this.format = format;
      nativeLabel.textContent = format(this.value);
      return this;
    };
    slider.setValue = function(value) {
      this.value = value;
      nativeLabel.textContent = this.format(value);
      return this;
    };
  }
  return { slider, control, nativeLabel };
}

test("current Obsidian has exactly one inline value, including 150 / 150", () => {
  const { slider, control, nativeLabel } = sliderFixture(true);
  const update = configureSliderValue(slider, " / 150");
  assert.equal(control.children.length, 2);
  assert.equal(nativeLabel.textContent, "150 / 150");
  for (const next of [0, 65, 135, 150]) {
    slider.setValue(next);
    update(next);
    assert.equal(nativeLabel.textContent, `${next} / 150`);
    assert.equal(control.children.filter((node) => node.tagName === "span").length, 1);
  }
});

test("percent and pixel suffixes use the host formatter without extra labels", () => {
  for (const [suffix, next, expected] of [["%", 100, "100%"], [" px", 18, "18 px"]]) {
    const { slider, control, nativeLabel } = sliderFixture(true);
    configureSliderValue(slider, suffix);
    slider.setValue(next);
    assert.equal(nativeLabel.textContent, expected);
    assert.equal(control.children.length, 2);
  }
});

test("older hosts use one plain span, never a fixed-size icon button", () => {
  const { slider, control } = sliderFixture();
  const update = configureSliderValue(slider, " / 150");
  const label = control.children[0];
  assert.equal(label.tagName, "span");
  assert.equal(label.textContent, "150 / 150");
  assert.ok(label.classes.has("liquid-glass-value"));
  assert.equal(control.children[1], slider.sliderEl);
  update(65);
  assert.equal(label.textContent, "65 / 150");
  configureSliderValue(slider, "%");
  assert.equal(control.children.length, 2);
  assert.equal(label.textContent, "150%");
});

test("existing unformatted inline labels are reused rather than duplicated", () => {
  const { slider, control, nativeLabel } = sliderFixture(true);
  delete slider.setDisplayFormat;
  const update = configureSliderValue(slider, " / 150");
  update(135);
  assert.equal(nativeLabel.textContent, "135 / 150");
  assert.equal(control.children.length, 2);
});

test("settings values cannot shrink or wrap into overlapping lines", () => {
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  const valueRule = css.match(/\.liquid-glass-settings \.slider-value,\s*\.liquid-glass-settings \.liquid-glass-value\s*\{([^}]+)\}/)?.[1];
  assert.ok(valueRule);
  assert.match(valueRule, /white-space:\s*nowrap/);
  assert.match(valueRule, /flex:\s*0 0 auto/);
  assert.match(valueRule, /width:\s*auto/);
  assert.doesNotMatch(valueRule, /54px/);
  const main = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
  assert.doesNotMatch(main, /\.addExtraButton\(/);
});
