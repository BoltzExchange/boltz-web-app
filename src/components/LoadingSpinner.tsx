import "../style/loadingSpinner.scss";

const LoadingSpinner = (props: { class?: string }) => {
    return (
        <div class={`spinner ${props.class}`} data-testid="loading-spinner">
            <div class="bounce1" />
            <div class="bounce2" />
            <div class="bounce3" />
        </div>
    );
};

export default LoadingSpinner;
