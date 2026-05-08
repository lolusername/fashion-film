export const getById = (id) => {
    const element = document.getElementById(id);

    if (!element) {
        throw new Error(`Missing required element: #${id}`);
    }

    return element;
};
