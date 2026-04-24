# Tron sends

## Wallet support

Tron sends require a directly connected Tron wallet. For the initial release,
only TronLink and MetaMask are supported.

## Approvals

TRC20 approvals use the maximum token allowance instead of approving only the
current swap amount. This saves users an approval transaction on later sends.

The approval risk is reasonable because the spender is another
Tether-controlled USDT0 contract. Users already trust Tether's token contract
and issuer controls for their USDT0 balance.

## Gas and fees

Gas top-ups are not supported for Tron sends. Tron energy and fee dynamics make
top-ups costly for this use case, and many Tron wallets already expose cheaper
USDT or GasFree-style payment models.

GasFree itself is not supported for now. Reconsider it only if Tron send usage
is high enough to justify the integration and support burden.
