import LoadingSpinner from "../components/LoadingSpinner";

const TransactionClaimPending = () => {
    // TODO: translations
    return (
        <div>
            <h2>Invoice paid</h2>
            <p>Creating cooperative claim transaction</p>
            <LoadingSpinner />
        </div>
    );
};

export default TransactionClaimPending;
