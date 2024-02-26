import { createSignal } from "solid-js";

let loaders = [];

const signals = new Map();

const [modulesLoaded, setModulesLoaded] = createSignal<boolean>(false);
export { modulesLoaded };

export function createLazyModule<T>(initializer: () => Promise<T>): T {
    const [module, setModule] = createSignal<T>(null);

    const lazyModule = new Proxy(
        {},
        {
            // @ts-ignore
            get(target, propKey: keyof T) {
                if (!module()) {
                    console.log("Module not loaded, loading now", initializer);
                    throw new Error("Module hasnt been loaded");
                }
                return module()[propKey];
            },
        },
    );

    async function loadModule() {
        try {
            const result = await initializer();
            // @ts-ignore
            setModule(result);
        } catch (e) {
            console.error(initializer, e);
        }
    }
    loaders.push(loadModule);
    signals.set(lazyModule, module);

    return lazyModule as T;
}

export function moduleLoaded(...check: any) {
    return () => check.every((module) => signals.get(module)() != null);
}

export async function loadLazyModules() {
    await Promise.all(loaders.map((m) => m()));
    loaders = [];
    setModulesLoaded(true);
}

export const invoice = createLazyModule(() => import("./invoice"));
export const address = createLazyModule(() => import("./address"));
export const client = createLazyModule(() => import("./boltzClient"));
export const refund = createLazyModule(() => import("./refund"));
export const rootstock = createLazyModule(() => import("./rootstock"));
export const claim = createLazyModule(() => import("./claim"));
export const ethers = createLazyModule(() => import("ethers"));
export const boltzCore = createLazyModule(() => import("boltz-core"));
export const QrScanner = createLazyModule(() => import("qr-scanner"));
export const swapChecker = createLazyModule(() => import("./swapchecker"));
