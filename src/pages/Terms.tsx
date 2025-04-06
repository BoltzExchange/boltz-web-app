import type { Component } from "solid-js";

import "../style/legal.scss";

const Terms: Component = () => {
    return (
        <div class="terms-container">
            <h1>Terms of Service</h1>
            <h2>1. Introduction</h2>
            <p>
                Boltz Services are operated by Boltz S.A. de C.V., an entity
                formed under the laws of El Salvador. Services provided by Boltz
                include, but are not limited to, Boltz, the technology and
                platform integrated therein, the Boltz Application Programming
                Interfaces (API), and related software, applications or products
                (collectively the "Service" or "Services"). Please read these
                Terms of Service (the "Terms") carefully before using our
                Services. By accessing our Service, e.g. by using any part of
                the site or any software interacting with our API, users agree
                to be bound by these Terms. If users don't agree with these
                Terms or any of its clauses, they shall immediately cease to use
                any Boltz Services.
            </p>

            <h2>2. Enforcement & Amendments</h2>
            <p>
                2.1. By accessing or using our Service, users confirm to have
                understood and agreed to be bound by these Terms.
            </p>
            <p>
                2.2. We reserve the right to amend, modify or alter these Terms
                from time to time, in our sole discretion.
            </p>

            <h2>3. Service Description</h2>
            <p>
                The Service allows users to swap between different Bitcoin
                layers. Boltz Swaps use advanced cryptography and are
                non-custodial, which means users retain full control of their
                bitcoin throughout the entire flow of a swap. Users need to
                provide the following information to use the Service:
            </p>
            <p>
                3.1. Select the Bitcoin layer that you want to swap from and the
                Bitcoin layer that you want to swap to (jointly referred to as
                "swap pair").
            </p>
            <p>3.2. Select the amount of bitcoin to be swapped.</p>
            <p>
                3.3. Provide the destination information where the swapped
                amount will be sent.
            </p>

            <h2>4. Service Rules</h2>
            <p>By using the service you warrant:</p>
            <p>
                4.1. You use our Service at your sole option, discretion and
                risk.
            </p>
            <p>
                4.2. You are solely responsible for any applicable taxes which
                may be payable while using our Service.
            </p>
            <p>
                4.3. You understand and agree that Boltz may prohibit operation
                in some jurisdictions. Boltz maintains the right to select its
                markets and jurisdictions to operate and may restrict its
                Service in certain jurisdictions at any time.
            </p>
            <p>
                4.4. You are at least 18 years old or of other legal age,
                according to your relevant jurisdiction.
            </p>
            <p>
                4.5. You agree to pay the fees for transactions completed via
                our Service as defined by Boltz, which we may change from time
                to time.
            </p>
            <p>
                4.6. The number of transaction confirmations required for a
                transaction to be considered accepted for a swap is different
                for each blockchain-based Bitcoin layer. The required number of
                transaction confirmations is subject to change at the discretion
                of Boltz without notice.
            </p>
            <p>
                4.7. On UTXO-based Bitcoin layers, sending more than one
                transaction to a swap address is a violation of these Terms and,
                in some rare cases, may result in the loss of funds.
            </p>
            <p>
                4.8. Sending a transaction to a swap address after 24 hours has
                passed since the creation of the swap is a violation of these
                Terms and, in some rare cases, may result in the loss of funds.
            </p>
            <p>
                4.9. Sending funds outside the allowed minimum and maximum
                amount range is a violation of these Terms and, in some rare
                cases, may result in the loss of funds.
            </p>
            <p>
                4.10. Sending funds to the address specified in the swap in a
                currency and/or blockchain network other than that specified in
                the swap is a violation of these Terms and, in some rare cases,
                may result in the loss of funds.
            </p>
            <p>
                4.11. Boltz Swaps are executed fully automatically and when you
                contact support with a request to cancel or change a swap, Boltz
                has the right to refuse this request without giving reasons.
            </p>
            <p>
                4.12. You agree that Boltz cannot distinguish between swaps
                created via official software distributed by Boltz or modified
                swap client software, due to the openness of its API and open
                source nature of its software. You agree that Boltz can only
                provide support for swap client software officially distributed
                by Boltz and used in ways permitted under these Terms.
            </p>
            <p>
                4.13. You agree that there are risks associated with
                Internet-based systems, such as the failure of hardware,
                software, and Internet connections and with the different
                Bitcoin protocols, such as any malfunction, unintended function,
                unexpected functioning of or attack on the Bitcoin layer's
                protocol.
            </p>
            <p>
                4.14. Users shall not use sending/destination addresses or
                bitcoin used in connection with this service for activities
                associated with terrorism, fraud, scams, or illegal purposes.
            </p>
            <p>
                4.15. Boltz explicitly disclaims any responsibility or liability
                for any losses, damages, or harm incurred by users as a result
                of scams, frauds, or any other deceptive practices perpetrated
                by third parties in connection with the use of our Service.
            </p>
            <p>
                4.16. Boltz does not provide custodial services, meaning that
                Boltz never controls bitcoin of users, not even for a short
                transient period of time. Users hereby indemnify Boltz, who are
                held to have no responsibility, against any direct, indirect,
                consequential, or any damages of any kind, arising out of or in
                any way connected with the use of our Service, including but not
                limited to those arising from users' personal error and/or
                misbehavior. This especially includes loss of funds due to loss
                of private keys for swap claims and refunds or providing
                incorrect swap destination info, e.g. an incorrect Bitcoin
                address.
            </p>
            <p>
                4.17. Boltz uses an automated risk management system to check
                all transactions made by users. We reserve the right to reject
                processing swaps with transactions originating from illegal
                activity. In these scenarios, users will have the option to
                unilaterally refund using funds locked in swap addresses using
                their cryptographic refund keys as generated by officially
                distributed Boltz software.
            </p>
            <p>
                4.18. Boltz will retain transaction data to comply with our
                legal obligations under applicable laws and regulations in El
                Salvador. We are entitled to transfer this data to government
                bodies for the prevention and disclosure of prohibited or
                illegal actions.
            </p>

            <h2>5. Contact Info</h2>
            <p>
                For questions or general inquiries, please contact{" "}
                <a href="mailto:hi@bol.tz">hi@bol.tz</a>. Law enforcement
                officials should email{" "}
                <a href="mailto:legal@bol.tz">legal@bol.tz</a>. Boltz will
                respond to law enforcement requests from authorized law
                enforcement officials with proof of authority. Law enforcement
                requests should contain the relevant information to the request,
                including the details of the law enforcement agency, the related
                case officer or representative to contact, details of
                information requested, as well as a way in which Boltz can
                authenticate the request being made as genuine.
            </p>

            <p class="last-updated">
                <strong>Last updated: March 19, 2025</strong>
            </p>
        </div>
    );
};

export default Terms;
