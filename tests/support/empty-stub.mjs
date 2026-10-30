export const cookies = async () => ({ get: () => undefined, getAll: () => [], set() {} });
export const redirect = () => { throw new Error("redirect"); };
export const notFound = () => { throw new Error("notFound"); };
export default {};
