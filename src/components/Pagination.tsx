import { Accessor, For, Setter, onMount } from "solid-js";
import { createSignal } from "solid-js";

import { useGlobalContext } from "../context/Global";
import "../style/pagination.scss";

const Pagination = (props: {
    items: Accessor<unknown[]>;
    setDisplayedItems: (items: unknown[]) => void;
    currentPage: Accessor<number>;
    setCurrentPage: Setter<number>;
    sort?: (items: unknown[]) => unknown[];
    itemsPerPage: number;
    totalItems: number;
}) => {
    const { t } = useGlobalContext();
    const [numberOfPages, setNumberOfPages] = createSignal<number[]>([]);

    onMount(() => {
        const numberOfPages = [];
        for (
            let i = 1;
            i <= Math.ceil(props.totalItems / props.itemsPerPage);
            i++
        ) {
            numberOfPages.push(i);
        }
        setNumberOfPages(numberOfPages);
        updateDisplayedItems();
    });

    const updateDisplayedItems = () => {
        const indexOfLastItem = props.currentPage() * props.itemsPerPage;
        const indexOfFirstItem = indexOfLastItem - props.itemsPerPage;

        let displayedItems = props.items();

        if (typeof props.sort === "function") {
            displayedItems = props.sort(displayedItems);
        }

        props.setDisplayedItems(
            displayedItems.slice(
                indexOfFirstItem,
                indexOfLastItem,
            ) as unknown[],
        );
    };

    const pageNumbers = () => {
        const current = props.currentPage();
        const total = numberOfPages().length;

        let start: number;
        let end: number;

        // Always displays a maximum of 5 page numbers
        if (current <= 2) {
            start = 0;
            end = 5;
        } else if (current >= total - 1) {
            start = total - 5;
            end = total;
        } else {
            start = current - 3;
            end = current + 2;
        }

        return numberOfPages().slice(Math.max(0, start), Math.min(total, end));
    };

    return (
        <>
            <nav>
                <ul class="pagination">
                    <li>
                        <button
                            data-testid="previous-page"
                            disabled={props.currentPage() === 1}
                            onClick={() => {
                                props.setCurrentPage(
                                    (prev: number) => prev - 1,
                                );
                                updateDisplayedItems();
                            }}>
                            {t("back").toUpperCase()}
                        </button>
                    </li>
                    <For each={pageNumbers()}>
                        {(pageNumber) => (
                            <li class="pagination-item">
                                <button
                                    data-testid={`page-${pageNumber}`}
                                    class={`${props.currentPage() === pageNumber ? "active" : ""}`}
                                    onClick={() => {
                                        props.setCurrentPage(pageNumber);
                                        updateDisplayedItems();
                                    }}>
                                    {pageNumber}
                                </button>
                            </li>
                        )}
                    </For>
                    <li>
                        <button
                            data-testid="next-page"
                            disabled={
                                props.currentPage() ===
                                numberOfPages()[numberOfPages().length - 1]
                            }
                            onClick={() => {
                                props.setCurrentPage(
                                    (prev: number) => prev + 1,
                                );
                                updateDisplayedItems();
                            }}>
                            {t("next").toUpperCase()}
                        </button>
                    </li>
                </ul>
            </nav>
            <p>
                {t("pagination_info", {
                    start: props.currentPage,
                    end: numberOfPages().length,
                })}
            </p>
        </>
    );
};

export default Pagination;
