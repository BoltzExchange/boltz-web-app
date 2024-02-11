module.exports = {
    presets: [
        "@babel/preset-env",
        "babel-preset-solid",
        "@babel/preset-typescript",
    ],
    plugins: [
        [
            "@babel/plugin-transform-modules-commonjs",
            { allowTopLevelThis: true },
        ],
    ],
};
