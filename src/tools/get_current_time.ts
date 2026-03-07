export const getCurrentTimeDef = {
    type: 'function',
    function: {
        name: 'get_current_time',
        description: 'Get the current system time.',
        parameters: {
            type: 'object',
            properties: {},
            required: []
        }
    }
};

export async function getCurrentTime() {
    return new Date().toISOString();
}
