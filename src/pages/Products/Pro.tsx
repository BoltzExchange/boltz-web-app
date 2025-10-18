import { BiSolidServer } from "solid-icons/bi";
import { BsGithub, BsHandThumbsDownFill } from "solid-icons/bs";
import { FaSolidCarrot as TaprootIcon } from "solid-icons/fa";
import { FaSolidRobot as AutoSwapIcon } from "solid-icons/fa";
import { FiTrendingDown, FiUsers } from "solid-icons/fi";
import { IoWater as LiquidIcon } from "solid-icons/io";
import { OcLinkexternal2 } from "solid-icons/oc";
import { VsArrowRight, VsArrowSmallRight } from "solid-icons/vs";
import { For } from "solid-js";

import boltzProMain from "../../assets/pro-screenshot-2.svg";
import boltzProSecondary from "../../assets/pro-screenshot-3.svg";
import Chart, { type Point } from "../../components/Chart";
import { BTC, LBTC } from "../../consts/Assets";
import { useGlobalContext } from "../../context/Global";
import "../../style/pro.scss";

// import { getBoltzProHistoricalFees } from "../../utils/fees";

const iconSize = 38;

// const feeMock = [
//     [

//     ],
// ];

const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);

    const dateFormatter = new Intl.DateTimeFormat(navigator.language, {
        day: "numeric",
        month: "short",
    });

    return dateFormatter.format(date);
};

const feeMock: Point[] = [
    { x: formatDate(1760463523), y: 0.15 },
    { x: formatDate(1760464723), y: 0.0 },
    { x: formatDate(1760465923), y: -0.1 },
    { x: formatDate(1760466523), y: -0.1 },
    { x: formatDate(1760467123), y: 0.1 },
    { x: formatDate(1760467723), y: 0.01 },
    { x: formatDate(1760468323), y: 0.05 },
    { x: formatDate(1760468923), y: -0.15 },
    { x: formatDate(1760469523), y: 0.2 },
    { x: formatDate(1760470123), y: 0.1 },
    { x: formatDate(1760466523), y: -0.1 },
    { x: formatDate(1760467123), y: 0.1 },
    { x: formatDate(1760467723), y: 0.01 },
    { x: formatDate(1760468323), y: 0.05 },
    { x: formatDate(1760468923), y: -0.15 },
    { x: formatDate(1760469523), y: 0.2 },
    { x: formatDate(1760470123), y: 0.1 },
];

const Pro = () => {
    const { t } = useGlobalContext();

    return (
        <div class="products-pro">
            <div class="header">
                <h2>{t("boltz_pro_name")}</h2>
                <h1>{t("boltz_pro_description")}</h1>
            </div>
            <div class="content">
                <div class="intro-section">
                    <div class="intro-details">
                        <h2>What is Boltz Pro?</h2>
                        <span>
                            <p>
                                Lorem, ipsum dolor sit amet consectetur
                                adipisicing elit. Omnis laboriosam impedit
                                nesciunt unde obcaecati, numquam nam molestiae
                                quos fugit corporis!
                            </p>
                            <p>
                                Lorem ipsum dolor sit, amet consectetur
                                adipisicing elit. Dolor, eveniet sapiente
                                praesentium reiciendis exercitationem quaerat?
                            </p>
                        </span>
                    </div>
                    <img src={boltzProMain} alt="Boltz Pro Screenshot" />
                </div>
                <div class="target-audience-section">
                    <div class="section-header">
                        <h2>Who is Boltz Pro For?</h2>
                        <p>
                            Perfect for professionals, not for time-critical
                            payments
                        </p>
                    </div>
                    <div class="card perfect-for">
                        <span>
                            <FiUsers size={24} />
                            <h3>Perfect For</h3>
                        </span>
                        <ul>
                            <li>
                                <VsArrowRight />
                                Lightning node operators looking to decrease
                                excess inbound liquidity and earn sats
                            </li>
                            <li>
                                <VsArrowRight />
                                Professionals collaborating with external node
                                operators to manage liquidity
                            </li>
                            <li>
                                <VsArrowRight />
                                Users topping up Lightning wallets (like
                                Phoenix) within routing limits
                            </li>
                        </ul>
                    </div>
                    <div class="card not-designed-for">
                        <span>
                            <FiTrendingDown size={24} />
                            <h3>Not Designed For</h3>
                        </span>
                        <ul>
                            <li>
                                Time-critical use cases like paying with
                                Lightning in a coffee shop
                            </li>
                            <li>
                                Payment reliability to expensive destinations
                                with high routing fees
                            </li>
                            <li>
                                Scenarios requiring guaranteed instant
                                settlement
                            </li>
                        </ul>
                    </div>
                </div>
                <div class="chart-section">
                    <img src={boltzProSecondary} alt="Boltz Pro Screenshot 3" />
                    <div class="chart-content">
                        <div>
                            <h2>Past Pro Opportunities</h2>
                            <p>
                                Lorem, ipsum dolor sit amet consectetur
                                adipisicing elit. Quis, exercitationem.
                            </p>
                        </div>
                        <div class="card chart">
                            <Chart
                                data={feeMock}
                                options={{
                                    height: 220,
                                }}
                            />
                            <div class="caption">
                                <div class="swaplist-asset">
                                    <span data-asset={BTC} />
                                    <VsArrowSmallRight />
                                    <span data-asset={LBTC} />
                                </div>
                                <p data-type="negative">
                                    Negative Fee: you earn sats
                                </p>
                                <p data-type="positive">
                                    Lower Fee: you save sats
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="call-to-action">
                    <div class="text">
                        <h1>Start earning sats now</h1>
                        <p>
                            Head over to Boltz Pro and check out the latest
                            earning opportunities.
                        </p>
                    </div>
                    <div class="buttons-line">
                        <a
                            class="btn-primary"
                            href="https://pro.boltz.exchange/"
                            target="_blank">
                            <span>Get Started</span>
                            <OcLinkexternal2 />
                        </a>
                        <a
                            class="btn-secondary"
                            href="https://github.com/BoltzExchange/boltz-pro"
                            target="_blank">
                            <span>View on GitHub</span>
                            <BsGithub />
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Pro;
