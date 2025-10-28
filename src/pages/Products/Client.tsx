import { BiSolidServer } from "solid-icons/bi";
import { BsGithub } from "solid-icons/bs";
import { FaSolidCarrot as TaprootIcon } from "solid-icons/fa";
import { FaSolidRobot as AutoSwapIcon } from "solid-icons/fa";
import { IoWater as LiquidIcon } from "solid-icons/io";
import { OcLinkexternal2 } from "solid-icons/oc";
import { For } from "solid-js";

import { useGlobalContext } from "../../context/Global";
import "../../style/client.scss";

const iconSize = 38;

const Client = () => {
    const { t } = useGlobalContext();

    return (
        <div class="products-client">
            <div class="header">
                <h1>{t("boltz_client_name")}</h1>
                <h2>{t("boltz_client_description")}</h2>
            </div>
            <div class="content">
                <div class="cli-section">
                    <div class="cli-details">
                        <h3>{t("boltz_client_cli_title")}</h3>
                        <span>
                            <p>{t("boltz_client_cli_first_paragraph")}</p>
                            <p>{t("boltz_client_cli_second_paragraph")}</p>
                        </span>
                    </div>
                    <div class="cli">
                        <div class="terminal-content">
                            <div class="terminal-line">
                                <span class="prompt green">
                                    kilrau@pc:
                                    <span class="blue">~/boltz-client </span>
                                </span>
                                <span class="command">
                                    $ boltzcli autoswap setup
                                </span>
                            </div>
                            <div class="terminal-line">
                                <span class="green">? </span>Which currency
                                should autoswaps be performed on?{" "}
                                <span class="cyan">LBTC</span>
                            </div>
                            <div class="terminal-line">
                                <span class="green">? </span>Which type of swaps
                                should be executed?{" "}
                            </div>
                            <div class="terminal-line cyan">
                                {"> "}
                                <span> submarine</span>
                            </div>
                            <div class="terminal-line">
                                <span class="indent">chain</span>
                            </div>
                            <div class="terminal-line">
                                <span class="indent">reverse</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="features">
                    <div class="features-header fadeIn">
                        <h3>{t("boltz_client_features_title")}</h3>
                        <p>{t("boltz_client_features_description")}</p>
                    </div>
                    <div class="two-column-grid">
                        <For
                            each={[
                                {
                                    icon: <TaprootIcon size={iconSize} />,
                                    title: t(
                                        "boltz_client_feature_taproot_title",
                                    ),
                                    description: t(
                                        "boltz_client_feature_taproot_description",
                                    ),
                                },
                                {
                                    icon: <BiSolidServer size={iconSize} />,
                                    title: t(
                                        "boltz_client_node_agnostic_title",
                                    ),
                                    description: t(
                                        "boltz_client_node_agnostic_description",
                                    ),
                                },
                                {
                                    icon: <AutoSwapIcon size={iconSize} />,
                                    title: t("boltz_client_autoswap_title"),
                                    description: t(
                                        "boltz_client_autoswap_description",
                                    ),
                                },
                                {
                                    icon: <LiquidIcon size={iconSize} />,
                                    title: t("boltz_client_liquid_title"),
                                    description: t(
                                        "boltz_client_liquid_description",
                                    ),
                                },
                            ]}>
                            {(feature) => (
                                <div class="content-item card slideRight">
                                    <span class="content-item-icon">
                                        {feature.icon}
                                    </span>
                                    <div class="content-item-body">
                                        <h4>{feature.title}</h4>
                                        <p>{feature.description}</p>
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>
                </div>
                <div class="call-to-action slideUp">
                    <div class="text">
                        <h3>{t("boltz_client_cta_title")}</h3>
                        <p>{t("boltz_client_cta_subtitle")}</p>
                    </div>
                    <div class="cta-buttons">
                        <a
                            class="btn-primary"
                            href="https://client.docs.boltz.exchange/"
                            target="_blank"
                            rel="noopener noreferrer">
                            <span>{t("documentation")}</span>
                            <OcLinkexternal2 />
                        </a>
                        <a
                            class="btn-secondary"
                            href="https://github.com/BoltzExchange/boltz-client"
                            target="_blank"
                            rel="noopener noreferrer">
                            <span>{t("view_on_github")}</span>
                            <BsGithub />
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Client;
