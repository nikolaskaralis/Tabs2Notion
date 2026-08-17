import test from "node:test";
import assert from "node:assert/strict";
import { hostnameForUrl, isSendableUrl } from "../extension/js/tabs.js";

test("hostnameForUrl extracts normal web hosts", () => {
  assert.equal(hostnameForUrl("https://chatgpt.com/c/123"), "chatgpt.com");
  assert.equal(hostnameForUrl("not a url"), null);
});

test("only ordinary HTTP(S) tabs are directly sendable", () => {
  assert.equal(isSendableUrl("https://example.com/a"), true);
  assert.equal(isSendableUrl("http://localhost:3000"), true);
  assert.equal(isSendableUrl("chrome://extensions"), false);
  assert.equal(isSendableUrl("file:///tmp/test.html"), false);
});
