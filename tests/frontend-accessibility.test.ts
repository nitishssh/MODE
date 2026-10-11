import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LandingPage } from "../src/components/landing-page";
import { SelectField, TextareaField, TextField, Tabs } from "../src/app/app/_components/ui";

test("landing page has one main landmark and a closed mobile navigation", () => {
  const html = renderToStaticMarkup(createElement(LandingPage, { onSignIn() {} }));
  assert.equal((html.match(/<main\b/g) ?? []).length, 1);
  assert.match(html, /<main id="main-content" tabindex="-1">/);
  assert.match(html, /aria-controls="cm-mobile-navigation" aria-expanded="false"/);
  assert.match(html, /id="cm-mobile-navigation"[^>]*hidden=""/);
  const desktop = html.match(/<nav class="cm-links"[^>]*>(.*?)<\/nav>/)?.[1];
  const mobile = html.match(/<nav id="cm-mobile-navigation"[^>]*>(.*?)<\/nav>/)?.[1];
  const footer = html.match(/<nav aria-label="Footer navigation"[^>]*>(.*?)<\/nav>/)?.[1];
  assert.ok(desktop && mobile && footer);
  const destinations = (markup: string) => [...markup.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(destinations(mobile), destinations(desktop));
  assert.deepEqual(destinations(footer), destinations(desktop));
});

test("field wrappers preserve caller IDs and associate errors with the actual control", () => {
  const props = {
      id: "member-email", label: "Email", error: "Enter your email", hint: "Club email",
      "aria-describedby": "privacy-note",
  };
  for (const field of [createElement(TextField, props), createElement(SelectField, props), createElement(TextareaField, props)]) {
    const html = renderToStaticMarkup(field);
    assert.match(html, /<label for="member-email">Email<\/label>/);
    assert.match(html, /id="member-email"/);
    assert.match(html, /aria-invalid="true"/);
    assert.match(html, /aria-describedby="privacy-note member-email-description"/);
    assert.match(html, /id="member-email-description"[^>]*role="alert">Enter your email/);
    assert.doesNotMatch(html, /Club email/);
  }
});

test("generated field IDs are unique and hints remain associated", () => {
  const html = renderToStaticMarkup(createElement("form", null,
    createElement(TextField, { label: "First", hint: "First hint" }),
    createElement(TextField, { label: "Second", hint: "Second hint" }),
  ));
  const ids = [...html.matchAll(/<label for="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, 2);
  for (const id of ids) {
    assert.ok(html.includes(`id="${id}"`));
    assert.ok(html.includes(`aria-describedby="${id}-description"`));
    assert.ok(html.includes(`id="${id}-description"`));
  }
});

test("view filters expose selected button state without an incomplete tab widget", () => {
  const html = renderToStaticMarkup(createElement(Tabs, {
    value: "open", onChange() {}, items: [{ value: "open", label: "Open" }, { value: "closed", label: "Closed" }],
  }));
  assert.match(html, /role="group" aria-label="View options"/);
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1);
  assert.equal((html.match(/aria-pressed="false"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /role="tab/);
});
