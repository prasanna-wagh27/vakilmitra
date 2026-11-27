/** CNR rules live in @vakilmitra/shared, so forms and the API check a CNR the same way. */
export { formatCnr, normalizeCnr } from "@vakilmitra/shared";

import { normalizeCnr } from "@vakilmitra/shared";

export const isCnr = (input: string | null | undefined) => normalizeCnr(input) !== null;

/** Cases in a High Court have CNRs starting HC (HCBM = Bombay High Court). */
export const isHighCourtCnr = (cnr: string) => cnr.startsWith("HC");
