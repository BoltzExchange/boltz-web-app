import { type JSX, splitProps } from "solid-js";

export type ExternalLinkProps = JSX.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
};

const mergeRel = (existing: string | undefined): string => {
    const tokens = new Set(
        (existing ?? "")
            .split(/\s+/)
            .map((t) => t.trim())
            .filter(Boolean),
    );

    tokens.add("noopener");
    tokens.add("noreferrer");
    tokens.add("external");

    return Array.from(tokens).join(" ");
};

const ExternalLink = (props: ExternalLinkProps) => {
    const [local, rest] = splitProps(props, ["children", "rel", "target"]);

    return (
        <a
            {...rest}
            target={local.target ?? "_blank"}
            rel={mergeRel(local.rel)}>
            {local.children}
        </a>
    );
};

export default ExternalLink;
