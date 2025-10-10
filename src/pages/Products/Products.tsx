import { A } from "@solidjs/router";
import { VsChevronRight } from "solid-icons/vs";
import { For } from "solid-js";

import { useGlobalContext } from "../../context/Global";
import "../../style/products.scss";

const Products = () => {
    const { t } = useGlobalContext();

    return (
        <div class="products">
            <div class="header grid">
                <h2>{t("products_name")}</h2>
                <h1>{t("products_description")}</h1>
            </div>
            <div class="content">
                <div class="grid">
                    <div class="content-grid">
                        <For
                            each={[
                                {
                                    title: t("products_plugin_title"),
                                    description: t(
                                        "products_plugin_description",
                                    ),
                                    href: "/products/plugin",
                                },
                                {
                                    title: t("products_client_title"),
                                    description: t(
                                        "products_client_description",
                                    ),
                                    href: "/products/client",
                                },
                                {
                                    title: t("products_pro_title"),
                                    description: t("products_pro_description"),
                                    href: "/products/pro",
                                },
                            ]}>
                            {(product) => (
                                <div class="content-item">
                                    <div class="content-item-body">
                                        <h3>{product.title}</h3>
                                        <p>{product.description}</p>
                                        <A
                                            class="btn-secondary"
                                            href={product.href}>
                                            {t("learn_more")}
                                            <VsChevronRight size={16} />
                                        </A>
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Products;
