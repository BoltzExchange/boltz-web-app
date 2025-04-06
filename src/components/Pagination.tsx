import { useSearchParams } from "@solidjs/router";
import type { Accessor, Setter } from "solid-js";
import { For, createMemo, mergeProps, onMount } from "solid-js";

import { useGlobalContext } from "../context/Global";
import "../style/pagination.scss";

const Pagination = <T,>(initialProps: {
    items: Accessor<T[]>;
    setDisplayedItems: (items: T[]) => void;
    currentPage: Accessor<number>;
    setCurrentPage: Setter<number>;
    sort?: (items: T[]) => T[];
    itemsPerPage?: number;
    totalItems: number;
}) => {
    const props = mergeProps({ itemsPerPage: 15 }, initialProps);
    const { t } = useGlobalContext();

    const [searchParams, setSearchParams] = useSearchParams();

    const updateDisplayedItems = () => {
        const indexOfLastItem = props.currentPage() * props.itemsPerPage;
        const indexOfFirstItem = indexOfLastItem - props.itemsPerPage;

        let displayedItems = props.items();

        if (typeof props.sort === "function") {
            displayedItems = props.sort(displayedItems);
        }

        props.setDisplayedItems(
            displayedItems.slice(indexOfFirstItem, indexOfLastItem),
        );
    };

    onMount(() => updateDisplayedItems());

    const numberOfPages = createMemo(() => {
        const totalPages = Math.ceil(props.totalItems / props.itemsPerPage);
        const numberOfPages = Array.from(
            { length: totalPages },
            (_, index) => index + 1,
        );

        let page = Number(searchParams.page);

        if (isNaN(page) || page < 1 || page > numberOfPages.length) {
            page = 1;
            setSearchParams({ page });
        }

        props.setCurrentPage(page);

        return numberOfPages;
    });

    const navigatePreviously = () => {
        const page = props.setCurrentPage((prev: number) => prev - 1);
        setSearchParams({ page });
        updateDisplayedItems();
    };

    const navigateToNumber = (pageNumber: number) => {
        const page = props.setCurrentPage(pageNumber);
        setSearchParams({ page });
        updateDisplayedItems();
    };

    const navigateNext = () => {
        const page = props.setCurrentPage((prev: number) => prev + 1);
        setSearchParams({ page });
        updateDisplayedItems();
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
            <nav class="pagination">
                <ul>
                    <li>
                        <button
                            data-testid="previous-page"
                            disabled={props.currentPage() === 1}
                            onClick={navigatePreviously}>
                            {t("back").toUpperCase()}
                        </button>
                    </li>
                    <For each={pageNumbers()}>
                        {(pageNumber) => (
                            <li class="pagination-item">
                                <button
                                    data-testid={`page-${pageNumber}`}
                                    class={`${props.currentPage() === pageNumber ? "active" : ""}`}
                                    onClick={() =>
                                        navigateToNumber(pageNumber)
                                    }>
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
                            onClick={navigateNext}>
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
