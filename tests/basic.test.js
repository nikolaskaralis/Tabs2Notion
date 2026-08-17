import test from "node:test";
import assert from "node:assert/strict";
import { hostnameForUrl, isSendableUrl } from "../extension/js/tabs.js";
import {
  extractDataSourceIdFromText,
  extractSchemaPropertiesFromText,
  parseSearchCandidates
} from "../extension/js/notion.js";

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

test("extracts a Notion MCP data-source ID from fetch markup", () => {
  const id = "f336d0bc-b841-465b-8045-024475c079dd";
  assert.equal(extractDataSourceIdFromText(`<data-source url="collection://${id}">`), id);
});

test("extracts exact TITLE and URL property names from Notion data-source DDL", () => {
  const schema = 'CREATE TABLE ("Name" TITLE, "Tags" MULTI_SELECT(\'A\':blue), "URL" URL)';
  assert.deepEqual(extractSchemaPropertiesFromText(schema), {
    titlePropertyName: "Name",
    urlPropertyName: "userDefined:URL"
  });
});

test("search candidates preserve title, id and URL", () => {
  const candidates = parseSearchCandidates({
    results: [{
      id: "abc",
      title: "Read later",
      type: "database",
      url: "https://www.notion.so/abc"
    }]
  });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].id, "abc");
  assert.equal(candidates[0].title, "Read later");
  assert.equal(candidates[0].url, "https://www.notion.so/abc");
});
