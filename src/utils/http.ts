export const checkResponse = <T = unknown>(response: Response): Promise<T> => {
    if (!response.ok) {
        return Promise.reject(response);
    }
    return response.json();
};
