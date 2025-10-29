import {
    BsGithub,
    BsShieldFillCheck as SelfCustodialIcon,
} from "solid-icons/bs";
import { BsChatFill as ChatIcon } from "solid-icons/bs";
import { FaSolidRobot as AutoSwapIcon } from "solid-icons/fa";
import { IoWater as LiquidIcon } from "solid-icons/io";
import { OcLinkexternal2 } from "solid-icons/oc";
import { RiArrowsDragMove2Fill as FlexibleIcon } from "solid-icons/ri";
import { For } from "solid-js";

import btcPayIllustration from "../../assets/btcpay-illustration.webp";
import btcPayScreenshot from "../../assets/btcpay-screenshot.svg";
import { useGlobalContext } from "../../context/Global";
import "../../style/btcpay.scss";

const iconSize = 38;

const Btcpay = () => {
    const { t } = useGlobalContext();

    return (
        <div class="products-btcpay">
            <div class="header">
                <h1>{t("boltz_plugin_name")}</h1>
                <h2>{t("boltz_plugin_description")}</h2>
            </div>
            <div class="content">
                <div class="illustration">
                    <img src={btcPayIllustration} alt="BTCPay illustration" />
                    <div class="neon-tube" />
                </div>
                <div class="steps-container grid">
                    <For
                        each={[
                            {
                                title: t("boltz_plugin_step_install_title"),
                                description: t(
                                    "boltz_plugin_step_install_description",
                                ),
                            },
                            {
                                title: t("boltz_plugin_step_setup_title"),
                                description: t(
                                    "boltz_plugin_step_setup_description",
                                ),
                            },
                            {
                                title: t("boltz_plugin_step_paid_title"),
                                description: t(
                                    "boltz_plugin_step_paid_description",
                                ),
                            },
                        ]}>
                        {(step, index) => (
                            <div class="card step slideUp">
                                <p class="step-number">{index() + 1}</p>
                                <h4>{step.title}</h4>
                                <p>{step.description}</p>
                            </div>
                        )}
                    </For>
                </div>
                <div class="grid">
                    <div class="features-grid slideUp">
                        <span class="features-header">
                            <h3>{t("boltz_plugin_features_title")}</h3>
                            <p>{t("boltz_plugin_features_description")}</p>
                        </span>
                        <For
                            each={[
                                {
                                    icon: <FlexibleIcon size={iconSize} />,
                                    title: t(
                                        "boltz_plugin_feature_flexible_title",
                                    ),
                                    description: t(
                                        "boltz_plugin_feature_flexible_description",
                                    ),
                                },
                                {
                                    icon: <LiquidIcon size={iconSize} />,
                                    title: t(
                                        "boltz_plugin_feature_liquid_title",
                                    ),
                                    description: t(
                                        "boltz_plugin_feature_liquid_description",
                                    ),
                                },
                                {
                                    icon: <AutoSwapIcon size={iconSize} />,
                                    title: t(
                                        "boltz_plugin_feature_autoswap_title",
                                    ),
                                    description: t(
                                        "boltz_plugin_feature_autoswap_description",
                                    ),
                                },
                                {
                                    icon: <SelfCustodialIcon size={iconSize} />,
                                    title: t(
                                        "boltz_plugin_feature_self_custodial_title",
                                    ),
                                    description: t(
                                        "boltz_plugin_feature_self_custodial_description",
                                    ),
                                },
                            ]}>
                            {(feature) => (
                                <div class="content-item">
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
                        <div class="cta-buttons">
                            <a
                                class="btn-primary"
                                href="https://btcpay.docs.boltz.exchange/"
                                target="_blank"
                                rel="noopener noreferrer">
                                <span>{t("documentation")}</span>
                                <OcLinkexternal2 />
                            </a>
                            <a
                                class="btn-secondary"
                                href="https://github.com/BoltzExchange/boltz-btcpay-plugin"
                                target="_blank"
                                rel="noopener noreferrer">
                                <span>{t("view_on_github")}</span>
                                <BsGithub />
                            </a>
                        </div>
                    </div>
                    <img
                        class="product-screenshot slideLeft"
                        src={btcPayScreenshot}
                        alt="Plugin screenshot"
                    />
                </div>
                <div class="call-to-action slideUp">
                    <span>
                        <h3>{t("boltz_plugin_questions_title")}</h3>
                        <p>{t("boltz_plugin_questions_subtitle")}</p>
                    </span>
                    <button
                        class="btn-primary"
                        onClick={() => {
                            if (window.$chatwoot) {
                                window.$chatwoot.toggle("open");
                            }
                        }}>
                        <span>{t("chat_with_us")}</span>
                        <ChatIcon />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Btcpay;
