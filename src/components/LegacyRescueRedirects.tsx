import { Navigate, Route, useLocation } from "@solidjs/router";

const Redirect = () => {
    const location = useLocation();
    return <Navigate href={`/rescue${location.search}`} />;
};

export const legacyRescueRedirects = () => (
    <>
        <Route path="/refund" component={Redirect} />
        <Route path="/refund/external" component={Redirect} />
        <Route path="/refund/external/:type" component={Redirect} />
        <Route path="/refund/external/:type/:mode" component={Redirect} />
        <Route path="/rescue/external" component={Redirect} />
        <Route path="/rescue/external/:type" component={Redirect} />
        <Route path="/rescue/external/:type/:mode" component={Redirect} />
    </>
);
