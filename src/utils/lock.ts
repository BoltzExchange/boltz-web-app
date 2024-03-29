class Lock {
    private locked = false;
    private readonly waiting: (() => void)[] = [];

    public acquire = async (promise: () => Promise<void>) => {
        while (this.locked) {
            await new Promise<void>((resolve) => this.waiting.push(resolve));
        }

        this.locked = true;
        await promise();

        this.locked = false;
        if (this.waiting.length > 0) {
            const nextResolve = this.waiting.shift();
            nextResolve();
        }
    };
}

export default Lock;
