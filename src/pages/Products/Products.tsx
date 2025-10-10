import { useNavigate } from "@solidjs/router";
import { For } from "solid-js";

import lnCircuitPro from "../../assets/ln-circuit-pro.svg";
import lnCircuit from "../../assets/ln-circuit.svg";
import { config } from "../../config";
import { useGlobalContext } from "../../context/Global";
import "../../style/products.scss";

const Products = () => {
    const { t } = useGlobalContext();
    const navigate = useNavigate();

    return (
        <div class="products">
            <div class="header">
                <h2>{t("products_description")}</h2>
            </div>
            <div class="content">
                <div class="grid">
                    <div class="products-grid">
                        <For
                            each={[
                                {
                                    id: "plugin",
                                    title: t("products_plugin_title"),
                                    description: t(
                                        "products_plugin_description",
                                    ),
                                    href: "/products/plugin",
                                },
                                {
                                    id: "client",
                                    title: t("products_client_title"),
                                    description: t(
                                        "products_client_description",
                                    ),
                                    href: "/products/client",
                                },
                                {
                                    id: "pro",
                                    title: t("products_pro_title"),
                                    description: t("products_pro_description"),
                                    href: "/products/pro",
                                },
                            ]}>
                            {(product) => (
                                <div
                                    class="product-item-body card fadeUp"
                                    data-type={product.id}
                                    onClick={() => navigate(product.href)}>
                                    <h4>{product.title}</h4>
                                    <p>{product.description}</p>
                                </div>
                            )}
                        </For>
                    </div>
                    <img
                        class="products-illustration blurOut"
                        src={config.isPro ? lnCircuitPro : lnCircuit}
                    />
                </div>
            </div>
        </div>
    );
};

export default Products;
