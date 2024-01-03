export const download = (filename: string, uri: string) => {
    const hidden = document.createElement("a");
    hidden.download = filename;
    hidden.href = uri;
    hidden.target = "_blank";
    hidden.click();
};

export const downloadJson = (file: string, content: any) => {
    download(
        `${file}.json`,
        `data:application/json;charset=utf-8,${encodeURI(
            JSON.stringify(content),
        )}`,
    );
};
