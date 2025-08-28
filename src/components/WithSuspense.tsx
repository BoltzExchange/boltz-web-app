import { type Component, Suspense } from "solid-js";

import LoadingSpinner from "./LoadingSpinner";

const WithSuspense = <T extends object>(Component: Component<T>) => {
    return (props: T) => (
        <Suspense
            fallback={
                <div class="frame">
                    <LoadingSpinner />
                </div>
            }>
            <Component {...props} />
        </Suspense>
    );
};

export default WithSuspense;
