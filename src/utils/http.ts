export const checkResponse = <T = any>(response: Response): Promise<T> => {
    if (!response.ok) {
        return Promise.reject(response);
    }
    return response.json();
};
