import { BsGlobe, BsTelegram } from "solid-icons/bs";
import { FaSolidCode } from "solid-icons/fa";
import { HiSolidXMark } from "solid-icons/hi";
import { OcLinkexternal2 } from "solid-icons/oc";
import { VsArrowSmallRight, VsCheck } from "solid-icons/vs";
import { For } from "solid-js";

import Chart, { type Point } from "../../components/Chart";
import ExternalLink from "../../components/ExternalLink";
import { config } from "../../config";
import { BTC, LN } from "../../consts/Assets";
import { useGlobalContext } from "../../context/Global";
import "../../style/pro.scss";
import feeSample from "./pro-fee-sample.json";

const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);

    const dateFormatter = new Intl.DateTimeFormat(navigator.language, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
    });

    return dateFormatter.format(date);
};

const proFeeSample: Point[] = feeSample.fees.map(
    (fee): Point => ({ x: formatDate(fee[0]), y: fee[1] }),
);

const Pro = () => {
    const { t } = useGlobalContext();

    return (
        <div class="products-pro">
            <div class="header">
                <h1>{t("boltz_pro_name")}</h1>
                <h2>{t("boltz_pro_description")}</h2>
            </div>
            <div class="content">
                <div class="intro-section">
                    <div class="intro-details">
                        <h3>{t("boltz_pro_how_it_works_title")}</h3>
                        <p>{t("boltz_pro_how_it_works_description")}</p>
                    </div>
                    <div class="chart card">
                        <p>{t("boltz_pro_chart_title")}</p>
                        <Chart
                            data={proFeeSample}
                            axesLabels={{
                                y: t("boltz_pro_chart_y_axis"),
                                x: t("boltz_pro_chart_x_axis"),
                            }}
                            tooltip={(point) => (
                                <div class="tooltip">
                                    <span
                                        class={
                                            point.y === 0.1
                                                ? "regular"
                                                : (point.y as number) < 0
                                                  ? "negative"
                                                  : "positive"
                                        }>
                                        {point.y as number}%
                                    </span>
                                    {point.x as string}
                                </div>
                            )}
                        />
                        <div class="caption">
                            <div class="swaplist-asset">
                                <span data-asset={BTC} />
                                <VsArrowSmallRight />
                                <span data-asset={LN} />
                            </div>
                            <p data-type="regular">
                                {t("boltz_pro_regular_fee")}
                            </p>
                            <p data-type="negative">
                                {t("boltz_pro_negative_fee")}
                            </p>
                            <p data-type="positive">
                                {t("boltz_pro_lower_fee")}
                            </p>
                        </div>
                    </div>
                </div>
                <div class="options-section">
                    <div class="options-section-header slideUp">
                        <h3>{t("boltz_pro_options_title")}</h3>
                        <p>{t("boltz_pro_options_subtitle")}</p>
                    </div>
                    <For
                        each={[
                            {
                                icon: <BsGlobe size={18} />,
                                title: t("boltz_pro_option_web_title"),
                                href: config.isPro
                                    ? "/"
                                    : "https://pro.boltz.exchange",
                                description: t(
                                    "boltz_pro_option_web_description",
                                ),
                                external: config.isPro ? false : true,
                            },
                            {
                                icon: <FaSolidCode size={18} />,
                                title: t("boltz_pro_option_client_title"),
                                href: "/products/client",
                                description: t(
                                    "boltz_pro_option_client_description",
                                ),
                                external: false,
                            },
                            {
                                icon: <BsTelegram size={18} />,
                                title: t("boltz_pro_option_telegram_title"),
                                href: "https://t.me/boltz_pro_bot",
                                description: t(
                                    "boltz_pro_option_telegram_description",
                                ),
                                external: true,
                            },
                        ]}>
                        {(item) =>
                            item.external ? (
                                <ExternalLink
                                    href={item.href}
                                    class="card options-card sequentialFadeUp">
                                    <h4>
                                        {item.icon} {item.title}
                                    </h4>
                                    <p>{item.description}</p>
                                </ExternalLink>
                            ) : (
                                <a
                                    href={item.href}
                                    class="card options-card sequentialFadeUp">
                                    <h4>
                                        {item.icon} {item.title}
                                    </h4>
                                    <p>{item.description}</p>
                                </a>
                            )
                        }
                    </For>
                </div>
                <div class="target-audience-section slideUp">
                    <div class="target-header">
                        <h3>{t("boltz_pro_target_audience_title")}</h3>
                        <p>{t("boltz_pro_target_audience_subtitle")}</p>
                    </div>
                    <div class="target-cards">
                        <div class="card perfect-for">
                            <h4>{t("boltz_pro_perfect_for_title")}</h4>
                            <ul>
                                <For
                                    each={[
                                        t("boltz_pro_perfect_for_1"),
                                        t("boltz_pro_perfect_for_2"),
                                        t("boltz_pro_perfect_for_3"),
                                    ]}>
                                    {(item) => (
                                        <li>
                                            <VsCheck />
                                            {item}
                                        </li>
                                    )}
                                </For>
                            </ul>
                        </div>
                        <div class="card not-designed-for">
                            <h4>{t("boltz_pro_not_designed_for_title")}</h4>
                            <ul>
                                <For
                                    each={[
                                        t("boltz_pro_not_designed_for_1"),
                                        t("boltz_pro_not_designed_for_2"),
                                        t("boltz_pro_not_designed_for_3"),
                                    ]}>
                                    {(item) => (
                                        <li>
                                            <HiSolidXMark />
                                            {item}
                                        </li>
                                    )}
                                </For>
                            </ul>
                        </div>
                    </div>
                </div>

                <div class="call-to-action slideUp">
                    <div class="text">
                        <h3>{t("boltz_pro_cta_title")}</h3>
                        <p>{t("boltz_pro_cta_subtitle")}</p>
                    </div>
                    <div class="cta-buttons">
                        {config.isPro ? (
                            <a class="btn-primary" href="/">
                                <span>{t("get_started")}</span>
                            </a>
                        ) : (
                            <ExternalLink
                                class="btn-primary"
                                href="https://pro.boltz.exchange/">
                                <span>{t("get_started")}</span>
                                <OcLinkexternal2 />
                            </ExternalLink>
                        )}
                        <ExternalLink
                            class="btn-secondary"
                            href="https://api.docs.boltz.exchange/pro.html">
                            <span>{t("learn_more")}</span>
                            <OcLinkexternal2 />
                        </ExternalLink>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Pro;
