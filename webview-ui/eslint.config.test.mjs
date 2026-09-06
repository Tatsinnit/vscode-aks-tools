import assert from "node:assert/strict";
import { test } from "node:test";
import { ESLint } from "eslint";

const eslint = new ESLint();
const filePath = "src/components/ProgressRing.tsx";

for (const [name, code, ruleId] of [
    [
        "missing fragment keys",
        "export const Items = () => [1, 2].map((value) => <><span>{value}</span></>);",
        "@eslint-react/no-missing-key",
    ],
    [
        "unsafe target links",
        'export const Link = () => <a href="https://example.com" target="_blank">Link</a>;',
        "@eslint-react/dom-no-unsafe-target-blank",
    ],
    [
        "unknown DOM properties",
        'export const Label = () => <div class="label" />;',
        "@eslint-react/dom-no-unknown-property",
    ],
    [
        "conditional Hooks",
        'import { useState } from "react"; export function Item({ active }: { active: boolean }) { if (active) { useState(0); } return <div />; }',
        "react-hooks/rules-of-hooks",
    ],
]) {
    test(`reports ${name}`, async () => {
        const [result] = await eslint.lintText(code, { filePath });
        assert.equal(result.fatalErrorCount, 0);
        assert.ok(
            result.messages.some((message) => message.ruleId === ruleId),
            JSON.stringify(result.messages),
        );
    });
}

test("accepts keyed JSX without legacy React scope rules", async () => {
    const [result] = await eslint.lintText(
        'export function Items() { return ["a", "b"].map((value) => <span key={value}>{value}</span>); }',
        { filePath },
    );
    assert.deepEqual(result.messages, []);
});
