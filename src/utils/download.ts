export const rescueFileTypes =
    "application/json,image/png,imagine/jpg,image/jpeg";

export const getBackupFileName = (): string => {
    return `boltz-backup-${Math.floor(Date.now() / 1000)}-SECRET_DO_NOT_SHARE`;
};

export const getRefundFileName = (swapId: string): string => {
    return `boltz-refund-${swapId}-SECRET_DO_NOT_SHARE`;
};

export const download = (file: string, content: string) => {
    const hidden = document.createElement("a");
    hidden.download = file;
    hidden.href = content;
    hidden.target = "_blank";
    hidden.click();
};

export const downloadJson = <T>(
    file: string,
    content: T extends Promise<T> ? never : T,
) => {
    download(
        `${file}.json`,
        `data:application/json;charset=utf-8,${encodeURI(
            JSON.stringify(content),
        )}`,
    );
};
