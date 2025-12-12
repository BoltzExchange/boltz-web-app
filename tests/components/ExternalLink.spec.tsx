import { render, screen } from "@solidjs/testing-library";
import { describe, expect, test } from "vitest";

import ExternalLink from "../../src/components/ExternalLink";

describe("ExternalLink", () => {
    test("defaults to target=_blank and adds noopener/noreferrer/external rel", () => {
        render(() => (
            <ExternalLink href="https://example.com/path">Example</ExternalLink>
        ));

        const link = screen.getByRole("link", {
            name: "Example",
        }) as HTMLAnchorElement;

        expect(link.getAttribute("href")).toEqual("https://example.com/path");
        expect(link.target).toEqual("_blank");

        const relTokens = new Set(link.rel.split(/\s+/).filter(Boolean));
        expect(relTokens.has("noopener")).toEqual(true);
        expect(relTokens.has("noreferrer")).toEqual(true);
        expect(relTokens.has("external")).toEqual(true);
    });

    test("preserves an explicit target and merges rel tokens", () => {
        render(() => (
            <ExternalLink href="https://example.com" target="_self" rel="ugc">
                Example
            </ExternalLink>
        ));

        const link = screen.getByRole("link", {
            name: "Example",
        }) as HTMLAnchorElement;

        expect(link.target).toEqual("_self");

        const relTokens = new Set(link.rel.split(/\s+/).filter(Boolean));
        expect(relTokens.has("ugc")).toEqual(true);
        expect(relTokens.has("noopener")).toEqual(true);
        expect(relTokens.has("noreferrer")).toEqual(true);
        expect(relTokens.has("external")).toEqual(true);
    });

    test("dedupes rel tokens", () => {
        render(() => (
            <ExternalLink
                href="https://example.com"
                rel="noopener noreferrer external noopener">
                Example
            </ExternalLink>
        ));

        const link = screen.getByRole("link", {
            name: "Example",
        }) as HTMLAnchorElement;

        const relParts = link.rel.split(/\s+/).filter(Boolean);
        const relTokens = new Set(relParts);

        expect(relTokens.has("noopener")).toEqual(true);
        expect(relTokens.has("noreferrer")).toEqual(true);
        expect(relTokens.has("external")).toEqual(true);
        expect(relParts.length).toEqual(relTokens.size);
    });

    test("passes through common anchor attributes", () => {
        render(() => (
            <ExternalLink
                href="https://example.com"
                class="my-link"
                id="my-link-id"
                aria-label="External link">
                Example
            </ExternalLink>
        ));

        const link = screen.getByRole("link", {
            name: "External link",
        }) as HTMLAnchorElement;

        expect(link.classList.contains("my-link")).toEqual(true);
        expect(link.getAttribute("id")).toEqual("my-link-id");
    });

    test("renders children inside the anchor", () => {
        render(() => (
            <ExternalLink href="https://example.com">
                <span>Block</span> <strong>Content</strong>
            </ExternalLink>
        ));

        const link = screen.getByRole("link") as HTMLAnchorElement;

        expect(link.querySelector("span")?.textContent).toEqual("Block");
        expect(link.querySelector("strong")?.textContent).toEqual("Content");
        expect(link.textContent?.includes("Block")).toEqual(true);
        expect(link.textContent?.includes("Content")).toEqual(true);
    });
});
