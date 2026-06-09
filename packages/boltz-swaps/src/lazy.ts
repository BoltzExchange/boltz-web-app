import { getLogger } from "./logger.ts";

class Loader<T> {
    private modules?: T;
    private loading?: Promise<T>;

    constructor(
        private readonly name: string,
        private readonly initializer: () => Promise<T>,
    ) {}

    public get = async (): Promise<T> => {
        if (this.modules !== undefined) {
            return this.modules;
        }

        if (this.loading === undefined) {
            getLogger().info(`Loading ${this.name} modules`);
            this.loading = this.initializer()
                .then((modules) => {
                    this.modules = modules;
                    return modules;
                })
                .finally(() => {
                    this.loading = undefined;
                });
        }

        return await this.loading;
    };
}

export default Loader;
