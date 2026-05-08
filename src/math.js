export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const getClientPoint = (event) => {
    if (event.touches?.length) {
        return {
            x: event.touches[0].clientX,
            y: event.touches[0].clientY,
        };
    }

    return {
        x: event.clientX,
        y: event.clientY,
    };
};

// Convert screen input into shader controls: x is temperature, y is contrast.
export const normalizePointer = (event, element) => {
    const point = getClientPoint(event);
    const rect = element.getBoundingClientRect();

    return {
        x: clamp((point.x - rect.left) / rect.width, 0, 1),
        y: clamp(1 - ((point.y - rect.top) / rect.height), 0, 1),
    };
};
