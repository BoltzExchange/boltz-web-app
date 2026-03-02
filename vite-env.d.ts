/// <reference types="@rsbuild/core/types" />

interface ImportMeta {
    readonly webpackHot?: {
        dispose: (cb: () => void) => void;
    };
}

declare const __APP_VERSION__: string;
declare const __GIT_COMMIT__: string;
