import "../style/loadingSpinner.scss";

const LoadingSpinner = () => {
    return (
        <div class="spinner" data-testid="loading-spinner">
            <div class="bounce1" />
            <div class="bounce2" />
            <div class="bounce3" />
        </div>
    );
};

export default LoadingSpinner;
